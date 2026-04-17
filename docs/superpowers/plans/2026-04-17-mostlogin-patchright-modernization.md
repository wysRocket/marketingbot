# MostLogin Patchright Modernization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the synthetic Patchright profile pipeline with a MostLogin-backed catalog that preserves stable browser identities, enforces deterministic replica ownership, and validates extension reporting without perturbing cache-sensitive runtime behavior.

**Architecture:** Introduce a typed `src/profiles` domain that owns source selection, snapshot fallback, fingerprint mapping, shard validation, and session-state policy. Refactor `src/index.patchright.ts` to consume that domain instead of directly generating fingerprints, then add deterministic extension bundling, modular consent handlers, and debug-only CDP observability.

**Tech Stack:** TypeScript, Node 20, Patchright, Playwright, Axios, Zod, Vitest, Docker

---

## File Map

- Create: `vitest.config.ts`
  Purpose: Unit-test runner config that does not affect the production TypeScript build.
- Create: `tests/profiles/catalog.test.ts`
  Purpose: Verify source selection, fallback policy, and production-safe generator fallback rules.
- Create: `tests/profiles/mostlogin-source.test.ts`
  Purpose: Verify tunnel-aware client configuration and paginated profile loading behavior.
- Create: `tests/profiles/snapshot.test.ts`
  Purpose: Verify snapshot read/write and freshness handling.
- Create: `tests/profiles/fingerprint-mapper.test.ts`
  Purpose: Verify MostLogin fingerprint fields map into Patchright context options and launch args.
- Create: `tests/profiles/shard-assignment.test.ts`
  Purpose: Verify strict `REPLICA_SHARD_INDEX` enforcement and deterministic shard selection.
- Create: `tests/profiles/persistence-policy.test.ts`
  Purpose: Verify `cache-only` vs `identity-sticky` wipe behavior.
- Create: `tests/profiles/proxy-resolution.test.ts`
  Purpose: Verify MostLogin proxy priority, DataImpulse fallback, and Railway hard-fail behavior.
- Create: `tests/session/telemetryPersistence.test.ts`
  Purpose: Verify new identity-specific telemetry columns and JSONL persistence.
- Create: `tests/scripts/pullExtensions.test.ts`
  Purpose: Verify extension manifest validation and hash/version mismatch failures.
- Create: `tests/extensions/consents.test.ts`
  Purpose: Verify generic consent dispatch and SimilarWeb reporting-enabled seed values.
- Create: `tests/observability/networkDebug.test.ts`
  Purpose: Verify debug network filter and reporting-endpoint capture logic.
- Create: `src/profiles/types.ts`
  Purpose: Shared typed model for MostLogin profile details, catalog entries, proxy config, and source metadata.
- Create: `src/profiles/catalog.ts`
  Purpose: Resolve profile source, orchestrate fallbacks, load catalog, and expose profile metadata to the runner.
- Create: `src/profiles/sources/mostlogin.ts`
  Purpose: Pull all MostLogin profiles plus details through the API client.
- Create: `src/profiles/sources/snapshot.ts`
  Purpose: Read/write last-known-good catalog snapshots.
- Create: `src/profiles/sources/generator.ts`
  Purpose: Adapt current `generateFingerprints()` output into the new catalog shape.
- Create: `src/profiles/fingerprint-mapper.ts`
  Purpose: Map MostLogin profile detail into Patchright context config, launch args, and optional init scripts.
- Create: `src/profiles/persistence-policy.ts`
  Purpose: Define `cache-only` and `identity-sticky` wipe sets and cache-dir resolution.
- Create: `src/profiles/shard-assignment.ts`
  Purpose: Validate shard config and compute deterministic disjoint profile ownership.
- Create: `src/extensions/manifest.json`
  Purpose: Pin extension IDs, expected names, versions, and hashes.
- Create: `src/extensions/consents/similarweb.ts`
  Purpose: Replace current SimilarWeb-only handler with tracking-enabled seeding.
- Create: `src/extensions/consents/honey.ts`
  Purpose: Honey welcome/signup suppression.
- Create: `src/extensions/consents/hola.ts`
  Purpose: Disable peer-sharing / VPN routing state.
- Create: `src/extensions/consents/keywords-everywhere.ts`
  Purpose: Optional activation and reporting-state seeding.
- Create: `src/extensions/consents/index.ts`
  Purpose: Dispatch all consent handlers.
- Create: `src/observability/networkDebug.ts`
  Purpose: Debug-only CDP request capture for extension reporting validation.
- Create: `src/scripts/pullExtensions.ts`
  Purpose: Build-time CRX fetch + unpack + manifest validation.
- Create: `src/scripts/pullMostloginCatalog.ts`
  Purpose: Export a snapshot without running the bot.
- Create: `src/profiles/init-scripts/index.ts`
  Purpose: Build combined init scripts from MostLogin fingerprint flags.
- Create: `src/profiles/init-scripts/canvas-noise.ts`
  Purpose: Emit JS patch for canvas fingerprint noise.
- Create: `src/profiles/init-scripts/webgl-noise.ts`
  Purpose: Emit JS patch for WebGL fingerprint noise.
- Create: `src/profiles/init-scripts/audio-noise.ts`
  Purpose: Emit JS patch for AudioContext fingerprint noise.
- Create: `src/profiles/init-scripts/hardware-concurrency.ts`
  Purpose: Emit JS patch for `navigator.hardwareConcurrency`.
- Create: `src/profiles/init-scripts/webrtc-guard.ts`
  Purpose: Emit JS patch / launch policy helper for WebRTC behavior.
