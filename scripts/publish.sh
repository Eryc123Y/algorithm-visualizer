#!/usr/bin/env bash
# Publishes library packages to npm under a dist-tag, from a clean build, so
# no file left by an older build ships. The tag follows the version: a
# prerelease such as 1.0.0-alpha.2 goes under its own word (alpha), a
# release under latest; TAG overrides it. With no names, it publishes all
# eight, in dependency order. npm asks to authenticate each one.
#
#     [TAG=next] scripts/publish.sh [package …]
set -euo pipefail
cd "$(dirname "$0")/.."
version="$(node -p "require('./packages/spec/package.json').version")"
case "$version" in
  *-*) prerelease="${version#*-}"; default="${prerelease%%.*}" ;;
  *) default=latest ;;
esac
tag="${TAG:-$default}"
echo "Publishing $version under the tag $tag."
packages=("$@")
[ ${#packages[@]} -gt 0 ] || packages=(spec fonts core svg tikz recipes elements mcp)
for p in "${packages[@]}"; do rm -rf "packages/$p/dist"; done
npm run build
for p in "${packages[@]}"; do
  (cd "packages/$p" && npm publish --tag "$tag" --access public)
done
