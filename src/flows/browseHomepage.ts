import { Page } from "playwright";
import { navigate, blockHeavyAssets } from "../actions/navigate";
import { scrollDown } from "../actions/interact";
import { pickReferrer } from "../actions/referrer";
import { getText, getAll, getLinks } from "../actions/scrape";

const BASE = "https://eurocookflow.com";

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
export async function browseHomepage(page: Page): Promise<BrowseResult> {
  await blockHeavyAssets(page);

  // ----- 1. Land on homepage -----
  await navigate(page, BASE + "/", pickReferrer());
  await page.waitForSelector("h1", { timeout: 15_000 });

  const heroHeading = await getText(page, "h1");
  if (!heroHeading.toLowerCase().includes("master the art")) {
    throw new Error(`Unexpected hero heading: "${heroHeading}"`);
  }

  // ----- 2. Collect and validate nav links -----
  const navLinks = await getLinks(page, 'a[href^="/#"]');
  const expectedAnchors = ["/#journeys", "/#academy", "/#rituals", "/#members"];
  for (const anchor of expectedAnchors) {
    const found = navLinks.some((l) => l.includes(anchor));
    if (!found) throw new Error(`Nav anchor link missing: ${anchor}`);
  }

  // ----- 3. Scroll to #academy and read course names -----
  await page.evaluate(() =>
    document.querySelector("#academy")?.scrollIntoView({ behavior: "smooth" }),
  );
  await page.waitForTimeout(1_200);
  // Course names — try progressively broader selectors.
  let featureNames: string[] = await getAll(
    page,
    "#academy h3, #academy h4",
  ).catch((): string[] => []);
  if (featureNames.length === 0) {
    featureNames = await getAll(page, "#academy h2").catch((): string[] => []);
  }
  if (featureNames.length === 0) {
    featureNames = await getAll(
      page,
      '#academy p strong, #academy [class*="title"], #academy [class*="name"]',
    ).catch((): string[] => []);
  }

  // ----- 4. Scroll to #rituals -----
  await page.evaluate(() =>
    document.querySelector("#rituals")?.scrollIntoView({ behavior: "smooth" }),
  );
  await page.waitForTimeout(1_000);

  // ----- 5. Scroll to #members and read membership tiers -----
  await page.evaluate(() =>
    document.querySelector("#members")?.scrollIntoView({ behavior: "smooth" }),
  );
  await page.waitForTimeout(1_200);
  const pricingLinks = await getLinks(page, 'a[href*="/auth/sign-up?plan="]');
  const pricingTiers = pricingLinks
    .map((href) => {
      const match = href.match(/plan=([a-z0-9-]+)/i);
      return match?.[1]?.replace(/-/g, " ") ?? "";
    })
    .filter(Boolean);

  // ----- 6. Scroll to footer -----
  await scrollDown(page, 2);
  await page.waitForTimeout(600);

  // ----- 7. Collect and validate footer links -----
  const footerLinks = await getLinks(page, "footer a, .footer a").catch(
    () => [],
  );
  const requiredFooter = ["/legal/privacy", "/legal/terms", "/legal/vat"];
  for (const path of requiredFooter) {
    const found = footerLinks.some((l) => l.includes(path));
    if (!found) throw new Error(`Footer link missing: ${path}`);
  }

  return { heroHeading, navLinks, featureNames, pricingTiers, footerLinks };
}
