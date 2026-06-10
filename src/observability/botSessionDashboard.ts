/**
 * Bot Session Observability Dashboard
 *
 * Reads telemetry/*.sessions.jsonl files and serves a real-time dashboard
 * showing bot session metrics: duration, pages visited, interactions,
 * traffic, flows run, and quality-gate outcomes.
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

// ─── HTML Dashboard ───────────────────────────────────────────────────────────

const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bot Session Telemetry</title>
  <style>
    :root {
      --bg: #0a0a0f;
      --surface: #111118;
      --border: rgba(255,255,255,0.07);
      --gold: #f4c430;
      --green: #22c55e;
      --red: #ef4444;
      --amber: #f59e0b;
      --blue: #60a5fa;
      --text: #e2e8f0;
      --muted: #64748b;
      --font: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: var(--font);
      font-size: 12px;
      min-height: 100vh;
    }
    header {
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      padding: 14px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: sticky;
      top: 0;
      z-index: 10;
    }
    header h1 { font-size: 14px; font-weight: 700; letter-spacing: 0.1em; color: var(--gold); text-transform: uppercase; }
    header h1 span { color: var(--muted); font-weight: 400; margin-left: 8px; }
    #ws-status {
      font-size: 10px;
      padding: 3px 10px;
      border-radius: 99px;
      border: 1px solid var(--border);
      color: var(--muted);
      transition: all 0.3s;
    }
    #ws-status.live { color: var(--green); border-color: var(--green); }
    #ws-status.dead { color: var(--red); border-color: var(--red); }

    .stats-bar {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 1px;
      background: var(--border);
      border-bottom: 1px solid var(--border);
    }
    .stat-card {
      background: var(--surface);
      padding: 14px 20px;
    }
    .stat-card .label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); margin-bottom: 6px; }
    .stat-card .value { font-size: 22px; font-weight: 700; color: var(--text); }
    .stat-card .sub { font-size: 10px; color: var(--muted); margin-top: 2px; }

    .toolbar {
      padding: 12px 20px;
      display: flex;
      align-items: center;
      gap: 10px;
      border-bottom: 1px solid var(--border);
      flex-wrap: wrap;
    }
    .toolbar label { font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; }
    .toolbar select, .toolbar input {
      background: var(--surface);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 5px 10px;
      border-radius: 6px;
      font-family: var(--font);
      font-size: 11px;
      outline: none;
    }
    .toolbar select:focus, .toolbar input:focus { border-color: var(--gold); }
    .toolbar button {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--muted);
      padding: 5px 12px;
      border-radius: 6px;
      font-family: var(--font);
      font-size: 10px;
      cursor: pointer;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      transition: all 0.15s;
    }
    .toolbar button:hover { border-color: var(--gold); color: var(--gold); }
    .count-badge { margin-left: auto; font-size: 10px; color: var(--muted); }

    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; }
    thead th {
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      padding: 8px 12px;
      text-align: left;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--muted);
      white-space: nowrap;
      cursor: pointer;
      user-select: none;
    }
    thead th:hover { color: var(--gold); }
    thead th.sorted { color: var(--gold); }
    tbody tr {
      border-bottom: 1px solid var(--border);
      transition: background 0.1s;
      cursor: pointer;
    }
    tbody tr:hover { background: rgba(255,255,255,0.025); }
    tbody tr.expanded { background: rgba(244,196,48,0.04); }
    td {
      padding: 8px 12px;
      vertical-align: top;
      white-space: nowrap;
    }
    td.wrap { white-space: normal; max-width: 200px; }

    .badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 7px;
      border-radius: 99px;
      font-size: 9px;
      font-weight: 600;
      letter-spacing: 0.06em;
      border: 1px solid;
    }
    .badge-green { color: var(--green); border-color: rgba(34,197,94,0.3); background: rgba(34,197,94,0.08); }
    .badge-red { color: var(--red); border-color: rgba(239,68,68,0.3); background: rgba(239,68,68,0.08); }
    .badge-amber { color: var(--amber); border-color: rgba(245,158,11,0.3); background: rgba(245,158,11,0.08); }
    .badge-blue { color: var(--blue); border-color: rgba(96,165,250,0.3); background: rgba(96,165,250,0.08); }
    .badge-muted { color: var(--muted); border-color: var(--border); background: transparent; }

    .flow-pill {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 9px;
      background: rgba(244,196,48,0.1);
      color: var(--gold);
      border: 1px solid rgba(244,196,48,0.2);
      margin: 1px 2px 1px 0;
    }

    .detail-row td {
      padding: 0;
      background: rgba(0,0,0,0.3);
      border-bottom: 2px solid var(--border);
    }
    .detail-inner {
      padding: 14px 16px;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 12px;
    }
    .detail-group h4 {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--muted);
      margin-bottom: 6px;
    }
    .detail-group ul {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .detail-group li {
      font-size: 10px;
      color: var(--text);
      padding: 3px 6px;
      background: rgba(255,255,255,0.03);
      border-radius: 3px;
      border-left: 2px solid var(--border);
      word-break: break-all;
      white-space: normal;
    }
    .detail-group li.warn { border-left-color: var(--amber); color: var(--amber); }
    .detail-group li.origin { border-left-color: var(--blue); }

    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: var(--muted);
    }
    .empty-state p { margin-top: 8px; font-size: 11px; }

    #toast {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: var(--surface);
      border: 1px solid var(--gold);
      color: var(--gold);
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 11px;
      opacity: 0;
      transition: opacity 0.3s;
      pointer-events: none;
      z-index: 100;
    }
    #toast.show { opacity: 1; }
  </style>
</head>
<body>
  <header>
    <h1>Bot Session Telemetry <span>real-time</span></h1>
    <div id="ws-status">connecting…</div>
  </header>

  <div class="stats-bar" id="stats-bar">
    <div class="stat-card"><div class="label">Sessions</div><div class="value" id="s-total">—</div></div>
    <div class="stat-card"><div class="label">Avg Duration</div><div class="value" id="s-avg-dur">—</div><div class="sub">seconds</div></div>
    <div class="stat-card"><div class="label">Total Interactions</div><div class="value" id="s-interactions">—</div></div>
    <div class="stat-card"><div class="label">Total Traffic</div><div class="value" id="s-traffic">—</div></div>
    <div class="stat-card"><div class="label">Pass Rate</div><div class="value" id="s-pass">—</div><div class="sub">met both quality gates</div></div>
    <div class="stat-card"><div class="label">Warnings</div><div class="value" id="s-warnings">—</div><div class="sub">across all sessions</div></div>
  </div>

  <div class="toolbar">
    <label>Profile</label>
    <select id="f-profile"><option value="">All</option></select>
    <label>Runner</label>
    <select id="f-runner"><option value="">All</option></select>
    <label>Sort</label>
    <select id="f-sort">
      <option value="recordedAt_desc">Newest first</option>
      <option value="recordedAt_asc">Oldest first</option>
      <option value="elapsedMs_desc">Longest first</option>
      <option value="interactions_desc">Most interactions</option>
      <option value="warnings_desc">Most warnings</option>
    </select>
    <button id="btn-clear-filters">Reset</button>
    <span class="count-badge" id="count-badge"></span>
  </div>

  <div class="table-wrap">
    <table id="main-table">
      <thead>
        <tr>
          <th>Time</th>
          <th>Runner</th>
          <th>Profile</th>
          <th>Label</th>
          <th>Duration</th>
          <th>Pages</th>
          <th>Flows</th>
          <th>Interactions</th>
          <th>Traffic</th>
          <th>Requests</th>
          <th>Warnings</th>
          <th>Quality</th>
        </tr>
      </thead>
      <tbody id="tbody"></tbody>
    </table>
    <div class="empty-state" id="empty-state" style="display:none">
      <div style="font-size:28px;">📊</div>
      <p>No sessions recorded yet. Run the bot and data will appear here.</p>
    </div>
  </div>

  <div id="toast"></div>

  <script>
    let allSessions = [];
    let expandedId = null;

    const fmt = {
      time: ts => {
        const d = new Date(ts);
        return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
      },
      dur: ms => {
        if (ms < 1000) return ms + 'ms';
        if (ms < 60000) return (ms/1000).toFixed(1) + 's';
        return Math.floor(ms/60000) + 'm ' + Math.round((ms%60000)/1000) + 's';
      },
      bytes: b => {
        if (b < 1024) return b + ' B';
        if (b < 1048576) return (b/1024).toFixed(1) + ' KB';
        return (b/1048576).toFixed(2) + ' MB';
      },
      pct: (n,d) => d === 0 ? '—' : Math.round(n/d*100) + '%'
    };

    function badge(text, cls) {
      return '<span class="badge badge-' + cls + '">' + text + '</span>';
    }
    function pill(text) {
      return '<span class="flow-pill">' + text + '</span>';
    }
    function esc(str) {
      return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    function updateStats() {
      const all = allSessions;
      const n = all.length;
      document.getElementById('s-total').textContent = n;
      if (n === 0) {
        ['s-avg-dur','s-interactions','s-traffic','s-pass','s-warnings'].forEach(id => {
          document.getElementById(id).textContent = '—';
        });
        return;
      }
      const avgDur = all.reduce((a,s) => a + (s.elapsedMs||0), 0) / n / 1000;
      document.getElementById('s-avg-dur').textContent = avgDur.toFixed(1);
      document.getElementById('s-interactions').textContent = all.reduce((a,s) => a + (s.interactions||0), 0).toLocaleString();
      document.getElementById('s-traffic').textContent = fmt.bytes(all.reduce((a,s) => a + (s.trafficBytesTotal||0), 0));
      const passed = all.filter(s => s.metMinDuration && s.metMinUniquePages).length;
      document.getElementById('s-pass').textContent = fmt.pct(passed, n) + ' (' + passed + '/' + n + ')';
      document.getElementById('s-warnings').textContent = all.reduce((a,s) => a + (s.warningsCount||0), 0);
    }

    function updateFilters() {
      const profiles = [...new Set(allSessions.map(s => s.profileId))].sort();
      const runners  = [...new Set(allSessions.map(s => s.runner))].sort();

      const pSel = document.getElementById('f-profile');
      const rSel = document.getElementById('f-runner');
      const pVal = pSel.value, rVal = rSel.value;

      pSel.innerHTML = '<option value="">All profiles</option>' +
        profiles.map(p => '<option value="' + p + '"' + (p===pVal?' selected':'') + '>' + esc(p) + '</option>').join('');
      rSel.innerHTML = '<option value="">All runners</option>' +
        runners.map(r => '<option value="' + r + '"' + (r===rVal?' selected':'') + '>' + esc(r) + '</option>').join('');
    }

    function getFiltered() {
      const profile = document.getElementById('f-profile').value;
      const runner  = document.getElementById('f-runner').value;
      const sort    = document.getElementById('f-sort').value;

      let list = [...allSessions];
      if (profile) list = list.filter(s => s.profileId === profile);
      if (runner)  list = list.filter(s => s.runner === runner);

      const [field, dir] = sort.split('_');
      list.sort((a,b) => {
        let av = a[field], bv = b[field];
        if (typeof av === 'string') av = av.toLowerCase(), bv = String(bv).toLowerCase();
        if (dir === 'desc') return av < bv ? 1 : av > bv ? -1 : 0;
        return av < bv ? -1 : av > bv ? 1 : 0;
      });
      return list;
    }

    function renderDetailRow(s) {
      const pages = (s.uniquePages||[]).map(p => '<li>' + esc(p) + '</li>').join('') || '<li>—</li>';
      const warns = (s.warnings||[]).map(w => '<li class="warn">⚠ ' + esc(w) + '</li>').join('') || '<li>None</li>';
      const flows = (s.flowsRun||[]).map(f => '<li>' + esc(f) + '</li>').join('') || '<li>—</li>';
      const origins = (s.trafficTopOrigins||[]).map(o => '<li class="origin">' + esc(o.origin||o) + ' — ' + fmt.bytes(o.bytes||0) + '</li>').join('') || '<li>—</li>';

      return '<tr class="detail-row"><td colspan="12"><div class="detail-inner">' +
        '<div class="detail-group"><h4>Pages visited (' + (s.uniquePageCount||0) + ')</h4><ul>' + pages + '</ul></div>' +
        '<div class="detail-group"><h4>Flows run</h4><ul>' + flows + '</ul></div>' +
        '<div class="detail-group"><h4>Warnings</h4><ul>' + warns + '</ul></div>' +
        '<div class="detail-group"><h4>Top origins</h4><ul>' + origins + '</ul></div>' +
        '<div class="detail-group"><h4>Quality gates</h4><ul>' +
          '<li>Min duration: ' + (s.policy?.minDurationMs||0)/1000 + 's — ' + (s.metMinDuration ? '✓ met' : '✗ missed') + '</li>' +
          '<li>Min pages: ' + (s.policy?.minUniquePages||0) + ' — ' + (s.metMinUniquePages ? '✓ met' : '✗ missed') + '</li>' +
        '</ul></div>' +
        '<div class="detail-group"><h4>Session IDs</h4><ul>' +
          '<li>Run: ' + esc(s.runId||'—') + '</li>' +
          '<li>Runner: ' + esc(s.runner||'—') + '</li>' +
          (s.railwayReplicaId ? '<li>Replica: ' + esc(s.railwayReplicaId) + '</li>' : '') +
        '</ul></div>' +
      '</div></td></tr>';
    }

    function renderTable() {
      const list = getFiltered();
      const tbody = document.getElementById('tbody');
      const empty = document.getElementById('empty-state');
      document.getElementById('count-badge').textContent = list.length + ' session' + (list.length!==1?'s':'');

      if (list.length === 0) {
        tbody.innerHTML = '';
        empty.style.display = '';
        return;
      }
      empty.style.display = 'none';

      let html = '';
      for (const s of list) {
        const rowId = 'row-' + s.runId + '-' + s.recordedAt;
        const isExpanded = expandedId === rowId;
        const qualityOk = s.metMinDuration && s.metMinUniquePages;
        const qualityBadge = qualityOk ? badge('PASS', 'green') : (!s.metMinDuration || !s.metMinUniquePages) ? badge('FAIL', 'red') : badge('—', 'muted');
        const warnBadge = s.warningsCount > 0 ? badge(s.warningsCount, 'amber') : badge('0', 'muted');
        const flowPills = (s.flowsRun||[]).map(f => pill(f)).join('') || '<span style="color:var(--muted)">—</span>';

        html += '<tr class="' + (isExpanded ? 'expanded' : '') + '" data-id="' + esc(rowId) + '">' +
          '<td>' + fmt.time(s.recordedAt) + '</td>' +
          '<td>' + badge(esc(s.runner||'?'), 'blue') + '</td>' +
          '<td>' + badge(esc(s.profileId||'?'), 'muted') + '</td>' +
          '<td class="wrap" style="max-width:120px;color:var(--muted);">' + esc(s.label||'—') + '</td>' +
          '<td><span style="color:var(--text)">' + fmt.dur(s.elapsedMs) + '</span></td>' +
          '<td>' + (s.uniquePageCount||0) + '</td>' +
          '<td class="wrap">' + flowPills + '</td>' +
          '<td>' + (s.interactions||0) + '</td>' +
          '<td>' + fmt.bytes(s.trafficBytesTotal||0) + '</td>' +
          '<td>' + (s.trafficRequestCount||0) + '</td>' +
          '<td>' + warnBadge + '</td>' +
          '<td>' + qualityBadge + '</td>' +
          '</tr>';

        if (isExpanded) html += renderDetailRow(s);
      }
      tbody.innerHTML = html;
    }

    function showToast(msg) {
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), 2500);
    }

    // ── Event delegation for row expand/collapse ──────────────────
    document.getElementById('tbody').addEventListener('click', function(e) {
      const row = e.target.closest('tr[data-id]');
      if (!row) return;
      const id = row.getAttribute('data-id');
      expandedId = expandedId === id ? null : id;
      renderTable();
    });

    // ── REST initial load ─────────────────────────────────────────
    const wsStatus = document.getElementById('ws-status');
    wsStatus.textContent = 'loading...';

    fetch('/api/sessions')
      .then(function(r) { return r.json(); })
      .then(function(d) {
        allSessions = d.sessions.reverse();   // API returns newest-first; reverse to oldest-first for our store
        updateStats();
        updateFilters();
        renderTable();
        connectWS();
      })
      .catch(function(err) {
        wsStatus.textContent = 'load error';
        wsStatus.className = 'dead';
        console.error('Failed to load sessions:', err);
      });

    // ── WebSocket (real-time updates after initial load) ──────────
    var wsReconnect;
    function connectWS() {
      var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      var socket = new WebSocket(proto + '//' + location.host);

      socket.onopen = function() {
        wsStatus.textContent = 'live';
        wsStatus.className = 'live';
        clearTimeout(wsReconnect);
      };
      socket.onclose = function() {
        wsStatus.textContent = 'reconnecting...';
        wsStatus.className = 'dead';
        wsReconnect = setTimeout(connectWS, 3000);
      };
      socket.onmessage = function(evt) {
        var msg = JSON.parse(evt.data);
        if (msg.type === 'session') {
          var idx = allSessions.findIndex(function(s) {
            return s.runId === msg.session.runId && s.recordedAt === msg.session.recordedAt;
          });
          if (idx >= 0) allSessions[idx] = msg.session;
          else allSessions.push(msg.session);
          updateStats();
          updateFilters();
          renderTable();
          showToast('New session: ' + (msg.session.runner || '?') + ' / ' + fmt.dur(msg.session.elapsedMs));
        }
      };
    }

    // ── Controls ──────────────────────────────────────────────────
    document.getElementById('f-profile').addEventListener('change', renderTable);
    document.getElementById('f-runner').addEventListener('change', renderTable);
    document.getElementById('f-sort').addEventListener('change', renderTable);
    document.getElementById('btn-clear-filters').addEventListener('click', function() {
      document.getElementById('f-profile').value = '';
      document.getElementById('f-runner').value = '';
      document.getElementById('f-sort').value = 'recordedAt_desc';
      renderTable();
    });
  </script>
</body>
</html>`;

// ─── Dashboard Server ─────────────────────────────────────────────────────────

export class BotSessionDashboard {
  private app: express.Application;
  private server: ReturnType<typeof createServer>;
  private wss: WebSocketServer;
  private sessions: SessionRecord[] = [];
  private clients: Set<WebSocket> = new Set();
  private telemetryDir: string;
  public port: number;

  constructor(options: Partial<DashboardOptions> = {}) {
    this.port = options.port ?? 3002;
    this.telemetryDir = path.resolve(
      process.cwd(),
      options.telemetryDir ?? process.env.FLOW_TELEMETRY_DIR ?? "telemetry",
    );

    this.app = express();
    this.server = createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server });

    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }

  // ── Middleware ───────────────────────────────────────────────────

  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use((_req, res, next) => {
      res.header("Access-Control-Allow-Origin", "*");
      res.header("Access-Control-Allow-Methods", "GET, DELETE, OPTIONS");
      res.header("Access-Control-Allow-Headers", "Content-Type");
      next();
    });
  }

  // ── Routes ───────────────────────────────────────────────────────

  private setupRoutes(): void {
    // Serve the embedded HTML dashboard at root
    this.app.get("/", (_req, res) => {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(DASHBOARD_HTML);
    });

    // All sessions (newest first, optional limit)
    this.app.get("/api/sessions", (req, res) => {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
      const profileId = req.query.profile as string | undefined;
      const runner = req.query.runner as string | undefined;

      let list = [...this.sessions].reverse();
      if (profileId) list = list.filter((s) => s.profileId === profileId);
      if (runner) list = list.filter((s) => s.runner === runner);
      if (limit) list = list.slice(0, limit);

      res.json({ sessions: list, total: this.sessions.length });
    });

    // Aggregate stats
    this.app.get("/api/stats", (_req, res) => {
      const n = this.sessions.length;
      if (n === 0) {
        res.json({ total: 0 });
        return;
      }

      const totalElapsedMs = this.sessions.reduce((a, s) => a + s.elapsedMs, 0);
      const totalInteractions = this.sessions.reduce((a, s) => a + s.interactions, 0);
      const totalTraffic = this.sessions.reduce((a, s) => a + s.trafficBytesTotal, 0);
      const totalWarnings = this.sessions.reduce((a, s) => a + s.warningsCount, 0);
      const passed = this.sessions.filter((s) => s.metMinDuration && s.metMinUniquePages).length;

      const profileCounts: Record<string, number> = {};
      const runnerCounts: Record<string, number> = {};
      for (const s of this.sessions) {
        profileCounts[s.profileId] = (profileCounts[s.profileId] || 0) + 1;
        runnerCounts[s.runner] = (runnerCounts[s.runner] || 0) + 1;
      }

      res.json({
        total: n,
        avgElapsedMs: Math.round(totalElapsedMs / n),
        totalInteractions,
        totalTrafficBytes: totalTraffic,
        totalWarnings,
        passRate: `${Math.round((passed / n) * 100)}%`,
        passed,
        byProfile: profileCounts,
        byRunner: runnerCounts,
        latestAt: this.sessions[this.sessions.length - 1]?.recordedAt ?? null,
      });
    });

    // Health check
    this.app.get("/health", (_req, res) => {
      res.json({ ok: true, sessions: this.sessions.length });
    });
  }

  // ── WebSocket ────────────────────────────────────────────────────

  private setupWebSocket(): void {
    this.wss.on("connection", (ws) => {
      this.clients.add(ws);
      // Send all sessions on connect (newest first, max 500)
      ws.send(
        JSON.stringify({
          type: "init",
          sessions: [...this.sessions].reverse().slice(0, 500),
        }),
      );
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

  // ── JSONL Loading ────────────────────────────────────────────────

  private parseJsonl(content: string): SessionRecord[] {
    return content
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => {
        try {
          return JSON.parse(line) as SessionRecord;
        } catch {
          return null;
        }
      })
      .filter((r): r is SessionRecord => r !== null);
  }

  private async loadAllSessions(): Promise<void> {
    try {
      await fs.mkdir(this.telemetryDir, { recursive: true });
      const files = await fs.readdir(this.telemetryDir);
      const jsonlFiles = files.filter((f) => f.endsWith(".sessions.jsonl"));

      const allRecords: SessionRecord[] = [];
      for (const file of jsonlFiles) {
        const content = await fs.readFile(
          path.join(this.telemetryDir, file),
          "utf8",
        );
        allRecords.push(...this.parseJsonl(content));
      }

      // Sort oldest-first so newest-first reversal works properly
      allRecords.sort(
        (a, b) =>
          new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime(),
      );

      this.sessions = allRecords;
      console.log(
        `[botSessionDashboard] Loaded ${this.sessions.length} sessions from ${jsonlFiles.length} file(s).`,
      );
    } catch (err) {
      console.error("[botSessionDashboard] Failed to load sessions:", err);
    }
  }

  // ── File Watching ────────────────────────────────────────────────

  private watchTelemetryDir(): void {
    try {
      nodefs.watch(this.telemetryDir, { persistent: false }, (event, filename) => {
        if (!filename || !filename.endsWith(".sessions.jsonl")) return;
        const filePath = path.join(this.telemetryDir, filename);

        // Debounce: wait 200ms after last event to avoid duplicate reads
        clearTimeout((this as unknown as Record<string, ReturnType<typeof setTimeout>>)[`_debounce_${filename}`]);
        (this as unknown as Record<string, ReturnType<typeof setTimeout>>)[`_debounce_${filename}`] = setTimeout(async () => {
          try {
            const content = await fs.readFile(filePath, "utf8");
            const incoming = this.parseJsonl(content);

            // Find truly new records (not already tracked by runId+recordedAt)
            const existingKeys = new Set(
              this.sessions.map((s) => `${s.runId}|${s.recordedAt}`),
            );
            const newRecords = incoming.filter(
              (r) => !existingKeys.has(`${r.runId}|${r.recordedAt}`),
            );

            if (newRecords.length > 0) {
              this.sessions.push(...newRecords);
              this.sessions.sort(
                (a, b) =>
                  new Date(a.recordedAt).getTime() -
                  new Date(b.recordedAt).getTime(),
              );
              for (const record of newRecords) {
                this.broadcast({ type: "session", session: record });
              }
              console.log(
                `[botSessionDashboard] +${newRecords.length} new session(s) from ${filename}`,
              );
            }
          } catch {
            // File may have been deleted or locked — ignore
          }
        }, 200);
      });

      console.log(`[botSessionDashboard] Watching ${this.telemetryDir}`);
    } catch {
      console.warn(
        `[botSessionDashboard] Could not watch ${this.telemetryDir} — live updates disabled.`,
      );
    }
  }

  // ── Lifecycle ────────────────────────────────────────────────────

  async start(): Promise<void> {
    await this.loadAllSessions();
    this.watchTelemetryDir();

    return new Promise((resolve) => {
      this.server.listen(this.port, () => {
        console.log(`📊 Bot Session Dashboard: http://localhost:${this.port}`);
        console.log(`   WebSocket:             ws://localhost:${this.port}`);
        console.log(`   Telemetry dir:         ${this.telemetryDir}`);
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

// ─── Standalone entrypoint ────────────────────────────────────────────────────

if (require.main === module) {
  const port = parseInt(process.env.BOT_DASHBOARD_PORT ?? "3002", 10);
  const dashboard = new BotSessionDashboard({ port });

  dashboard.start().then(() => {
    console.log("Press Ctrl+C to stop.");
  });

  process.on("SIGINT", async () => {
    await dashboard.stop();
    process.exit(0);
  });
  process.on("SIGTERM", async () => {
    await dashboard.stop();
    process.exit(0);
  });
}
