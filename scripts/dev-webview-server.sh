#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
url_file="${root}/.webview-dev-url"

host="${ATLASSIAN_WEBVIEW_DEV_HOST:-localhost}"
protocol="${ATLASSIAN_WEBVIEW_DEV_PROTOCOL:-http}"
base_port="${ATLASSIAN_WEBVIEW_DEV_PORT:-5173}"
max_port="${ATLASSIAN_WEBVIEW_DEV_PORT_MAX:-5190}"

ping_url() {
  local url="$1"
  if [ -z "${url}" ]; then
    return 1
  fi
  if command -v curl >/dev/null 2>&1; then
    if [[ "${url}" == https://* ]]; then
      curl -k -s --max-time 1 "${url}" >/dev/null 2>&1
    else
      curl -s --max-time 1 "${url}" >/dev/null 2>&1
    fi
  else
    return 1
  fi
}

is_free() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    if lsof -nP -iTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1; then
      return 1
    fi
  fi
  node -e "const net=require('net');const s=net.createServer();s.once('error',()=>process.exit(1));s.listen(${port},'0.0.0.0',()=>{s.close(()=>process.exit(0));});"
}

# Reuse explicit URL if it's already running.
if [ -n "${ATLASSIAN_WEBVIEW_DEV_SERVER_URL:-}" ]; then
  if ping_url "${ATLASSIAN_WEBVIEW_DEV_SERVER_URL}"; then
    echo "Reusing dev server at ${ATLASSIAN_WEBVIEW_DEV_SERVER_URL}"
    echo "${ATLASSIAN_WEBVIEW_DEV_SERVER_URL}" > "${url_file}"
    exit 0
  fi
fi

# Reuse last URL if it's still running.
if [ -f "${url_file}" ]; then
  existing_url="$(cat "${url_file}" | tr -d '\n' | tr -d '\r')"
  if ping_url "${existing_url}"; then
    echo "Reusing dev server at ${existing_url}"
    exit 0
  fi
  rm -f "${url_file}" 2>/dev/null || true
fi

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
