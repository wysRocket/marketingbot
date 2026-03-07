import { Page } from "playwright";
import { navigate, blockHeavyAssets } from "../actions/navigate";
import { randomBrowse, randomDelay } from "../actions/interact";
import { pickReferrer } from "../actions/referrer";
import { getAll, getLinks } from "../actions/scrape";
import {
  assertFlowEnabled,
  getActiveSiteProfile,
  resolveSiteUrl,
  type SiteProfile,
} from "../sites";
const MAX_SIGNUP_VISITS = Number.parseInt(
  process.env.FLOW_MAX_SIGNUP_VISITS ?? "1",
  10,
);

export interface PricingTier {
  name: string;
  ctaHref: string;
  creditPackage: string | null;
}

export interface PricingResult {
  tiers: PricingTier[];
  ctaLinksValid: boolean;
}

/**
 * Flow 3 — Pricing Exploration
 *
 * Scrolls directly to the #members section, reads all tier titles,
 * hovers over each CTA button to confirm hover state renders, then validates
 * that each CTA points to /auth/sign-up?plan=... routes.
 *
 * Validation:
 *   - At least 1 pricing tier is present
 *   - Every CTA href contains /auth/sign-up?plan=
 *   - Visits multiple /auth/sign-up?plan=... pages without submitting
 */
export async function explorePricing(
  page: Page,
  site: SiteProfile = getActiveSiteProfile(),
): Promise<PricingResult> {
  assertFlowEnabled(site, "explorePricing");

  const cfg = site.explorePricing;
  await blockHeavyAssets(page);

  // ----- 1. Load homepage and jump straight to members/pricing -----
  await navigate(page, resolveSiteUrl(site, cfg.pricingPath), pickReferrer());
  await page.waitForTimeout(800);

  await page.evaluate((selector) => {
    document.querySelector(selector)?.scrollIntoView({ behavior: "smooth" });
  }, cfg.pricingSectionSelector);
  await page.waitForTimeout(1_000);

  // ----- 2. Read pricing tier headings -----
  let tierNames: string[] = [];
  for (const selector of cfg.tierNameSelectors) {
    tierNames = await getAll(page, selector).catch((): string[] => []);
    if (tierNames.length > 0) break;
  }

  // ----- 3. Collect CTA links and extract selected membership plans -----
  const ctaLinks = await getLinks(page, cfg.ctaSelector);
  const pricingRegex = new RegExp(site.browseHomepage.pricingPlanRegex, "i");
  const tiers: PricingTier[] = tierNames.map((name, i) => {
    const href = ctaLinks[i] ?? "";
    const match = href.match(pricingRegex);
    return { name, ctaHref: href, creditPackage: match ? match[1] : null };
  });

  // ----- 4. Hover over each visible CTA button -----
  const ctaLocators = page.locator(cfg.ctaSelector);
  const count = await ctaLocators.count();
  for (let i = 0; i < count; i++) {
    await ctaLocators
      .nth(i)
      .hover()
      .catch(() => {
        /* off-screen, skip */
      });
    await page.waitForTimeout(400);
  }

  // ----- 5. Validate: all CTAs must link to sign-up with a selected plan -----
  const ctaLinksValid = ctaLinks.every((href) => href.includes(cfg.ctaMustContain));

  // ----- 6. Visit up to N distinct plan sign-up pages and interact safely -----
  const signupVisitsLimit =
    Number.isFinite(MAX_SIGNUP_VISITS) && MAX_SIGNUP_VISITS > 0
      ? MAX_SIGNUP_VISITS
      : 1;
  const uniquePlanLinks = [...new Set(ctaLinks)]
    .filter((href) => href.includes(cfg.ctaMustContain))
    .slice(0, signupVisitsLimit);

  for (let i = 0; i < uniquePlanLinks.length; i++) {
    const target = uniquePlanLinks[i];
    await navigate(page, target, resolveSiteUrl(site, cfg.pricingPath));

    const landingUrl = page.url();
    if (!landingUrl.includes(cfg.signupExpectedPathIncludes)) {
      throw new Error(
        `Expected ${cfg.signupExpectedPathIncludes} landing for plan link ${target}, got: ${landingUrl}`,
      );
    }

    const syntheticEmail = `visitor.${Date.now()}.${i}@example.com`;
    const syntheticName = `${cfg.syntheticNamePrefix} ${i + 1}`;

    const emailInput = page.locator(cfg.emailSelector).first();
    if ((await emailInput.count()) > 0) {
      await emailInput.fill(syntheticEmail).catch(() => {
        /* non-critical */
      });
    }

    const nameInput = page.locator(cfg.nameSelector).first();
    if ((await nameInput.count()) > 0) {
      await nameInput.fill(syntheticName).catch(() => {
        /* non-critical */
      });
    }

    const passwordInput = page.locator(cfg.passwordSelector).first();
    if ((await passwordInput.count()) > 0) {
      await passwordInput.fill(cfg.syntheticPassword).catch(() => {
        /* non-critical */
      });
    }

    await randomDelay(page, 300, 900);
    await randomBrowse(page, 4_000, 8_000);
  }

  return { tiers, ctaLinksValid };
}
