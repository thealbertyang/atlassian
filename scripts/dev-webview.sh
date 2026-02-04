#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
default_path="${root}/webview/login.html"

if [ -z "${ATLASSIAN_WEBVIEW_DEV_PATH:-}" ]; then
  export ATLASSIAN_WEBVIEW_DEV_PATH="${default_path}"
fi

echo "Webview dev path: ${ATLASSIAN_WEBVIEW_DEV_PATH}"
echo "Tip: set ATLASSIAN_WEBVIEW_DEV_PATH in .env.local for persistent use."

code-insiders --reuse-window --command atlassian.login >/dev/null 2>&1 || true

echo "Watching TypeScript output (tsgo --watch)."
echo "Use Developer: Reload Window when extension host code changes."
bun run watch
