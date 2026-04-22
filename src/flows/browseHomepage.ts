import { Page } from "playwright";
import { navigate, blockHeavyAssets } from "../actions/navigate";
import { scrollDown, randomBrowse, randomDelay } from "../actions/interact";
import { pickReferrerEntry, applyUtmParams } from "../actions/referrer";
import { searchAndNavigate } from "../actions/searchEngine";
import { getText, getAll, getLinks } from "../actions/scrape";
import {
  findExpectedText,
  matchesExpectedText,
  readBodyText,
  resolveBrowseWindow,
  waitForHydratedContent,
} from "./utils";
import {
  assertFlowEnabled,
  getActiveSiteProfile,
  resolveSiteUrl,
  type SiteProfile,
} from "../sites";
import type { SessionPolicy } from "../session/complexSession";

export interface BrowseResult {
  heroHeading: string;
  navLinks: string[];
  featureNames: string[];
  pricingTiers: string[];
  footerLinks: string[];
}

/**
 * Flow 1 — Organic Homepage Browse
 *
 * Simulates a real visitor landing on the homepage, reading through all
 * anchor sections in order, and validating that the expected content is
 * in place.
 *
 * Sections covered: Hero → Journeys → Academy → CookFlows → Members → Footer
 */
export async function browseHomepage(
  page: Page,
  site: SiteProfile = getActiveSiteProfile(),
  policy?: Pick<SessionPolicy, "minDurationMs" | "maxTopUpCycles">,
): Promise<BrowseResult> {
  assertFlowEnabled(site, "browseHomepage");

  const cfg = site.browseHomepage;
  await blockHeavyAssets(page);

  // ----- 1. Land on homepage -----
  const referrer = pickReferrerEntry();
  const targetUrl = applyUtmParams(
    resolveSiteUrl(site, cfg.homePath),
    referrer,
  );

  if (referrer.type === "search") {
    await searchAndNavigate(page, referrer, targetUrl, site.id);
  } else {
    await navigate(page, targetUrl, referrer.url || undefined);
  }
  await waitForHydratedContent(page, {
    selectors: [cfg.heroHeadingSelector, cfg.membersSectionSelector],
    expectedText: cfg.heroHeadingIncludes,
    timeoutMs: 30_000,
  });

  const bodyText = await readBodyText(page);
  const heroHeading =
    (await getText(page, cfg.heroHeadingSelector).catch(() => "")) ||
    findExpectedText(bodyText, cfg.heroHeadingIncludes) ||
    "";
  if (!matchesExpectedText(heroHeading || bodyText, cfg.heroHeadingIncludes)) {
    throw new Error(
      `Unexpected hero heading: "${heroHeading}" (expected one of: ${cfg.heroHeadingIncludes.join(", ")})`,
    );
  }

  // ----- 2. Collect and validate nav links -----
  const navLinks = await getLinks(page, cfg.navLinksSelector);
  for (const anchor of cfg.expectedAnchors) {
    const found = navLinks.some((l) => l.includes(anchor));
    if (!found) throw new Error(`Nav anchor link missing: ${anchor}`);
  }

  // ----- 3. Follow anchor links from the nav to mimic real section hopping -----
  for (const anchor of cfg.expectedAnchors) {
    const link = page
      .locator(`a[href="${anchor}"], a[href$="${anchor}"]`)
      .first();
    if ((await link.count()) === 0) continue;

    await link.scrollIntoViewIfNeeded().catch(() => {
      /* non-critical */
    });
    await link.click({ timeout: 5_000 }).catch(async () => {
      await page.evaluate(
        (hash) =>
          document
            .querySelector(`a[href="${hash}"]`)
            ?.scrollIntoView({ behavior: "smooth" }),
        anchor,
      );
    });
    await randomDelay(page, 300, 800);
  }

  // ----- 3. Scroll to #academy and read course names -----
  await page.evaluate((selector) => {
    document.querySelector(selector)?.scrollIntoView({ behavior: "smooth" });
  }, cfg.academySectionSelector);
  await page.waitForTimeout(1_200);

  let featureNames: string[] = [];
  for (const selector of cfg.academyFeatureSelectors) {
    featureNames = await getAll(page, selector).catch((): string[] => []);
    if (featureNames.length > 0) break;
  }

  // ----- 4. Scroll to #rituals -----
  if (cfg.ritualsSectionSelector) {
    await page.evaluate((selector) => {
      document.querySelector(selector)?.scrollIntoView({ behavior: "smooth" });
    }, cfg.ritualsSectionSelector);
    await page.waitForTimeout(1_000);
  }

  // ----- 5. Scroll to #members and read membership tiers -----
  await page.evaluate((selector) => {
    document.querySelector(selector)?.scrollIntoView({ behavior: "smooth" });
  }, cfg.membersSectionSelector);
  await page.waitForTimeout(1_200);
  let pricingTiers: string[] = [];
  for (const selector of cfg.pricingTierSelectors ?? []) {
    pricingTiers = await getAll(page, selector).catch((): string[] => []);
    if (pricingTiers.length > 0) break;
  }
  if (pricingTiers.length === 0) {
    const pricingLinks = await getLinks(page, cfg.pricingLinksSelector);
    const pricingRegex = new RegExp(cfg.pricingPlanRegex, "i");
    pricingTiers = pricingLinks
      .map((href) => {
        const match = href.match(pricingRegex);
        return match?.[1]?.replace(/-/g, " ") ?? "";
      })
      .filter(Boolean);
  }

  // ----- 6. Scroll to footer -----
  await scrollDown(page, 2);
  await page.waitForTimeout(600);

  // ----- 7. Collect and validate footer links -----
  const footerLinks = await getLinks(page, cfg.footerLinksSelector).catch(
    () => [],
  );
  for (const path of cfg.requiredFooterPaths) {
    const found = footerLinks.some((l) => l.includes(path));
    if (!found) throw new Error(`Footer link missing: ${path}`);
  }

  // Stay on the page longer with organic interaction before leaving the flow.
  const browseWindow = resolveBrowseWindow(
    policy,
    { minMs: 12_000, maxMs: 28_000 },
    { minMs: 2_500, maxMs: 6_000 },
  );
  await randomBrowse(page, browseWindow.minMs, browseWindow.maxMs);

  return { heroHeading, navLinks, featureNames, pricingTiers, footerLinks };
}
