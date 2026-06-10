'use strict';

require('dotenv').config();

const express = require('express');
const { fetchAllProxies }  = require('./fetcher');
const { validateProxies }  = require('./validator');
const { setProxies, getLiveProxies, getRandomProxy, updateTelemetry, getTelemetry } = require('./store');
const { renderDashboard }  = require('./dashboard');
const sessions             = require('./sessions');

// ── Config ────────────────────────────────────────────────────────────────────
const PORT                = parseInt(process.env.PORT                || '3001',    10);
const REFRESH_INTERVAL_MS = parseInt(process.env.REFRESH_INTERVAL_MS || '1800000', 10);
const VALIDATE_TIMEOUT_MS = parseInt(process.env.VALIDATE_TIMEOUT_MS || '5000',    10);
const VALIDATE_CONCURRENCY= parseInt(process.env.VALIDATE_CONCURRENCY|| '60',      10);
const PROXYCHEAP_API_KEY  = process.env.PROXYCHEAP_API_KEY  || '';
const PROXYCHEAP_API_SECRET = process.env.PROXYCHEAP_API_SECRET || '';

// ── Helpers ───────────────────────────────────────────────────────────────────
function proxyUri(p) {
  if (p.username && p.password) {
    return `socks5://${encodeURIComponent(p.username)}:${encodeURIComponent(p.password)}@${p.host}:${p.port}`;
  }
  return `socks5://${p.host}:${p.port}`;
}

function serialize(p) {
  return {
    host: p.host, port: p.port,
    proxy: proxyUri(p),
    latencyMs: p.latencyMs,
    checkedAt: p.checkedAt,
    ...(p.country  ? { country:  p.country  } : {}),
    ...(p.username ? { username: p.username  } : {}),
    ...(p.type     ? { type:     p.type      } : {}),
    ...(p.id       ? { id:       p.id        } : {}),
  };
}

// ── App ───────────────────────────────────────────────────────────────────────
const app = express();
app.disable('x-powered-by');
app.use(express.json());
app.use((req, _res, next) => {
  if (req.path !== '/health') console.log(`[http] ${req.method} ${req.path}`);
  next();
});

// ── Routes ────────────────────────────────────────────────────────────────────

/** Railway health check */
app.get('/health', (_req, res) => {
  const t = getTelemetry();
  res.json({ status: 'ok', liveProxies: t.aliveCount, activeSessions: sessions.count(), lastRefresh: t.lastRefresh });
});

/**
 * GET /proxy
 *   ?session=<id>       sticky session (returns same proxy within TTL)
 *   ?session=<id>&ttl=<ms>   sticky with custom TTL
 *   (no session param) → uniformly random proxy
 */
app.get('/proxy', (req, res) => {
  const sessionId = req.query.session ? String(req.query.session) : null;
  const ttlMs     = req.query.ttl     ? parseInt(req.query.ttl, 10) : 0;

  if (sessionId) {
    const result = sessions.getOrAssign(sessionId, ttlMs, getRandomProxy);
    if (!result) return res.status(503).json({ error: 'No live proxies available' });

    return res.json({
      ...serialize(result.proxy),
      session: {
        id:          sessionId,
        fresh:       result.fresh,
        expiresInMs: result.expiresInMs,
        ttlMs:       ttlMs || sessions.DEFAULT_TTL_MS,
        hits:        result.hits,
      },
    });
  }

  const proxy = getRandomProxy();
  if (!proxy) return res.status(503).json({ error: 'No live proxies available' });
  res.json(serialize(proxy));
});

/** Release a sticky session (next call gets a new proxy) */
app.delete('/session/:id', (req, res) => {
  const released = sessions.release(req.params.id);
  res.json({ released, sessionId: req.params.id });
});

/** List all active sticky sessions */
app.get('/sessions', (_req, res) => {
  const list = sessions.list();
  res.json({ count: list.length, defaultTtlMs: sessions.DEFAULT_TTL_MS, sessions: list });
});

