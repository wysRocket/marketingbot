import http from "http";

export function startRailwayHeartbeatServer(): void {
  const rawPort = process.env.PORT;
  if (!rawPort) return;

  const port = Number.parseInt(rawPort, 10);
  if (!Number.isFinite(port) || port <= 0) {
    console.warn(`[railway] Ignoring invalid PORT value: ${rawPort}`);
    return;
  }

  const server = http.createServer((req, res) => {
    if (req.url === "/health" || req.url === "/") {
      res.statusCode = 200;
      res.setHeader("content-type", "text/plain; charset=utf-8");
      res.end("ok");
      return;
    }

    res.statusCode = 404;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.end("not found");
  });

  server.listen(port, "0.0.0.0", () => {
    console.log(`[railway] Heartbeat server listening on 0.0.0.0:${port}`);
  });
}
