import { describe, expect, it } from "vitest";
import {
  extractSimilarwebSnapshot,
  parseSimilarwebAppDataFromHtml,
  summarizeTelemetryWindow,
  type PersistedTelemetryRecord,
} from "../../src/observability/similarwebSignal";

describe("summarizeTelemetryWindow", () => {
  it("summarizes patchright sessions in the requested window", () => {
    const now = Date.parse("2026-04-19T03:00:00.000Z");
    const records: PersistedTelemetryRecord[] = [
      {
        runner: "patchright",
        label: "P1",
        endedAt: "2026-04-19T02:30:00.000Z",
        startedAt: "2026-04-19T02:27:00.000Z",
        elapsedMs: 180_000,
        warningsCount: 0,
        trafficBytesSameOrigin: 1500,
        trafficRequestCount: 25,
        uniquePageCount: 4,
        profileId: "profile-a",
        mostloginProfileId: "profile-a",
        extensionSlugs: ["similarweb"],
        profileSource: "mostlogin",
      },
      {
        runner: "patchright",
        label: "P1",
        endedAt: "2026-04-19T01:20:00.000Z",
        startedAt: "2026-04-19T01:15:00.000Z",
        elapsedMs: 300_000,
        warningsCount: 1,
        trafficBytesSameOrigin: 2500,
        trafficRequestCount: 35,
        uniquePageCount: 5,
        profileId: "profile-b",
        mostloginProfileId: "profile-b",
        extensionSlugs: ["similarweb"],
        profileSource: "mostlogin",
      },
      {
        runner: "mostlogin",
        label: "P1",
        endedAt: "2026-04-19T02:40:00.000Z",
        startedAt: "2026-04-19T02:35:00.000Z",
        elapsedMs: 300_000,
        warningsCount: 0,
        trafficBytesSameOrigin: 999,
        trafficRequestCount: 9,
        uniquePageCount: 2,
        profileId: "ignored",
        mostloginProfileId: "ignored",
        extensionSlugs: ["similarweb"],
        profileSource: "mostlogin",
      },
    ];

    const summary = summarizeTelemetryWindow(records, {
      now,
      windowHours: 2,
    });

    expect(summary.windowStart).toBe("2026-04-19T01:00:00.000Z");
    expect(summary.windowEnd).toBe("2026-04-19T03:00:00.000Z");
    expect(summary.sessionCount).toBe(2);
    expect(summary.successCount).toBe(1);
    expect(summary.warningSessionCount).toBe(1);
    expect(summary.totalElapsedMs).toBe(480_000);
    expect(summary.totalTrafficBytesSameOrigin).toBe(4000);
    expect(summary.totalTrafficRequestCount).toBe(60);
    expect(summary.maxUniquePageCount).toBe(5);
    expect(summary.profileIds).toEqual(["profile-a", "profile-b"]);
    expect(summary.extensionSlugs).toEqual(["similarweb"]);
  });

  it("returns an inactive summary when no patchright sessions are present", () => {
    const summary = summarizeTelemetryWindow([], {
      now: Date.parse("2026-04-19T03:00:00.000Z"),
      windowHours: 2,
    });

    expect(summary.sessionCount).toBe(0);
    expect(summary.successCount).toBe(0);
    expect(summary.warningSessionCount).toBe(0);
    expect(summary.profileIds).toEqual([]);
    expect(summary.extensionSlugs).toEqual([]);
  });
});

describe("parseSimilarwebAppDataFromHtml", () => {
  it("extracts hidden app data from a Similarweb page shell", () => {
    const html = `
      <html>
        <body>
          <script>
            window.__APP_DATA__ = {"layout":{"data":{"overview":{"globalRank":123,"visitsTotalCount":456},"traffic":{"history":[{"date":"2026-04-01T00:00:00","visits":456}]}}}};
            window.__APP_META__ = {"locale":"en-US"};
          </script>
        </body>
      </html>
    `;

    const parsed = parseSimilarwebAppDataFromHtml(html);

    expect(parsed).toEqual({
      layout: {
        data: {
          overview: {
            globalRank: 123,
            visitsTotalCount: 456,
          },
          traffic: {
            history: [{ date: "2026-04-01T00:00:00", visits: 456 }],
          },
        },
      },
    });
  });
});

describe("extractSimilarwebSnapshot", () => {
  it("pulls a compact observation snapshot from Similarweb app data", () => {
    const snapshot = extractSimilarwebSnapshot(
      {
        layout: {
          data: {
            overview: {
              globalRank: 12345,
              globalRankChange: -12,
              countryRank: 678,
              categoryRank: 90,
              visitsTotalCount: 54321,
              pagesPerVisit: 2.5,
              bounceRate: 0.42,
              visitsAvgDurationFormatted: "00:03:10",
            },
            traffic: {
              visitsTotalCountChange: 0.15,
              history: [
                { date: "2026-03-01T00:00:00", visits: 50000 },
                { date: "2026-04-01T00:00:00", visits: 54321 },
              ],
            },
          },
        },
      },
      "eurocookflow.com",
    );

    expect(snapshot).toEqual({
      domain: "eurocookflow.com",
      globalRank: 12345,
      globalRankChange: -12,
      countryRank: 678,
      categoryRank: 90,
      visitsTotalCount: 54321,
      visitsTotalCountChange: 0.15,
      pagesPerVisit: 2.5,
      bounceRate: 0.42,
      visitsAvgDurationFormatted: "00:03:10",
      latestMonthlyHistoryPoint: {
        date: "2026-04-01T00:00:00",
        visits: 54321,
      },
    });
  });
});
