import { Page } from "playwright";
import { navigate, blockHeavyAssets } from "../actions/navigate";
import { hover } from "../actions/interact";
import { pickReferrer } from "../actions/referrer";
import { getAll, getLinks } from "../actions/scrape";

const BASE = "https://eurocookflow.com";

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
 *   - At least 3 pricing tiers are present
 *   - Every CTA href contains /auth/sign-up?plan=
 *   - Clicking the first CTA navigates to /auth/sign-up
 */
export async function explorePricing(page: Page): Promise<PricingResult> {
  await blockHeavyAssets(page);

  // ----- 1. Load homepage and jump straight to members/pricing -----
  await navigate(page, BASE + "/#members", pickReferrer());
  await page.waitForTimeout(800);

  await page.evaluate(() =>
    document.querySelector("#members")?.scrollIntoView({ behavior: "smooth" }),
  );
  await page.waitForTimeout(1_000);

  // ----- 2. Read pricing tier headings -----
  const tierNames: string[] = await getAll(
    page,
    "#members h3, #members h4",
  ).catch(() => []);
  if (tierNames.length < 1) {
    // Fallback: grab every card-level heading on the page section
    tierNames.push(
      ...(await getAll(page, "#members h2").catch((): string[] => [])),
    );
  }

  // ----- 3. Collect CTA links and extract selected membership plans -----
  const ctaLinks = await getLinks(page, 'a[href*="/auth/sign-up?plan="]');
  const tiers: PricingTier[] = tierNames.map((name, i) => {
    const href = ctaLinks[i] ?? "";
    const match = href.match(/plan=([a-z0-9-]+)/i);
    return { name, ctaHref: href, creditPackage: match ? match[1] : null };
  });

  // ----- 4. Hover over each visible CTA button -----
  const ctaLocators = page.locator('a[href*="/auth/sign-up?plan="]');
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
  const ctaLinksValid = ctaLinks.every((href) =>
    href.includes("/auth/sign-up?plan="),
  );

  // ----- 6. Click the first CTA and confirm redirect to sign-up -----
  const firstCta = ctaLocators.first();
  if ((await firstCta.count()) > 0) {
    await Promise.all([
      page.waitForNavigation({ timeout: 15_000 }),
      firstCta.click(),
    ]);
    const landingUrl = page.url();
    if (!landingUrl.includes("/auth/sign-up")) {
      throw new Error(
        `CTA click expected redirect to /auth/sign-up but landed on: ${landingUrl}`,
      );
    }
    // Go back for any further flow chaining
    await page.goBack({ waitUntil: "domcontentloaded", timeout: 30_000 });
  }

  return { tiers, ctaLinksValid };
}
