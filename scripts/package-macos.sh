#!/bin/bash
set -eu
cd "$(dirname "$0")/.."
test -f dist/renderer/index.html || { echo 'Run pnpm build:web first.' >&2; exit 1; }
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT
cp desktop/package.json desktop/main.cjs desktop/preload.cjs LICENSE THIRD_PARTY_NOTICES.md "$stage/"
node_modules/.bin/esbuild desktop/math.mjs --bundle --platform=node --format=cjs --outfile="$stage/math.cjs"
node_modules/.bin/esbuild desktop/connections.cjs --bundle --platform=node --external:electron --outfile="$stage/connections.cjs"
node_modules/.bin/esbuild desktop/fast-chat.cjs --bundle --platform=node --outfile="$stage/fast-chat.cjs"
cp -R dist/renderer "$stage/renderer"
# Keep the packaging tool outside the app bundle.
packager="${YACHIYO_PACKAGER:-$PWD/.tools/desktop/node_modules/.bin/electron-packager}"
"$packager" "$stage" 'Yachiyo Claw' --platform=darwin --arch="${YACHIYO_ARCH:-$(node -p 'process.arch')}" \
  --asar.unpack=math.cjs --electron-version=45.4.1 --app-bundle-id=io.github.yachiyoclaw.desktop \
  --out="$PWD/dist/desktop" --overwrite "$@"
