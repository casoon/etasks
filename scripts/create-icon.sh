#!/usr/bin/env bash
# Erzeugt ein ICNS aus assets/icon.svg
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$SCRIPT_DIR/.."
SVG="$ROOT/assets/icon.svg"
ICONSET="$ROOT/assets/etasks.iconset"
ICNS="$ROOT/assets/etasks.icns"

# SVG → 1024×1024 PNG via sips (macOS) oder qlmanage
if command -v rsvg-convert &>/dev/null; then
  rsvg-convert -w 1024 -h 1024 "$SVG" -o "$ROOT/assets/icon_1024.png"
elif command -v qlmanage &>/dev/null; then
  qlmanage -t -s 1024 -o "$ROOT/assets/" "$SVG" >/dev/null 2>&1 || true
  mv "$ROOT/assets/icon.svg.png" "$ROOT/assets/icon_1024.png" 2>/dev/null || \
    { echo "Bitte icon_1024.png manuell aus icon.svg erzeugen."; exit 1; }
else
  echo "Bitte rsvg-convert installieren: brew install librsvg"
  exit 1
fi

SRC="$ROOT/assets/icon_1024.png"

mkdir -p "$ICONSET"

for size in 16 32 64 128 256 512 1024; do
  sips -z $size $size "$SRC" --out "$ICONSET/icon_${size}x${size}.png" >/dev/null
done

# @2x Varianten
for size in 16 32 64 128 256 512; do
  double=$((size * 2))
  cp "$ICONSET/icon_${double}x${double}.png" "$ICONSET/icon_${size}x${size}@2x.png"
done

iconutil -c icns "$ICONSET" -o "$ICNS"
echo "✓ ICNS erzeugt: $ICNS"
