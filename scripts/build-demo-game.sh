#!/usr/bin/env bash
# Builds mnt/games/demo/bundle.jsdos from the sources in demo-game/ (needs Docker).
set -euo pipefail
cd "$(dirname "$0")/.."
out=mnt/games/demo
mkdir -p "$out"
docker run --rm -e HOST_UID="$(id -u)" -e HOST_GID="$(id -g)" -v "$PWD:/w" -w /w alpine:3.22 sh -euc '
  apk add --no-cache nasm zip >/dev/null
  tmp=$(mktemp -d)
  nasm -f bin -o "$tmp/DEMO.COM" demo-game/demo.asm
  mkdir -p "$tmp/.jsdos"
  cp demo-game/dosbox.conf "$tmp/.jsdos/dosbox.conf"
  # Fixed timestamps so rebuilding produces an identical bundle
  find "$tmp" -exec touch -d "2026-01-01 00:00:00" {} +
  rm -f mnt/games/demo/bundle.jsdos
  (cd "$tmp" && zip -X -q -r /w/mnt/games/demo/bundle.jsdos .jsdos DEMO.COM)
  chown "$HOST_UID:$HOST_GID" mnt/games/demo/bundle.jsdos
'
echo "Built $out/bundle.jsdos ($(wc -c < "$out/bundle.jsdos") bytes)"
