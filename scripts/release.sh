#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

CI=false
BUMP="patch"
for arg in "$@"; do
  case "$arg" in
    --ci)    CI=true ;;
    minor)   BUMP="minor" ;;
    patch)   BUMP="patch" ;;
  esac
done

# --- Version bump (local only) ---
if [[ "$CI" == "false" ]]; then
  OLD=$(jq -r .version package.json)
  IFS='.' read -r major minor patch <<< "$OLD"
  if [[ "$BUMP" == "minor" ]]; then
    minor=$((minor + 1)); patch=0
  else
    patch=$((patch + 1))
  fi
  NEW="${major}.${minor}.${patch}"
  jq --arg v "$NEW" '.version = $v' package.json > package.json.tmp \
    && mv package.json.tmp package.json
  echo "Bumped $OLD → $NEW"
fi

VERSION=$(jq -r .version package.json)

# --- Build + package ---
bun run build
bun run package

# --- Git commit + tag + push (local only) ---
if [[ "$CI" == "false" ]]; then
  git add package.json
  git commit -m "Release v${VERSION}"
  git tag -a "v${VERSION}" -m "Release v${VERSION}"
  git push && git push --tags
fi

# --- Publish ---
source .env.local 2>/dev/null || true
NODE_OPTIONS="--require ./scripts/patch-os-cpus.cjs" \
  bunx @vscode/vsce publish -p "$VSCE_PAT" --skip-duplicate

echo "Published v${VERSION}"
