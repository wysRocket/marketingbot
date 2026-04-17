import { config } from "./config";

export interface RunnerProxyConfig {
  server: string;
  username?: string;
  password?: string;
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
    return {
      server: `${input.mostloginProxy.protocol ?? "http"}://${input.mostloginProxy.host}:${input.mostloginProxy.port}`,
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
