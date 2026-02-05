#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${ATLASSIAN_WEBVIEW_DEV_PORT:-5173}"
URL="http://localhost:${PORT}"

if lsof -ti:"${PORT}" >/dev/null 2>&1; then
  if curl -fsS "${URL}/@vite/client" >/dev/null 2>&1; then
    if curl -fsS "${URL}/" | grep -q "atlassian-webview" >/dev/null 2>&1; then
      echo "Webview dev server already running at ${URL}"
      if [[ "${ATLASSIAN_WEBVIEW_DEV_KEEPALIVE:-}" == "1" ]]; then
        # Keep the task alive when used as a preLaunchTask
        tail -f /dev/null
      fi
      exit 0
    fi
  fi

  if [[ "${ATLASSIAN_WEBVIEW_DEV_FORCE_KILL:-}" == "1" ]]; then
    echo "Port ${PORT} is in use by another process. Stopping it..."
    pids=$(lsof -ti:"${PORT}" || true)
    if [[ -n "${pids}" ]]; then
      kill ${pids} >/dev/null 2>&1 || true
    fi
    for _ in {1..10}; do
      sleep 0.2
      if ! lsof -ti:"${PORT}" >/dev/null 2>&1; then
        break
      fi
    done
  else
    echo "Port ${PORT} is in use by another process."
    echo "Set ATLASSIAN_WEBVIEW_DEV_PORT to a free port or export ATLASSIAN_WEBVIEW_DEV_FORCE_KILL=1."
    exit 1
  fi
fi

WEBVIEW_DIR="${ROOT}/src/webview"
if [[ ! -d "${WEBVIEW_DIR}/node_modules" ]] || [[ ! -d "${WEBVIEW_DIR}/node_modules/@vitejs/plugin-react-swc" ]]; then
  echo "Installing webview dependencies..."
  bun install --cwd "${WEBVIEW_DIR}"
fi

echo "Starting webview dev server at ${URL}"
cd "${WEBVIEW_DIR}"
exec bunx vite -- --port "${PORT}" --strictPort
