# MostLogin Extension Import And Railway Canary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import the exact extension directories currently installed in a local MostLogin profile into Patchright’s `.extensions` bundle, register them in the pinned manifest, and prepare a truthful Railway canary that runs the full imported bundle at `CONCURRENCY=10`.

**Architecture:** Add a manual-but-deterministic import lane that copies unpacked extension directories from a user-specified MostLogin Chromium profile path into `.extensions`, reads each extension manifest to derive ID, name, and version, computes a stable directory hash, and merges those entries into `src/extensions/manifest.json`. Keep Patchright’s existing allowlist runtime and Railway concurrency model intact; the new work only expands the available local extension bundle and documents the canary env contract.

**Tech Stack:** TypeScript, Node.js filesystem APIs, Vitest, Patchright, Playwright, Railway env configuration

---

## File Structure

- Create: `src/extensions/importMostLogin.ts`
  Purpose: Read unpacked extension directories from a MostLogin Chromium profile, derive manifest metadata, compute stable directory hashes, and copy them into `.extensions/<slug-or-id>/`.
- Create: `src/scripts/importMostLoginExtensions.ts`
  Purpose: CLI entry point for importing live MostLogin extensions into `.extensions` and merging entries into `src/extensions/manifest.json`.
- Create: `tests/extensions/importMostLogin.test.ts`
  Purpose: Verify import metadata extraction, deterministic directory hashing, and manifest merge behavior.
- Modify: `tests/extensions/runtime.test.ts`
  Purpose: Verify Railway explicitly loads a full imported bundle when `PATCHRIGHT_EXTENSION_SLUGS` is set.
- Modify: `package.json`
  Purpose: Add an import script for the new MostLogin extension sync lane.
- Create: `docs/mostlogin-extension-import.md`
  Purpose: Operator runbook for importing extensions and running the Railway concurrency-10 canary.
- Modify: `src/extensions/manifest.json`
  Purpose: Store imported extension entries alongside the existing pinned bundle.

## Task 1: Add failing tests for MostLogin extension import

**Files:**
- Create: `tests/extensions/importMostLogin.test.ts`
- Modify: `tests/extensions/runtime.test.ts`
- Test: `tests/extensions/importMostLogin.test.ts`
- Test: `tests/extensions/runtime.test.ts`

- [ ] **Step 1: Write the failing import tests**

Create `tests/extensions/importMostLogin.test.ts`:

```ts
import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  computeDirectoryHash,
  importMostLoginExtensions,
  loadExtensionManifest,
  mergeManifestEntries,
} from "../../src/extensions/importMostLogin";

async function writeExtension(
  root: string,
  extensionId: string,
  version: string,
  name: string,
): Promise<string> {
  const versionDir = path.join(root, extensionId, version);
  await mkdir(versionDir, { recursive: true });
  await writeFile(
    path.join(versionDir, "manifest.json"),
    JSON.stringify({
      manifest_version: 3,
      name,
      version,
      permissions: ["storage"],
    }),
    "utf8",
  );
  await writeFile(path.join(versionDir, "background.js"), "console.log('ok');");
  return versionDir;
}

describe("importMostLoginExtensions", () => {
  it("loads manifest metadata from the highest version directory", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "ml-import-"));
    const sourceDir = path.join(tempDir, "Extensions");
    await writeExtension(sourceDir, "ext123", "1.0.0", "Example Extension");
    await writeExtension(sourceDir, "ext123", "2.0.0", "Example Extension");

    const result = await loadExtensionManifest(sourceDir, "ext123");

    expect(result.extensionId).toBe("ext123");
    expect(result.version).toBe("2.0.0");
    expect(result.expectedName).toBe("Example Extension");
  });

  it("produces a stable hash for an unpacked directory", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "ml-import-"));
    const sourceDir = path.join(tempDir, "Extensions");
    const versionDir = await writeExtension(
      sourceDir,
      "ext123",
      "2.0.0",
      "Example Extension",
    );

    const left = await computeDirectoryHash(versionDir);
    const right = await computeDirectoryHash(versionDir);

    expect(left).toBe(right);
    expect(left).toMatch(/^[a-f0-9]{64}$/);
  });

  it("copies imported extensions into .extensions and returns manifest entries", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "ml-import-"));
    const sourceDir = path.join(tempDir, "Extensions");
    const outputDir = path.join(tempDir, ".extensions");
    await writeExtension(sourceDir, "ext123", "2.0.0", "Example Extension");

    const result = await importMostLoginExtensions({
      sourceDir,
      outputDir,
    });

    expect(result.imported).toHaveLength(1);
    expect(result.imported[0]).toMatchObject({
      slug: "ext123",
      chromeStoreId: "ext123",
      expectedName: "Example Extension",
      pinnedVersion: "2.0.0",
    });

    const copiedManifest = JSON.parse(
      await readFile(
        path.join(outputDir, "ext123", "manifest.json"),
        "utf8",
      ),
    );

    expect(copiedManifest.version).toBe("2.0.0");
  });

  it("merges imported entries without dropping existing pinned entries", () => {
    const merged = mergeManifestEntries(
      [
        {
          slug: "similarweb",
          chromeStoreId: "hoklmmgfnpapgjgcpechhaamimifchmp",
          expectedName: "Similarweb",
          pinnedVersion: "6.12.19",
          sha256: "hash-sw",
        },
      ],
      [
        {
          slug: "ext123",
          chromeStoreId: "ext123",
          expectedName: "Example Extension",
          pinnedVersion: "2.0.0",
          sha256: "hash-ext",
        },
      ],
    );

    expect(merged.map((entry) => entry.slug)).toEqual([
      "ext123",
      "similarweb",
    ]);
  });
});
```