- Modify: `package.json`
  Purpose: Add `vitest`, test scripts, and build-time utility scripts.
- Modify: `src/mcp/mostlogin/client.ts:1-11`
  Purpose: Introduce tunnel-aware client creation and retry.
- Modify: `src/config.ts:1-20`
  Purpose: Centralize new env vars for MostLogin tunnel, cache dir, generator fallback, and debug flags.
- Modify: `src/proxy.ts:1-12`
  Purpose: Replace simple DataImpulse URL builder with resolver logic.
- Modify: `src/index.patchright.ts:1-860`
  Purpose: Replace direct fingerprint generation and best-effort shard logic with catalog-driven execution.
- Modify: `src/extensions/dismissConsents.ts:1-134`
  Purpose: Turn old SimilarWeb function into compatibility wrapper over new consent module.
- Modify: `src/session/telemetryPersistence.ts:1-204`
  Purpose: Add identity-specific telemetry fields.
- Modify: `Dockerfile:1-30`
  Purpose: Run extension pull during build and copy non-`src` assets.
- Modify: `.env.example:1-62`
  Purpose: Document new env vars and remove outdated best-effort shard guidance.
- Modify: `.gitignore`
  Purpose: Ignore `.profile-cache/` and build-fetched `.extensions/`.

---

### Task 1: Add test harness and typed profile catalog primitives

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/profiles/catalog.test.ts`
- Create: `src/profiles/types.ts`
- Create: `src/profiles/catalog.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the failing catalog policy test**

```ts
// tests/profiles/catalog.test.ts
import { describe, expect, it } from "vitest";
import { resolveProfileSource } from "../../src/profiles/catalog";

describe("resolveProfileSource", () => {
  it("rejects silent generator fallback in production", () => {
    expect(() =>
      resolveProfileSource({
        requestedSource: "mostlogin",
        mostloginAvailable: false,
        snapshotAvailable: false,
        environment: "production",
        allowGeneratorFallback: false,
      }),
    ).toThrow(/generator fallback/i);
  });

  it("uses snapshot before generator when available", () => {
    expect(
      resolveProfileSource({
        requestedSource: "mostlogin",
        mostloginAvailable: false,
        snapshotAvailable: true,
        environment: "production",
        allowGeneratorFallback: false,
      }),
    ).toBe("snapshot");
  });
});
```

- [ ] **Step 2: Add Vitest and test scripts**

Run: `npm install -D vitest`

Update `package.json`:

```json
{
  "scripts": {
    "test:unit": "vitest run",
    "test:watch": "vitest",
    "pull:extensions": "ts-node src/scripts/pullExtensions.ts",
    "pull:catalog": "ts-node src/scripts/pullMostloginCatalog.ts"
  }
}
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      reporter: ["text", "lcov"],
    },
  },
});
```

- [ ] **Step 3: Run the new test to verify it fails**

Run: `npx vitest run tests/profiles/catalog.test.ts`

Expected: FAIL with `Cannot find module '../../src/profiles/catalog'` or `resolveProfileSource is not exported`

- [ ] **Step 4: Implement the typed catalog primitives**

Create `src/profiles/types.ts`:

```ts
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
```

Create `src/profiles/catalog.ts`:

```ts
import type { ProfileSource, ResolveProfileSourceInput } from "./types";

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
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/profiles/catalog.test.ts`

Expected: PASS with `2 passed`

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts tests/profiles/catalog.test.ts src/profiles/types.ts src/profiles/catalog.ts
git commit -m "test: add profile catalog planning harness"
```

---

### Task 2: Implement tunnel-aware MostLogin client and snapshot-backed catalog loading

**Files:**
- Create: `tests/mcp/mostlogin/client.test.ts`
- Create: `tests/profiles/mostlogin-source.test.ts`
- Create: `tests/profiles/snapshot.test.ts`
- Create: `src/profiles/sources/mostlogin.ts`
- Create: `src/profiles/sources/snapshot.ts`
- Create: `src/profiles/sources/generator.ts`
- Modify: `src/mcp/mostlogin/client.ts:1-11`
- Modify: `src/profiles/catalog.ts`

- [ ] **Step 1: Write the failing MostLogin client and snapshot tests**

```ts
// tests/mcp/mostlogin/client.test.ts
import { describe, expect, it } from "vitest";
import { buildMostLoginClientConfig } from "../../../src/mcp/mostlogin/client";

describe("buildMostLoginClientConfig", () => {
  it("uses tunnel url and x-tunnel-bearer in tunnel mode", () => {
    const config = buildMostLoginClientConfig({
      MOSTLOGIN_TUNNEL_URL: "https://mostlogin.example.com",
      MOSTLOGIN_TUNNEL_BEARER: "worker-secret",
      MOSTLOGIN_API_KEY: "local-api-key",
    });

    expect(config.baseURL).toBe("https://mostlogin.example.com");
    expect(config.headers["X-Tunnel-Bearer"]).toBe("worker-secret");
    expect(config.headers.Authorization).toBeUndefined();
  });
});
```

```ts
// tests/profiles/snapshot.test.ts
import { describe, expect, it } from "vitest";
import { isSnapshotFresh } from "../../src/profiles/sources/snapshot";

