import {
  getProfileDetail,
  listProfiles,
} from "../../mcp/mostlogin/tools/profiles";
import { mapMostLoginProfile } from "../fingerprint-mapper";

export interface MostLoginProfile {
  id: string;
  title?: string;
  name?: string;
  fingerprint?: {
    userAgent?: string;
    resolution?: string;
    languages?: string;
    timeZone?: string;
    geolocation?: number;
    latitude?: number;
    longitude?: number;
    webRTC?: string;
    canvasNoise?: boolean;
    webglNoise?: boolean;
    audioContextNoise?: boolean;
    hardwareConcurrency?: number;
  };
  proxy?: {
    protocol?: string;
    host?: string;
    port?: number;
    proxyUsername?: string;
    proxyPassword?: string;
  };
}

function extractProfileList(payload: unknown): MostLoginProfile[] {
  if (Array.isArray(payload)) {
    return payload as MostLoginProfile[];
  }

  if (
    payload &&
    typeof payload === "object" &&
    "list" in payload &&
    Array.isArray((payload as { list?: unknown[] }).list)
  ) {
    return (payload as { list: MostLoginProfile[] }).list;
  }

  return [];
}

export async function listAllMostLoginProfiles(): Promise<MostLoginProfile[]> {
  const response = await listProfiles(1, 100);
  return extractProfileList(response);
}

export async function getMostLoginProfileDetail(
  id: string,
): Promise<MostLoginProfile> {
  return (await getProfileDetail(id)) as MostLoginProfile;
}

export async function loadFromMostLogin(): Promise<{
  catalog: {
    source: "mostlogin";
    profiles: Array<{
      id: string;
      name: string;
      source: "mostlogin";
      sessionStatePolicy: "identity-sticky";
      mostloginProxy?: MostLoginProfile["proxy"];
      launchArgs: string[];
      initScriptFlags: Record<string, boolean | number>;
      initScript: string;
      patchrightProfile: {
        id: string;
        name: string;
        config: Record<string, unknown>;
      };
    }>;
  };
  snapshot: { generatedAt: string; catalog: unknown };
}> {
  const profiles = await listAllMostLoginProfiles();

  const details = await Promise.all(
    profiles.map((profile) => getMostLoginProfileDetail(profile.id)),
  );

  const catalogProfiles = details.map((detail) => {
    const mapped = mapMostLoginProfile(detail);

    return {
      id: detail.id,
      name: detail.title ?? detail.name ?? detail.id,
      source: "mostlogin" as const,
      sessionStatePolicy: "identity-sticky" as const,
      mostloginProxy: detail.proxy,
      patchrightProfile: mapped.patchrightProfile,
      launchArgs: mapped.launchArgs,
      initScriptFlags: mapped.initScriptFlags as Record<string, boolean | number>,
      initScript: mapped.initScript,
    };
  });

  const catalogResult = {
    source: "mostlogin" as const,
    profiles: catalogProfiles,
  };

  return {
    catalog: catalogResult,
    snapshot: {
      generatedAt: new Date().toISOString(),
      catalog: catalogResult,
    },
  };
}
