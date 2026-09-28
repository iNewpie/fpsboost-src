#!/usr/bin/env bash
# Publish a build: hash dist/FPSBoost-Setup.exe, write APP_LATEST / APP_SHA256 into server/wrangler.toml, upload the
# installer as GitHub release v<version> of iNewpie/fpsboost. Then deploy the worker (bash server/deploy.sh) — installed
# apps see the new version on their next check and update themselves. Order matters: release first, deploy second.
set -e
cd "$(dirname "$0")/.."
VER=$(node -p "require('./package.json').version"); EXE=dist/FPSBoost-Setup.exe
[ -f "$EXE" ] || { echo "$EXE missing — run npm run dist first"; exit 1; }
SHA=$(sha256sum "$EXE" | cut -d' ' -f1)
sed -i -E "s/^APP_LATEST = \"[^\"]*\"/APP_LATEST = \"$VER\"/; s/^APP_SHA256 = \"[^\"]*\"/APP_SHA256 = \"$SHA\"/" ../server/wrangler.toml
grep -E "^APP_(LATEST|SHA256)" ../server/wrangler.toml
if gh release view "v$VER" -R iNewpie/fpsboost >/dev/null 2>&1; then gh release upload "v$VER" "$EXE" --clobber -R iNewpie/fpsboost; else gh release create "v$VER" "$EXE" -R iNewpie/fpsboost -t "FPS Boost $VER" -n "${NOTES:-FPS Boost $VER}"; fi
echo; echo "released v$VER ($(du -h "$EXE" | cut -f1), sha256 $SHA)"; echo "now: cd .. && bash server/deploy.sh   (publishes the version to installed apps)"
