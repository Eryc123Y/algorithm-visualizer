#!/usr/bin/env bash
# Lays the LaTeX package out as CTAN takes it, one folder named after the
# package with the handwritten .sty, the README, the licence, the manual
# and its source, packs it into release/algomotion-latex.zip, and checks it
# with CTAN's pkgcheck (docs/releasing.md). After `npm ci`, with latexmk
# and LuaLaTeX:
#
#     scripts/ctan.sh [--no-check]
#
# It builds the manual first (npm run build:doc -w @algomotion/latex), so
# the PDF is the checkout's. The check runs pkgcheck from PATH, or the
# program PKGCHECK names; --no-check packs without it.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
check=true
for arg in "$@"; do
  case "$arg" in
    --no-check) check=false ;;
    *)
      echo "Unknown argument $arg" >&2
      exit 1
      ;;
  esac
done
# PKGCHECK may be relative to where the script is run from, so it is made
# absolute before the script moves to the repository.
pkgcheck="${PKGCHECK:-pkgcheck}"
if [ "$check" = true ]; then
  found="$(command -v "$pkgcheck" || true)"
  [ -n "$found" ] || {
    echo "pkgcheck is missing: get it from https://ctan.org/pkg/pkgcheck, or pass --no-check." >&2
    exit 1
  }
  case "$found" in
    /*) pkgcheck="$found" ;;
    *) pkgcheck="$PWD/$found" ;;
  esac
fi
cd "$root"

npm run build:doc -w @algomotion/latex > /dev/null
out="$root/release"
layout="$out/ctan"
archive="$out/algomotion-latex.zip"
rm -rf "$layout" "$archive"
mkdir -p "$layout/algomotion"
for file in algomotion.sty README.md LICENSE algomotion-doc.tex; do
  cp "packages/latex/package/$file" "$layout/algomotion/"
done
cp packages/latex/dist/algomotion-doc.pdf "$layout/algomotion/"
# CTAN wants world-readable files, none of them executable.
chmod 644 "$layout"/algomotion/*
(cd "$layout" && zip -qrX "$archive" algomotion)
echo "Packed $archive"

if [ "$check" = true ]; then
  (cd "$layout" && "$pkgcheck" -d algomotion)
fi
