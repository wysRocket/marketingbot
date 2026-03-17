import "dotenv/config";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { chromium } from "patchright";
import type { Page } from "playwright";
import { browseHomepage } from "./flows/browseHomepage";
import { browseFooterLinks } from "./flows/browseFooterLinks";
import { login } from "./flows/login";
import { explorePricing } from "./flows/explorePricing";
import { accountDashboard } from "./flows/accountDashboard";
import type { PatchrightProfile } from "./profiles/patchright-profiles";
import {
  generateFingerprints,
  generateRunToken,
} from "./profiles/fingerprint-generator";
import {
  getSessionPolicyFromEnv,
  runComplexSession,
  type NamedFlow,
} from "./session/complexSession";
import { createTelemetryPersistence } from "./session/telemetryPersistence";
import { getActiveSiteProfile, isFlowEnabled } from "./sites";

// -------------------------------------------------------------------
// CREDENTIALS
// -------------------------------------------------------------------
const USERNAME = process.env.BOT_USERNAME ?? "";
const PASSWORD = process.env.BOT_PASSWORD ?? "";
const SESSION_POLICY = getSessionPolicyFromEnv();
const TELEMETRY = createTelemetryPersistence("patchright");
const SITE = getActiveSiteProfile();

const MAX_CONCURRENT = parseInt(process.env.CONCURRENCY ?? "20", 10);
const POOL_SIZE = parseInt(process.env.POOL_SIZE ?? "60", 10);
const TOTAL_ROUNDS = parseInt(process.env.TOTAL_ROUNDS ?? "1000", 10);

// 60 fingerprints generated once at startup — the pool stays fixed for the
// whole run. Each round randomly selects MAX_CONCURRENT from it.
// userDataDir is keyed by pool profile ID so when the same profile ID is
// selected again in a later round its HTTP disk cache is still warm.
const CACHE_DIR = path.join(os.homedir(), ".cache", "marketingbot-patchright");
const POOL: PatchrightProfile[] = generateFingerprints(POOL_SIZE);

function pickRandom<T>(items: T[], limit: number): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.min(limit, shuffled.length));
}

// -------------------------------------------------------------------
// PROXY
//
// buildProxy is called with a per-round runToken so every round gets a
// fresh DataImpulse sticky session → fresh exit IP for every slot.
//
// Chromium does NOT support SOCKS5 proxy auth via the URI scheme.
// Use http:// with separate username/password fields instead.
// -------------------------------------------------------------------
function buildProxy(
  slotIndex: number,
  runToken: string,
): { server: string; username: string; password: string } | undefined {
  const user = process.env.DI_USER;
  const pass = process.env.DI_PASS;
  if (!user || !pass) return undefined;
  const protocol = process.env.DI_PROXY_PROTOCOL ?? "http";
  // DataImpulse sticky-session format: {user}_session-{sessid} (sessid max 32 chars)
  // runToken = 8 hex chars, slotIndex = 2 digits → 10 chars total.
  const sessId = `${runToken}${slotIndex.toString().padStart(2, "0")}`;
  return {
    server: `${protocol}://gw.dataimpulse.com:10000`,
    username: `${user}_session-${sessId}`,
    password: pass,
  };
}

