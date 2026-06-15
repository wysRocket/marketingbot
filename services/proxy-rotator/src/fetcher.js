'use strict';

/**
 * Unified proxy fetcher.
 *
 * Strategy:
 *   1. If PROXYCHEAP_API_KEY + PROXYCHEAP_API_SECRET are set → use proxy-cheap.com API (paid, reliable).
 *      Falls back to free sources if the API call fails.
 *   2. Otherwise → scrape 5 free public SOCKS5 lists.
 *
 * All paths return the same shape:
 *   { proxies: [{host, port, username?, password?, type?, country?}], sourceStats, totalFetched }
 */

const { fetchProxies: fetchProxyCheap } = require('./proxycheap');

// ── Free public sources ───────────────────────────────────────────────────────
const FREE_SOURCES = [
  { name: 'ProxyScrape v3',       url: 'https://api.proxyscrape.com/v3/free-proxy-list/get?request=displayproxies&protocol=socks5&timeout=5000' },
  { name: 'TheSpeedX',            url: 'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks5.txt' },
  { name: 'proxy-list.download',  url: 'https://www.proxy-list.download/api/v1/get?type=socks5' },
  { name: 'hookzof',              url: 'https://raw.githubusercontent.com/hookzof/socks5_list/master/proxy.txt' },
  { name: 'MuRongPIG',            url: 'https://raw.githubusercontent.com/MuRongPIG/Proxy-Master/main/socks5.txt' },
];

const IP_PORT_RE = /^\d{1,3}(?:\.\d{1,3}){3}:\d{2,5}$/;

async function fetchFreeSource(source) {
  try {
    const res = await fetch(source.url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      console.warn(`[fetcher] ${source.name} → HTTP ${res.status}`);
      return { name: source.name, entries: [] };
    }
    const text = await res.text();
    const entries = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => IP_PORT_RE.test(l))
      .map((entry) => {
        const [host, portStr] = entry.split(':');
        return { host, port: parseInt(portStr, 10) };
      });
    console.log(`[fetcher] ${source.name} → ${entries.length} proxies`);
    return { name: source.name, entries };
  } catch (err) {
    console.warn(`[fetcher] ${source.name} failed: ${err.message}`);
    return { name: source.name, entries: [] };
  }
}

async function fetchFreeProxies() {
  const results = await Promise.allSettled(FREE_SOURCES.map(fetchFreeSource));

  const seen = new Set();
  const unique = [];
  const sourceStats = {};

  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    const { name, entries } = r.value;
    sourceStats[name] = entries.length;
    for (const entry of entries) {
      const key = `${entry.host}:${entry.port}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(entry);
      }
    }
  }

  return { proxies: unique, sourceStats, totalFetched: unique.length };
}

// ── Main entry point ──────────────────────────────────────────────────────────

async function fetchAllProxies() {
  const apiKey    = process.env.PROXYCHEAP_API_KEY;
  const apiSecret = process.env.PROXYCHEAP_API_SECRET;

  if (apiKey && apiSecret) {
    console.log('[fetcher] Using proxy-cheap.com API (paid)...');
    try {
      const proxies = await fetchProxyCheap(apiKey, apiSecret);
      const count = proxies.length;
      const sourceStats = { 'proxy-cheap.com': count };
      console.log(`[fetcher] proxy-cheap.com → ${count} active proxies`);
      return { proxies, sourceStats, totalFetched: count };
    } catch (err) {
      console.error(`[fetcher] proxy-cheap API failed (${err.message}) — falling back to free sources`);
    }
  } else {
    console.log('[fetcher] No PROXYCHEAP_API_KEY set — using free public sources...');
  }

  return fetchFreeProxies();
}

module.exports = { fetchAllProxies };
