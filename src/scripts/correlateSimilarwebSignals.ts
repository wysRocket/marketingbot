#!/usr/bin/env node
/**
 * correlateSimilarwebSignals.ts
 *
 * Correlates marketingbot session telemetry with Similarweb observation snapshots
 * to determine whether bot sessions with browser extensions are producing
 * measurable Similarweb visibility signals.
 *
 * Usage:
 *   npm run sw:correlate
 *   npm run sw:correlate -- --domain guidenza.com --days 7
 *   npm run sw:correlate -- --domain focusclock.ai --hours 48 --min-sessions 5
 *
 * Output: JSON report to stdout + appended to telemetry/sw.correlations.jsonl
 */

import "dotenv/config";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  readTelemetryRecords,
  resolvePatchrightTelemetryPath,
  type SimilarwebObservationRecord,
  type SimilarwebSnapshot,
  type TelemetryWindowSummary,
} from "../observability/similarwebSignal";

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

interface CliOptions {
  domain: string;
  telemetryPath: string;
  observationsPath: string;
  outputPath: string;
  hours: number;
  minSessions: number;
  verbose: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    domain: process.env.SW_CORRELATE_DOMAIN ?? process.env.SIMILARWEB_DOMAIN ?? "eurocookflow.com",
    telemetryPath: process.env.FLOW_TELEMETRY_DIR
      ? path.resolve(process.env.FLOW_TELEMETRY_DIR, "patchright.sessions.jsonl")
      : resolvePatchrightTelemetryPath(process.cwd()),
    observationsPath:
      process.env.SIMILARWEB_OBSERVATION_JSONL ??
      path.resolve(process.cwd(), "telemetry", "similarweb.observations.jsonl"),
    outputPath: path.resolve(process.cwd(), "telemetry", "sw.correlations.jsonl"),
    hours: Number.parseInt(process.env.SW_CORRELATE_HOURS ?? "168", 10), // 7 days default
    minSessions: Number.parseInt(process.env.SW_CORRELATE_MIN_SESSIONS ?? "3", 10),
    verbose: argv.includes("--verbose") || argv.includes("-v"),
  };

  for (let i = 0; i < argv.length; i++) {
    const v = argv[i]!;
    const next = argv[i + 1];
    if (v === "--domain" && next) { options.domain = next; i++; continue; }
    if (v === "--hours" && next) { options.hours = Number.parseInt(next, 10); i++; continue; }
    if (v === "--days" && next) { options.hours = Number.parseInt(next, 10) * 24; i++; continue; }
    if (v === "--min-sessions" && next) { options.minSessions = Number.parseInt(next, 10); i++; continue; }
    if (v === "--telemetry" && next) { options.telemetryPath = path.resolve(next); i++; continue; }
    if (v === "--observations" && next) { options.observationsPath = path.resolve(next); i++; continue; }
    if (v === "--output" && next) { options.outputPath = path.resolve(next); i++; continue; }
  }

  return options;
}

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

interface TelemetryRecord {
  recordedAt: string;
  runId: string;
  runner: string;
  label: string;
  profileId: string;
  mostloginProfileId?: string;
  profileSource?: string;
  extensionBundleHash?: string;
  extensionSlugs: string[];
  sessionStatePolicy?: string;
  startedAt: string;
  endedAt: string;
  elapsedMs: number;
  elapsedSec: number;
  uniquePageCount: number;
  uniquePages: string[];
  warningsCount: number;
  warnings: string[];
  flowsRun: string[];
  interactions: number;
  trafficBytesTotal: number;
  trafficBytesSameOrigin: number;
  trafficUploadBytesApprox: number;
  trafficRequestCount: number;
  trafficMonitorEnabled: boolean;
  metMinDuration: boolean;
  metMinUniquePages: boolean;
  policy: {
    minDurationMs: number;
    minUniquePages: number;
    topUpMinMs: number;
    topUpMaxMs: number;
    maxTopUpCycles: number;
  };
}

