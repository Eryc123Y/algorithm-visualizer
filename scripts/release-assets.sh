#!/usr/bin/env bash
# Packs the files a GitHub release carries into release/, as 1.0.0-alpha.1
# did: the Typst package in the layout of a local package directory, and
# the player's files to host. The LaTeX package as CTAN takes it comes from
# scripts/ctan.sh, and the standalone executables from the "Release files"
# workflow, one per platform. Build first:
#
#     npm run build && scripts/release-assets.sh
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
npm_version="$(node -p "require('./packages/spec/package.json').version")"
typst_version="$(sed -n 's/^version = "\(.*\)"$/\1/p' packages/typst/package/typst.toml)"
out="$root/release"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

for built in packages/typst/package/engine.bc packages/elements/dist/cdn/algomotion-player.js packages/elements/dist/cdn/THIRD-PARTY-NOTICES.md; do
  [ -f "$built" ] || { echo "Missing $built: run npm run build first." >&2; exit 1; }
done
cmp -s THIRD-PARTY-NOTICES.md packages/typst/package/THIRD-PARTY-NOTICES.md || {
  echo "packages/typst/package/THIRD-PARTY-NOTICES.md differs from THIRD-PARTY-NOTICES.md: copy it." >&2
  exit 1
}
cmp -s THIRD-PARTY-NOTICES.md packages/elements/dist/cdn/THIRD-PARTY-NOTICES.md || {
  echo "The player's THIRD-PARTY-NOTICES.md is older than the root file: run npm run build again." >&2
  exit 1
}
# Only this script's archives are replaced: the LaTeX archive comes from
# scripts/ctan.sh, which needs TeX, and the Typst Universe layout from
# scripts/typst-universe.sh.
mkdir -p "$out"
rm -f "$out"/algomotion-typst-*.zip "$out"/algomotion-player-*.zip

# The Typst package, unzipped into the Typst packages directory as
# local/algomotion/<version>/.
typst="$tmp/typst/local/algomotion/$typst_version"
mkdir -p "$typst"
for file in typst.toml lib.typ engine.bc plugin.wasm README.md LICENSE OFL.txt THIRD-PARTY-NOTICES.md; do
  cp "packages/typst/package/$file" "$typst/"
done
(cd "$tmp/typst" && zip -qr "$out/algomotion-typst-$typst_version.zip" local)

# The player as plain files: the bundle, the registry, their source maps,
# the fonts and the third-party notices.
mkdir -p "$tmp/player/algomotion-player"
cp -R packages/elements/dist/cdn/. "$tmp/player/algomotion-player/"
cp LICENSE "$tmp/player/algomotion-player/"
(cd "$tmp/player" && zip -qr "$out/algomotion-player-$npm_version.zip" algomotion-player)

ls -l "$out"
