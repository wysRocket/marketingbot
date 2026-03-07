import { Page } from "playwright";

const BLOCKED_PATTERNS = [
  // Images and fonts
  "*.png",
  "*.jpg",
  "*.jpeg",
  "*.webp",
  "*.avif",
  "*.gif",
  "*.svg",
  "*.ico",
  "*.woff",
  "*.woff2",
  "*.ttf",
  "*.otf",
  // Media and tracking endpoints
  "*.mp4",
  "*.webm",
  "*.mp3",
];

const pagesWithBlocking = new WeakSet<Page>();

/**
 * Block heavy/tracking URLs via CDP (without Playwright routing),
 * preserving browser HTTP cache behavior across navigations.
 */
export async function blockHeavyAssets(page: Page): Promise<void> {
  if (pagesWithBlocking.has(page)) return;

  const session = await page.context().newCDPSession(page);
  await session.send("Network.enable");
  await session.send("Network.setBlockedURLs", { urls: BLOCKED_PATTERNS });

  pagesWithBlocking.add(page);
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
  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
    referer,
  });
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
