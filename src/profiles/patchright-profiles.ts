/**
 * Patchright Fingerprint Profiles
 *
 * Each profile mimics a real browser configuration.
 * These are used by the Patchright MCP to launch browsers with specific fingerprints.
 */

/**
 * Context-level options only — no launch options (headless, args) here.
 * Launch options are set in chromium.launch() inside the bot runner.
 */
export interface PatchrightProfile {
  id: string;
  name: string;
  config: {
    userAgent?: string;
    viewport?: { width: number; height: number };
    locale?: string;
    timezoneId?: string;
    colorScheme?: "light" | "dark" | "no-preference";
    ignoreHTTPSErrors?: boolean;
    // Advanced options
    extraHTTPHeaders?: Record<string, string>;
    geolocation?: { latitude: number; longitude: number };
    permissions?: string[];
    proxy?: { server: string; bypass?: string };
    // Mobile simulation
    isMobile?: boolean;
    hasTouch?: boolean;
    deviceScaleFactor?: number;
  };
}

// Base context config shared by all profiles (context-level only)
const baseConfig = {
  ignoreHTTPSErrors: true,
};

export const profiles: PatchrightProfile[] = [
  // Windows 10 + Chrome 120 (most common)
  {
    id: "win10-chrome-120",
    name: "Windows 10 Chrome 120",
    config: {
      ...baseConfig,
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1920, height: 1080 },
      locale: "en-US",
      timezoneId: "America/New_York",
      colorScheme: "light",
    },
  },

  // Windows 10 + Chrome 119 (older)
  {
    id: "win10-chrome-119",
    name: "Windows 10 Chrome 119",
    config: {
      ...baseConfig,
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
      viewport: { width: 1920, height: 1080 },
      locale: "en-US",
      timezoneId: "America/Chicago",
      colorScheme: "light",
    },
  },

  // Windows 11 + Chrome 120
  {
    id: "win11-chrome-120",
    name: "Windows 11 Chrome 120",
    config: {
      ...baseConfig,
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 2560, height: 1440 },
      locale: "en-GB",
      timezoneId: "Europe/London",
      colorScheme: "dark",
    },
  },

  // macOS 14 (Sonoma) + Safari 17 (via Chrome UA)
  {
    id: "macos-sonoma",
    name: "macOS 14 (Sonoma)",
    config: {
      ...baseConfig,
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
      viewport: { width: 1440, height: 900 },
      locale: "en-US",
      timezoneId: "America/Los_Angeles",
      colorScheme: "light",
    },
  },

  // macOS 13 (Ventura) + Safari 16
  {
    id: "macos-ventura",
    name: "macOS 13 (Ventura)",
    config: {
      ...baseConfig,
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15",
      viewport: { width: 1680, height: 1050 },
      locale: "en-CA",
      timezoneId: "America/Toronto",
      colorScheme: "light",
    },
  },

  // Linux + Chrome (dev crowd)
  {
    id: "linux-chrome-120",
    name: "Linux Chrome 120",
    config: {
      ...baseConfig,
      userAgent:
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1920, height: 1080 },
      locale: "en-US",
      timezoneId: "America/Denver",
      colorScheme: "no-preference",
    },
  },

  // Mobile: iPhone 15 + Safari
  {
    id: "iphone-15",
    name: "iPhone 15 Safari",
    config: {
      ...baseConfig,
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1",
      viewport: { width: 390, height: 844 },
      locale: "en-US",
      timezoneId: "America/New_York",
      colorScheme: "light",
      isMobile: true,
      hasTouch: true,
    },
  },

  // Mobile: Android + Chrome
  {
    id: "android-pixel-7",
    name: "Android Pixel 7",
    config: {
      ...baseConfig,
      userAgent:
        "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
      viewport: { width: 412, height: 915 },
      locale: "en-US",
      timezoneId: "America/Los_Angeles",
      colorScheme: "no-preference",
      isMobile: true,
      hasTouch: true,
    },
  },

  // High DPI display
  {
    id: "macbook-pro-16",
    name: 'MacBook Pro 16" Retina',
    config: {
      ...baseConfig,
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1728, height: 1117 },
      locale: "en-US",
      timezoneId: "America/New_York",
      colorScheme: "dark",
      deviceScaleFactor: 2,
    },
  },

  // Low-end Windows laptop
  {
    id: "low-end-win10",
    name: "Low-end Windows 10",
    config: {
      ...baseConfig,
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
      viewport: { width: 1366, height: 768 },
      locale: "en-US",
      timezoneId: "America/Chicago",
      colorScheme: "light",
      // Simulate low-end device
      extraHTTPHeaders: {
        "Sec-CH-UA": '"Chromium";v="119", "Not?A_Brand";v="24"',
        "Sec-CH-UA-Mobile": "?0",
        "Sec-CH-UA-Platform": '"Windows"',
        "Sec-CH-UA-Platform-Version": '"10.0.0"',
      },
    },
  },

  // Windows 11 + Chrome 121 (German)
  {
    id: "win11-chrome-121-de",
    name: "Windows 11 Chrome 121 (DE)",
    config: {
      ...baseConfig,
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      viewport: { width: 2560, height: 1440 },
      locale: "de-DE",
      timezoneId: "Europe/Berlin",
      colorScheme: "light",
    },
  },

  // Windows 10 + Chrome 122 (Australian)
  {
    id: "win10-chrome-122-au",
    name: "Windows 10 Chrome 122 (AU)",
    config: {
      ...baseConfig,
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      viewport: { width: 1920, height: 1080 },
      locale: "en-AU",
      timezoneId: "Australia/Sydney",
      colorScheme: "light",
    },
  },

  // macOS Monterey + Chrome 120 (French)
  {
    id: "macos-monterey-fr",
    name: "macOS Monterey Chrome (FR)",
    config: {
      ...baseConfig,
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1440, height: 900 },
      locale: "fr-FR",
      timezoneId: "Europe/Paris",
      colorScheme: "light",
    },
  },

  // macOS Big Sur + Chrome 119 (Japanese)
  {
    id: "macos-big-sur-jp",
    name: "macOS Big Sur Chrome (JP)",
    config: {
      ...baseConfig,
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 11_7_10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
      viewport: { width: 1680, height: 1050 },
      locale: "ja-JP",
      timezoneId: "Asia/Tokyo",
      colorScheme: "light",
    },
  },

  // Linux Ubuntu + Chrome 121
  {
    id: "linux-ubuntu-chrome-121",
    name: "Linux Ubuntu Chrome 121",
    config: {
      ...baseConfig,
      userAgent:
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      viewport: { width: 1920, height: 1080 },
      locale: "en-US",
      timezoneId: "America/Phoenix",
      colorScheme: "no-preference",
    },
  },

  // Android Samsung Galaxy S23
  {
    id: "android-samsung-s23",
    name: "Android Samsung Galaxy S23",
    config: {
      ...baseConfig,
      userAgent:
        "Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
      viewport: { width: 393, height: 851 },
      locale: "en-GB",
      timezoneId: "Europe/London",
      colorScheme: "light",
      isMobile: true,
      hasTouch: true,
    },
  },

  // iPad Pro 13"
  {
    id: "ipad-pro-13",
    name: 'iPad Pro 13"',
    config: {
      ...baseConfig,
      userAgent:
        "Mozilla/5.0 (iPad; CPU OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1",
      viewport: { width: 1024, height: 1366 },
      locale: "en-US",
      timezoneId: "America/Chicago",
      colorScheme: "light",
      isMobile: true,
      hasTouch: true,
    },
  },

  // Windows 10 + Chrome 118 (older, German)
  {
    id: "win10-chrome-118-de",
    name: "Windows 10 Chrome 118 (DE)",
    config: {
      ...baseConfig,
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
      viewport: { width: 1366, height: 768 },
      locale: "de-DE",
      timezoneId: "Europe/Berlin",
      colorScheme: "light",
    },
  },

  // Windows 11 + Chrome 120 (Japanese)
  {
    id: "win11-chrome-120-jp",
    name: "Windows 11 Chrome 120 (JP)",
    config: {
      ...baseConfig,
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1920, height: 1080 },
      locale: "ja-JP",
      timezoneId: "Asia/Tokyo",
      colorScheme: "light",
    },
  },

  // MacBook Air M2 (Retina)
  {
    id: "macbook-air-m2",
    name: "MacBook Air M2",
    config: {
      ...baseConfig,
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1504, height: 960 },
      locale: "en-US",
      timezoneId: "America/Los_Angeles",
      colorScheme: "light",
      deviceScaleFactor: 2,
    },
  },
];

/**
 * Get profile by ID
 */
export function getProfile(id: string): PatchrightProfile | undefined {
  return profiles.find((p) => p.id === id);
}

/**
 * Get all profile IDs
 */
export function listProfileIds(): string[] {
  return profiles.map((p) => p.id);
}

/**
 * Get random profile (for randomization)
 */
export function getRandomProfile(): PatchrightProfile {
  const idx = Math.floor(Math.random() * profiles.length);
  return profiles[idx];
}
