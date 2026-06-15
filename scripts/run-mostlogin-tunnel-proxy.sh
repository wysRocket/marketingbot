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

: "${MOSTLOGIN_API_KEY:?MOSTLOGIN_API_KEY is required}"
: "${MOSTLOGIN_TUNNEL_BEARER:?MOSTLOGIN_TUNNEL_BEARER is required}"

export MOSTLOGIN_HOST="${MOSTLOGIN_HOST:-127.0.0.1:30898}"
export MOSTLOGIN_TUNNEL_PORT="${MOSTLOGIN_TUNNEL_PORT:-30908}"

cd "${REPO_ROOT}"
exec npm run start:mostlogin:tunnel-proxy
