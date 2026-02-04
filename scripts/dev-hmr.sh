#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Starting Vite dev server"
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
