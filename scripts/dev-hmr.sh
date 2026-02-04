#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

export ATLASSIAN_WEBVIEW_DEV_SERVER_URL="${ATLASSIAN_WEBVIEW_DEV_SERVER_URL:-http://localhost:5173}"
if [[ "${ATLASSIAN_WEBVIEW_DEV_SERVER_URL}" == https://* ]]; then
  export ATLASSIAN_WEBVIEW_DEV_HTTPS=1
fi

echo "Starting Vite dev server at ${ATLASSIAN_WEBVIEW_DEV_SERVER_URL}"
echo "Starting tsgo watch"

bun run dev:webview &
vite_pid=$!

cleanup() {
  if kill -0 "${vite_pid}" >/dev/null 2>&1; then
    kill "${vite_pid}" || true
  fi
}
trap cleanup EXIT

code-insiders --reuse-window --command atlassian.login >/dev/null 2>&1 || true

bun run watch
