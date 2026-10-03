#!/usr/bin/env bash
# Build FPS Boost on Linux: resources (icon, manifest, version) → Windows exe → NSIS installer.
#   bash scripts/build.sh            → dist/fpsboost.exe + dist/FPSBoost-Setup.exe
#   bash scripts/build.sh exe        → just the exe
# Needs: Go (/usr/local/go), go-winres (~/go/bin), electron-builder's makensis cache (~/.cache/electron-builder/nsis-*).
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$PATH:/usr/local/go/bin:$HOME/go/bin"
VER=$(tr -d ' \n' < VERSION)
mkdir -p dist
echo "== FPS Boost $VER"

# 1. resources: icon + requireAdministrator / per-monitor DPI manifest + version info → rsrc_windows_amd64.syso
sed "s/__VERSION__/$VER/g" build/winres.json > build/winres.gen.json
(cd build && go-winres make --in winres.gen.json --out ../rsrc --arch amd64)
rm -f build/winres.gen.json

# 2. the exe (no cgo, GUI subsystem, stripped)
CGO_ENABLED=0 GOOS=windows GOARCH=amd64 go build -trimpath -ldflags "-s -w -H windowsgui -X fpsboost.ir/app/internal/config.Version=$VER" -o dist/fpsboost.exe .
rm -f rsrc_windows_amd64.syso
ls -la dist/fpsboost.exe
[ "${1:-}" = "exe" ] && exit 0

# 3. the installer
MAKENSIS=$(ls -d "$HOME"/.cache/electron-builder/nsis-*/nsis-*/linux/makensis 2>/dev/null | head -1)
NSISDIR=$(dirname "$(dirname "$MAKENSIS")")
[ -x "$MAKENSIS" ] || { echo "makensis not found (electron-builder nsis cache)"; exit 1; }
cd build
NSISDIR="$NSISDIR" "$MAKENSIS" -INPUTCHARSET UTF8 -DVERSION="$VER" -V2 installer.nsi
cd ..
ls -la dist/FPSBoost-Setup.exe
sha256sum dist/FPSBoost-Setup.exe
