import { Page } from "playwright";
import { navigate, blockHeavyAssets } from "../actions/navigate";
import { randomBrowse, randomDelay } from "../actions/interact";
import { pickReferrerEntry, applyUtmParams } from "../actions/referrer";
import { getText } from "../actions/scrape";
import {
  assertFlowEnabled,
  getActiveSiteProfile,
  resolveSiteUrl,
  type SiteProfile,
} from "../sites";

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
 * 1. Navigate to the homepage once.
 * 2. Open the first legal page via the footer link click.
 * 3. Navigate directly between the remaining legal pages.
 * 4. On each page, read <h1> and stay for a randomised duration (10–32 s)
 *    executing organic actions: scroll down/up, hover over elements, pause.
 *
 * Returns the URL and heading collected from each visited page.
 */
export async function browseFooterLinks(
  page: Page,
  site: SiteProfile = getActiveSiteProfile(),
): Promise<BrowseFooterLinksResult> {
  assertFlowEnabled(site, "browseFooterLinks");

  const cfg = site.browseFooterLinks;
  await blockHeavyAssets(page);

  const visited: FooterPageVisit[] = [];
  // Start from the homepage once, then move directly between legal pages to
  // avoid repeated full homepage reloads.
  const referrer = pickReferrerEntry();
  const homeUrl = applyUtmParams(resolveSiteUrl(site, cfg.homePath), referrer);
  await navigate(page, homeUrl, referrer.url || undefined);
  await page.waitForTimeout(800);

  for (let i = 0; i < cfg.footerPaths.length; i++) {
    const path = cfg.footerPaths[i];

    if (i === 0) {
      // ----- 1. First legal page via footer click -----
      await page.evaluate((selector) => {
        document
          .querySelector(selector)
          ?.scrollIntoView({ behavior: "smooth" });
      }, cfg.footerContainerSelector);
      await page.waitForTimeout(800);

      const linkSelector = cfg.footerLinkSelectorTemplate
        .split("{{path}}")
        .join(path);
      await page.waitForSelector(linkSelector, {
        state: "visible",
        timeout: 8_000,
      });
      await page.click(linkSelector);
      await page.waitForLoadState("domcontentloaded", { timeout: 20_000 });
    } else {
      // ----- 2. Next legal pages via direct in-site navigation -----
      await navigate(page, resolveSiteUrl(site, path), page.url());
      await page.waitForLoadState("domcontentloaded", { timeout: 20_000 });
    }

    // ----- 3. Read page content and simulate organic browsing -----
    const heading = await getText(page, cfg.headingSelector).catch(() => "");
    await randomBrowse(page, 10_000, 32_000);
    await randomDelay(page, 500, 1_300);

    const currentUrl = page.url();
    visited.push({ path, url: currentUrl, heading });
  }

  return { visited };
}
