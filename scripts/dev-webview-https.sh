#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cert_dir="${root}/webview-ui/.certs"
cert_path="${cert_dir}/localhost.crt"
key_path="${cert_dir}/localhost.key"

mkdir -p "${cert_dir}"

if [ ! -f "${cert_path}" ] || [ ! -f "${key_path}" ]; then
  echo "Generating self-signed cert for localhost..."
  openssl req -x509 -newkey rsa:2048 -sha256 -nodes \
    -keyout "${key_path}" \
    -out "${cert_path}" \
    -days 365 \
    -subj "/CN=localhost"
fi

export ATLASSIAN_WEBVIEW_DEV_PROTOCOL=https
export ATLASSIAN_WEBVIEW_DEV_HOST=localhost
export ATLASSIAN_WEBVIEW_DEV_PORT="${ATLASSIAN_WEBVIEW_DEV_PORT:-5173}"
export ATLASSIAN_WEBVIEW_DEV_CERT="${cert_path}"
export ATLASSIAN_WEBVIEW_DEV_KEY="${key_path}"

echo "Webview dev server (HTTPS) starting..."
echo "Note: You may need to trust the cert in your OS keychain."

bun run dev:webview
