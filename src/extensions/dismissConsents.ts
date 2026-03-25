// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyContext = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const chrome: any;

// ---------------------------------------------------------------------------
// SimilarWeb consent auto-dismisser
//
// On first launch in a fresh userDataDir, SimilarWeb opens two unsolicited
// UI surfaces:
//
//   1. A welcome tab at https://www.similarweb.com/corp/extension-welcome-chrome/
//      — triggered by the `onInstalled` handler in background.js.
//
//   2. The extension's own options page (chrome-extension://.../options.html)
//      — which shows checkboxes for "autoIcon" (IS_OPTED_IN) and collectData.
//
// Both are closed automatically and the relevant chrome.storage.local keys are
// pre-seeded via the extension's service worker so the extension never prompts
// again on subsequent sessions in the same userDataDir.
//
// We deliberately disable data collection (autoIcon=false, isTrackingDisabled=true)
// so the extension is present for fingerprint realism but sends no telemetry.
// ---------------------------------------------------------------------------

/** URL substrings that identify SimilarWeb-owned tabs to close automatically. */
const CLOSE_URL_PATTERNS = [
  "similarweb.com/corp/extension-welcome",
  "similarweb.com/corp/extension-onboard",
  "similarweb.com/corp/extension-install",
];

/**
 * Storage keys written to chrome.storage.local to mark consent as already
 * handled and disable data-collection features we don't want the extension
 * to use while the bot is running.
 *
 * Key names come from the extension's own constants object:
 *   IS_OPTED_IN         → "autoIcon"
 *   IS_TRACKING_DISABLED→ "isTrackingDisabled"
 *   OPEN_IN_BG          → "openInBg"
 */
const CONSENT_STORAGE: Record<string, unknown> = {
  autoIcon: false,          // IS_OPTED_IN=false → no icon-rank feature
  isTrackingDisabled: true, // disable analytics/telemetry from the extension
  openInBg: false,
};

/**
 * Attach consent-dismissal logic to a newly created BrowserContext.
 *
 * Call this immediately after `launchPersistentContext()` or `newContext()`,
 * before opening any pages.  It installs a page listener (to close welcome
 * tabs) and pre-seeds chrome.storage via the service worker (to skip future
 * consent prompts).
 *
 * Safe to call on every session: if storage is already seeded the
 * `chrome.storage.local.set` call is a no-op, and the page listener is
 * lightweight.
 */
export async function dismissSimilarWebConsents(
  context: AnyContext,
): Promise<void> {
  // ── 1. Close welcome / onboarding tabs automatically ────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context.on("page", (page: any) => {
    page
      .waitForLoadState("domcontentloaded", { timeout: 5_000 })
      .then(() => {
        const url = page.url();
        const shouldClose = CLOSE_URL_PATTERNS.some((pat) =>
          url.includes(pat),
        );
        if (shouldClose) {
          void page.close();
        }
      })
      .catch(() => {
        // Non-critical — ignore timeouts or already-closed pages.
      });
  });

  // ── 2. Also close the options page if it opens as a tab ─────────────────
  // The background worker opens options.html when the user has not yet set
  // the consent checkboxes.  We close it immediately and rely on the storage
  // seed below to prevent it from re-opening.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context.on("page", (page: any) => {
    page
      .waitForLoadState("domcontentloaded", { timeout: 5_000 })
      .then(() => {
        if (page.url().includes("options.html")) {
          void page.close();
        }
      })
      .catch(() => {});
  });

  // ── 3. Pre-seed chrome.storage via the extension's service worker ────────
  // In MV3 extensions the background is a service worker, not a background
  // page.  Playwright exposes it via context.serviceWorkers().
  //
  // We try up to 2 s for the worker to register (it may not be ready yet on
  // the very first launch of a fresh profile), then give up gracefully so we
  // never block session startup.
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
        .evaluate((storage: Record<string, unknown>) => {
          return new Promise<void>((resolve) => {
            chrome.storage.local.set(storage, () => resolve());
          });
        }, CONSENT_STORAGE)
        .catch(() => {
          // Non-critical — the page-close listener above still handles the UI.
        });
    }
  } catch {
    // Service worker not available (e.g. no extensions loaded) — skip silently.
  }
}
