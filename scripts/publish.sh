#!/usr/bin/env bash
# Publishes library packages to npm under a dist-tag (default alpha), from a
# clean build, so no file left by an older build ships. With no names, it
# publishes all eight, in dependency order. npm asks to authenticate each one.
#
#     TAG=alpha scripts/publish.sh [package …]
set -euo pipefail
tag="${TAG:-alpha}"
cd "$(dirname "$0")/.."
packages=("$@")
[ ${#packages[@]} -gt 0 ] || packages=(spec fonts core svg tikz recipes elements mcp)
for p in "${packages[@]}"; do rm -rf "packages/$p/dist"; done
npm run build
for p in "${packages[@]}"; do
  (cd "packages/$p" && npm publish --tag "$tag" --access public)
done
