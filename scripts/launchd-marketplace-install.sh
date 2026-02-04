#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
pkg="${root}/package.json"

publisher="$(node -p "require('${pkg}').publisher")"
name="$(node -p "require('${pkg}').name")"
version="$(node -p "require('${pkg}').version")"
target="${publisher}.${name}"

function get_installed_version() {
  local line
  line="$(code-insiders --list-extensions --show-versions 2>/dev/null | grep -i "^${target}@")" || true
  if [ -z "${line}" ]; then
    echo ""
    return
  fi
  echo "${line#*@}"
}

echo "Marketplace install check for ${target}@${version}"

code-insiders --install-extension "${target}@${version}" --force >/dev/null 2>&1 || true

installed="$(get_installed_version)"
if [ "${installed}" = "${version}" ]; then
  echo "Installed ${target}@${installed}"
  if [ "${LAUNCHD_SELF_DISABLE:-1}" = "1" ] && [ -n "${LAUNCHD_PLIST_PATH:-}" ]; then
    if command -v launchctl >/dev/null 2>&1; then
      launchctl bootout "gui/$(id -u)" "${LAUNCHD_PLIST_PATH}" 2>/dev/null || \
        launchctl unload -w "${LAUNCHD_PLIST_PATH}" 2>/dev/null || true
    fi
    rm -f "${LAUNCHD_PLIST_PATH}" 2>/dev/null || true
  fi
  exit 0
fi

echo "Still on ${installed:-none}; waiting for Marketplace to serve ${version}."
exit 0