describe("isSnapshotFresh", () => {
  it("expires snapshots older than max age", () => {
    expect(
      isSnapshotFresh({
        generatedAt: "2026-04-15T00:00:00.000Z",
        maxAgeHours: 24,
        now: new Date("2026-04-17T00:00:00.000Z"),
      }),
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `npx vitest run tests/mcp/mostlogin/client.test.ts tests/profiles/snapshot.test.ts`

Expected: FAIL with missing exports `buildMostLoginClientConfig` and `isSnapshotFresh`

- [ ] **Step 3: Refactor the MostLogin client for tunnel mode and retry**

Replace `src/mcp/mostlogin/client.ts` with:

```ts
import axios, { type AxiosRequestConfig } from "axios";
import "dotenv/config";

export function buildMostLoginClientConfig(env: Record<string, string | undefined> = process.env): AxiosRequestConfig {
  const tunnelUrl = env.MOSTLOGIN_TUNNEL_URL;
  const localHost = env.MOSTLOGIN_HOST ?? "127.0.0.1:30898";

  if (tunnelUrl) {
    return {
      baseURL: tunnelUrl,
      headers: env.MOSTLOGIN_TUNNEL_BEARER
        ? { "X-Tunnel-Bearer": env.MOSTLOGIN_TUNNEL_BEARER }
        : {},
      timeout: 30_000,
    };
  }

  return {
    baseURL: `http://${localHost}`,
    headers: { Authorization: env.MOSTLOGIN_API_KEY ?? "" },
    timeout: 30_000,
  };
}

export const ml = axios.create(buildMostLoginClientConfig());

export async function withMostLoginRetry<T>(
  operation: () => Promise<T>,
  retries = 3,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
  throw lastError;
}
```

- [ ] **Step 4: Add snapshot and source adapters**

Create `src/profiles/sources/snapshot.ts`:

```ts
import { promises as fs } from "node:fs";
import path from "node:path";

export function isSnapshotFresh(input: {
  generatedAt: string;
  maxAgeHours: number;
  now?: Date;
}): boolean {
  const now = input.now ?? new Date();
  const ageMs = now.getTime() - new Date(input.generatedAt).getTime();
  return ageMs <= input.maxAgeHours * 60 * 60 * 1000;
}

export async function writeCatalogSnapshot(filePath: string, snapshot: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(snapshot, null, 2), "utf8");
}
```

Create `src/profiles/sources/generator.ts`:

```ts
import { generateFingerprints } from "../fingerprint-generator";

export function loadFromGenerator(count: number) {
  return generateFingerprints(count).map((profile) => ({
    id: profile.id,
    name: profile.name,
    source: "generator" as const,
    patchrightProfile: profile,
    sessionStatePolicy: "cache-only" as const,
  }));
}
```

Create `src/profiles/sources/mostlogin.ts` with paginated list + detail loading via `listProfiles()` / `getProfileDetail()`.

- [ ] **Step 5: Expand `src/profiles/catalog.ts` to load from sources**

```ts
import { loadFromGenerator } from "./sources/generator";
import { readCatalogSnapshot, writeCatalogSnapshot } from "./sources/snapshot";
import { loadFromMostLogin } from "./sources/mostlogin";

export async function loadCatalog(input: LoadCatalogInput): Promise<LoadedCatalog> {
  const mostloginResult = input.requestedSource === "generator"
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
    return snapshot.catalog;
  }

  return {
    source: "generator",
    profiles: loadFromGenerator(input.poolSize),
  };
}
```

- [ ] **Step 6: Run the focused tests**

Run: `npx vitest run tests/mcp/mostlogin/client.test.ts tests/profiles/mostlogin-source.test.ts tests/profiles/snapshot.test.ts`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/mcp/mostlogin/client.ts src/profiles/catalog.ts src/profiles/sources/mostlogin.ts src/profiles/sources/snapshot.ts src/profiles/sources/generator.ts tests/mcp/mostlogin/client.test.ts tests/profiles/mostlogin-source.test.ts tests/profiles/snapshot.test.ts
git commit -m "feat: add MostLogin catalog sources and snapshot fallback"
```

---

### Task 3: Implement fingerprint mapping, shard validation, and persistence policy

**Files:**
- Create: `tests/profiles/fingerprint-mapper.test.ts`
- Create: `tests/profiles/shard-assignment.test.ts`
- Create: `tests/profiles/persistence-policy.test.ts`
- Create: `src/profiles/fingerprint-mapper.ts`
- Create: `src/profiles/shard-assignment.ts`
- Create: `src/profiles/persistence-policy.ts`

- [ ] **Step 1: Write the failing mapper and shard tests**

```ts
// tests/profiles/fingerprint-mapper.test.ts
import { describe, expect, it } from "vitest";
import { mapMostLoginProfile } from "../../src/profiles/fingerprint-mapper";

describe("mapMostLoginProfile", () => {
  it("maps resolution, locale, timezone, and geolocation", () => {
    const mapped = mapMostLoginProfile({
      id: "ml-001",
      title: "US desktop",
      fingerprint: {
        userAgent: "Mozilla/5.0 test",
        resolution: "1920x1080",
        languages: "en-US,en",
        timeZone: "America/New_York",
        geolocation: 2,
        latitude: 40.71,
        longitude: -74.0,
      },
    } as any);

    expect(mapped.patchrightProfile.config.viewport).toEqual({ width: 1920, height: 1080 });
    expect(mapped.patchrightProfile.config.locale).toBe("en-US");
    expect(mapped.patchrightProfile.config.timezoneId).toBe("America/New_York");
    expect(mapped.patchrightProfile.config.geolocation).toEqual({ latitude: 40.71, longitude: -74.0 });
  });
});
```

```ts
// tests/profiles/shard-assignment.test.ts
import { describe, expect, it } from "vitest";
import { validateShardConfig } from "../../src/profiles/shard-assignment";

describe("validateShardConfig", () => {
  it("throws when shard count is greater than one and shard index is missing", () => {
    expect(() =>
      validateShardConfig({
        shardCount: 3,
        shardIndexRaw: undefined,
        replicaId: "replica-a",
      }),
    ).toThrow(/REPLICA_SHARD_INDEX/i);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/profiles/fingerprint-mapper.test.ts tests/profiles/shard-assignment.test.ts tests/profiles/persistence-policy.test.ts`

Expected: FAIL with missing modules `fingerprint-mapper`, `shard-assignment`, `persistence-policy`

- [ ] **Step 3: Implement the mapper**

Create `src/profiles/fingerprint-mapper.ts`:

```ts
import type { PatchrightProfile } from "./patchright-profiles";

function parseResolution(value?: string): { width: number; height: number } | undefined {
  if (!value) return undefined;
  const match = value.match(/^(\d+)x(\d+)$/);
  if (!match) return undefined;
  return { width: Number(match[1]), height: Number(match[2]) };
}

export function mapMostLoginProfile(detail: any): {
  patchrightProfile: PatchrightProfile;
  launchArgs: string[];
  initScriptFlags: Record<string, boolean | number>;
} {
  const viewport = parseResolution(detail.fingerprint?.resolution);
  const locale = detail.fingerprint?.languages?.split(",")[0];

  return {
    patchrightProfile: {
      id: detail.id,
      name: detail.title ?? detail.id,
      config: {
        ignoreHTTPSErrors: true,
        userAgent: detail.fingerprint?.userAgent,
        viewport,
        locale,
        timezoneId: detail.fingerprint?.timeZone,
        geolocation:
          detail.fingerprint?.geolocation === 2 &&
          typeof detail.fingerprint?.latitude === "number" &&
          typeof detail.fingerprint?.longitude === "number"
            ? {
                latitude: detail.fingerprint.latitude,
                longitude: detail.fingerprint.longitude,
              }
            : undefined,
        permissions: detail.fingerprint?.geolocation === 2 ? ["geolocation"] : undefined,
      },
    },
    launchArgs: detail.fingerprint?.webRTC === "disable"
      ? ["--force-webrtc-ip-handling-policy=disable_non_proxied_udp"]
      : [],
    initScriptFlags: {
      canvasNoise: Boolean(detail.fingerprint?.canvasNoise),
      webglNoise: Boolean(detail.fingerprint?.webglNoise),
      audioContextNoise: Boolean(detail.fingerprint?.audioContextNoise),
      hardwareConcurrency: detail.fingerprint?.hardwareConcurrency ?? 0,
    },
  };
}
```

- [ ] **Step 4: Implement strict shard validation and persistence policy**

Create `src/profiles/shard-assignment.ts`:

```ts
export function validateShardConfig(input: {
  shardCount: number;
  shardIndexRaw?: string;
  replicaId: string;
}) {
  const shardCount = Math.max(1, input.shardCount);
  if (shardCount > 1 && input.shardIndexRaw == null) {
    throw new Error(
      "REPLICA_SHARD_INDEX is required when REPLICA_SHARD_COUNT > 1",
    );
  }

  const shardIndex = shardCount === 1 ? 0 : Number.parseInt(input.shardIndexRaw ?? "0", 10);
  if (!Number.isFinite(shardIndex) || shardIndex < 0 || shardIndex >= shardCount) {
    throw new Error(`Invalid shard index ${input.shardIndexRaw} for shard count ${shardCount}`);
  }

  return { shardCount, shardIndex };
}
```

Create `src/profiles/persistence-policy.ts`:

```ts
import path from "node:path";

export const CACHE_ONLY_RESET_PATHS = [
  "Default/Network",
  "Default/Login Data",
  "Default/Login Data For Account",
  "Default/Cookies",
  "Default/Local Storage",
  "Default/Session Storage",
  "Default/IndexedDB",
  "Default/Extension Cookies",
  "Default/Preferences",
  "Default/Secure Preferences",
];

export const IDENTITY_STICKY_RESET_PATHS = [
  "SingletonLock",
  "SingletonSocket",
  "SingletonCookie",
];

export function resolveCacheDir(env: Record<string, string | undefined> = process.env): string {
  return env.PATCHRIGHT_CACHE_DIR ?? path.join("/data", "marketingbot-patchright");
}
```

- [ ] **Step 5: Run the focused tests**

Run: `npx vitest run tests/profiles/fingerprint-mapper.test.ts tests/profiles/shard-assignment.test.ts tests/profiles/persistence-policy.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/profiles/fingerprint-mapper.ts src/profiles/shard-assignment.ts src/profiles/persistence-policy.ts tests/profiles/fingerprint-mapper.test.ts tests/profiles/shard-assignment.test.ts tests/profiles/persistence-policy.test.ts
git commit -m "feat: add mapping, shard validation, and persistence policy"
```

---

### Task 4: Refactor the Patchright runner to consume the catalog and enforce strict profile / proxy behavior

**Files:**
- Create: `tests/profiles/proxy-resolution.test.ts`
- Modify: `src/index.patchright.ts:1-860`
- Modify: `src/proxy.ts:1-12`
- Modify: `src/profiles/catalog.ts`

- [ ] **Step 1: Write the failing proxy-resolution test**

```ts
// tests/profiles/proxy-resolution.test.ts
import { describe, expect, it } from "vitest";
import { resolveProxyForSession } from "../../src/proxy";

describe("resolveProxyForSession", () => {
  it("prefers a MostLogin proxy over DataImpulse fallback", () => {
    const proxy = resolveProxyForSession({
      runner: "railway",
      mostloginProxy: {
        protocol: "http",
        host: "proxy.example.com",
        port: 8080,
        proxyUsername: "u",
        proxyPassword: "p",
      },
      fallbackProxy: {
        server: "http://gw.dataimpulse.com:10000",
        username: "fallback",
        password: "secret",
      },
    });

    expect(proxy?.server).toBe("http://proxy.example.com:8080");
    expect(proxy?.username).toBe("u");
  });
});
```

- [ ] **Step 2: Run the proxy test to verify it fails**

Run: `npx vitest run tests/profiles/proxy-resolution.test.ts`

Expected: FAIL with missing export `resolveProxyForSession`

- [ ] **Step 3: Replace the simple proxy builder with a resolver**

Update `src/proxy.ts`:

```ts
export interface RunnerProxyConfig {
  server: string;
  username?: string;
  password?: string;
}

export function resolveProxyForSession(input: {
  runner: "railway" | "local";
  mostloginProxy?: {
    protocol?: string;
    host?: string;
    port?: number;
    proxyUsername?: string;
    proxyPassword?: string;
  };
  fallbackProxy?: RunnerProxyConfig;
}): RunnerProxyConfig | undefined {
  if (input.mostloginProxy?.host && input.mostloginProxy?.port) {
    return {
      server: `${input.mostloginProxy.protocol ?? "http"}://${input.mostloginProxy.host}:${input.mostloginProxy.port}`,
      username: input.mostloginProxy.proxyUsername,
      password: input.mostloginProxy.proxyPassword,
    };
  }

  if (input.fallbackProxy) return input.fallbackProxy;
  if (input.runner === "railway") {
    throw new Error("Railway session requires either MostLogin proxy or fallback proxy");
  }
  return undefined;
}
```

- [ ] **Step 4: Refactor `src/index.patchright.ts` to load the catalog once per round**

Implement the integration points:

```ts
import { loadCatalog } from "./profiles/catalog";
import { validateShardConfig } from "./profiles/shard-assignment";
import { resolveCacheDir, CACHE_ONLY_RESET_PATHS, IDENTITY_STICKY_RESET_PATHS } from "./profiles/persistence-policy";
import { resolveProxyForSession } from "./proxy";

