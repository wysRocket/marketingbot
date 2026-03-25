import { Page } from "playwright";
import { randomDelay } from "./interact";
import type { ReferrerEntry } from "./referrer";

/**
 * Search engine configs: selectors for the input box and result links.
 * Keyed by the hostname of the search engine URL.
 */
interface SearchEngineConfig {
  inputSelector: string;
  /** Selector for organic result links in the SERP */
  resultSelector: string;
  /** Some engines need Enter key rather than a submit button click */
  submitWithEnter?: boolean;
}

const SEARCH_ENGINE_CONFIGS: Record<string, SearchEngineConfig> = {
  "www.google.com":    { inputSelector: 'textarea[name="q"], input[name="q"]', resultSelector: 'a[href*="eurocookflow.com"]', submitWithEnter: true },
  "www.google.co.uk":  { inputSelector: 'textarea[name="q"], input[name="q"]', resultSelector: 'a[href*="eurocookflow.com"]', submitWithEnter: true },
  "www.google.ca":     { inputSelector: 'textarea[name="q"], input[name="q"]', resultSelector: 'a[href*="eurocookflow.com"]', submitWithEnter: true },
  "www.google.com.au": { inputSelector: 'textarea[name="q"], input[name="q"]', resultSelector: 'a[href*="eurocookflow.com"]', submitWithEnter: true },
  "www.bing.com":      { inputSelector: 'input[name="q"], #sb_form_q',          resultSelector: 'a[href*="eurocookflow.com"]', submitWithEnter: true },
  "duckduckgo.com":    { inputSelector: 'input[name="q"], #searchbox_input',     resultSelector: 'a[href*="eurocookflow.com"]', submitWithEnter: true },
};

/**
 * Navigate to a search engine, type the query, wait for results, and click
 * the first result that links to the target site.
 *
 * This produces a genuine browser-level referrer (the SERP URL) rather than
 * a spoofed HTTP Referer header, so GA4 correctly attributes the session as
 * Organic Search.
 *
 * Falls back to a direct navigate() if the search engine is unreachable,
 * the result link is not found within the timeout, or any other error occurs.
 *
 * @param page        - Playwright page
 * @param referrer    - The search engine entry from pickReferrerEntry()
 * @param targetUrl   - The destination URL to land on (used for fallback)
 * @param query       - The search query (defaults to the site's hostname)
 */
export async function searchAndNavigate(
  page: Page,
  referrer: ReferrerEntry,
  targetUrl: string,
  query = "eurocookflow.com",
): Promise<void> {
  const engineUrl = referrer.url;
  const hostname = new URL(engineUrl).hostname;
  const cfg = SEARCH_ENGINE_CONFIGS[hostname];

  if (!cfg) {
    // Unknown search engine — fall back to plain navigate with Referer header
    await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
      referer: engineUrl,
    });
    return;
  }

  try {
    // --- Step 1: Land on the search engine homepage ---
    await page.goto(engineUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await randomDelay(page, 800, 1_800);

    // --- Step 2: Dismiss consent/cookie banners if present ---
    await dismissConsentBanner(page);

    // --- Step 3: Type the query into the search box ---
    const input = page.locator(cfg.inputSelector).first();
    await input.waitFor({ timeout: 10_000 });
    await input.click();
    await randomDelay(page, 200, 500);

    // Type character-by-character with small random delays to look human
    for (const char of query) {
      await input.type(char, { delay: Math.floor(Math.random() * 80 + 40) });
    }
    await randomDelay(page, 400, 900);

    // --- Step 4: Submit the search ---
    await input.press("Enter");

    // --- Step 5: Wait for SERP to load ---
    await page.waitForLoadState("domcontentloaded", { timeout: 20_000 });
    await randomDelay(page, 600, 1_400);

    // --- Step 6: Find the result link ---
    const resultLink = page.locator(cfg.resultSelector).first();
    const found = await resultLink
      .waitFor({ timeout: 10_000 })
      .then(() => true)
      .catch(() => false);

    if (!found) {
      // Result not found — fall through to fallback
      throw new Error(`Search result for ${query} not found on ${hostname}`);
    }

    // Scroll the result into view to mimic a user scanning the page
    await resultLink.scrollIntoViewIfNeeded().catch(() => {});
    await randomDelay(page, 300, 800);

    // --- Step 7: Click the result ---
    await resultLink.click({ timeout: 10_000 });

    // Wait for target page to load
    await page.waitForLoadState("domcontentloaded", { timeout: 30_000 });
  } catch (err) {
    // Any failure (network, selector, timeout) → silent fallback to direct navigate
    // Use the search engine as a plain Referer so the session isn't completely sourceless
    console.warn(
      `[searchEngine] fallback to direct navigate (${hostname}: ${(err as Error).message})`,
    );
    await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
      referer: engineUrl,
    }).catch(() => {});
  }
}

/**
 * Attempt to dismiss cookie/consent banners common on Google and Bing.
 * Best-effort — never throws.
 */
async function dismissConsentBanner(page: Page): Promise<void> {
  const dismissSelectors = [
    // Google consent (EU)
    'button[id="L2AGLb"]',
    'button[aria-label="Accept all"]',
    'button[aria-label="Reject all"]',
    // Bing consent
    '#bnp_btn_accept',
    'button[id="bnp_btn_accept"]',
    // DuckDuckGo
    'button[data-testid="consent-button"]',
    // Generic
    'button:has-text("Accept all")',
    'button:has-text("I agree")',
    'button:has-text("Agree")',
  ];

  for (const sel of dismissSelectors) {
    const btn = page.locator(sel).first();
    const visible = await btn.isVisible().catch(() => false);
    if (visible) {
      await btn.click({ timeout: 3_000 }).catch(() => {});
      await randomDelay(page, 300, 600);
      break;
    }
  }
}