async function loadTelemetry(jsonlPath: string): Promise<TelemetryRecord[]> {
  try {
    const raw = await fs.promises.readFile(jsonlPath, "utf8");
    return raw.split("\n").filter(Boolean).map((l) => JSON.parse(l) as TelemetryRecord);
  } catch {
    return [];
  }
}

async function loadObservations(jsonlPath: string): Promise<SimilarwebObservationRecord[]> {
  try {
    const raw = await fs.promises.readFile(jsonlPath, "utf8");
    return raw.split("\n").filter(Boolean).map((l) => JSON.parse(l) as SimilarwebObservationRecord);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Correlation logic
// ---------------------------------------------------------------------------

interface SessionBucket {
  date: string;            // YYYY-MM-DD
  domain: string;
  extensionSlugs: string[];
  extensionBundleHash: string;
  sessionCount: number;
  totalElapsedSec: number;
  avgElapsedSec: number;
  totalUniquePages: number;
  avgUniquePages: number;
  totalInteractions: number;
  totalTrafficBytes: number;
  metMinDurationCount: number;
  metMinUniquePagesCount: number;
  warningCount: number;
  failures: number;
  profiles: string[];
}

interface SnapshotDelta {
  firstObservedAt: string;
  lastObservedAt: string;
  visitsStart: number | null;
  visitsEnd: number | null;
  visitsDelta: number | null;
  globalRankStart: number | null;
  globalRankEnd: number | null;
  globalRankDelta: number | null;
  pagesPerVisitStart: number | null;
  pagesPerVisitEnd: number | null;
  bounceRateStart: number | null;
  bounceRateEnd: number | null;
  observationCount: number;
}

interface CorrelationReport {
  generatedAt: string;
  domain: string;
  analysisWindowHours: number;
  baselineSnapshot: SimilarwebSnapshot | null;
  latestSnapshot: SimilarwebSnapshot | null;
  snapshotDelta: SnapshotDelta;
  sessionBuckets: SessionBucket[];
  totalSessions: number;
  uniqueExtensionBundles: string[];
  correlationNote: string;
  recommendation: string;
}

function groupSessionsByDay(
  records: TelemetryRecord[],
  domain: string,
  windowHours: number,
): Map<string, TelemetryRecord[]> {
  const now = Date.now();
  const windowMs = windowHours * 60 * 60 * 1000;
  const cutoff = now - windowMs;

  const filtered = records.filter((r) => {
    const ts = Date.parse(r.endedAt || r.recordedAt);
    if (!Number.isFinite(ts) || ts < cutoff) return false;
    // Match sessions that visited the target domain
    return r.uniquePages.some((p) => p.includes(domain));
  });

  const byDay = new Map<string, TelemetryRecord[]>();
  for (const r of filtered) {
    const day = (r.endedAt || r.recordedAt).slice(0, 10); // YYYY-MM-DD
    const existing = byDay.get(day) ?? [];
    existing.push(r);
    byDay.set(day, existing);
  }
  return byDay;
}

function buildSessionBucket(day: string, domain: string, sessions: TelemetryRecord[]): SessionBucket {
  const extSlugs = [...new Set(sessions.flatMap((s) => s.extensionSlugs))].sort();
  const extHash = sessions[0]?.extensionBundleHash ?? "(unknown)";
  const profiles = [...new Set(sessions.map((s) => s.profileId))].sort();

  return {
    date: day,
    domain,
    extensionSlugs: extSlugs,
    extensionBundleHash: extHash,
    sessionCount: sessions.length,
    totalElapsedSec: sessions.reduce((s, r) => s + (r.elapsedSec || 0), 0),
    avgElapsedSec: Math.round(sessions.reduce((s, r) => s + (r.elapsedSec || 0), 0) / sessions.length),
    totalUniquePages: sessions.reduce((s, r) => s + r.uniquePageCount, 0),
    avgUniquePages: +(sessions.reduce((s, r) => s + r.uniquePageCount, 0) / sessions.length).toFixed(1),
    totalInteractions: sessions.reduce((s, r) => s + r.interactions, 0),
    totalTrafficBytes: sessions.reduce((s, r) => s + r.trafficBytesSameOrigin, 0),
    metMinDurationCount: sessions.filter((s) => s.metMinDuration).length,
    metMinUniquePagesCount: sessions.filter((s) => s.metMinUniquePages).length,
    warningCount: sessions.filter((s) => s.warningsCount > 0).length,
    failures: sessions.filter((s) => s.warnings.some((w) => w.includes("failed") || w.includes("timed out"))).length,
    profiles,
  };
}

function computeSnapshotDelta(observations: SimilarwebObservationRecord[]): SnapshotDelta {
  if (observations.length === 0) {
    return {
      firstObservedAt: "",
      lastObservedAt: "",
      visitsStart: null,
      visitsEnd: null,
      visitsDelta: null,
      globalRankStart: null,
      globalRankEnd: null,
      globalRankDelta: null,
      pagesPerVisitStart: null,
      pagesPerVisitEnd: null,
      bounceRateStart: null,
      bounceRateEnd: null,
      observationCount: 0,
    };
  }

  const sorted = [...observations].sort((a, b) =>
    a.observedAt.localeCompare(b.observedAt),
  );
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;

  return {
    firstObservedAt: first.observedAt,
    lastObservedAt: last.observedAt,
    visitsStart: first.similarweb.snapshot?.visitsTotalCount ?? null,
    visitsEnd: last.similarweb.snapshot?.visitsTotalCount ?? null,
    visitsDelta:
      first.similarweb.snapshot?.visitsTotalCount != null &&
      last.similarweb.snapshot?.visitsTotalCount != null
        ? last.similarweb.snapshot.visitsTotalCount! - first.similarweb.snapshot.visitsTotalCount!
        : null,
    globalRankStart: first.similarweb.snapshot?.globalRank ?? null,
    globalRankEnd: last.similarweb.snapshot?.globalRank ?? null,
    globalRankDelta:
      first.similarweb.snapshot?.globalRank != null &&
      last.similarweb.snapshot?.globalRank != null
        ? last.similarweb.snapshot.globalRank! - first.similarweb.snapshot.globalRank!
        : null,
    pagesPerVisitStart: first.similarweb.snapshot?.pagesPerVisit ?? null,
    pagesPerVisitEnd: last.similarweb.snapshot?.pagesPerVisit ?? null,
    bounceRateStart: first.similarweb.snapshot?.bounceRate ?? null,
    bounceRateEnd: last.similarweb.snapshot?.bounceRate ?? null,
    observationCount: sorted.length,
  };
}

function generateRecommendation(
  buckets: SessionBucket[],
  delta: SnapshotDelta,
): string {
  const totalSessions = buckets.reduce((s, b) => s + b.sessionCount, 0);

  if (totalSessions === 0) {
    return "No sessions found in the analysis window. Run the bot first, then re-check.";
  }

  if (delta.observationCount < 2) {
    return "Not enough Similarweb observations yet. Run check:similarweb at least 2x over 48h and re-correlate.";
  }

  if (delta.visitsDelta == null) {
    return "Similarweb snapshot data unavailable. Check SCRAPFLY_KEY for bypassed fetches.";
  }

  if (delta.visitsDelta > 0) {
    return `POSITIVE: visitsTotalCount increased by ${delta.visitsDelta} during the analysis window. ${totalSessions} sessions were run with extensions: ${[...new Set(buckets.flatMap((b) => b.extensionSlugs))].join(", ") || "(none)"}. Correlation detected — Similarweb is counting visits from extension-loaded sessions.`;
  }

  if (delta.visitsDelta === 0) {
    return `NEUTRAL: visitsTotalCount unchanged (${delta.visitsStart} → ${delta.visitsEnd}). ${totalSessions} sessions ran but Similarweb may need more time (24-48h reporting lag) or more volume. Consider increasing session count or adding more extension diversity.`;
  }

  return `NEGATIVE: visitsTotalCount decreased by ${Math.abs(delta.visitsDelta)}. This may indicate natural fluctuation. Continue monitoring over a longer window.`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));

  const [telemetry, observations] = await Promise.all([
    loadTelemetry(opts.telemetryPath),
    loadObservations(opts.observationsPath),
  ]);

  const filteredObs = observations.filter(
    (o) => o.domain === opts.domain,
  );

  const dayGroups = groupSessionsByDay(telemetry, opts.domain, opts.hours);
  const buckets: SessionBucket[] = [];
  for (const [day, sessions] of dayGroups) {
    buckets.push(buildSessionBucket(day, opts.domain, sessions));
  }
  buckets.sort((a, b) => a.date.localeCompare(b.date));

  const delta = computeSnapshotDelta(filteredObs);

  const report: CorrelationReport = {
    generatedAt: new Date().toISOString(),
    domain: opts.domain,
    analysisWindowHours: opts.hours,
    baselineSnapshot: filteredObs[0]?.similarweb?.snapshot ?? null,
    latestSnapshot: filteredObs[filteredObs.length - 1]?.similarweb?.snapshot ?? null,
    snapshotDelta: delta,
    sessionBuckets: buckets,
    totalSessions: buckets.reduce((s, b) => s + b.sessionCount, 0),
    uniqueExtensionBundles: [...new Set(buckets.map((b) => b.extensionBundleHash))],
    correlationNote:
      buckets.length === 0
        ? "No matching sessions found for this domain in the analysis window."
        : `Found ${buckets.reduce((s, b) => s + b.sessionCount, 0)} sessions across ${buckets.length} day(s) with ${[...new Set(buckets.flatMap((b) => b.extensionSlugs))].length} extension configuration(s).`,
    recommendation: generateRecommendation(buckets, delta),
  };

  // Write JSONL output
  await fs.promises.mkdir(path.dirname(opts.outputPath), { recursive: true });
  await fs.promises.appendFile(
    opts.outputPath,
    JSON.stringify(report) + "\n",
    "utf8",
  );

  // Pretty-print summary
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  Similarweb Correlation Report — ${report.domain}`);
  console.log(`  Generated: ${report.generatedAt}`);
  console.log("═══════════════════════════════════════════════════════════");
  console.log();
  console.log(`  Analysis window: ${opts.hours}h`);
  console.log(`  Total sessions:  ${report.totalSessions}`);
  console.log(`  Days with data:  ${buckets.length}`);
  console.log();

  if (buckets.length > 0) {
    console.log("  Sessions by day:");
    for (const b of buckets) {
      console.log(
        `    ${b.date}  ${b.sessionCount} sessions  avg ${b.avgElapsedSec}s  ${b.avgUniquePages} pages  extensions: [${b.extensionSlugs.join(", ") || "none"}]`,
      );
    }
    console.log();
  }

  if (delta.observationCount > 0) {
    console.log("  Similarweb snapshot delta:");
    console.log(
      `    visitsTotalCount: ${delta.visitsStart} → ${delta.visitsEnd}  (${delta.visitsDelta != null ? (delta.visitsDelta >= 0 ? "+" : "") + delta.visitsDelta : "N/A"})`,
    );
    console.log(
      `    globalRank:       ${delta.globalRankStart ?? "N/A"} → ${delta.globalRankEnd ?? "N/A"}  (${delta.globalRankDelta != null ? (delta.globalRankDelta >= 0 ? "+" : "") + String(delta.globalRankDelta) : "N/A"})`,
    );
    console.log(
      `    pagesPerVisit:    ${delta.pagesPerVisitStart ?? "N/A"} → ${delta.pagesPerVisitEnd ?? "N/A"}`,
    );
    console.log(`    observations:     ${delta.observationCount}`);
    console.log();
  }

  console.log("  Recommendation:");
  console.log(`    ${report.recommendation}`);
  console.log();
  console.log(`  Full report: ${opts.outputPath}`);
  console.log("═══════════════════════════════════════════════════════════");

  // Also write full JSON for programmatic consumption
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(`[sw:correlate] ${(err as Error).stack ?? (err as Error).message}`);
  process.exit(1);
});
