import { z } from 'zod';
import { nst } from '../nstClient';

// ── Zod schemas ──────────────────────────────────────────────────────

export const GetProfileGroupsSchema = {};

export const ChangeProfileGroupSchema = {
  profileId: z.string().describe('Profile ID to move'),
  groupId: z.string().describe('Target group ID'),
};

export const BatchChangeProfileGroupSchema = {
  profileIds: z.array(z.string()).min(1).describe('Profile IDs to move'),
  groupId: z.string().describe('Target group ID'),
};

// ── Handlers ─────────────────────────────────────────────────────────

export async function getProfileGroups() {
  const res = await nst.get<{ data: unknown[] }>('/profiles/groups');
  return res.data.data;
}

export async function changeProfileGroup(profileId: string, groupId: string) {
  const res = await nst.put(`/profiles/${profileId}/group`, { groupId });
  return res.data;
}

export async function batchChangeProfileGroup(profileIds: string[], groupId: string) {
  const res = await nst.put('/profiles/group/batch', { profileIds, groupId });
  return res.data;
}
