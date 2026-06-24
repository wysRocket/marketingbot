import axios from "axios";

/**
 * triggerSimilarwebFetch — Fetch Similarweb data for a domain using the
 * same API endpoint the extension uses: data.similarweb.com/api/v1/data
 *
 * REVERSE-ENGINEERING FINDINGS (Similarweb v6.12.19):
 *
 * The extension calls this API when the user opens the popup:
 *   fetch("https://data.similarweb.com/api/v1/data?domain=" + domain, {
 *     headers: { "Content-Type": "application/json", "X-Extension-Version": version },
 *     redirect: "follow"
 *   })
 *
 * The API is CloudFront-protected but accepts requests with:
 *   Origin: chrome-extension://<extension-id>
 *
 * This function makes the same call directly from Node.js, bypassing the
 * extension entirely. This is MORE RELIABLE than trying to trigger the
 * extension programmatically (which is impossible in Patchright because
 * chrome.runtime APIs are not available in page contexts).
 */

const SIMILARWEB_API = "https://data.similarweb.com/api/v1/data";
const EXTENSION_ID = "cbgieeklabamclkihcckkmgchnjbndld";
const EXTENSION_VERSION = "6.12.19";
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 2;
const RETRY_BASE_MS = 3_000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function randomDelay(): number {
  return 2_000 + Math.floor(Math.random() * 5_000);
}

export interface SimilarwebApiResult {
  domain: string;
  called: boolean;
  status: number | null;
  data: unknown | null;
  error: string | null;
}

/**
 * Call the Similarweb data API directly for a given domain.
 * Returns the raw JSON response from data.similarweb.com/api/v1/data.
 */
export async function triggerSimilarwebFetch(
  _page: unknown, // kept for API compatibility with warmupCookies signature
  domain: string,
): Promise<{ triggered: boolean; method: string }> {
  // Random initial delay to avoid burst rate limiting
  await sleep(randomDelay());

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await axios.get(SIMILARWEB_API, {
        params: { domain },
        headers: {
          "Content-Type": "application/json",
          "X-Extension-Version": EXTENSION_VERSION,
          "Origin": `chrome-extension://${EXTENSION_ID}`,
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
        },
        timeout: REQUEST_TIMEOUT_MS,
        validateStatus: () => true,
      });

      if (response.status === 200 && response.data) {
        console.log(
          `  [similarweb] ✓ ${domain}: status=${response.status}, ` +
            `rank=${response.data?.GlobalRank?.Rank ?? "N/A"}, ` +
            `visits=${response.data?.Engagments?.Visits ?? "N/A"}`,
        );
        return { triggered: true, method: "direct-api" };
      }

      // Retry on 403 with exponential backoff
      if (response.status === 403 && attempt < MAX_RETRIES) {
        const backoff = RETRY_BASE_MS * Math.pow(2, attempt) + Math.floor(Math.random() * 2000);
        console.log(`  [similarweb] ⏳ ${domain}: HTTP 403, retry ${attempt + 1}/${MAX_RETRIES} in ${backoff}ms`);
        await sleep(backoff);
        continue;
      }

      console.log(`  [similarweb] ✗ ${domain}: HTTP ${response.status}`);
      return { triggered: false, method: "direct-api" };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (attempt < MAX_RETRIES) {
        const backoff = RETRY_BASE_MS * Math.pow(2, attempt) + Math.floor(Math.random() * 2000);
        console.log(`  [similarweb] ⏳ ${domain}: ${msg}, retry ${attempt + 1}/${MAX_RETRIES} in ${backoff}ms`);
        await sleep(backoff);
        continue;
      }
      console.log(`  [similarweb] ✗ ${domain}: ${msg}`);
      return { triggered: false, method: "direct-api" };
    }
  }
  return { triggered: false, method: "direct-api" };
}

/**
 * Call the Similarweb data API and return the full result including data payload.
 * Used by the observation/evaluation flow.
 */
export async function fetchSimilarwebApiData(
  domain: string,
): Promise<SimilarwebApiResult> {
  try {
    const response = await axios.get(SIMILARWEB_API, {
      params: { domain },
      headers: {
        "Content-Type": "application/json",
        "X-Extension-Version": EXTENSION_VERSION,
        "Origin": `chrome-extension://${EXTENSION_ID}`,
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
      },
      timeout: REQUEST_TIMEOUT_MS,
      validateStatus: () => true,
    });

    return {
      domain,
      called: true,
      status: response.status,
      data: response.status === 200 ? response.data : null,
      error: response.status !== 200 ? `HTTP ${response.status}` : null,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      domain,
      called: false,
      status: null,
      data: null,
      error: msg,
    };
  }
}

/**
 * Trigger Similarweb data fetch for multiple domains in sequence.
 */
export async function triggerSimilarwebForWarmup(
  page: unknown,
  domains: string[],
): Promise<{ triggered: string[]; failed: string[] }> {
  const triggered: string[] = [];
  const failed: string[] = [];

  for (const domain of domains) {
    const result = await triggerSimilarwebFetch(page, domain);
    if (result.triggered) {
      triggered.push(domain);
    } else {
      failed.push(domain);
    }
    // Small delay between requests to avoid rate limiting
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(
    `  [similarweb] triggered for ${triggered.length}/${domains.length} domains (${failed.length} failed)`,
  );

  return { triggered, failed };
}
