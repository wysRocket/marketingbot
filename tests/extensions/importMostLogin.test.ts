import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

async function loadImportMostLoginModule(): Promise<any> {
  return import("../../src/extensions/importMostLogin");
}

async function writeVersionedImportRoot(
  tempDir: string,
): Promise<{ importRoot: string; latestVersion: string }> {
  const importRoot = path.join(tempDir, "mostlogin-import");

  const versions = [
    {
      version: "2.0.0",
      entries: [
        {
          slug: "similarweb",
          chromeStoreId: "sw",
          expectedName: "Similarweb",
          pinnedVersion: "6.12.19",
          sha256: "hash-sw-v2",
        },
      ],
    },
    {
      version: "1.0.0",
      entries: [
        {
          slug: "similarweb",
          chromeStoreId: "sw",
          expectedName: "Similarweb",
          pinnedVersion: "6.12.19",
          sha256: "hash-sw-v1",
        },
      ],
    },
    {
      version: "10.0.0",
      entries: [
        {
          slug: "similarweb",
          chromeStoreId: "sw",
          expectedName: "Similarweb",
          pinnedVersion: "6.12.19",
          sha256: "hash-sw-v10",
        },
        {
          slug: "honey",
          chromeStoreId: "hn",
          expectedName: "Honey",
          pinnedVersion: "19.0.3",
          sha256: "hash-hn-v10",
        },
      ],
    },
  ];

  for (const { version, entries } of versions) {
    const versionDir = path.join(importRoot, version);
    const extensionsDir = path.join(versionDir, ".extensions");
    await mkdir(extensionsDir, { recursive: true });
    await writeFile(
      path.join(versionDir, "manifest.json"),
      JSON.stringify({
        version,
        entries,
      }),
      "utf8",
    );

    for (const entry of entries) {
      const extensionDir = path.join(extensionsDir, entry.slug);
      await mkdir(extensionDir, { recursive: true });
      await writeFile(
        path.join(extensionDir, "manifest.json"),
        JSON.stringify(entry),
        "utf8",
      );
    }
  }

  return { importRoot, latestVersion: "10.0.0" };
}

async function writePinnedManifest(tempDir: string): Promise<string> {
  const manifestPath = path.join(tempDir, "manifest.json");
  await writeFile(
    manifestPath,
    JSON.stringify([
      {
        slug: "similarweb",
        chromeStoreId: "sw",
        expectedName: "Similarweb",
        pinnedVersion: "6.12.19",
        sha256: "hash-sw-existing",
      },
      {
        slug: "hola",
        chromeStoreId: "hl",
        expectedName: "Hola",
        pinnedVersion: "1.251.527",
        sha256: "hash-hl-existing",
      },
    ]),
    "utf8",
  );

  return manifestPath;
}

async function writeImportedOutputFixture(tempDir: string): Promise<string> {
  const sourceDir = path.join(tempDir, "imported");
  const extensionsDir = path.join(sourceDir, ".extensions");
  await mkdir(path.join(extensionsDir, "similarweb"), { recursive: true });
  await mkdir(path.join(extensionsDir, "honey"), { recursive: true });

  await writeFile(
    path.join(sourceDir, "manifest.json"),
    JSON.stringify([
      {
        slug: "similarweb",
        chromeStoreId: "sw",
        expectedName: "Similarweb",
        pinnedVersion: "6.12.19",
        sha256: "hash-sw-imported",
      },
      {
        slug: "honey",
        chromeStoreId: "hn",
        expectedName: "Honey",
        pinnedVersion: "19.0.3",
        sha256: "hash-hn-imported",
      },
    ]),
    "utf8",
  );

  await writeFile(
    path.join(extensionsDir, "similarweb", "manifest.json"),
    JSON.stringify({
      name: "Similarweb",
      version: "6.12.19",
    }),
    "utf8",
  );
  await writeFile(
    path.join(extensionsDir, "honey", "manifest.json"),
    JSON.stringify({
      name: "Honey",
      version: "19.0.3",
    }),
    "utf8",
  );

  return sourceDir;
}

describe("importMostLogin", () => {
  it("loads manifest metadata from the highest version dir", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "mostlogin-import-"));
    const { importRoot, latestVersion } = await writeVersionedImportRoot(
      tempDir,
    );

    const { loadManifestMetadata } = (await loadImportMostLoginModule()) as any;
    const metadata = await loadManifestMetadata(importRoot);

    expect(metadata.version).toBe(latestVersion);
    expect(metadata.entries).toHaveLength(2);
  });

  it("produces a stable directory hash", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "mostlogin-import-"));
    const leftRoot = path.join(tempDir, "left");
    const rightRoot = path.join(tempDir, "right");

    for (const root of [leftRoot, rightRoot]) {
      await mkdir(root, { recursive: true });
    }

    await writeFile(path.join(leftRoot, "a.txt"), "alpha", "utf8");
    await mkdir(path.join(leftRoot, "nested"), { recursive: true });
    await writeFile(path.join(leftRoot, "nested", "b.txt"), "bravo", "utf8");

    await mkdir(path.join(rightRoot, "nested"), { recursive: true });
    await writeFile(path.join(rightRoot, "nested", "b.txt"), "bravo", "utf8");
    await writeFile(path.join(rightRoot, "a.txt"), "alpha", "utf8");

    const { computeDirectoryHash } = (await loadImportMostLoginModule()) as any;
    const leftHash = await computeDirectoryHash(leftRoot);
    const rightHash = await computeDirectoryHash(rightRoot);

    expect(leftHash).toBe(rightHash);
  });

  it("copies imported extensions into .extensions and returns manifest entries", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "mostlogin-import-"));
    const sourceDir = await writeImportedOutputFixture(tempDir);
    const outputDir = path.join(tempDir, ".extensions");
    const manifestPath = await writePinnedManifest(tempDir);

    const { importMostLoginExtensions } = (await loadImportMostLoginModule()) as any;
    const result = await importMostLoginExtensions({
      sourceDir,
      outputDir,
      manifestPath,
    });

    expect(
      result.importedManifestEntries.map((entry: any) => entry.slug),
    ).toEqual([
      "similarweb",
      "honey",
    ]);
    expect(
      JSON.parse(await readFile(path.join(outputDir, "similarweb", "manifest.json"), "utf8")),
    ).toMatchObject({
      name: "Similarweb",
      version: "6.12.19",
    });
    expect(
      JSON.parse(await readFile(path.join(outputDir, "honey", "manifest.json"), "utf8")),
    ).toMatchObject({
      name: "Honey",
      version: "19.0.3",
    });
  });

  it("merges imported entries without dropping existing pinned entries", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "mostlogin-import-"));
    const sourceDir = await writeImportedOutputFixture(tempDir);
    const outputDir = path.join(tempDir, ".extensions");
    const manifestPath = await writePinnedManifest(tempDir);

    const { importMostLoginExtensions } = (await loadImportMostLoginModule()) as any;
    const result = await importMostLoginExtensions({
      sourceDir,
      outputDir,
      manifestPath,
    });

    expect(result.mergedManifestEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ slug: "similarweb" }),
        expect.objectContaining({ slug: "honey" }),
        expect.objectContaining({ slug: "hola" }),
      ]),
    );
  });
});
