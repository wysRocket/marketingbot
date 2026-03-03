import { z } from "zod";
import { ml } from "../client";

// ── Schemas ──────────────────────────────────────────────────────────

export const ListProfilesSchema = {
  page: z.number().int().min(1).optional().default(1).describe("Page number"),
  pageSize: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(10)
    .describe("Items per page"),
};

export const QuickCreateProfileSchema = {
  folderId: z.string().describe("Destination folder ID"),
  os: z
    .enum(["Win32", "MacIntel", "Linux x86_64", "iPhone", "Linux armv81"])
    .describe("Operating system"),
  coreVersion: z
    .enum(["138", "136", "134", "132", "130"])
    .optional()
    .default("138")
    .describe("Chrome kernel version"),
  title: z.string().optional().describe("Profile title"),
};

const FingerprintSchema = z
  .object({
    os: z
      .enum(["Win32", "MacIntel", "Linux x86_64", "iPhone", "Linux armv81"])
      .describe("OS type"),
    coreVersion: z.string().optional().describe("Chrome core version"),
    userAgent: z.string().optional(),
    osVersion: z.string().optional(),
    timeZoneFollowIp: z.boolean().optional(),
    timeZone: z.string().optional(),
    languageFollowIp: z.boolean().optional(),
    languages: z.string().optional().describe("Comma-separated language codes"),
    uiLanguageType: z
      .number()
      .int()
      .optional()
      .describe("1=IP-based, 2=system, 3=custom"),
    uiLanguage: z.string().optional(),
    webRTC: z.enum(["replace", "allow", "disable", "privacy"]).optional(),
    geolocation: z
      .number()
      .int()
      .optional()
      .describe("1=ask, 2=allow, 3=disable"),
    geolocationFollowIp: z.boolean().optional(),
    longitude: z.number().optional(),
    latitude: z.number().optional(),
    resolution: z.string().optional(),
    canvasNoise: z.boolean().optional(),
    webglNoise: z.boolean().optional(),
    audioContextNoise: z.boolean().optional(),
    hardwareConcurrency: z.number().int().optional(),
    doNotTrack: z.boolean().optional(),
    portScanProtection: z.boolean().optional(),
  })
  .describe("Browser fingerprint settings");

const ProxyForProfileSchema = z
  .object({
    proxyMethod: z
      .number()
      .int()
      .describe("0=base, 1=dynamic, 2=custom, 4=select existing"),
    protocol: z.string().optional().describe("socks5, http, https, ssh"),
    host: z.string().optional(),
    port: z.number().int().optional(),
    proxyUsername: z.string().optional(),
    proxyPassword: z.string().optional(),
    proxyId: z.string().optional().describe("ID of existing proxy (method 4)"),
  })
  .describe("Proxy configuration");

export const AdvancedCreateProfileSchema = {
  folderId: z.string().describe("Destination folder ID"),
  fingerprint: FingerprintSchema,
  title: z.string().optional().describe("Profile title"),
  proxy: ProxyForProfileSchema.optional(),
  allowMultipleOpenings: z.number().int().min(0).max(1).optional(),
  twoFaSecretKey: z.string().optional(),
  cookie: z.string().optional(),
  urls: z.string().optional().describe("Comma-separated startup URLs"),
  remark: z.string().max(500).optional(),
  workbench: z.number().int().optional().describe("0=hidden, 1=local page"),
  preference: z
    .object({
      syncCookies: z.boolean().optional(),
      syncTabs: z.boolean().optional(),
      syncAutofill: z.boolean().optional(),
    })
    .optional(),
};

export const GetProfileDetailSchema = {
  profileId: z.string().describe("Profile ID"),
};

export const UpdateProfileFolderSchema = {
  ids: z.array(z.string()).min(1).describe("Profile IDs to move"),
  folderId: z.string().optional().describe("Target folder ID"),
};

export const UpdateProfileBaseProxySchema = {
  ids: z.array(z.string()).min(1).describe("Profile IDs to update"),
  host: z.string().describe("Proxy host"),
  port: z.number().int().describe("Proxy port"),
  protocol: z
    .enum(["socks5", "http", "https", "ssh"])
    .describe("Proxy protocol"),
  proxyUsername: z.string().describe("Proxy username"),
  proxyPassword: z.string().describe("Proxy password"),
  proxyMethod: z.number().int().optional().default(0),
};

export const UpdateProfileApiExtractionProxySchema = {
  ids: z.array(z.string()).min(1).describe("Profile IDs to update"),
  protocol: z
    .enum(["socks5", "http", "https", "ssh"])
    .describe("Proxy protocol"),
  extractionUrl: z.string().describe("Proxy extraction URL"),
  extractMethod: z
    .number()
    .int()
    .min(0)
    .max(1)
    .describe("0=new IP each open, 1=new IP when prior expires"),
};

export const UpdateProfileSelectProxySchema = {
  ids: z.array(z.string()).min(1).describe("Profile IDs to update"),
  proxyId: z.string().describe("Existing proxy ID to assign"),
};

export const MoveProfilesToRecycleSchema = {
  ids: z
    .array(z.string())
    .min(1)
    .describe("Profile IDs to move to recycle bin"),
};

// ── Handlers ─────────────────────────────────────────────────────────

export async function listProfiles(page = 1, pageSize = 10) {
  const res = await ml.post("/api/profile/getProfiles", { page, pageSize });
  return res.data;
}

export async function quickCreateProfile(params: {
  folderId: string;
  os: string;
  coreVersion?: string;
  title?: string;
}) {
  const res = await ml.post("/api/profile/quickCreateProfile", {
    product: "chrome",
    coreVersion: "138",
    ...params,
  });
  return res.data;
}

export async function advancedCreateProfile(params: Record<string, unknown>) {
  const res = await ml.post("/api/profile/advancedCreateProfile", params);
  return res.data;
}

export async function getProfileDetail(profileId: string) {
  const res = await ml.post("/api/profile/detail", { profileId });
  return res.data;
}

export async function updateProfileFolder(ids: string[], folderId?: string) {
  const res = await ml.post("/api/profile/updateProfileFolder", {
    ids,
    folderId,
  });
  return res.data;
}

export async function updateProfileBaseProxy(params: {
  ids: string[];
  host: string;
  port: number;
  protocol: string;
  proxyUsername: string;
  proxyPassword: string;
  proxyMethod?: number;
}) {
  const res = await ml.post("/api/profile/updateProfileBaseProxy", {
    proxyMethod: 0,
    ...params,
  });
  return res.data;
}

export async function updateProfileApiExtractionProxy(params: {
  ids: string[];
  protocol: string;
  extractionUrl: string;
  extractMethod: number;
}) {
  const res = await ml.post(
    "/api/profile/updateProfileApiExtractionProxy",
    params,
  );
  return res.data;
}

export async function updateProfileSelectProxy(ids: string[], proxyId: string) {
  const res = await ml.post("/api/profile/updateProfileSelectProxy", {
    ids,
    proxyId,
  });
  return res.data;
}

export async function moveProfilesToRecycle(ids: string[]) {
  const res = await ml.post("/api/profile/moveProfiletoRecycle", { ids });
  return res.data;
}
