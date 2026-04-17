import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

export interface ManifestEntry {
  slug: string;
  chromeStoreId: string;
  expectedName: string;
  pinnedVersion: string;
  sha256: string;
}

export interface ActualEntry {
  name: string;
  version: string;
  sha256: string;
}

export function validateManifestEntry(
  expected: ManifestEntry,
  actual: ActualEntry,
): void {
  if (expected.expectedName !== actual.name) {
    throw new Error(
      `Extension name mismatch for ${expected.slug}: expected "${expected.expectedName}", got "${actual.name}"`,
    );
  }
  if (expected.pinnedVersion !== "PENDING" && expected.pinnedVersion !== actual.version) {
    throw new Error(
      `Extension version mismatch for ${expected.slug}: expected ${expected.pinnedVersion}, got ${actual.version}`,
    );
  }
  if (expected.sha256 !== "PENDING" && expected.sha256 !== actual.sha256) {
    throw new Error(
      `Extension hash mismatch for ${expected.slug}`,
    );
  }
}

export function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

async function main(): Promise<void> {
  const manifestPath = path.join(__dirname, "../extensions/manifest.json");
  const manifest: ManifestEntry[] = JSON.parse(
    await fs.readFile(manifestPath, "utf8"),
  );

  console.log("Extension manifest loaded:");
  for (const entry of manifest) {
    console.log(`  ${entry.slug}: ${entry.expectedName} (${entry.pinnedVersion})`);
  }

  console.log("\nNote: Run with --fetch to download and verify extensions.");
}

if (require.main === module) {
  void main();
}
