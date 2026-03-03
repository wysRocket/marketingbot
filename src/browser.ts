import { chromium, Browser } from "playwright";
import { config } from "./config";
import { openBrowser } from "./mcp/mostlogin/tools/browsers";

/**
 * Launch a fresh ephemeral Nstbrowser session.
 *
 * When proxyUrl is omitted the browser connects with your direct IP —
 * useful for development before proxy credentials are set up.
 * When provided it must be a full URL: socks5://user:pass@host:port
 *
 * Requirements:
 *   - The Nstbrowser desktop app must be running locally (port 8848).
 *   - NSTBROWSER_API_KEY must be set in .env.
 */
export async function launchSession(proxyUrl?: string): Promise<Browser> {
  // No proxy: skip Nstbrowser entirely and use plain Playwright.
  // Nstbrowser's ephemeral (once:true) mode requires a proxy and will
  // reject the request with a 500 "proxy check failed" if one is missing.
  if (!proxyUrl) {
    console.log(
      "  [browser] No proxy configured — using plain Playwright (direct IP, no antidetect)",
    );
    return chromium.launch({ headless: false });
  }

  // With proxy: route through Nstbrowser for antidetect fingerprinting.
  const { host, apiKey } = config.nstbrowser;

  const sessionConfig: Record<string, unknown> = {
    once: true,
    headless: false,
    platform: "windows",
    proxy: proxyUrl,
    autoClose: true,
  };

  const query = new URLSearchParams({
    "x-api-key": apiKey,
    config: JSON.stringify(sessionConfig),
  });

  const wsEndpoint = `ws://${host}/api/v2/connect?${query.toString()}`;
  const browser = await chromium.connectOverCDP(wsEndpoint);
  return browser;
}

/**
 * Connect to an existing saved Nstbrowser profile by ID.
 * Useful when you want to persist cookies/localStorage across sessions.
 */
export async function connectProfile(profileId: string): Promise<Browser> {
  const { host, apiKey } = config.nstbrowser;

  const sessionConfig = {
    headless: false,
    autoClose: true,
  };

  const query = new URLSearchParams({
    "x-api-key": apiKey,
    config: JSON.stringify(sessionConfig),
  });

  const wsEndpoint = `ws://${host}/api/v2/connect/${profileId}?${query.toString()}`;
  const browser = await chromium.connectOverCDP(wsEndpoint);
  return browser;
}

/**
 * Open a MostLogin profile via its local API and connect Playwright to it
 * over CDP. The caller is responsible for closing the profile via
 * closeProfiles([profileId]) after the session.
 *
 * Requirements:
 *   - The MostLogin desktop app must be running (default port 30898).
 *   - MOSTLOGIN_API_KEY must be set in .env.
 */
export async function connectMostLoginProfile(
  profileId: string,
): Promise<Browser> {
  const result = await openBrowser({ profileId, ignoreStartUrls: true });
  const wsEndpoint: string | undefined = result?.ws;

  if (!wsEndpoint) {
    throw new Error(
      `MostLogin openBrowser did not return a WS endpoint for profile ${profileId}. ` +
        `Response: ${JSON.stringify(result)}`,
    );
  }

  return chromium.connectOverCDP(wsEndpoint);
}
