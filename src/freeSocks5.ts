import net from "node:net";
import { RunnerProxyConfig } from "./proxy";

const SOURCES = [
  "https://api.proxyscrape.com/v3/free-proxy-list/get?request=displayproxies&protocol=socks5&timeout=5000",
  "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks5.txt",
  "https://www.proxy-list.download/api/v1/get?type=socks5",
];

async function fetchSource(url: string): Promise<string[]> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const text = await res.text();
    return text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => /^\d+\.\d+\.\d+\.\d+:\d+$/.test(l));
  } catch {
    return [];
  }
}

async function fetchAllRaw(): Promise<string[]> {
  const results = await Promise.allSettled(SOURCES.map(fetchSource));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    for (const entry of r.value) {
      if (!seen.has(entry)) {
        seen.add(entry);
        out.push(entry);
      }
    }
  }
  return out;
}

function validateSocks5Proxy(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

async function validateBatch(
  entries: string[],
  timeoutMs: number,
  concurrency: number,
  limit: number,
): Promise<RunnerProxyConfig[]> {
  const live: RunnerProxyConfig[] = [];
  let i = 0;

  async function worker() {
    while (i < entries.length && live.length < limit) {
      const entry = entries[i++];
      if (!entry) continue;
      const [host, portStr] = entry.split(":");
      const port = parseInt(portStr, 10);
      if (!host || !port) continue;
      const ok = await validateSocks5Proxy(host, port, timeoutMs);
      if (ok && live.length < limit) {
        live.push({ server: `socks5://${host}:${port}` });
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return live;
}

export async function fetchLiveFreeSocks5Proxies(opts?: {
  limit?: number;
  timeoutMs?: number;
  concurrency?: number;
}): Promise<RunnerProxyConfig[]> {
  const limit = opts?.limit ?? 10;
  const timeoutMs = opts?.timeoutMs ?? 3000;
  const concurrency = opts?.concurrency ?? 20;

  const raw = await fetchAllRaw();
  return validateBatch(raw, timeoutMs, concurrency, limit);
}
