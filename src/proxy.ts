import { config } from "./config";

/**
 * Build a DataImpulse SOCKS5 proxy URL.
 * Returns undefined when DI_USER / DI_PASS are not set, which causes
 * launchSession() to start the browser without a proxy (direct IP).
 */
export function buildProxy(): string | undefined {
  const { user, pass, host, port } = config.proxy;
  if (!user || !pass) return undefined;
  return `socks5://${user}:${pass}@${host}:${port}`;
}
