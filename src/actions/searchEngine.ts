import { Page } from "playwright";
import { randomDelay } from "./interact";
import type { ReferrerEntry } from "./referrer";

/**
 * Navigate to a search engine SERP directly (e.g. google.com/search?q=eurocookflow),
 * then click the first result link pointing to the target site.
 *
 * This produces a genuine browser-level referrer (the SERP URL) so GA4 and
 * Similarweb attribute the session as Organic Search rather than Direct.
 *
 * Falls back to a direct navigate() with the SERP URL as Referer if the
 * result link is not found or any other error occurs.
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

  try {
    // Step 1: Navigate directly to the pre-built SERP URL
    await page.goto(serpUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await randomDelay(page, 600, 1_400);

    // Step 2: Dismiss cookie/consent banners (common on Google EU)
    await dismissConsentBanner(page);
    await randomDelay(page, 300, 700);

    // Step 3: Find the first result link for the target site
    const resultLink = page.locator(`a[href*="${targetHostname}"]`).first();
    const found = await resultLink
      .waitFor({ timeout: 10_000 })
      .then(() => true)
      .catch(() => false);

    if (!found) {
      throw new Error(`Search result for "${query}" not found on ${engineHostname}`);
    }

    // Step 4: Scroll into view to mimic a user scanning the SERP
    await resultLink.scrollIntoViewIfNeeded().catch(() => {});
    await randomDelay(page, 300, 800);

    // Step 5: Click the result — browser sets Referer to the SERP URL
    await resultLink.click({ timeout: 10_000 });
    await page.waitForLoadState("domcontentloaded", { timeout: 30_000 });
  } catch (err) {
    console.warn(
      `[searchEngine] fallback to direct navigate (${engineHostname}: ${(err as Error).message})`,
    );
    // Use the SERP URL as a plain Referer so the session isn't completely sourceless
    await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
      referer: serpUrl,
    }).catch(() => {});
  }
}

/**
 * Build a search engine results page URL for the given query.
 * Each engine has a slightly different URL structure.
 */
function buildSerpUrl(engineUrl: string, queryParam: string, query: string): string {
  const { hostname, origin } = new URL(engineUrl);
  const q = `${queryParam}=${encodeURIComponent(query)}`;

  if (hostname.startsWith("www.google.")) return `${origin}/search?${q}`;
  if (hostname === "www.bing.com") return `${origin}/search?${q}`;
  if (hostname === "duckduckgo.com") return `${origin}/?${q}`;
  return `${origin}/search?${q}`;
}

/**
 * Attempt to dismiss cookie/consent banners common on Google and Bing.
 * Best-effort — never throws.
 */
async function dismissConsentBanner(page: Page): Promise<void> {
  const dismissSelectors = [
    'button[id="L2AGLb"]',
    'button[aria-label="Accept all"]',
    'button[aria-label="Reject all"]',
    '#bnp_btn_accept',
    'button[data-testid="consent-button"]',
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
