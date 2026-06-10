import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import path from "node:path";
import { promises as fs } from "node:fs";

interface TelemetryEvent {
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
}

interface DashboardServerOptions {
  port: number;
  maxEvents: number;
  persistPath: string | null;
}

export class ExtensionTelemetryDashboard {
  private app: express.Application;
  private server: ReturnType<typeof createServer>;
  private wss: WebSocketServer;
  private events: TelemetryEvent[] = [];
  private maxEvents: number;
  private clients: Set<WebSocket> = new Set();
  public port: number;
  private persistPath: string | null;
  private persistDir: string | null;
  private persistReady: Promise<void>;

  constructor(options: Partial<DashboardServerOptions> = {}) {
    this.maxEvents = options.maxEvents ?? 10000;
    this.port = options.port ?? 3001;

    // Default persist path: telemetry/extension-events.jsonl relative to cwd
    const rawPersist = options.persistPath !== undefined
      ? options.persistPath
      : path.resolve(process.cwd(), "telemetry", "extension-events.jsonl");
    this.persistPath = rawPersist;
    this.persistDir = rawPersist ? path.dirname(rawPersist) : null;

    this.persistReady = this.persistDir
      ? fs.mkdir(this.persistDir, { recursive: true }).then(() => undefined)
      : Promise.resolve();

    this.app = express();
    this.server = createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server });

    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }

  private setupMiddleware(): void {
    this.app.use(express.json({ limit: "10mb" }));
    this.app.use(express.static(path.join(__dirname, "public")));

    this.app.use((req, res, next) => {
      res.header("Access-Control-Allow-Origin", "*");
      res.header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
      res.header("Access-Control-Allow-Headers", "Content-Type");
      if (req.method === "OPTIONS") return res.sendStatus(200);
      next();
    });
  }

  private setupRoutes(): void {
    this.app.get("/api/events", (req, res) => {
      const { limit, domain, since } = req.query as Record<string, string | undefined>;
      let filtered = [...this.events].reverse();

      if (domain) filtered = filtered.filter((e) => e.matchedDomain.includes(domain));
      if (since) filtered = filtered.filter((e) => e.timestamp > parseInt(since, 10));
      if (limit) filtered = filtered.slice(0, parseInt(limit, 10));

      res.json({ events: filtered, total: this.events.length });
    });

    this.app.delete("/api/events", (_req, res) => {
      this.events = [];
      this.broadcast({ type: "cleared" });
      res.json({ success: true });
    });

    this.app.get("/api/stats", (_req, res) => {
      const domains = new Map<string, number>();
      const methods = new Map<string, number>();

      for (const e of this.events) {
        domains.set(e.matchedDomain, (domains.get(e.matchedDomain) || 0) + 1);
        methods.set(e.method, (methods.get(e.method) || 0) + 1);
      }

      res.json({
        totalEvents: this.events.length,
        byDomain: Object.fromEntries(domains),
        byMethod: Object.fromEntries(methods),
        timeRange: this.events.length > 0
          ? { start: this.events[0].timestamp, end: this.events[this.events.length - 1].timestamp }
          : null,
      });
    });

    this.app.post("/api/events", (req, res) => {
      const event = req.body as TelemetryEvent;
      if (!event || !event.url) return res.status(400).json({ error: "Invalid event" });
      this.addEvent(event);
      res.json({ success: true, index: this.events.length - 1 });
    });
  }

  private setupWebSocket(): void {
    this.wss.on("connection", (ws) => {
      this.clients.add(ws);
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

  addEvent(event: TelemetryEvent): void {
    this.events.push(event);
    if (this.events.length > this.maxEvents) this.events.shift();
    this.broadcast({ type: "event", event });

    // Persist to JSONL
    if (this.persistPath) {
      this.persistReady
        .then(() => fs.appendFile(this.persistPath!, JSON.stringify(event) + "\n", "utf8"))
        .catch(() => { /* non-fatal */ });
    }
  }

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.port, () => {
        console.log(`📊 Dashboard: http://localhost:${this.port}`);
        console.log(`   WebSocket: ws://localhost:${this.port}`);
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      this.wss.close();
      this.server.close(() => resolve());
    });
  }
}

export function createDashboardServer(options: Partial<DashboardServerOptions> = {}) {
  return new ExtensionTelemetryDashboard(options);
}

if (require.main === module) {
  const dashboard = new ExtensionTelemetryDashboard({ port: 3001 });
  dashboard.start().then(() => {
    console.log("Press Ctrl+C to stop.");
  });
}