Update `tests/extensions/runtime.test.ts` with one new test:

```ts
  it("lets Railway load a full imported bundle when explicitly requested", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "extension-bundle-"));
    const manifestPath = await writeManifest(tempDir);
    const extensionsDir = await writeExtensions(tempDir, [
      "similarweb",
      "hola",
      "honey",
    ]);

    const bundle = resolveExtensionBundle({
      extensionsDir,
      manifestPath,
      railwayEnvironment: true,
      extensionSlugsEnv: "similarweb,hola,honey",
    });

    expect(bundle.selectedSlugs).toEqual(["hola", "honey", "similarweb"]);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npx vitest run tests/extensions/importMostLogin.test.ts tests/extensions/runtime.test.ts
```

Expected:

```text
FAIL  tests/extensions/importMostLogin.test.ts
Error: Failed to resolve import "../../src/extensions/importMostLogin"
```

- [ ] **Step 3: Commit the failing tests**

```bash
git add tests/extensions/importMostLogin.test.ts tests/extensions/runtime.test.ts
git commit -m "test: cover MostLogin extension import flow"
```

## Task 2: Implement manual MostLogin extension import and manifest merge

**Files:**
- Create: `src/extensions/importMostLogin.ts`
- Create: `src/scripts/importMostLoginExtensions.ts`
- Modify: `package.json`
- Modify: `src/extensions/manifest.json`
- Test: `tests/extensions/importMostLogin.test.ts`

- [ ] **Step 1: Write minimal import helpers**

Create `src/extensions/importMostLogin.ts`:

```ts
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { ExtensionManifestEntry } from "./runtime";

export interface ImportedExtension extends ExtensionManifestEntry {
  sourcePath: string;
}

async function listVersionDirs(extensionRoot: string): Promise<string[]> {
  const entries = await fs.readdir(extensionRoot, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) =>
      right.localeCompare(left, undefined, { numeric: true }),
    );
}

export async function loadExtensionManifest(
  sourceDir: string,
  extensionId: string,
): Promise<ImportedExtension> {
  const extensionRoot = path.join(sourceDir, extensionId);
  const versions = await listVersionDirs(extensionRoot);
  if (versions.length === 0) {
    throw new Error(`No version directories found for ${extensionId}`);
  }

  const versionDir = path.join(extensionRoot, versions[0]);
  const manifest = JSON.parse(
    await fs.readFile(path.join(versionDir, "manifest.json"), "utf8"),
  ) as { name: string; version: string };

  return {
    slug: extensionId,
    chromeStoreId: extensionId,
    expectedName: manifest.name,
    pinnedVersion: manifest.version,
    sha256: await computeDirectoryHash(versionDir),
    sourcePath: versionDir,
  };
}

export async function computeDirectoryHash(dir: string): Promise<string> {
  const hash = createHash("sha256");

  async function walk(current: string, relative = ""): Promise<void> {
    const entries = await fs.readdir(current, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      const nextPath = path.join(current, entry.name);
      const nextRelative = path.join(relative, entry.name);
      hash.update(nextRelative);

      if (entry.isDirectory()) {
        await walk(nextPath, nextRelative);
      } else if (entry.isFile()) {
        hash.update(await fs.readFile(nextPath));
      }
    }
  }

  await walk(dir);
  return hash.digest("hex");
}

async function copyDirectory(source: string, destination: string): Promise<void> {
  await fs.rm(destination, { recursive: true, force: true });
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.cp(source, destination, { recursive: true });
}

export async function importMostLoginExtensions(input: {
  sourceDir: string;
  outputDir: string;
}): Promise<{ imported: ImportedExtension[] }> {
  const entries = await fs.readdir(input.sourceDir, { withFileTypes: true });
  const extensionIds = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  const imported: ImportedExtension[] = [];

  for (const extensionId of extensionIds) {
    const manifestEntry = await loadExtensionManifest(input.sourceDir, extensionId);
    await copyDirectory(
      manifestEntry.sourcePath,
      path.join(input.outputDir, manifestEntry.slug),
    );
    imported.push(manifestEntry);
  }

  return { imported };
}

export function mergeManifestEntries(
  existing: ExtensionManifestEntry[],
  imported: ExtensionManifestEntry[],
): ExtensionManifestEntry[] {
  const bySlug = new Map(existing.map((entry) => [entry.slug, entry]));
  for (const entry of imported) {
    bySlug.set(entry.slug, entry);
  }

  return [...bySlug.values()].sort((left, right) =>
    left.slug.localeCompare(right.slug),
  );
}
```

