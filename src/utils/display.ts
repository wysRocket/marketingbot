/**
 * display.ts — Virtual display utility for Linux/Railway deployments
 *
 * Chrome runs extensions fully only in headed mode. On a headless Linux
 * server (Railway, EC2, etc.) we spin up an Xvfb virtual framebuffer so
 * Chrome thinks it has a real display. This beats --headless=new because:
 *  - headless itself is a detectable fingerprint
 *  - Xvfb + headed = same code path as a real desktop, maximum extension compat
 *
 * Usage:
 *   const info = await ensureDisplay();
 *   const { headless, extraArgs } = getChromeMode(info);
 *   await chromium.launchPersistentContext(dir, { headless, args: extraArgs });
 */

import { spawn, spawnSync } from "node:child_process";
import { unlinkSync } from "node:fs";

// ── Types ──────────────────────────────────────────────────────────────────

export type DisplayMode =
  | "macos"            // macOS: headed natively, no action needed
  | "existing"         // DISPLAY already set (user ran with-display.sh)
  | "xvfb"             // we started Xvfb ourselves
  | "headless-fallback"; // Xvfb not available → --headless=new

export interface DisplayInfo {
  display: string | null;
  mode: DisplayMode;
}

// ── ensureDisplay ──────────────────────────────────────────────────────────

/**
 * Ensures a display is available for Chrome.
 * On macOS or when DISPLAY is already set: no-op.
 * On Linux without DISPLAY: attempts to start Xvfb.
 */
export async function ensureDisplay(opts: {
  screen?: string;     // virtual screen spec, default "1280x800x24"
  displayNum?: number; // X display number,   default 99
  verbose?: boolean;
} = {}): Promise<DisplayInfo> {
  const { screen = "1280x800x24", displayNum = 99, verbose = true } = opts;

  // ── macOS: Chrome runs headed natively ──────────────────────────────────
  if (process.platform === "darwin") {
    if (verbose) console.log("🖥  macOS: running Chrome headed natively");
    return { display: process.env.DISPLAY ?? null, mode: "macos" };
  }

  // ── DISPLAY already set externally ──────────────────────────────────────
  if (process.env.DISPLAY) {
    if (verbose) console.log(`🖥  Using existing DISPLAY=${process.env.DISPLAY}`);
    return { display: process.env.DISPLAY, mode: "existing" };
  }

  // ── Try to start Xvfb ───────────────────────────────────────────────────
  const xvfbCheck = spawnSync("which", ["Xvfb"], { stdio: "pipe" });
  if (xvfbCheck.status !== 0) {
    console.warn("⚠  Xvfb not found — falling back to Chrome --headless=new");
    console.warn("   Install: apt-get install -y xvfb");
    return { display: null, mode: "headless-fallback" };
  }

  const displayId = `:${displayNum}`;

  // Kill any stale process from a previous crash
  spawnSync("pkill", ["-f", `Xvfb ${displayId}`], { stdio: "ignore" });
  try { unlinkSync(`/tmp/.X${displayNum}-lock`); } catch { /* no stale lock */ }

  await new Promise<void>((resolve, reject) => {
    const xvfb = spawn(
      "Xvfb",
      [displayId, "-screen", "0", screen, "-nolisten", "tcp", "-ac"],
      { detached: true, stdio: "ignore" }
    );
    xvfb.unref();
    xvfb.on("error", (err) => reject(err));
    // Give Xvfb ~700ms to open the socket before Chrome tries to connect
    setTimeout(resolve, 700);
  });

  process.env.DISPLAY = displayId;
  if (verbose) console.log(`🖥  Started Xvfb  DISPLAY=${displayId}  screen=${screen}`);
  return { display: displayId, mode: "xvfb" };
}

// ── getChromeMode ──────────────────────────────────────────────────────────

/**
 * Returns the Playwright launchPersistentContext flags to use based on
 * what display we ended up with.
 *
 * - macos / existing / xvfb  → headless:false, no extra args
 *   (Chrome runs fully headed into a real or virtual display)
 * - headless-fallback         → headless:false + --headless=new
 *   (Chrome 112+ supports extensions in this mode, though it is detectable)
 */
export function getChromeMode(info: DisplayInfo): {
  headless: boolean;
  extraArgs: string[];
} {
  if (info.mode === "headless-fallback") {
    return { headless: false, extraArgs: ["--headless=new"] };
  }
  return { headless: false, extraArgs: [] };
}

// ── Convenience re-export ──────────────────────────────────────────────────

export function isXvfbAvailable(): boolean {
  return spawnSync("which", ["Xvfb"], { stdio: "pipe" }).status === 0;
}
