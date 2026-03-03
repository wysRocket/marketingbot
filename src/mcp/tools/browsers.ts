import { z } from "zod";
import { nst, NST_WS_BASE, apiKey } from "../nstClient";
import type { NstBrowser } from "../types";

// ── Zod schemas ──────────────────────────────────────────────────────

export const StartBrowserSchema = {
  profileId: z.string().describe("Profile ID to launch"),
};

export const StopBrowserSchema = {
  profileId: z.string().describe("Profile ID to stop"),
};

export const ConnectBrowserSchema = {
  profileId: z.string().describe("Profile ID to launch and connect via CDP"),
  headless: z.boolean().optional().default(false).describe("Run headless"),
  proxy: z
    .string()
    .optional()
    .describe("Override proxy for this session: socks5://user:pass@host:port"),
  skipProxyChecking: z.boolean().optional().default(false),
  startupUrls: z.array(z.string()).optional(),
  autoClose: z.boolean().optional().default(true),
};

// ── Handlers ─────────────────────────────────────────────────────────

export async function startBrowser(profileId: string) {
  const res = await nst.post<{ data: NstBrowser }>(`/browsers/${profileId}`);
  return res.data.data;
}

export async function stopBrowser(profileId: string) {
  const res = await nst.delete<{ data: boolean }>(`/browsers/${profileId}`);
  return res.data;
}

export async function getBrowsers() {
  const res = await nst.get<{ data: NstBrowser[] }>("/browsers");
  return res.data.data;
}

export async function connectBrowser(
  params: z.infer<z.ZodObject<typeof ConnectBrowserSchema>>,
) {
  const cfg: Record<string, unknown> = {
    headless: params.headless,
    autoClose: params.autoClose,
    skipProxyChecking: params.skipProxyChecking,
  };
  if (params.proxy) cfg.proxy = params.proxy;
  if (params.startupUrls) cfg.startupUrls = params.startupUrls;

  const query = new URLSearchParams({
    "x-api-key": apiKey!,
    config: JSON.stringify(cfg),
  });

  // Returns the wsEndpoint string the caller passes to Playwright's connectOverCDP
  const wsEndpoint = `${NST_WS_BASE}/connect/${params.profileId}?${query.toString()}`;
  return { wsEndpoint, profileId: params.profileId };
}

// ── Additional schemas ────────────────────────────────────────────────

export const StartBrowsersSchema = {
  profileIds: z
    .array(z.string())
    .min(1)
    .describe("Profile IDs to launch in batch"),
};

export const StopBrowsersSchema = {
  profileIds: z
    .array(z.string())
    .describe(
      "Profile IDs to stop; pass an empty array to stop ALL running browsers",
    ),
};

export const StartOnceBrowserSchema = {
  platform: z.enum(["windows", "macos", "linux"]).optional().default("windows"),
  proxy: z
    .string()
    .optional()
    .describe("Proxy URL: socks5://user:pass@host:port"),
  headless: z.boolean().optional().default(false),
  autoClose: z.boolean().optional().default(true),
  startupUrls: z.array(z.string()).optional(),
};

export const GetBrowserPagesSchema = {
  profileId: z.string().describe("Profile ID whose open pages to list"),
};

export const GetBrowserDebuggerSchema = {
  profileId: z
    .string()
    .describe("Profile ID to get remote debugging address for"),
};

export const ConnectOnceBrowserSchema = {
  platform: z.enum(["windows", "macos", "linux"]).optional().default("windows"),
  proxy: z
    .string()
    .optional()
    .describe("Proxy URL: socks5://user:pass@host:port"),
  headless: z.boolean().optional().default(false),
  autoClose: z.boolean().optional().default(true),
  startupUrls: z.array(z.string()).optional(),
  skipProxyChecking: z.boolean().optional().default(false),
};

// ── Additional handlers ───────────────────────────────────────────────

export async function startBrowsers(profileIds: string[]) {
  const res = await nst.post<{ data: NstBrowser[] }>("/browsers", {
    profileIds,
  });
  return res.data.data;
}

export async function stopBrowsers(profileIds: string[]) {
  const res = await nst.delete<{ data: boolean }>("/browsers", {
    data: { profileIds },
  });
  return res.data;
}

export async function startOnceBrowser(
  params: z.infer<z.ZodObject<typeof StartOnceBrowserSchema>>,
) {
  const body: Record<string, unknown> = {
    platform: params.platform,
    headless: params.headless,
    autoClose: params.autoClose,
  };
  if (params.proxy) body.proxy = params.proxy;
  if (params.startupUrls) body.startupUrls = params.startupUrls;
  const res = await nst.post<{ data: NstBrowser }>("/browsers/once", body);
  return res.data.data;
}

export async function getBrowserPages(profileId: string) {
  const res = await nst.get<{ data: unknown[] }>(
    `/browsers/${profileId}/pages`,
  );
  return res.data.data;
}

export async function getBrowserDebugger(profileId: string) {
  const res = await nst.get<{ data: unknown }>(
    `/browsers/${profileId}/debugger`,
  );
  return res.data.data;
}

export async function connectOnceBrowser(
  params: z.infer<z.ZodObject<typeof ConnectOnceBrowserSchema>>,
) {
  const cfg: Record<string, unknown> = {
    once: true,
    platform: params.platform,
    headless: params.headless,
    autoClose: params.autoClose,
    skipProxyChecking: params.skipProxyChecking,
  };
  if (params.proxy) cfg.proxy = params.proxy;
  if (params.startupUrls) cfg.startupUrls = params.startupUrls;

  const query = new URLSearchParams({
    "x-api-key": apiKey!,
    config: JSON.stringify(cfg),
  });

  const wsEndpoint = `${NST_WS_BASE}/connect?${query.toString()}`;
  return { wsEndpoint };
}
