import { describe, expect, it } from "vitest";
import { buildMostLoginClientConfig } from "../../../src/mcp/mostlogin/client";

describe("buildMostLoginClientConfig", () => {
  it("uses tunnel url and x-tunnel-bearer in tunnel mode", () => {
    const config = buildMostLoginClientConfig({
      MOSTLOGIN_TUNNEL_URL: "https://mostlogin.example.com",
      MOSTLOGIN_TUNNEL_BEARER: "worker-secret",
      MOSTLOGIN_API_KEY: "local-api-key",
    });

    expect(config.baseURL).toBe("https://mostlogin.example.com");
    expect((config.headers as Record<string, string>)["X-Tunnel-Bearer"]).toBe("worker-secret");
    expect((config.headers as Record<string, string>)["Authorization"]).toBeUndefined();
  });

  it("uses local host with Authorization header when no tunnel url", () => {
    const config = buildMostLoginClientConfig({
      MOSTLOGIN_API_KEY: "local-api-key",
      MOSTLOGIN_HOST: "192.168.1.1:30898",
    });

    expect(config.baseURL).toBe("http://192.168.1.1:30898");
    expect((config.headers as Record<string, string>)["Authorization"]).toBe("local-api-key");
  });
});
