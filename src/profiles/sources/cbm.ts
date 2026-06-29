/**
 * CBM (CloakBrowser-Manager) profile source.
 *
 * Fetches ALL profiles from the CBM API (not just running ones).
 * Profiles are started on demand before CDP connection.
 *
 * Auto-launch at scale:
 *   - 65 profiles created, auto_launch: false
 *   - At startup, CONCURRENCY profiles are started via POST /launch
 *   - Each round picks from the running pool
 *   - Profiles stay running between rounds for state persistence
 *   - On shutdown, all CBM profiles are stopped
 */

import { chromium } from "patchright";

const CBM_API_URL =
  process.env.CBM_API_URL ?? "https://cloakbrowser-production-a859.up.railway.app";
const CBM_AUTH_TOKEN = process.env.CBM_AUTH_TOKEN ?? "";

interface CbmProfile {
  id: string;
  name: string;
  fingerprint_seed: number;
  proxy: string | null;
  timezone: string | null;
  locale: string | null;
  platform: string | null;
  user_agent: string | null;
  screen_width: number;
  screen_height: number;
  hardware_concurrency: number | null;
  headless: boolean;
  launch_args: string[];
  cdp_url: string | null;
  status: string;
  auto_launch: boolean;
  color_scheme: string | null;
}

interface CbmCatalogEntry {
  id: string;
  name: string;
  source: "cbm";
  sessionStatePolicy: "identity-sticky";
  cbmUrl: string;
  cbmProfileId: string;
  launchArgs: string[];
  patchrightProfile: {
    id: string;
    name: string;
    config: Record<string, unknown>;
  };
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (CBM_AUTH_TOKEN) {
    headers["Authorization"] = `Bearer ${CBM_AUTH_TOKEN}`;
  }
  return headers;
}

function baseUrl(): string {
  return CBM_API_URL.replace(/\/+$/, "");
}

function extractColorScheme(
  value: string | null,
): "light" | "dark" | "no-preference" | undefined {
  if (value === "light" || value === "dark" || value === "no-preference") {
    return value;
  }
  return undefined;
}

function mapCbmProfile(profile: CbmProfile): CbmCatalogEntry {
  const id = profile.name;

  // Construct CDP URL — profile might not be running yet
  const cdpPath = profile.cdp_url?.startsWith("/")
    ? profile.cdp_url
    : `/api/profiles/${profile.id}/cdp`;
  const cbmUrl = `${baseUrl()}${cdpPath}`;

  const config: Record<string, unknown> = {
    ignoreHTTPSErrors: true,
  };

  if (profile.user_agent) {
    config.userAgent = profile.user_agent;
  }
  if (profile.screen_width && profile.screen_height) {
    config.viewport = {
      width: profile.screen_width,
      height: profile.screen_height,
    };
  }
  if (profile.locale) {
    config.locale = profile.locale;
  }
  if (profile.timezone) {
    config.timezoneId = profile.timezone;
  }
  if (profile.color_scheme) {
    const cs = extractColorScheme(profile.color_scheme);
    if (cs) config.colorScheme = cs;
  }

  return {
    id,
    name: profile.name,
    source: "cbm",
    sessionStatePolicy: "identity-sticky",
    cbmUrl,
    cbmProfileId: profile.id,
    launchArgs: profile.launch_args ?? [],
    patchrightProfile: {
      id: profile.id,
      name: profile.name,
      config,
    },
  };
}

// ── Profile lifecycle helpers ────────────────────────────────────

/**
 * Ensure a CBM profile is running before CDP connection.
 * Safe to call on already-running profiles (CBM ignores redundant
 * start requests or returns the running instance).
 */
export async function ensureCbmProfileRunning(
  cbmProfileId: string,
): Promise<string> {
  const url = `${baseUrl()}/api/profiles/${cbmProfileId}/launch`;

  const res = await fetch(url, {
    method: "POST",
    headers: buildHeaders(),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "(no body)");
    throw new Error(
      `CBM launch error for ${cbmProfileId}: ${res.status} ${res.statusText} — ${text}`,
    );
  }

  const data = await res.json();
  const cdp: string | null = data?.cdp_url ?? null;

  if (!cdp) {
    throw new Error(
      `CBM launched ${cbmProfileId} but got no CDP URL: ${JSON.stringify(data)}`,
    );
  }

  const fullCdpUrl = cdp.startsWith("http") ? cdp : `${baseUrl()}${cdp.startsWith("/") ? "" : "/"}${cdp}`;
  return fullCdpUrl;
}

/**
 * Stop a CBM profile to free RAM.
 * Called during profile rotation and on shutdown.
 */
export async function stopCbmProfile(
  cbmProfileId: string,
): Promise<void> {
  const url = `${baseUrl()}/api/profiles/${cbmProfileId}/stop`;

  const res = await fetch(url, {
    method: "POST",
    headers: buildHeaders(),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "(no body)");
    console.warn(
      `[cbm] stop warning for ${cbmProfileId}: ${res.status} — ${text}`,
    );
  }
}

/**
 * Fetch all profiles from the CBM API, returning catalog entries
 * for every profile (regardless of running status).
 */
export async function loadCbmCatalog(): Promise<{
  source: "cbm";
  profiles: CbmCatalogEntry[];
}> {
  if (!CBM_API_URL) {
    throw new Error("CBM_API_URL is not set");
  }

  const url = `${baseUrl()}/api/profiles`;
  const res = await fetch(url, {
    headers: buildHeaders(),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(
      `CBM API error: ${res.status} ${res.statusText} — ${await res.text().catch(() => "(no body)")}`,
    );
  }

  const profiles: CbmProfile[] = await res.json();

  if (!Array.isArray(profiles) || profiles.length === 0) {
    throw new Error("CBM API returned no profiles");
  }

  console.log(
    `[cbm] loaded ${profiles.length} profiles from CBM (${profiles.filter((p) => p.status === "running").length} running)`,
  );

  return {
    source: "cbm",
    profiles: profiles.map(mapCbmProfile),
  };
}

/**
 * Initialize a pool of CBM profiles at startup.
 * Launches up to `count` profiles that aren't already running.
 * Returns the list of profiles with confirmed CDP URLs.
 */
export async function initCbmPool(
  profiles: Array<{ id: string; name: string; cbmProfileId?: string }>,
  count: number,
): Promise<Map<string, string>> {
  const cdpUrls = new Map<string, string>();

  const toStart = profiles.slice(0, Math.min(count, profiles.length));

  await Promise.all(
    toStart.map(async (profile) => {
      try {
        const url = await ensureCbmProfileRunning(profile.cbmProfileId!);
        cdpUrls.set(profile.id, url);
        console.log(
          `[cbm] started ${profile.name} (${profile.cbmProfileId}) → CDP ready`,
        );
      } catch (err) {
        console.warn(
          `[cbm] failed to start ${profile.name}: ${(err as Error).message}`,
        );
      }
    }),
  );

  console.log(`[cbm] pool ready: ${cdpUrls.size}/${count} profiles running`);

  return cdpUrls;
}

/**
 * Stop all CBM profiles in the pool.
 * Called on bot shutdown.
 */
export async function stopAllCbmProfiles(
  profiles: Array<{ cbmProfileId?: string }>,
): Promise<void> {
  console.log(`[cbm] stopping ${profiles.length} profiles...`);
  await Promise.allSettled(
    profiles.map((p) => stopCbmProfile(p.cbmProfileId!).catch(() => {})),
  );
  console.log("[cbm] all profiles stopped");
}
