import "dotenv/config";
import axios from "axios";
import { getActiveSiteProfile } from "../sites";

const ACTIVE_SITE = getActiveSiteProfile();
const DEFAULT_BASE_URL = ACTIVE_SITE.baseUrl;

function parseMaxAge(cacheControl: string): number {
  const match = cacheControl.match(/max-age=(\d+)/i);
  return match ? Number.parseInt(match[1], 10) : -1;
}

function isLongImmutableCache(cacheControl: string): boolean {
  const maxAge = parseMaxAge(cacheControl);
  return cacheControl.includes("immutable") && maxAge >= 31_536_000;
}

async function getHeaders(url: string): Promise<Record<string, string>> {
  try {
    const head = await axios.head(url, {
      maxRedirects: 5,
      timeout: 30_000,
      validateStatus: () => true,
    });

    if (head.status >= 200 && head.status < 500) {
      const normalized: Record<string, string> = {};
      for (const [k, v] of Object.entries(head.headers)) {
        normalized[k.toLowerCase()] = Array.isArray(v) ? v.join(",") : String(v);
      }
      return normalized;
    }
  } catch {
    // Fallback to GET below.
  }

  const get = await axios.get(url, {
    maxRedirects: 5,
    timeout: 30_000,
    validateStatus: () => true,
    responseType: "stream",
  });

  const normalized: Record<string, string> = {};
  for (const [k, v] of Object.entries(get.headers)) {
    normalized[k.toLowerCase()] = Array.isArray(v) ? v.join(",") : String(v);
  }

  // Drain stream to close sockets cleanly.
  get.data.destroy();
  return normalized;
}

async function discoverHashedAssets(baseUrl: string): Promise<string[]> {
  try {
    const home = await axios.get(baseUrl + "/", {
      timeout: 30_000,
      validateStatus: (s) => s >= 200 && s < 400,
      responseType: "text",
    });

    const html = String(home.data ?? "");
    const matches = html.match(/\/assets\/[^"'\s>]+\.(js|css)/g) ?? [];

    return [...new Set(matches)].map((path) =>
      path.startsWith("http") ? path : `${baseUrl}${path}`,
    );
  } catch {
    return [];
  }
}

(async () => {
  const baseUrl = (process.env.AUDIT_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const staticChecks = [
    `${baseUrl}/`,
    ...ACTIVE_SITE.browseFooterLinks.footerPaths.map((path) => `${baseUrl}${path}`),
  ];

  const discoveredAssets = await discoverHashedAssets(baseUrl);

  console.log(`Cache header audit for ${baseUrl}`);
  console.log(`Discovered hashed assets: ${discoveredAssets.length}`);

  for (const url of staticChecks) {
    const headers = await getHeaders(url);
    const cacheControl = headers["cache-control"] ?? "(missing)";
    console.log(`\n[HTML] ${url}`);
    console.log(`  cache-control: ${cacheControl}`);
  }

  for (const url of discoveredAssets) {
    const headers = await getHeaders(url);
    const cacheControl = headers["cache-control"] ?? "";
    const verdict = isLongImmutableCache(cacheControl)
      ? "OK"
      : "MISSING_LONG_IMMUTABLE";

    console.log(`\n[ASSET] ${url}`);
    console.log(`  cache-control: ${cacheControl || "(missing)"}`);
    console.log(`  verdict: ${verdict}`);
  }

  if (discoveredAssets.length === 0) {
    console.log("\nNo hashed /assets/*.js or *.css discovered from homepage HTML.");
  }
})();
