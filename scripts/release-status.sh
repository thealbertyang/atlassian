#!/usr/bin/env bash
set -euo pipefail

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI not found. Install GitHub CLI to view Actions status."
  exit 1
fi

echo "Latest Release workflow runs:"
gh run list -w "Release VS Code Extension" -L 5

run_id="$(gh run list -w "Release VS Code Extension" -L 1 --json databaseId -q '.[0].databaseId' 2>/dev/null || true)"
if [ -z "${run_id}" ]; then
  echo "No run found yet."
  exit 0
fi

gh run watch "${run_id}" --compact || true
