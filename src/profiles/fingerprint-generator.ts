import { randomBytes } from "crypto";
import type { PatchrightProfile } from "./patchright-profiles";

// -------------------------------------------------------------------
// RANDOMIZED FINGERPRINT GENERATOR
//
// Generates fresh browser identities on every startup so each run
// presents N completely new visitors to the target site.
// -------------------------------------------------------------------

const CHROME_VERSIONS = [118, 119, 120, 121, 122, 123, 124, 125];

type ProfileClass = "win-desktop" | "mac-desktop" | "linux-desktop" | "iphone" | "android" | "ipad";

interface FingerprintPool {
  classes: ProfileClass[];
  localeTimezone: Array<{ locale: string; timezoneId: string }>;
  colorSchemes: Array<"light" | "dark" | "no-preference">;
}

const POOL: FingerprintPool = {
  classes: [
    "win-desktop",
    "win-desktop",
    "win-desktop",
    "mac-desktop",
    "mac-desktop",
    "linux-desktop",
    "iphone",
    "android",
    "ipad",
  ],
  localeTimezone: [
    { locale: "en-US", timezoneId: "America/New_York" },
    { locale: "en-US", timezoneId: "America/Chicago" },
    { locale: "en-US", timezoneId: "America/Denver" },
    { locale: "en-US", timezoneId: "America/Los_Angeles" },
    { locale: "en-US", timezoneId: "America/Phoenix" },
    { locale: "en-GB", timezoneId: "Europe/London" },
    { locale: "en-AU", timezoneId: "Australia/Sydney" },
    { locale: "en-CA", timezoneId: "America/Toronto" },
    { locale: "de-DE", timezoneId: "Europe/Berlin" },
    { locale: "fr-FR", timezoneId: "Europe/Paris" },
    { locale: "ja-JP", timezoneId: "Asia/Tokyo" },
  ],
  colorSchemes: ["light", "light", "light", "dark", "no-preference"],
};

// Realistic Windows viewports (width × height)
const WIN_VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 2560, height: 1440 },
  { width: 1280, height: 720 },
  { width: 1600, height: 900 },
];

const MAC_VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1680, height: 1050 },
  { width: 1728, height: 1117 },
  { width: 1504, height: 960 },
  { width: 2560, height: 1600 },
];

const LINUX_VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1920, height: 1080 },
  { width: 1600, height: 900 },
  { width: 1280, height: 800 },
];

// iPhone models (logical pixels at 2× DPR)
const IPHONE_VIEWPORTS = [
  { width: 390, height: 844 },  // iPhone 14
  { width: 393, height: 852 },  // iPhone 15
  { width: 375, height: 812 },  // iPhone X/11 Pro
  { width: 414, height: 896 },  // iPhone 11
  { width: 430, height: 932 },  // iPhone 15 Pro Max
];

// Android phones
const ANDROID_VIEWPORTS = [
  { width: 412, height: 915 },  // Pixel 7
  { width: 393, height: 851 },  // Galaxy S23
  { width: 360, height: 800 },  // generic mid-range
  { width: 384, height: 854 },  // Pixel 6a
];