function buildFlowSequence(username: string, password: string): NamedFlow[] {
  const flows: NamedFlow[] = [];

  if (isFlowEnabled(SITE, "browseHomepage")) {
    flows.push({
      name: "browseHomepage",
      run: async (page, label, ctx) => {
        const result = await browseHomepage(page, SITE);
        ctx.trackNavigation(page.url());
        ctx.addInteraction(3);

        console.log(`  [${label}] hero: ${result.heroHeading}`);
        console.log(
          `  [${label}] features found: ${result.featureNames.length}`,
        );
        console.log(
          `  [${label}] pricing tiers: ${result.pricingTiers.length}`,
        );
        console.log(`  [${label}] footer links: ${result.footerLinks.length}`);
      },
    });
  }

  if (isFlowEnabled(SITE, "explorePricing")) {
    flows.push({
      name: "explorePricing",
      run: async (page, label, ctx) => {
        const result = await explorePricing(page, SITE);
        ctx.trackNavigation(page.url());
        ctx.addInteraction(3);

        console.log(
          `  [${label}] tiers: ${result.tiers.map((t) => t.name).join(", ") || "(none named)"}`,
        );
        console.log(`  [${label}] CTA links valid: ${result.ctaLinksValid}`);
      },
    });
  }

  if (isFlowEnabled(SITE, "browseFooterLinks")) {
    flows.push({
      name: "browseFooterLinks",
      run: async (page, label, ctx) => {
        const result = await browseFooterLinks(page, SITE);
        ctx.trackNavigation(page.url());
        ctx.addInteraction(result.visited.length + 1);

        for (const visit of result.visited) {
          console.log(
            `  [${label}] ${visit.path} → "${visit.heading}" (${visit.url})`,
          );
        }
      },
    });
  }

  if (username && password && isFlowEnabled(SITE, "login")) {
    flows.push({
      name: isFlowEnabled(SITE, "accountDashboard")
        ? "login+dashboard"
        : "login",
      run: async (page, label, ctx) => {
        const loginResult = await login(page, username, password, SITE);
        ctx.trackNavigation(loginResult.finalUrl);
        ctx.addInteraction(2);

        if (!loginResult.success) {
          const warning = `Login failed: ${loginResult.errorMessage ?? "Unknown auth error"}`;
          ctx.addWarning(warning);
          console.error(`  [${label}] ${warning}`);
          return;
        }

        console.log(`  [${label}] Logged in. Landed: ${loginResult.finalUrl}`);

        if (!isFlowEnabled(SITE, "accountDashboard")) return;

        const accountResult = await accountDashboard(page, SITE);
        ctx.trackNavigation(page.url());
        ctx.addInteraction(2);

        console.log(
          `  [${label}] Credit balance: ${accountResult.creditBalance}`,
        );
        console.log(
          `  [${label}] Orders on record: ${accountResult.orders.length}`,
        );
        console.log(
          `  [${label}] Payment methods present: ${accountResult.hasPaymentMethods}`,
        );
      },
    });
  }

  if (flows.length === 0) {
    throw new Error(
      `No enabled flows for site profile "${SITE.id}". Check src/sites/profiles/${SITE.id}.json`,
    );
  }

  return flows;
}

