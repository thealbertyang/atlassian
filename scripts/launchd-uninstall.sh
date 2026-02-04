#!/usr/bin/env bash
set -euo pipefail

label="com.albertyang.atlassian-sprint-view.marketplace"
plist_path="${HOME}/Library/LaunchAgents/${label}.plist"

if [ -f "${plist_path}" ]; then
  launchctl bootout "gui/$(id -u)" "${plist_path}" 2>/dev/null || \
    launchctl unload -w "${plist_path}" 2>/dev/null || true
  rm -f "${plist_path}"
  echo "LaunchAgent removed: ${plist_path}"
else
  echo "LaunchAgent not found: ${plist_path}"
fi
