import path from "node:path";
import type { ProfileSource, ResolveProfileSourceInput } from "./types";
import { loadFromGenerator } from "./sources/generator";
import { readCatalogSnapshot, writeCatalogSnapshot } from "./sources/snapshot";
import { loadFromMostLogin } from "./sources/mostlogin";

export interface LoadCatalogInput {
  requestedSource: ProfileSource;
  poolSize: number;
  snapshotPath: string;
  allowGeneratorFallback: boolean;
  environment: "development" | "production" | "test";
}

export interface LoadedCatalog {
  source: ProfileSource;
  profiles: Array<{
    id: string;
    name: string;
    source: ProfileSource;
    sessionStatePolicy: "cache-only" | "identity-sticky";
    mostloginProxy?: unknown;
    launchArgs?: string[];
    initScriptFlags?: Record<string, boolean | number>;
    initScript?: string;
    patchrightProfile: {
      id: string;
      name: string;
      config: Record<string, unknown>;
    };
  }>;
}

async function loadMostLoginSafely(
  _input: LoadCatalogInput,
): Promise<Awaited<ReturnType<typeof loadFromMostLogin>> | null> {
  try {
    return await loadFromMostLogin();
  } catch {
    return null;
  }
}

export async function loadCatalog(
  input: LoadCatalogInput,
): Promise<LoadedCatalog> {
  const mostloginResult =
    input.requestedSource === "generator"
      ? null
      : await loadMostLoginSafely(input);

  const snapshot = await readCatalogSnapshot(input.snapshotPath);

  const resolvedSource = resolveProfileSource({
    requestedSource: input.requestedSource,
    mostloginAvailable: Boolean(mostloginResult),
    snapshotAvailable: Boolean(snapshot),
    environment: input.environment,
    allowGeneratorFallback: input.allowGeneratorFallback,
  });

  if (resolvedSource === "mostlogin" && mostloginResult) {
    await writeCatalogSnapshot(input.snapshotPath, mostloginResult.snapshot);
    return mostloginResult.catalog;
  }

  if (resolvedSource === "snapshot" && snapshot) {
    return snapshot.catalog as LoadedCatalog;
  }

  return {
    source: "generator",
    profiles: loadFromGenerator(input.poolSize),
  };
}

export function resolveProfileSource(
  input: ResolveProfileSourceInput,
): ProfileSource {
  if (input.requestedSource === "generator") {
    return "generator";
  }

  if (input.mostloginAvailable) {
    return "mostlogin";
  }

  if (input.snapshotAvailable) {
    return "snapshot";
  }

  if (input.environment === "production" && !input.allowGeneratorFallback) {
    throw new Error(
      "Refusing silent generator fallback in production without ALLOW_GENERATOR_FALLBACK=1",
    );
  }

  return "generator";
}
