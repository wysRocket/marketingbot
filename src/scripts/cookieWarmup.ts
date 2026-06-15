/**
 * cookieWarmup.ts — Browser Profile & Extension Warmup
 *
 * Builds a realistic browsing history and cookie store in a persistent Chrome
 * profile before a production run. Extensions (SimilarWeb, etc.) are loaded
 * so they initialize, register with their servers, and accumulate signal on
 * what a real browsing session looks like.
 *
 * Why warm up?
 *  ─ Fresh profiles have zero cookies → anti-bot systems immediately flag them
 *  ─ Fresh profiles have no extension state → extensions may report anomalous
 *    data or fail silently until they've had a few normal browsing sessions
 *  ─ After warmup a profile looks like an active human user, so target sites
 *    return real content and extensions operate with full fidelity
 *
 * Warmup Phases
 *  1. Foundation   (~15 min)  popular general sites → base cookie store
 *  2. Professional (~10 min)  tech / business sites  → professional fingerprint
 *  3. Vertical     (~8  min)  marketing / analytics  → category signals
 *  4. Flush        (~2  min)  idle — lets extensions batch-send accumulated data
 *
 * Run modes
 *  full  (default) — all four phases, ~35 min total
 *  quick           — abbreviated set, ~12 min
 *
 * Usage
 *  npm run warmup:run
 *  WARMUP_MODE=quick WARMUP_PROFILE_DIR=./profiles/prod-01 npm run warmup:run
 */

import "dotenv/config";
import path from "node:path";
import * as fsSync from "node:fs";
import { promises as fs } from "node:fs";
import { chromium, type Page } from "patchright";
import { ensureDisplay, getChromeMode } from "../utils/display";

// ── Config ─────────────────────────────────────────────────────────────────

const WARMUP_MODE = (process.env.WARMUP_MODE ?? "full") as "full" | "quick";
const EXTENSIONS_DIR = process.env.EXTENSIONS_DIR ?? ".extensions";
const PROFILE_DIR = path.resolve(
  process.cwd(),
  process.env.WARMUP_PROFILE_DIR ?? process.env.USER_DATA_DIR ?? "profiles/warmup-default"
);
const SESSION_LOG = path.resolve(process.cwd(), "telemetry", "warmup-sessions.jsonl");
const VERBOSE = process.env.WARMUP_VERBOSE !== "0";

// ── Warmup site list ────────────────────────────────────────────────────────

interface WarmupSite {
  url: string;
  label: string;
  dwellMs: [number, number]; // [min, max] dwell time in ms
  scrollSteps: number;
  followLink?: boolean;      // click one internal link
}

const PHASE_1_FOUNDATION: WarmupSite[] = [
  { url: "https://www.google.com/search?q=technology+news+today",        label: "google/news",         dwellMs: [12000, 20000], scrollSteps: 2 },
  { url: "https://www.google.com/search?q=marketing+analytics+tools",    label: "google/marketing",    dwellMs: [10000, 18000], scrollSteps: 2 },
  { url: "https://www.youtube.com",                                        label: "youtube/home",        dwellMs: [15000, 25000], scrollSteps: 3 },
  { url: "https://en.wikipedia.org/wiki/Special:Random",                  label: "wikipedia/random",    dwellMs: [20000, 35000], scrollSteps: 4, followLink: true },
  { url: "https://www.reddit.com",                                         label: "reddit/front",        dwellMs: [15000, 25000], scrollSteps: 4 },
  { url: "https://www.bbc.com/news",                                       label: "bbc/news",            dwellMs: [20000, 35000], scrollSteps: 3, followLink: true },
  { url: "https://www.theguardian.com",                                    label: "guardian/home",       dwellMs: [15000, 25000], scrollSteps: 3 },
  { url: "https://www.amazon.com/s?k=laptop&ref=nb_sb_noss",             label: "amazon/search",       dwellMs: [12000, 20000], scrollSteps: 3 },
  { url: "https://www.imdb.com/chart/moviemeter",                         label: "imdb/movies",         dwellMs: [10000, 18000], scrollSteps: 2 },
  { url: "https://weather.com/weather/today",                             label: "weather/today",       dwellMs: [8000,  15000], scrollSteps: 1 },
];

