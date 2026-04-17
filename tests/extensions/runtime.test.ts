import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveExtensionBundle } from "../../src/extensions/runtime";

async function writeManifest(tempDir: string): Promise<string> {
  const manifestPath = path.join(tempDir, "manifest.json");
  await writeFile(
    manifestPath,
    JSON.stringify([
      {
        slug: "similarweb",
        chromeStoreId: "sw",
        expectedName: "Similarweb",
        pinnedVersion: "6.12.19",
        sha256: "hash-sw",
      },
      {
        slug: "honey",
        chromeStoreId: "hn",
        expectedName: "Honey",
        pinnedVersion: "19.0.3",
        sha256: "hash-hn",
      },
      {
        slug: "hola",
        chromeStoreId: "hl",
        expectedName: "Hola",
        pinnedVersion: "1.251.527",
        sha256: "hash-hl",
      },
    ]),
    "utf8",
  );

  return manifestPath;
}

async function writeExtensions(
  tempDir: string,
  slugs: string[],
): Promise<string> {
  const extensionsDir = path.join(tempDir, ".extensions");
  await mkdir(extensionsDir, { recursive: true });

  for (const slug of slugs) {
    await mkdir(path.join(extensionsDir, slug), { recursive: true });
  }

  return extensionsDir;
}

describe("resolveExtensionBundle", () => {
  it("loads all local extensions outside Railway when no env override is set", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "extension-bundle-"));
    const manifestPath = await writeManifest(tempDir);
    const extensionsDir = await writeExtensions(tempDir, [
      "honey",
      "similarweb",
      "hola",
    ]);

    const bundle = resolveExtensionBundle({
      extensionsDir,
      manifestPath,
      railwayEnvironment: false,
    });

    expect(bundle.selectedSlugs).toEqual(["hola", "honey", "similarweb"]);
    expect(bundle.selectedPaths).toEqual([
      path.join(extensionsDir, "hola"),
      path.join(extensionsDir, "honey"),
      path.join(extensionsDir, "similarweb"),
    ]);
    expect(bundle.bundleHash).toMatch(/^sha256:/);
  });

  it("defaults Railway to the Similarweb-only bundle", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "extension-bundle-"));
    const manifestPath = await writeManifest(tempDir);
    const extensionsDir = await writeExtensions(tempDir, [
      "honey",
      "similarweb",
      "hola",
    ]);

    const bundle = resolveExtensionBundle({
      extensionsDir,
      manifestPath,
      railwayEnvironment: true,
    });

    expect(bundle.selectedSlugs).toEqual(["similarweb"]);
    expect(bundle.selectedPaths).toEqual([
      path.join(extensionsDir, "similarweb"),
    ]);
  });

  it("uses only the explicitly requested slugs", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "extension-bundle-"));
    const manifestPath = await writeManifest(tempDir);
    const extensionsDir = await writeExtensions(tempDir, [
      "honey",
      "similarweb",
      "hola",
    ]);

    const bundle = resolveExtensionBundle({
      extensionsDir,
      manifestPath,
      railwayEnvironment: false,
      extensionSlugsEnv: "similarweb,honey",
    });

    expect(bundle.selectedSlugs).toEqual(["honey", "similarweb"]);
    expect(bundle.selectedPaths).toEqual([
      path.join(extensionsDir, "honey"),
      path.join(extensionsDir, "similarweb"),
    ]);
  });

  it("fails fast when a requested slug is not unpacked locally", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "extension-bundle-"));
    const manifestPath = await writeManifest(tempDir);
    const extensionsDir = await writeExtensions(tempDir, ["similarweb"]);

    expect(() =>
      resolveExtensionBundle({
        extensionsDir,
        manifestPath,
        railwayEnvironment: false,
        extensionSlugsEnv: "similarweb,honey",
      }),
    ).toThrow(/honey/i);
  });

  it("produces different bundle hashes for different extension selections", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "extension-bundle-"));
    const manifestPath = await writeManifest(tempDir);
    const extensionsDir = await writeExtensions(tempDir, [
      "honey",
      "similarweb",
      "hola",
    ]);

    const baseline = resolveExtensionBundle({
      extensionsDir,
      manifestPath,
      railwayEnvironment: true,
    });
    const variant = resolveExtensionBundle({
      extensionsDir,
      manifestPath,
      railwayEnvironment: false,
      extensionSlugsEnv: "similarweb,honey",
    });

    expect(baseline.bundleHash).not.toBe(variant.bundleHash);
  });
});
