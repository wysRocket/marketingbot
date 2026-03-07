import { Page } from "playwright";
import { navigate, blockHeavyAssets } from "../actions/navigate";
import { fill } from "../actions/interact";
import {
  assertFlowEnabled,
  getActiveSiteProfile,
  resolveSiteUrl,
  type SiteProfile,
} from "../sites";

export interface LoginResult {
  success: boolean;
  finalUrl: string;
  /** Set when success is false */
  errorMessage?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractApiErrorMessage(payload: Record<string, unknown>): string | undefined {
  const emptyGroups = payload.empty_groups;
  if (isRecord(emptyGroups)) {
    const defaultMsg = emptyGroups.default;
    if (typeof defaultMsg === "string" && defaultMsg.trim()) {
      return defaultMsg.trim();
    }

    for (const value of Object.values(emptyGroups)) {
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
  }

  const msg = payload.msg;
  if (typeof msg === "string" && msg.trim()) {
    return msg.trim();
  }

  const message = payload.message;
  if (typeof message === "string" && message.trim()) {
    return message.trim();
  }

  return undefined;
}

/**
 * Flow 2 — Login
 *
 * Supports both route-based login pages and modal/AJAX login forms.
 */
export async function login(
  page: Page,
  username: string,
  password: string,
  site: SiteProfile = getActiveSiteProfile(),
): Promise<LoginResult> {
  assertFlowEnabled(site, "login");

  const cfg = site.login;
  await blockHeavyAssets(page);

  // ----- 1. Navigate to login entry point -----
  await navigate(page, resolveSiteUrl(site, cfg.loginPath), resolveSiteUrl(site, "/"));

  // For modal-based auth, open the login modal if the form is not visible yet.
  if (cfg.openLoginSelector) {
    const isFormVisible = await page
      .locator(cfg.loginFormSelector)
      .first()
      .isVisible()
      .catch(() => false);

    if (!isFormVisible) {
      const opener = page.locator(cfg.openLoginSelector).first();
      await opener.waitFor({ state: "visible", timeout: 15_000 });
      await opener.click();
    }
  }

  await page.waitForSelector(cfg.loginFormSelector, {
    state: "visible",
    timeout: 15_000,
  });

  // ----- 2. Fill credentials -----
  await fill(page, cfg.emailSelector, username);
  await page.waitForTimeout(400);
  await fill(page, cfg.passwordSelector, password);
  await page.waitForTimeout(300);

  // ----- 3. Submit and capture login response (if configured) -----
  const submit = page.locator(cfg.submitSelector).first();

  const loginResponsePromise = cfg.submitResponseUrlIncludes
    ? page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          response.url().includes(cfg.submitResponseUrlIncludes as string),
        { timeout: 20_000 },
      )
    : null;

  await submit.click();

  let apiPayload: Record<string, unknown> | undefined;
  let apiRawResponse = "";

  if (loginResponsePromise) {
    try {
      const response = await loginResponsePromise;
      apiRawResponse = await response.text().catch(() => "");

      try {
        const parsed = JSON.parse(apiRawResponse) as unknown;
        if (isRecord(parsed)) {
          apiPayload = parsed;
        }
      } catch {
        // Non-JSON response, handled by fallback checks below.
      }
    } catch {
      // If response capture fails, continue with URL/DOM-based checks.
    }
  }

  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {
    // AJAX login may not trigger a full page load state transition.
  });

  const finalUrl = page.url();

  // ----- 4. Validate outcome -----
  if (apiPayload) {
    const apiErrorFlag = apiPayload.error;
    if (typeof apiErrorFlag === "boolean" && apiErrorFlag) {
      return {
        success: false,
        finalUrl,
        errorMessage:
          extractApiErrorMessage(apiPayload) ?? "Login request returned an error",
      };
    }
  } else if (/"error"\s*:\s*true/i.test(apiRawResponse)) {
    return {
      success: false,
      finalUrl,
      errorMessage: "Login request returned an error",
    };
  }

  const stayedOnFailureRoute = cfg.failureUrlIncludes.some((value) =>
    finalUrl.includes(value),
  );
  if (stayedOnFailureRoute) {
    const errorMessage = await page
      .textContent(cfg.errorSelector)
      .catch(() => "Unknown login error");
    return {
      success: false,
      finalUrl,
      errorMessage: errorMessage ?? undefined,
    };
  }

  if (
    cfg.successUrlIncludes.length > 0 &&
    !cfg.successUrlIncludes.some((value) => finalUrl.includes(value))
  ) {
    return {
      success: false,
      finalUrl,
      errorMessage: "Redirected to an unexpected route after sign in",
    };
  }

  return { success: true, finalUrl };
}
