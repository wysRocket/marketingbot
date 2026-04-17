import { describe, expect, it } from "vitest";
import {
  CACHE_ONLY_RESET_PATHS,
  IDENTITY_STICKY_RESET_PATHS,
  resolveCacheDir,
} from "../../src/profiles/persistence-policy";

describe("persistence-policy", () => {
  it("CACHE_ONLY_RESET_PATHS includes Default/Cookies", () => {
    expect(CACHE_ONLY_RESET_PATHS).toContain("Default/Cookies");
  });

  it("IDENTITY_STICKY_RESET_PATHS includes SingletonLock", () => {
    expect(IDENTITY_STICKY_RESET_PATHS).toContain("SingletonLock");
  });

  it("resolveCacheDir uses PATCHRIGHT_CACHE_DIR env var when set", () => {
    process.env.PATCHRIGHT_CACHE_DIR = "/custom/cache";
    expect(resolveCacheDir()).toBe("/custom/cache");
    delete process.env.PATCHRIGHT_CACHE_DIR;
  });
});
