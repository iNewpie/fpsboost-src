# FPS Boost — fpsboost.ir

A Windows app that applies proven **network** and **FPS** tweaks with full undo, sold as a subscription. Persian + English.

- `server/` — the website + account API: one Cloudflare Worker (free) with a Durable Object (SQLite) for accounts, subscriptions and Zarinpal payments. Admin at `/admin`.
- `app/` — the Windows app: ONE native Go + WebView2 executable (no Electron). Login with the website account, 30 FPS / network tweaks, game presets, a background Guard (tray-resident: game priority, 0.5 ms timer, RAM clean, tweak enforcement), one-click tools, ping test, self-update. Every tweak backs up the original values before changing anything. See app/README.md.

## Setup (once)

1. **Cloudflare** (product account): create an API token (Workers Scripts: Edit) and copy the account id.
   Add fpsboost.ir to that account (Websites → Add a domain), switch the nameservers at nic.ir to the two Cloudflare gives, wait until the zone says Active.
   `cp server/.env.example server/.env`, fill it in, then `bash server/deploy.sh` — the worker takes over https://fpsboost.ir (Cloudflare creates the DNS record itself).
2. **Zarinpal**: register a merchant at zarinpal.com, put the 36-char id in `server/.env` → `ZARINPAL_MERCHANT`, set `ZARINPAL_SANDBOX = "0"` in `wrangler.toml`, redeploy. Until then buying is disabled and you activate accounts from `/admin`.
3. **Prices / name**: `wrangler.toml` → `APP_NAME`, `PRICES` (months → Toman); `app/internal/config/config.go` → `AppName`; `app/build/installer.nsi` → `NAME`.

## The app

One native executable (Go + WebView2, no Electron, no cgo) — `app/README.md` has the layout. Installer ≈ 5 MB, exe ≈ 8 MB;
with the window closed only the Go process stays (≈ 15–30 MB) and keeps the **Guard** running from the tray: it notices a
game in the foreground, raises its CPU priority, requests a 0.5 ms timer, frees RAM and re-applies tweaks Windows reverted.
Pages: Home (boost score, one-click Boost, Guard + PC cards), FPS Boost (23 switches), Network (7 switches + ping test),
Games (10 presets = tweak bundles + in-game tips), Guard, Tools, Settings. English + Persian (RTL), Lite mode for weak GPUs.

```
cd app
go test ./...                       # engine / tweaks / auth / updater tests with a fake Windows (runs on Linux)
GOOS=windows go vet -unsafeptr=false ./...
bash scripts/build.sh               # dist/fpsboost.exe + dist/FPSBoost-Setup.exe (Linux: go-winres + makensis)
python3 -m http.server 8731 --directory ui   # then open http://127.0.0.1:8731/index.html — the UI with a fake backend
```

### Hardening and size

- The whole app is one statically linked Go binary: no readable scripts, the licence gate, the tweak engine and the server
  key are compiled code. The UI is embedded and served from memory to the WebView2 (`https://app.fpsboost.internal`);
  the page has a strict CSP, no network access, no devtools in release builds, browser accelerator keys off.
- The manifest requires administrator rights (needed for HKLM / services / powercfg) and declares per-monitor DPI.
- **Self-update**: the app asks `/api/app/update` (a signed answer, same key as the licence) for `APP_LATEST` /
  `APP_SHA256` / `DOWNLOAD_URL`, downloads the installer in the background, refuses it unless its SHA-256 matches the
  signed one, and runs it silently (`/S`) on "Update now" or when the app closes (setting: automatic updates).
  Release flow: `bash app/scripts/build.sh` → `bash app/scripts/release.sh` (hashes the exe, writes the two vars into
  `server/wrangler.toml`, uploads GitHub release v<version>) → `bash server/deploy.sh` (only now do installed apps see it).
- The installer removes an Electron-era install (0.1 / 0.2) from the same folder first and installs the Microsoft Edge
  WebView2 runtime when a PC lacks it (bundled 2 MB bootstrapper; Windows 11 always has it).
- Still to do for a "no one can crack it" posture: **code-sign the exe** (an Authenticode certificate — without it a
  patched exe is indistinguishable from yours). Everything else that matters is server-side (see licensing).

## How licensing works

- The website account = the app login. `/api/app/login` returns a signed token bound to a hashed machine id; up to `MAX_MACHINES` PCs per account (reset from the account page or `/admin`).
- The app checks `/api/app/status` on every start; if the server is unreachable it keeps working for `OFFLINE_GRACE_DAYS` after the last "active" answer.
- Every `/api/app/*` answer is **signed** (Ed25519, `APP_SIGN_KEY` in `server/.env` → the public key in `app/internal/config/config.go`)
  and echoes the app's random nonce + machine id, so a fake server, a proxy rewriting `active`, or a replayed old answer
  cannot unlock the app. New key pair: see `server/.env.example` (change both halves together, then redeploy + rebuild).
- Tweaks and tools are refused in the main process (not just hidden) without an active subscription.

## Safety

- Every tweak records the original values in `%APPDATA%\FPS Boost\backup.json` before changing them; Revert puts them back exactly.
- "Apply recommended" first creates a Windows System Restore point (also available as a manual tool), so the whole PC can be rolled back from Settings → Recovery even if the app is uninstalled.
- All tweaks are documented, widely used registry/netsh/powercfg settings — nothing touches drivers, services or system files.