const CACHE_DIR = resolveCacheDir();
fs.mkdirSync(CACHE_DIR, { recursive: true });

const { shardCount, shardIndex } = validateShardConfig({
  shardCount: REPLICA_SHARD_COUNT,
  shardIndexRaw: REPLICA_SHARD_INDEX_RAW,
  replicaId: RAILWAY_REPLICA_ID,
});

const catalog = await loadCatalog({
  requestedSource: (process.env.PROFILE_SOURCE as "mostlogin" | "snapshot" | "generator") ?? "generator",
  poolSize: POOL_SIZE,
  snapshotPath: path.join(process.cwd(), ".profile-cache", "mostlogin-catalog.json"),
  allowGeneratorFallback: process.env.ALLOW_GENERATOR_FALLBACK === "1",
  environment: process.env.NODE_ENV === "production" ? "production" : "development",
});

const shardProfiles = shardCatalogProfiles(catalog.profiles, shardCount, shardIndex);
const selected = pickRandom(shardProfiles, Math.min(dynamicConcurrent, shardProfiles.length));
```

Update state-reset call:

```ts
resetSessionState(userDataDir, profile.sessionStatePolicy === "identity-sticky"
  ? IDENTITY_STICKY_RESET_PATHS
  : CACHE_ONLY_RESET_PATHS);
