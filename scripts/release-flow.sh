#!/usr/bin/env bash
set -euo pipefail

bump_type="${1:-patch}"

echo "==> Step 1/7: Ensure clean working tree"
if [ -n "$(git status --porcelain)" ]; then
  echo "Working tree not clean. Commit or stash changes before running a release."
  exit 1
fi

echo "==> Step 2/7: Bump version ($bump_type)"
node ./scripts/bump-version.js "$bump_type"

echo "==> Step 3/7: Lint, format, compile"
bun run lint:fix
bun run fmt
bun run compile

git add package.json out

version="$(node -p "require('./package.json').version")"
default_msg="Release v${version}"

echo "==> Step 4/7: Review recent commits + status"
echo ""
echo "Recent commits:"
git log -5 --oneline
echo ""
git status -sb
echo ""

read -r -p "Commit message [${default_msg}]: " msg
if [ -z "${msg}" ]; then
  msg="${default_msg}"
fi

echo "==> Step 5/7: Commit + push"
git commit -m "${msg}"
git push

echo "==> Step 6/7: Publish + install"
bun run publish
bun run release:tag

echo "==> Step 7/7: GitHub Actions status"
if command -v gh >/dev/null 2>&1; then
  run_id=""
  for _ in 1 2 3 4 5; do
    run_id="$(gh run list -w "Release VS Code Extension" -L 1 --json databaseId -q '.[0].databaseId' 2>/dev/null || true)"
    if [ -n "${run_id}" ]; then
      break
    fi
    sleep 3
  done

  if [ -n "${run_id}" ]; then
    gh run watch "${run_id}" --compact || true
  else
    echo "No workflow run found yet. Check later with: gh run list -w \"Release VS Code Extension\" -L 5"
  fi
else
  echo "gh CLI not found. Skipping status checks."
fi
