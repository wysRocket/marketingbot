/** Weighted pool of realistic HTTP referrers for organic traffic simulation. */
interface ReferrerEntry {
  url: string;
  weight: number;
}

/**
 * Distribution reflects typical real-world referral traffic.
 * An empty url means a direct visit — no Referer header is sent.
 */
const REFERRERS: ReferrerEntry[] = [
  { url: "https://www.google.com/", weight: 40 },
  { url: "https://www.google.co.uk/", weight: 5 },
  { url: "https://www.google.ca/", weight: 3 },
  { url: "https://www.google.com.au/", weight: 2 },
  { url: "https://www.bing.com/", weight: 10 },
  { url: "https://duckduckgo.com/", weight: 5 },
  { url: "https://www.facebook.com/", weight: 8 },
  { url: "https://t.co/", weight: 4 },
  { url: "https://www.linkedin.com/", weight: 6 },
  { url: "https://www.reddit.com/", weight: 5 },
  { url: "https://www.youtube.com/", weight: 2 },
  // Direct visit — no Referer header sent
  { url: "", weight: 10 },
];

const TOTAL_WEIGHT = REFERRERS.reduce((sum, r) => sum + r.weight, 0);

/**
 * Pick a referrer URL at random using the weighted distribution above.
 * Returns `undefined` for direct visits (no Referer header will be sent).
 */
export function pickReferrer(): string | undefined {
  let roll = Math.random() * TOTAL_WEIGHT;
  for (const entry of REFERRERS) {
    roll -= entry.weight;
    if (roll <= 0) return entry.url || undefined;
  }
  return undefined;
}
