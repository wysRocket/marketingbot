import eurocookflowRaw from "./profiles/eurocookflow.json";
import focusclockRaw from "./profiles/focusclock.json";
import { siteProfileSchema, type FlowFlag, type SiteProfile } from "./schema";

const DEFAULT_SITE_PROFILE_ID = "eurocookflow";

function parseProfile(raw: unknown): SiteProfile {
  return siteProfileSchema.parse(raw);
}

const parsedProfiles = [parseProfile(eurocookflowRaw), parseProfile(focusclockRaw)];

const profileMap = new Map<string, SiteProfile>(
  parsedProfiles.map((profile) => [profile.id.toLowerCase(), profile]),
);

function normalizeId(id: string): string {
  return id.trim().toLowerCase();
}

export function listSiteProfileIds(): string[] {
  return [...profileMap.keys()].sort((a, b) => a.localeCompare(b));
}

export function getSiteProfile(id: string): SiteProfile {
  const normalized = normalizeId(id);
  const profile = profileMap.get(normalized);

  if (!profile) {
    throw new Error(
      `Unknown BOT_SITE_PROFILE \"${id}\". Available: ${listSiteProfileIds().join(", ")}`,
    );
  }

  return profile;
}

export function getActiveSiteProfile(): SiteProfile {
  return getSiteProfile(process.env.BOT_SITE_PROFILE ?? DEFAULT_SITE_PROFILE_ID);
}

function ensureTrailingSlash(url: string): string {
  return url.endsWith("/") ? url : `${url}/`;
}

export function resolveSiteUrl(site: SiteProfile, pathOrUrl: string): string {
  return new URL(pathOrUrl, ensureTrailingSlash(site.baseUrl)).toString();
}

export function isFlowEnabled(site: SiteProfile, flow: FlowFlag): boolean {
  return site.enabledFlows[flow];
}

export function assertFlowEnabled(site: SiteProfile, flow: FlowFlag): void {
  if (isFlowEnabled(site, flow)) return;

  throw new Error(
    `Flow \"${flow}\" is disabled for site profile \"${site.id}\".`,
  );
}

export type { SiteProfile, FlowFlag } from "./schema";
