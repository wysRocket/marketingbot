import { z } from "zod";
import { ml } from "../client";

// ── Schemas ──────────────────────────────────────────────────────────

export const OpenBrowserSchema = {
  profileId: z.string().describe("Profile ID to launch"),
  ignoreStartUrls: z
    .boolean()
    .optional()
    .default(false)
    .describe("Suppress the profile's configured startup URLs"),
  urls: z
    .array(z.string())
    .optional()
    .describe(
      "URLs to open on launch (only used when ignoreStartUrls is true)",
    ),
};

export const CloseProfilesSchema = {
  profileIds: z
    .array(z.string().length(32))
    .min(1)
    .describe("Profile IDs to close (each must be exactly 32 characters)"),
};

// ── Handlers ─────────────────────────────────────────────────────────

export async function openBrowser(params: {
  profileId: string;
  ignoreStartUrls?: boolean;
  urls?: string[];
}) {
  const res = await ml.post("/api/browser/openBrowser", params);
  return res.data;
}

export async function closeProfiles(profileIds: string[]) {
  const res = await ml.post("/api/browser/closeProfiles", { profileIds });
  return res.data;
}

export async function closeAllProfiles() {
  const res = await ml.post("/api/browser/closeAllProfiles", {});
  return res.data;
}
