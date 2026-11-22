#!/usr/bin/env bash
# Lays the Typst package out as a pull request to Typst Universe adds it,
# packages/preview/algomotion/<version>/ in a clone of typst/packages, and
# checks it with Typst's own linter, typst-package-check
# (docs/releasing.md). Build engine.bc first:
#
#     npm run build -w @algomotion/typst && scripts/typst-universe.sh [dir]
#
# `dir` is the clone, or any directory to lay it out in, and defaults to
# release/universe. The check runs typst-package-check from PATH, or its
# Docker image. It fails on every diagnostic but the size warnings of
# plugin.wasm and engine.bc, which the submission explains: they are the
# engine (ADR 0026).
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
CHECKER_IMAGE="ghcr.io/typst/package-check:0.7.0"
manifest=packages/typst/package/typst.toml
name="$(sed -n 's/^name = "\(.*\)"$/\1/p' "$manifest")"
version="$(sed -n 's/^version = "\(.*\)"$/\1/p' "$manifest")"
clone="${1:-$root/release/universe}"
mkdir -p "$clone"
clone="$(cd "$clone" && pwd)"
target="$clone/packages/preview/$name/$version"

[ -f packages/typst/package/engine.bc ] || {
  echo "Missing engine.bc: run npm run build -w @algomotion/typst first." >&2
  exit 1
}
rm -rf "$target"
mkdir -p "$target"
for file in typst.toml lib.typ engine.bc plugin.wasm README.md LICENSE OFL.txt; do
  cp "packages/typst/package/$file" "$target/"
done
echo "Laid out $target"

spec="@preview/$name:$version"
diagnostics="$(mktemp)"
trap 'rm -f "$diagnostics"' EXIT
# The checker finds `packages/` in PACKAGES_DIR, or else in GITHUB_WORKSPACE
# or the parent of the working directory, so it is always given. It exits
# with 0 when it has nothing to say, 2 for warnings only and 1 for errors or
# when it cannot check; the diagnostics are judged below.
status=0
if command -v typst-package-check > /dev/null; then
  PACKAGES_DIR="$clone" typst-package-check check --json "$spec" > "$diagnostics" || status=$?
elif command -v docker > /dev/null; then
  docker run --rm -v "$clone:/data:ro" -e PACKAGES_DIR=/data \
    "$CHECKER_IMAGE" check --json "$spec" > "$diagnostics" || status=$?
else
  echo "Install typst-package-check or Docker to check the package." >&2
  exit 1
fi
case "$status" in
  0 | 1 | 2) ;;
  *)
    cat "$diagnostics" >&2
    echo "typst-package-check failed with $status." >&2
    exit 1
    ;;
esac

node - "$diagnostics" "$status" <<'EOF'
const { readFileSync } = require('node:fs');
const [file, status] = process.argv.slice(2);
const lines = readFileSync(file, 'utf8').split('\n').filter(Boolean);
const parse = (line) => {
  try {
    return JSON.parse(line);
  } catch {
    // Not a diagnostic, such as "Fatal error: …".
    return { kind: 'error', code: 'output', message: line };
  }
};
const all = lines.map(parse);
const expected = (d) =>
  d.kind === 'warning' &&
  d.code === 'size/large' &&
  ['plugin.wasm', 'engine.bc'].includes(d.location?.file);
const left = all.filter((d) => !expected(d));
for (const d of all)
  console.log(`${expected(d) ? 'expected' : d.kind}: ${d.code} ${d.location?.file ?? ''}`);
if (lines.length === 0) console.log('No diagnostics.');
for (const d of left) console.error(`\n${d.kind} ${d.code}:\n${d.message}`);
if (left.length > 0 || status === '1') process.exit(1);
EOF
