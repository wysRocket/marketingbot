import { promises as fs } from "node:fs";
import path from "node:path";

export function isSnapshotFresh(input: {
  generatedAt: string;
  maxAgeHours: number;
  now?: Date;
}): boolean {
  const now = input.now ?? new Date();
  const ageMs = now.getTime() - new Date(input.generatedAt).getTime();
  return ageMs <= input.maxAgeHours * 60 * 60 * 1000;
}

export async function writeCatalogSnapshot(
  filePath: string,
  snapshot: unknown,
): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(snapshot, null, 2), "utf8");
}

export async function readCatalogSnapshot(
  filePath: string,
): Promise<{
  catalog: { source: string; profiles: unknown[] };
  generatedAt: string;
} | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
