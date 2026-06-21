/**
 * Non-blocking extension event writer.
 *
 * Appends ExtensionTelemetryEvent records to telemetry/extension-events.jsonl.
 * Used by both the main patchright bot (index.patchright.ts) and the standalone
 * extension-telemetry-session script.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import type { ExtensionTelemetryEvent } from "./extensionTelemetry";

const TELEMETRY_DIR = path.resolve(
  process.cwd(),
  process.env.FLOW_TELEMETRY_DIR ?? "telemetry",
);
const EVENTS_FILE = path.join(TELEMETRY_DIR, "extension-events.jsonl");

// Ensure the telemetry directory exists (best-effort, non-blocking).
fs.mkdir(TELEMETRY_DIR, { recursive: true }).catch(() => {});

/**
 * Append a single extension telemetry event to the JSONL file.
 * Fire-and-forget: errors are logged but never thrown so the bot loop
 * is never interrupted by telemetry I/O.
 */
export function appendExtEvent(event: ExtensionTelemetryEvent): void {
  const line = JSON.stringify(event) + "\n";
  fs.appendFile(EVENTS_FILE, line, "utf8").catch((err) => {
    console.warn(`[ext-event-writer] append failed: ${(err as Error).message}`);
  });
}
