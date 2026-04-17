export type ProfileSource = "mostlogin" | "snapshot" | "generator";
export type SessionStatePolicy = "cache-only" | "identity-sticky";

export interface MostLoginProxyConfig {
  protocol?: string;
  host?: string;
  port?: number;
  proxyUsername?: string;
  proxyPassword?: string;
}

export interface CatalogEntry {
  id: string;
  name: string;
  source: ProfileSource;
  sessionStatePolicy: SessionStatePolicy;
}

export interface ResolveProfileSourceInput {
  requestedSource: ProfileSource;
  mostloginAvailable: boolean;
  snapshotAvailable: boolean;
  environment: "development" | "production" | "test";
  allowGeneratorFallback: boolean;
}
