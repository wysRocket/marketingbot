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

// Force unbuffered output when Node exposes a blocking-capable stream handle.
type BlockingHandle = { setBlocking?: (enabled: boolean) => void };
const stdoutHandle = (
  process.stdout as NodeJS.WriteStream & {
    _handle?: BlockingHandle;
  }
)._handle;
const stderrHandle = (
  process.stderr as NodeJS.WriteStream & {
    _handle?: BlockingHandle;
  }
)._handle;

if (typeof stdoutHandle?.setBlocking === "function") {
  stdoutHandle.setBlocking(true);
}
if (typeof stderrHandle?.setBlocking === "function") {
  stderrHandle.setBlocking(true);
}

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
const MIN_CONCURRENT = parseInt(process.env.MIN_CONCURRENCY ?? "4", 10);
const CONCURRENCY_BACKOFF_STEP = parseInt(
  process.env.CONCURRENCY_BACKOFF_STEP ?? "2",
  10,
);
const CONCURRENCY_RECOVERY_STEP = parseInt(
  process.env.CONCURRENCY_RECOVERY_STEP ?? "1",
  10,
);
const CONCURRENCY_RECOVERY_ROUNDS = parseInt(
  process.env.CONCURRENCY_RECOVERY_ROUNDS ?? "3",
  10,
);
const POOL_SIZE = parseInt(process.env.POOL_SIZE ?? "60", 10);
const TOTAL_ROUNDS = parseInt(process.env.TOTAL_ROUNDS ?? "1000", 10);
const ROUND_ERROR_BACKOFF_MS = parseInt(
  process.env.ROUND_ERROR_BACKOFF_MS ?? "5000",
  10,
);
const ROUND_TIMEOUT_MS = parseInt(process.env.ROUND_TIMEOUT_MS ?? "600000", 10);
const SESSION_TIMEOUT_MS = parseInt(
  process.env.SESSION_TIMEOUT_MS ?? "300000",
  10,
);
const SESSION_LAUNCH_STAGGER_MS = parseInt(
  process.env.SESSION_LAUNCH_STAGGER_MS ?? "3000",
  10,
);
const ALIVE_LOG_INTERVAL_MS = parseInt(
  process.env.ALIVE_LOG_INTERVAL_MS ?? "30000",
  10,
);
const SHARED_BROWSER_MODE = process.env.SHARED_BROWSER_MODE === "1";
const RAILWAY_REPLICA_ID = process.env.RAILWAY_REPLICA_ID ?? "local";
const REPLICA_SHARD_COUNT = parseInt(
  process.env.REPLICA_SHARD_COUNT ?? "1",
  10,
);
const REPLICA_SHARD_INDEX_RAW = process.env.REPLICA_SHARD_INDEX;

let sharedBrowser: import("patchright").Browser | undefined;
let sharedBrowserLaunchPromise:
  | Promise<import("patchright").Browser>
  | undefined;

function isBrowserConnected(browser: import("patchright").Browser): boolean {
  return browser.isConnected();
}

function isClosedTargetError(err: unknown): boolean {
  const message = (err as Error)?.message ?? String(err);
  return /Target page, context or browser has been closed/i.test(message);
}