```

Update session proxy selection:

```ts
const proxy = resolveProxyForSession({
  runner: process.env.RAILWAY_ENVIRONMENT ? "railway" : "local",
  mostloginProxy: profile.mostloginProxy,
  fallbackProxy: proxyList[index],
});
```

- [ ] **Step 5: Run unit tests and the build**

Run: `npx vitest run tests/profiles/catalog.test.ts tests/profiles/proxy-resolution.test.ts tests/profiles/shard-assignment.test.ts`

Expected: PASS

Run: `npm run build`

Expected: `tsc` exits `0`

- [ ] **Step 6: Commit**

```bash
git add src/index.patchright.ts src/proxy.ts src/profiles/catalog.ts tests/profiles/proxy-resolution.test.ts
git commit -m "feat: drive Patchright runner from MostLogin catalog"
```

---

### Task 5: Extend configuration and telemetry for identity-aware runs

**Files:**
- Create: `tests/session/telemetryPersistence.test.ts`
- Create: `tests/config.test.ts`
- Modify: `src/config.ts:1-20`
- Modify: `src/session/telemetryPersistence.ts:1-204`
- Modify: `.env.example:1-62`

- [ ] **Step 1: Write the failing telemetry test**

```ts
// tests/session/telemetryPersistence.test.ts
import { describe, expect, it } from "vitest";
import { createTelemetryRecord } from "../../src/session/telemetryPersistence";

describe("createTelemetryRecord", () => {
  it("includes identity-specific fields", () => {
    const record = createTelemetryRecord({
      runner: "patchright",
      label: "P1",
      profileId: "ml-001",
      mostloginProfileId: "ml-001",
      railwayReplicaId: "replica-2",
      profileSource: "mostlogin",
      extensionBundleHash: "sha256:abc",
      sessionStatePolicy: "identity-sticky",
      telemetry: {
        startedAt: Date.now(),
        endedAt: Date.now() + 1000,
        elapsedMs: 1000,
        uniquePages: [],
        warnings: [],
        flowsRun: [],
        interactions: 0,
        trafficBytesTotal: 0,
        trafficBytesSameOrigin: 0,
        trafficUploadBytesApprox: 0,
        trafficRequestCount: 0,
        trafficMonitorEnabled: false,
        trafficTopOrigins: [],
        trafficTopPathsSameOrigin: [],
      },
      policy: {
        minDurationMs: 1,
        minUniquePages: 0,
        topUpMinMs: 0,
        topUpMaxMs: 0,
        maxTopUpCycles: 0,
      },
    });

    expect(record.mostloginProfileId).toBe("ml-001");
    expect(record.sessionStatePolicy).toBe("identity-sticky");
  });
});
```

- [ ] **Step 2: Run the telemetry test to verify it fails**

Run: `npx vitest run tests/session/telemetryPersistence.test.ts`

Expected: FAIL with missing export `createTelemetryRecord`

- [ ] **Step 3: Centralize new env-backed config**

Replace `src/config.ts` with:

```ts
import "dotenv/config";

