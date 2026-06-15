import { describe, expect, it } from "vitest";
import { resolveProxyForSession } from "../../src/proxy";

describe("resolveProxyForSession", () => {
  it("prefers a MostLogin proxy over DataImpulse fallback", () => {
    const proxy = resolveProxyForSession({
      runner: "railway",
      mostloginProxy: {
        protocol: "http",
        host: "proxy.example.com",
        port: 8080,
        proxyUsername: "u",
        proxyPassword: "p",
      },
      fallbackProxy: {
        server: "http://gw.dataimpulse.com:10000",
        username: "fallback",
        password: "secret",
      },
    });

    expect(proxy?.server).toBe("http://proxy.example.com:8080");
    expect(proxy?.username).toBe("u");
  });

  it("falls back to DataImpulse when no MostLogin proxy", () => {
    const proxy = resolveProxyForSession({
      runner: "local",
      mostloginProxy: undefined,
      fallbackProxy: {
        server: "http://gw.dataimpulse.com:10000",
        username: "fallback",
        password: "secret",
      },
    });

    expect(proxy?.server).toBe("http://gw.dataimpulse.com:10000");
  });

  it("normalizes DataImpulse MostLogin socks5 proxies to http for Patchright", () => {
    const proxy = resolveProxyForSession({
      runner: "local",
      mostloginProxy: {
        protocol: "socks5",
        host: "gw.dataimpulse.com",
        port: 10000,
        proxyUsername: "u",
        proxyPassword: "p",
      },
      fallbackProxy: undefined,
    });

    expect(proxy?.server).toBe("http://gw.dataimpulse.com:10000");
    expect(proxy?.username).toBe("u");
    expect(proxy?.password).toBe("p");
  });

  it("throws on railway when no proxy available", () => {
    expect(() =>
      resolveProxyForSession({
        runner: "railway",
        mostloginProxy: undefined,
        fallbackProxy: undefined,
      }),
    ).toThrow(/proxy/i);
  });

  it("returns undefined on local when no proxy configured", () => {
    const proxy = resolveProxyForSession({
      runner: "local",
      mostloginProxy: undefined,
      fallbackProxy: undefined,
    });
    expect(proxy).toBeUndefined();
  });
});