function stableStringHash(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function getReplicaShardConfig(): { shardCount: number; shardIndex: number } {
  const shardCount = Math.max(1, REPLICA_SHARD_COUNT);
  const explicitShardIndex = Number.parseInt(REPLICA_SHARD_INDEX_RAW ?? "", 10);
  const shardIndex = Number.isFinite(explicitShardIndex)
    ? Math.max(0, explicitShardIndex) % shardCount
    : stableStringHash(RAILWAY_REPLICA_ID) % shardCount;
  return { shardCount, shardIndex };
}

function shardPool<T>(items: T[], shardCount: number, shardIndex: number): T[] {
  if (shardCount <= 1) return items;
  return items.filter((_, index) => index % shardCount === shardIndex);
}

// ---------------------------------------------------------------------------
// Extension loader
//
// Looks for unpacked extensions under <project-root>/.extensions/.
// Each sub-directory is treated as one extension and loaded via
// --load-extension.  If no extensions are present the flag is omitted and
// --disable-extensions is kept so Chrome starts slightly faster.
//
// Extensions require Chrome's newer headless mode (--headless=new).  We
// achieve this by passing headless: false to Playwright (so it does NOT add
// the legacy --headless flag) and then injecting --headless=new ourselves.
// ---------------------------------------------------------------------------
const EXTENSIONS_DIR = path.join(process.cwd(), ".extensions");

function getExtensionPaths(): string[] {
  try {
    return fs
      .readdirSync(EXTENSIONS_DIR)
      .map((name) => path.join(EXTENSIONS_DIR, name))
      .filter((p) => fs.statSync(p).isDirectory());
  } catch {
    return [];
  }
}

function buildChromiumArgs(): string[] {
  const extensionPaths = getExtensionPaths();
  const extensionArgs =
    extensionPaths.length > 0
      ? [
          `--load-extension=${extensionPaths.join(",")}`,
          `--disable-extensions-except=${extensionPaths.join(",")}`,
        ]
      : ["--disable-extensions"];

  return [
    "--disable-blink-features=AutomationControlled",
    "--disable-dev-shm-usage",
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-accelerated-2d-canvas",
    "--disable-gpu",
    // Use Chrome's new headless mode so extensions are supported.
    // We pass headless: false to Playwright to prevent it from injecting
    // the legacy --headless flag, then add --headless=new here instead.
    "--headless=new",
    "--disable-background-networking",
    "--disable-component-update",
    "--disable-default-apps",
    "--disable-sync",
    "--metrics-recording-only",
    "--mute-audio",
    "--no-first-run",
    "--no-default-browser-check",
    "--blink-settings=imagesEnabled=false,loadsImagesAutomatically=false",
    "--use-mock-keychain",
    ...extensionArgs,
  ];
}

async function getSharedBrowser(): Promise<import("patchright").Browser> {
  if (sharedBrowser && isBrowserConnected(sharedBrowser)) {
    return sharedBrowser;
  }

  if (sharedBrowser && !isBrowserConnected(sharedBrowser)) {
    sharedBrowser = undefined;
  }

  if (!sharedBrowserLaunchPromise) {
    sharedBrowserLaunchPromise = chromium
      .launch({
        headless: false, // --headless=new is passed via buildChromiumArgs() for extension support
        args: buildChromiumArgs(),
      })
      .then((browser) => {
        browser.once("disconnected", () => {
          if (sharedBrowser === browser) {
            sharedBrowser = undefined;
          }
          console.warn(
            "[browser] Shared browser disconnected; next session will relaunch it.",
          );
        });
        sharedBrowser = browser;
        return browser;
      })
      .finally(() => {
        sharedBrowserLaunchPromise = undefined;
      });
  }

  return sharedBrowserLaunchPromise;
}

async function createSharedContext(
  profile: PatchrightProfile,
  label: string,
  proxy: ProxyCfg | undefined,
): Promise<import("patchright").BrowserContext> {
  const contextOptions = {
    ...profile.config,
    ...(proxy ? { proxy } : {}),
  };

  try {
    const browser = await getSharedBrowser();
    return await browser.newContext(contextOptions);
  } catch (err) {
    if (!isClosedTargetError(err)) {
      throw err;
    }

    console.warn(
      `[${label}] shared browser was closed during context creation, retrying once`,
    );
    await closeSharedBrowser();
    const browser = await getSharedBrowser();
    return await browser.newContext(contextOptions);
  }
}

async function closeSharedBrowser(): Promise<void> {
  if (sharedBrowserLaunchPromise) {
    await sharedBrowserLaunchPromise.catch(() => undefined);
  }

  if (!sharedBrowser) return;

  const browser = sharedBrowser;
  sharedBrowser = undefined;
  await browser.close().catch(() => undefined);
}

function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(0)}MB`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return promise;

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new Error(`${label} timed out after ${(timeoutMs / 1000).toFixed(0)}s`),
      );
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

async function runSessionWithTimeout(
  sessionPromise: Promise<void>,
  getContext: () => import("patchright").BrowserContext | undefined,
  timeoutMs: number,
  label: string,
): Promise<void> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return sessionPromise;

  let timeoutTriggered = false;

  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      timeoutTriggered = true;

      void (async () => {
        const err = new Error(
          `${label} session timed out after ${(timeoutMs / 1000).toFixed(0)}s`,
        );

        const capturedContext = getContext();
        if (capturedContext) {
          await withTimeout(
            capturedContext.close().catch(() => undefined),
            10_000,
            `${label} context-close`,
          ).catch(() => undefined);
        }

        // Wait briefly for the original session promise to settle so a timed-out
        // session can't keep running into the next round.
        await withTimeout(
          sessionPromise.catch(() => undefined),
          15_000,
          `${label} post-timeout-drain`,
        ).catch(() => undefined);

        reject(err);
      })();
    }, timeoutMs);

    sessionPromise
      .then(() => {
        if (timeoutTriggered) return;
        clearTimeout(timer);
        resolve();
      })
      .catch((err) => {
        if (timeoutTriggered) return;
        clearTimeout(timer);
        reject(err);
      });
  });
}

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
// proxyAuthRequired challenge (HTTP CONNECT tunnel).
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
// into the host credential store, which would otherwise survive a wipe of
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
// --use-mock-keychain also prevents host credential-store persistence.
// -------------------------------------------------------------------
async function runProfileSession(
  profile: PatchrightProfile,
  label: string,
  proxy: ProxyCfg | undefined,
  onContext?: (ctx: import("patchright").BrowserContext) => void,
): Promise<void> {
  let context: import("patchright").BrowserContext;

  if (SHARED_BROWSER_MODE) {
    context = await createSharedContext(profile, label, proxy);
  } else {
    // Persistent dir per pool profile — cache survives across rounds.
    const userDataDir = path.join(CACHE_DIR, profile.id);
    fs.mkdirSync(userDataDir, { recursive: true });

    // Wipe only proxy/identity state; HTTP disk cache is preserved.
    resetSessionState(userDataDir);

    context = await chromium.launchPersistentContext(userDataDir, {
      headless: true,
      args: buildChromiumArgs(),
      ...profile.config,
      ...(proxy ? { proxy } : {}),
    });
  }

  // No context.route() calls — Fetch.enable must stay inactive for cache to work.

  // Notify caller of the context handle so it can force-close on timeout.
  onContext?.(context);

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
      `[${label}] ${profile.name} | ${profile.config.locale ?? "en-US"} ${profile.config.timezoneId ?? ""} | proxy: ${proxy ? proxy.server.replace(/^https?:\/\//, "") : "none"} | exit-ip: ${exitIp} | flows: ${flows.map((f) => f.name).join(" → ")}`,
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
    // In non-shared mode, userDataDir is kept and HTTP cache accumulates.
    // resetSessionState() will wipe only proxy/identity state next launch.
  }
}