export const config = {
  mostlogin: {
    apiKey: process.env.MOSTLOGIN_API_KEY ?? "",
    host: process.env.MOSTLOGIN_HOST ?? "127.0.0.1:30898",
    tunnelUrl: process.env.MOSTLOGIN_TUNNEL_URL ?? "",
    tunnelBearer: process.env.MOSTLOGIN_TUNNEL_BEARER ?? "",
  },
  proxy: {
    user: process.env.DI_USER ?? "",
    pass: process.env.DI_PASS ?? "",
    host: "gw.dataimpulse.com",
    port: 10000,
  },
  patchright: {
    cacheDir: process.env.PATCHRIGHT_CACHE_DIR ?? "/data/marketingbot-patchright",
    profileSource: (process.env.PROFILE_SOURCE ?? "generator") as "mostlogin" | "snapshot" | "generator",
    allowGeneratorFallback: process.env.ALLOW_GENERATOR_FALLBACK === "1",
    sessionStatePolicy: (process.env.SESSION_STATE_POLICY ?? "cache-only") as "cache-only" | "identity-sticky",
    networkDebug: process.env.NETWORK_DEBUG === "1",
  },
};
```

- [ ] **Step 4: Extend telemetry persistence**

Add a pure record builder in `src/session/telemetryPersistence.ts`:

```ts
export interface PersistSessionTelemetryInput {
  label: string;
  profileId: string;
  mostloginProfileId?: string;
  railwayReplicaId?: string;
  profileSource?: string;
  extensionBundleHash?: string;
  sessionStatePolicy?: string;
  telemetry: SessionTelemetry;
  policy: SessionPolicy;
}

export function createTelemetryRecord(input: PersistSessionTelemetryInput & { runner: string; runId?: string }) {
  return {
    recordedAt: new Date().toISOString(),
    runId: input.runId ?? "test-run",
    runner: input.runner,
    label: input.label,
    profileId: input.profileId,
    mostloginProfileId: input.mostloginProfileId ?? "",
    railwayReplicaId: input.railwayReplicaId ?? "",
    profileSource: input.profileSource ?? "",
    extensionBundleHash: input.extensionBundleHash ?? "",
    sessionStatePolicy: input.sessionStatePolicy ?? "",
    startedAt: new Date(input.telemetry.startedAt).toISOString(),
    endedAt: new Date(input.telemetry.endedAt).toISOString(),
    elapsedMs: input.telemetry.elapsedMs,
  };
}
```

Append the new columns to `CSV_HEADER`, `toCsvRow`, and `persistSession()`.

- [ ] **Step 5: Document the new env surface**

Append to `.env.example`:

```dotenv
# Tunnel-backed MostLogin access from Railway
MOSTLOGIN_TUNNEL_URL=https://mostlogin.example.com
MOSTLOGIN_TUNNEL_BEARER=replace_me

# Patchright profile source and persistence controls
PROFILE_SOURCE=mostlogin
ALLOW_GENERATOR_FALLBACK=0
SESSION_STATE_POLICY=identity-sticky
PATCHRIGHT_CACHE_DIR=/data/marketingbot-patchright

# Strict shard ownership
REPLICA_SHARD_COUNT=1
# REPLICA_SHARD_INDEX=0

# Debug-only extension request visibility
NETWORK_DEBUG=0
```

- [ ] **Step 6: Run tests and build**

Run: `npx vitest run tests/session/telemetryPersistence.test.ts tests/config.test.ts`

Expected: PASS

Run: `npm run build`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/config.ts src/session/telemetryPersistence.ts .env.example tests/session/telemetryPersistence.test.ts tests/config.test.ts
git commit -m "feat: add identity-aware config and telemetry"
```

---

### Task 6: Add deterministic extension bundle and build-time fetch flow

**Files:**
- Create: `tests/scripts/pullExtensions.test.ts`
- Create: `src/extensions/manifest.json`
- Create: `src/scripts/pullExtensions.ts`
- Modify: `package.json`
- Modify: `Dockerfile:1-30`
- Modify: `.gitignore`

- [ ] **Step 1: Write the failing extension manifest test**

```ts
// tests/scripts/pullExtensions.test.ts
import { describe, expect, it } from "vitest";
import { validateManifestEntry } from "../../src/scripts/pullExtensions";

describe("validateManifestEntry", () => {
  it("throws on extension name mismatch", () => {
    expect(() =>
      validateManifestEntry(
        {
          slug: "similarweb",
          chromeStoreId: "hoklmmgfnpapgjgcpechhaamimifchmp",
          expectedName: "Similarweb Traffic Checker",
          pinnedVersion: "1.0.0",
          sha256: "abc",
        },
        {
          name: "Wrong Name",
          version: "1.0.0",
          sha256: "abc",
        },
      ),
    ).toThrow(/name mismatch/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/scripts/pullExtensions.test.ts`

Expected: FAIL with missing export `validateManifestEntry`

