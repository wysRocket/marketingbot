#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${1:-${MOSTLOGIN_BRIDGE_ENV_FILE:-${REPO_ROOT}/.mostlogin-bridge.env}}"

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "[mostlogin-bridge] Missing env file: ${ENV_FILE}" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

: "${MOSTLOGIN_CLOUDFLARED_CONFIG:?MOSTLOGIN_CLOUDFLARED_CONFIG is required}"
: "${MOSTLOGIN_CLOUDFLARED_TUNNEL:?MOSTLOGIN_CLOUDFLARED_TUNNEL is required}"

if [[ ! -f "${MOSTLOGIN_CLOUDFLARED_CONFIG}" ]]; then
  echo "[mostlogin-bridge] Missing Cloudflare config: ${MOSTLOGIN_CLOUDFLARED_CONFIG}" >&2
  exit 1
fi

cd "${REPO_ROOT}"
exec cloudflared tunnel --config "${MOSTLOGIN_CLOUDFLARED_CONFIG}" --no-autoupdate run "${MOSTLOGIN_CLOUDFLARED_TUNNEL}"
