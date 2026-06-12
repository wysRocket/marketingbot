/**
 * Bot Session Observability Dashboard
 *
 * Reads telemetry/*.sessions.jsonl files and serves a real-time dashboard
 * showing bot session metrics: duration, pages visited, interactions,
 * traffic, flows run, extensions loaded, and quality-gate outcomes.
 *
 * Default port: 3002  (extension telemetry dashboard uses 3001)
 * Usage:  npx ts-node src/observability/botSessionDashboard.ts
 */

import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { promises as fs } from "node:fs";
import * as nodefs from "node:fs";
import path from "node:path";
import readline from "node:readline";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TrafficEntry {
  origin: string;
  bytes: number;
}

interface SessionRecord {
  recordedAt: string;
  runId: string;
  runner: string;
  label: string;
  profileId: string;
  mostloginProfileId?: string;
  railwayReplicaId?: string;
  profileSource?: string;
  extensionBundleHash?: string;
  extensionSlugs: string[];
  sessionStatePolicy?: string;
  targetDomain?: string;
  referrerType?: string;
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
  trafficTopOrigins: TrafficEntry[];
  trafficTopPathsSameOrigin: TrafficEntry[];
  policy: {
    minDurationMs: number;
    minUniquePages: number;
    topUpMinMs: number;
    topUpMaxMs: number;
    maxTopUpCycles: number;
  };
  metMinDuration: boolean;
  metMinUniquePages: boolean;
}

interface DashboardOptions {
  port: number;
  telemetryDir: string;
}

// ─── Dashboard Server ─────────────────────────────────────────────────────────

export class BotSessionDashboard {
  private app: express.Application;
  private server: ReturnType<typeof createServer>;
  private wss: WebSocketServer;
  private sessions: SessionRecord[] = [];
  private clients: Set<WebSocket> = new Set();
  public port: number;
  private jsonlPath: string;
  private lastFileSize = 0;
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  constructor(options: Partial<DashboardOptions> = {}) {
    this.port = options.port ?? parseInt(process.env.BOT_SESSIONS_DASHBOARD_PORT ?? "3002", 10);
    const telemetryDir = options.telemetryDir ?? process.env.FLOW_TELEMETRY_DIR ?? "telemetry";
    this.jsonlPath = path.resolve(process.cwd(), telemetryDir, "patchright.sessions.jsonl");

    this.app = express();
    this.server = createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server });

    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }

  private setupMiddleware(): void {
    this.app.use(express.json({ limit: "10mb" }));
    this.app.use((req, res, next) => {
      res.header("Access-Control-Allow-Origin", "*");
      next();
    });
  }

  private setupRoutes(): void {
    this.app.get("/", (_req, res) => {
      res.sendFile(path.join(__dirname, "public", "bot-sessions.html"));
    });

    this.app.get("/api/sessions", (_req, res) => {
      res.json({ sessions: this.sessions });
    });

    this.app.get("/api/stats", (_req, res) => {
      const n = this.sessions.length;
      if (n === 0) {
        res.json({ total: 0, avgDur: 0, totalInteractions: 0, totalTraffic: 0, passRate: 0, warnings: 0 });
        return;
      }
      res.json({
        total: n,
        avgDur: Math.round(this.sessions.reduce((a, s) => a + (s.elapsedMs || 0), 0) / n / 1000),
        totalInteractions: this.sessions.reduce((a, s) => a + (s.interactions || 0), 0),
        totalTraffic: this.sessions.reduce((a, s) => a + (s.trafficBytesTotal || 0), 0),
        passRate: Math.round(this.sessions.filter((s) => s.metMinDuration && s.metMinUniquePages).length / n * 100),
        warnings: this.sessions.reduce((a, s) => a + (s.warningsCount || 0), 0),
      });
    });

    this.app.get("/api/health", (_req, res) => {
      res.json({ ok: true, port: this.port, sessions: this.sessions.length });
    });
  }

  private setupWebSocket(): void {
    this.wss.on("connection", (ws) => {
      this.clients.add(ws);
      ws.send(JSON.stringify({ type: "init", data: [...this.sessions].reverse() }));
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

  private async loadJsonl(): Promise<void> {
    try {
      await fs.access(this.jsonlPath);
    } catch {
      console.log(`  No JSONL yet at ${this.jsonlPath}`);
      return;
    }

    const stat = await fs.stat(this.jsonlPath);
    this.lastFileSize = stat.size;

    const rl = readline.createInterface({
      input: nodefs.createReadStream(this.jsonlPath),
      crlfDelay: Infinity,
    });

    let count = 0;
    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        const record = JSON.parse(line) as SessionRecord;
        this.sessions.push(record);
        count++;
      } catch { /* skip malformed */ }
    }

    console.log(`  Loaded ${count} sessions from JSONL`);
  }

  private startPolling(): void {
    this.pollInterval = setInterval(async () => {
      try {
        const stat = await fs.stat(this.jsonlPath);
        if (stat.size <= this.lastFileSize) return;

        const fd = await fs.open(this.jsonlPath, "r");
        const newBytes = stat.size - this.lastFileSize;
        const buf = Buffer.alloc(newBytes);
        await fd.read(buf, 0, newBytes, this.lastFileSize);
        await fd.close();
        this.lastFileSize = stat.size;

        const newLines = buf.toString("utf8").split("\n").filter((l) => l.trim());
        for (const line of newLines) {
          try {
            const record = JSON.parse(line) as SessionRecord;
            this.sessions.push(record);
            this.broadcast({ type: "session", data: record });
          } catch { /* skip */ }
        }
      } catch { /* file not ready — ignore */ }
    }, 1000);
  }

  async start(): Promise<void> {
    await this.loadJsonl();
    this.startPolling();

    return new Promise((resolve) => {
      this.server.listen(this.port, () => {
        console.log(`📊 Bot Session Dashboard: http://localhost:${this.port}`);
        console.log(`   JSONL: ${this.jsonlPath}`);
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

// ─── Standalone entry-point ─────────────────────────────────────────────────

if (require.main === module) {
  const dashboard = new BotSessionDashboard();
  dashboard.start().then(() => console.log("Press Ctrl+C to stop.\n"));
  process.on("SIGINT", async () => { await dashboard.stop(); process.exit(0); });
}
