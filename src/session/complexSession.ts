import { Page } from "playwright";
import { navigate } from "../actions/navigate";
import { randomBrowse, randomInt } from "../actions/interact";

const DEFAULT_BASE_URL = "https://example.com";

export interface SessionPolicy {
  minDurationMs: number;
  minUniquePages: number;
  topUpMinMs: number;
  topUpMaxMs: number;
  maxTopUpCycles: number;
}

export interface SessionTelemetry {
  startedAt: number;
  endedAt: number;
  elapsedMs: number;
  uniquePages: string[];
  warnings: string[];
  flowsRun: string[];
  interactions: number;
  trafficBytesTotal: number;
  trafficBytesSameOrigin: number;
  trafficUploadBytesApprox: number;
  trafficRequestCount: number;
  trafficMonitorEnabled: boolean;
  trafficTopOrigins: TrafficBreakdownEntry[];
  trafficTopPathsSameOrigin: TrafficBreakdownEntry[];
}

export interface SessionContext {
  policy: SessionPolicy;
  trackNavigation(url: string): void;
  addWarning(msg: string): void;
  addInteraction(count?: number): void;
}

export type FlowRunner = (
  page: Page,
  label: string,
  ctx: SessionContext,
) => Promise<void>;

export interface NamedFlow {
  name: string;
  run: FlowRunner;
}

interface RunComplexSessionOptions {
  page: Page;
  label: string;
  flows: NamedFlow[];
  policy?: Partial<SessionPolicy>;
  baseUrl?: string;
  seedCandidates?: string[];
  log?: (message: string) => void;
}

const DEFAULT_POLICY: SessionPolicy = {
  minDurationMs: 150_000,
  minUniquePages: 6,
  topUpMinMs: 8_000,
  topUpMaxMs: 22_000,
  maxTopUpCycles: 8,
};

const DEFAULT_PATH_CANDIDATES = [
  "/",
];

interface TrafficSnapshot {
  trafficBytesTotal: number;
  trafficBytesSameOrigin: number;
  trafficUploadBytesApprox: number;
  trafficRequestCount: number;
  trafficMonitorEnabled: boolean;
  trafficTopOrigins: TrafficBreakdownEntry[];
  trafficTopPathsSameOrigin: TrafficBreakdownEntry[];
}

export interface TrafficBreakdownEntry {
  key: string;
  bytes: number;
  requests: number;
}

interface TrafficStats {
  bytes: number;
  requests: number;
}

function parsePositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

export function getSessionPolicyFromEnv(
  overrides: Partial<SessionPolicy> = {},
): SessionPolicy {
  const envPolicy: SessionPolicy = {
    minDurationMs: parsePositiveIntEnv(
      "FLOW_MIN_DURATION_MS",
      DEFAULT_POLICY.minDurationMs,
    ),
    minUniquePages: parsePositiveIntEnv(
      "FLOW_MIN_UNIQUE_PAGES",
      DEFAULT_POLICY.minUniquePages,
    ),
    topUpMinMs: DEFAULT_POLICY.topUpMinMs,
    topUpMaxMs: DEFAULT_POLICY.topUpMaxMs,
    maxTopUpCycles: parsePositiveIntEnv(
      "FLOW_TOPUP_MAX_CYCLES",
      DEFAULT_POLICY.maxTopUpCycles,
    ),
  };

  return {
    ...envPolicy,
    ...overrides,
  };
}

function normalizeTrackedUrl(url: string, baseOrigin: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.origin !== baseOrigin) return null;
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }
    return `${parsed.origin}${parsed.pathname}${parsed.search}`;
  } catch {
    return null;
  }
}

