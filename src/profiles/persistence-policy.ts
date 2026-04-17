import path from "node:path";

export const CACHE_ONLY_RESET_PATHS = [
  "Default/Network",
  "Default/Login Data",
  "Default/Login Data For Account",
  "Default/Cookies",
  "Default/Local Storage",
  "Default/Session Storage",
  "Default/IndexedDB",
  "Default/Extension Cookies",
  "Default/Preferences",
  "Default/Secure Preferences",
];

export const IDENTITY_STICKY_RESET_PATHS = [
  "SingletonLock",
  "SingletonSocket",
  "SingletonCookie",
];

export function resolveCacheDir(
  env: Record<string, string | undefined> = process.env,
): string {
  return env.PATCHRIGHT_CACHE_DIR ?? path.join("/data", "marketingbot-patchright");
}
