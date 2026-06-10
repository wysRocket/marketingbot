'use strict';

/**
 * Sticky-session store.
 *
 * A "session" is identified by any caller-supplied string key (user ID, task ID,
 * browser fingerprint, etc.).  Within the TTL window the same proxy is returned
 * every time.  After expiry (or manual release) the next call assigns a new one.
 *
 * Data shape per entry:
 *   { proxy, assignedAt, ttlMs, hits }
 */

/** @type {Map<string, { proxy: object, assignedAt: number, ttlMs: number, hits: number }>} */
const sessions = new Map();

const DEFAULT_TTL_MS = parseInt(process.env.STICKY_TTL_MS || '600000', 10); // 10 min

/**
 * Return (or assign) a sticky proxy for the given session ID.
 *
 * @param {string}   sessionId   - Caller-supplied session key
 * @param {number}   ttlMs       - Per-request TTL override (0 → use DEFAULT_TTL_MS)
 * @param {Function} getRandomProxy - Function that returns a random live proxy or null
 * @returns {{ proxy, fresh, expiresInMs, sessionId } | null}
 */
function getOrAssign(sessionId, ttlMs, getRandomProxy) {
  const now = Date.now();
  const effectiveTtl = (ttlMs > 0 ? ttlMs : DEFAULT_TTL_MS);
  const existing = sessions.get(sessionId);

  if (existing) {
    const age = now - existing.assignedAt;
    const sessionTtl = existing.ttlMs; // honour the TTL that was set at assignment time

    if (age < sessionTtl) {
      existing.hits += 1;
      return {
        proxy:       existing.proxy,
        fresh:       false,
        expiresInMs: sessionTtl - age,
        sessionId,
        hits:        existing.hits,
      };
    }
    // Expired — fall through to re-assign
    sessions.delete(sessionId);
  }

  const proxy = getRandomProxy();
  if (!proxy) return null;

  sessions.set(sessionId, { proxy, assignedAt: now, ttlMs: effectiveTtl, hits: 1 });
  return { proxy, fresh: true, expiresInMs: effectiveTtl, sessionId, hits: 1 };
}

/** Force-release a session so the next call gets a fresh proxy. */
function release(sessionId) {
  return sessions.delete(sessionId);
}

/** Release all sessions assigned to a specific proxy host:port (e.g. after it goes dead). */
function releaseByProxy(host, port) {
  let count = 0;
  for (const [id, s] of sessions) {
    if (s.proxy.host === host && s.proxy.port === port) {
      sessions.delete(id);
      count++;
    }
  }
  return count;
}

/** Purge sessions whose TTL has expired (call periodically to prevent memory growth). */
function purgeExpired() {
  const now = Date.now();
  let count = 0;
  for (const [id, s] of sessions) {
    if (now - s.assignedAt > s.ttlMs) {
      sessions.delete(id);
      count++;
    }
  }
  return count;
}

/** Return a summary snapshot of all active (non-expired) sessions. */
function list() {
  const now = Date.now();
  const out = [];
  for (const [id, s] of sessions) {
    const age = now - s.assignedAt;
    if (age >= s.ttlMs) continue; // skip expired (will be purged next cycle)
    out.push({
      sessionId:   id,
      proxy:       `${s.proxy.host}:${s.proxy.port}`,
      assignedAt:  new Date(s.assignedAt).toISOString(),
      expiresInMs: s.ttlMs - age,
      ttlMs:       s.ttlMs,
      hits:        s.hits,
    });
  }
  return out;
}

function count() {
  // Count only non-expired
  const now = Date.now();
  let n = 0;
  for (const s of sessions.values()) {
    if (now - s.assignedAt < s.ttlMs) n++;
  }
  return n;
}

module.exports = { getOrAssign, release, releaseByProxy, purgeExpired, list, count, DEFAULT_TTL_MS };
