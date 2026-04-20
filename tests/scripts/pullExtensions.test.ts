import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  downloadCrx,
  hasMaterializedExtensions,
  materializeExtensions,
  resolveLocalizedManifestValue,
  validateManifestEntry,
} from "../../src/scripts/pullExtensions";

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

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("requests CRX downloads with acceptformat so Google returns an archive", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(new Uint8Array([1, 2, 3]).buffer, { status: 200 }),
      );

    await downloadCrx({
      slug: "similarweb",
      chromeStoreId: "hoklmmgfnpapgjgcpechhaamimifchmp",
      expectedName: "Correct Name",
      pinnedVersion: "1.0.0",
      sha256: "same-hash",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [requestUrl] = fetchMock.mock.calls[0] ?? [];
    const parsed = new URL(String(requestUrl));
    expect(parsed.searchParams.get("response")).toBe("redirect");
    expect(parsed.searchParams.get("acceptformat")).toBe("crx2,crx3");
    expect(parsed.searchParams.get("x")).toContain(
      "id=hoklmmgfnpapgjgcpechhaamimifchmp",
    );
  });

  it("resolves localized manifest placeholders via locale messages", () => {
    expect(
      resolveLocalizedManifestValue("__MSG_name__", {
        name: {
          message: "Similarweb - Website Traffic, AI Traffic & SEO Checker",
        },
      }),
    ).toBe("Similarweb - Website Traffic, AI Traffic & SEO Checker");
  });

  it("writes unpacked extension directories during materialization", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "extensions-test-"));
    const manifestPath = path.join(tempDir, "manifest.json");
    const outputDir = path.join(tempDir, ".extensions");
    const archivePath = path.join(tempDir, "sample.zip");

    await writeFile(
      manifestPath,
      JSON.stringify([
        {
          slug: "similarweb",
          chromeStoreId: "hoklmmgfnpapgjgcpechhaamimifchmp",
          expectedName: "Correct Name",
          pinnedVersion: "1.0.0",
          sha256: "same-hash",
        },
      ]),
      "utf8",
    );
    await writeFile(archivePath, "fake archive", "utf8");

    await materializeExtensions({
      manifestPath,
      outputDir,
      downloadCrx: async () => Buffer.from("archive"),
      inspectCrx: async () => ({
        name: "Correct Name",
        version: "1.0.0",
        sha256: "same-hash",
      }),
      unpackCrx: async (_buffer, destination) => {
        await writeFile(
          path.join(destination, "manifest.json"),
          JSON.stringify({ name: "Correct Name", version: "1.0.0" }),
          "utf8",
        );
      },
    });

    const writtenManifest = await readFile(
      path.join(outputDir, "similarweb", "manifest.json"),
      "utf8",
    );
    expect(JSON.parse(writtenManifest)).toMatchObject({
      name: "Correct Name",
      version: "1.0.0",
    });
  });

  it("recognizes a complete preloaded extension bundle", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "extensions-test-"));
    const manifestPath = path.join(tempDir, "manifest.json");
    const outputDir = path.join(tempDir, ".extensions");

    await writeFile(
      manifestPath,
      JSON.stringify([
        {
          slug: "similarweb",
          chromeStoreId: "hoklmmgfnpapgjgcpechhaamimifchmp",
          expectedName: "Correct Name",
          pinnedVersion: "1.0.0",
          sha256: "same-hash",
        },
      ]),
      "utf8",
    );
    await mkdir(path.join(outputDir, "similarweb"), { recursive: true });
    await writeFile(
      path.join(outputDir, "similarweb", "manifest.json"),
      JSON.stringify({ name: "Correct Name", version: "1.0.0" }),
      "utf8",
    );

    await expect(
      hasMaterializedExtensions({ manifestPath, outputDir }),
    ).resolves.toBe(true);
  });
});