const PHASE_2_PROFESSIONAL: WarmupSite[] = [
  { url: "https://www.linkedin.com/feed/",                                label: "linkedin/feed",       dwellMs: [15000, 25000], scrollSteps: 3 },
  { url: "https://github.com/explore",                                    label: "github/explore",      dwellMs: [12000, 20000], scrollSteps: 2, followLink: true },
  { url: "https://stackoverflow.com/questions?tab=hot",                  label: "stackoverflow/hot",   dwellMs: [12000, 20000], scrollSteps: 2 },
  { url: "https://medium.com/tag/technology",                             label: "medium/tech",         dwellMs: [15000, 25000], scrollSteps: 3, followLink: true },
  { url: "https://techcrunch.com",                                        label: "techcrunch/home",     dwellMs: [15000, 25000], scrollSteps: 3 },
  { url: "https://www.wired.com",                                         label: "wired/home",          dwellMs: [12000, 20000], scrollSteps: 2 },
  { url: "https://hbr.org",                                               label: "hbr/home",            dwellMs: [12000, 20000], scrollSteps: 2, followLink: true },
  { url: "https://www.forbes.com/technology/",                           label: "forbes/tech",         dwellMs: [12000, 20000], scrollSteps: 2 },
];

const PHASE_3_VERTICAL: WarmupSite[] = [
  { url: "https://blog.hubspot.com/marketing",                           label: "hubspot/blog",        dwellMs: [15000, 25000], scrollSteps: 3, followLink: true },
  { url: "https://moz.com/blog",                                          label: "moz/blog",            dwellMs: [12000, 20000], scrollSteps: 3, followLink: true },
  { url: "https://www.semrush.com/blog/",                                label: "semrush/blog",        dwellMs: [12000, 20000], scrollSteps: 2, followLink: true },
  { url: "https://searchengineland.com",                                  label: "searchengineland",    dwellMs: [12000, 20000], scrollSteps: 2 },
  { url: "https://www.searchenginejournal.com",                          label: "sej/home",            dwellMs: [10000, 18000], scrollSteps: 2 },
  { url: "https://neilpatel.com/blog/",                                  label: "neilpatel/blog",      dwellMs: [12000, 20000], scrollSteps: 2, followLink: true },
];

