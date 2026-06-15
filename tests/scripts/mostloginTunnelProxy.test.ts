import http from "node:http";
import { describe, expect, it } from "vitest";
import {
  buildUpstreamRequestOptions,
  hasValidTunnelBearer,
  parseMostLoginHost,
} from "../../src/scripts/mostloginTunnelProxy";

describe("mostloginTunnelProxy", () => {
  it("parses host and port from MOSTLOGIN_HOST", () => {
    expect(parseMostLoginHost("127.0.0.1:30898")).toEqual({
      hostname: "127.0.0.1",
      port: 30898,
    });
  });

  it("accepts a matching X-Tunnel-Bearer header", () => {
    expect(
      hasValidTunnelBearer(
        { "x-tunnel-bearer": "secret-bearer" },
        "secret-bearer",
      ),
    ).toBe(true);
    expect(
      hasValidTunnelBearer(
        { "x-tunnel-bearer": "wrong-bearer" },
        "secret-bearer",
      ),
    ).toBe(false);
  });

  it("forwards requests with the local API key and strips the tunnel bearer", () => {
    const request = new http.IncomingMessage(null as never);
    request.method = "POST";
    request.url = "/api/profile/getProfiles?page=1";
    request.headers = {
      "content-type": "application/json",
      "x-tunnel-bearer": "secret-bearer",
      authorization: "old-value",
    };

    const options = buildUpstreamRequestOptions({
      upstreamHost: "127.0.0.1",
      upstreamPort: 30898,
      upstreamApiKey: "desktop-api-key",
      request,
    });

    expect(options.hostname).toBe("127.0.0.1");
    expect(options.port).toBe(30898);
    expect(options.path).toBe("/api/profile/getProfiles?page=1");
    expect(options.headers).toMatchObject({
      authorization: "desktop-api-key",
      "content-type": "application/json",
      host: "127.0.0.1:30898",
    });
    expect(options.headers).not.toHaveProperty("x-tunnel-bearer");
  });
});
