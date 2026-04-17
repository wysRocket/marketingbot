import { promises as fs } from "node:fs";
import path from "node:path";
import {
  SessionPolicy,
  SessionTelemetry,
  TrafficBreakdownEntry,
} from "./complexSession";

const DEFAULT_TELEMETRY_DIR = "telemetry";
const CSV_HEADER = [
  "recordedAt",
  "runId",
  "runner",
  "label",
  "profileId",
  "mostloginProfileId",
  "railwayReplicaId",
  "profileSource",
  "extensionBundleHash",
  "sessionStatePolicy",
  "startedAt",
  "endedAt",
  "elapsedMs",
  "elapsedSec",
  "uniquePageCount",
  "uniquePages",
  "warningsCount",
  "warnings",
  "flowsRun",
  "interactions",
  "trafficBytesTotal",
  "trafficBytesSameOrigin",
  "trafficUploadBytesApprox",
  "trafficRequestCount",
  "trafficMonitorEnabled",
  "trafficTopOrigins",
  "trafficTopPathsSameOrigin",
  "minDurationMs",
  "minUniquePages",
  "topUpMinMs",
  "topUpMaxMs",
  "maxTopUpCycles",
  "metMinDuration",
  "metMinUniquePages",
].join(",");

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

interface TelemetryRecord {
  recordedAt: string;
  runId: string;
  runner: string;
  label: string;
  profileId: string;
  mostloginProfileId?: string;
  railwayReplicaId?: string;
  profileSource?: string;
  extensionBundleHash?: string;
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
  trafficTopOrigins: TrafficBreakdownEntry[];
  trafficTopPathsSameOrigin: TrafficBreakdownEntry[];
  policy: SessionPolicy;
  metMinDuration: boolean;
  metMinUniquePages: boolean;
}

export interface TelemetryPersistence {
  persistSession(input: PersistSessionTelemetryInput): Promise<void>;
  readonly jsonPath: string;
  readonly csvPath: string;
  readonly runId: string;
}

function csvEscape(value: string | number | boolean): string {
  const text = String(value);
  const escaped = text.replace(/"/g, '""');
  return `"${escaped}"`;
}

function toCsvRow(record: TelemetryRecord): string {
  const row = [
    record.recordedAt,
    record.runId,
    record.runner,
    record.label,
    record.profileId,
    record.mostloginProfileId ?? "",
    record.railwayReplicaId ?? "",
    record.profileSource ?? "",
    record.extensionBundleHash ?? "",
    record.sessionStatePolicy ?? "",
    record.startedAt,
    record.endedAt,
    record.elapsedMs,
    record.elapsedSec,
    record.uniquePageCount,
    JSON.stringify(record.uniquePages),
    record.warningsCount,
    JSON.stringify(record.warnings),
    JSON.stringify(record.flowsRun),
    record.interactions,
    record.trafficBytesTotal,
    record.trafficBytesSameOrigin,
    record.trafficUploadBytesApprox,
    record.trafficRequestCount,
    record.trafficMonitorEnabled,
    JSON.stringify(record.trafficTopOrigins),
    JSON.stringify(record.trafficTopPathsSameOrigin),
    record.policy.minDurationMs,
    record.policy.minUniquePages,
    record.policy.topUpMinMs,
    record.policy.topUpMaxMs,
    record.policy.maxTopUpCycles,
    record.metMinDuration,
    record.metMinUniquePages,
  ];

  return row.map((value) => csvEscape(value)).join(",") + "\n";
}

export function createTelemetryRecord(
  input: PersistSessionTelemetryInput & { runner: string; runId?: string }
) {
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

export function createTelemetryPersistence(runner: string): TelemetryPersistence {
  const outputDir = path.resolve(
    process.cwd(),
    process.env.FLOW_TELEMETRY_DIR ?? DEFAULT_TELEMETRY_DIR,
  );

  const sanitizedRunner = runner.replace(/[^a-z0-9_-]+/gi, "_");
  const jsonPath = path.join(outputDir, `${sanitizedRunner}.sessions.jsonl`);
  const csvPath = path.join(outputDir, `${sanitizedRunner}.sessions.csv`);

  const runId = `${new Date().toISOString()}-${process.pid}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  const initPromise = (async () => {
    await fs.mkdir(outputDir, { recursive: true });

    try {
      await fs.access(csvPath);
    } catch {
      await fs.writeFile(csvPath, CSV_HEADER + "\n", "utf8");
    }
  })();

  let queue: Promise<void> = Promise.resolve();

  async function persistSession(
    input: PersistSessionTelemetryInput,
  ): Promise<void> {
    const { label, profileId, telemetry, policy } = input;

    const record: TelemetryRecord = {
      recordedAt: new Date().toISOString(),
      runId,
      runner,
      label,
      profileId,
      mostloginProfileId: input.mostloginProfileId ?? "",
      railwayReplicaId: input.railwayReplicaId ?? "",
      profileSource: input.profileSource ?? "",
      extensionBundleHash: input.extensionBundleHash ?? "",
      sessionStatePolicy: input.sessionStatePolicy ?? "",
      startedAt: new Date(telemetry.startedAt).toISOString(),
      endedAt: new Date(telemetry.endedAt).toISOString(),
      elapsedMs: telemetry.elapsedMs,
      elapsedSec: Number((telemetry.elapsedMs / 1000).toFixed(2)),
      uniquePageCount: telemetry.uniquePages.length,
      uniquePages: telemetry.uniquePages,
      warningsCount: telemetry.warnings.length,
      warnings: telemetry.warnings,
      flowsRun: telemetry.flowsRun,
      interactions: telemetry.interactions,
      trafficBytesTotal: telemetry.trafficBytesTotal,
      trafficBytesSameOrigin: telemetry.trafficBytesSameOrigin,
      trafficUploadBytesApprox: telemetry.trafficUploadBytesApprox,
      trafficRequestCount: telemetry.trafficRequestCount,
      trafficMonitorEnabled: telemetry.trafficMonitorEnabled,
      trafficTopOrigins: telemetry.trafficTopOrigins,
      trafficTopPathsSameOrigin: telemetry.trafficTopPathsSameOrigin,
      policy,
      metMinDuration: telemetry.elapsedMs >= policy.minDurationMs,
      metMinUniquePages: telemetry.uniquePages.length >= policy.minUniquePages,
    };

    queue = queue
      .catch(() => {
        // Keep the queue alive after a failed write attempt.
      })
      .then(async () => {
        await initPromise;
        await fs.appendFile(jsonPath, JSON.stringify(record) + "\n", "utf8");
        await fs.appendFile(csvPath, toCsvRow(record), "utf8");
      });

    return queue;
  }

  return {
    persistSession,
    jsonPath,
    csvPath,
    runId,
  };
}
