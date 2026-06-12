/**
 * Similarweb Correlation Dashboard — port 3004
 *
 * Joins session telemetry with Similarweb observation snapshots to show
 * whether bot sessions with browser extensions produce measurable
 * Similarweb visibility signals.
 *
 * Data sources:
 *   - telemetry/patchright.sessions.jsonl  (session records)
 *   - telemetry/similarweb.observations.jsonl  (SW scrape snapshots)
 *   - telemetry/sw.correlations.jsonl  (cached correlation reports)
 *
 * Run: npm run sw:dashboard
 * Then: http://localhost:3004/?domain=guidenza.com
 */

import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { promises as fs } from "node:fs";
import * as nodefs from "node:fs";
import path from "node:path";
import readline from "node:readline";

// ── Types ──────────────────────────────────────────────────────────────────

interface SessionRecord {
  recordedAt: string;
  runId: string;
  runner: string;
  label: string;
  profileId: string;
  extensionBundleHash?: string;
  extensionSlugs: string[];
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
  trafficRequestCount: number;
  trafficMonitorEnabled: boolean;
  metMinDuration: boolean;
  metMinUniquePages: boolean;
  policy: { minDurationMs: number; minUniquePages: number; topUpMinMs: number; topUpMaxMs: number; maxTopUpCycles: number };
}

interface SimilarwebSnapshot {
  domain: string;
  globalRank: number | null;
  visitsTotalCount: number | null;
  pagesPerVisit: number | null;
  bounceRate: number | null;
  visitsAvgDurationFormatted: string | null;
}

interface SimilarwebObservation {
  observedAt: string;
  domain: string;
  fetch: { source: string; status: number | null; challengeHeader: string | null };
  similarweb: { snapshot: SimilarwebSnapshot | null; note: string };
  telemetry: { sessionCount: number; successCount: number };
}

interface SessionBucket {
  date: string;
  domain: string;
  extensionSlugs: string[];
  extensionBundleHash: string;
  sessionCount: number;
  avgElapsedSec: number;
  avgUniquePages: number;
  totalInteractions: number;
  totalTrafficBytes: number;
  metMinDurationCount: number;
  profiles: string[];
}

interface SnapshotDelta {
  visitsStart: number | null;
  visitsEnd: number | null;
  visitsDelta: number | null;
  globalRankStart: number | null;
  globalRankEnd: number | null;
  globalRankDelta: number | null;
  observationCount: number;
}

interface CorrelationData {
  domain: string;
  totalSessions: number;
  sessionBuckets: SessionBucket[];
  snapshotDelta: SnapshotDelta;
  observations: SimilarwebObservation[];
  uniqueExtensionBundles: string[];
  recommendation: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const DEFAULT_SESSIONS_PATH = (cwd: string) =>
  path.resolve(cwd, process.env.FLOW_TELEMETRY_DIR ?? "telemetry", "patchright.sessions.jsonl");
const DEFAULT_OBSERVATIONS_PATH = (cwd: string) =>
  path.resolve(cwd, "telemetry", "similarweb.observations.jsonl");

async function loadJsonl<T>(filePath: string): Promise<T[]> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return raw.split("\n").filter(Boolean).map((l) => JSON.parse(l) as T);
  } catch {
    return [];
  }
}

async function loadJsonlIncremental(filePath: string, lastSize: number): Promise<{ events: SimilarwebObservation[]; newSize: number }> {
  try {
    const stat = await fs.stat(filePath);
    if (stat.size <= lastSize) return { events: [], newSize: lastSize };
    const fd = await fs.open(filePath, "r");
    const buf = Buffer.alloc(stat.size - lastSize);
    await fd.read(buf, 0, buf.length, lastSize);
    await fd.close();
    const lines = buf.toString("utf8").split("\n").filter(Boolean);
    return {
      events: lines.map((l) => JSON.parse(l) as SimilarwebObservation),
      newSize: stat.size,
    };
  } catch {
    return { events: [], newSize: lastSize };
  }
}

