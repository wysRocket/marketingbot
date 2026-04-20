import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  resolveLocalizedManifestValue,
  type ManifestEntry,
} from "../scripts/pullExtensions";

interface ImportedManifestMetadata {
  version?: string;
  entries: ManifestEntry[];
  entrySources: Array<{
    entry: ManifestEntry;
    sourcePath: string;
  }>;
  manifestPath: string;
  rootDir: string;
}

interface ImportMostLoginInput {
  sourceDir: string;
  outputDir: string;
  manifestPath: string;
}

interface ImportMostLoginResult {
  manifestEntries: ManifestEntry[];
  importedManifestEntries: ManifestEntry[];
  mergedManifestEntries: ManifestEntry[];
  importedVersion?: string;
}

function compareVersionPart(left: string, right: string): number {
  const leftNumeric = /^\d+$/.test(left);
  const rightNumeric = /^\d+$/.test(right);

  if (leftNumeric && rightNumeric) {
    const normalizedLeft = left.replace(/^0+(?!$)/, "");
    const normalizedRight = right.replace(/^0+(?!$)/, "");

    if (normalizedLeft.length !== normalizedRight.length) {
      return normalizedLeft.length - normalizedRight.length;
    }

    return normalizedLeft.localeCompare(normalizedRight);
  }

  if (leftNumeric) {
    return 1;
  }

  if (rightNumeric) {
    return -1;
  }

  return left.localeCompare(right);
}

function compareSemanticishVersions(left: string, right: string): number {
  const leftParts = left.split(/[.+_-]/).filter(Boolean);
  const rightParts = right.split(/[.+_-]/).filter(Boolean);
  const partCount = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < partCount; index += 1) {
    const leftPart = leftParts[index];
    const rightPart = rightParts[index];

    if (leftPart === undefined && rightPart === undefined) {
      return 0;
    }
    if (leftPart === undefined) {
      const remainingRightParts = rightParts.slice(index);
      return remainingRightParts.every((part) => /^\d+$/.test(part)) ? -1 : 1;
    }
    if (rightPart === undefined) {
      const remainingLeftParts = leftParts.slice(index);
      return remainingLeftParts.every((part) => /^\d+$/.test(part)) ? 1 : -1;
    }

    const compared = compareVersionPart(leftPart, rightPart);
    if (compared !== 0) {
      return compared;
    }
  }

  return left.localeCompare(right);
}

function isHiddenFilesystemEntry(name: string): boolean {
  return name.startsWith(".");
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

type LocaleMessages = Record<string, { message?: string }>;

async function readLocaleMessages(
  manifestPath: string,
  defaultLocale: unknown,
): Promise<LocaleMessages | undefined> {
  if (typeof defaultLocale !== "string" || defaultLocale.length === 0) {
    return undefined;
  }

  const localeMessagesPath = path.join(
    path.dirname(manifestPath),
    "_locales",
    defaultLocale,
    "messages.json",
  );

  if (!(await pathExists(localeMessagesPath))) {
    return undefined;
  }

  try {
    return JSON.parse(await fs.readFile(localeMessagesPath, "utf8")) as LocaleMessages;
  } catch {
    return undefined;
  }
}

async function readManifestEntries(manifestPath: string): Promise<ManifestEntry[]> {
  const raw = JSON.parse(await fs.readFile(manifestPath, "utf8")) as
    | ManifestEntry[]
    | { entries?: ManifestEntry[] };

  if (Array.isArray(raw)) {
    return raw;
  }

  if (raw && typeof raw === "object" && Array.isArray(raw.entries)) {
    return raw.entries;
  }

  throw new Error(
    `Invalid MostLogin manifest shape in ${manifestPath}: expected a JSON array or an object with an entries array`,
  );
}

async function readChromiumVersionManifest(
  manifestPath: string,
): Promise<{ name: string; version: string }> {
  const raw = JSON.parse(await fs.readFile(manifestPath, "utf8")) as {
    name?: unknown;
    default_locale?: unknown;
    version?: unknown;
  };

  if (typeof raw?.name !== "string" || typeof raw?.version !== "string") {
    throw new Error(
      `Invalid Chromium extension manifest in ${manifestPath}: expected string name and version fields`,
    );
  }

  const localeMessages = await readLocaleMessages(
    manifestPath,
    raw.default_locale,
  );
  const resolvedName = resolveLocalizedManifestValue(raw.name, localeMessages);

  if (resolvedName === undefined || resolvedName === raw.name) {
    if (typeof raw.name === "string" && /^__MSG_.+__$/.test(raw.name)) {
      throw new Error(
        `Unresolved localized extension name in ${manifestPath}: could not resolve ${raw.name} from _locales/<default_locale>/messages.json`,
      );
    }
  }

  return {
    name: resolvedName ?? raw.name,
    version: raw.version,
  };
}

export async function computeDirectoryHash(dir: string): Promise<string> {
  const hash = createHash("sha256");

  async function visit(currentDir: string): Promise<void> {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      if (isHiddenFilesystemEntry(entry.name)) {
        continue;
      }

      const absolutePath = path.join(currentDir, entry.name);
      const relativePath = path
        .relative(dir, absolutePath)
        .split(path.sep)
        .join("/");

      if (entry.isDirectory()) {
        hash.update(`dir:${relativePath}\n`);
        await visit(absolutePath);
        continue;
      }

      if (entry.isFile()) {
        hash.update(`file:${relativePath}\n`);
        hash.update(await fs.readFile(absolutePath));
      }
    }
  }

  await visit(dir);
  return `sha256:${hash.digest("hex")}`;
}

