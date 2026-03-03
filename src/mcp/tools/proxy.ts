import { z } from "zod";
import { chromium } from "playwright";
import { nst } from "../nstClient";

// ── Zod schemas ──────────────────────────────────────────────────────

export const UpdateProfileProxySchema = {
  profileId: z.string().describe("Profile ID to update"),
  proxy: z.string().describe("Full proxy URL: socks5://user:pass@host:port"),
};

export const BatchUpdateProxySchema = {
  profileIds: z.array(z.string()).describe("Profile IDs to update"),
  proxy: z.string().describe("Proxy URL applied to all profiles"),
};

export const ResetProfileProxySchema = {
  profileId: z
    .string()
    .describe("Profile ID whose proxy to reset to local (direct)"),
};

export const UpdateContextProxySchema = {
  wsEndpoint: z
    .string()
    .describe(
      "WebSocket debugger URL of a running browser (from connectBrowser)",
    ),
  proxyServer: z
    .string()
    .describe("New proxy URL to apply live: socks5://user:pass@host:port"),
  proxyBypassList: z
    .string()
    .optional()
    .describe("Comma-separated bypass domains, e.g. *.google.com,localhost"),
};

// ── Handlers ─────────────────────────────────────────────────────────

export async function updateProfileProxy(profileId: string, proxy: string) {
  const res = await nst.put(`/profiles/${profileId}/proxy`, { proxy });
  return res.data;
}

export async function batchUpdateProxy(profileIds: string[], proxy: string) {
  const res = await nst.put("/profiles/proxy/batch", { profileIds, proxy });
  return res.data;
}

export async function resetProfileProxy(profileId: string) {
  const res = await nst.delete(`/profiles/${profileId}/proxy`);
  return res.data;
}

/**
 * Live-swap the proxy of a running browser session via the CDP
 * Network.updateContextProxy command. The browser stays open and
 * subsequent requests route through the new proxy immediately.
 */
export async function updateContextProxy(
  wsEndpoint: string,
  proxyServer: string,
  proxyBypassList?: string,
) {
  const browser = await chromium.connectOverCDP(wsEndpoint);
  try {
    const contexts = browser.contexts();
    const ctx = contexts[0] ?? (await browser.newContext());
    const cdp = await ctx.newCDPSession(
      ctx.pages()[0] ?? (await ctx.newPage()),
    );

    const cdpSend = cdp.send.bind(cdp) as (
      method: string,
      params?: Record<string, unknown>,
    ) => Promise<unknown>;

    const result = await cdpSend("Network.updateContextProxy", {
      proxyServer,
      ...(proxyBypassList ? { proxyBypassList } : {}),
    });

    return { success: true, result };
  } finally {
    // close() on a connectOverCDP browser disconnects the CDP session
    await browser.close();
  }
}

export const BatchResetProxySchema = {
  profileIds: z
    .array(z.string())
    .min(1)
    .describe("Profile IDs whose proxies to reset to direct (no proxy)"),
};

export async function batchResetProxy(profileIds: string[]) {
  const res = await nst.delete("/profiles/proxy/batch", {
    data: { profileIds },
  });
  return res.data;
}
