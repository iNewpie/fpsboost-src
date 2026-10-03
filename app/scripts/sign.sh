#!/usr/bin/env bash
# Authenticode-sign one Windows exe in place. A no-op without signing credentials, so unsigned builds still work.
# build.sh calls this for dist/fpsboost.exe; installer.nsi calls it (via SIGN_CMD) for the installer and the uninstaller.
#
# Two ways to sign — put the variables in app/.sign.env (git-ignored) or the environment. See SIGNING.md.
#
#  1. A certificate file (OV / EV .pfx) → osslsigncode
#       SIGN_PFX=/root/secrets/fpsboost.pfx   SIGN_PASS=…
#
#  2. A cloud signing service (the key never leaves the provider's HSM) → jsign (/root/tools/jsign.jar, Java 21)
#       SIGN_JSIGN="<jsign options>"  — everything jsign needs except the file name, for example:
#       • Azure Trusted Signing:  SIGN_JSIGN="--storetype TRUSTEDSIGNING --keystore weu.codesigning.azure.net --storepass <tenant>|<client-id>|<client-secret> --alias <account>/<profile>"
#       • SSL.com eSigner:        SIGN_JSIGN="--storetype ESIGNER --storepass <username>|<password> --alias <credential-id> --keypass <TOTP secret>"
#       • DigiCert ONE:           SIGN_JSIGN="--storetype DIGICERTONE --storepass <api-key>|<client.p12>|<password> --alias <key alias>"
#       • Certum SimplySign / any PKCS#11 cloud or USB token: SIGN_JSIGN="--storetype PKCS11 --keystore /path/pkcs11.cfg --storepass <PIN> --alias <key>"
#     SIGN_TS   RFC 3161 timestamp server (default DigiCert) — keeps the signature valid after the certificate expires.
set -euo pipefail
f=${1:?file}
TS=${SIGN_TS:-http://timestamp.digicert.com}
if [ -n "${SIGN_PFX:-}" ]; then
  [ -f "$SIGN_PFX" ] || { echo "SIGN_PFX not found: $SIGN_PFX" >&2; exit 1; }
  tmp="$f.signed"
  osslsigncode sign -pkcs12 "$SIGN_PFX" ${SIGN_PASS:+-pass "$SIGN_PASS"} -n "FPS Boost" -i "https://fpsboost.ir" \
    -h sha256 -ts "$TS" -in "$f" -out "$tmp" >/dev/null
  mv -f "$tmp" "$f"
elif [ -n "${SIGN_JSIGN:-}" ]; then
  JAR=${JSIGN_JAR:-/root/tools/jsign.jar}
  [ -f "$JAR" ] || { echo "jsign not found: $JAR (https://github.com/ebourg/jsign/releases)" >&2; exit 1; }
  # shellcheck disable=SC2086
  java -jar "$JAR" sign $SIGN_JSIGN --name "FPS Boost" --url "https://fpsboost.ir" --alg SHA-256 --tsaurl "$TS" --replace "$f" >/dev/null
else
  exit 0
fi
# presence check only: "verify" also judges trust, which a self-signed test certificate would fail
sig=$(mktemp); rm -f "$sig"
osslsigncode extract-signature -in "$f" -out "$sig" >/dev/null 2>&1 && echo "signed $f" || { echo "no signature on $f" >&2; exit 1; }
rm -f "$sig"
