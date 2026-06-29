import path from "node:path";
import type { ProfileSource, ResolveProfileSourceInput } from "./types";
import { loadFromGenerator } from "./sources/generator";
import { readCatalogSnapshot, writeCatalogSnapshot } from "./sources/snapshot";
import { loadFromMostLogin } from "./sources/mostlogin";
import { loadCbmCatalog } from "./sources/cbm";

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
    cbmUrl?: string;
    cbmProfileId?: string;
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

async function loadCbmSafely(): Promise<Awaited<ReturnType<typeof loadCbmCatalog>> | null> {
  try {
    return await loadCbmCatalog();
  } catch (err) {
    console.warn("[catalog] CBM source unavailable:", (err as Error).message);
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

  // For CBM source, skip mostlogin/snapshot and load directly from CBM
  if (input.requestedSource === "cbm") {
    const cbmResult = await loadCbmSafely();
    if (cbmResult) {
      return cbmResult;
    }
    // CBM unavailable — try snapshot, then generator
    const snapshot = await readCatalogSnapshot(input.snapshotPath);
    if (snapshot) {
      return snapshot.catalog as LoadedCatalog;
    }
    if (input.allowGeneratorFallback) {
      return {
        source: "generator",
        profiles: loadFromGenerator(input.poolSize),
      };
    }
    throw new Error(
      "CBM source unavailable, no snapshot, and ALLOW_GENERATOR_FALLBACK is not set",
    );
  }

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
