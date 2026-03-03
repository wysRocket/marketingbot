import { z } from "zod";
import { nst } from "../nstClient";
import type { NstProfile } from "../types";

// ── Zod schemas used by the MCP server ──────────────────────────────

export const CreateProfileSchema = {
  name: z
    .string()
    .optional()
    .describe("Profile name; default: nst_<timestamp>"),
  platform: z
    .enum(["Windows", "macOS", "Linux"])
    .optional()
    .describe("OS platform"),
  kernelMilestone: z
    .enum(["132", "135", "138", "140"])
    .optional()
    .describe("Chrome version"),
  groupName: z.string().optional().describe("Existing profile group name"),
  proxy: z
    .string()
    .optional()
    .describe("Proxy URL: socks5://user:pass@host:port"),
  note: z.string().optional().describe("Free-text note"),
  startupUrls: z
    .array(z.string())
    .optional()
    .describe("URLs to open on launch"),
  fingerprintPreset: z
    .object({
      noiseAudio: z.boolean().optional(),
      noiseCanvas: z.boolean().optional(),
      noiseWebgl: z.boolean().optional(),
      maskWebrtc: z.boolean().optional(),
      hardwareConcurrency: z.number().int().min(2).max(16).optional(),
      deviceMemory: z
        .union([z.literal(2), z.literal(4), z.literal(8)])
        .optional(),
    })
    .optional()
    .describe("Common fingerprint options; omit for full random"),
};

export const ProfileIdSchema = {
  profileId: z.string().describe("Nstbrowser profile ID"),
};

export const ListProfilesSchema = {
  page: z.number().int().min(1).optional().default(1).describe("Page number"),
  perPage: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(20)
    .describe("Results per page"),
};

// ── Handlers ─────────────────────────────────────────────────────────

export async function createProfile(
  params: z.infer<z.ZodObject<typeof CreateProfileSchema>>,
) {
  const body: Record<string, unknown> = {
    name: params.name,
    platform: params.platform ?? "Windows",
    kernelMilestone: params.kernelMilestone,
    groupName: params.groupName,
    proxy: params.proxy,
    note: params.note,
    startupUrls: params.startupUrls,
  };

  if (params.fingerprintPreset) {
    const fp = params.fingerprintPreset;
    body.fingerprint = {
      hardwareConcurrency: fp.hardwareConcurrency,
      deviceMemory: fp.deviceMemory,
      flags: {
        audio: fp.noiseAudio ? "Noise" : "Real",
        canvas: fp.noiseCanvas ? "Noise" : "Real",
        webgl: fp.noiseWebgl ? "Noise" : "Real",
        webrtc: fp.maskWebrtc ? "Masked" : "Real",
        geolocation: "BasedOnIp",
        localization: "BasedOnIp",
        timezone: "BasedOnIp",
      },
    };
  }

  // Remove undefined keys
  Object.keys(body).forEach((k) => body[k] === undefined && delete body[k]);

  const res = await nst.post<{ data: NstProfile }>("/profiles", body);
  return res.data.data;
}

export async function deleteProfile(profileId: string) {
  const res = await nst.delete<{ data: boolean }>(`/profiles/${profileId}`);
  return res.data;
}

export async function listProfiles(page = 1, perPage = 20) {
  const res = await nst.get<{ data: { docs: NstProfile[]; total: number } }>(
    "/profiles",
    {
      params: { page, pageSize: perPage },
    },
  );
  // API returns { docs, total } not { list, total }
  const data = res.data.data;
  return { list: data.docs || [], total: data.total || 0 };
}

// ── Additional schemas ────────────────────────────────────────────────

export const DeleteProfilesSchema = {
  profileIds: z
    .array(z.string())
    .min(1)
    .describe("Profile IDs to delete in batch"),
};

export const ListProfilesCursorSchema = {
  cursor: z
    .string()
    .optional()
    .describe("Cursor from previous response for next page"),
  pageSize: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(20)
    .describe("Results per page (requires Nstbrowser ≥ 1.17.3)"),
};

// ── Additional handlers ───────────────────────────────────────────────

export async function deleteProfiles(profileIds: string[]) {
  const res = await nst.delete<{ data: boolean }>("/profiles", {
    data: { profileIds },
  });
  return res.data;
}

export async function listProfilesCursor(cursor?: string, pageSize = 20) {
  const res = await nst.get<{
    data: { list: NstProfile[]; nextCursor: string; hasMore: boolean };
  }>("/profiles/cursor", {
    params: { cursor, pageSize },
  });
  return res.data.data;
}
