import { Page } from "playwright";
import { navigateAndWait, blockHeavyAssets } from "../actions/navigate";
import { fill } from "../actions/interact";

const BASE = "https://eurocookflow.com";

export interface LoginResult {
  success: boolean;
  finalUrl: string;
  /** Set when success is false */
  errorMessage?: string;
}

/**
 * Flow 2 — Login
 *
 * Navigates to /auth/sign-in, fills the login form, submits, and
 * validates the outcome.
 *
 * Validation:
 *   - Success: redirected away from /auth/sign-in into /app/*
 *   - Failure: stays on /auth/sign-in with a validation/auth error visible
 */
export async function login(
  page: Page,
  username: string,
  password: string,
): Promise<LoginResult> {
  await blockHeavyAssets(page);

  // ----- 1. Navigate and wait for the login form -----
  // Simulate arriving from the site's homepage (natural path: browse -> login).
  await navigateAndWait(
    page,
    BASE + "/auth/sign-in",
    'form:has(input[type="email"]):has(input[type="password"])',
    BASE + "/",
  );

  // ----- 2. Fill credentials -----
  await fill(page, 'input[type="email"]', username);
  await page.waitForTimeout(400);
  await fill(page, 'input[type="password"]', password);
  await page.waitForTimeout(300);

  // ----- 3. Submit and wait for navigation -----
  const submit = page
    .locator('button:has-text("Sign In"), button[type="submit"]')
    .first();
  await submit.click();
  await page.waitForLoadState("networkidle", { timeout: 20_000 });

  const finalUrl = page.url();

  // ----- 4. Validate outcome -----
  if (finalUrl.includes("/auth/sign-in")) {
    // Still on sign-in page -> check for visible validation/auth message.
    const errorMessage = await page
      .textContent('[role="alert"], [class*="error"], [class*="invalid"]')
      .catch(() => "Unknown login error");
    return {
      success: false,
      finalUrl,
      errorMessage: errorMessage ?? undefined,
    };
  }

  if (!finalUrl.includes("/app/")) {
    return {
      success: false,
      finalUrl,
      errorMessage: "Redirected to a non-app route after sign in",
    };
  }

  return { success: true, finalUrl };
}