// -------------------------------------------------------------------
// SESSION RUNNER
//
// Every call creates a brand-new browser context with a fresh random
// fingerprint and fresh proxy session. The context is closed at the end
// of the session so the next round starts clean.
//
// The userDataDir is stable (slot-based) so Chromium's HTTP disk cache
// survives across rounds — cache hits reduce proxy traffic even though
// the fingerprint and IP change every visit.
// -------------------------------------------------------------------
async function runProfileSession(
  profile: PatchrightProfile,
  slotIndex: number,
  runToken: string,
  label: string,
): Promise<void> {
  const proxy = buildProxy(slotIndex, runToken);
  // Key userDataDir by pool profile ID — if the same profile is selected
  // again in a future round it reuses its warm HTTP disk cache.
  const userDataDir = path.join(CACHE_DIR, profile.id);
  fs.mkdirSync(userDataDir, { recursive: true });

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--disable-dev-shm-usage",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-accelerated-2d-canvas",
      "--disable-gpu",
      "--disk-cache-size=209715200",
      // Block images at the Blink engine level — avoids context.route() which
      // internally calls Fetch.enable and disrupts Chrome's HTTP cache pipeline.
      "--blink-settings=imagesEnabled=false,loadsImagesAutomatically=false",
    ],
    ...profile.config,
    ...(proxy ? { proxy } : {}),
  });

  // No context.route() calls — Fetch.enable must stay inactive for cache to work.

  const page = (await context.newPage()) as unknown as Page;

  try {
    const flows = buildFlowSequence(USERNAME, PASSWORD);

    console.log(
      `[${label}] ${profile.name} | ${profile.config.locale ?? "en-US"} ${profile.config.timezoneId ?? ""} | proxy: ${proxy?.username ?? "none"} | flows: ${flows.map((f) => f.name).join(" → ")}`,
    );

    const telemetry = await runComplexSession({
      page,
      label,
      flows,
      policy: SESSION_POLICY,
      baseUrl: SITE.baseUrl,
      seedCandidates: SITE.session.seedCandidates,
    });

    console.log(
      `[${label}] ${Math.round(telemetry.elapsedMs / 1000)}s | ${telemetry.uniquePages.length} page(s) | ${telemetry.interactions} interaction(s)`,
    );
    console.log(
      `  [${label}] traffic: ${(telemetry.trafficBytesTotal / (1024 * 1024)).toFixed(2)} MB total, ${(telemetry.trafficBytesSameOrigin / (1024 * 1024)).toFixed(2)} MB same-origin, ${telemetry.trafficRequestCount} req`,
    );
    console.log(
      `  [${label}] top origins: ${
        telemetry.trafficTopOrigins
          .slice(0, 3)
          .map(
            (item) =>
              `${item.key} ${(item.bytes / (1024 * 1024)).toFixed(2)}MB/${item.requests}req`,
          )
          .join(" | ") || "(none)"
      }`,
    );
    console.log(`  [${label}] URLs: ${telemetry.uniquePages.join(" | ")}`);

    for (const warning of telemetry.warnings) {
      console.warn(`  [${label}] warning: ${warning}`);
    }

    await TELEMETRY.persistSession({
      label,
      profileId: profile.id,
      telemetry,
      policy: SESSION_POLICY,
    }).catch((err) => {
      console.warn(
        `  [${label}] warning: failed to persist telemetry: ${(err as Error).message}`,
      );
    });
  } finally {
    await page.close();
    await context.close(); // close context — next round gets a fresh fingerprint + IP
  }
}

// -------------------------------------------------------------------
// ENTRY POINT
// -------------------------------------------------------------------
(async () => {
  console.log(`Starting Patchright bot for ${SITE.baseUrl}/ (${SITE.id})`);
  console.log(`[telemetry] JSONL: ${TELEMETRY.jsonPath}`);
  console.log(`[telemetry] CSV:   ${TELEMETRY.csvPath}`);
  console.log(
    `[config] pool: ${POOL_SIZE} | concurrency: ${MAX_CONCURRENT} | rounds: ${TOTAL_ROUNDS}\n`,
  );

  let round = 0;

  while (round < TOTAL_ROUNDS) {
    // Randomly pick MAX_CONCURRENT profiles from the pool each round —
    // same pattern as MostLogin. runToken gives every slot a fresh proxy IP.
    const selected = pickRandom(POOL, MAX_CONCURRENT);
    const runToken = generateRunToken();

    console.log(
      `--- Round ${round + 1}/${TOTAL_ROUNDS} | token: ${runToken} | profiles: ${selected.map((p) => p.id).join(", ")} ---`,
    );

    const sessions = selected.map((profile, index) => {
      const label = `P${index + 1}`;
      return new Promise<void>((resolve) => setTimeout(resolve, index * 3_000))
        .then(() => runProfileSession(profile, index, runToken, label))
        .catch((err: unknown) => ({ label, error: err as Error }));
    });

    const results = await Promise.all(sessions);
    const failures = results.filter(
      (result): result is { label: string; error: Error } =>
        typeof result === "object" && result !== null && "error" in result,
    );

    for (const failure of failures) {
      console.error(
        `[${failure.label}] Session failed: ${failure.error.message}`,
      );
    }

    round++;
  }

  console.log("\nAll rounds complete.");
})();

// Chrome processes are closed by context.close() in runProfileSession.
// These handlers cover the case where Ctrl+C interrupts mid-round.
process.once("SIGINT", () => process.exit(0));
process.once("SIGTERM", () => process.exit(0));
