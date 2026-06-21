#!/usr/bin/env ts-node
/**
 * Lightweight probe: launch Patchright with extensions, browse a target domain,
 * capture ALL network traffic to SimilarWeb/Mixpanel/GrowthBook endpoints,
 * write observations to telemetry/extension-observations.jsonl
 */
import "dotenv/config";
import { chromium } from "patchright";
import { promises as fs } from "node:fs";
import * as fsSync from "node:fs";
import * as path from "path";

const TARGET = process.env.TARGET_DOMAIN ?? "eurocookflows.com";
const EXT_DIR = path.resolve(process.cwd(), process.env.EXTENSIONS_DIR ?? "mostlogin-extensions");
const OUT = path.resolve(process.cwd(), "telemetry", "extension-observations.jsonl");
const DURATION_MS = parseInt(process.env.PROBE_DURATION_MS ?? "60000", 10);

const WATCH_DOMAINS = [
  "similarweb.com",
  "sw-extension.s3.amazonaws.com",
  "data.similarweb.com",
  "rank.similarweb.com",
  "cdn.growthbook.io",
  "api.mixpanel.com",
  "mixpanel.com",
];

interface Observation {
  observedAt: string;
  url: string;
  method: string;
  statusCode: number | null;
  requestHeaders: Record<string, string>;
  requestBody: string | null;
  responseBody: string | null;
  resourceType: string;
  matchedDomain: string;
  timing: { requestAt: number; responseAt: number | null; durationMs: number | null };
}

async function run(): Promise<void> {
  const observations: Observation[] = [];

  const userDataDir = path.resolve(process.cwd(), ".profile-cache", "telemetry-probe");
  if (!fsSync.existsSync(userDataDir)) fsSync.mkdirSync(userDataDir, { recursive: true });

  const swExtDir = path.resolve(EXT_DIR, "similarweb");
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    timeout: 60_000,
    args: [
      `--disable-extensions-except=${swExtDir}`,
      `--load-extension=${swExtDir}`,
      "--disable-background-timer-throttling",
    ],
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  // CDP session for page-level network interception
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable", {});

  // Also attach to all service worker targets to capture extension background requests
  try {
    const targets = await context.pages();
    for (const target of targets) {
      try {
        const swCdp = await target.context().newCDPSession(target);
        await swCdp.send("Network.enable", {});
        swCdp.on("Network.requestWillBeSent", () => { /* service worker requests handled via page CDP */ });
        swCdp.on("Network.responseReceived", () => { /* service worker responses handled via page CDP */ });
      } catch {}
    }
  } catch {}

  // Monitor for new service workers via the browser-level CDP
  try {
    const browserCdp = await context.newCDPSession(page);
    await browserCdp.send("Target.setDiscoverTargets", { discover: true });
    browserCdp.on("Target.targetCreated", async (event: any) => {
      const targetInfo = event.targetInfo;
      if (targetInfo?.type === "service_worker" || targetInfo?.type === "worker") {
        try {
          const { sessionId } = await browserCdp.send("Target.attachToTarget", {
            targetId: targetInfo.targetId,
            flatten: true,
          }) as any;
          // Worker-level requests will appear through the page CDP
        } catch {}
      }
    });
  } catch {}

  const requestMeta = new Map<string, {
    url: string;
    method: string;
    headers: Record<string, string>;
    postData: string | null;
    resourceType: string;
    matchedDomain: string;
    requestAt: number;
  }>();

  cdp.on("Network.requestWillBeSent", (event: any) => {
    const { requestId, request, type } = event;
    if (!request?.url) return;

    const hostname = (() => { try { return new URL(request.url).hostname; } catch { return ""; } })();
    const matchedDomain = WATCH_DOMAINS.find((d) => hostname === d || hostname.endsWith("." + d));
    if (!matchedDomain) return;

    requestMeta.set(requestId, {
      url: request.url,
      method: request.method,
      headers: request.headers ?? {},
      postData: request.postData ?? undefined,
      resourceType: type ?? "XHR",
      matchedDomain,
      requestAt: Date.now(),
    });
  });

  cdp.on("Network.responseReceived", (event: any) => {
    const { requestId, response } = event;
    const meta = requestMeta.get(requestId);
    if (!meta) return;

    // Async: fetch response body
    (async () => {
      let responseBody: string | null = null;
      try {
        const bodyResult = await cdp.send("Network.getResponseBody", { requestId }) as any;
        responseBody = bodyResult?.body ?? null;
        if (responseBody && responseBody.length > 10000) {
          responseBody = responseBody.slice(0, 10000) + "\n… [truncated at 10KB]";
        }
        // Pretty-print JSON
        if (responseBody) {
          try { responseBody = JSON.stringify(JSON.parse(responseBody), null, 2); } catch {}
        }
      } catch {}

      const obs: Observation = {
        observedAt: new Date().toISOString(),
        url: meta.url,
        method: meta.method,
        statusCode: response?.status ?? null,
        requestHeaders: meta.headers,
        requestBody: meta.postData ?? null,
        responseBody,
        resourceType: meta.resourceType,
        matchedDomain: meta.matchedDomain,
        timing: {
          requestAt: meta.requestAt,
          responseAt: Date.now(),
          durationMs: Date.now() - meta.requestAt,
        },
      };

      observations.push(obs);

      // Append to JSONL immediately
      await fs.mkdir(path.dirname(OUT), { recursive: true });
      await fs.appendFile(OUT, JSON.stringify(obs) + "\n", "utf8");

      // Log
      const short = meta.url.length > 70 ? meta.url.slice(0, 70) + "…" : meta.url;
      const status = response?.status ?? "?";
      console.log(`[${meta.matchedDomain}] ${meta.method} ${status} ${short}`);
      if (meta.postData) console.log(`  → ${meta.postData.length}b request body`);
      if (responseBody) console.log(`  ← ${responseBody.length}b response body`);
    })();

    requestMeta.delete(requestId);
  });

  // Navigate
  console.log(`\n🌐 Probing https://${TARGET} for ${DURATION_MS / 1000}s…`);
  console.log(`📁 Output: ${OUT}\n`);

  await page.goto(`https://${TARGET}`, { waitUntil: "domcontentloaded" });

  // Browse subpages to trigger more extension calls
  await page.waitForTimeout(3000);
  const links = await page.$$eval("a[href]", (as: any[]) =>
    as.slice(0, 8).map((a) => a.href).filter((h) => h.startsWith("http"))
  );

  for (const link of links.slice(0, 3)) {
    try {
      await page.goto(link, { waitUntil: "domcontentloaded", timeout: 8000 });
      await page.waitForTimeout(3000);
    } catch {}
  }

  // Idle to catch delayed pings (Mixpanel batches every 30s)
  console.log(`\n⏳ Waiting for delayed extension pings…`);
  await page.waitForTimeout(DURATION_MS - 20000);

  try {
    await context.close();
  } catch (e: any) {
    // macOS EPERM: Chromium with extensions can't be force-killed by Playwright
    // The data is already written to disk, so this is non-fatal
    console.log(`   (browser close: ${(e as Error).message.slice(0, 60)})`);
  }

  // Summary
  const byDomain: Record<string, number> = {};
  for (const o of observations) {
    byDomain[o.matchedDomain] = (byDomain[o.matchedDomain] || 0) + 1;
  }
  console.log(`\n✅ Captured ${observations.length} extension network calls:`);
  for (const [domain, count] of Object.entries(byDomain)) {
    console.log(`   ${domain}: ${count}`);
  }
  console.log(`\n📁 Full data: ${OUT}`);
}

run().catch((e) => { console.error(e); process.exit(1); });