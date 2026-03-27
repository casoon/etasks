#!/usr/bin/env bash
set -euo pipefail

APP_NAME="eTasks"
BUNDLE_ID="js.neutralino.etasks"
VERSION="1.0.0"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$ROOT/dist/etasks"
RELEASE="$ROOT/release"

ARCH="$(uname -m)"
if [ "$ARCH" = "arm64" ]; then
  BINARY="etasks-mac_arm64"
else
  BINARY="etasks-mac_x64"
fi

echo "→ Generating app icon..."
if [ ! -f "$ROOT/assets/etasks.icns" ]; then
  bash "$ROOT/scripts/create-icon.sh" || echo "  Icon-Generierung übersprungen (rsvg-convert fehlt)"
fi
if [ -f "$ROOT/assets/etasks.icns" ] && [ ! -f "$ROOT/assets/icon.icns" ]; then
  cp "$ROOT/assets/etasks.icns" "$ROOT/assets/icon.icns"
fi

echo "→ Building Astro UI..."
(cd "$ROOT/ui" && npm run build)

echo "→ Building Neutralino binaries..."
(cd "$ROOT" && node_modules/.bin/neu build)

echo "→ Creating .app bundle..."
APP_DIR="$RELEASE/$APP_NAME.app"
rm -rf "$APP_DIR"
mkdir -p "$APP_DIR/Contents/MacOS"
mkdir -p "$APP_DIR/Contents/Resources"

# Copy binary
cp "$DIST/$BINARY" "$APP_DIR/Contents/MacOS/etasks"
chmod +x "$APP_DIR/Contents/MacOS/etasks"

# Copy resources bundle
cp "$DIST/resources.neu" "$APP_DIR/Contents/Resources/resources.neu"

# Copy icon if present
if [ -f "$ROOT/assets/icon.icns" ]; then
  cp "$ROOT/assets/icon.icns" "$APP_DIR/Contents/Resources/icon.icns"
fi

# Write Info.plist
ICON_LINE=""
if [ -f "$APP_DIR/Contents/Resources/icon.icns" ]; then
  ICON_LINE="  <key>CFBundleIconFile</key>
  <string>icon</string>"
fi

cat > "$APP_DIR/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>etasks</string>
  <key>CFBundleIdentifier</key>
  <string>$BUNDLE_ID</string>
  <key>CFBundleName</key>
  <string>$APP_NAME</string>
  <key>CFBundleDisplayName</key>
  <string>$APP_NAME</string>
  <key>CFBundleVersion</key>
  <string>$VERSION</string>
  <key>CFBundleShortVersionString</key>
  <string>$VERSION</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleSignature</key>
  <string>????</string>
  <key>NSHighResolutionCapable</key>
  <true/>
  <key>NSHumanReadableCopyright</key>
  <string>Copyright © 2026</string>
  $ICON_LINE
</dict>
</plist>
PLIST

echo "→ Creating DMG..."
DMG="$RELEASE/$APP_NAME-$VERSION.dmg"
DMG_TMP="$RELEASE/dmg-tmp"

rm -rf "$DMG_TMP" "$DMG"
mkdir -p "$DMG_TMP"
cp -R "$APP_DIR" "$DMG_TMP/"

# Symlink to /Applications
ln -s /Applications "$DMG_TMP/Applications"

hdiutil create \
  -volname "$APP_NAME" \
  -srcfolder "$DMG_TMP" \
  -ov \
  -format UDZO \
  -imagekey zlib-level=9 \
  "$DMG"

rm -rf "$DMG_TMP"

echo ""
echo "✓ Build fertig!"
echo "  App:  $APP_DIR"
echo "  DMG:  $DMG"
