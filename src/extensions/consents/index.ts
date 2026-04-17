// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyContext = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const chrome: any;

import { buildSimilarWebSeedState } from "./similarweb";

const CLOSE_URL_PATTERNS = [
  "similarweb.com/corp/extension-welcome",
  "similarweb.com/corp/extension-onboard",
  "similarweb.com/corp/extension-install",
];

export async function dismissAllConsents(context: AnyContext): Promise<void> {
  // Close SimilarWeb welcome/onboarding tabs
  context.on("page", (page: AnyContext) => {
    page
      .waitForLoadState("domcontentloaded", { timeout: 5_000 })
      .then(() => {
        const url = page.url();
        const shouldClose =
          CLOSE_URL_PATTERNS.some((pat) => url.includes(pat)) ||
          url.includes("options.html");
        if (shouldClose) {
          void page.close();
        }
      })
      .catch(() => {});
  });

  // Pre-seed SimilarWeb storage via service worker
  try {
    let worker =
      context.serviceWorkers().length > 0
        ? context.serviceWorkers()[0]
        : null;

    if (!worker) {
      worker = await Promise.race([
        context
          .waitForEvent("serviceworker", { timeout: 2_000 })
          .catch(() => null),
      ]);
    }

    if (worker) {
      await worker
        .evaluate((payload: Record<string, unknown>) => {
          return new Promise<void>((resolve) => {
            chrome.storage.local.set(payload, () => resolve());
          });
        }, buildSimilarWebSeedState())
        .catch(() => {});
    }
  } catch {
    // Service worker not available — skip silently.
  }
}
