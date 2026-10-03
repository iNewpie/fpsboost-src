#!/usr/bin/env bash
# Authenticode-sign one Windows exe in place (osslsigncode). A no-op without a certificate, so unsigned builds still work.
#   SIGN_PFX   path to the code-signing certificate (.pfx / .p12)          — required to sign
#   SIGN_PASS  its password (empty if none)
#   SIGN_TS    RFC 3161 timestamp server (default DigiCert) — keeps the signature valid after the certificate expires
# build.sh calls this for dist/fpsboost.exe; installer.nsi calls it (via SIGN_CMD) for the installer and the uninstaller.
set -euo pipefail
f=${1:?file}
[ -n "${SIGN_PFX:-}" ] || exit 0
[ -f "$SIGN_PFX" ] || { echo "SIGN_PFX not found: $SIGN_PFX" >&2; exit 1; }
tmp="$f.signed"
osslsigncode sign -pkcs12 "$SIGN_PFX" ${SIGN_PASS:+-pass "$SIGN_PASS"} -n "FPS Boost" -i "https://fpsboost.ir" \
  -h sha256 -ts "${SIGN_TS:-http://timestamp.digicert.com}" -in "$f" -out "$tmp" >/dev/null
mv -f "$tmp" "$f"
# presence check only: "verify" also judges trust, which a self-signed test certificate would fail
sig=$(mktemp); rm -f "$sig"
osslsigncode extract-signature -in "$f" -out "$sig" >/dev/null 2>&1 && echo "signed $f" || { echo "no signature on $f" >&2; exit 1; }
rm -f "$sig"
