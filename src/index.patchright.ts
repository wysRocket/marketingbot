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
import { generateFingerprints } from "./profiles/fingerprint-generator";
import {
  getSessionPolicyFromEnv,
  runComplexSession,
  type NamedFlow,
} from "./session/complexSession";
import { createTelemetryPersistence } from "./session/telemetryPersistence";
import { startRailwayHeartbeatServer } from "./railwayHeartbeat";
import { getActiveSiteProfile, isFlowEnabled } from "./sites";

// Persistent cache dir — one sub-dir per pool profile, shared across rounds.
// Only proxy/identity state is wiped before each launch; HTTP disk cache stays.
const CACHE_DIR = path.join(os.homedir(), ".cache", "marketingbot-patchright");
fs.mkdirSync(CACHE_DIR, { recursive: true });

// -------------------------------------------------------------------
// CREDENTIALS
// -------------------------------------------------------------------
const USERNAME = process.env.BOT_USERNAME ?? "";
const PASSWORD = process.env.BOT_PASSWORD ?? "";
const SESSION_POLICY = getSessionPolicyFromEnv();
const TELEMETRY = createTelemetryPersistence("patchright");
const SITE = getActiveSiteProfile();

// Keep Railway service health checks green even for non-HTTP bot workers.
startRailwayHeartbeatServer();

const MAX_CONCURRENT = parseInt(process.env.CONCURRENCY ?? "20", 10);
const POOL_SIZE = parseInt(process.env.POOL_SIZE ?? "60", 10);
const TOTAL_ROUNDS = parseInt(process.env.TOTAL_ROUNDS ?? "1000", 10);

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
// The `_session-` username trick (e.g. user_session-abc123) does NOT
// produce unique exit IPs on DataImpulse — the service ignores it and
// routes ALL connections from a single source machine through the same
// exit node (confirmed: 20 different session IDs → same IP 91.120.x.x).
//
// Instead we call DataImpulse's own /api/list endpoint before each round
// to get pre-assigned sticky-proxy credentials.  Each entry in the list
// is a distinct IP from their pool.  The credentials are passed directly
// to launchPersistentContext so Playwright injects them on every
// proxyAuthRequired challenge (HTTP CONNECT tunnel — MUST be http://).
// -------------------------------------------------------------------
type ProxyCfg = { server: string; username: string; password: string };

async function fetchProxyList(
  count: number,
): Promise<Array<ProxyCfg | undefined>> {
  const user = process.env.DI_USER;
  const pass = process.env.DI_PASS;
  if (!user || !pass) return Array(count).fill(undefined);

  const url = new URL("https://gw.dataimpulse.com:777/api/list");
  url.searchParams.set("quantity", String(count));
  url.searchParams.set("type", "sticky");
  url.searchParams.set("protocol", "http");
  // No format param — use DataImpulse default so we can inspect raw output.

  const auth = Buffer.from(`${user}:${pass}`).toString("base64");
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok)
    throw new Error(
      `DataImpulse /api/list error: ${res.status} ${await res.text()}`,
    );

  const text = (await res.text()).trim();
  const lines = text.split(/\r?\n/).filter(Boolean);

  return lines.slice(0, count).map((line) => {
    // Default format: login:password@host:port
    // Each line is a different port on the same gateway → different exit IP.
    const atIdx = line.lastIndexOf("@");
    const portIdx = line.lastIndexOf(":");
    if (atIdx === -1 || portIdx <= atIdx) {
      console.warn(`[proxy] unexpected format: ${line}`);
      return undefined;
    }
    const host = line.slice(atIdx + 1, portIdx);
    const port = line.slice(portIdx + 1);
    const creds = line.slice(0, atIdx);
    const colonIdx = creds.indexOf(":");
    const login = creds.slice(0, colonIdx);
    const password = creds.slice(colonIdx + 1);
    return {
      server: `http://${host}:${port}`,
      username: login,
      password,
    };
  });
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
// SELECTIVE STATE RESET
//
// Before each launch we delete only the Chrome sub-dirs that hold proxy
// credentials and visitor identity (Network state, cookies, login data,
// localStorage). We deliberately KEEP Default/Cache/ and
// Default/Code Cache/ so HTTP disk cache warms up across rounds —
// matching the low-traffic behaviour MostLogin achieves via its single
// shared cache partition.
//
// --use-mock-keychain prevents Chrome from persisting proxy credentials
// into the macOS Keychain, which would otherwise survive a wipe of
// the userDataDir's credential files.
// -------------------------------------------------------------------
const SESSION_STATE_DIRS = [
  "Default/Network",
  "Default/Login Data",
  "Default/Login Data For Account",
  "Default/Cookies",
  "Default/Local Storage",
  "Default/Session Storage",
  "Default/IndexedDB",
  "Default/Extension Cookies",
  // Preferences stores last-used proxy config on some Chrome builds.
  // Delete it so Chrome cannot replay a previous round's proxy identity.
  "Default/Preferences",
  "Default/Secure Preferences",
];

