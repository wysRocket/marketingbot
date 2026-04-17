import { describe, expect, it } from "vitest";

describe("config", () => {
  it("exposes mostlogin, nstbrowser, proxy, and patchright config blocks", async () => {
    process.env.MOSTLOGIN_API_KEY = "test-key";
    process.env.NSTBROWSER_API_KEY = "nst-test-key";
    const { config } = await import("../../src/config");

    expect(config.mostlogin).toBeDefined();
    expect(config.nstbrowser).toBeDefined();
    expect(config.nstbrowser.apiKey).toBe("nst-test-key");
    expect(config.patchright).toBeDefined();
    expect(config.proxy).toBeDefined();
  });
});
