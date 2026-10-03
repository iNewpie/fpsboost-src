#!/usr/bin/env bash
# Build FPS Boost on Linux: resources (icon, manifest, version) → Windows exe → NSIS installer.
#   bash scripts/build.sh            → dist/fpsboost.exe + dist/FPSBoost-Setup.exe
#   bash scripts/build.sh exe        → just the exe
#   bash scripts/build.sh nsis       → just the installer (dist/fpsboost.exe must exist)
# Needs: Go (/usr/local/go), go-winres (~/go/bin), makensis (apt nsis ≥ 3.08; falls back to electron-builder's cache).
# Code signing: SIGN_PFX / SIGN_PASS (certificate file) or SIGN_JSIGN (cloud signing) in app/.sign.env — see SIGNING.md.
# Without a certificate the build is simply unsigned.
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$PATH:/usr/local/go/bin:$HOME/go/bin"
[ -f .sign.env ] && { set -a; . ./.sign.env; set +a; }
VER=$(tr -d ' \n' < VERSION)
mkdir -p dist
echo "== FPS Boost $VER$( [ -n "${SIGN_PFX:-}${SIGN_JSIGN:-}" ] && echo " (signed)")"

if [ "${1:-}" != "nsis" ]; then
# 1. resources: icon + requireAdministrator / per-monitor DPI manifest + version info → rsrc_windows_amd64.syso
sed "s/__VERSION__/$VER/g" build/winres.json > build/winres.gen.json
(cd build && go-winres make --in winres.gen.json --out ../rsrc --arch amd64)
rm -f build/winres.gen.json

# 2. the exe (no cgo, GUI subsystem, stripped)
CGO_ENABLED=0 GOOS=windows GOARCH=amd64 go build -trimpath -ldflags "-w -H windowsgui -X fpsboost.ir/app/internal/config.Version=$VER" -o dist/fpsboost.exe .
rm -f rsrc_windows_amd64.syso
bash scripts/sign.sh dist/fpsboost.exe
ls -la dist/fpsboost.exe
[ "${1:-}" = "exe" ] && exit 0
fi

# 3. the installer — the system NSIS (3.09, current stubs) first; electron-builder's 2019 build only as a fallback
if command -v makensis >/dev/null; then
  MAKENSIS=makensis; NSISDIR=""
else
  MAKENSIS=$(ls -d "$HOME"/.cache/electron-builder/nsis-*/nsis-*/linux/makensis 2>/dev/null | head -1)
  [ -x "$MAKENSIS" ] || { echo "makensis not found (apt install nsis)"; exit 1; }
  NSISDIR=$(dirname "$(dirname "$MAKENSIS")")
fi
SIGN=()
[ -n "${SIGN_PFX:-}${SIGN_JSIGN:-}" ] && SIGN=(-DSIGN_CMD="bash $PWD/scripts/sign.sh")   # installer.nsi signs the installer + uninstaller with it
cd build
${NSISDIR:+NSISDIR="$NSISDIR"} "$MAKENSIS" -INPUTCHARSET UTF8 -DVERSION="$VER" "${SIGN[@]}" -V2 installer.nsi
cd ..
ls -la dist/FPSBoost-Setup.exe
sha256sum dist/FPSBoost-Setup.exe
