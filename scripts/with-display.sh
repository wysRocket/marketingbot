#!/usr/bin/env bash
# with-display.sh — Start Xvfb virtual display and run a command in it
#
# Usage:
#   bash scripts/with-display.sh npm run telemetry:extension-watch
#   bash scripts/with-display.sh npm run warmup:run
#   DISPLAY_NUM=98 SCREEN_RES=1920x1080x24 bash scripts/with-display.sh <cmd>
#
# The script:
#   1. Starts Xvfb on :${DISPLAY_NUM} (default :99)
#   2. Exports DISPLAY so all child processes inherit it
#   3. Runs the given command with that DISPLAY
#   4. Kills Xvfb when the command exits (or on Ctrl-C)

set -euo pipefail

DISPLAY_NUM="${DISPLAY_NUM:-99}"
SCREEN_RES="${SCREEN_RES:-1280x800x24}"
DISPLAY_ID=":${DISPLAY_NUM}"

# ── Require Xvfb ────────────────────────────────────────────────────────────
if ! command -v Xvfb &>/dev/null; then
  echo "❌  Xvfb not found. Install with:"
  echo "    apt-get install -y xvfb"
  exit 1
fi

# ── Clean up stale state ─────────────────────────────────────────────────────
pkill -f "Xvfb ${DISPLAY_ID}" 2>/dev/null || true
rm -f "/tmp/.X${DISPLAY_NUM}-lock" 2>/dev/null || true

# ── Start Xvfb ───────────────────────────────────────────────────────────────
Xvfb "${DISPLAY_ID}" -screen 0 "${SCREEN_RES}" -nolisten tcp -ac &
XVFB_PID=$!

# Give it a moment to open the socket
sleep 0.8

echo "🖥  Xvfb started  DISPLAY=${DISPLAY_ID}  PID=${XVFB_PID}  screen=${SCREEN_RES}"

# ── Export display for child processes ──────────────────────────────────────
export DISPLAY="${DISPLAY_ID}"

# ── Cleanup on exit ──────────────────────────────────────────────────────────
cleanup() {
  echo ""
  echo "🛑 Stopping Xvfb (PID=${XVFB_PID})…"
  kill "${XVFB_PID}" 2>/dev/null || true
  rm -f "/tmp/.X${DISPLAY_NUM}-lock" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# ── Run the user's command ────────────────────────────────────────────────────
if [[ $# -eq 0 ]]; then
  echo "Usage: $0 <command> [args…]"
  exit 0
fi

exec "$@"