// Quick mode: a representative subset (~12 min)
const QUICK_SITES: WarmupSite[] = [
  PHASE_1_FOUNDATION[0], // google/news
  PHASE_1_FOUNDATION[2], // youtube
  PHASE_1_FOUNDATION[3], // wikipedia
  PHASE_1_FOUNDATION[4], // reddit
  PHASE_1_FOUNDATION[5], // bbc
  PHASE_2_PROFESSIONAL[0], // linkedin
  PHASE_2_PROFESSIONAL[4], // techcrunch
  PHASE_3_VERTICAL[0], // hubspot
  PHASE_3_VERTICAL[2], // semrush
  PHASE_3_VERTICAL[3], // searchengineland
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function jitter(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function resolveExtensionPaths(rootDir: string): string[] {
  const abs = path.resolve(process.cwd(), rootDir);
  try {
    return fsSync.readdirSync(abs)
      .map((name) => path.join(abs, name))
      .filter((p) => {
        try {
          return fsSync.statSync(p).isDirectory() &&
            fsSync.existsSync(path.join(p, "manifest.json"));
        } catch { return false; }
      });
  } catch {
    console.warn(`⚠  Extensions directory not found: ${abs}`);
    return [];
  }
}

function log(msg: string): void {
  if (VERBOSE) console.log(msg);
}

// ── Page visitor ─────────────────────────────────────────────────────────────

interface VisitResult {
  url: string;
  label: string;
  finalUrl: string;
  status: "ok" | "error";
  error?: string;
  durationMs: number;
  scrollsDone: number;
  linkFollowed?: string;
}

async function visitSite(page: Page, site: WarmupSite): Promise<VisitResult> {
  const t0 = Date.now();
  const result: VisitResult = {
    url: site.url,
    label: site.label,
    finalUrl: site.url,
    status: "ok",
    durationMs: 0,
    scrollsDone: 0,
  };

  try {
    await page.goto(site.url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await sleep(jitter(2000, 4000)); // initial render settle

    result.finalUrl = page.url();

    // Scroll in natural bursts
    for (let i = 0; i < site.scrollSteps; i++) {
      const scrollPx = jitter(250, 600);
      await page.evaluate((px) => window.scrollBy({ top: px, behavior: "smooth" }), scrollPx);
      await sleep(jitter(1200, 2800));
    }
    result.scrollsDone = site.scrollSteps;

    // Optionally follow one internal link
    if (site.followLink) {
      try {
        const host = new URL(site.url).hostname.replace(/^www\./, "");
        const links = await page.$$eval(
          `a[href]`,
          (els, h) =>
            els
              .map((a) => (a as HTMLAnchorElement).href)
              .filter((href) => {
                try { return new URL(href).hostname.includes(h) && href.length < 200; }
                catch { return false; }
              })
              .slice(0, 10),
          host
        );
        if (links.length > 0) {
          const pick = links[jitter(0, Math.min(links.length - 1, 4))];
          await page.goto(pick, { waitUntil: "domcontentloaded", timeout: 15000 });
          await sleep(jitter(4000, 8000));
          await page.evaluate((px) => window.scrollBy({ top: px, behavior: "smooth" }), jitter(300, 600));
          await sleep(jitter(2000, 4000));
          result.linkFollowed = pick;
        }
      } catch { /* link follow is best-effort */ }
    }

    // Core dwell time on the page
    const [dwellMin, dwellMax] = site.dwellMs;
    const elapsed = Date.now() - t0;
    const remaining = jitter(dwellMin, dwellMax) - elapsed;
    if (remaining > 500) await sleep(remaining);

  } catch (err: unknown) {
    result.status = "error";
    result.error = err instanceof Error ? err.message : String(err);
  }

  result.durationMs = Date.now() - t0;
  return result;
}

// ── Session logger ────────────────────────────────────────────────────────────

interface WarmupSessionLog {
  startedAt: string;
  endedAt: string;
  mode: "full" | "quick";
  profileDir: string;
  extensionsLoaded: number;
  sitesAttempted: number;
  sitesOk: number;
  sitesFailed: number;
  totalDurationMs: number;
  visits: VisitResult[];
}

async function persistLog(record: WarmupSessionLog): Promise<void> {
  try {
    await fs.mkdir(path.dirname(SESSION_LOG), { recursive: true });
    await fs.appendFile(SESSION_LOG, JSON.stringify(record) + "\n", "utf8");
  } catch { /* non-fatal */ }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  const startedAt = new Date().toISOString();
  console.log(`\n🔥 Cookie Warmup  [mode=${WARMUP_MODE}]`);
  console.log(`   Profile : ${PROFILE_DIR}`);
  console.log(`   Log     : ${SESSION_LOG}\n`);

  // 1. Ensure display (Xvfb on Linux, macOS native)
  const displayInfo = await ensureDisplay({ verbose: true });
  const { headless, extraArgs } = getChromeMode(displayInfo);

  // 2. Resolve extensions
  const extensionPaths = resolveExtensionPaths(EXTENSIONS_DIR);
  if (extensionPaths.length === 0) {
    console.warn("⚠  No extensions found — warming up without extensions");
  } else {
    console.log(`📦 Loading ${extensionPaths.length} extensions`);
  }

  const extensionArgs = extensionPaths.length > 0
    ? [
        `--load-extension=${extensionPaths.join(",")}`,
        `--disable-extensions-except=${extensionPaths.join(",")}`,
      ]
    : [];

  // 3. Ensure profile dir exists
  await fs.mkdir(PROFILE_DIR, { recursive: true });

  // 4. Launch browser
  const browser = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless,
    args: [
      ...extensionArgs,
      ...extraArgs,
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-blink-features=AutomationControlled",
    ],
    viewport: { width: 1280, height: 800 },
    locale: "en-US",
    timezoneId: "America/New_York",
  });

  const page = await browser.newPage();

  // 5. Select site list
  const sites = WARMUP_MODE === "quick" ? QUICK_SITES : [
    ...PHASE_1_FOUNDATION,
    ...PHASE_2_PROFESSIONAL,
    ...PHASE_3_VERTICAL,
  ];

  const phases =
    WARMUP_MODE === "quick"
      ? [{ label: "Quick warmup", sites: QUICK_SITES }]
      : [
          { label: "Phase 1 — Foundation",   sites: PHASE_1_FOUNDATION },
          { label: "Phase 2 — Professional", sites: PHASE_2_PROFESSIONAL },
          { label: "Phase 3 — Vertical",     sites: PHASE_3_VERTICAL },
        ];

  // 6. Visit sites phase by phase
  const visits: VisitResult[] = [];
  let siteIndex = 0;

  for (const phase of phases) {
    console.log(`\n── ${phase.label} (${phase.sites.length} sites) ──`);
    for (const site of phase.sites) {
      siteIndex++;
      const total = sites.length;
      process.stdout.write(`  [${siteIndex}/${total}] ${site.label.padEnd(26)} `);
      const result = await visitSite(page, site);
      visits.push(result);
      if (result.status === "ok") {
        const linked = result.linkFollowed ? ` → ${new URL(result.linkFollowed).pathname.slice(0, 30)}` : "";
        console.log(`✓  ${(result.durationMs / 1000).toFixed(1)}s${linked}`);
      } else {
        console.log(`✗  ${result.error?.slice(0, 60)}`);
      }
    }
  }

  // 7. Extension flush phase — idle time lets extensions batch-send
  const FLUSH_MS = WARMUP_MODE === "quick" ? 45_000 : 90_000;
  console.log(`\n── Phase: Extension flush (${FLUSH_MS / 1000}s idle) ──`);
  console.log("   Extensions are now batching & sending accumulated data…");
  await page.goto("about:blank");

  for (let remaining = FLUSH_MS; remaining > 0; remaining -= 5000) {
    process.stdout.write(`\r   Flushing… ${Math.ceil(remaining / 1000)}s remaining   `);
    await sleep(Math.min(5000, remaining));
  }
  console.log("\r   Flush complete.                                  ");

  // 8. Persist session log
  const endedAt = new Date().toISOString();
  const ok = visits.filter((v) => v.status === "ok").length;
  const failed = visits.length - ok;

  const sessionLog: WarmupSessionLog = {
    startedAt,
    endedAt,
    mode: WARMUP_MODE,
    profileDir: PROFILE_DIR,
    extensionsLoaded: extensionPaths.length,
    sitesAttempted: visits.length,
    sitesOk: ok,
    sitesFailed: failed,
    totalDurationMs: new Date(endedAt).getTime() - new Date(startedAt).getTime(),
    visits,
  };
  await persistLog(sessionLog);

  console.log(`\n✅ Warmup complete`);
  console.log(`   Sites visited : ${ok}/${visits.length} ok${failed > 0 ? `  (${failed} failed)` : ""}`);
  console.log(`   Duration      : ${(sessionLog.totalDurationMs / 60000).toFixed(1)} min`);
  console.log(`   Profile saved : ${PROFILE_DIR}`);
  console.log(`   Session log   : ${SESSION_LOG}\n`);

  await browser.close();
}

run().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