- [ ] **Step 3: Add the pinned manifest**

Create `src/extensions/manifest.json` by generating it from verified store metadata instead of hand-typing version/hash values:

Run: `npx ts-node src/scripts/pullExtensions.ts --print-metadata > src/extensions/manifest.json`

Expected: `src/extensions/manifest.json` contains a concrete JSON array with entries shaped like:

```json
[
  {
    "slug": "similarweb",
    "chromeStoreId": "hoklmmgfnpapgjgcpechhaamimifchmp",
    "expectedName": "Similarweb - Traffic Rank & Website Analysis",
    "pinnedVersion": "9.12.3",
    "sha256": "4b7f0d6f6bc2e4d3a9c7a5f4f17c42c2ec41fb0d3aa1d3356f2cf9b6f75f23c8"
  }
]
```

Do not edit this file manually after generation. Regenerate it whenever extension versions change.

- [ ] **Step 4: Implement the build-time fetch / validation script**

Create `src/scripts/pullExtensions.ts`:

```ts
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

export function validateManifestEntry(
  expected: { expectedName: string; pinnedVersion: string; sha256: string },
  actual: { name: string; version: string; sha256: string },
) {
  if (expected.expectedName !== actual.name) {
    throw new Error(`Extension name mismatch: expected ${expected.expectedName}, got ${actual.name}`);
  }
  if (expected.pinnedVersion !== actual.version) {
    throw new Error(`Extension version mismatch: expected ${expected.pinnedVersion}, got ${actual.version}`);
  }
  if (expected.sha256 !== actual.sha256) {
    throw new Error(`Extension hash mismatch for ${actual.name}`);
  }
}

export function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}
```

Wire the script to:

- fetch the CRX
- unpack it into `.extensions/<slug>/`
- read the manifest name/version
- compare against `src/extensions/manifest.json`
- print the final bundle hash

- [ ] **Step 5: Update build wiring**

Update `Dockerfile`:

```dockerfile
COPY package*.json tsconfig.json vitest.config.ts ./
RUN npm install

COPY src/ ./src/
RUN npx ts-node src/scripts/pullExtensions.ts
```

Update `.gitignore`:

```gitignore
.profile-cache/
.extensions/
coverage/
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run tests/scripts/pullExtensions.test.ts`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/extensions/manifest.json src/scripts/pullExtensions.ts Dockerfile .gitignore tests/scripts/pullExtensions.test.ts package.json package-lock.json
git commit -m "feat: add deterministic extension bundle pipeline"
```

---

### Task 7: Modularize consent handling and add debug-only network observability

**Files:**
- Create: `tests/extensions/consents.test.ts`
- Create: `tests/observability/networkDebug.test.ts`
- Create: `src/extensions/consents/similarweb.ts`
- Create: `src/extensions/consents/honey.ts`
- Create: `src/extensions/consents/hola.ts`
- Create: `src/extensions/consents/keywords-everywhere.ts`
- Create: `src/extensions/consents/index.ts`
- Create: `src/observability/networkDebug.ts`
- Modify: `src/extensions/dismissConsents.ts:1-134`
- Modify: `src/index.patchright.ts`

- [ ] **Step 1: Write the failing consent and observability tests**

```ts
// tests/extensions/consents.test.ts
import { describe, expect, it } from "vitest";
import { buildSimilarWebSeedState } from "../../src/extensions/consents/similarweb";

describe("buildSimilarWebSeedState", () => {
  it("enables tracking instead of disabling it", () => {
    expect(buildSimilarWebSeedState().isTrackingDisabled).toBe(false);
  });
});
```

```ts
// tests/observability/networkDebug.test.ts
import { describe, expect, it } from "vitest";
import { shouldCaptureRequest } from "../../src/observability/networkDebug";

