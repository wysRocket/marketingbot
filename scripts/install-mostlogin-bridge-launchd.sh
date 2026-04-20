#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${1:-${REPO_ROOT}/.mostlogin-bridge.env}"
AGENTS_DIR="${HOME}/Library/LaunchAgents"
LOG_DIR="${HOME}/Library/Logs/marketingbot"
DOMAIN="gui/$(id -u)"

PROXY_LABEL="com.marketingbot.mostlogin-tunnel-proxy"
CLOUDFLARED_LABEL="com.marketingbot.mostlogin-cloudflared"

PROXY_TEMPLATE="${REPO_ROOT}/ops/launchd/${PROXY_LABEL}.plist.template"
CLOUDFLARED_TEMPLATE="${REPO_ROOT}/ops/launchd/${CLOUDFLARED_LABEL}.plist.template"
PROXY_TARGET="${AGENTS_DIR}/${PROXY_LABEL}.plist"
CLOUDFLARED_TARGET="${AGENTS_DIR}/${CLOUDFLARED_LABEL}.plist"
PROXY_RUNNER="${REPO_ROOT}/scripts/run-mostlogin-tunnel-proxy.sh"
CLOUDFLARED_RUNNER="${REPO_ROOT}/scripts/run-mostlogin-cloudflared.sh"

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "[mostlogin-bridge] Missing env file: ${ENV_FILE}" >&2
  echo "[mostlogin-bridge] Copy .mostlogin-bridge.env.example to .mostlogin-bridge.env first." >&2
  exit 1
fi

command -v launchctl >/dev/null 2>&1 || {
  echo "[mostlogin-bridge] launchctl is required on macOS." >&2
  exit 1
}

command -v npm >/dev/null 2>&1 || {
  echo "[mostlogin-bridge] npm is required but was not found in PATH." >&2
  exit 1
}

command -v cloudflared >/dev/null 2>&1 || {
  echo "[mostlogin-bridge] cloudflared is required but was not found in PATH." >&2
  exit 1
}

set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

: "${MOSTLOGIN_API_KEY:?MOSTLOGIN_API_KEY is required}"
: "${MOSTLOGIN_TUNNEL_BEARER:?MOSTLOGIN_TUNNEL_BEARER is required}"
: "${MOSTLOGIN_CLOUDFLARED_CONFIG:?MOSTLOGIN_CLOUDFLARED_CONFIG is required}"
: "${MOSTLOGIN_CLOUDFLARED_TUNNEL:?MOSTLOGIN_CLOUDFLARED_TUNNEL is required}"

if [[ ! -f "${MOSTLOGIN_CLOUDFLARED_CONFIG}" ]]; then
  echo "[mostlogin-bridge] Missing Cloudflare config: ${MOSTLOGIN_CLOUDFLARED_CONFIG}" >&2
  exit 1
fi

mkdir -p "${AGENTS_DIR}" "${LOG_DIR}"

render_template() {
  local template_path="$1"
  local target_path="$2"
  local runner_path="$3"
  local stdout_path="$4"
  local stderr_path="$5"

  sed \
    -e "s#__REPO_ROOT__#${REPO_ROOT//\#/\\#}#g" \
    -e "s#__ENV_FILE__#${ENV_FILE//\#/\\#}#g" \
    -e "s#__RUNNER_PATH__#${runner_path//\#/\\#}#g" \
    -e "s#__STDOUT_PATH__#${stdout_path//\#/\\#}#g" \
    -e "s#__STDERR_PATH__#${stderr_path//\#/\\#}#g" \
    "${template_path}" > "${target_path}"
}

render_template \
  "${PROXY_TEMPLATE}" \
  "${PROXY_TARGET}" \
  "${PROXY_RUNNER}" \
  "${LOG_DIR}/mostlogin-tunnel-proxy.stdout.log" \
  "${LOG_DIR}/mostlogin-tunnel-proxy.stderr.log"

render_template \
  "${CLOUDFLARED_TEMPLATE}" \
  "${CLOUDFLARED_TARGET}" \
  "${CLOUDFLARED_RUNNER}" \
  "${LOG_DIR}/mostlogin-cloudflared.stdout.log" \
  "${LOG_DIR}/mostlogin-cloudflared.stderr.log"

launchctl bootout "${DOMAIN}" "${PROXY_TARGET}" >/dev/null 2>&1 || true
launchctl bootout "${DOMAIN}" "${CLOUDFLARED_TARGET}" >/dev/null 2>&1 || true

launchctl bootstrap "${DOMAIN}" "${PROXY_TARGET}"
launchctl bootstrap "${DOMAIN}" "${CLOUDFLARED_TARGET}"

launchctl kickstart -k "${DOMAIN}/${PROXY_LABEL}"
launchctl kickstart -k "${DOMAIN}/${CLOUDFLARED_LABEL}"

echo "[mostlogin-bridge] Installed LaunchAgents:"
echo "  ${PROXY_TARGET}"
echo "  ${CLOUDFLARED_TARGET}"
echo
echo "[mostlogin-bridge] Log files:"
echo "  ${LOG_DIR}/mostlogin-tunnel-proxy.stdout.log"
echo "  ${LOG_DIR}/mostlogin-tunnel-proxy.stderr.log"
echo "  ${LOG_DIR}/mostlogin-cloudflared.stdout.log"
echo "  ${LOG_DIR}/mostlogin-cloudflared.stderr.log"
echo
echo "[mostlogin-bridge] Status commands:"
echo "  launchctl print ${DOMAIN}/${PROXY_LABEL}"
echo "  launchctl print ${DOMAIN}/${CLOUDFLARED_LABEL}"
