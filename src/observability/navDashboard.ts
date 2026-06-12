/**
 * Unified Observability Nav Dashboard — port 3000
 *
 * Serves a single-page index linking all 4 dashboards with live status.
 * Run: npm run dashboard
 */

import express from "express";
import { createServer } from "http";
import path from "node:path";

const PORT = parseInt(process.env.NAV_DASHBOARD_PORT ?? "3005", 10);

const app = express();
app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const server = createServer(app);
server.listen(PORT, () => {
  console.log(`🧭 Observability Nav: http://localhost:${PORT}`);
  console.log(`   Links to: 3001 (ext telemetry) · 3002 (bot sessions) · 3003 (ext network) · 3004 (SW correlation)`);
});

process.on("SIGINT", () => { server.close(); process.exit(0); });
