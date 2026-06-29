/**
 * Create CBM profiles — one per DataImpulse sticky proxy port.
 *
 * Usage: npx ts-node scripts/createCbmProfiles.ts
 *
 * Reads CBM_API_URL from env (defaults to Railway public URL).
 * Creates 65 profiles with unique fingerprints, proxies, and locales.
 */

import "dotenv/config";

const CBM_API_URL =
  process.env.CBM_API_URL ?? "https://cloakbrowser-production-a859.up.railway.app";
const DI_USER = process.env.DI_USER ?? "edca074dad4914af4311";
const DI_PASS = process.env.DI_PASS ?? "d2535db117a4b9ea";

interface CbmCreatePayload {
  name: string;
  fingerprint_seed: number;
  proxy: string;
  timezone: string;
  locale: string;
  platform: string;
  user_agent: string;
  screen_width: number;
  screen_height: number;
  headless: boolean;
  auto_launch: boolean;
  launch_args: string[];
}

// ── Fingerprint distribution ─────────────────────────────────────

const LOCALE_TIMEZONES: Array<{ locale: string; timezoneId: string }> = [
  { locale: "en-US", timezoneId: "America/New_York" },
  { locale: "en-US", timezoneId: "America/Chicago" },
  { locale: "en-US", timezoneId: "America/Los_Angeles" },
  { locale: "en-CA", timezoneId: "America/Toronto" },
  { locale: "en-GB", timezoneId: "Europe/London" },
  { locale: "de-DE", timezoneId: "Europe/Berlin" },
  { locale: "fr-FR", timezoneId: "Europe/Paris" },
  { locale: "it-IT", timezoneId: "Europe/Rome" },
  { locale: "es-ES", timezoneId: "Europe/Madrid" },
  { locale: "nl-NL", timezoneId: "Europe/Amsterdam" },
  { locale: "pl-PL", timezoneId: "Europe/Warsaw" },
  { locale: "pt-PT", timezoneId: "Europe/Lisbon" },
  { locale: "sv-SE", timezoneId: "Europe/Stockholm" },
  { locale: "en-AU", timezoneId: "Australia/Sydney" },
  { locale: "ja-JP", timezoneId: "Asia/Tokyo" },
];

const VIEWPORTS: Array<{ w: number; h: number }> = [
  { w: 1920, h: 1080 },
  { w: 1366, h: 768 },
  { w: 1440, h: 900 },
  { w: 2560, h: 1440 },
  { w: 1280, h: 720 },
  { w: 1600, h: 900 },
  { w: 1920, h: 1080 },
  { w: 1536, h: 864 },
  { w: 1680, h: 1050 },
  { w: 1920, h: 1200 },
];

const CHROME_VERSIONS = [126, 127, 128, 129, 130, 131, 132, 133];

function pick<T>(arr: T[], index: number): T {
  return arr[index % arr.length];
}

function buildProfile(index: number, proxyPort: number): CbmCreatePayload {
  const seed = index + 1;
  const lt = pick(LOCALE_TIMEZONES, index);
  const vp = pick(VIEWPORTS, Math.floor(index / 2));
  const chromeVer = pick(CHROME_VERSIONS, seed);

  return {
    name: `bot-p${seed}`,
    fingerprint_seed: seed,
    proxy: `http://${DI_USER}:${DI_PASS}@gw.dataimpulse.com:${proxyPort}`,
    timezone: lt.timezoneId,
    locale: lt.locale,
    platform: "windows",
    user_agent: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVer}.0.0.0 Safari/537.36`,
    screen_width: vp.w,
    screen_height: vp.h,
    headless: true,
    auto_launch: false,
    launch_args: ["--load-extension=/data/extensions/similarweb"],
  };
}

// ── API call ─────────────────────────────────────────────────────

async function createProfile(payload: CbmCreatePayload): Promise<void> {
  const url = `${CBM_API_URL.replace(/\/+$/, "")}/api/profiles`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "(no body)");
    throw new Error(
      `Failed to create ${payload.name}: ${res.status} ${text}`,
    );
  }

  const data = await res.json();
  console.log(
    `✅ ${payload.name} created — ID: ${data.id} | ${payload.locale} ${payload.timezone} | proxy:${proxyPortFor(payload.proxy)} | ${vpLabel(payload.screen_width, payload.screen_height)}`,
  );
}

function proxyPortFor(proxyUrl: string): string {
  const match = proxyUrl.match(/:(\d+)$/);
  return match ? match[1] : "?";
}

function vpLabel(w: number, h: number): string {
  return `${w}x${h}`;
}

// ── Main ──────────────────────────────────────────────────────────

async function main() {
  console.log(`CBM API: ${CBM_API_URL}`);
  console.log("Creating 65 profiles with DataImpulse sticky proxies (ports 10000–10064)...\n");

  const BATCH_SIZE = 10;
  const TOTAL = 65;
  let created = 0;
  let errors = 0;

  // Profiles are created in batches to avoid overwhelming CBM
  for (let i = 0; i < TOTAL; i += BATCH_SIZE) {
    const batch = [];
    for (let j = i; j < Math.min(i + BATCH_SIZE, TOTAL); j++) {
      const proxyPort = 10000 + j; // 10000 .. 10064
      const payload = buildProfile(j, proxyPort);
      batch.push(payload);
    }

    const results = await Promise.allSettled(
      batch.map((p) => createProfile(p)),
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        created++;
      } else {
        console.error(`❌ ${result.reason}`);
        errors++;
      }
    }

    if (i + BATCH_SIZE < TOTAL) {
      console.log(`  ... ${Math.min(i + BATCH_SIZE, TOTAL)}/${TOTAL} created, sleeping 2s...\n`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  console.log(`\nDone: ${created} created, ${errors} errors`);
  process.exit(errors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
