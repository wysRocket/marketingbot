'use strict';

function formatRefreshTime(iso) {
  if (!iso) return 'Never';
  try { return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
  catch { return iso; }
}
function latencyClass(ms) { return ms < 1000 ? 'fast' : ms < 2500 ? 'medium' : 'slow'; }
function proxyUri(p) {
  return p.username && p.password
    ? `socks5://${encodeURIComponent(p.username)}:${encodeURIComponent(p.password)}@${p.host}:${p.port}`
    : `socks5://${p.host}:${p.port}`;
}
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function avgLatency(proxies) {
  if (!proxies.length) return '—';
  return Math.round(proxies.reduce((s,p)=>s+p.latencyMs,0)/proxies.length);
}
function countryFlag(code) {
  if (!code || code.length !== 2) return '';
  try { return String.fromCodePoint(...code.toUpperCase().split('').map(c=>0x1F1E0+c.charCodeAt(0)-65)); }
  catch { return ''; }
}
function ms2human(ms) {
  if (ms < 1000) return ms + 'ms';
  if (ms < 60000) return (ms/1000).toFixed(0) + 's';
  return (ms/60000).toFixed(1) + 'min';
}

function renderSourceRows(sourceStats) {
  const e = Object.entries(sourceStats);
  if (!e.length) return '<tr><td colspan="2" class="empty">No data yet</td></tr>';
  return e.sort((a,b)=>b[1]-a[1]).map(([n,c])=>`<tr><td>${escHtml(n)}</td><td>${c}</td></tr>`).join('');
}

function renderProxyRows(proxies) {
  const hasCreds   = proxies.some(p=>p.username);
  const hasCountry = proxies.some(p=>p.country);
  if (!proxies.length) return '<tr><td colspan="7" class="empty">No live proxies yet…</td></tr>';
  return proxies.map((p,i) => {
    const uri  = proxyUri(p);
    const lc   = latencyClass(p.latencyMs);
    const time = new Date(p.checkedAt).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    return '<tr>' +
      `<td>${i+1}</td>` +
      `<td><code>${escHtml(p.host)}</code></td>` +
      `<td>${p.port}</td>` +
      (hasCreds   ? `<td><code>${escHtml(p.username||'—')}</code></td>` : '') +
      (hasCountry ? `<td>${escHtml((p.country||'—'))} ${countryFlag(p.country)}</td>` : '') +
      `<td style="max-width:280px;overflow:hidden;text-overflow:ellipsis"><code title="${escHtml(uri)}">${escHtml(uri)}</code></td>` +
      `<td class="lat ${lc}">${p.latencyMs}ms</td>` +
      `<td title="${escHtml(p.checkedAt)}">${time}</td>` +
      '</tr>';
  }).join('');
}

function renderSessionRows(sessionList) {
  if (!sessionList.length) return '<tr><td colspan="5" class="empty">No active sticky sessions</td></tr>';
  return sessionList.map(s =>
    `<tr>` +
    `<td><code>${escHtml(s.sessionId)}</code></td>` +
    `<td><code>${escHtml(s.proxy)}</code></td>` +
    `<td>${ms2human(s.expiresInMs)}</td>` +
    `<td>${ms2human(s.ttlMs)}</td>` +
    `<td>${s.hits}</td>` +
    `</tr>`
  ).join('');
}

function renderDashboard(telemetry, liveProxies, sessionList = []) {
  const { totalFetched=0, aliveCount=0, deadCount=0, lastRefresh=null, refreshCount=0, sourceStats={} } = telemetry;
  const avgMs      = avgLatency(liveProxies);
  const bestMs     = liveProxies.length ? liveProxies[0].latencyMs : '—';
  const successRate= totalFetched > 0 ? ((aliveCount/totalFetched)*100).toFixed(1)+'%' : '—';
  const isPaid     = !!process.env.PROXYCHEAP_API_KEY;
  const hasCreds   = liveProxies.some(p=>p.username);
  const hasCountry = liveProxies.some(p=>p.country);
  const stickyTtl  = parseInt(process.env.STICKY_TTL_MS||'600000',10);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<meta http-equiv="refresh" content="60"/>
<title>Proxy Rotator</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh;padding:22px 26px}
h1{font-size:1.45rem;font-weight:700;color:#f8fafc}
h2{font-size:.78rem;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.07em;margin-bottom:9px}
header{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:10px}
.pills{display:flex;gap:5px;align-items:center;flex-wrap:wrap}
.pill{border-radius:9999px;padding:3px 10px;font-size:.7rem;font-weight:700}
.pill.green{background:#22c55e;color:#052e16}.pill.blue{background:#3b82f6;color:#eff6ff}
.pill.purple{background:#a855f7;color:#faf5ff}.pill.gray{background:#334155;color:#94a3b8}
.meta{font-size:.7rem;color:#475569}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(138px,1fr));gap:11px;margin-bottom:22px}
.card{background:#1e293b;border:1px solid #334155;border-radius:10px;padding:15px}
.card .val{font-size:1.65rem;font-weight:700;color:#f8fafc;line-height:1}
.card .lbl{font-size:.66rem;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-top:5px}
.card.g .val{color:#4ade80}.card.r .val{color:#f87171}.card.y .val{color:#facc15}
.card.b .val{color:#60a5fa}.card.p .val{color:#c084fc}
.section{margin-bottom:20px}
table{width:100%;border-collapse:collapse;background:#1e293b;border:1px solid #334155;border-radius:10px;overflow:hidden}
thead{background:#0f172a}
th{padding:8px 12px;text-align:left;font-size:.66rem;text-transform:uppercase;letter-spacing:.05em;color:#64748b;white-space:nowrap}
td{padding:7px 12px;font-size:.78rem;border-top:1px solid #263348;color:#cbd5e1}
tr:nth-child(even) td{background:#162032}
code{font-family:'SF Mono',Monaco,Consolas,monospace;font-size:.74rem;color:#7dd3fc;word-break:break-all}
.lat{font-weight:600}.fast{color:#4ade80}.medium{color:#facc15}.slow{color:#f87171}
.tag{display:inline-block;border-radius:4px;padding:1px 6px;font-size:.65rem;font-weight:600;background:#1e3a5f;color:#93c5fd}
.empty{padding:26px;text-align:center;color:#475569;font-style:italic}
.api-hint{background:#1e293b;border:1px solid #334155;border-radius:8px;padding:12px 16px;margin-bottom:20px;font-size:.77rem;color:#94a3b8;line-height:1.7}
.api-hint code{color:#7dd3fc;font-size:.74rem}
footer{font-size:.68rem;color:#334155;text-align:center;margin-top:16px}
</style>
</head>
<body>
<header>
  <h1>🔄 Proxy Rotator</h1>
  <div class="pills">
    <span class="pill green">${aliveCount} LIVE</span>
    <span class="pill purple">${sessionList.length} SESSIONS</span>
    ${isPaid ? '<span class="pill blue">proxy-cheap.com</span>' : '<span class="pill gray">free sources</span>'}
    <span class="meta">Refreshed: ${formatRefreshTime(lastRefresh)} · page auto-refreshes every 60s</span>
  </div>
</header>

<div class="api-hint">
  <strong style="color:#e2e8f0">Sticky Session API</strong><br/>
  <code>GET /proxy</code> — random proxy (stateless)<br/>
  <code>GET /proxy?session=my-id</code> — same proxy for <strong>${ms2human(stickyTtl)}</strong> (default TTL)<br/>
  <code>GET /proxy?session=my-id&amp;ttl=120000</code> — same proxy for 2 min<br/>
  <code>DELETE /session/my-id</code> — force rotate (next call gets new proxy)<br/>
  <code>GET /sessions</code> — list all active sessions &nbsp;·&nbsp;
  <code>POST /proxy/:id/rotate</code> — rotate IP at proxy-cheap level
</div>

<div class="cards">
  <div class="card g"><div class="val">${aliveCount}</div><div class="lbl">Live Proxies</div></div>
  <div class="card r"><div class="val">${deadCount}</div><div class="lbl">Dead</div></div>
  <div class="card y"><div class="val">${totalFetched}</div><div class="lbl">Fetched</div></div>
  <div class="card b"><div class="val">${successRate}</div><div class="lbl">Success Rate</div></div>
  <div class="card p"><div class="val">${sessionList.length}</div><div class="lbl">Active Sessions</div></div>
  <div class="card"><div class="val">${ms2human(stickyTtl)}</div><div class="lbl">Default Sticky TTL</div></div>
  <div class="card"><div class="val">${avgMs}</div><div class="lbl">Avg Latency ms</div></div>
  <div class="card g"><div class="val">${bestMs}</div><div class="lbl">Best Latency ms</div></div>
  <div class="card"><div class="val">${refreshCount}</div><div class="lbl">Refresh Cycles</div></div>
</div>

<div class="section">
  <h2>Active Sticky Sessions (${sessionList.length})</h2>
  <table>
    <thead><tr><th>Session ID</th><th>Pinned Proxy</th><th>Expires In</th><th>TTL</th><th>Hits</th></tr></thead>
    <tbody>${renderSessionRows(sessionList)}</tbody>
  </table>
</div>

<div class="section">
  <h2>Sources</h2>
  <table>
    <thead><tr><th>Source</th><th>Proxies Found</th></tr></thead>
    <tbody>${renderSourceRows(sourceStats)}</tbody>
  </table>
</div>

<div class="section">
  <h2>Live Proxies (${aliveCount})</h2>
  <table>
    <thead>
      <tr>
        <th>#</th><th>Host</th><th>Port</th>
        ${hasCreds   ? '<th>Username</th>' : ''}
        ${hasCountry ? '<th>Country</th>'  : ''}
        <th>SOCKS5 URI</th><th>Latency</th><th>Checked</th>
      </tr>
    </thead>
    <tbody>${renderProxyRows(liveProxies)}</tbody>
  </table>
</div>

<footer>proxy-rotator · list refresh every 30 min · sessions purged every 60s</footer>
</body></html>`;
}

module.exports = { renderDashboard };
