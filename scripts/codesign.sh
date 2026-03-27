#!/usr/bin/env bash
# Code-signiert eTasks.app (optional: notarisiert)
# Voraussetzung: Apple Developer ID in Keychain
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$SCRIPT_DIR/.."
APP="$ROOT/release/eTasks.app"
DMG="$ROOT/release/eTasks-1.0.0.dmg"

# Developer Identity – anpassen oder als Env-Variable übergeben
IDENTITY="${CODESIGN_IDENTITY:-Developer ID Application: Unbekannt}"

if [ ! -d "$APP" ]; then
  echo "Fehler: $APP nicht gefunden. Zuerst ./scripts/build-mac.sh ausführen."
  exit 1
fi

echo "→ Signiere $APP …"
codesign --deep --force --verify --verbose \
  --sign "$IDENTITY" \
  --options runtime \
  "$APP"

echo "→ Verifiziere …"
codesign --verify --deep --strict "$APP" && echo "✓ Signierung OK"

# Notarisierung (optional) – nur wenn Zugangsdaten gesetzt sind
if [[ -n "${APPLE_ID:-}" && -n "${APPLE_TEAM_ID:-}" && -n "${APPLE_APP_PASSWORD:-}" ]]; then
  echo "→ Erstelle ZIP für Notarisierung …"
  ZIP="$ROOT/release/eTasks-notarize.zip"
  ditto -c -k --keepParent "$APP" "$ZIP"

  echo "→ Reiche zur Notarisierung ein …"
  xcrun notarytool submit "$ZIP" \
    --apple-id "$APPLE_ID" \
    --team-id "$APPLE_TEAM_ID" \
    --password "$APPLE_APP_PASSWORD" \
    --wait

  echo "→ Staple Notarisierungsticket …"
  xcrun stapler staple "$APP"

  echo "→ Signiere DMG …"
  codesign --sign "$IDENTITY" "$DMG"

  rm "$ZIP"
  echo "✓ Notarisierung abgeschlossen"
else
  echo "ℹ  APPLE_ID / APPLE_TEAM_ID / APPLE_APP_PASSWORD nicht gesetzt — Notarisierung übersprungen"
fi
