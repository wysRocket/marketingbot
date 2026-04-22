import axios from "axios";
import { promises as fs } from "node:fs";
import path from "node:path";

export interface PersistedTelemetryRecord {
  runner?: string;
  label?: string;
  startedAt?: string;
  endedAt?: string;
  elapsedMs?: number;
  warningsCount?: number;
  trafficBytesSameOrigin?: number;
  trafficRequestCount?: number;
  uniquePageCount?: number;
  profileId?: string;
  mostloginProfileId?: string;
  extensionSlugs?: string[];
  profileSource?: string;
}

export interface TelemetryWindowSummary {
  windowStart: string;
  windowEnd: string;
  sessionCount: number;
  successCount: number;
  warningSessionCount: number;
  totalElapsedMs: number;
  totalTrafficBytesSameOrigin: number;
  totalTrafficRequestCount: number;
  maxUniquePageCount: number;
  profileIds: string[];
  extensionSlugs: string[];
}

export interface SimilarwebMonthlyHistoryPoint {
  date: string;
  visits: number;
}

export interface SimilarwebSnapshot {
  domain: string;
  globalRank: number | null;
  globalRankChange: number | null;
  countryRank: number | null;
  categoryRank: number | null;
  visitsTotalCount: number | null;
  visitsTotalCountChange: number | null;
  pagesPerVisit: number | null;
  bounceRate: number | null;
  visitsAvgDurationFormatted: string | null;
  latestMonthlyHistoryPoint: SimilarwebMonthlyHistoryPoint | null;
}

export interface SimilarwebFetchResult {
  html: string;
  source: "scrapfly" | "direct";
  status: number;
  challengeHeader: string | null;
}

export interface SimilarwebObservationRecord {
  observedAt: string;
  domain: string;
  hours: number;
  telemetry: TelemetryWindowSummary;
  fetch: {
    source: SimilarwebFetchResult["source"] | "none";
    status: number | null;
    challengeHeader: string | null;
  };
  similarweb: {
    snapshot: SimilarwebSnapshot | null;
    note: string;
  };
}

function toIso(input: number): string {
  return new Date(input).toISOString();
}

function normalizeNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function stableSort(values: Iterable<string>): string[] {
  return [...new Set(values)].filter(Boolean).sort((a, b) => a.localeCompare(b));
}

function extractJsonAssignment(html: string, marker: string): string | null {
  const markerIndex = html.indexOf(marker);
  if (markerIndex === -1) return null;

  let index = markerIndex + marker.length;
  while (index < html.length && /\s/.test(html[index] ?? "")) {
    index += 1;
  }

  if (html[index] !== "{") return null;

  let depth = 0;
  let inString = false;
  let isEscaped = false;

  for (let cursor = index; cursor < html.length; cursor += 1) {
    const char = html[cursor] ?? "";

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (char === "\\") {
        isEscaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return html.slice(index, cursor + 1);
      }
    }
  }

  return null;
}

export function summarizeTelemetryWindow(
  records: PersistedTelemetryRecord[],
  input: { now?: number; windowHours: number },
): TelemetryWindowSummary {
  const now = input.now ?? Date.now();
  const windowMs = input.windowHours * 60 * 60 * 1000;
  const windowStart = now - windowMs;

  const filtered = records.filter((record) => {
    if (record.runner !== "patchright") return false;
    if (!record.endedAt) return false;
    const endedAt = Date.parse(record.endedAt);
    if (!Number.isFinite(endedAt)) return false;
    return endedAt >= windowStart && endedAt <= now;
  });

  return {
    windowStart: toIso(windowStart),
    windowEnd: toIso(now),
    sessionCount: filtered.length,
    successCount: filtered.filter((record) => (record.warningsCount ?? 0) === 0)
      .length,
    warningSessionCount: filtered.filter(
      (record) => (record.warningsCount ?? 0) > 0,
    ).length,
    totalElapsedMs: filtered.reduce(
      (sum, record) => sum + (record.elapsedMs ?? 0),
      0,
    ),
    totalTrafficBytesSameOrigin: filtered.reduce(
      (sum, record) => sum + (record.trafficBytesSameOrigin ?? 0),
      0,
    ),
    totalTrafficRequestCount: filtered.reduce(
      (sum, record) => sum + (record.trafficRequestCount ?? 0),
      0,
    ),
    maxUniquePageCount: filtered.reduce(
      (max, record) => Math.max(max, record.uniquePageCount ?? 0),
      0,
    ),
    profileIds: stableSort(
      filtered.flatMap((record) =>
        [record.mostloginProfileId, record.profileId].filter(
          (value): value is string => Boolean(value),
        ),
      ),
    ),
    extensionSlugs: stableSort(
      filtered.flatMap((record) => record.extensionSlugs ?? []),
    ),
  };
}