/** All live proxies */
app.get('/proxies', (_req, res) => {
  const proxies = getLiveProxies().map(serialize);
  res.json({ count: proxies.length, proxies });
});

/** Full telemetry */
app.get('/telemetry', (_req, res) => {
  res.json({ ...getTelemetry(), activeSessions: sessions.count(), defaultStickyTtlMs: sessions.DEFAULT_TTL_MS });
});

/**
 * POST /proxy/:proxyId/rotate
 * Calls proxy-cheap's rotate-ip API to assign a new residential IP to the proxy.
 * Only relevant for residential rotating proxies.
 */
app.post('/proxy/:proxyId/rotate', async (req, res) => {
  if (!PROXYCHEAP_API_KEY) {
    return res.status(501).json({ error: 'proxy-cheap credentials not configured' });
  }
  const { proxyId } = req.params;
  try {
    const apiRes = await fetch(`https://api.proxy-cheap.com/proxies/${proxyId}/rotate-ip`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept':       'application/json',
        'X-Api-Key':    PROXYCHEAP_API_KEY,
        'X-Api-Secret': PROXYCHEAP_API_SECRET,
      },
      signal: AbortSignal.timeout(10_000),
    });
    const body = await apiRes.json().catch(() => ({}));
    if (!apiRes.ok) return res.status(apiRes.status).json({ error: 'proxy-cheap API error', detail: body });

    // Also release any sticky sessions pinned to this proxy so they pick up the new IP
    // We don't know the host here, but the caller can also call DELETE /session/:id
    res.json({ rotated: true, proxyId, response: body });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

/** HTML dashboard */
app.get('/dashboard', (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(renderDashboard(getTelemetry(), getLiveProxies(), sessions.list()));
});

app.get('/', (_req, res) => res.redirect('/dashboard'));

// ── Background jobs ───────────────────────────────────────────────────────────
let isRefreshing = false;

async function refreshProxies() {
  if (isRefreshing) { console.log('[refresh] Skipping — already running'); return; }
  isRefreshing = true;
  const t0 = Date.now();
  console.log('[refresh] ── Starting ──');
  try {
    const { proxies: rawList, sourceStats, totalFetched } = await fetchAllProxies();
    const { alive, dead } = await validateProxies(rawList, { timeoutMs: VALIDATE_TIMEOUT_MS, concurrency: VALIDATE_CONCURRENCY });
    setProxies([...alive, ...dead]);
    updateTelemetry({ totalFetched, aliveCount: alive.length, deadCount: dead.length, sourceStats });
    console.log(`[refresh] ── Done in ${((Date.now()-t0)/1000).toFixed(1)}s · ${alive.length} live ──`);
  } catch (err) {
    console.error('[refresh] Error:', err.message);
  } finally {
    isRefreshing = false;
  }
}

// Purge expired sessions every minute
setInterval(() => {
  const n = sessions.purgeExpired();
  if (n > 0) console.log(`[sessions] Purged ${n} expired sessions`);
}, 60_000);

// ── Boot ──────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  const isPaid = !!(PROXYCHEAP_API_KEY && PROXYCHEAP_API_SECRET);
  console.log(`[proxy-rotator] Port ${PORT} · Source: ${isPaid ? 'proxy-cheap.com' : 'free sources'}`);
  console.log(`[proxy-rotator] Sticky TTL: ${sessions.DEFAULT_TTL_MS / 1000}s · Refresh: ${REFRESH_INTERVAL_MS / 60000}min`);
  console.log(`[proxy-rotator] Dashboard → http://localhost:${PORT}/dashboard`);
  console.log(`[proxy-rotator] Routes: GET /proxy[?session=<id>&ttl=<ms>]  GET /proxies  GET /sessions  DELETE /session/:id  POST /proxy/:id/rotate`);
  refreshProxies();
  setInterval(refreshProxies, REFRESH_INTERVAL_MS);
});
