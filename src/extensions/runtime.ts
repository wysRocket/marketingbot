import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export interface ExtensionManifestEntry {
  slug: string;
  chromeStoreId: string;
  expectedName: string;
  pinnedVersion: string;
  sha256: string;
}

export interface ResolvedExtensionBundle {
  selectedSlugs: string[];
  selectedPaths: string[];
  bundleHash: string;
}

const DEFAULT_RAILWAY_EXTENSION_SLUGS = ["similarweb"];

function normalizeSlugs(slugs: string[]): string[] {
  return Array.from(
    new Set(slugs.map((slug) => slug.trim()).filter(Boolean)),
  ).sort((left, right) => left.localeCompare(right));
}

export function parseExtensionSlugsEnv(raw?: string): string[] | undefined {
  if (raw === undefined) {
    return undefined;
  }

  return normalizeSlugs(raw.split(","));
}

export function listExtensionDirectories(
  extensionsDir: string,
): Array<{ slug: string; extensionPath: string }> {
  try {
    return fs
      .readdirSync(extensionsDir)
      .map((slug) => ({
        slug,
        extensionPath: path.join(extensionsDir, slug),
      }))
      .filter(({ extensionPath }) => {
        try {
          return fs.statSync(extensionPath).isDirectory();
        } catch {
          return false;
        }
      })
      .sort((left, right) => left.slug.localeCompare(right.slug));
  } catch {
    return [];
  }
}

export function computeExtensionBundleHash(input: {
  selectedSlugs: string[];
  manifestEntries: ExtensionManifestEntry[];
}): string {
  const payload = JSON.stringify({
    selectedSlugs: normalizeSlugs(input.selectedSlugs),
    manifestEntries: [...input.manifestEntries].sort((left, right) =>
      left.slug.localeCompare(right.slug),
    ),
  });

  return `sha256:${createHash("sha256").update(payload).digest("hex")}`;
}

export function resolveExtensionBundle(input: {
  extensionsDir: string;
  manifestPath: string;
  railwayEnvironment: boolean;
  extensionSlugsEnv?: string;
}): ResolvedExtensionBundle {
  const availableExtensions = listExtensionDirectories(input.extensionsDir);
  const availableBySlug = new Map(
    availableExtensions.map((entry) => [entry.slug, entry.extensionPath]),
  );
  const manifest = JSON.parse(
    fs.readFileSync(input.manifestPath, "utf8"),
  ) as ExtensionManifestEntry[];
  const manifestBySlug = new Map(manifest.map((entry) => [entry.slug, entry]));
  const requestedSlugs = parseExtensionSlugsEnv(input.extensionSlugsEnv);
  const selectedSlugs =
    requestedSlugs ??
    (input.railwayEnvironment
      ? DEFAULT_RAILWAY_EXTENSION_SLUGS
      : availableExtensions.map((entry) => entry.slug));

  for (const slug of selectedSlugs) {
    if (!availableBySlug.has(slug)) {
      throw new Error(
        `PATCHRIGHT_EXTENSION_SLUGS references "${slug}", but ${path.join(input.extensionsDir, slug)} is missing`,
      );
    }
    if (!manifestBySlug.has(slug)) {
      throw new Error(
        `Extension slug "${slug}" is present in .extensions but missing from the pinned manifest at ${input.manifestPath}`,
      );
    }
  }

  const manifestEntries = selectedSlugs.map((slug) => manifestBySlug.get(slug)!);

  return {
    selectedSlugs,
    selectedPaths: selectedSlugs.map((slug) => availableBySlug.get(slug)!),
    bundleHash: computeExtensionBundleHash({
      selectedSlugs,
      manifestEntries,
    }),
  };
}
