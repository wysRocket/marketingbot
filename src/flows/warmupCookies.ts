import { Page } from "playwright";
import { triggerSimilarwebFetch } from "./triggerSimilarweb";

const DEFAULT_WARMUP_SITES = [
  "https://www.google.com",
  "https://www.youtube.com",
  "https://www.reddit.com",
  "https://www.wikipedia.org",
  "https://www.amazon.com",
  "https://www.twitter.com",
  "https://www.linkedin.com",
  "https://www.instagram.com",
  "https://www.bbc.com",
  "https://www.cnn.com",
  "https://www.github.com",
  "https://www.stackoverflow.com",
];

const WARMUP_PAGE_TIMEOUT_MS = 8000;
const WARMUP_DWELL_MS = 1200;

function resolveWarmupSites(): string[] {
  const env = process.env.WARMUP_SITES;
  if (env) return env.split(",").map((s) => s.trim()).filter(Boolean);
  const count = parseInt(process.env.WARMUP_SITE_COUNT ?? "6", 10);
  const shuffled = [...DEFAULT_WARMUP_SITES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extract the domain from a URL (e.g. "https://www.google.com" → "google.com").
 */
function extractDomain(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export async function warmupCookies(page: Page, label: string): Promise<{ visited: string[]; skipped: string[] }> {
  const sites = resolveWarmupSites();
  const visited: string[] = [];
  const skipped: string[] = [];

  for (const url of sites) {
    try {
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: WARMUP_PAGE_TIMEOUT_MS,
      });
      await sleep(WARMUP_DWELL_MS);

      // Trigger Similarweb extension data fetch for this domain.
      // The extension only fires data.similarweb.com calls when the panel is opened,
      // so we programmatically trigger it via CDP service worker injection.
      const domain = extractDomain(url);
      await triggerSimilarwebFetch(page, domain).catch(() => {
        // Non-fatal — extension trigger is best-effort
      });

      visited.push(url);
    } catch {
      skipped.push(url);
    }
  }

  console.log(
    `  [${label}] warmup: visited ${visited.length}/${sites.length} sites (${skipped.length} skipped)`,
  );

  return { visited, skipped };
}