// -------------------------------------------------------------------
// ENTRY POINT
// -------------------------------------------------------------------
async function main(): Promise<void> {
  const minConcurrent = Math.max(1, Math.min(MIN_CONCURRENT, MAX_CONCURRENT));
  const backoffStep = Math.max(1, CONCURRENCY_BACKOFF_STEP);
  const recoveryStep = Math.max(1, CONCURRENCY_RECOVERY_STEP);
  const recoveryRounds = Math.max(1, CONCURRENCY_RECOVERY_ROUNDS);
  const { shardCount, shardIndex } = getReplicaShardConfig();

  console.log(`Starting Patchright bot for ${SITE.baseUrl}/ (${SITE.id})`);
  console.log(`[telemetry] JSONL: ${TELEMETRY.jsonPath}`);
  console.log(`[telemetry] CSV:   ${TELEMETRY.csvPath}`);
  console.log(
    `[replica] id=${RAILWAY_REPLICA_ID} shard=${shardIndex + 1}/${shardCount}`,
  );
  if (
    shardCount > 1 &&
    !Number.isFinite(Number.parseInt(REPLICA_SHARD_INDEX_RAW ?? "", 10))
  ) {
    console.warn(
      "[replica] REPLICA_SHARD_COUNT > 1 without REPLICA_SHARD_INDEX; shard assignment is best-effort only and may collide across same-service replicas.",
    );
  }
  console.log(
    `[config] pool: ${POOL_SIZE} | concurrency: ${MAX_CONCURRENT} (min=${minConcurrent}) | rounds: ${TOTAL_ROUNDS} | mode: ${SHARED_BROWSER_MODE ? "shared-browser" : "persistent-context"} | round-timeout-ms: ${ROUND_TIMEOUT_MS} | session-timeout-ms: ${SESSION_TIMEOUT_MS} | launch-stagger-ms: ${SESSION_LAUNCH_STAGGER_MS} | alive-log-ms: ${ALIVE_LOG_INTERVAL_MS} | backoff-step: ${backoffStep} | recovery-step: ${recoveryStep}/${recoveryRounds} round(s)\n`,
  );

  let round = 0;
  let dynamicConcurrent = MAX_CONCURRENT;
  let healthyRounds = 0;
  const startedAt = Date.now();
  const aliveTimer = setInterval(
    () => {
      const uptimeSec = Math.round((Date.now() - startedAt) / 1000);
      const mem = process.memoryUsage();
      console.log(
        `[alive] uptime=${uptimeSec}s current-round=${round + 1}/${TOTAL_ROUNDS} rss=${formatMb(mem.rss)} heap=${formatMb(mem.heapUsed)}`,
      );
    },
    Math.max(5_000, ALIVE_LOG_INTERVAL_MS),
  );

  aliveTimer.unref();

  try {
    while (round < TOTAL_ROUNDS) {
      try {
        // Fresh fingerprints every round — each profile gets a new UA/viewport/
        // locale/timezone on every open. userDataDir is still keyed by profile ID
        // (fp-00…fp-59) so the HTTP disk cache accumulates across rounds.
        const fullPool = generateFingerprints(POOL_SIZE);
        const shardPoolProfiles = shardPool(fullPool, shardCount, shardIndex);

        if (shardPoolProfiles.length === 0) {
          throw new Error(
            `[replica] shard ${shardIndex + 1}/${shardCount} has no profiles; increase POOL_SIZE or reduce REPLICA_SHARD_COUNT`,
          );
        }

        const selected = pickRandom(shardPoolProfiles, dynamicConcurrent);

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
          `--- Round ${round + 1}/${TOTAL_ROUNDS} | shard ${shardIndex + 1}/${shardCount} | shard-pool: ${shardPoolProfiles.length}/${fullPool.length} | concurrency: ${selected.length} | profiles: ${selected.map((p) => p.id).join(", ")} ---`,
        );

        const sessions = selected.map((profile, index) => {
          const label = `P${index + 1}`;
          const proxy = proxyList[index];
          return new Promise<void>((resolve) =>
            setTimeout(resolve, index * Math.max(0, SESSION_LAUNCH_STAGGER_MS)),
          )
            .then(() => {
              // Capture the Chrome context reference as soon as it's created so
              // we can force-close it if the session timeout fires.  Without
              // this, withTimeout() rejects the outer promise but the underlying
              // Chrome process keeps running → PID leak → EAGAIN after a few rounds.
              let capturedContext:
                | import("patchright").BrowserContext
                | undefined;

              const sessionPromise = runProfileSession(
                profile,
                label,
                proxy,
                (ctx) => {
                  capturedContext = ctx;
                },
              );

              return runSessionWithTimeout(
                sessionPromise,
                () => capturedContext,
                SESSION_TIMEOUT_MS,
                label,
              );
            })
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

        const eagainFailures = failures.filter((failure) =>
          /EAGAIN/i.test(failure.error.message),
        ).length;
        const timeoutFailures = failures.filter((failure) =>
          /timed out/i.test(failure.error.message),
        ).length;

        if (eagainFailures > 0) {
          const next = Math.max(minConcurrent, dynamicConcurrent - backoffStep);
          if (next < dynamicConcurrent) {
            console.warn(
              `[concurrency] EAGAIN detected (${eagainFailures} launch failure(s)). Reducing concurrency ${dynamicConcurrent} -> ${next}`,
            );
          }
          dynamicConcurrent = next;
          healthyRounds = 0;
        } else if (
          timeoutFailures >= Math.max(2, Math.floor(selected.length / 2))
        ) {
          const next = Math.max(minConcurrent, dynamicConcurrent - 1);
          if (next < dynamicConcurrent) {
            console.warn(
              `[concurrency] High timeout pressure (${timeoutFailures}/${selected.length}). Reducing concurrency ${dynamicConcurrent} -> ${next}`,
            );
          }
          dynamicConcurrent = next;
          healthyRounds = 0;
        } else {
          if (failures.length === 0) {
            healthyRounds += 1;
          } else {
            healthyRounds = 0;
          }

          if (
            healthyRounds >= recoveryRounds &&
            dynamicConcurrent < MAX_CONCURRENT
          ) {
            const next = Math.min(
              MAX_CONCURRENT,
              dynamicConcurrent + recoveryStep,
            );
            if (next > dynamicConcurrent) {
              console.log(
                `[concurrency] Stable for ${healthyRounds} round(s). Increasing concurrency ${dynamicConcurrent} -> ${next}`,
              );
              dynamicConcurrent = next;
            }
            healthyRounds = 0;
          }
        }

        round++;
      } catch (err) {
        // Keep the worker alive if any unexpected error escapes the round.
        console.error(
          `[fatal] Round ${round + 1} crashed: ${(err as Error).stack ?? (err as Error).message}`,
        );
        await sleep(Math.max(0, ROUND_ERROR_BACKOFF_MS));
      }
    }
  } finally {
    clearInterval(aliveTimer);
    await closeSharedBrowser();
  }

  console.log("\nAll rounds complete.");
}

void main().catch((err) => {
  console.error(
    `[fatal] Main loop crashed: ${(err as Error).stack ?? (err as Error).message}`,
  );
});

process.on("unhandledRejection", (reason) => {
  const message =
    reason instanceof Error ? (reason.stack ?? reason.message) : String(reason);
  console.error(`[fatal] Unhandled rejection: ${message}`);
});

process.on("uncaughtException", (err) => {
  console.error(`[fatal] Uncaught exception: ${err.stack ?? err.message}`);
});

// Chrome processes are closed by context.close() in runProfileSession.
// These handlers cover the case where Ctrl+C interrupts mid-round.
process.once("SIGINT", () => {
  console.warn("[signal] SIGINT received, shutting down worker");
  void closeSharedBrowser().finally(() => process.exit(0));
});
process.once("SIGTERM", () => {
  console.warn("[signal] SIGTERM received from platform, shutting down worker");
  void closeSharedBrowser().finally(() => process.exit(0));
});
