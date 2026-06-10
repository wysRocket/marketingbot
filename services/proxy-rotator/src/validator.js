'use strict';

/**
 * Validates proxies via TCP connect.
 * Accepts either:
 *   - Objects: { host, port, username?, password?, ...rest }
 *   - Strings: "host:port" (legacy free-source format)
 *
 * A successful TCP handshake means the port is open and reachable.
 * All original fields (username, password, country, etc.) are preserved in the output.
 * alive proxies are sorted ascending by latencyMs.
 */

const net = require('net');

function tcpConnect(host, port, timeoutMs) {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);

    const finish = (ok) => {
      socket.destroy();
      resolve({ ok, latencyMs: ok ? Date.now() - start : null });
    };

    socket.once('connect', () => finish(true));
    socket.once('error',   () => finish(false));
    socket.once('timeout', () => finish(false));
    socket.connect(port, host);
  });
}

/** Normalize a raw entry (string or object) into { host, port, ...rest }. */
function normalize(entry) {
  if (typeof entry === 'string') {
    const colonIdx = entry.lastIndexOf(':');
    if (colonIdx === -1) return null;
    const host = entry.slice(0, colonIdx);
    const port = parseInt(entry.slice(colonIdx + 1), 10);
    return { host, port };
  }
  if (entry && entry.host && entry.port) return entry;
  return null;
}

/**
 * Validate a list of proxy entries concurrently.
 * @param {Array<string|Object>} rawList
 * @param {{ timeoutMs?: number, concurrency?: number }} opts
 * @returns {Promise<{ alive: ProxyRecord[], dead: ProxyRecord[] }>}
 */
async function validateProxies(rawList, { timeoutMs = 5000, concurrency = 60 } = {}) {
  const entries = rawList.map(normalize).filter(Boolean);
  const alive = [];
  const dead  = [];
  let cursor  = 0;
  const total = entries.length;

  console.log(`[validator] Checking ${total} proxies (concurrency=${concurrency}, timeout=${timeoutMs}ms)...`);

  async function worker() {
    while (cursor < total) {
      const entry = entries[cursor++];
      const { host, port } = entry;

      if (!host || !port || port < 1 || port > 65535) continue;

      const { ok, latencyMs } = await tcpConnect(host, port, timeoutMs);

      // Spread all original fields (preserves username, password, country, id, etc.)
      const record = {
        ...entry,
        latencyMs,
        checkedAt: new Date().toISOString(),
        alive: ok,
      };

      if (ok) alive.push(record);
      else    dead.push(record);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, total || 1) }, worker));

  alive.sort((a, b) => a.latencyMs - b.latencyMs);

  console.log(`[validator] Done: ${alive.length} alive / ${dead.length} dead`);
  return { alive, dead };
}

module.exports = { validateProxies };
