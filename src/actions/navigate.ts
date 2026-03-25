import { Page } from "playwright";

// ---------------------------------------------------------------------------
// GA4 engagement visibility script
//
// In headless Playwright, document.visibilityState can be "hidden" for tabs
// that are not the active foreground tab.  GA4's gtag.js only runs its
// 10-second engagement timer — and therefore only sets session_engaged=1 —
// when visibilityState is "visible".  If the state stays "hidden" for the
// whole session GA4 records every session as a bounce even when the bot
// dwells on the page for minutes.
//
// This init script is injected once per page object (before any navigation)
// so it applies to every URL the page visits.  It overrides the standard
// Visibility API properties to always report "visible", then fires the
// events that GA4 listens to immediately after DOMContentLoaded so the
// engagement timer starts as early as possible.
// ---------------------------------------------------------------------------
const GA4_VISIBILITY_SCRIPT = `(function () {
  try {
    Object.defineProperty(document, 'visibilityState', {
      get: function () { return 'visible'; },
      configurable: true,
    });
    Object.defineProperty(document, 'hidden', {
      get: function () { return false; },
      configurable: true,
    });
  } catch (_) { /* already non-configurable in this context */ }

  function fireEngagementEvents() {
    try { document.dispatchEvent(new Event('visibilitychange')); } catch (_) {}
    try { window.dispatchEvent(new Event('focus')); } catch (_) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fireEngagementEvents);
  } else {
    fireEngagementEvents();
  }
})();`;

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

  // Inject the GA4 visibility script so every page this Page object navigates
  // to reports visibilityState='visible' and fires the engagement events that
  // start GA4's 10-second session_engaged timer.
  await page.addInitScript(GA4_VISIBILITY_SCRIPT);

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
  // Bring the page to front before navigating so the browser considers it the
  // active tab.  This matters most in SHARED_BROWSER_MODE where multiple Page
  // objects share one browser instance — the OS-level focus still belongs to
  // whichever tab last called bringToFront(), which affects document.hasFocus()
  // and reinforces the visibilityState='visible' override above.
  await page.bringToFront().catch(() => {});

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