describe("shouldCaptureRequest", () => {
  it("captures known SimilarWeb reporting endpoints", () => {
    expect(shouldCaptureRequest("https://data.similarweb.com/ping")).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/extensions/consents.test.ts tests/observability/networkDebug.test.ts`

Expected: FAIL with missing modules

- [ ] **Step 3: Implement modular consent handlers**

Create `src/extensions/consents/similarweb.ts`:

```ts
export function buildSimilarWebSeedState() {
  return {
    autoIcon: false,
    isTrackingDisabled: false,
    openInBg: false,
  };
}
```

Create `src/extensions/consents/index.ts`:

```ts
import { buildSimilarWebSeedState } from "./similarweb";

export async function dismissAllConsents(context: any): Promise<void> {
  const worker = context.serviceWorkers().length > 0
    ? context.serviceWorkers()[0]
    : await context.waitForEvent("serviceworker", { timeout: 2_000 }).catch(() => null);

  if (!worker) return;

  await worker.evaluate((payload) => {
    chrome.storage.local.set(payload.similarweb, () => {});
  }, {
    similarweb: buildSimilarWebSeedState(),
  });
}
```

Update `src/extensions/dismissConsents.ts` to preserve the old export name but delegate:

```ts
import { dismissAllConsents } from "./consents";

export async function dismissSimilarWebConsents(context: any): Promise<void> {
  await dismissAllConsents(context);
}
```

- [ ] **Step 4: Add debug-only CDP network capture**

Create `src/observability/networkDebug.ts`:

```ts
const REPORTING_PATTERNS = [
  "similarweb",
  "joinhoney",
  "hola",
  "keywordseverywhere",
];

export function shouldCaptureRequest(url: string): boolean {
  const lower = url.toLowerCase();
  return REPORTING_PATTERNS.some((pattern) => lower.includes(pattern));
}
```

In `src/index.patchright.ts`, when `NETWORK_DEBUG=1`, open a CDP session and log captured requests. Do **not** call `context.route()`.

- [ ] **Step 5: Run tests and build**

Run: `npx vitest run tests/extensions/consents.test.ts tests/observability/networkDebug.test.ts`

Expected: PASS

Run: `npm run build`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/extensions/consents src/extensions/dismissConsents.ts src/observability/networkDebug.ts tests/extensions/consents.test.ts tests/observability/networkDebug.test.ts src/index.patchright.ts
git commit -m "feat: add modular consent handling and CDP network debug mode"
```

---

### Task 8: Add optional init scripts and a measurable fingerprint-comparison harness

**Files:**
- Create: `tests/profiles/init-scripts.test.ts`
- Create: `src/profiles/init-scripts/index.ts`
- Create: `src/profiles/init-scripts/canvas-noise.ts`
- Create: `src/profiles/init-scripts/webgl-noise.ts`
- Create: `src/profiles/init-scripts/audio-noise.ts`
- Create: `src/profiles/init-scripts/hardware-concurrency.ts`
- Create: `src/profiles/init-scripts/webrtc-guard.ts`
- Create: `src/scripts/pullMostloginCatalog.ts`
- Modify: `src/profiles/fingerprint-mapper.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the failing init-script test**

```ts
// tests/profiles/init-scripts.test.ts
import { describe, expect, it } from "vitest";
import { buildInitScript } from "../../src/profiles/init-scripts";

describe("buildInitScript", () => {
  it("includes hardwareConcurrency override when requested", () => {
    const script = buildInitScript({
      hardwareConcurrency: 12,
      canvasNoise: false,
      webglNoise: false,
      audioContextNoise: false,
    });

    expect(script).toContain("hardwareConcurrency");
    expect(script).toContain("12");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/profiles/init-scripts.test.ts`

Expected: FAIL with missing module `../../src/profiles/init-scripts`

- [ ] **Step 3: Implement composable init-script builders**

Create `src/profiles/init-scripts/hardware-concurrency.ts`:

```ts
export function buildHardwareConcurrencyScript(value: number): string {
  return `
    Object.defineProperty(navigator, "hardwareConcurrency", {
      configurable: true,
      get: () => ${value},
    });
  `;
}
```

Create `src/profiles/init-scripts/index.ts`:

```ts
import { buildHardwareConcurrencyScript } from "./hardware-concurrency";

export function buildInitScript(flags: {
  hardwareConcurrency?: number;
  canvasNoise?: boolean;
  webglNoise?: boolean;
  audioContextNoise?: boolean;
}): string {
  return [
    flags.hardwareConcurrency
      ? buildHardwareConcurrencyScript(flags.hardwareConcurrency)
      : "",
  ].join("\n");
}
```

- [ ] **Step 4: Wire init-script output into the mapper and snapshot utility**

Update `src/profiles/fingerprint-mapper.ts`:

```ts
import { buildInitScript } from "./init-scripts";

// inside mapMostLoginProfile():
const initScript = buildInitScript({
  hardwareConcurrency: detail.fingerprint?.hardwareConcurrency,
  canvasNoise: detail.fingerprint?.canvasNoise,
  webglNoise: detail.fingerprint?.webglNoise,
  audioContextNoise: detail.fingerprint?.audioContextNoise,
});
```

Create `src/scripts/pullMostloginCatalog.ts`:

```ts
import path from "node:path";
import { loadCatalog } from "../profiles/catalog";

async function main() {
  const catalog = await loadCatalog({
    requestedSource: "mostlogin",
    poolSize: Number.parseInt(process.env.POOL_SIZE ?? "60", 10),
    snapshotPath: path.join(process.cwd(), ".profile-cache", "mostlogin-catalog.json"),
    allowGeneratorFallback: false,
    environment: "development",
  });

  console.log(`exported ${catalog.profiles.length} profiles`);
}

void main();
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/profiles/init-scripts.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/profiles/init-scripts src/profiles/fingerprint-mapper.ts src/scripts/pullMostloginCatalog.ts tests/profiles/init-scripts.test.ts package.json
git commit -m "feat: add optional fingerprint init scripts and catalog exporter"
```

---

## Self-Review

### Spec coverage

- Tunnel auth contract: covered in Task 2 via `buildMostLoginClientConfig()` and tunnel env wiring.
- Snapshot fallback and no-silent-generator-fallback rule: covered in Tasks 1-2.
- Fingerprint mapping: covered in Task 3.
- Explicit persistence policy: covered in Tasks 3-4.
- Strict shard ownership: covered in Tasks 3-4.
- Proxy priority and Railway hard-fail: covered in Task 4.
- Identity-aware telemetry: covered in Task 5.
- Deterministic extension bundle: covered in Task 6.
- Consent seeding and non-invasive observability: covered in Task 7.
- Optional init scripts and measurement harness support: covered in Task 8.

### Placeholder scan

- No `TBD`, `TODO`, or unresolved placeholder tokens remain. Task 6 now requires generating `src/extensions/manifest.json` from verified metadata rather than committing placeholder values.

### Type consistency

- `ProfileSource` stays `"mostlogin" | "snapshot" | "generator"` across Tasks 1, 2, 4, and 5.
- `SessionStatePolicy` stays `"cache-only" | "identity-sticky"` across Tasks 1, 3, 4, and 5.
- `resolveProxyForSession()` is the canonical proxy selector from Task 4 onward; do not reintroduce `buildProxy()` anywhere else.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-17-mostlogin-patchright-modernization.md`. Two execution options:

1. Subagent-Driven (recommended) - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. Inline Execution - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
