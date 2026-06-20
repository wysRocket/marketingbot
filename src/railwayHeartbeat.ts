import http from "http";
import fs from "fs";
import path from "path";
import { botController } from "./control/runtimeController";

/**
 * Heartbeat + control server.
 *
 * - GET /health, GET /            → unauthenticated "ok" (Railway healthcheck)
 * - GET /status                   → JSON run status (token-guarded)
 * - POST /control/start           → begin the visit loop (token-guarded)
 * - POST /control/stop            → pause the visit loop (token-guarded)
 *
 * Control endpoints require CONTROL_TOKEN to be set in the environment and a
 * matching `Authorization: Bearer <token>` or `X-Control-Token: <token>`
 * header. This is reached by the Hermes gateway over Railway's private
 * network (http://marketingbot.railway.internal:$PORT).
 */
function isAuthorized(req: http.IncomingMessage): boolean {
  const token = process.env.CONTROL_TOKEN;
  if (!token) return false; // control disabled until a token is configured
  const auth = req.headers["authorization"];
  const bearer =
    typeof auth === "string" && auth.startsWith("Bearer ")
      ? auth.slice("Bearer ".length).trim()
      : undefined;
  const headerToken = req.headers["x-control-token"];
  const provided =
    bearer ?? (typeof headerToken === "string" ? headerToken : undefined);
  return provided === token;
}

function sendJson(
  res: http.ServerResponse,
  status: number,
  body: unknown,
): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

export function startRailwayHeartbeatServer(): void {
  const rawPort = process.env.PORT;
  if (!rawPort) {
    console.warn(
      "[railway] PORT not set — heartbeat/control server disabled (loop can only be controlled via BOT_ENABLED at boot).",
    );
    return;
  }

  const port = Number.parseInt(rawPort, 10);
  if (!Number.isFinite(port) || port <= 0) {
    console.warn(`[railway] Ignoring invalid PORT value: ${rawPort}`);
    return;
  }

  const server = http.createServer((req, res) => {
    const url = req.url ?? "/";
    const method = req.method ?? "GET";

    // Unauthenticated liveness probe.
    if (method === "GET" && (url === "/health" || url === "/")) {
      res.statusCode = 200;
      res.setHeader("content-type", "text/plain; charset=utf-8");
      res.end("ok");
      return;
    }

    // Telemetry data endpoint (unauthenticated, used by dashboard)
    if (method === "GET" && url === "/api/data") {
      try {
        const telemetryDir = process.env.FLOW_TELEMETRY_DIR ?? "telemetry";
        const jsonlPath = path.resolve(process.cwd(), telemetryDir, "patchright.sessions.jsonl");
        // Read last 100KB of file to get recent sessions (much faster than reading 116MB)
        const stats = fs.statSync(jsonlPath);
        const size = stats.size;
        const chunkSize = Math.min(size, 100 * 1024);
        const buf = Buffer.alloc(chunkSize);
        const fd = fs.openSync(jsonlPath, "r");
        fs.readSync(fd, buf, 0, chunkSize, size - chunkSize);
        fs.closeSync(fd);
        const raw = buf.toString("utf8");
        const lines = raw.split("\n").filter(Boolean);
        const sessions = lines.slice(-500).map((l: string) => JSON.parse(l));
        res.statusCode = 200;
        res.setHeader("content-type", "application/json; charset=utf-8");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.end(JSON.stringify({ sessions, extEvents: [], swObservations: [], fingerprint: sessions.length + ":" + (sessions[sessions.length-1]?.recordedAt || "") }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader("content-type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ error: (e as Error).message }));
      }
      return;
    }

    // Everything below is control surface and requires the token.
    if (url === "/status" || url.startsWith("/control/")) {
      if (!isAuthorized(req)) {
        sendJson(res, 401, { error: "unauthorized" });
        return;
      }

      if (method === "GET" && url === "/status") {
        sendJson(res, 200, botController.status());
        return;
      }

      if (method === "POST" && url === "/control/start") {
        const changed = botController.start("api");
        sendJson(res, 200, { changed, status: botController.status() });
        return;
      }

      if (method === "POST" && url === "/control/stop") {
        const changed = botController.stop("api");
        sendJson(res, 200, { changed, status: botController.status() });
        return;
      }

      sendJson(res, 405, { error: "method not allowed" });
      return;
    }

    res.statusCode = 404;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.end("not found");
  });

  server.listen(port, "0.0.0.0", () => {
    const controlState = process.env.CONTROL_TOKEN
      ? "enabled"
      : "disabled (no CONTROL_TOKEN)";
    console.log(
      `[railway] Heartbeat + control server listening on 0.0.0.0:${port} | control endpoints: ${controlState}`,
    );
  });
}
