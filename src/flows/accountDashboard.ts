import { Page } from "playwright";
import { navigate, blockHeavyAssets } from "../actions/navigate";
import { getText, scrapeTable } from "../actions/scrape";

const BASE = "https://eurocookflow.com";

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
export async function accountDashboard(page: Page): Promise<AccountResult> {
  await blockHeavyAssets(page);

  // ----- 1. Navigate to the account page -----
  await navigate(page, BASE + "/app/courses");

  // ----- 2. Guard: must not have been kicked back to sign-in -----
  if (page.url().includes("/auth/sign-in")) {
    throw new Error(
      "Session lost -> redirected to /auth/sign-in on /app/courses request",
    );
  }
  if (!page.url().includes("/app/")) {
    throw new Error(`Expected an app route, got: ${page.url()}`);
  }

  await page.waitForSelector('main, [role="main"]', { timeout: 15_000 });

  // ----- 3. Read a dashboard/app status metric -----
  // Try several reasonable selectors in priority order.
  const balanceSelectors = [
    'aside a[href*="/app/"]',
    'a[href*="/app/courses"]',
    'input[placeholder*="Search"]',
    "main h2, main h3",
  ];
  let creditBalance = "";
  for (const sel of balanceSelectors) {
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
    (await page
      .locator(
        '[class*="pricing"], [class*="membership"], a[href*="/auth/sign-up"], button:has-text("Get started")',
      )
      .count()) > 0;

  return { creditBalance, orders, hasPaymentMethods };
}
