/**
 * Unified Observability Dashboard — single port 3000
 *
 * All 5 views in one page with tab navigation:
 *   Overview | Sessions | Extensions | Network | Similarweb
 *
 * Data sources (all read from telemetry/ JSONL files):
 *   - patchright.sessions.jsonl  (bot sessions)
 *   - extension-events.jsonl    (extension HTTP events)
 *   - similarweb.observations.jsonl  (SW scrape snapshots)
 *
 * Run: npm run dashboard
 * Then: http://localhost:3000
 */

import express from "express";
import { createServer } from "http";
import { promises as fs } from "node:fs";
import * as nodefs from "node:fs";
import path from "node:path";
import readline from "node:readline";

// ── Types ──────────────────────────────────────────────────────────────────

interface SessionRecord {
  recordedAt: string; runId: string; runner: string; label: string;
  profileId: string; mostloginProfileId?: string; railwayReplicaId?: string;
  profileSource?: string; extensionBundleHash?: string; extensionSlugs: string[];
  sessionStatePolicy?: string; targetDomain?: string; referrerType?: string;
  startedAt: string; endedAt: string; elapsedMs: number; elapsedSec: number;
  uniquePageCount: number; uniquePages: string[]; warningsCount: number;
  warnings: string[]; flowsRun: string[]; interactions: number;
  trafficBytesTotal: number; trafficBytesSameOrigin: number;
  trafficUploadBytesApprox: number; trafficRequestCount: number;
  trafficMonitorEnabled: boolean; metMinDuration: boolean; metMinUniquePages: boolean;
  policy: { minDurationMs: number; minUniquePages: number; topUpMinMs: number; topUpMaxMs: number; maxTopUpCycles: number };
  trafficTopOrigins?: Array<{ key?: string; origin?: string; bytes: number; requests: number }>;
}

interface ExtEvent {
  timestamp: number; type: string; url: string; method: string;
  requestHeaders: Record<string, string>; responseHeaders?: Record<string, string>;
  requestBody?: string; responseBody?: string; statusCode?: number;
  resourceType: string; extensionId?: string; matchedDomain: string; runId?: string;
}

interface SWObservation {
  observedAt: string; domain: string;
  hours?: number;
  fetch: { source: string; status: number | null; challengeHeader: string | null };
  similarweb: {
    snapshot: {
      domain: string; globalRank: number | null; visitsTotalCount: number | null;
      pagesPerVisit: number | null; bounceRate: number | null;
      visitsAvgDurationFormatted: string | null;
    } | null;
    note: string;
  };
  telemetry: { sessionCount: number; successCount: number; windowStart?: string; windowEnd?: string };
}

// ── Data loading ────────────────────────────────────────────────────────────

const TELEMETRY_DIR = path.resolve(process.cwd(), process.env.FLOW_TELEMETRY_DIR ?? "telemetry");

async function loadJsonl<T>(filePath: string): Promise<T[]> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return raw.split("\n").filter(Boolean).map((l) => JSON.parse(l) as T);
  } catch { return []; }
}

async function loadAllData() {
  const [sessions, extEvents, swObservations] = await Promise.all([
    loadJsonl<SessionRecord>(path.join(TELEMETRY_DIR, "patchright.sessions.jsonl")),
    loadJsonl<ExtEvent>(path.join(TELEMETRY_DIR, "extension-events.jsonl")),
    loadJsonl<SWObservation>(path.join(TELEMETRY_DIR, "similarweb.observations.jsonl")),
  ]);
  return {
    sessions: sessions.slice(-500),
    extEvents: extEvents.slice(-200),
    swObservations,
  };
}

// ── Server ──────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.DASHBOARD_PORT ?? "3000", 10);
const app = express();

// Serve static HTML
app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

// Unified data endpoint
app.get("/api/data", async (_req, res) => {
  try {
    const data = await loadAllData();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Health
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, port: PORT });
});

// Clear extension events (for the Extensions tab)
app.post("/api/clear-events", async (_req, res) => {
  try {
    const eventsPath = path.join(TELEMETRY_DIR, "extension-events.jsonl");
    await fs.writeFile(eventsPath, "", "utf8");
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

const server = createServer(app);
server.listen(PORT, () => {
  console.log(`🧭 Unified Dashboard: http://localhost:${PORT}`);
});

process.on("SIGINT", () => { server.close(); process.exit(0); });

if (require.main === module) {
  // Already started above
}