function buildCorrelation(
  domain: string,
  sessions: SessionRecord[],
  observations: SimilarwebObservation[],
  hours: number,
): CorrelationData {
  const now = Date.now();
  const cutoff = now - hours * 60 * 60 * 1000;

  // Filter sessions by domain + time window
  const filtered = sessions.filter((s) => {
    const ts = Date.parse(s.endedAt || s.recordedAt);
    return Number.isFinite(ts) && ts >= cutoff && s.uniquePages.some((p) => p.includes(domain));
  });

  // Group by day
  const byDay = new Map<string, SessionRecord[]>();
  for (const s of filtered) {
    const day = (s.endedAt || s.recordedAt).slice(0, 10);
    const existing = byDay.get(day) ?? [];
    existing.push(s);
    byDay.set(day, existing);
  }

  const sessionBuckets: SessionBucket[] = [];
  const sortedDays = [...byDay.keys()].sort();
  for (const day of sortedDays) {
    const records = byDay.get(day)!;
    const extSlugs = [...new Set(records.flatMap((r) => r.extensionSlugs))].sort();
    sessionBuckets.push({
      date: day,
      domain,
      extensionSlugs: extSlugs,
      extensionBundleHash: records[0]?.extensionBundleHash ?? "(unknown)",
      sessionCount: records.length,
      avgElapsedSec: Math.round(records.reduce((a, r) => a + (r.elapsedSec || 0), 0) / records.length),
      avgUniquePages: +(records.reduce((a, r) => a + r.uniquePageCount, 0) / records.length).toFixed(1),
      totalInteractions: records.reduce((a, r) => a + r.interactions, 0),
      totalTrafficBytes: records.reduce((a, r) => a + r.trafficBytesSameOrigin, 0),
      metMinDurationCount: records.filter((r) => r.metMinDuration).length,
      profiles: [...new Set(records.map((r) => r.profileId))].sort(),
    });
  }

  // Observations
  const domainObs = observations
    .filter((o) => o.domain === domain && Date.parse(o.observedAt) >= cutoff)
    .sort((a, b) => a.observedAt.localeCompare(b.observedAt));

  const first = domainObs[0];
  const last = domainObs[domainObs.length - 1];
  const snapshotDelta: SnapshotDelta = {
    visitsStart: first?.similarweb?.snapshot?.visitsTotalCount ?? null,
    visitsEnd: last?.similarweb?.snapshot?.visitsTotalCount ?? null,
    visitsDelta:
      first?.similarweb?.snapshot?.visitsTotalCount != null &&
      last?.similarweb?.snapshot?.visitsTotalCount != null
        ? last!.similarweb!.snapshot!.visitsTotalCount! - first!.similarweb!.snapshot!.visitsTotalCount!
        : null,
    globalRankStart: first?.similarweb?.snapshot?.globalRank ?? null,
    globalRankEnd: last?.similarweb?.snapshot?.globalRank ?? null,
    globalRankDelta:
      first?.similarweb?.snapshot?.globalRank != null &&
      last?.similarweb?.snapshot?.globalRank != null
        ? last!.similarweb!.snapshot!.globalRank! - first!.similarweb!.snapshot!.globalRank!
        : null,
    observationCount: domainObs.length,
  };

  const totalSessions = sessionBuckets.reduce((a, b) => a + b.sessionCount, 0);
  const extBundles = [...new Set(sessionBuckets.map((b) => b.extensionBundleHash))];

  let recommendation: string;
  if (totalSessions === 0) {
    recommendation = "No sessions found. Run the bot first.";
  } else if (domainObs.length < 2) {
    recommendation = "Not enough Similarweb observations. Run check:similarweb at least 2x over 48h.";
  } else if (snapshotDelta.visitsDelta == null) {
    recommendation = "Similarweb snapshot data unavailable. Check SCRAPFLY_KEY.";
  } else if (snapshotDelta.visitsDelta > 0) {
    recommendation = `POSITIVE: visits increased by ${snapshotDelta.visitsDelta} during the window. ${totalSessions} sessions with extensions: ${extBundles.join(", ") || "(none)"}. Extension-loaded sessions correlate with Similarweb signal.`;
  } else if (snapshotDelta.visitsDelta === 0) {
    recommendation = `NEUTRAL: visits unchanged (${snapshotDelta.visitsStart} → ${snapshotDelta.visitsEnd}). ${totalSessions} sessions ran. May need more time (24-48h lag) or volume.`;
  } else {
    recommendation = `visits decreased by ${Math.abs(snapshotDelta.visitsDelta)}. May be natural fluctuation. Continue monitoring.`;
  }

  return {
    domain,
    totalSessions,
    sessionBuckets,
    snapshotDelta,
    observations: domainObs,
    uniqueExtensionBundles: extBundles,
    recommendation,
  };
}

