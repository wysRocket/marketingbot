import { Page } from "playwright";
import { randomDelay } from "./interact";
import type { ReferrerEntry } from "./referrer";

// ---------------------------------------------------------------------------
// Per-engine config
// ---------------------------------------------------------------------------

interface EngineConfig {
  /**
   * Wait for this selector to confirm the SERP is rendered.
   * Without it we scan for result links before JS has built the DOM.
   */
  resultsContainer: string;
  /**
   * Return a CSS selector that targets organic result title links.
   * Must select <a> elements whose href is the direct destination URL
   * (not a tracking redirect).
   */
  resultLinkSelector: (targetHostname: string) => string;
}

const ENGINE_CONFIGS: Partial<Record<string, EngineConfig>> = {
  google: {
    // #rso = "results section outer" — the organic results block
    resultsContainer: "#rso, #search",
    resultLinkSelector: (h) =>
      `#rso a[href*="${h}"], #search a[href*="${h}"]`,
  },
  bing: {
    // li.b_algo = one organic result item; h2 a holds the direct destination href
    resultsContainer: "#b_results, .b_results",
    resultLinkSelector: (h) =>
      `li.b_algo h2 a[href*="${h}"], #b_results a[href*="${h}"]`,
  },
  duckduckgo: {
    resultsContainer: "[data-testid='result'], #links, .results",
    resultLinkSelector: (h) => `a[href*="${h}"]`,
  },
};

