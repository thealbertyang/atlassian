#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
url_file="${root}/.webview-dev-url"

host="${ATLASSIAN_WEBVIEW_DEV_HOST:-localhost}"
protocol="${ATLASSIAN_WEBVIEW_DEV_PROTOCOL:-http}"
base_port="${ATLASSIAN_WEBVIEW_DEV_PORT:-5173}"
max_port="${ATLASSIAN_WEBVIEW_DEV_PORT_MAX:-5190}"

is_free() {
  local port="$1"
  node -e "const net=require('net');const s=net.createServer();s.once('error',()=>process.exit(1));s.listen(${port},'127.0.0.1',()=>{s.close(()=>process.exit(0));});"
}

port="${base_port}"
while [ "${port}" -le "${max_port}" ]; do
  if is_free "${port}"; then
    break
  fi
  port=$((port + 1))
done

if [ "${port}" -gt "${max_port}" ]; then
  echo "No free port found between ${base_port}-${max_port}."
  exit 1
fi

url="${protocol}://${host}:${port}"
echo "${url}" > "${url_file}"
echo "Webview dev URL: ${url}"
echo "Wrote ${url_file}"

cleanup() {
  rm -f "${url_file}" 2>/dev/null || true
}
trap cleanup EXIT

export ATLASSIAN_WEBVIEW_DEV_SERVER_URL="${url}"
if [ "${protocol}" = "https" ]; then
  export ATLASSIAN_WEBVIEW_DEV_HTTPS=1
fi

vite --config webview-ui/vite.config.ts
