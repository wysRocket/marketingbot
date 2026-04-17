import { ml, withMostLoginRetry } from "../../mcp/mostlogin/client";

export interface MostLoginProfile {
  id: string;
  title?: string;
  name?: string;
  fingerprint?: Record<string, unknown>;
  proxy?: {
    protocol?: string;
    host?: string;
    port?: number;
    proxyUsername?: string;
    proxyPassword?: string;
  };
}

export async function listAllMostLoginProfiles(): Promise<MostLoginProfile[]> {
  return withMostLoginRetry(async () => {
    const response = await ml.get<MostLoginProfile[]>("/api/v1/profile/list");
    return response.data ?? [];
  });
}

export async function getMostLoginProfileDetail(
  id: string,
): Promise<MostLoginProfile> {
  return withMostLoginRetry(async () => {
    const response = await ml.get<MostLoginProfile>(`/api/v1/profile/detail/${id}`);
    return response.data;
  });
}

export async function loadFromMostLogin(): Promise<{
  catalog: { source: "mostlogin"; profiles: Array<{
    id: string;
    name: string;
    source: "mostlogin";
    sessionStatePolicy: "identity-sticky";
    mostloginProxy?: MostLoginProfile["proxy"];
    patchrightProfile: { id: string; name: string; config: Record<string, unknown> };
  }> };
  snapshot: { generatedAt: string; catalog: unknown };
}> {
  const profiles = await listAllMostLoginProfiles();

  const catalogProfiles = profiles.map((p) => ({
    id: p.id,
    name: p.title ?? p.name ?? p.id,
    source: "mostlogin" as const,
    sessionStatePolicy: "identity-sticky" as const,
    mostloginProxy: p.proxy,
    patchrightProfile: {
      id: p.id,
      name: p.title ?? p.name ?? p.id,
      config: {
        ignoreHTTPSErrors: true,
        userAgent: p.fingerprint?.userAgent as string | undefined,
      },
    },
  }));

  const catalogResult = { source: "mostlogin" as const, profiles: catalogProfiles };

  return {
    catalog: catalogResult,
    snapshot: {
      generatedAt: new Date().toISOString(),
      catalog: catalogResult,
    },
  };
}
