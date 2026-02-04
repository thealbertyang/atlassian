#!/usr/bin/env bash
set -euo pipefail

bump_type="${1:-patch}"

if [ -n "$(git status --porcelain)" ]; then
  echo "Working tree not clean. Commit or stash changes before running a release."
  exit 1
fi

node ./scripts/bump-version.js "$bump_type"

bun run lint:fix
bun run fmt
bun run compile

git add package.json out

version="$(node -p "require('./package.json').version")"
default_msg="Release v${version}"

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

git commit -m "${msg}"
git push

bun run publish
bun run release:tag
