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
import { listProfileIds, getProfile } from "./profiles/patchright-profiles";
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

// Each profile gets its own user-data dir so Chromium's HTTP disk cache
// persists between bot rounds — static assets (JS/CSS/fonts/images) cached
// on the first visit won't consume proxy bandwidth on subsequent sessions.
const CACHE_DIR = path.join(os.homedir(), ".cache", "marketingbot-patchright");

// Playwright proxy config: credentials must be separate fields.
// Chromium does NOT support SOCKS5 proxy auth — use http:// protocol
// so Playwright can negotiate auth via HTTP CONNECT tunnel instead.
// DI_PROXY_PROTOCOL env override lets you switch to socks5 for no-auth cases.
function buildProxy():
  | { server: string; username: string; password: string }
  | undefined {
  const user = process.env.DI_USER;
  const pass = process.env.DI_PASS;
  if (!user || !pass) return undefined;
  const protocol = process.env.DI_PROXY_PROTOCOL ?? "http";
  return {
    server: `${protocol}://gw.dataimpulse.com:10000`,
    username: user,
    password: pass,
  };
}

function pickRandom<T>(items: T[], limit: number): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, limit);
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
        console.log(`  [${label}] features found: ${result.featureNames.length}`);
        console.log(`  [${label}] pricing tiers: ${result.pricingTiers.length}`);
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
      name: isFlowEnabled(SITE, "accountDashboard") ? "login+dashboard" : "login",
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

        console.log(`  [${label}] Credit balance: ${accountResult.creditBalance}`);
        console.log(`  [${label}] Orders on record: ${accountResult.orders.length}`);
        console.log(`  [${label}] Payment methods present: ${accountResult.hasPaymentMethods}`);
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
// -------------------------------------------------------------------
async function runProfileSession(profileId: string, label: string): Promise<void> {
  const profile = getProfile(profileId);
  if (!profile) throw new Error(`Patchright profile not found: ${profileId}`);

  const proxy = buildProxy();

  // Persist the Chromium profile (HTTP disk cache, cookies, storage) so
  // repeated rounds reuse cached assets instead of re-fetching via proxy.
  const userDataDir = path.join(CACHE_DIR, profileId);
  fs.mkdirSync(userDataDir, { recursive: true });

  // launchPersistentContext merges launch + context options in one call.
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--disable-dev-shm-usage",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-accelerated-2d-canvas",
      "--disable-gpu",
      // Headless Chromium sometimes limits the disk cache to a few MB.
      // Enforce 200 MB so HTTP assets are actually retained between rounds.
      "--disk-cache-size=209715200",
    ],
    ...profile.config,
    ...(proxy ? { proxy } : {}),
  });

  try {
    // Block images, media, and fonts to reduce proxy traffic.
    // Analytics/GTM origins are intentionally NOT blocked — those requests
    // must fire for page visits to appear in Google Analytics.
    // After the HTTP cache warms up (round 2+), GTM scripts are served from
    // the local disk cache and cost ~0 proxy bytes, same as MostLogin.
    await context.route("**/*", (route) => {
      const type = route.request().resourceType();
      if (type === "image" || type === "media" || type === "font") {
        route.abort();
      } else {
        route.continue();
      }
    });

    // patchright is a drop-in fork of playwright; the Page types are
    // structurally identical at runtime but nominally different to TS.
    const page = (await context.newPage()) as unknown as Page;

    const flows = buildFlowSequence(USERNAME, PASSWORD);

    console.log(
      `[${label}] Profile: ${profile.name} | Flows: ${flows.map((f) => f.name).join(" → ")}`,
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
      `[${label}] Session telemetry: ${Math.round(telemetry.elapsedMs / 1000)}s, ${telemetry.uniquePages.length} unique page(s), ${telemetry.interactions} interaction unit(s)`,
    );
    console.log(
      `  [${label}] traffic: ${(telemetry.trafficBytesTotal / (1024 * 1024)).toFixed(2)} MB total, ${(telemetry.trafficBytesSameOrigin / (1024 * 1024)).toFixed(2)} MB same-origin, ${telemetry.trafficRequestCount} request(s)`,
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
      profileId,
      telemetry,
      policy: SESSION_POLICY,
    }).catch((err) => {
      console.warn(
        `  [${label}] warning: failed to persist telemetry: ${(err as Error).message}`,
      );
    });
  } finally {
    await context.close();
  }
}

// -------------------------------------------------------------------
// ENTRY POINT
// -------------------------------------------------------------------
(async () => {
  const maxConcurrent = parseInt(process.env.CONCURRENCY ?? "3", 10);
  const totalRounds = parseInt(process.env.TOTAL_ROUNDS ?? "1000", 10);

  console.log(`Starting Patchright bot for ${SITE.baseUrl}/ (${SITE.id})\n`);
  console.log(`[telemetry] JSONL: ${TELEMETRY.jsonPath}`);
  console.log(`[telemetry] CSV:   ${TELEMETRY.csvPath}\n`);

  const allProfileIds = listProfileIds();
  console.log(`Available patchright profiles: ${allProfileIds.join(", ")}\n`);

  let round = 0;

  while (round < totalRounds) {
    const profileIds = pickRandom(allProfileIds, maxConcurrent);
    console.log(`--- Round ${round + 1}/${totalRounds} | Profiles: ${profileIds.join(", ")} ---`);

    const sessions = profileIds.map((profileId, index) => {
      const label = `P${index + 1}`;
      return new Promise<void>((resolve) => setTimeout(resolve, index * 3_000))
        .then(() => runProfileSession(profileId, label))
        .catch((err) => ({ label, error: err as Error }));
    });

    const results = await Promise.all(sessions);
    const failures = results.filter(
      (result): result is { label: string; error: Error } =>
        typeof result === "object" && result !== null && "error" in result,
    );

    for (const failure of failures) {
      console.error(`[${failure.label}] Session failed: ${failure.error.message}`);
    }

    round++;
  }

  console.log("\nAll rounds complete.");
})();