function resetSessionState(userDataDir: string): void {
  for (const rel of SESSION_STATE_DIRS) {
    const full = path.join(userDataDir, rel);
    if (fs.existsSync(full)) {
      fs.rmSync(full, { recursive: true, force: true });
    }
  }
}

// -------------------------------------------------------------------
// SESSION RUNNER
//
// Each call reuses a persistent userDataDir keyed to the pool profile
// (fp-00 … fp-59 under CACHE_DIR) so the HTTP disk cache accumulates
// across rounds. Before launch, only proxy/identity state is wiped via
// resetSessionState() so Chrome has no stale credentials to replay.
// --use-mock-keychain also prevents macOS Keychain persistence.
// -------------------------------------------------------------------
async function runProfileSession(
  profile: PatchrightProfile,
  label: string,
  proxy: ProxyCfg | undefined,
): Promise<void> {
  // Persistent dir per pool profile — cache survives across rounds.
  const userDataDir = path.join(CACHE_DIR, profile.id);
  fs.mkdirSync(userDataDir, { recursive: true });

  // Wipe only proxy/identity state; HTTP disk cache is preserved.
  resetSessionState(userDataDir);

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--disable-dev-shm-usage",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-accelerated-2d-canvas",
      "--disable-gpu",
      // Block images at the Blink engine level — avoids context.route() which
      // internally calls Fetch.enable and disrupts Chrome's HTTP cache pipeline.
      "--blink-settings=imagesEnabled=false,loadsImagesAutomatically=false",
      // Prevent proxy credentials from being persisted to the macOS Keychain
      // so that resetSessionState() fully clears all credential state.
      "--use-mock-keychain",
    ],
    ...profile.config,
    ...(proxy ? { proxy } : {}),
  });

  // No context.route() calls — Fetch.enable must stay inactive for cache to work.

  const page = (await context.newPage()) as unknown as Page;

  try {
    const flows = buildFlowSequence(USERNAME, PASSWORD);

    // ── Exit-IP diagnostic ─────────────────────────────────────────────────
    // Before the main flows, check which exit IP this session is using so we
    // can verify that 20 concurrent sessions → 20 unique IPs. The request
    // itself goes through the proxy (if configured). Suppress errors so a
    // slow/blocked check never aborts a good run.
    // Set SKIP_IP_CHECK=1 to disable once proxy uniqueness is confirmed.
    let exitIp = "(unknown)";
    if (process.env.SKIP_IP_CHECK !== "1") {
      try {
        await page.goto("https://api.ipify.org?format=json", {
          waitUntil: "domcontentloaded",
          timeout: 10_000,
        });
        const raw = await page.textContent("body");
        exitIp = JSON.parse(raw ?? "{}").ip ?? "(parse error)";
      } catch {
        exitIp = "(check failed)";
      }
    }
    // ────────────────────────────────────────────────────────────────────────

    console.log(
      `[${label}] ${profile.name} | ${profile.config.locale ?? "en-US"} ${profile.config.timezoneId ?? ""} | proxy: ${proxy?.username ?? "none"} | exit-ip: ${exitIp} | flows: ${flows.map((f) => f.name).join(" → ")}`,
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
    await context.close();
    // userDataDir is kept — HTTP cache accumulates across rounds.
    // resetSessionState() will wipe only proxy/identity state next launch.
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
    // Fresh fingerprints every round — each profile gets a new UA/viewport/
    // locale/timezone on every open. userDataDir is still keyed by profile ID
    // (fp-00…fp-59) so the HTTP disk cache accumulates across rounds.
    const pool = generateFingerprints(POOL_SIZE);
    const selected = pickRandom(pool, MAX_CONCURRENT);

    // Fetch one distinct sticky proxy per session from DataImpulse's pool.
    // Each entry is a real unique IP — unlike the _session- username trick
    // which DataImpulse ignores and routes everything through one exit node.
    let proxyList: Array<ProxyCfg | undefined>;
    try {
      proxyList = await fetchProxyList(selected.length);
      console.log(
        `[proxy] fetched ${proxyList.filter(Boolean).length}/${selected.length} proxies`,
      );
    } catch (err) {
      console.warn(
        `[proxy] /api/list failed: ${(err as Error).message} — running without proxy`,
      );
      proxyList = Array(selected.length).fill(undefined);
    }

    console.log(
      `--- Round ${round + 1}/${TOTAL_ROUNDS} | profiles: ${selected.map((p) => p.id).join(", ")} ---`,
    );

    const sessions = selected.map((profile, index) => {
      const label = `P${index + 1}`;
      const proxy = proxyList[index];
      return new Promise<void>((resolve) => setTimeout(resolve, index * 3_000))
        .then(() => runProfileSession(profile, label, proxy))
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