function toAbsoluteCandidate(candidate: string, baseUrl: string): string | null {
  try {
    const parsed = new URL(candidate, baseUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

async function collectSameOriginLinks(
  page: Page,
  baseOrigin: string,
  fallbackBaseUrl: string,
): Promise<string[]> {
  const rawLinks = await page
    .$$eval("a[href]", (anchors) =>
      anchors
        .map((anchor) => anchor.getAttribute("href") ?? "")
        .filter(Boolean),
    )
    .catch((): string[] => []);

  const pageUrl = page.url() || fallbackBaseUrl;
  const links = new Set<string>();

  for (const href of rawLinks) {
    try {
      const parsed = new URL(href, pageUrl);
      if (parsed.origin !== baseOrigin) continue;
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        continue;
      }
      links.add(`${parsed.origin}${parsed.pathname}${parsed.search}`);
    } catch {
      // Ignore malformed links.
    }
  }

  return [...links];
}

function chooseCandidate(
  candidates: Set<string>,
  visitedPages: Set<string>,
  baseOrigin: string,
): string | undefined {
  const all = [...candidates].filter((candidate) => {
    const normalized = normalizeTrackedUrl(candidate, baseOrigin);
    return Boolean(normalized);
  });

  if (all.length === 0) return undefined;

  const unvisited = all.filter((candidate) => {
    const normalized = normalizeTrackedUrl(candidate, baseOrigin);
    if (!normalized) return false;
    return !visitedPages.has(normalized);
  });

  const pool = unvisited.length > 0 ? unvisited : all;
  return pool[randomInt(0, pool.length - 1)];
}

function addTrafficRequest(map: Map<string, TrafficStats>, key: string): void {
  const current = map.get(key) ?? { bytes: 0, requests: 0 };
  current.requests += 1;
  map.set(key, current);
}

function addTrafficBytes(
  map: Map<string, TrafficStats>,
  key: string,
  bytes: number,
): void {
  const current = map.get(key) ?? { bytes: 0, requests: 0 };
  current.bytes += bytes;
  map.set(key, current);
}

function toTopBreakdown(
  map: Map<string, TrafficStats>,
  limit: number,
): TrafficBreakdownEntry[] {
  return [...map.entries()]
    .map(([key, stats]) => ({
      key,
      bytes: Math.max(0, Math.round(stats.bytes)),
      requests: Math.max(0, Math.round(stats.requests)),
    }))
    .sort((a, b) => {
      if (b.bytes !== a.bytes) return b.bytes - a.bytes;
      if (b.requests !== a.requests) return b.requests - a.requests;
      return a.key.localeCompare(b.key);
    })
    .slice(0, limit);
}

async function startTrafficMonitor(
  page: Page,
  baseOrigin: string,
  log: (message: string) => void,
): Promise<{
  snapshot: () => TrafficSnapshot;
  stop: () => Promise<void>;
}> {
  let bytesTotal = 0;
  let bytesSameOrigin = 0;
  let uploadBytesApprox = 0;
  let requestCount = 0;
  let enabled = false;
  const breakdownLimit = parsePositiveIntEnv("FLOW_TRAFFIC_BREAKDOWN_LIMIT", 20);

  const requestIdMeta = new Map<
    string,
    { url: string; origin: string; sameOriginPath?: string }
  >();
  const originStats = new Map<string, TrafficStats>();
  const sameOriginPathStats = new Map<string, TrafficStats>();
  let cdp: { send: Function; on: Function; detach: Function } | undefined;

  try {
    cdp = await page.context().newCDPSession(page);
    await cdp.send("Network.enable");
    enabled = true;

    cdp.on("Network.requestWillBeSent", (event: unknown) => {
      const e = event as {
        requestId?: string;
        request?: { url?: string; postData?: string };
      };

      requestCount += 1;
      if (e.requestId && e.request?.url) {
        try {
          const parsed = new URL(e.request.url);
          addTrafficRequest(originStats, parsed.origin);

          const sameOriginPath =
            parsed.origin === baseOrigin ? parsed.pathname : undefined;
          if (sameOriginPath) {
            addTrafficRequest(sameOriginPathStats, sameOriginPath);
          }

          requestIdMeta.set(e.requestId, {
            url: e.request.url,
            origin: parsed.origin,
            sameOriginPath,
          });
        } catch {
          // Ignore malformed URLs.
        }
      }

      if (e.request?.postData) {
        uploadBytesApprox += Buffer.byteLength(e.request.postData, "utf8");
      }
    });

    cdp.on("Network.loadingFinished", (event: unknown) => {
      const e = event as { requestId?: string; encodedDataLength?: number };
      const requestId = e.requestId;
      if (!requestId) return;

      const bytes =
        typeof e.encodedDataLength === "number" && e.encodedDataLength > 0
          ? e.encodedDataLength
          : 0;

      bytesTotal += bytes;

      const meta = requestIdMeta.get(requestId);
      if (meta) {
        addTrafficBytes(originStats, meta.origin, bytes);

        if (meta.origin === baseOrigin) {
          bytesSameOrigin += bytes;
          if (meta.sameOriginPath) {
            addTrafficBytes(sameOriginPathStats, meta.sameOriginPath, bytes);
          }
        }
      }

      requestIdMeta.delete(requestId);
    });

    cdp.on("Network.loadingFailed", (event: unknown) => {
      const e = event as { requestId?: string };
      if (e.requestId) {
        requestIdMeta.delete(e.requestId);
      }
    });
  } catch (err) {
    log(
      `  [traffic] Warning: CDP traffic monitor disabled: ${(err as Error).message}`,
    );
  }

  return {
    snapshot: () => ({
      trafficBytesTotal: Math.max(0, Math.round(bytesTotal)),
      trafficBytesSameOrigin: Math.max(0, Math.round(bytesSameOrigin)),
      trafficUploadBytesApprox: Math.max(0, Math.round(uploadBytesApprox)),
      trafficRequestCount: Math.max(0, requestCount),
      trafficMonitorEnabled: enabled,
      trafficTopOrigins: toTopBreakdown(originStats, breakdownLimit),
      trafficTopPathsSameOrigin: toTopBreakdown(
        sameOriginPathStats,
        breakdownLimit,
      ),
    }),
    stop: async () => {
      if (!cdp) return;
      await cdp.detach().catch(() => {
        // Non-critical cleanup.
      });
    },
  };
}

export async function runComplexSession(
  options: RunComplexSessionOptions,
): Promise<SessionTelemetry> {
  const {
    page,
    label,
    flows,
    policy: policyOverrides,
    baseUrl = DEFAULT_BASE_URL,
    seedCandidates = [],
    log = console.log,
  } = options;

  const policy = getSessionPolicyFromEnv(policyOverrides);
  const startedAt = Date.now();
  const baseOrigin = new URL(baseUrl).origin;
  const trafficMonitor = await startTrafficMonitor(page, baseOrigin, log);

  const uniquePageSet = new Set<string>();
  const warnings: string[] = [];
  const flowsRun: string[] = [];
  let interactions = 0;

  const candidateTargets = new Set<string>();

  const addCandidate = (candidate: string): void => {
    const absolute = toAbsoluteCandidate(candidate, baseUrl);
    if (!absolute) return;
    const normalized = normalizeTrackedUrl(absolute, baseOrigin);
    if (!normalized) return;
    candidateTargets.add(normalized);
  };

  for (const path of DEFAULT_PATH_CANDIDATES) {
    addCandidate(path);
  }
  for (const seed of seedCandidates) {
    addCandidate(seed);
  }

  const ctx: SessionContext = {
    policy,
    trackNavigation(url: string): void {
      const normalized = normalizeTrackedUrl(url, baseOrigin);
      if (normalized) {
        uniquePageSet.add(normalized);
      }
    },
    addWarning(msg: string): void {
      warnings.push(msg);
    },
    addInteraction(count = 1): void {
      interactions += count;
    },
  };

  ctx.trackNavigation(page.url());

  try {
    for (const flow of flows) {
      flowsRun.push(flow.name);
      log(`\n[${label}] Running: ${flow.name}...`);

      try {
        await flow.run(page, label, ctx);
      } catch (err) {
        const message = (err as Error)?.message ?? String(err);
        const warning = `Flow \"${flow.name}\" failed: ${message}`;
        ctx.addWarning(warning);
        log(`  [${label}] Warning: ${warning}`);
      }

      ctx.trackNavigation(page.url());
      ctx.addInteraction();

      const discovered = await collectSameOriginLinks(page, baseOrigin, baseUrl);
      for (const link of discovered) {
        addCandidate(link);
      }
    }

    let topUpCycle = 0;

    while (
      (Date.now() - startedAt < policy.minDurationMs ||
        uniquePageSet.size < policy.minUniquePages) &&
      topUpCycle < policy.maxTopUpCycles
    ) {
      topUpCycle += 1;

      const elapsed = Date.now() - startedAt;
      const needsDuration = elapsed < policy.minDurationMs;
      const needsUniquePages = uniquePageSet.size < policy.minUniquePages;

      // If unique-page target is already met, avoid extra navigations and
      // satisfy remaining time with on-page browsing only.
      if (!needsUniquePages && needsDuration) {
        const remaining = policy.minDurationMs - elapsed;
        await randomBrowse(
          page,
          Math.min(policy.topUpMinMs, remaining),
          Math.min(policy.topUpMaxMs, remaining + 1_500),
        );
        ctx.addInteraction();
        ctx.trackNavigation(page.url());
        continue;
      }

      const discovered = await collectSameOriginLinks(page, baseOrigin, baseUrl);
      for (const link of discovered) {
        addCandidate(link);
      }

      const target = chooseCandidate(candidateTargets, uniquePageSet, baseOrigin);
      if (!target) {
        const warning = "No same-origin candidate page available for top-up.";
        ctx.addWarning(warning);
        log(`  [${label}] Warning: ${warning}`);
        break;
      }

      log(
        `  [${label}] Top-up ${topUpCycle}/${policy.maxTopUpCycles}: ${target}`,
      );

      try {
        await navigate(page, target, page.url() || undefined);
        ctx.trackNavigation(page.url());

        const discoveredAfterNav = await collectSameOriginLinks(
          page,
          baseOrigin,
          baseUrl,
        );
        for (const link of discoveredAfterNav) {
          addCandidate(link);
        }

        await randomBrowse(page, policy.topUpMinMs, policy.topUpMaxMs);
        ctx.addInteraction(2);
        ctx.trackNavigation(page.url());
      } catch (err) {
        const message = (err as Error)?.message ?? String(err);
        const warning = `Top-up cycle ${topUpCycle} failed on ${target}: ${message}`;
        ctx.addWarning(warning);
        log(`  [${label}] Warning: ${warning}`);
      }
    }

    const elapsedMs = Date.now() - startedAt;
    if (elapsedMs < policy.minDurationMs) {
      const remainingMs = policy.minDurationMs - elapsedMs;
      log(
        `  [${label}] Final dwell top-up: ~${Math.ceil(remainingMs / 1000)}s to satisfy min duration`,
      );
      await randomBrowse(page, remainingMs, remainingMs + 1_500).catch((err) => {
        const message = (err as Error)?.message ?? String(err);
        const warning = `Final dwell top-up failed: ${message}`;
        ctx.addWarning(warning);
        log(`  [${label}] Warning: ${warning}`);
      });
      ctx.addInteraction();
      ctx.trackNavigation(page.url());
    }

    if (uniquePageSet.size < policy.minUniquePages) {
      const warning =
        `Unique page target missed (${uniquePageSet.size}/${policy.minUniquePages}) ` +
        `after ${policy.maxTopUpCycles} top-up cycle(s).`;
      ctx.addWarning(warning);
      log(`  [${label}] Warning: ${warning}`);
    }
  } finally {
    await trafficMonitor.stop();
  }

  const endedAt = Date.now();
  const traffic = trafficMonitor.snapshot();

  return {
    startedAt,
    endedAt,
    elapsedMs: endedAt - startedAt,
    uniquePages: [...uniquePageSet],
    warnings,
    flowsRun,
    interactions,
    trafficBytesTotal: traffic.trafficBytesTotal,
    trafficBytesSameOrigin: traffic.trafficBytesSameOrigin,
    trafficUploadBytesApprox: traffic.trafficUploadBytesApprox,
    trafficRequestCount: traffic.trafficRequestCount,
    trafficMonitorEnabled: traffic.trafficMonitorEnabled,
    trafficTopOrigins: traffic.trafficTopOrigins,
    trafficTopPathsSameOrigin: traffic.trafficTopPathsSameOrigin,
  };
}
