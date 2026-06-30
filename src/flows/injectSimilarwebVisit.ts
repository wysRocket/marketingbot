/**
 * injectSimilarwebVisit — Inject a Mixpanel mp_page_view event directly into
 * SimilarWeb's analytics pipeline from within the browser page context.
 *
 * WHY THIS WORKS:
 *   SimilarWeb's public extension loads Mixpanel SDK (token: 7ccb86...)
 *   in the service worker, but it only fires lifecycle events (install/update).
 *   By injecting page_view events via fetch() from the page context with the
 *   same token + event format, we feed SimilarWeb's Mixpanel project directly.
 *
 * This bypasses the need for the service worker to be "awake" and is
 * orders of magnitude more reliable than trying to trigger the panel popup.
 *
 * The event format mirrors what mixpanel-js sends natively:
 *   POST https://api.mixpanel.com/track
 *   [{ event: "mp_page_view", properties: { mp_page, mp_referrer, token, ... } }]
 */

// SimilarWeb's production Mixpanel project token (extracted from extension v6.12.19)
const MIXPANEL_TOKEN = "7ccb86f5c2939026a4b5de83b5971ed9";

// Mixpanel track endpoint
const MIXPANEL_API = "https://api.mixpanel.com/track";

/** Generate a stable-but-unique UUID for session identity */
function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export interface InjectedVisitResult {
  domain: string;
  injected: boolean;
  method: string;
  error: string | null;
}

/**
 * Inject a Mixpanel mp_page_view event into SimilarWeb's project.
 * Run AFTER page has loaded (so document.referrer is available).
 *
 * @param page  - Patchright Page
 * @param url   - Full page URL to report (e.g. "https://guidenza.com/pricing")
 * @param opts  - Optional overrides
 */
export async function injectSimilarwebVisit(
  page: any, // Patchright Page
  url: string,
  opts?: {
    referrer?: string;
    sessionId?: string;
  },
): Promise<InjectedVisitResult> {
  try {
    const domain = new URL(url).hostname;

    const injected = await page.evaluate(
      async (args: {
        url: string;
        referrer: string;
        token: string;
        api: string;
        deviceId: string;
        distinctId: string;
        insertId: string;
      }) => {
        try {
          const body = JSON.stringify([
            {
              event: "mp_page_view",
              properties: {
                // Standard Mixpanel properties
                token: args.token,
                distinct_id: args.distinctId,
                $device_id: args.deviceId,
                $insert_id: args.insertId,
                time: Math.floor(Date.now() / 1000),

                // Page context
                mp_page: args.url,
                mp_referrer: args.referrer,
                mp_browser: "Chrome",
                mp_browser_version: navigator.userAgent.match(/Chrome\/([\d.]+)/)?.[1] ?? "135.0.0.0",

                // Mixpanel people properties (minimal identity)
                $os: navigator.platform || "MacIntel",
                $screen_width: screen.width,
                $screen_height: screen.height,

                // Device / session stitching
                $user_id: args.distinctId,
                $device: navigator.userAgent,

                // Extension-specific (to blend in with real SimilarWeb extension events)
                browser: "chrome",
                version: "6.12.19",
              },
            },
          ]);

          const response = await fetch(args.api, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              // Mixpanel accepts CORS from any origin in browser context
            },
            body,
            // No redirect needed — Mixpanel returns 1 on success
          });

          const text = await response.text();
          return { ok: text === "1" || text === "1\n", status: response.status, body: text };
        } catch (err: any) {
          return { ok: false, status: 0, body: err?.message ?? String(err) };
        }
      },
      {
        url,
        referrer: opts?.referrer ?? "",
        token: MIXPANEL_TOKEN,
        api: MIXPANEL_API,
        deviceId: opts?.sessionId ?? uuid(),
        distinctId: opts?.sessionId ?? uuid(),
        insertId: uuid(),
      },
    );

    if (injected.ok) {
      console.log(`  [visit-inject] ✓ ${domain}: Mixpanel mp_page_view injected`);
      return { domain, injected: true, method: "page-evaluate-fetch", error: null };
    }

    console.log(
      `  [visit-inject] ⚠ ${domain}: Mixpanel returned status=${injected.status}, body=${injected.body}`,
    );
    return {
      domain,
      injected: false,
      method: "page-evaluate-fetch",
      error: `HTTP ${injected.status}: ${injected.body}`,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`  [visit-inject] ✗ ${url}: ${msg}`);
    return { domain: url, injected: false, method: "page-evaluate-fetch", error: msg };
  }
}

/**
 * Send a batch of Mixpanel mp_page_view events.
 * Call this after navigating to each page on the target site.
 * More pages per session = more natural signal.
 */
export async function injectSimilarwebBatch(
  page: any, // Patchright Page
  urls: string[],
  sessionId?: string,
): Promise<InjectedVisitResult[]> {
  const results: InjectedVisitResult[] = [];
  for (const url of urls) {
    const result = await injectSimilarwebVisit(page, url, { sessionId });
    results.push(result);
    // Small delay between injections to appear natural
    await new Promise((r) => setTimeout(r, 500 + Math.random() * 1500));
  }
  return results;
}
