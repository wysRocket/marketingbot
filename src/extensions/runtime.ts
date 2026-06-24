// Cache-bust: force Docker layer invalidation
import { createHash } from "node:crypto";
import crypto from "node:crypto";
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

const DEFAULT_RAILWAY_EXTENSION_SLUGS = [
  "similarweb",
  "wappalyzer",
  "builtwith",
  "mozbar",
  "ahrefs",
  "ghostery",
  "honey",
  "keywords-everywhere",
];

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

  // ── Random subset selection ──────────────────────────────────────────
  // EXT_MIN_COUNT / EXT_MAX_COUNT: randomly pick this many extensions
  // from the available pool on each startup. "similarweb" is always kept.
  // This ensures each instance / restart has a different extension count,
  // making profiles look more natural to analytics platforms.
  const extMinRaw = process.env.EXT_MIN_COUNT;
  const extMaxRaw = process.env.EXT_MAX_COUNT;
  let slugsToLoad: string[];

  if (extMinRaw && extMaxRaw && !requestedSlugs) {
    const minCount = Math.max(1, parseInt(extMinRaw, 10));
    const maxCount = Math.min(
      availableExtensions.length,
      Math.max(minCount, parseInt(extMaxRaw, 10)),
    );
    const targetCount =
      minCount === maxCount
        ? minCount
        : minCount + crypto.randomInt(maxCount - minCount + 1);

    // Always include similarweb (essential for the task)
    const mustInclude = ["similarweb"];
    const candidates = availableExtensions
      .map((e) => e.slug)
      .filter((s) => !mustInclude.includes(s));

    // Fisher-Yates shuffle and pick
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = crypto.randomInt(i + 1);
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    const selected = [
      ...mustInclude,
      ...candidates.slice(0, Math.max(0, targetCount - mustInclude.length)),
    ];

    slugsToLoad = normalizeSlugs(selected);
    console.log(
      `[extensions] random subset: ${slugsToLoad.length}/${availableExtensions.length} extensions loaded (min=${minCount}, max=${maxCount}, target=${targetCount})`,
    );
    console.log(`[extensions] selected: ${slugsToLoad.join(", ")}`);
  } else {
    slugsToLoad = requestedSlugs ?? availableExtensions.map((e) => e.slug);
  }

  const selectedSlugs: string[] = [];
  for (const slug of slugsToLoad) {
    if (!availableBySlug.has(slug)) {
      if (input.railwayEnvironment) {
        console.warn(`[extensions] skipping "${slug}" — not found in ${input.extensionsDir}`);
        continue;
      }
      throw new Error(
        `PATCHRIGHT_EXTENSION_SLUGS references "${slug}", but ${path.join(input.extensionsDir, slug)} is missing`,
      );
    }
    if (!manifestBySlug.has(slug)) {
      if (input.railwayEnvironment) {
        console.warn(`[extensions] skipping "${slug}" — not in manifest`);
        continue;
      }
      throw new Error(
        `Extension slug "${slug}" is present in .extensions but missing from the pinned manifest at ${input.manifestPath}`,
      );
    }
    selectedSlugs.push(slug);
  }

  const manifestEntries = selectedSlugs
    .map((slug) => manifestBySlug.get(slug))
    .filter(Boolean) as ExtensionManifestEntry[];

  return {
    selectedSlugs,
    selectedPaths: selectedSlugs.map((slug) => availableBySlug.get(slug)!),
    bundleHash: computeExtensionBundleHash({
      selectedSlugs,
      manifestEntries,
    }),
  };
}
