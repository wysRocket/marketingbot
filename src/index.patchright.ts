import "dotenv/config";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { chromium } from "patchright";
import type { Page } from "playwright";
import type { BrowserContext } from "patchright";
import { dismissSimilarWebConsents } from "./extensions/dismissConsents";
import { resolveExtensionBundle } from "./extensions/runtime";
import { browseHomepage } from "./flows/browseHomepage";
import { browseFooterLinks } from "./flows/browseFooterLinks";
import { login } from "./flows/login";
import { explorePricing } from "./flows/explorePricing";
import { accountDashboard } from "./flows/accountDashboard";
import { loadCatalog, type LoadedCatalog } from "./profiles/catalog";
import {
  validateShardConfig,
  shardCatalogProfiles,
} from "./profiles/shard-assignment";
import {
  resolveCacheDir,
  CACHE_ONLY_RESET_PATHS,
  IDENTITY_STICKY_RESET_PATHS,
} from "./profiles/persistence-policy";
import { resolveProxyForSession, type RunnerProxyConfig } from "./proxy";
import { fetchLiveFreeSocks5Proxies } from "./freeSocks5";
import { attachNetworkDebugger } from "./observability/networkDebug";
import {
  getSessionPolicyFromEnv,
  runComplexSession,
  type NamedFlow,
} from "./session/complexSession";
import { createTelemetryPersistence } from "./session/telemetryPersistence";
import { startRailwayHeartbeatServer } from "./railwayHeartbeat";
import { botController } from "./control/runtimeController";
import { getActiveSiteProfile, isFlowEnabled } from "./sites";
import { warmupCookies } from "./flows/warmupCookies";
import { triggerSimilarwebFetch } from "./flows/triggerSimilarweb";

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
const CACHE_DIR = resolveCacheDir();
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
const EXTENSION_BUNDLE = resolveExtensionBundle({
  extensionsDir: EXTENSIONS_DIR,
  manifestPath: path.join(process.cwd(), "src", "extensions", "manifest.json"),
  railwayEnvironment: Boolean(process.env.RAILWAY_ENVIRONMENT),
  extensionSlugsEnv: process.env.PATCHRIGHT_EXTENSION_SLUGS,
});

function getExtensionPaths(): string[] {
  return EXTENSION_BUNDLE.selectedPaths;
}

function buildChromiumArgs(): string[] {
  return buildChromiumArgsForProfile();
}

let sharedBrowserExtraArgs: string[] = [];

