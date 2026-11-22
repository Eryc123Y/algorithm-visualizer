#!/usr/bin/env bash
# Packs the files a GitHub release carries into release/, as 1.0.0-alpha.1
# did: the Typst package in the layout of a local package directory, the
# LaTeX package as CTAN takes it (one folder named after the package), and
# the player's files to host. The standalone executables come from the
# "Release files" workflow, one per platform. Build first:
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
rm -rf "$out"
mkdir -p "$out"

# The Typst package, unzipped into the Typst packages directory as
# local/algomotion/<version>/.
typst="$tmp/typst/local/algomotion/$typst_version"
mkdir -p "$typst"
for file in typst.toml lib.typ engine.bc plugin.wasm README.md LICENSE OFL.txt THIRD-PARTY-NOTICES.md; do
  cp "packages/typst/package/$file" "$typst/"
done
(cd "$tmp/typst" && zip -qr "$out/algomotion-typst-$typst_version.zip" local)

# The LaTeX package: algomotion.sty with its README and licence.
mkdir -p "$tmp/latex/algomotion"
cp packages/latex/package/algomotion.sty packages/latex/package/README.md \
  packages/latex/package/LICENSE "$tmp/latex/algomotion/"
(cd "$tmp/latex" && zip -qr "$out/algomotion-latex.zip" algomotion)

# The player as plain files: the bundle, the registry, their source maps,
# the fonts and the third-party notices.
mkdir -p "$tmp/player/algomotion-player"
cp -R packages/elements/dist/cdn/. "$tmp/player/algomotion-player/"
cp LICENSE "$tmp/player/algomotion-player/"
(cd "$tmp/player" && zip -qr "$out/algomotion-player-$npm_version.zip" algomotion-player)

ls -l "$out"