// ── Dashboard Class ────────────────────────────────────────────────────────

export class SimilarwebCorrelationDashboard {
  private app: express.Application;
  private server: ReturnType<typeof createServer>;
  private wss: WebSocketServer;
  private clients: Set<WebSocket> = new Set();
  private port: number;
  private sessionsPath: string;
  private observationsPath: string;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private lastObsSize = 0;
  private cachedData: CorrelationData | null = null;

  constructor(
    port = 3004,
    sessionsPath?: string,
    observationsPath?: string,
    private telemetryDir = process.cwd(),
  ) {
    this.port = port;
    this.sessionsPath = sessionsPath ?? DEFAULT_SESSIONS_PATH(telemetryDir);
    this.observationsPath = observationsPath ?? DEFAULT_OBSERVATIONS_PATH(telemetryDir);

    this.app = express();
    this.server = createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server });

    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }

  private setupMiddleware(): void {
    this.app.use((req, res, next) => {
      res.header("Access-Control-Allow-Origin", "*");
      next();
    });
  }

  private setupRoutes(): void {
    this.app.get("/", (_req, res) => {
      res.sendFile(path.join(__dirname, "public", "sw-correlation.html"));
    });

    this.app.get("/api/correlation", async (req, res) => {
      const domain = (req.query.domain as string) || "eurocookflow.com";
      const hours = parseInt((req.query.hours as string) || "168", 10);
      try {
        const data = await this.buildCorrelation(domain, hours);
        res.json(data);
      } catch (err) {
        res.status(500).json({ error: (err as Error).message });
      }
    });

    this.app.get("/api/health", (_req, res) => {
      res.json({ ok: true, port: this.port });
    });
  }

  private setupWebSocket(): void {
    this.wss.on("connection", (ws) => {
      this.clients.add(ws);
      if (this.cachedData) {
        ws.send(JSON.stringify({ type: "init", data: this.cachedData }));
      }
      ws.on("close", () => this.clients.delete(ws));
      ws.on("error", () => this.clients.delete(ws));
    });
  }

  private broadcast(message: unknown): void {
    const data = JSON.stringify(message);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) client.send(data);
    }
  }

  private async buildCorrelation(domain: string, hours: number): Promise<CorrelationData> {
    const [sessions, observations] = await Promise.all([
      loadJsonl<SessionRecord>(this.sessionsPath),
      loadJsonl<SimilarwebObservation>(this.observationsPath),
    ]);
    this.cachedData = buildCorrelation(domain, sessions, observations, hours);
    return this.cachedData;
  }

  private startPolling(): void {
    this.pollInterval = setInterval(async () => {
      try {
        const { events, newSize } = await loadJsonlIncremental(this.observationsPath, this.lastObsSize);
        this.lastObsSize = newSize;
        if (events.length > 0 && this.cachedData) {
          const refreshed = await this.buildCorrelation(this.cachedData.domain, 168);
          this.broadcast({ type: "update", data: refreshed });
        }
      } catch { /* ignore */ }
    }, 5000);
  }

  async start(): Promise<void> {
    // Initial load
    try {
      const stat = await fs.stat(this.observationsPath);
      this.lastObsSize = stat.size;
    } catch { /* no file yet */ }

    this.startPolling();

    return new Promise((resolve) => {
      this.server.listen(this.port, () => {
        console.log(`📈 Similarweb Correlation: http://localhost:${this.port}`);
        console.log(`   Sessions JSONL : ${this.sessionsPath}`);
        console.log(`   Observations    : ${this.observationsPath}`);
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    if (this.pollInterval) clearInterval(this.pollInterval);
    return new Promise((resolve) => {
      this.wss.close();
      this.server.close(() => resolve());
    });
  }
}

// ── Standalone entry-point ─────────────────────────────────────────────────

if (require.main === module) {
  const PORT = parseInt(process.env.SW_DASHBOARD_PORT ?? "3004", 10);
  const dashboard = new SimilarwebCorrelationDashboard(PORT);
  dashboard.start().then(() => console.log("Press Ctrl+C to stop.\n"));
  process.on("SIGINT", async () => { await dashboard.stop(); process.exit(0); });
}
