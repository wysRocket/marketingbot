'use strict';

/**
 * Proxy-Cheap.com API fetcher.
 * Docs: https://docs.proxy-cheap.com/
 *
 * Auth: two custom headers — X-Api-Key and X-Api-Secret
 * Proxy list: GET https://api.proxy-cheap.com/proxies
 *
 * Returns an array of normalized proxy objects:
 *   { id, host, port, username, password, type, country, orderId }
 */

const BASE_URL = 'https://api.proxy-cheap.com';

/** Coerce various field-name conventions from the API response into one shape. */
function normalizeProxy(p) {
  const host = p.host || p.ip || p.address || p.proxyHost || null;
  const port = p.port ? parseInt(p.port, 10) : (p.proxyPort ? parseInt(p.proxyPort, 10) : null);
  const username = p.username || p.user || p.login || p.authLogin || null;
  const password = p.password || p.pass || p.authPassword || null;
  const type = (p.type || p.protocol || p.proxyProtocol || 'SOCKS5').toUpperCase();
  const country = p.country || p.countryCode || p.location || null;
  const status = (p.status || 'ACTIVE').toUpperCase();
  return { id: p.id || null, host, port, username, password, type, country, status };
}

/**
 * GET /proxies — returns all proxies on the account.
 * @param {string} apiKey
 * @param {string} apiSecret
 * @returns {Promise<Array<{id,host,port,username,password,type,country}>>}
 */
async function fetchProxies(apiKey, apiSecret) {
  const res = await fetch(`${BASE_URL}/proxies`, {
    headers: {
      Accept: 'application/json',
      'X-Api-Key': apiKey,
      'X-Api-Secret': apiSecret,
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`proxy-cheap /proxies → HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();

  // Handle { proxies:[...] }, { data:[...] }, or a bare array
  const raw = Array.isArray(data) ? data : (data.proxies || data.data || []);

  return raw
    .map(normalizeProxy)
    .filter((p) => p.host && p.port && p.status === 'ACTIVE');
}

/**
 * GET /orders/:orderId/proxies — returns proxies for a specific order.
 */
async function fetchOrderProxies(apiKey, apiSecret, orderId) {
  const res = await fetch(`${BASE_URL}/orders/${orderId}/proxies`, {
    headers: {
      Accept: 'application/json',
      'X-Api-Key': apiKey,
      'X-Api-Secret': apiSecret,
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`proxy-cheap /orders/${orderId}/proxies → HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const raw = Array.isArray(data) ? data : (data.proxies || data.data || []);
  return raw.map(normalizeProxy).filter((p) => p.host && p.port);
}

module.exports = { fetchProxies, fetchOrderProxies };
