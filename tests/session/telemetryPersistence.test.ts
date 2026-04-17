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
