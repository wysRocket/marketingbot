/** Weighted pool of realistic HTTP referrers for organic traffic simulation. */
export type ReferrerType = "search" | "social" | "direct";

export interface ReferrerEntry {
  url: string;
  weight: number;
  type: ReferrerType;
  /** For search engines: the query parameter name (default "q") */
  queryParam?: string;
  /**
   * For social entries: the utm_source value to append to the landing URL.
   * GA4 requires a utm_source + utm_medium=social on the URL to reliably
   * attribute sessions to the "Organic Social" channel group.  A plain
   * Referer header alone is often blocked by browsers or ignored by GA4,
   * landing those sessions in "Unassigned".
   */
  utmSource?: string;
}

/**
 * Distribution reflects typical real-world referral traffic.
 * An empty url means a direct visit — no Referer header is sent.
 * type="search" entries trigger a real browser-level search flow instead
 * of a spoofed Referer header.
 * type="social" entries carry a utmSource so applyUtmParams() can tag
 * the landing URL — GA4 reads utm_* before the Referer header and
 * classifies the session as Organic Social instead of Unassigned.
 */
const REFERRERS: ReferrerEntry[] = [
  { url: "https://www.google.com/",    weight: 40, type: "search", queryParam: "q" },
  { url: "https://www.google.co.uk/", weight: 5,  type: "search", queryParam: "q" },
  { url: "https://www.google.ca/",    weight: 3,  type: "search", queryParam: "q" },
  { url: "https://www.google.com.au/",weight: 2,  type: "search", queryParam: "q" },
  { url: "https://www.bing.com/",     weight: 10, type: "search", queryParam: "q" },
  { url: "https://duckduckgo.com/",   weight: 5,  type: "search", queryParam: "q" },
  { url: "https://www.facebook.com/", weight: 8,  type: "social", utmSource: "facebook" },
  { url: "https://t.co/",             weight: 4,  type: "social", utmSource: "twitter"  },
  { url: "https://www.linkedin.com/", weight: 6,  type: "social", utmSource: "linkedin" },
  { url: "https://www.reddit.com/",   weight: 5,  type: "social", utmSource: "reddit"   },
  { url: "https://www.youtube.com/",  weight: 2,  type: "social", utmSource: "youtube"  },
  // Direct visit — no Referer header sent, no UTM params
  { url: "",                          weight: 10, type: "direct" },
];

const TOTAL_WEIGHT = REFERRERS.reduce((sum, r) => sum + r.weight, 0);

/**
 * Pick a referrer entry at random using the weighted distribution above.
 * Callers that need the type metadata (e.g. to perform a real search flow)
 * should use this instead of pickReferrer().
 */
export function pickReferrerEntry(): ReferrerEntry {
  let roll = Math.random() * TOTAL_WEIGHT;
  for (const entry of REFERRERS) {
    roll -= entry.weight;
    if (roll <= 0) return entry;
  }
  return REFERRERS[REFERRERS.length - 1];
}

/**
 * Pick a referrer URL at random using the weighted distribution above.
 * Returns `undefined` for direct visits (no Referer header will be sent).
 * @deprecated Prefer pickReferrerEntry() so callers can distinguish search
 *             engines and trigger a real browser search instead of a spoofed header.
 */
export function pickReferrer(): string | undefined {
  const entry = pickReferrerEntry();
  return entry.url || undefined;
}

/**
 * Append UTM parameters to a landing URL for social referrers.
 *
 * GA4 uses utm_source / utm_medium to determine the channel group.
 * A bare Referer header from a social network is unreliable — many
 * browsers suppress it (strict-origin-when-cross-origin) and GA4 often
 * falls back to "Unassigned" when the header is absent.  Tagging the URL
 * directly is the authoritative signal GA4 uses first.
 *
 * - search: returns the URL unchanged — channel is set by the real
 *   Referer from the search-engine navigation flow.
 * - social: appends utm_source=<network>&utm_medium=social.
 * - direct: returns the URL unchanged — no UTM means Direct in GA4.
 */
export function applyUtmParams(url: string, entry: ReferrerEntry): string {
  if (entry.type !== "social" || !entry.utmSource) return url;

  try {
    const parsed = new URL(url);
    parsed.searchParams.set("utm_source", entry.utmSource);
    parsed.searchParams.set("utm_medium", "social");
    return parsed.toString();
  } catch {
    // Malformed URL — return as-is rather than breaking the flow.
    return url;
  }
}