export async function loadManifestMetadata(
  importRoot: string,
): Promise<ImportedManifestMetadata | undefined> {
  const directManifestPath = path.join(importRoot, "manifest.json");
  const directExtensionsDir = path.join(importRoot, ".extensions");

  if (
    (await pathExists(directManifestPath)) &&
    (await pathExists(directExtensionsDir))
  ) {
    const entries = await readManifestEntries(directManifestPath);
    return {
      entries,
      entrySources: entries.map((entry) => ({
        entry,
        sourcePath: path.join(directExtensionsDir, entry.slug),
      })),
      manifestPath: directManifestPath,
      rootDir: importRoot,
    };
  }

  const children = await fs.readdir(importRoot, { withFileTypes: true });
  const versionDirectories: Array<{ version: string; rootDir: string }> = [];

  for (const child of children) {
    if (!child.isDirectory()) {
      continue;
    }

    if (isHiddenFilesystemEntry(child.name)) {
      continue;
    }

    const candidateRoot = path.join(importRoot, child.name);
    const candidateManifest = path.join(candidateRoot, "manifest.json");
    const candidateExtensionsDir = path.join(candidateRoot, ".extensions");

    if (
      (await pathExists(candidateManifest)) &&
      (await pathExists(candidateExtensionsDir))
    ) {
      versionDirectories.push({
        version: child.name,
        rootDir: candidateRoot,
      });
    }
  }

  if (versionDirectories.length === 0) {
    return undefined;
  }

  versionDirectories.sort((left, right) =>
    compareSemanticishVersions(right.version, left.version),
  );

  const selected = versionDirectories[0];
  const manifestPath = path.join(selected.rootDir, "manifest.json");
  const extensionsDir = path.join(selected.rootDir, ".extensions");
  const entries = await readManifestEntries(manifestPath);

  return {
    version: selected.version,
    entries,
    entrySources: entries.map((entry) => ({
      entry,
      sourcePath: path.join(extensionsDir, entry.slug),
    })),
    manifestPath,
    rootDir: selected.rootDir,
  };
}

async function discoverChromiumRoot(importRoot: string): Promise<
  ImportedManifestMetadata | undefined
> {
  const extensionDirectories = await fs.readdir(importRoot, { withFileTypes: true });
  const importedEntries: Array<{
    entry: ManifestEntry;
    sourcePath: string;
    version: string;
  }> = [];

  for (const extensionDirectory of extensionDirectories) {
    if (!extensionDirectory.isDirectory()) {
      continue;
    }

    if (isHiddenFilesystemEntry(extensionDirectory.name)) {
      continue;
    }

    const extensionRoot = path.join(importRoot, extensionDirectory.name);
    const directManifestPath = path.join(extensionRoot, "manifest.json");

    if (await pathExists(directManifestPath)) {
      const manifest = await readChromiumVersionManifest(directManifestPath);

      importedEntries.push({
        entry: {
          slug: extensionDirectory.name,
          chromeStoreId: extensionDirectory.name,
          expectedName: manifest.name,
          pinnedVersion: manifest.version,
          sha256: await computeDirectoryHash(extensionRoot),
        },
        sourcePath: extensionRoot,
        version: manifest.version,
      });
      continue;
    }

    const versionDirectories = await fs.readdir(extensionRoot, {
      withFileTypes: true,
    });
    const candidates: Array<{ version: string; sourcePath: string }> = [];

    for (const versionDirectory of versionDirectories) {
      if (!versionDirectory.isDirectory()) {
        continue;
      }

      if (isHiddenFilesystemEntry(versionDirectory.name)) {
        continue;
      }

      const sourcePath = path.join(extensionRoot, versionDirectory.name);
      const manifestPath = path.join(sourcePath, "manifest.json");

      if (!(await pathExists(manifestPath))) {
        continue;
      }

      candidates.push({
        version: versionDirectory.name,
        sourcePath,
      });
    }

    if (candidates.length === 0) {
      continue;
    }

    candidates.sort((left, right) =>
      compareSemanticishVersions(right.version, left.version),
    );

    const selected = candidates[0];
    const manifestPath = path.join(selected.sourcePath, "manifest.json");
    const manifest = await readChromiumVersionManifest(manifestPath);

    importedEntries.push({
      entry: {
        slug: extensionDirectory.name,
        chromeStoreId: extensionDirectory.name,
        expectedName: manifest.name,
        pinnedVersion: manifest.version,
        sha256: await computeDirectoryHash(selected.sourcePath),
      },
      sourcePath: selected.sourcePath,
      version: manifest.version,
    });
  }

  if (importedEntries.length === 0) {
    return undefined;
  }

  importedEntries.sort((left, right) => left.entry.slug.localeCompare(right.entry.slug));

  return {
    entries: importedEntries.map(({ entry }) => entry),
    entrySources: importedEntries.map(({ entry, sourcePath }) => ({
      entry,
      sourcePath,
    })),
    manifestPath: path.join(importRoot, "manifest.json"),
    rootDir: importRoot,
  };
}