function buildChromiumArgsForProfile(extraArgs: string[] = []): string[] {
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
    ...extraArgs,
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
        args: buildChromiumArgsForProfile(sharedBrowserExtraArgs),
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
  profile: LoadedCatalog["profiles"][number],
  label: string,
  proxy: RunnerProxyConfig | undefined,
): Promise<import("patchright").BrowserContext> {
  const contextOptions = {
    ...profile.patchrightProfile.config,
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
type ProxyCfg = RunnerProxyConfig;

async function fetchProxyList(
  count: number,
): Promise<Array<ProxyCfg | undefined>> {
  const user = process.env.DI_USER;
  const pass = process.env.DI_PASS;

  // ── Proxy-Cheap rotating residential ──────────────────────────────────
  // Sticky sessions: append "-session-<id>" to username so each concurrent
  // profile gets a consistent exit IP for the session's lifetime.
  const pcUser = process.env.PC_USER;
  const pcPass = process.env.PC_PASS;
  const pcHost = process.env.PC_HOST;
  const pcPort = process.env.PC_PORT;
  if (pcUser && pcPass && pcHost && pcPort) {
    console.log(`[proxy] using proxy-cheap rotating residential (${pcHost}:${pcPort})`);
    return Array.from({ length: count }, () => ({
        server: `http://${pcHost}:${pcPort}`,
        username: pcUser,
        password: pcPass,
    }));
  }

  if (!user || !pass) return Array(count).fill(undefined);

  // ── DataImpulse /api/list ──────────────────────────────────────────────
  const url = new URL("https://gw.dataimpulse.com:777/api/list");
  url.searchParams.set("quantity", String(count));
  url.searchParams.set("type", "sticky");
  url.searchParams.set("protocol", "http");

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

  if (process.env.COOKIE_WARMUP !== "0") {
    flows.push({
      name: "warmupCookies",
      run: async (page, label, ctx) => {
        const result = await warmupCookies(page, label);
        for (const url of result.visited) ctx.trackNavigation(url);
        ctx.addInteraction(result.visited.length);
      },
    });
  }

  // After warmup, trigger Similarweb extension for the target domain.
  // The extension only fires data.similarweb.com when the panel is opened,
  // so we programmatically trigger it via CDP service worker injection.
  if (process.env.COOKIE_WARMUP !== "0" && process.env.SIMILARWEB_TRIGGER !== "0") {
    flows.push({
      name: "triggerSimilarweb",
      run: async (page, label, ctx) => {
        try {
          const targetDomain = SITE.baseUrl
            .replace(/^https?:\/\//, "")
            .replace(/\/.*$/, "")
            .replace(/^www\./, "");
          const result = await triggerSimilarwebFetch(page, targetDomain);
          console.log(
            `  [${label}] similarweb trigger: ${result.method} for ${targetDomain} (triggered: ${result.triggered})`,
          );
          if (result.triggered) ctx.addInteraction(1);
        } catch (e) {
          console.log(`  [${label}] similarweb trigger failed:`, e);
        }
      },
    });
  }

  if (isFlowEnabled(SITE, "browseHomepage")) {
    flows.push({
      name: "browseHomepage",
      run: async (page, label, ctx) => {
        const result = await browseHomepage(page, SITE, ctx.policy);
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
        const result = await explorePricing(page, SITE, ctx.policy);
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
        const result = await browseFooterLinks(page, SITE, ctx.policy);
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

// -------------------------------------------------------------------
// SESSION RUNNER
//
// Each call reuses a persistent userDataDir keyed to the pool profile
// so the HTTP disk cache accumulates across rounds. Before launch, only
// proxy/identity state is wiped (per sessionStatePolicy) so Chrome has
// no stale credentials to replay.
// --use-mock-keychain also prevents host credential-store persistence.
// -------------------------------------------------------------------
async function runProfileSession(
  profile: LoadedCatalog["profiles"][number],
  label: string,
  proxy: RunnerProxyConfig | undefined,
  onContext?: (ctx: import("patchright").BrowserContext) => void,
): Promise<void> {
  let browserContext: import("patchright").BrowserContext;
  let context: import("patchright").BrowserContext | import("patchright").Page;

  if (SHARED_BROWSER_MODE) {
    browserContext = await createSharedContext(profile, label, proxy);
    context = browserContext;
  } else if (process.env[`CBM_PROFILE_${profile.id}`] || (process.env.CBM_CDP_URL && process.env.CBM_PROFILES?.split(",").includes(profile.id))) {
    // ── CDP-remote mode: connect to CloakBrowser-Manager ─────────────────
    // Per-profile: CBM_PROFILE_<ID>=<url>
    // Global:     CBM_CDP_URL=<url> + CBM_PROFILES=fp-00,fp-02 (comma-separated list)
    const cbmUrl = process.env[`CBM_PROFILE_${profile.id}`] || process.env.CBM_CDP_URL;
    console.log(`[${label}] CDP-remote mode: connecting to ${cbmUrl} (profile=${profile.id} CBM_PROFILES=${process.env.CBM_PROFILES})`);
    if (!cbmUrl) throw new Error(`No CBM URL for profile ${profile.id}`);
    const browser = await chromium.connectOverCDP(cbmUrl);
    browserContext = browser.contexts()[0];
    const pages = browserContext.pages();
    context = pages.length > 0 ? pages[0] : await browserContext.newPage();
    console.log(`[${label}] CDP-remote connected. Pages: ${pages.length}`);
  } else {
    // Persistent dir per pool profile — cache survives across rounds.
    const userDataDir = path.join(CACHE_DIR, profile.id);
    fs.mkdirSync(userDataDir, { recursive: true });

    // Wipe only proxy/identity state per policy; HTTP disk cache is preserved.
    const resetPaths =
      profile.sessionStatePolicy === "identity-sticky"
        ? IDENTITY_STICKY_RESET_PATHS
        : CACHE_ONLY_RESET_PATHS;
    for (const rel of resetPaths) {
      const full = path.join(userDataDir, rel);
      if (fs.existsSync(full)) {
        fs.rmSync(full, { recursive: true, force: true });
      }
    }

    browserContext = await chromium.launchPersistentContext(userDataDir, {
      headless: false, // --headless=new passed via args for extension support
      args: buildChromiumArgsForProfile(profile.launchArgs ?? []),
      ...profile.patchrightProfile.config,
      ...(proxy ? { proxy } : {}),
    });
    context = browserContext;
  }

  // No context.route() calls — Fetch.enable must stay inactive for cache to work.

  if (profile.initScript) {
    await browserContext.addInitScript(profile.initScript);
  }

  // Dismiss SimilarWeb consent tabs / pre-seed storage so the extension never
  // blocks session startup with welcome or options dialogs.
  await dismissSimilarWebConsents(browserContext as unknown as BrowserContext);

  if (process.env.NETWORK_DEBUG === "1") {
    await attachNetworkDebugger(browserContext as unknown as BrowserContext).catch(
      () => {},
    );
  }

  // ── Extension telemetry capture ──────────────────────────────────────────
  console.log("[ext-telemetry] BLOCK ENTERED, EXT_CAPTURE=" + process.env.EXT_CAPTURE);
  // Capture extension HTTP events during the main bot session so the
  // Extensions tab in the dashboard shows live data.
  // Capture extension HTTP events during the main bot session so the
  // Extensions tab in the dashboard shows live data.
  let extInterceptor: { detach: () => Promise<void> } | undefined;
  if (process.env.EXT_CAPTURE !== "0") {
    try {
      const { createExtensionTelemetryInterceptor } = await import(
        "./observability/extensionTelemetry"
      );
      const { appendExtEvent } = await import("./observability/extEventWriter");
      const interceptor = createExtensionTelemetryInterceptor(
        (event: any) => {
          appendExtEvent(event);
        },
        {
          domains: [
            "similarweb.com",
            "sw-extension.s3.amazonaws.com",
            "data.similarweb.com",
            "rank.similarweb.com",
            "cdn.growthbook.io",
            "api.mixpanel.com",
            "mixpanel.com",
          ],
          captureRequestBody: true,
          captureResponseBody: true,
          maxBodySize: 50 * 1024,
        },
      );
      extInterceptor = interceptor;
    } catch (err) {
      console.warn(`[ext-telemetry] init failed: ${(err as Error).message}`);
    }
  }

  // Notify caller of the context handle so it can force-close on timeout.
  onContext?.(browserContext);

  const page = (await browserContext.newPage()) as unknown as Page;

  // Attach extension telemetry interceptor to the page
  if (extInterceptor) {
    try {
      await (extInterceptor as any).attach(page);
    } catch (err) {
      console.warn(`[ext-telemetry] attach failed: ${(err as Error).message}`);
    }
  }

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
      `[${label}] ${profile.name} | ${profile.patchrightProfile.config.locale ?? "en-US"} ${profile.patchrightProfile.config.timezoneId ?? ""} | proxy: ${proxy ? proxy.server.replace(/^https?:\/\//, "") : "none"} | exit-ip: ${exitIp} | flows: ${flows.map((f) => f.name).join(" → ")}`,
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
      mostloginProfileId:
        profile.source === "mostlogin" ? profile.id : undefined,
      profileSource: profile.source,
      extensionBundleHash: EXTENSION_BUNDLE.bundleHash,
      extensionSlugs: EXTENSION_BUNDLE.selectedSlugs,
      sessionStatePolicy: profile.sessionStatePolicy,
      telemetry,
      policy: SESSION_POLICY,
    }).catch((err) => {
      console.warn(
        `  [${label}] warning: failed to persist telemetry: ${(err as Error).message}`,
      );
    });
  } finally {
    await page.close();
    if (process.env.CBM_CDP_URL) {
      // CDP-remote: don't close the browser — CBM manages it. Just disconnect.
      const browser = (browserContext as any).browser?.();
      if (browser) await browser.close();
    } else {
      await browserContext.close();
    }
    // In non-shared mode, userDataDir is kept and HTTP cache accumulates.
    // resetSessionState() will wipe only proxy/identity state next launch.
  }
}

// -------------------------------------------------------------------
// ENTRY POINT
// -------------------------------------------------------------------
async function main(): Promise<void> {
  botController.totalRounds = TOTAL_ROUNDS;
  botController.siteProfile = SITE.id;

  if (process.env.BOT_ENABLED === "1") {
    botController.start("env");
    console.log("[startup] BOT_ENABLED=1 — visit loop auto-started at boot.");
  } else {
    console.log(
      "[startup] Observation mode — visit loop paused. Start it with POST /control/start (CONTROL_TOKEN header) or set BOT_ENABLED=1.",
    );
  }

  const minConcurrent = Math.max(1, Math.min(MIN_CONCURRENT, MAX_CONCURRENT));
  const backoffStep = Math.max(1, CONCURRENCY_BACKOFF_STEP);
  const recoveryStep = Math.max(1, CONCURRENCY_RECOVERY_STEP);
  const recoveryRounds = Math.max(1, CONCURRENCY_RECOVERY_ROUNDS);

  console.log(`Starting Patchright bot for ${SITE.baseUrl}/ (${SITE.id})`);
  console.log(`[telemetry] JSONL: ${TELEMETRY.jsonPath}`);
  console.log(`[telemetry] CSV:   ${TELEMETRY.csvPath}`);
  console.log(
    `[extensions] selected=${EXTENSION_BUNDLE.selectedSlugs.join(", ") || "(none)"} hash=${EXTENSION_BUNDLE.bundleHash}`,
  );

  // Load catalog once before the main loop (snapshot is refreshed periodically via the source)
  const catalog = await loadCatalog({
    requestedSource:
      (process.env.PROFILE_SOURCE as "mostlogin" | "snapshot" | "generator") ??
      "generator",
    poolSize: POOL_SIZE,
    snapshotPath: path.join(
      process.cwd(),
      ".profile-cache",
      "mostlogin-catalog.json",
    ),
    allowGeneratorFallback: process.env.ALLOW_GENERATOR_FALLBACK === "1",
    environment:
      process.env.NODE_ENV === "production" ? "production" : "development",
  });

  const { shardCount, shardIndex } = validateShardConfig({
    shardCount: REPLICA_SHARD_COUNT,
    shardIndexRaw: REPLICA_SHARD_INDEX_RAW,
    replicaId: RAILWAY_REPLICA_ID,
  });

  const shardPoolProfiles = shardCatalogProfiles(
    catalog.profiles,
    shardCount,
    shardIndex,
  );
  sharedBrowserExtraArgs = Array.from(
    new Set(
      shardPoolProfiles.flatMap((profile) => profile.launchArgs ?? []),
    ),
  );

  console.log(
    `[replica] id=${RAILWAY_REPLICA_ID} shard=${shardIndex + 1}/${shardCount}`,
  );
  console.log(
    `[startup] site-profile=${SITE.id} profile-source=${catalog.source} shard-profiles=${shardPoolProfiles.map((profile) => profile.id).join(", ") || "(none)"}`,
  );
  console.log(`[startup] CBM_CDP_URL=${process.env.CBM_CDP_URL ? "SET(" + process.env.CBM_CDP_URL.substring(0, 60) + ")" : "NOT SET"}`);
  console.log(`[startup] SHARED_BROWSER_MODE=${process.env.SHARED_BROWSER_MODE}`);
  console.log(
    `[config] pool: ${POOL_SIZE} | concurrency: ${MAX_CONCURRENT} (min=${minConcurrent}) | rounds: ${TOTAL_ROUNDS} | mode: ${SHARED_BROWSER_MODE ? "shared-browser" : (process.env.CBM_CDP_URL ? "cdp-remote" : "persistent-context")} | round-timeout-ms: ${ROUND_TIMEOUT_MS} | session-timeout-ms: ${SESSION_TIMEOUT_MS} | launch-stagger-ms: ${SESSION_LAUNCH_STAGGER_MS} | alive-log-ms: ${ALIVE_LOG_INTERVAL_MS} | backoff-step: ${backoffStep} | recovery-step: ${recoveryStep}/${recoveryRounds} round(s)\n`,
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
        `[alive] uptime=${uptimeSec}s running=${botController.running} current-round=${round + 1}/${TOTAL_ROUNDS} rss=${formatMb(mem.rss)} heap=${formatMb(mem.heapUsed)}`,
      );
    },
    Math.max(5_000, ALIVE_LOG_INTERVAL_MS),
  );

  aliveTimer.unref();

  try {
    // Observation mode parks here until the controller is started.
    await botController.waitUntilRunning();

    while (round < TOTAL_ROUNDS) {
      try {
        // If paused at runtime (e.g. Hermes called /control/stop), park here
        // until started again rather than spinning empty rounds.
        if (!botController.running) {
          console.log(
            `[control] Visit loop paused after round ${round}. Waiting for /control/start...`,
          );
          await botController.waitUntilRunning();
          console.log("[control] Visit loop resumed.");
        }
        botController.round = round;

        if (shardPoolProfiles.length === 0) {
          throw new Error(
            `[replica] shard ${shardIndex + 1}/${shardCount} has no profiles; increase POOL_SIZE or reduce REPLICA_SHARD_COUNT`,
          );
        }

        const selected = pickRandom(
          shardPoolProfiles,
          Math.min(dynamicConcurrent, shardPoolProfiles.length),
        );

        // Fetch one distinct sticky proxy per session from DataImpulse's pool.
        // Each entry is a real unique IP — unlike the _session- username trick
        // which DataImpulse ignores and routes everything through one exit node.
        let proxyList: Array<ProxyCfg | undefined>;
        const hasDiCreds = Boolean(process.env.DI_USER && process.env.DI_PASS);
        if (hasDiCreds) {
          try {
            proxyList = await fetchProxyList(selected.length);
            console.log(
              `[proxy] fetched ${proxyList.filter(Boolean).length}/${selected.length} proxies (DataImpulse)`,
            );
          } catch (err) {
            console.warn(
              `[proxy] /api/list failed: ${(err as Error).message} — falling back to free SOCKS5`,
            );
            proxyList = Array(selected.length).fill(undefined);
          }
        } else {
          console.log(`[proxy] no DI creds — fetching free SOCKS5 proxies`);
          try {
            const free = await fetchLiveFreeSocks5Proxies({
              limit: selected.length,
              timeoutMs: 3000,
              concurrency: 30,
            });
            proxyList = selected.map((_, i) => free[i] ?? undefined);
            console.log(
              `[proxy] ${free.length}/${selected.length} free SOCKS5 proxies live`,
            );
          } catch (err) {
            console.warn(
              `[proxy] free SOCKS5 fetch failed: ${(err as Error).message} — running without proxy`,
            );
            proxyList = Array(selected.length).fill(undefined);
          }
        }

        console.log(
          `--- Round ${round + 1}/${TOTAL_ROUNDS} | shard ${shardIndex + 1}/${shardCount} | shard-pool: ${shardPoolProfiles.length} | concurrency: ${selected.length} | profiles: ${selected.map((p) => p.id).join(", ")} | extensions: ${EXTENSION_BUNDLE.selectedSlugs.join(", ") || "(none)"} | bundle: ${EXTENSION_BUNDLE.bundleHash} ---`,
        );

        const sessions = selected.map((profile, index) => {
          const label = `P${index + 1}`;
          const rawProxy = proxyList[index];
          const proxy = resolveProxyForSession({
            runner: process.env.RAILWAY_ENVIRONMENT ? "railway" : "local",
            mostloginProxy: profile.mostloginProxy as Parameters<
              typeof resolveProxyForSession
            >[0]["mostloginProxy"],
            fallbackProxy: rawProxy,
          });
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

// Telemetry API server is started via railwayHeartbeat.ts

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
// build cache bust 1782249705
