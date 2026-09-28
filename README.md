# FPS Boost — fpsboost.ir

A Windows app that applies proven **network** and **FPS** tweaks with full undo, sold as a subscription. Persian + English.

- `server/` — the website + account API: one Cloudflare Worker (free) with a Durable Object (SQLite) for accounts, subscriptions and Zarinpal payments. Admin at `/admin`.
- `app/` — the Electron desktop app: login with the website account, FPS / Network tweak tabs, one-click tools, ping test. Every tweak backs up the original values before changing anything.

## Setup (once)

1. **Cloudflare** (product account): create an API token (Workers Scripts: Edit) and copy the account id.
   Add fpsboost.ir to that account (Websites → Add a domain), switch the nameservers at nic.ir to the two Cloudflare gives, wait until the zone says Active.
   `cp server/.env.example server/.env`, fill it in, then `bash server/deploy.sh` — the worker takes over https://fpsboost.ir (Cloudflare creates the DNS record itself).
2. **Zarinpal**: register a merchant at zarinpal.com, put the 36-char id in `server/.env` → `ZARINPAL_MERCHANT`, set `ZARINPAL_SANDBOX = "0"` in `wrangler.toml`, redeploy. Until then buying is disabled and you activate accounts from `/admin`.
3. **Prices / name**: `wrangler.toml` → `APP_NAME`, `PRICES` (months → Toman); `app/src/config.js` → `APP_NAME`; `app/package.json` → `productName`, `appId`.

## The app

Electron, but built for weak PCs: a flat dark UI (title bar, icon sidebar, content — the old ExitLag layout) with no blur,
shadows, gradients or animations; one renderer process, WebGL off, background throttling on, and a **Lite mode** setting
that turns GPU acceleration off entirely for old / integrated graphics. Pages: Home (tiles + one-click Boost), FPS Boost
(15 switches), Network (6 switches + ping test), Games (10 presets = tweak bundles + in-game tips), Tools, Settings.

```
cd app
npm install
npm test           # engine + auth tests with a fake Windows / fake server (also runs on Linux)
npm start          # builds out/ then runs Electron (on Windows, from a terminal opened "as administrator")
npm run dist       # Windows installer: dist/FPSBoost-Setup.exe (builds on Linux with Wine too)
node dev/gen.js    # refresh dev/demo-data.js, then open dev/demo.html in a browser: the UI with a fake backend
```

### Build hardening (scripts/build.js, package.json → build)

- `src/` + `tweaks/` are bundled and minified with esbuild, then compiled to **V8 bytecode** (`out/main.jsc`, bytenode);
  the shipped app has no readable main-process source — the tweak scripts, the licence gate and the server key live only
  in bytecode. The renderer is minified.
- **Electron fuses**: `runAsNode` off, Node CLI / `NODE_OPTIONS` off, cookie encryption on, `onlyLoadAppFromAsar`,
  `EnableEmbeddedAsarIntegrityValidation` — the exe carries the asar hash and refuses to start if `app.asar` was edited.
- DevTools are compiled out of packaged builds; navigation and `window.open` are blocked; every renderer input is
  length-limited in the main process; the renderer runs sandboxed with a strict CSP.
- Size: only the `en-US` + `fa` locales ship, the unused WebGPU compiler (`dxcompiler.dll`, `dxil.dll`) and the 20 MB
  Chromium licence page are dropped in `scripts/afterPack.js`, NSIS LZMA compression at the default level (level 9 needs ~700 MB RAM and gets OOM-killed on the 2 GB build box).
- **Self-update**: the app asks `/api/app/update` (a signed answer, same key as the licence) for `APP_LATEST` /
  `APP_SHA256` / `DOWNLOAD_URL`, downloads the installer in the background, refuses it unless its SHA-256 matches the
  signed one, and runs it silently (`/S`) on "Update now" or when the app closes (setting: automatic updates).
  Release flow: `npm run dist` → `bash scripts/release.sh` (hashes the exe, writes the two vars into
  `server/wrangler.toml`, uploads GitHub release v<version>) → `bash server/deploy.sh` (only now do installed apps see it).
- Still to do for a "no one can crack it" posture: **code-sign the exe** (an Authenticode certificate — without it a
  patched exe is indistinguishable from yours). Everything else that matters is server-side (see licensing).

## How licensing works

- The website account = the app login. `/api/app/login` returns a signed token bound to a hashed machine id; up to `MAX_MACHINES` PCs per account (reset from the account page or `/admin`).
- The app checks `/api/app/status` on every start; if the server is unreachable it keeps working for `OFFLINE_GRACE_DAYS` after the last "active" answer.
- Every `/api/app/*` answer is **signed** (Ed25519, `APP_SIGN_KEY` in `server/.env` → the public key in `app/src/config.js`)
  and echoes the app's random nonce + machine id, so a fake server, a proxy rewriting `active`, or a replayed old answer
  cannot unlock the app. New key pair: see `server/.env.example` (change both halves together, then redeploy + rebuild).
- Tweaks and tools are refused in the main process (not just hidden) without an active subscription.

## Safety

- Every tweak records the original values in `%APPDATA%\FPS Boost\backup.json` before changing them; Revert puts them back exactly.
- "Apply recommended" first creates a Windows System Restore point (also available as a manual tool), so the whole PC can be rolled back from Settings → Recovery even if the app is uninstalled.
- All tweaks are documented, widely used registry/netsh/powercfg settings — nothing touches drivers, services or system files.
