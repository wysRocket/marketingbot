import { describe, expect, it } from "vitest";
import { resolveProfileSource } from "../../src/profiles/catalog";

describe("resolveProfileSource", () => {
  it("rejects silent generator fallback in production", () => {
    expect(() =>
      resolveProfileSource({
        requestedSource: "mostlogin",
        mostloginAvailable: false,
        snapshotAvailable: false,
        environment: "production",
        allowGeneratorFallback: false,
      }),
    ).toThrow(/generator fallback/i);
  });

  it("uses snapshot before generator when available", () => {
    expect(
      resolveProfileSource({
        requestedSource: "mostlogin",
        mostloginAvailable: false,
        snapshotAvailable: true,
        environment: "production",
        allowGeneratorFallback: false,
      }),
    ).toBe("snapshot");
  });
});
