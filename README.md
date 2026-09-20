# Optimizer

A Windows app that applies proven **network** and **FPS** tweaks with full undo, sold as a subscription. Persian + English.

- `server/` — the website + account API: one Cloudflare Worker (free) with a Durable Object (SQLite) for accounts, subscriptions and Zarinpal payments. Admin at `/admin`.
- `app/` — the Electron desktop app: login with the website account, FPS / Network tweak tabs, one-click tools, ping test. Every tweak backs up the original values before changing anything.

## Setup (once)

1. **Cloudflare** (product account): create an API token (Workers Scripts: Edit) and copy the account id.
   `cp server/.env.example server/.env`, fill it in, then `bash server/deploy.sh`. The site is live on the workers.dev URL it prints; put that into `app/src/config.js` → `SERVER_URL`.
   When the domain is ready: add it to that Cloudflare account, set `routes` in `server/wrangler.toml`, redeploy, update `SERVER_URL`.
2. **Zarinpal**: register a merchant at zarinpal.com, put the 36-char id in `server/.env` → `ZARINPAL_MERCHANT`, set `ZARINPAL_SANDBOX = "0"` in `wrangler.toml`, redeploy. Until then buying is disabled and you activate accounts from `/admin`.
3. **Prices / name**: `wrangler.toml` → `APP_NAME`, `PRICES` (months → Toman); `app/src/config.js` → `APP_NAME`; `app/package.json` → `productName`, `appId`.

## The app (on a Windows PC)

```
cd app
npm install
npm start          # run from a terminal opened "as administrator" so tweaks can write HKLM
npm test           # engine tests with a fake Windows (also runs on Linux)
npm run dist       # builds dist/Optimizer Setup x.y.z.exe (NSIS, asks for admin on launch)
```

Upload the installer as a GitHub release; `DOWNLOAD_URL` in `wrangler.toml` points people at it.

## How licensing works

- The website account = the app login. `/api/app/login` returns a signed token bound to a hashed machine id; up to `MAX_MACHINES` PCs per account (reset from the account page or `/admin`).
- The app checks `/api/app/status` on every start; if the server is unreachable it keeps working for `OFFLINE_GRACE_DAYS` after the last "active" answer.
- Tweaks and tools are refused in the main process (not just hidden) without an active subscription.
