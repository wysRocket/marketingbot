import { promises as fs } from "node:fs";
import path from "node:path";
import {
  importMostLoginExtensions,
  computeDirectoryHash,
} from "../extensions/importMostLogin";

interface CliArgs {
  sourceDir: string;
  outputDir: string;
  mirrorDir?: string;
  manifestPath: string;
  writeManifest: boolean;
}

function getArgValue(flag: string): string | undefined {
  const args = process.argv.slice(2);
  const exact = args.find((arg) => arg.startsWith(`${flag}=`));
  if (exact) {
    return exact.slice(flag.length + 1);
  }

  const index = args.indexOf(flag);
  if (index >= 0) {
    return args[index + 1];
  }

  return undefined;
}

function hasFlag(flag: string): boolean {
  return process.argv.slice(2).includes(flag);
}

async function mirrorDirectory(sourceDir: string, targetDir: string): Promise<void> {
  if (path.resolve(sourceDir) === path.resolve(targetDir)) {
    return;
  }

  await fs.rm(targetDir, { recursive: true, force: true });
  await fs.mkdir(path.dirname(targetDir), { recursive: true });
  await fs.cp(sourceDir, targetDir, { recursive: true, force: true });
}

function resolveCliArgs(): CliArgs {
  const sourceDir =
    getArgValue("--source-dir") ??
    process.env.MOSTLOGIN_CHROME_EXTENSIONS_DIR;

  if (!sourceDir) {
    throw new Error(
      "MostLogin source directory is required. Provide --source-dir or set MOSTLOGIN_CHROME_EXTENSIONS_DIR.",
    );
  }

  const outputDir =
    getArgValue("--output-dir") ?? path.join(process.cwd(), ".extensions");
  const mirrorDir =
    getArgValue("--mirror-dir") ??
    path.join(process.cwd(), "mostlogin-extensions");
  const manifestPath =
    getArgValue("--manifest-path") ??
    path.join(__dirname, "../extensions/manifest.json");

  return {
    sourceDir: path.resolve(sourceDir),
    outputDir: path.resolve(outputDir),
    mirrorDir: path.resolve(mirrorDir),
    manifestPath: path.resolve(manifestPath),
    writeManifest: hasFlag("--write-manifest"),
  };
}

async function main(): Promise<void> {
  try {
    const args = resolveCliArgs();
    const result = await importMostLoginExtensions(args);

    if (args.writeManifest) {
      await fs.writeFile(
        args.manifestPath,
        `${JSON.stringify(result.mergedManifestEntries, null, 2)}\n`,
        "utf8",
      );
    }

    const importedHash = await computeDirectoryHash(args.outputDir);
    if (args.mirrorDir) {
      await mirrorDirectory(args.outputDir, args.mirrorDir);
    }
    console.log(
      JSON.stringify(
        {
          sourceDir: args.sourceDir,
          outputDir: args.outputDir,
          mirrorDir: args.mirrorDir,
          manifestPath: args.manifestPath,
          writeManifest: args.writeManifest,
          importedVersion: result.importedVersion,
          importedSlugs: result.importedManifestEntries.map((entry) => entry.slug),
          mergedSlugs: result.mergedManifestEntries.map((entry) => entry.slug),
          outputHash: importedHash,
          mirrorHash: args.mirrorDir
            ? await computeDirectoryHash(args.mirrorDir)
            : undefined,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (require.main === module) {
  void main();
}
