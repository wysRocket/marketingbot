import { Page } from "playwright";
import { navigate, blockHeavyAssets } from "../actions/navigate";
import { randomBrowse } from "../actions/interact";
import { pickReferrer } from "../actions/referrer";
import { getText } from "../actions/scrape";

const BASE = "https://eurocookflow.com";

/** Paths that must be reachable from the footer. */
const FOOTER_PATHS = ["/legal/privacy", "/legal/terms", "/legal/vat"];

export interface FooterPageVisit {
  path: string;
  url: string;
  heading: string;
}

export interface BrowseFooterLinksResult {
  visited: FooterPageVisit[];
}

/**
 * Flow — Browse Footer Links
 *
 * For each expected footer link (/legal/privacy, /legal/terms, /legal/vat):
 *   1. Navigate to the homepage.
 *   2. Scroll to the footer so the link enters the viewport.
 *   3. Click the footer anchor and wait for the page to load.
 *   4. Read the page <h1>, then stay for a randomised duration (8–25 s)
 *      executing organic actions: scroll down/up, hover over elements, pause.
 *
 * Returns the URL and heading collected from each visited page.
 */
export async function browseFooterLinks(
  page: Page,
): Promise<BrowseFooterLinksResult> {
  await blockHeavyAssets(page);

  const visited: FooterPageVisit[] = [];
  // First entry uses a random external referrer (simulates arriving from search/social).
  // Subsequent returns to the homepage carry the previously visited page as referrer,
  // matching natural in-site navigation behaviour.
  let previousPageUrl: string | undefined = undefined;

  for (const path of FOOTER_PATHS) {
    // ----- 1. Return to homepage -----
    const referer = previousPageUrl ?? pickReferrer();
    await navigate(page, BASE + "/", referer);
    await page.waitForTimeout(800);

    // ----- 2. Scroll footer into view -----
    await page.evaluate(() =>
      document.querySelector("footer")?.scrollIntoView({ behavior: "smooth" }),
    );
    await page.waitForTimeout(800);

    // ----- 3. Click the footer link -----
    const linkSelector = `footer a[href*="${path}"], .footer a[href*="${path}"]`;
    await page.waitForSelector(linkSelector, {
      state: "visible",
      timeout: 8_000,
    });
    await page.click(linkSelector);
    await page.waitForLoadState("domcontentloaded", { timeout: 20_000 });

    // ----- 4. Read page content and simulate organic browsing -----
    const heading = await getText(page, "h1").catch(() => "");
    await randomBrowse(page); // stays 8–25 s, mixed scroll/hover/pause actions

    const currentUrl = page.url();
    visited.push({ path, url: currentUrl, heading });
    previousPageUrl = currentUrl; // becomes the Referer for the next homepage visit
  }

  return { visited };
}