- [ ] **Step 2: Add the CLI script**

Create `src/scripts/importMostLoginExtensions.ts`:

```ts
import "dotenv/config";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  importMostLoginExtensions,
  mergeManifestEntries,
} from "../extensions/importMostLogin";
import type { ExtensionManifestEntry } from "../extensions/runtime";

async function main(): Promise<void> {
  const sourceDir =
    process.env.MOSTLOGIN_CHROME_EXTENSIONS_DIR ??
    process.argv[2];

  if (!sourceDir) {
    throw new Error(
      "Set MOSTLOGIN_CHROME_EXTENSIONS_DIR or pass the Chromium Extensions path as argv[2]",
    );
  }

  const outputDir = path.join(process.cwd(), ".extensions");
  const manifestPath = path.join(
    process.cwd(),
    "src",
    "extensions",
    "manifest.json",
  );

  const existing = JSON.parse(
    await fs.readFile(manifestPath, "utf8"),
  ) as ExtensionManifestEntry[];

  const { imported } = await importMostLoginExtensions({
    sourceDir,
    outputDir,
  });

  const merged = mergeManifestEntries(existing, imported);
  await fs.writeFile(manifestPath, JSON.stringify(merged, null, 2) + "\n", "utf8");

  console.log(
    `Imported ${imported.length} MostLogin extension(s) from ${sourceDir} into ${outputDir}`,
  );
}

void main().catch((error) => {
  console.error((error as Error).message);
  process.exitCode = 1;
});
```

Update `package.json`:

```json
{
  "scripts": {
    "import:mostlogin:extensions": "ts-node src/scripts/importMostLoginExtensions.ts"
  }
}
```

- [ ] **Step 3: Run tests to verify they pass**

Run:

```bash
npx vitest run tests/extensions/importMostLogin.test.ts tests/extensions/runtime.test.ts
```

Expected:

```text
✓ tests/extensions/importMostLogin.test.ts
✓ tests/extensions/runtime.test.ts
```

- [ ] **Step 4: Smoke the import script against the live MostLogin Chromium Extensions directory**

Run:

```bash
MOSTLOGIN_CHROME_EXTENSIONS_DIR="/absolute/path/to/MostLogin/Profile/Default/Extensions" \
npm run import:mostlogin:extensions
```

Expected:

```text
Imported N MostLogin extension(s) from /absolute/path/.../Extensions into /Users/wysmyfree/Projects/marketingbot/.extensions
```

Then verify:

```bash
ls -1 .extensions
sed -n '1,260p' src/extensions/manifest.json
```

Expected:

```text
.extensions now includes the live MostLogin extension IDs
src/extensions/manifest.json contains matching entries for those IDs
```

- [ ] **Step 5: Commit the implementation**

```bash
git add src/extensions/importMostLogin.ts src/scripts/importMostLoginExtensions.ts package.json src/extensions/manifest.json
git commit -m "feat: import live MostLogin extensions into Patchright bundle"
```

## Task 3: Prove Patchright can load the imported full bundle locally

**Files:**
- Modify: `docs/mostlogin-extension-import.md`
- Test: local `npm run build`
- Test: local `npm run start:patchright`

