import { describe, expect, it } from "vitest";
import { validateManifestEntry } from "../../src/scripts/pullExtensions";

describe("validateManifestEntry", () => {
  it("throws on extension name mismatch", () => {
    expect(() =>
      validateManifestEntry(
        {
          slug: "similarweb",
          chromeStoreId: "hoklmmgfnpapgjgcpechhaamimifchmp",
          expectedName: "Similarweb Traffic Checker",
          pinnedVersion: "1.0.0",
          sha256: "abc",
        },
        {
          name: "Wrong Name",
          version: "1.0.0",
          sha256: "abc",
        },
      ),
    ).toThrow(/name mismatch/i);
  });

  it("throws on version mismatch", () => {
    expect(() =>
      validateManifestEntry(
        {
          slug: "similarweb",
          chromeStoreId: "hoklmmgfnpapgjgcpechhaamimifchmp",
          expectedName: "Correct Name",
          pinnedVersion: "1.0.0",
          sha256: "abc",
        },
        {
          name: "Correct Name",
          version: "2.0.0",
          sha256: "abc",
        },
      ),
    ).toThrow(/version mismatch/i);
  });

  it("throws on hash mismatch", () => {
    expect(() =>
      validateManifestEntry(
        {
          slug: "similarweb",
          chromeStoreId: "hoklmmgfnpapgjgcpechhaamimifchmp",
          expectedName: "Correct Name",
          pinnedVersion: "1.0.0",
          sha256: "expected-hash",
        },
        {
          name: "Correct Name",
          version: "1.0.0",
          sha256: "different-hash",
        },
      ),
    ).toThrow(/hash mismatch/i);
  });

  it("passes when all fields match", () => {
    expect(() =>
      validateManifestEntry(
        {
          slug: "similarweb",
          chromeStoreId: "hoklmmgfnpapgjgcpechhaamimifchmp",
          expectedName: "Correct Name",
          pinnedVersion: "1.0.0",
          sha256: "same-hash",
        },
        {
          name: "Correct Name",
          version: "1.0.0",
          sha256: "same-hash",
        },
      ),
    ).not.toThrow();
  });
});
