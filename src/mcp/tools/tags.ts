import { z } from 'zod';
import { nst } from '../nstClient';

// ── Zod schemas ──────────────────────────────────────────────────────

export const GetProfileTagsSchema = {};

export const CreateProfileTagsSchema = {
  profileId: z.string().describe('Profile ID to add tags to'),
  tags: z.array(z.string()).min(1).describe('Tag strings to create'),
};

export const BatchCreateProfileTagsSchema = {
  profileIds: z.array(z.string()).min(1).describe('Profile IDs to tag'),
  tags: z.array(z.string()).min(1).describe('Tag strings to create on all profiles'),
};

export const UpdateProfileTagsSchema = {
  profileId: z.string().describe('Profile ID whose tags to replace'),
  tags: z.array(z.string()).describe('New tag list (replaces existing)'),
};

export const BatchUpdateProfileTagsSchema = {
  profileIds: z.array(z.string()).min(1).describe('Profile IDs to update'),
  tags: z.array(z.string()).describe('New tag list applied to all profiles'),
};

export const ClearProfileTagsSchema = {
  profileId: z.string().describe('Profile ID whose tags to clear'),
};

export const BatchClearProfileTagsSchema = {
  profileIds: z.array(z.string()).min(1).describe('Profile IDs whose tags to clear'),
};

// ── Handlers ─────────────────────────────────────────────────────────

export async function getProfileTags() {
  const res = await nst.get<{ data: unknown[] }>('/profiles/tags');
  return res.data.data;
}

export async function createProfileTags(profileId: string, tags: string[]) {
  const res = await nst.post(`/profiles/${profileId}/tags`, { tags });
  return res.data;
}

export async function batchCreateProfileTags(profileIds: string[], tags: string[]) {
  const res = await nst.post('/profiles/tags/batch', { profileIds, tags });
  return res.data;
}

export async function updateProfileTags(profileId: string, tags: string[]) {
  const res = await nst.put(`/profiles/${profileId}/tags`, { tags });
  return res.data;
}

export async function batchUpdateProfileTags(profileIds: string[], tags: string[]) {
  const res = await nst.put('/profiles/tags/batch', { profileIds, tags });
  return res.data;
}

export async function clearProfileTags(profileId: string) {
  const res = await nst.delete(`/profiles/${profileId}/tags`);
  return res.data;
}

export async function batchClearProfileTags(profileIds: string[]) {
  const res = await nst.delete('/profiles/tags/batch', { data: { profileIds } });
  return res.data;
}
