import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

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
  if (
    expected.pinnedVersion !== "PENDING" &&
    expected.pinnedVersion !== actual.version
  ) {
    throw new Error(
      `Extension version mismatch for ${expected.slug}: expected ${expected.pinnedVersion}, got ${actual.version}`,
    );
  }
  if (expected.sha256 !== "PENDING" && expected.sha256 !== actual.sha256) {
    throw new Error(`Extension hash mismatch for ${expected.slug}`);
  }
}

export function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

type LocaleMessages = Record<string, { message?: string }>;

export function resolveLocalizedManifestValue(
  value: unknown,
  localeMessages?: LocaleMessages,
): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const match = value.match(/^__MSG_(.+)__$/);
  if (!match) {
    return value;
  }

  const key = match[1];
  return localeMessages?.[key]?.message ?? value;
}

function findZipOffset(buffer: Buffer): number {
  return buffer.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
}

export async function downloadCrx(entry: ManifestEntry): Promise<Buffer> {
  const url = new URL("https://clients2.google.com/service/update2/crx");
  url.searchParams.set("response", "redirect");
  url.searchParams.set("prodversion", "131.0.6778.0");
  // Google returns HTTP 204 without this hint instead of redirecting to a CRX blob.
  url.searchParams.set("acceptformat", "crx2,crx3");
  url.searchParams.set(
    "x",
    `id=${entry.chromeStoreId}&installsource=ondemand&uc`,
  );

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(
      `Failed to download ${entry.slug}: ${response.status} ${response.statusText}`,
    );
  }

  return Buffer.from(await response.arrayBuffer());
}

export async function inspectCrx(buffer: Buffer): Promise<ActualEntry> {
  const zipOffset = findZipOffset(buffer);
  if (zipOffset < 0) {
    throw new Error("CRX payload does not contain a ZIP archive");
  }

  const tempDir = await fs.mkdtemp(path.join(process.cwd(), ".tmp-crx-"));
  const zipPath = path.join(tempDir, "extension.zip");
  const unpackDir = path.join(tempDir, "unpacked");
  await fs.mkdir(unpackDir, { recursive: true });
  await fs.writeFile(zipPath, buffer.subarray(zipOffset));
  await execFileAsync("unzip", ["-oq", zipPath, "-d", unpackDir]);
  const manifestRaw = await fs.readFile(
    path.join(unpackDir, "manifest.json"),
    "utf8",
  );
  const manifest = JSON.parse(manifestRaw);
  const localeMessagesPath = manifest.default_locale
    ? path.join(unpackDir, "_locales", manifest.default_locale, "messages.json")
    : undefined;
  const localeMessages: LocaleMessages | undefined = localeMessagesPath
    ? JSON.parse(await fs.readFile(localeMessagesPath, "utf8"))
    : undefined;
  await fs.rm(tempDir, { recursive: true, force: true });

  return {
    name:
      resolveLocalizedManifestValue(manifest.name, localeMessages) ??
      manifest.name,
    version: manifest.version,
    sha256: sha256(buffer),
  };
}

export async function unpackCrx(
  buffer: Buffer,
  destination: string,
): Promise<void> {
  const zipOffset = findZipOffset(buffer);
  if (zipOffset < 0) {
    throw new Error("CRX payload does not contain a ZIP archive");
  }

  const tempDir = await fs.mkdtemp(path.join(process.cwd(), ".tmp-crx-"));
  const zipPath = path.join(tempDir, "extension.zip");
  await fs.mkdir(destination, { recursive: true });
  await fs.writeFile(zipPath, buffer.subarray(zipOffset));
  await execFileAsync("unzip", ["-oq", zipPath, "-d", destination]);
  await fs.rm(tempDir, { recursive: true, force: true });
}

export async function materializeExtensions(input: {
  manifestPath: string;
  outputDir: string;
  downloadCrx?: (entry: ManifestEntry) => Promise<Buffer>;
  inspectCrx?: (buffer: Buffer, entry: ManifestEntry) => Promise<ActualEntry>;
  unpackCrx?: (buffer: Buffer, destination: string) => Promise<void>;
}): Promise<void> {
  const manifest: ManifestEntry[] = JSON.parse(
    await fs.readFile(input.manifestPath, "utf8"),
  );

  await fs.mkdir(input.outputDir, { recursive: true });

  for (const entry of manifest) {
    const crxBuffer = await (input.downloadCrx ?? downloadCrx)(entry);
    const actual = await (input.inspectCrx ?? ((buffer) => inspectCrx(buffer)))(
      crxBuffer,
      entry,
    );
    validateManifestEntry(entry, actual);
    const destination = path.join(input.outputDir, entry.slug);
    await fs.rm(destination, { recursive: true, force: true });
    await fs.mkdir(destination, { recursive: true });
    await (input.unpackCrx ?? unpackCrx)(crxBuffer, destination);
  }
}

async function main(): Promise<void> {
  const manifestPath = path.join(__dirname, "../extensions/manifest.json");
  const outputDir = path.join(process.cwd(), ".extensions");

  await materializeExtensions({
    manifestPath,
    outputDir,
  });

  console.log(`Extensions materialized into ${outputDir}`);
}

if (require.main === module) {
  void main();
}
