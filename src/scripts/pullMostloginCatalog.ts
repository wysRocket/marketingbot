import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { loadCatalog } from "../profiles/catalog";

const SNAPSHOT_PATH =
  process.env.CATALOG_SNAPSHOT_PATH ??
  path.join(process.cwd(), ".profile-cache", "mostlogin-catalog.json");

async function pullCatalog(): Promise<void> {
  const poolSize = parseInt(process.env.POOL_SIZE ?? "60", 10);

  console.log("[catalog] Pulling MostLogin profile catalog...");

  const catalog = await loadCatalog({
    requestedSource: "mostlogin",
    poolSize,
    snapshotPath: SNAPSHOT_PATH,
    allowGeneratorFallback: false,
    environment: "production",
  });

  const dir = path.dirname(SNAPSHOT_PATH);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(catalog, null, 2), "utf8");

  console.log(
    `[catalog] Wrote ${catalog.profiles.length} profiles → ${SNAPSHOT_PATH}`,
  );
}

pullCatalog().catch((err: Error) => {
  console.error(`[catalog] Failed: ${err.stack ?? err.message}`);
  process.exit(1);
});
