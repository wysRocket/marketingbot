import { describe, expect, it } from "vitest";

describe("config", () => {
  it("exposes mostlogin and patchright config blocks", async () => {
    // Set required env vars before importing
    process.env.MOSTLOGIN_API_KEY = "test-key";
    const { config } = await import("../../src/config");
    expect(config.mostlogin).toBeDefined();
    expect(config.patchright).toBeDefined();
    expect(config.proxy).toBeDefined();
  });
});
