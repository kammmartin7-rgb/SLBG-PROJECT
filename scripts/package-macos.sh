#!/bin/bash
set -eu
cd "$(dirname "$0")/.."
test -f dist/renderer/index.html || { echo 'Run pnpm build:web first.' >&2; exit 1; }
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT
cp desktop/package.json desktop/main.cjs desktop/preload.cjs desktop/device-tools.cjs desktop/code-workspace.cjs LICENSE THIRD_PARTY_NOTICES.md "$stage/"
node_modules/.bin/esbuild desktop/math.mjs --bundle --platform=node --format=cjs --outfile="$stage/math.cjs"
node_modules/.bin/esbuild desktop/connections.cjs --bundle --platform=node --external:electron --outfile="$stage/connections.cjs"
node_modules/.bin/esbuild desktop/fast-chat.cjs --bundle --platform=node --outfile="$stage/fast-chat.cjs"
node_modules/.bin/esbuild desktop/metis.cjs --bundle --platform=node --outfile="$stage/metis.cjs"
cp desktop/vendor/ethers/LICENSE* "$stage/ethers-license.txt"
cp desktop/discrete.py "$stage/"
cp -R dist/renderer "$stage/renderer"
# Keep the packaging tool outside the app bundle.
packager="${YACHIYO_PACKAGER:-$PWD/.tools/desktop/node_modules/.bin/electron-packager}"
if [ -d "$PWD/.cache/math-wheels" ]; then
  math_root=$(mktemp -d)
  trap 'rm -rf "$stage" "$math_root"' EXIT
  mkdir "$math_root/math-libraries"
  for wheel in "$PWD/.cache/math-wheels/"*.whl; do
    unzip -q -o "$wheel" -d "$math_root/math-libraries"
  done
  set -- "--extra-resource=$math_root/math-libraries" "$@"
fi
"$packager" "$stage" 'Hacker Tool' --platform=darwin --arch="${YACHIYO_ARCH:-$(node -p 'process.arch')}" \
  '--asar.unpack={math.cjs,discrete.py}' --electron-version=45.4.1 --app-bundle-id=io.github.yachiyoclaw.desktop \
  --out="${YACHIYO_OUTPUT:-$PWD/dist/desktop}" --overwrite "$@"
