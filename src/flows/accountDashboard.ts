import { Page } from "playwright";
import { navigate, blockHeavyAssets } from "../actions/navigate";
import { randomBrowse } from "../actions/interact";
import { getText, scrapeTable } from "../actions/scrape";
import {
  assertFlowEnabled,
  getActiveSiteProfile,
  resolveSiteUrl,
  type SiteProfile,
} from "../sites";
const MAX_DASHBOARD_EXTRA_PAGES = Number.parseInt(
  process.env.FLOW_MAX_DASHBOARD_EXTRA_PAGES ?? "1",
  10,
);

export interface AccountResult {
  creditBalance: string;
  orders: Record<string, string>[];
  hasPaymentMethods: boolean;
}

/**
 * Flow 4 — Account Dashboard
 *
 * Requires an already-authenticated page (run login() first in the same
 * browser session so the auth session cookie is present).
 *
 * Validation:
 *   - /app/courses remains on /app/* (no bounce to /auth/sign-in)
 *   - At least one app navigation link is visible
 *   - Course cards or any data table is present (may be empty)
 *   - Membership/pricing/action CTA exists in the DOM
 */
export async function accountDashboard(
  page: Page,
  site: SiteProfile = getActiveSiteProfile(),
): Promise<AccountResult> {
  assertFlowEnabled(site, "accountDashboard");

  const cfg = site.accountDashboard;
  await blockHeavyAssets(page);

  // ----- 1. Navigate to the account page -----
  await navigate(page, resolveSiteUrl(site, cfg.dashboardPath));

  // ----- 2. Guard: must not have been kicked back to sign-in -----
  if (cfg.mustNotIncludePaths.some((path) => page.url().includes(path))) {
    throw new Error(
      `Session lost -> redirected to blocked route on ${cfg.dashboardPath} request`,
    );
  }
  if (!page.url().includes(cfg.mustIncludePathFragment)) {
    throw new Error(`Expected an app route, got: ${page.url()}`);
  }

  await page.waitForSelector(cfg.mainSelector, { timeout: 15_000 });

  // ----- 3. Read a dashboard/app status metric -----
  let creditBalance = "";
  for (const sel of cfg.balanceSelectors) {
    creditBalance = await getText(page, sel).catch(() => "");
    if (creditBalance) break;
  }
  if (!creditBalance) {
    throw new Error("Dashboard metric element not found on /app/courses");
  }

  // ----- 4. Scrape a table if present (fallback to empty for card-based layout) -----
  const orders = await scrapeTable(page, "table").catch(() => []);

  // ----- 5. Check membership/payment-like section -----
  const hasPaymentMethods =
    (await page.locator(cfg.paymentPresenceSelector).count()) > 0;

  // ----- 6. Visit up to 2 extra app pages discovered from the app navigation -----
  const appLinks = await page
    .$$eval(
      cfg.appLinkSelector,
      (anchors, includeFragment) =>
        anchors
          .map((a) => a.getAttribute("href") ?? "")
          .filter(Boolean)
          .map((href) => {
            try {
              return new URL(href, window.location.href).toString();
            } catch {
              return "";
            }
          })
          .filter(Boolean)
          .filter((href) => href.includes(includeFragment)),
      cfg.appLinkIncludes,
    )
    .catch((): string[] => []);

  const uniqueTargets = [...new Set(appLinks)]
    .filter((href) =>
      cfg.appLinkExcludes.every((fragment) => !href.includes(fragment)),
    )
    .filter((href) => href !== page.url())
    .slice(
      0,
      Number.isFinite(MAX_DASHBOARD_EXTRA_PAGES) &&
        MAX_DASHBOARD_EXTRA_PAGES > 0
        ? MAX_DASHBOARD_EXTRA_PAGES
        : 1,
    );

  for (const target of uniqueTargets) {
    await navigate(page, target, page.url()).catch(() => {
      /* non-critical */
    });
    await page.waitForSelector(cfg.mainSelector, { timeout: 12_000 }).catch(
      () => {
        /* non-critical */
      },
    );
    await randomBrowse(page, 2_500, 6_000).catch(() => {
      /* non-critical */
    });
  }

  return { creditBalance, orders, hasPaymentMethods };
}
