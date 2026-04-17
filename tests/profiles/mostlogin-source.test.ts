import { describe, expect, it } from "vitest";

describe("mostlogin source", () => {
  it("loadFromMostLogin is exported", async () => {
    const mod = await import("../../src/profiles/sources/mostlogin");
    expect(typeof mod.loadFromMostLogin).toBe("function");
  });
});
