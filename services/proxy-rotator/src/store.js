'use strict';

/**
 * In-memory store for proxy data and telemetry.
 * proxies[] holds both alive and dead entries; query getLiveProxies() for live-only.
 */
const state = {
  proxies: [],
  telemetry: {
    totalFetched: 0,
    aliveCount: 0,
    deadCount: 0,
    lastRefresh: null,
    sourceStats: {},
    refreshCount: 0,
  },
};

/** Replace the full proxy list (alive + dead combined, alive sorted first). */
function setProxies(list) {
  state.proxies = list;
}

/** Return only alive proxies, sorted by ascending latency. */
function getLiveProxies() {
  return state.proxies.filter((p) => p.alive);
}

/** Return a uniformly random alive proxy, or null if none. */
function getRandomProxy() {
  const live = getLiveProxies();
  if (live.length === 0) return null;
  return live[Math.floor(Math.random() * live.length)];
}

/** Merge telemetry fields and stamp lastRefresh. */
function updateTelemetry(stats) {
  Object.assign(state.telemetry, stats);
  state.telemetry.lastRefresh = new Date().toISOString();
  state.telemetry.refreshCount += 1;
}

/** Return a shallow copy of current telemetry. */
function getTelemetry() {
  return { ...state.telemetry };
}

module.exports = { setProxies, getLiveProxies, getRandomProxy, updateTelemetry, getTelemetry };