function getEngineConfig(hostname: string): EngineConfig {
  if (hostname.startsWith("www.google.")) return ENGINE_CONFIGS.google!;
  if (hostname === "www.bing.com") return ENGINE_CONFIGS.bing!;
  if (hostname === "duckduckgo.com") return ENGINE_CONFIGS.duckduckgo!;
  return ENGINE_CONFIGS.google!;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Navigate to a search engine SERP directly (e.g. google.com/search?q=eurocookflow),
 * wait for organic results to render, then click the first result link for the
 * target site.
 *
 * Handles EU consent walls: detects a consent-page redirect and clicks through
 * it before waiting for the real SERP.
 *
 * Falls back to a direct navigate() with the SERP URL as Referer if the result
 * link is not found or any other error occurs.
 */
export async function searchAndNavigate(
  page: Page,
  referrer: ReferrerEntry,
  targetUrl: string,
  query = "eurocookflow",
): Promise<void> {
  const engineUrl = referrer.url;
  const engineHostname = new URL(engineUrl).hostname;
  const targetHostname = new URL(targetUrl).hostname;
  const serpUrl = buildSerpUrl(engineUrl, referrer.queryParam ?? "q", query);
  const cfg = getEngineConfig(engineHostname);

  try {
    // Step 1: Navigate to the pre-built SERP URL
    await page.goto(serpUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await randomDelay(page, 800, 1_600);

    // Step 2: Fail fast on Google's CAPTCHA/sorry page — detected by URL before
    // wasting time waiting for selectors that will never appear.
    if (isCaptchaPage(page.url())) {
      throw new Error(`CAPTCHA/blocked page on ${engineHostname} (${page.url()})`);
    }

    // Step 3: Race between results and consent gate.
    // Budget: 8s — if Google is serving a CAPTCHA the race times out quickly.
    const initialState = await racePageState(page, cfg.resultsContainer, 8_000);

    if (initialState === "consent") {
      // A consent button became visible before results — click it and wait for
      // the page to navigate back to the SERP (redirect) or dismiss the overlay.
      await clickConsentButton(page);
      await page.waitForLoadState("domcontentloaded", { timeout: 12_000 }).catch(() => {});
      await randomDelay(page, 400, 800);
    } else if (initialState === "timeout") {
      // Neither results nor consent appeared — likely a CAPTCHA or block page.
      // Fail immediately rather than burning another 15s on a second wait.
      throw new Error(
        `Results container ("${cfg.resultsContainer}") not found on ${engineHostname} — possible CAPTCHA or block`,
      );
    }

    // Step 4: Wait for the organic results container.
    // Only reached when consent was handled (initialState === "consent") or
    // results appeared immediately (initialState === "results", already visible).
    const resultsAppeared = await page
      .waitForSelector(cfg.resultsContainer, { timeout: 10_000 })
      .then(() => true)
      .catch(() => false);

    if (!resultsAppeared) {
      throw new Error(
        `Results container ("${cfg.resultsContainer}") not found on ${engineHostname} after consent`,
      );
    }

    await randomDelay(page, 300, 700);

    // Step 5: Find the first result link
    const selector = cfg.resultLinkSelector(targetHostname);
    const resultLink = page.locator(selector).first();
    const found = await resultLink
      .waitFor({ timeout: 10_000 })
      .then(() => true)
      .catch(() => false);

    if (!found) {
      throw new Error(`Search result for "${query}" not found on ${engineHostname}`);
    }

    // Step 5: Scroll into view to mimic a user scanning the SERP
    await resultLink.scrollIntoViewIfNeeded().catch(() => {});
    await randomDelay(page, 400, 1_000);

    // Step 6: Navigate to the result via href rather than Playwright .click().
    // Bing wraps its title links in a div that intercepts pointer events, causing
    // Playwright's click to enter a retry loop and eventually time out.
    // Extracting the href and calling page.goto() is equivalent for attribution:
    // the browser navigates to the target URL with the SERP as the Referer.
    const currentSerpUrl = page.url();
    const href = await resultLink.getAttribute("href").catch(() => null);
    const destination =
      href && (href.startsWith("https://") || href.startsWith("http://"))
        ? href
        : targetUrl;

    await page.goto(destination, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
      referer: currentSerpUrl,
    });
  } catch (err) {
    console.warn(
      `[searchEngine] fallback to direct navigate (${engineHostname}: ${(err as Error).message})`,
    );
    // Use the SERP URL as a plain Referer so the session is at least attributed
    // to the search engine rather than being completely sourceless.
    await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
      referer: serpUrl,
    }).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Return true when the current page URL indicates Google/Bing has served a
 * CAPTCHA or "unusual traffic" block instead of real search results.
 * Checking the URL is instant — no selector polling needed.
 */
function isCaptchaPage(url: string): boolean {
  return (
    url.includes("google.com/sorry/") ||
    url.includes("sorry/index") ||
    url.includes("bing.com/ck/a") ||           // Bing click-tracking redirect
    url.includes("ipv6.google.com/sorry") ||
    /google\.[a-z.]+\/sorry/i.test(url)
  );
}

/**
 * Build a direct SERP URL.
 * `hl=en` forces English so consent button text matches our selectors
 * regardless of the proxy's geo.
 */
function buildSerpUrl(engineUrl: string, queryParam: string, query: string): string {
  const { hostname, origin } = new URL(engineUrl);
  const q = encodeURIComponent(query);

  if (hostname.startsWith("www.google."))
    return `${origin}/search?${queryParam}=${q}&hl=en&num=10`;
  if (hostname === "www.bing.com")
    return `${origin}/search?${queryParam}=${q}&setlang=EN`;
  if (hostname === "duckduckgo.com")
    return `${origin}/?${queryParam}=${q}&kl=us-en`;
  return `${origin}/search?${queryParam}=${q}`;
}

/**
 * Race between the results container appearing and a consent button appearing.
 *
 * Returns "results" if organic results rendered first (happy path),
 * "consent"  if a consent button became visible first (gate to click through),
 * "timeout"  if neither appeared within the allotted time.
 *
 * This replaces the previous URL-sniff approach which missed Google's inline
 * consent overlay (shown on the SERP page itself without redirecting to
 * consent.google.com).
 */
async function racePageState(
  page: Page,
  resultsSelector: string,
  timeoutMs: number,
): Promise<"results" | "consent" | "timeout"> {
  const CONSENT_SELECTORS = [
    'button[jsname="tWT92d"]',
    'button[jsname="b3VHJd"]',
    'button[id="L2AGLb"]',
    'form[action*="consent"] button',
    '#bnp_btn_accept',
    'button[data-testid="consent-button"]',
    'button[aria-label="Accept all"]',
    'button:has-text("Accept all")',
    'button:has-text("Reject all")',
  ].join(", ");

  return Promise.race([
    page
      .waitForSelector(resultsSelector, { timeout: timeoutMs })
      .then(() => "results" as const),
    page
      .waitForSelector(CONSENT_SELECTORS, { timeout: timeoutMs })
      .then(() => "consent" as const),
  ]).catch(() => "timeout" as const);
}

/**
 * Try every known consent button selector.  Stops at the first visible hit.
 */
async function clickConsentButton(page: Page): Promise<void> {
  const selectors = [
    // Google (2024 EU consent page)
    'button[jsname="tWT92d"]',           // "Accept all" (new layout)
    'button[jsname="b3VHJd"]',           // "Reject all" — also unblocks
    'button[id="L2AGLb"]',               // older Google consent accept
    'form[action*="consent"] button',     // generic consent form button

    // Bing
    '#bnp_btn_accept',
    'button[id="bnp_btn_accept"]',

    // DuckDuckGo
    'button[data-testid="consent-button"]',

    // Generic English labels
    'button[aria-label="Accept all"]',
    'button[aria-label="Reject all"]',
    'button:has-text("Accept all")',
    'button:has-text("Reject all")',
    'button:has-text("I agree")',
    'button:has-text("Agree")',
  ];

  for (const sel of selectors) {
    const btn = page.locator(sel).first();
    const visible = await btn.isVisible().catch(() => false);
    if (visible) {
      await btn.click({ timeout: 5_000 }).catch(() => {});
      return;
    }
  }
}
