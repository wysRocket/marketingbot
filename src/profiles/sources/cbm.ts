/**
 * CBM (CloakBrowser-Manager) profile source.
 *
 * Fetches profiles from the CBM API and maps them to Patchright
 * catalog entries. Each CBM profile becomes one session slot.
 *
 * The `cbmUrl` field in each catalog entry is the full CDP URL
 * that Patchright connects to via chromium.connectOverCDP().
 *
 * CBM profiles already handle fingerprinting (patched Chromium),
 * so init scripts are not injected — they would be redundant.
 */

const CBM_API_URL =
  process.env.CBM_API_URL ?? "https://cloakbrowser-production-a859.up.railway.app";
const CBM_AUTH_TOKEN = process.env.CBM_AUTH_TOKEN ?? "";

interface CbmProfile {
  id: string;
  name: string;
  fingerprint_seed: number;
  /** Proxy URL string: http://user:pass@host:port */
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
  /** Relative CDP URL: /api/profiles/{uuid}/cdp */
  cdp_url: string;
  status: string;
  vnc_ws_port: number;
  auto_launch: boolean;
  notes: string | null;
  tags: string[];
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

function extractColorScheme(
  value: string | null,
): "light" | "dark" | "no-preference" | undefined {
  if (value === "light" || value === "dark" || value === "no-preference") {
    return value;
  }
  // CBM randomizes based on fingerprint_seed if not set
  return undefined;
}

/**
 * Map a single CBM profile to a Patchright catalog entry.
 */
function mapCbmProfile(profile: CbmProfile): CbmCatalogEntry {
  const id = profile.name;
  const baseUrl = CBM_API_URL.replace(/\/+$/, "");
  const cdpPath = profile.cdp_url.startsWith("/")
    ? profile.cdp_url
    : `/${profile.cdp_url}`;

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
    cbmUrl: `${baseUrl}${cdpPath}`,
    cbmProfileId: profile.id,
    launchArgs: profile.launch_args ?? [],
    patchrightProfile: {
      id: profile.id,
      name: profile.name,
      config,
    },
  };
}

/**
 * Fetch profiles from the CBM API and return a catalog.
 * Only returns running profiles (status === "running").
 */
export async function loadCbmCatalog(): Promise<{
  source: "cbm";
  profiles: CbmCatalogEntry[];
}> {
  if (!CBM_API_URL) {
    throw new Error("CBM_API_URL is not set");
  }

  const url = `${CBM_API_URL.replace(/\/+$/, "")}/api/profiles`;
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

  const running = profiles.filter((p) => p.status === "running");

  if (running.length === 0) {
    throw new Error(
      `CBM has ${profiles.length} profile(s), but none are running. Start them first.`,
    );
  }

  console.log(
    `[cbm] loaded ${running.length}/${profiles.length} running profiles from CBM`,
  );

  const catalogProfiles = running.map(mapCbmProfile);

  return {
    source: "cbm",
    profiles: catalogProfiles,
  };
}