- [ ] **Step 1: Write the operator runbook**

Create `docs/mostlogin-extension-import.md`:

```md
# MostLogin Extension Import

## Import from the local MostLogin profile

1. Find the Chromium `Extensions` directory used by the live MostLogin profile.
2. Run:

```bash
MOSTLOGIN_CHROME_EXTENSIONS_DIR="/absolute/path/to/Extensions" \
npm run import:mostlogin:extensions
```

3. Build the project:

```bash
npm run build
```

4. Run a local Patchright smoke against the full imported bundle:

```bash
PROFILE_SOURCE=mostlogin \
PATCHRIGHT_EXTENSION_SLUGS="comma,separated,extension,ids" \
CONCURRENCY=1 \
MIN_CONCURRENCY=1 \
POOL_SIZE=1 \
TOTAL_ROUNDS=1 \
npm run start:patchright
```
```

- [ ] **Step 2: Verify the project still builds**

Run:

```bash
npm run build
```

Expected:

```text
tsc exits 0
```

- [ ] **Step 3: Run a local full-bundle smoke**

Run:

```bash
PROFILE_SOURCE=mostlogin \
PATCHRIGHT_EXTENSION_SLUGS="comma,separated,extension,ids" \
CONCURRENCY=1 \
MIN_CONCURRENCY=1 \
POOL_SIZE=1 \
TOTAL_ROUNDS=1 \
ROUND_TIMEOUT_MS=300000 \
SESSION_TIMEOUT_MS=180000 \
npm run start:patchright
```

Expected:

```text
[config] extensions selected: all requested imported slugs
--- Round 1/1 ...
session completes or fails with a concrete extension/proxy error, not a missing-slug error
```

- [ ] **Step 4: Commit the runbook**

```bash
git add docs/mostlogin-extension-import.md
git commit -m "docs: add MostLogin extension import runbook"
```

## Task 4: Prepare the Railway concurrency-10 canary

**Files:**
- Modify: `docs/mostlogin-extension-import.md`
- Test: local env sanity only

- [ ] **Step 1: Extend the runbook with the canary env contract**

Append this section to `docs/mostlogin-extension-import.md`:

```md
## Railway canary: full imported bundle at concurrency 10

Use one Railway worker first, not 10 replicas.

Required env:

```bash
PROFILE_SOURCE=mostlogin
RAILWAY_ENVIRONMENT=1
PATCHRIGHT_EXTENSION_SLUGS="comma,separated,extension,ids"
CONCURRENCY=10
MIN_CONCURRENCY=10
POOL_SIZE=20
TOTAL_ROUNDS=1000
ROUND_TIMEOUT_MS=600000
SESSION_TIMEOUT_MS=300000
SESSION_LAUNCH_STAGGER_MS=3000
```

Notes:

- Keep `POOL_SIZE` above `CONCURRENCY` so sessions rotate identities.
- Do not scale to 10 Railway replicas until the single-worker concurrency-10 canary is stable.
- If later scaling to replicas, set `REPLICA_SHARD_COUNT` and a unique `REPLICA_SHARD_INDEX` per replica.
```

- [ ] **Step 2: Validate the env list against the current runner contract**

Run:

```bash
node -e 'console.log([
  "PROFILE_SOURCE",
  "RAILWAY_ENVIRONMENT",
  "PATCHRIGHT_EXTENSION_SLUGS",
  "CONCURRENCY",
  "MIN_CONCURRENCY",
  "POOL_SIZE",
  "TOTAL_ROUNDS",
  "ROUND_TIMEOUT_MS",
  "SESSION_TIMEOUT_MS",
  "SESSION_LAUNCH_STAGGER_MS"
].join("\\n"))'
```

Expected:

```text
The runbook env names exactly match the envs consumed in src/index.patchright.ts
```

- [ ] **Step 3: Commit the canary documentation**

```bash
git add docs/mostlogin-extension-import.md
git commit -m "docs: add Railway concurrency-10 canary contract"
```

## Self-Review

- Spec coverage: this plan covers the fast path the user asked for now, not the broader capture-analysis lane from the separate spec.
- Placeholder scan: the only intentionally operator-supplied value is the real `MOSTLOGIN_CHROME_EXTENSIONS_DIR`, because the repo does not yet know the MostLogin on-disk layout reliably.
- Type consistency: imported entries reuse the existing `ExtensionManifestEntry` shape so runtime resolution keeps working without a parallel manifest format.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-19-mostlogin-extension-import-railway-canary.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
