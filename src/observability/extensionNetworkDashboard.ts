/**
 * Extension Network Dashboard – port 3003
 *
 * Provides a rich browser UI for inspecting which external domains each
 * browser extension is "phoning home" to, what data is in each payload,
 * and a per-extension breakdown.
 *
 * Data sources:
 *  1. telemetry/extension-events.jsonl  – persisted by ExtensionTelemetryDashboard
 *  2. Live events pushed via WebSocket from connected clients
 *
 * Run: npm run telemetry:ext-network
 */

import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { promises as fs } from "node:fs";
import * as fsSync from "node:fs";
import path from "node:path";
import readline from "node:readline";

// ── Types ──────────────────────────────────────────────────────────────────

export interface ExtNetworkEvent {
  timestamp: number;
  type: "request" | "response";
  url: string;
  method: string;
  requestHeaders: Record<string, string>;
  responseHeaders?: Record<string, string>;
  requestBody?: string;
  responseBody?: string;
  statusCode?: number;
  resourceType: string;
  extensionId?: string;
  matchedDomain: string;
  runId?: string;
}

interface EndpointSummary {
  path: string;
  count: number;
  methods: string[];
  sampleBody?: string;
}

interface DomainSummary {
  domain: string;
  count: number;
  suspicious: boolean;
  endpoints: EndpointSummary[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

const KNOWN_DOMAINS = [
  "similarweb.com",
  "data.similarweb.com",
  "rank.similarweb.com",
  "sw-extension.s3.amazonaws.com",
  "cdn.growthbook.io",
  "api.mixpanel.com",
  "mixpanel.com",
];

function isSuspicious(domain: string): boolean {
  return !KNOWN_DOMAINS.some(
    (d) => domain === d || domain.endsWith("." + d)
  );
}

function buildSummary(events: ExtNetworkEvent[]): DomainSummary[] {
  const domainMap = new Map<
    string,
    { count: number; endpoints: Map<string, { count: number; methods: Set<string>; sampleBody?: string }> }
  >();

  for (const e of events) {
    const dom = e.matchedDomain || "unknown";
    let domData = domainMap.get(dom);
    if (!domData) {
      domData = { count: 0, endpoints: new Map() };
      domainMap.set(dom, domData);
    }
    domData.count++;

    let epKey = "unknown";
    try {
      const u = new URL(e.url);
      epKey = e.method + " " + u.pathname;
    } catch { /* ignore */ }

    let epData = domData.endpoints.get(epKey);
    if (!epData) {
      epData = { count: 0, methods: new Set(), sampleBody: undefined };
      domData.endpoints.set(epKey, epData);
    }
    epData.count++;
    epData.methods.add(e.method);
    if (!epData.sampleBody && e.requestBody) {
      epData.sampleBody = e.requestBody.slice(0, 500);
    }
  }

  return Array.from(domainMap.entries())
    .map(([domain, data]) => ({
      domain,
      count: data.count,
      suspicious: isSuspicious(domain),
      endpoints: Array.from(data.endpoints.entries())
        .map(([key, ep]) => {
          const parts = key.split(" ");
          return {
            path: parts.slice(1).join(" ") || "/",
            count: ep.count,
            methods: Array.from(ep.methods),
            sampleBody: ep.sampleBody,
          };
        })
        .sort((a, b) => b.count - a.count),
    }))
    .sort((a, b) => b.count - a.count);
}

// ── Dashboard Class ────────────────────────────────────────────────────────

export class ExtensionNetworkDashboard {
  private app: express.Application;
  private server: ReturnType<typeof createServer>;
  private wss: WebSocketServer;
  private events: ExtNetworkEvent[] = [];
  private clients: Set<WebSocket> = new Set();
  private port: number;
  private jsonlPath: string;
  private lastFileSize = 0;
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    port = 3003,
    jsonlPath = path.resolve(process.cwd(), "telemetry", "extension-events.jsonl")
  ) {
    this.port = port;
    this.jsonlPath = jsonlPath;

    this.app = express();
    this.server = createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server });

    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }

  // ── Middleware ────────────────────────────────────────────────────────────

  private setupMiddleware(): void {
    this.app.use(express.json({ limit: "10mb" }));
    this.app.use((req, res, next) => {
      res.header("Access-Control-Allow-Origin", "*");
      res.header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
      res.header("Access-Control-Allow-Headers", "Content-Type");
      if (req.method === "OPTIONS") { res.sendStatus(200); return; }
      next();
    });
  }

  // ── Routes ────────────────────────────────────────────────────────────────

  private setupRoutes(): void {
    // Serve the rich HTML UI
    this.app.get("/", (_req, res) => {
      res.sendFile(path.join(__dirname, "public", "extension-network.html"));
    });

    // Static assets from the shared public folder
    this.app.use("/static", express.static(path.join(__dirname, "public")));

    // All events with optional filtering
    this.app.get("/api/events", (req, res) => {
      const q = req.query as Record<string, string | undefined>;
      let filtered = [...this.events].reverse();

      if (q.domain) filtered = filtered.filter((e) => e.matchedDomain.includes(q.domain!));
      if (q.method) filtered = filtered.filter((e) => e.method === q.method);
      if (q.extid) filtered = filtered.filter((e) => e.extensionId === q.extid);
      if (q.since) filtered = filtered.filter((e) => e.timestamp > parseInt(q.since!, 10));
      if (q.suspicious === "1") filtered = filtered.filter((e) => isSuspicious(e.matchedDomain));
      if (q.limit) filtered = filtered.slice(0, parseInt(q.limit!, 10));

      res.json({ events: filtered, total: this.events.length });
    });

    // Phone Home Map summary
    this.app.get("/api/summary", (_req, res) => {
      res.json({ summary: buildSummary(this.events) });
    });

    // Per-extension breakdown
    this.app.get("/api/extensions", (_req, res) => {
      const extMap = new Map<string, { count: number; domains: Set<string>; lastSeen: number }>();
      for (const e of this.events) {
        const id = e.extensionId || "(no id)";
        let ext = extMap.get(id);
        if (!ext) { ext = { count: 0, domains: new Set(), lastSeen: 0 }; extMap.set(id, ext); }
        ext.count++;
        ext.domains.add(e.matchedDomain);
        if (e.timestamp > ext.lastSeen) ext.lastSeen = e.timestamp;
      }
      const result = Array.from(extMap.entries()).map(([id, data]) => ({
        extensionId: id,
        count: data.count,
        domains: Array.from(data.domains),
        lastSeen: data.lastSeen,
      })).sort((a, b) => b.count - a.count);
      res.json({ extensions: result });
    });

    // Delete all events
    this.app.delete("/api/events", (_req, res) => {
      this.events = [];
      this.broadcast({ type: "cleared" });
      res.json({ success: true });
    });

    // Accept events pushed from external sources (e.g., bot runners)
    this.app.post("/api/events", (req, res) => {
      const event = req.body as ExtNetworkEvent;
      if (!event || !event.url) { res.status(400).json({ error: "Invalid event" }); return; }
      this.addEvent(event);
      res.json({ success: true });
    });

    // Health check
    this.app.get("/api/health", (_req, res) => {
      res.json({ ok: true, events: this.events.length, port: this.port, jsonlPath: this.jsonlPath });
    });
  }

  // ── WebSocket ─────────────────────────────────────────────────────────────

  private setupWebSocket(): void {
    this.wss.on("connection", (ws) => {
      this.clients.add(ws);
      // Send last 100 events as init payload
      ws.send(JSON.stringify({ type: "init", events: this.events.slice(-100).reverse() }));
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

  addEvent(event: ExtNetworkEvent): void {
    this.events.push(event);
    this.broadcast({ type: "event", event });
  }

  // ── JSONL loading ─────────────────────────────────────────────────────────

  private async loadJsonl(): Promise<void> {
    try {
      await fs.access(this.jsonlPath);
    } catch {
      console.log(`  No JSONL yet at ${this.jsonlPath} (will watch for it)`);
      return;
    }

    const stat = await fs.stat(this.jsonlPath);
    this.lastFileSize = stat.size;

    const rl = readline.createInterface({
      input: fsSync.createReadStream(this.jsonlPath),
      crlfDelay: Infinity,
    });

    let count = 0;
    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line) as ExtNetworkEvent;
        this.events.push(event);
        count++;
      } catch { /* skip malformed line */ }
    }

    console.log(`  Loaded ${count} events from JSONL`);
  }

  /** Poll the JSONL file every second for new appended lines. */
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
            const event = JSON.parse(line) as ExtNetworkEvent;
            this.addEvent(event);
          } catch { /* skip */ }
        }
      } catch { /* file not ready or inaccessible — ignore */ }
    }, 1000);
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    await this.loadJsonl();
    this.startPolling();

    return new Promise((resolve) => {
      this.server.listen(this.port, () => {
        console.log(`🔬 Extension Network Inspector: http://localhost:${this.port}`);
        console.log(`   Watching JSONL : ${this.jsonlPath}`);
        console.log(`   Events loaded  : ${this.events.length}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    if (this.pollInterval) clearInterval(this.pollInterval);
    return new Promise((resolve) => {
      this.wss.close();
      this.server.close(() => resolve());
    });
  }
}

// ── Standalone entry-point ─────────────────────────────────────────────────

if (require.main === module) {
  const PORT = parseInt(process.env.EXT_NETWORK_PORT ?? "3003", 10);
  const JSONL = process.env.EXT_EVENTS_JSONL ??
    path.resolve(process.cwd(), "telemetry", "extension-events.jsonl");

  const dashboard = new ExtensionNetworkDashboard(PORT, JSONL);

  dashboard.start().then(() => {
    console.log("Press Ctrl+C to stop.\n");
  });

  process.on("SIGINT", async () => {
    console.log("\n🛑 Stopping Extension Network Inspector…");
    await dashboard.stop();
    process.exit(0);
  });
}
