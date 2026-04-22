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

    // Step 2: Handle consent page
    // Google (EU) redirects to consent.google.com before showing the SERP.
    // Bing shows a consent overlay.  Detect both and click through.
    await handleConsentIfNeeded(page);

    // Step 3: Wait for the organic results container to be present in the DOM.
    // This is the key guard that was missing — without it we look for result
    // links before the JS renderer has built them.
    const resultsAppeared = await page
      .waitForSelector(cfg.resultsContainer, { timeout: 20_000 })
      .then(() => true)
      .catch(() => false);

    if (!resultsAppeared) {
      throw new Error(
        `Results container ("${cfg.resultsContainer}") not found on ${engineHostname} — possible CAPTCHA or block`,
      );
    }

    await randomDelay(page, 300, 700);

    // Step 4: Find the first result link
    const selector = cfg.resultLinkSelector(targetHostname);
    const resultLink = page.locator(selector).first();
    const found = await resultLink
      .waitFor({ timeout: 15_000 })
      .then(() => true)
      .catch(() => false);

    if (!found) {
      throw new Error(`Search result for "${query}" not found on ${engineHostname}`);
    }

    // Step 5: Scroll into view to mimic a user scanning the SERP
    await resultLink.scrollIntoViewIfNeeded().catch(() => {});
    await randomDelay(page, 400, 1_000);

    // Step 6: Click — browser sets Referer to the SERP URL automatically
    await resultLink.click({ timeout: 10_000 });
    await page.waitForLoadState("domcontentloaded", { timeout: 30_000 });
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
 * Detect and dismiss cookie/consent walls.
 *
 * Google EU redirects the entire page to consent.google.com.  We detect that
 * via page.url() and wait for the navigation back to the SERP after clicking.
 * Bing and DDG show an overlay on the results page itself.
 */
async function handleConsentIfNeeded(page: Page): Promise<void> {
  const currentUrl = page.url();
  const onConsentRedirect =
    currentUrl.includes("consent.google.com") ||
    currentUrl.includes("consent.bing.com");

  if (onConsentRedirect) {
    // Full-page consent redirect — click through and wait for SERP navigation
    await clickConsentButton(page);
    await page.waitForLoadState("domcontentloaded", { timeout: 20_000 }).catch(() => {});
    await randomDelay(page, 500, 1_000);
    return;
  }

  // Inline overlay (Bing, DDG, or Google with cookie pre-set but stale)
  await clickConsentButton(page);
  await randomDelay(page, 300, 600);
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
