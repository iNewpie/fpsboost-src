#!/usr/bin/env bash
# Deploys server/worker.js to Cloudflare and sets its secrets from server/.env:
#   CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID   — the product's Cloudflare account (Workers Scripts: Edit)
#   ADMIN_USER, ADMIN_PASS                         — /admin (HTTP basic auth)
#   ZARINPAL_MERCHANT                              — 36-char merchant id from zarinpal.com (leave empty until you have it)
#   SESSION_SECRET                                 — any long random string (generated on first run)
#   APP_SIGN_KEY                                   — Ed25519 private key (base64 PKCS8) that signs the desktop app's answers; its public half is app/src/config.js SERVER_PUBKEY
set -e
cd "$(dirname "$0")"
[ -f .env ] || { echo "server/.env missing — copy .env.example and fill it in"; exit 1; }
set -a; . ./.env; set +a
[ -n "$CLOUDFLARE_API_TOKEN" ] && [ -n "$CLOUDFLARE_ACCOUNT_ID" ] || { echo "CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID missing in server/.env"; exit 1; }
[ -n "$ADMIN_USER" ] && [ -n "$ADMIN_PASS" ] || { echo "ADMIN_USER / ADMIN_PASS missing in server/.env"; exit 1; }
[ -n "$APP_SIGN_KEY" ] || { echo "APP_SIGN_KEY missing in server/.env (the app cannot log in without it)"; exit 1; }
if [ -z "$SESSION_SECRET" ]; then
  SESSION_SECRET=$(head -c 32 /dev/urandom | base64 | tr -d '=+/')
  printf '\nSESSION_SECRET=%s\n' "$SESSION_SECRET" >> .env; echo "generated SESSION_SECRET"
fi
npx --yes wrangler@4 deploy
for k in ADMIN_USER ADMIN_PASS SESSION_SECRET ZARINPAL_MERCHANT APP_SIGN_KEY; do v="${!k}"; [ -n "$v" ] || continue; printf '%s' "$v" | npx --yes wrangler@4 secret put "$k" >/dev/null && echo "secret $k set"; done
echo; echo "site:  https://fpsboost.ir"; echo "admin: https://fpsboost.ir/admin  (login: $ADMIN_USER)"