export function parseSimilarwebAppDataFromHtml(html: string): unknown {
  const match = html.match(
    /window\.__APP_DATA__\s*=\s*(\{.*?\})\s*;\s*window\.__APP_META__/s,
  );

  const payload = match?.[1] ?? extractJsonAssignment(html, "window.__APP_DATA__ =");

  if (!payload) {
    throw new Error("Could not find Similarweb window.__APP_DATA__ payload");
  }

  return JSON.parse(payload);
}

export function extractSimilarwebSnapshot(
  appData: unknown,
  domain: string,
): SimilarwebSnapshot {
  const data = ((appData as { layout?: { data?: Record<string, unknown> } })
    ?.layout?.data ?? {}) as {
    overview?: Record<string, unknown>;
    traffic?: Record<string, unknown>;
  };

  const overview = data.overview ?? {};
  const traffic = data.traffic ?? {};
  const history = Array.isArray(traffic.history) ? traffic.history : [];
  const latestPoint = history[history.length - 1] as
    | { date?: unknown; visits?: unknown }
    | undefined;

  return {
    domain,
    globalRank: normalizeNumber(overview.globalRank),
    globalRankChange: normalizeNumber(overview.globalRankChange),
    countryRank: normalizeNumber(overview.countryRank),
    categoryRank: normalizeNumber(overview.categoryRank),
    visitsTotalCount: normalizeNumber(overview.visitsTotalCount),
    visitsTotalCountChange: normalizeNumber(traffic.visitsTotalCountChange),
    pagesPerVisit: normalizeNumber(overview.pagesPerVisit),
    bounceRate: normalizeNumber(overview.bounceRate),
    visitsAvgDurationFormatted: normalizeString(
      overview.visitsAvgDurationFormatted,
    ),
    latestMonthlyHistoryPoint:
      latestPoint &&
      typeof latestPoint === "object" &&
      normalizeString(latestPoint.date) &&
      normalizeNumber(latestPoint.visits) !== null
        ? {
            date: normalizeString(latestPoint.date)!,
            visits: normalizeNumber(latestPoint.visits)!,
          }
        : null,
  };
}

export async function readTelemetryRecords(
  jsonlPath: string,
): Promise<PersistedTelemetryRecord[]> {
  const content = await fs.readFile(jsonlPath, "utf8");
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as PersistedTelemetryRecord);
}

export function resolvePatchrightTelemetryPath(cwd = process.cwd()): string {
  const telemetryDir = process.env.FLOW_TELEMETRY_DIR ?? "telemetry";
  return path.resolve(cwd, telemetryDir, "patchright.sessions.jsonl");
}

export async function fetchSimilarwebHtml(
  domain: string,
  options: { scrapflyKey?: string } = {},
): Promise<SimilarwebFetchResult> {
  const url = `https://www.similarweb.com/website/${domain}/`;
  const scrapflyKey = options.scrapflyKey ?? process.env.SCRAPFLY_KEY;

  if (scrapflyKey) {
    const response = await axios.get("https://api.scrapfly.io/scrape", {
      params: {
        key: scrapflyKey,
        url,
        asp: true,
        country: "US",
      },
      timeout: 160_000,
    });

    return {
      html: response.data?.result?.content ?? "",
      source: "scrapfly",
      status: response.status,
      challengeHeader: null,
    };
  }

  const response = await axios.get<string>(url, {
    responseType: "text",
    timeout: 30_000,
    validateStatus: () => true,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
    },
  });

  return {
    html: response.data ?? "",
    source: "direct",
    status: response.status,
    challengeHeader:
      typeof response.headers["x-amzn-waf-action"] === "string"
        ? response.headers["x-amzn-waf-action"]
        : null,
  };
}

export async function appendSimilarwebObservation(
  record: SimilarwebObservationRecord,
  outputPath: string,
): Promise<void> {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.appendFile(outputPath, `${JSON.stringify(record)}\n`, "utf8");
}
