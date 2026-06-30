/**
 * injectSimilarwebVisit — Inject a Mixpanel mp_page_view event directly into
 * SimilarWeb's analytics pipeline.
 *
 * WHY THIS WORKS:
 *   SimilarWeb's public extension (v6.12.19) loads Mixpanel SDK (token 7ccb86...)
 *   in the service worker, but only fires lifecycle events (install/update).
 *   By sending page_view events with the same token + event format, we feed
 *   SimilarWeb's Mixpanel project directly.
 *
 * The event format mirrors what mixpanel-js sends natively:
 *   POST https://api.mixpanel.com/track
 *   [{ event: "mp_page_view", properties: { mp_page, mp_referrer, token, ... } }]
 *
 * IMPORTANT: We make the POST request from Node.js (axios), NOT from the browser
 * page context, because:
 *   - Mixpanel's /track endpoint does NOT set CORS headers for arbitrary origins
 *   - Service worker fetch() has no CORS restrictions, but we don't control the SW
 *   - Node.js axios has no CORS restrictions
 *   - We can verify the response (returns "1" on success, "0" on failure)
 */

import axios from "axios";

// SimilarWeb's production Mixpanel project token (extracted from extension v6.12.19)
const MIXPANEL_TOKEN = "7ccb86f5c2939026a4b5de83b5971ed9";

// Mixpanel track endpoints — try the SDK endpoint first (used by mixpanel-js in
// browser contexts), fall back to the extension's endpoint (used in SW context)
const MIXPANEL_ENDPOINTS = [
  "https://api-js.mixpanel.com/track",
  "https://api.mixpanel.com/track",
];

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
  statusCode: number | null;
  responseBody: string | null;
}

export function buildMixpanelEvent(
  url: string,
  opts?: {
    referrer?: string;
    sessionId?: string;
    token?: string;
  },
): object {
  const now = Math.floor(Date.now() / 1000);
  const sessionId = opts?.sessionId ?? uuid();
  const referrer = opts?.referrer ?? "";

  return {
    event: "mp_page_view",
    properties: {
      // Standard Mixpanel properties
      token: opts?.token ?? MIXPANEL_TOKEN,
      distinct_id: sessionId,
      $device_id: sessionId,
      $insert_id: uuid(),
      time: now,

      // Page context
      mp_page: url,
      mp_referrer: referrer,
      mp_browser: "Chrome",
      mp_browser_version: "135.0.0.0",

      // Mixpanel people properties
      $os: "MacIntel",
      $screen_width: 1280,
      $screen_height: 800,

      // Device / session stitching
      $user_id: sessionId,
      $device: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/135.0.0.0 Safari/537.36`,

      // Extension-specific (to blend in with real SimilarWeb extension events)
      browser: "chrome",
      version: "6.12.19",
    },
  };
}

/**
 * Post a single Mixpanel event from Node.js (no CORS issues).
 *
 * @returns true if Mixpanel confirmed receipt (response "1"), false otherwise
 */
async function postToMixpanel(
  event: object,
  endpoint: string,
  timeoutMs: number = 10_000,
): Promise<{ ok: boolean; statusCode: number | null; body: string | null }> {
  try {
    const body = JSON.stringify([event]);

    const response = await axios.post(endpoint, body, {
      headers: {
        "Content-Type": "application/json",
        Accept: "text/plain",
      },
      timeout: timeoutMs,
      // Don't transform — we need the raw response text
      transformResponse: [(data) => data],
      // Validate status: accept any 2xx
      validateStatus: (status) => status >= 200 && status < 300,
    });

    const text = response.data?.trim?.() ?? String(response.data);
    const ok = text === "1";

    return {
      ok,
      statusCode: response.status,
      body: text,
    };
  } catch (error: any) {
    if (error?.response) {
      // Got a valid HTTP response (non-2xx)
      const statusCode = error.response.status;
      const body = error.response.data?.trim?.() ?? String(error.response.data ?? "");
      return { ok: false, statusCode, body };
    }
    // Network error (no response)
    const msg = error?.message ?? String(error);
    return { ok: false, statusCode: null, body: msg };
  }
}

/**
 * Inject a Mixpanel mp_page_view event into SimilarWeb's project.
 * The request is made from Node.js (not browser context) to avoid CORS issues.
 *
 * @param url - Full page URL to report (e.g. "https://guidenza.com/pricing")
 * @param opts - Optional overrides
 */
export async function injectSimilarwebVisit(
  page: any, // Patchright Page - kept for API compatibility, not used for the POST
  url: string,
  opts?: {
    referrer?: string;
    sessionId?: string;
  },
): Promise<InjectedVisitResult> {
  try {
    const domain = new URL(url).hostname;
    const event = buildMixpanelEvent(url, opts);

    // Try each endpoint in order, stop on first success
    for (const endpoint of MIXPANEL_ENDPOINTS) {
      const result = await postToMixpanel(event, endpoint);

      if (result.ok) {
        console.log(
          `  [visit-inject] ✓ ${domain}: Mixpanel mp_page_view injected via ${endpoint}`,
        );
        return {
          domain,
          injected: true,
          method: `node-axios:${endpoint.replace("https://", "")}`,
          error: null,
          statusCode: result.statusCode,
          responseBody: result.body,
        };
      }

      console.log(
        `  [visit-inject] ⚠ ${domain}: ${endpoint} returned status=${result.statusCode} body=${result.body?.slice(0, 100)}`,
      );
    }

    // All endpoints failed
    return {
      domain,
      injected: false,
      method: `node-axios:all-endpoints-exhausted`,
      error: `All Mixpanel endpoints failed`,
      statusCode: null,
      responseBody: null,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`  [visit-inject] ✗ ${url}: ${msg}`);
    return {
      domain: url,
      injected: false,
      method: "node-axios",
      error: msg,
      statusCode: null,
      responseBody: null,
    };
  }
}

/**
 * Send a batch of Mixpanel mp_page_view events.
 * Call this after navigating to each page on the target site.
 * More pages per session = more natural signal.
 *
 * Uses a consistent sessionId across all events in the batch so they're
 * stitched together in Mixpanel.
 */
export async function injectSimilarwebBatch(
  page: any,
  urls: string[],
  sessionId?: string,
): Promise<InjectedVisitResult[]> {
  const sid = sessionId ?? uuid();
  const results: InjectedVisitResult[] = [];
  for (const url of urls) {
    const result = await injectSimilarwebVisit(page, url, { sessionId: sid });
    results.push(result);
    // Small delay between injections to appear natural
    await new Promise((r) => setTimeout(r, 500 + Math.random() * 1500));
  }
  return results;
}
