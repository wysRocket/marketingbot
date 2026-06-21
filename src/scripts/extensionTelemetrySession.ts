import "dotenv/config";
import { chromium } from "patchright";
import * as fsSync from "node:fs";
import path from "node:path";
// Stub: createDashboardServer was removed
function createDashboardServer(_opts: { port: number; maxEvents: number }) {
  return { start: async () => {}, stop: async () => {}, addEvent: (_e?: unknown) => {} };
}
import { createExtensionTelemetryInterceptor, type ExtensionTelemetryEvent } from "../observability/extensionTelemetry";
import { ensureDisplay, getChromeMode } from "../utils/display";

const TARGET_DOMAIN = process.env.TARGET_DOMAIN ?? "guidenza.com";
const DASHBOARD_PORT = parseInt(process.env.DASHBOARD_PORT ?? "3001", 10);

/** Returns comma-separated absolute paths to each extension subdirectory. */
function resolveExtensionPaths(rootDir: string): string[] {
  const abs = path.resolve(process.cwd(), rootDir);
  try {
    return fsSync.readdirSync(abs)
      .map((name) => path.join(abs, name))
      .filter((p) => {
        try {
          return fsSync.statSync(p).isDirectory() &&
            fsSync.existsSync(path.join(p, "manifest.json"));
        } catch { return false; }
      });
  } catch {
    console.warn(`⚠  Extensions directory not found: ${abs}`);
    return [];
  }
}

async function run(): Promise<void> {
  // 1. Start dashboard (also persists events to telemetry/extension-events.jsonl)
  const dashboard = createDashboardServer({ port: DASHBOARD_PORT, maxEvents: 10000 });
  await dashboard.start();

  // 2. Resolve extension paths (comma-sep for --load-extension)
  const extensionsRoot = process.env.EXTENSIONS_DIR ?? ".extensions";
  const extensionPaths = resolveExtensionPaths(extensionsRoot);
  const userDataDir = process.env.USER_DATA_DIR ?? "";

  if (extensionPaths.length === 0) {
    console.warn("⚠  No extensions found — running without extensions (traffic monitoring only)");
  } else {
    console.log(`📦 Loading ${extensionPaths.length} extensions from ${extensionsRoot}`);
  }

  const extensionArgs = extensionPaths.length > 0
    ? [
        `--load-extension=${extensionPaths.join(",")}`,
        `--disable-extensions-except=${extensionPaths.join(",")}`,
      ]
    : ["--disable-extensions"];

  // 3. Ensure display (Xvfb on Linux, macOS native) then launch
  const displayInfo = await ensureDisplay({ verbose: true });
  const { headless, extraArgs } = getChromeMode(displayInfo);

  const browser = await chromium.launchPersistentContext(userDataDir, {
    headless,
    args: [
      ...extensionArgs,
      ...extraArgs,           // --headless=new only when no display available
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
    ],
    viewport: { width: 1280, height: 800 },
  });

  const page = await browser.newPage();

  // 3. Attach extension telemetry interceptor
  const interceptor = createExtensionTelemetryInterceptor(
    (event: ExtensionTelemetryEvent) => {
      dashboard.addEvent(event);
      const short = event.url.length > 80 ? event.url.slice(0, 80) + "…" : event.url;
      console.log(`[${event.matchedDomain}] ${event.method} ${short}`);
      if (event.requestBody) {
        console.log(`  → req body: ${event.requestBody.length} chars`);
      }
      if (event.responseBody) {
        console.log(`  ← res body: ${event.responseBody.length} chars`);
      }
    }
  );
  await interceptor.attach(page as any);

  // 4. Navigate to target
  console.log(`\n🌐 Navigating to https://${TARGET_DOMAIN}`);
  await page.goto(`https://${TARGET_DOMAIN}`, { waitUntil: "domcontentloaded" });

  // 5. Browse for a while to generate extension traffic
  console.log(`📊 Dashboard: http://localhost:${DASHBOARD_PORT}`);
  console.log(`⏳ Browsing for 120s to capture extension telemetry…\n`);

  // Wait and interact
  await page.waitForTimeout(5000);

  // Scroll
  await page.evaluate(() => window.scrollBy(0, 500));
  await page.waitForTimeout(3000);

  // Visit subpages
  const links = await page.$$eval("a[href]", (anchors) =>
    anchors.slice(0, 5).map((a) => (a as HTMLAnchorElement).href).filter((h) => h.startsWith("http"))
  );
  for (const link of links.slice(0, 3)) {
    try {
      await page.goto(link, { waitUntil: "domcontentloaded", timeout: 10000 });
      await page.waitForTimeout(4000);
    } catch {
      // ignore navigation errors
    }
  }

  // Idle to catch delayed extension pings (Mixpanel batches, GrowthBook flag evals)
  await page.waitForTimeout(30000);

  // 6. Summary
  console.log(`\n✅ Session complete. Dashboard still running at http://localhost:${DASHBOARD_PORT}`);
  console.log(`   Press Ctrl+C to stop.\n`);

  // Keep alive until interrupted
  await new Promise<void>((resolve) => {
    process.on("SIGINT", async () => {
      console.log("\n🛑 Shutting down…");
      await interceptor.detach();
      await browser.close();
      await dashboard.stop();
      resolve();
    });
  });
}

run().catch((error) => {
  console.error("Fatal:", error);
  process.exit(1);
});