function mergeManifestEntries(
  existingEntries: ManifestEntry[],
  importedEntries: ManifestEntry[],
): ManifestEntry[] {
  const merged = new Map<string, ManifestEntry>();

  for (const entry of existingEntries) {
    merged.set(entry.slug, entry);
  }

  for (const entry of importedEntries) {
    merged.set(entry.slug, entry);
  }

  return Array.from(merged.values());
}

async function copyImportedExtensions(input: {
  entrySources: Array<{
    entry: ManifestEntry;
    sourcePath: string;
  }>;
  outputDir: string;
}): Promise<void> {
  const outputParent = path.dirname(input.outputDir);
  await fs.mkdir(outputParent, { recursive: true });

  const stagingRoot = await fs.mkdtemp(
    path.join(outputParent, `${path.basename(input.outputDir)}.stage-`),
  );
  const stagedDestinations = new Map<string, string>();
  const appliedDestinations: Array<{
    destinationPath: string;
    backupPath?: string;
  }> = [];

  try {
    for (const { entry, sourcePath } of input.entrySources) {
      if (!(await pathExists(sourcePath))) {
        throw new Error(
          `Imported extension directory is missing for ${entry.slug}: ${sourcePath}`,
        );
      }

      const stagedPath = path.join(stagingRoot, entry.slug);
      await fs.cp(sourcePath, stagedPath, {
        recursive: true,
        filter: (currentSourcePath) =>
          !isHiddenFilesystemEntry(path.basename(currentSourcePath)),
      });
      stagedDestinations.set(entry.slug, stagedPath);
    }

    await fs.mkdir(input.outputDir, { recursive: true });

    for (const { entry } of input.entrySources) {
      const destinationPath = path.join(input.outputDir, entry.slug);
      const stagedPath = stagedDestinations.get(entry.slug);

      if (!stagedPath) {
        throw new Error(`Missing staged import for ${entry.slug}`);
      }

      let backupPath: string | undefined;
      if (await pathExists(destinationPath)) {
        backupPath = path.join(
          stagingRoot,
          `${entry.slug}.backup-${randomUUID()}`,
        );
        await fs.rename(destinationPath, backupPath);
      }

      try {
        await fs.rename(stagedPath, destinationPath);
        appliedDestinations.push({ destinationPath, backupPath });
      } catch (error) {
        if (backupPath) {
          await fs.rename(backupPath, destinationPath).catch(() => undefined);
        } else {
          await fs.rm(destinationPath, { recursive: true, force: true }).catch(
            () => undefined,
          );
        }
        throw error;
      }
    }
  } catch (error) {
    const rollbackErrors: string[] = [];

    for (const { destinationPath, backupPath } of appliedDestinations.reverse()) {
      await fs.rm(destinationPath, { recursive: true, force: true }).catch(
        (rollbackError) => {
          rollbackErrors.push(
            `failed to remove ${destinationPath}: ${String(rollbackError)}`,
          );
        },
      );
      if (backupPath) {
        await fs.rename(backupPath, destinationPath).catch((rollbackError) => {
          rollbackErrors.push(
            `failed to restore ${destinationPath} from ${backupPath}: ${String(rollbackError)}`,
          );
        });
      }
    }

    if (rollbackErrors.length > 0) {
      throw new Error(
        `Import failed and rollback was incomplete: ${String(error)} | ${rollbackErrors.join(" | ")}`,
      );
    }

    throw error;
  } finally {
    await fs.rm(stagingRoot, { recursive: true, force: true }).catch(
      () => undefined,
    );
  }
}

export async function importMostLoginExtensions(
  input: ImportMostLoginInput,
): Promise<ImportMostLoginResult> {
  const metadata =
    (await loadManifestMetadata(input.sourceDir)) ??
    (await discoverChromiumRoot(input.sourceDir));

  if (!metadata) {
    throw new Error(
      `No importable MostLogin or Chromium extension tree found under ${input.sourceDir}`,
    );
  }

  const existingEntries = await readManifestEntries(input.manifestPath);
  const mergedManifestEntries = mergeManifestEntries(
    existingEntries,
    metadata.entries,
  );

  await copyImportedExtensions({
    entrySources: metadata.entrySources,
    outputDir: input.outputDir,
  });

  return {
    manifestEntries: metadata.entries,
    importedManifestEntries: metadata.entries,
    mergedManifestEntries,
    importedVersion: metadata.version,
  };
}