// iPad Pro / Air
const IPAD_VIEWPORTS = [
  { width: 1024, height: 1366 }, // iPad Pro 13"
  { width: 834, height: 1194 },  // iPad Pro 11"
  { width: 820, height: 1180 },  // iPad Air
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pick2<T>(arr: T[], exclude: T): T {
  const others = arr.filter((x) => x !== exclude);
  return pick(others.length > 0 ? others : arr);
}

function chromeUA(version: number, platform: string): string {
  return `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version}.0.0.0 Safari/537.36`;
}

function safariUA(safariVersion: string, os: string): string {
  return `Mozilla/5.0 (${os}) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${safariVersion} Safari/605.1.15`;
}

function buildDesktopProfile(
  cls: "win-desktop" | "mac-desktop" | "linux-desktop",
  index: number,
): PatchrightProfile["config"] {
  const lt = pick(POOL.localeTimezone);
  const colorScheme = pick(POOL.colorSchemes);
  const chromeVersion = pick(CHROME_VERSIONS);

  if (cls === "win-desktop") {
    const winVersion = Math.random() < 0.6 ? "NT 10.0" : "NT 10.0"; // Win 10 & 11 share the NT 10.0 UA
    const isRetina = Math.random() < 0.1;
    return {
      userAgent: chromeUA(chromeVersion, `Windows ${winVersion}; Win64; x64`),
      viewport: pick(WIN_VIEWPORTS),
      locale: lt.locale,
      timezoneId: lt.timezoneId,
      colorScheme,
      ignoreHTTPSErrors: true,
      ...(isRetina ? { deviceScaleFactor: 2 } : {}),
    };
  }

  if (cls === "mac-desktop") {
    const useSafari = Math.random() < 0.25;
    const viewport = pick(MAC_VIEWPORTS);
    const isRetina = viewport.width <= 1728;
    const ua = useSafari
      ? safariUA(pick(["17.1", "16.6", "17.2", "17.3"]), "Macintosh; Intel Mac OS X 10_15_7")
      : chromeUA(chromeVersion, "Macintosh; Intel Mac OS X 10_15_7");
    return {
      userAgent: ua,
      viewport,
      locale: lt.locale,
      timezoneId: lt.timezoneId,
      colorScheme,
      ignoreHTTPSErrors: true,
      deviceScaleFactor: isRetina ? 2 : 1,
    };
  }

  // linux-desktop
  return {
    userAgent: chromeUA(chromeVersion, "X11; Linux x86_64"),
    viewport: pick(LINUX_VIEWPORTS),
    locale: lt.locale,
    timezoneId: lt.timezoneId,
    colorScheme,
    ignoreHTTPSErrors: true,
  };
}

function buildMobileProfile(
  cls: "iphone" | "android" | "ipad",
): PatchrightProfile["config"] {
  const lt = pick(POOL.localeTimezone);
  const colorScheme = pick(POOL.colorSchemes);
  const chromeVersion = pick(CHROME_VERSIONS);

  if (cls === "iphone") {
    const iosVersion = pick(["17_1", "17_2", "17_3", "16_6", "17_4"]);
    const safariVersion = iosVersion.startsWith("17") ? pick(["17.1", "17.2", "17.3"]) : "16.6";
    const ua = `Mozilla/5.0 (iPhone; CPU iPhone OS ${iosVersion} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${safariVersion} Mobile/15E148 Safari/604.1`;
    return {
      userAgent: ua,
      viewport: pick(IPHONE_VIEWPORTS),
      locale: lt.locale,
      timezoneId: lt.timezoneId,
      colorScheme,
      ignoreHTTPSErrors: true,
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 3,
    };
  }

  if (cls === "ipad") {
    const iosVersion = pick(["17_1", "17_2", "16_6"]);
    const safariVersion = iosVersion.startsWith("17") ? "17.1" : "16.6";
    const ua = `Mozilla/5.0 (iPad; CPU OS ${iosVersion} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${safariVersion} Mobile/15E148 Safari/604.1`;
    return {
      userAgent: ua,
      viewport: pick(IPAD_VIEWPORTS),
      locale: lt.locale,
      timezoneId: lt.timezoneId,
      colorScheme,
      ignoreHTTPSErrors: true,
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    };
  }

  // android
  const androidModels: Record<string, string> = {
    "Pixel 7": "Linux; Android 14; Pixel 7",
    "Pixel 8": "Linux; Android 14; Pixel 8",
    "SM-S911B": "Linux; Android 13; SM-S911B",
    "SM-A546B": "Linux; Android 14; SM-A546B",
    "Pixel 6a": "Linux; Android 13; Pixel 6a",
  };
  const modelPlatform = pick(Object.values(androidModels));
  const ua = `Mozilla/5.0 (${modelPlatform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion}.0.0.0 Mobile Safari/537.36`;
  return {
    userAgent: ua,
    viewport: pick(ANDROID_VIEWPORTS),
    locale: lt.locale,
    timezoneId: lt.timezoneId,
    colorScheme,
    ignoreHTTPSErrors: true,
    isMobile: true,
    hasTouch: true,
  };
}

/**
 * Generate `count` fresh randomized browser fingerprints.
 * Call once at startup — each run sees a brand-new set of identities.
 */
export function generateFingerprints(count: number): PatchrightProfile[] {
  // Spread device classes evenly: weight toward desktop (most real traffic)
  const weightedClasses: ProfileClass[] = [
    ...Array(5).fill("win-desktop"),
    ...Array(3).fill("mac-desktop"),
    ...Array(2).fill("linux-desktop"),
    ...Array(2).fill("iphone"),
    ...Array(2).fill("android"),
    ...Array(1).fill("ipad"),
  ];

  return Array.from({ length: count }, (_, i) => {
    const cls = pick(weightedClasses) as ProfileClass;
    const config =
      cls === "iphone" || cls === "android" || cls === "ipad"
        ? buildMobileProfile(cls)
        : buildDesktopProfile(cls as "win-desktop" | "mac-desktop" | "linux-desktop", i);

    return {
      id: `fp-${i.toString().padStart(2, "0")}`,
      name: `Generated ${cls} #${i + 1}`,
      config,
    };
  });
}

/**
 * Generate a short random token for scoping proxy sessions to this run.
 * Format: 8 hex chars (4 random bytes).
 */
export function generateRunToken(): string {
  return randomBytes(4).toString("hex");
}
