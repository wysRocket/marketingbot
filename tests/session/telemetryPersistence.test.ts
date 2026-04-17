import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createTelemetryPersistence,
  createTelemetryRecord,
} from "../../src/session/telemetryPersistence";

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
      extensionSlugs: ["similarweb"],
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
    expect(record.extensionBundleHash).toBe("sha256:abc");
    expect(record.extensionSlugs).toEqual(["similarweb"]);
  });
});

describe("createTelemetryPersistence", () => {
  afterEach(() => {
    delete process.env.FLOW_TELEMETRY_DIR;
    vi.restoreAllMocks();
  });

  it("persists extension slugs and bundle hashes to JSONL and CSV output", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "telemetry-test-"));
    process.env.FLOW_TELEMETRY_DIR = tempDir;

    const persistence = createTelemetryPersistence("patchright");
    await persistence.persistSession({
      label: "P1",
      profileId: "ml-001",
      mostloginProfileId: "ml-001",
      railwayReplicaId: "replica-2",
      profileSource: "mostlogin",
      extensionBundleHash: "sha256:abc",
      extensionSlugs: ["similarweb"],
      sessionStatePolicy: "identity-sticky",
      telemetry: {
        startedAt: 1_700_000_000_000,
        endedAt: 1_700_000_001_000,
        elapsedMs: 1000,
        uniquePages: ["https://example.com/"],
        warnings: [],
        flowsRun: ["browseHomepage"],
        interactions: 3,
        trafficBytesTotal: 10,
        trafficBytesSameOrigin: 8,
        trafficUploadBytesApprox: 1,
        trafficRequestCount: 2,
        trafficMonitorEnabled: true,
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

    const jsonl = await readFile(persistence.jsonPath, "utf8");
    const csv = await readFile(persistence.csvPath, "utf8");
    const record = JSON.parse(jsonl.trim());

    expect(record.extensionBundleHash).toBe("sha256:abc");
    expect(record.extensionSlugs).toEqual(["similarweb"]);
    expect(csv).toContain("extensionSlugs");
    expect(csv).toContain('"[""similarweb""]"');
    expect(csv).toContain("sha256:abc");
  });
});
