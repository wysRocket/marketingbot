import { config } from "./config";

export interface RunnerProxyConfig {
  server: string;
  username?: string;
  password?: string;
}

function normalizeMostLoginProxyProtocol(input: {
  protocol?: string;
  host?: string;
  port?: number;
  proxyUsername?: string;
  proxyPassword?: string;
}): string {
  const protocol = input.protocol ?? "http";
  const isAuthenticatedSocks5 =
    protocol === "socks5" &&
    Boolean(input.proxyUsername) &&
    Boolean(input.proxyPassword);
  const isDataImpulseGateway =
    input.host === config.proxy.host && input.port === config.proxy.port;

  // Patchright rejects authenticated socks5 proxies at launch, but the
  // DataImpulse gateway we already use for fallback proxies is available over
  // HTTP with the same credentials.
  if (isAuthenticatedSocks5 && isDataImpulseGateway) {
    return "http";
  }

  return protocol;
}

/**
 * @deprecated Use resolveProxyForSession instead.
 */
export function buildProxy(): string | undefined {
  const { user, pass, host, port } = config.proxy;
  if (!user || !pass) return undefined;
  return `socks5://${user}:${pass}@${host}:${port}`;
}

export function resolveProxyForSession(input: {
  runner: "railway" | "local";
  mostloginProxy?: {
    protocol?: string;
    host?: string;
    port?: number;
    proxyUsername?: string;
    proxyPassword?: string;
  };
  fallbackProxy?: RunnerProxyConfig;
}): RunnerProxyConfig | undefined {
  if (input.mostloginProxy?.host && input.mostloginProxy?.port) {
    const protocol = normalizeMostLoginProxyProtocol(input.mostloginProxy);
    return {
      server: `${protocol}://${input.mostloginProxy.host}:${input.mostloginProxy.port}`,
      username: input.mostloginProxy.proxyUsername,
      password: input.mostloginProxy.proxyPassword,
    };
  }

  if (input.fallbackProxy) return input.fallbackProxy;

  if (input.runner === "railway") {
    throw new Error(
      "Railway session requires either a MostLogin proxy or a fallback proxy",
    );
  }

  return undefined;
}
