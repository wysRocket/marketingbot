import { z } from 'zod';
import { nst } from '../nstClient';

// ── Zod schemas ──────────────────────────────────────────────────────

export const ClearProfileCacheSchema = {
  profileId: z.string().describe('Profile ID whose local browser cache to clear'),
};

export const ClearProfileCookiesSchema = {
  profileId: z.string().describe('Profile ID whose local cookies to clear'),
};

// ── Handlers ─────────────────────────────────────────────────────────

export async function clearProfileCache(profileId: string) {
  const res = await nst.delete(`/locals/${profileId}/cache`);
  return res.data;
}

export async function clearProfileCookies(profileId: string) {
  const res = await nst.delete(`/locals/${profileId}/cookies`);
  return res.data;
}
