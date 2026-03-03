import { Page } from "playwright";

/**
 * Register a route handler that aborts font and image requests for the
 * lifetime of this page. Call once before the first navigation in a flow
 * to reduce proxy bandwidth.
 */
export async function blockHeavyAssets(page: Page): Promise<void> {
  await page.route("**/*", (route) => {
    const type = route.request().resourceType();
    if (type === "font" || type === "image") {
      route.abort();
    } else {
      route.continue();
    }
  });
}

/**
 * Navigate to a URL and wait until the network is idle.
 * Pass `referer` to set the HTTP Referer header for this navigation
 * (also sets `document.referrer` in the page's JS context).
 */
export async function navigate(
  page: Page,
  url: string,
  referer?: string,
): Promise<void> {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000, referer });
}

/**
 * Navigate and wait for a specific selector to appear before continuing.
 */
export async function navigateAndWait(
  page: Page,
  url: string,
  selector: string,
  referer?: string,
): Promise<void> {
  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
    referer,
  });
  await page.waitForSelector(selector, { timeout: 15_000 });
}
