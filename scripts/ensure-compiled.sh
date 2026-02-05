#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENTRY="${ROOT}/out/extension/extension.js"

if [[ -f "${ENTRY}" ]]; then
  exit 0
fi

echo "Compiled extension not found. Running bun run build:ext..."
cd "${ROOT}"
exec bun run build:ext
