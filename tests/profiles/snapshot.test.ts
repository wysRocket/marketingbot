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

  it("considers recent snapshots fresh", () => {
    expect(
      isSnapshotFresh({
        generatedAt: "2026-04-17T00:00:00.000Z",
        maxAgeHours: 24,
        now: new Date("2026-04-17T12:00:00.000Z"),
      }),
    ).toBe(true);
  });
});
