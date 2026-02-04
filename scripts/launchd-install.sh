#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
label="com.albertyang.atlassian-sprint-view.marketplace"
plist_dir="${HOME}/Library/LaunchAgents"
plist_path="${plist_dir}/${label}.plist"
script_path="${root}/scripts/launchd-marketplace-install.sh"
log_path="${HOME}/Library/Logs/atlassian-sprint-view-marketplace.log"
err_path="${HOME}/Library/Logs/atlassian-sprint-view-marketplace.err.log"

mkdir -p "${plist_dir}"

cat > "${plist_path}" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>${label}</string>
    <key>ProgramArguments</key>
    <array>
      <string>/bin/bash</string>
      <string>${script_path}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>StartInterval</key>
    <integer>120</integer>
    <key>WorkingDirectory</key>
    <string>${root}</string>
    <key>StandardOutPath</key>
    <string>${log_path}</string>
    <key>StandardErrorPath</key>
    <string>${err_path}</string>
    <key>EnvironmentVariables</key>
    <dict>
      <key>PATH</key>
      <string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
      <key>LAUNCHD_PLIST_PATH</key>
      <string>${plist_path}</string>
      <key>LAUNCHD_SELF_DISABLE</key>
      <string>1</string>
    </dict>
  </dict>
</plist>
PLIST

launchctl bootout "gui/$(id -u)" "${plist_path}" 2>/dev/null || \
  launchctl unload -w "${plist_path}" 2>/dev/null || true

launchctl bootstrap "gui/$(id -u)" "${plist_path}" 2>/dev/null || \
  launchctl load -w "${plist_path}"

echo "LaunchAgent installed: ${plist_path}"
echo "Logs: ${log_path}"
