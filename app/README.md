# FPS Boost — the Windows app

One native executable (Go + WebView2, no Electron, no cgo): the UI window, the tray icon, the background **Guard** and
the tweak engine. Installer ≈ 6 MB, exe ≈ 10 MB, background footprint = the Go process alone (the browser is destroyed
when the window closes to the tray).

```
app/
  main_windows.go        wiring: flags, data folder, RPC handlers, tray menu, window open/close, update loop
  internal/engine        Sys interface (registry + commands), Backup (backup.json), Tweak, RegTweak/ServiceTweak/PowercfgTweak, Engine
  internal/tweaks        the 34 tweaks (fps / network) + game presets + the Guard's game exe list
  internal/dns           resolver list (Shatel / TCI / Pishgaman ISP resolvers, Shecan & co, the DNS Jumper lists), the concurrent
                         benchmark (dns.scan), ISP detection (server ASN → DHCP ranges) and the "auto" pick behind dns_fast
  internal/sysimpl       the real Sys: golang.org/x/sys/windows/registry + hidden commands; registry-only system info
  internal/auth          fpsboost.ir login, Ed25519-signed answers, offline grace (auth.json); account page, password change, device reset
  internal/update        self-update: signed manifest → download → sha256 → FPSBoost-Setup.exe /S
  internal/guard         background loop: game detection, priority, 0.5 ms timer, RAM clean, tweak enforcement
  internal/win           Win32: frameless window, tray + menu, message loop, process/memory helpers, schtasks logon task
  internal/webui         WebView2 host: embedded assets over https://app.fpsboost.internal, JSON-RPC bridge, events
  ui/                    index.html + app.css + app.js (+ mock.js for browser preview), assets (icons, Vazirmatn)
  build/                 icon, winres.json (manifest: requireAdministrator, per-monitor DPI), installer.nsi, art
  scripts/build.sh       go-winres → GOOS=windows go build → makensis   → dist/fpsboost.exe, dist/FPSBoost-Setup.exe
  scripts/release.sh     sha256 → server/wrangler.toml APP_LATEST/APP_SHA256 → GitHub release iNewpie/fpsboost
```

## Build (Linux)
`bash scripts/build.sh` — needs Go in /usr/local/go, `go-winres` in ~/go/bin and `makensis` (apt `nsis`, 3.09; the
electron-builder cache is only a fallback). Version comes from `VERSION`. Tests: `go test ./...` (fake Windows, runs
on Linux). `GOOS=windows go vet -unsafeptr=false ./...` for the Windows-only packages.

## Code signing (Windows SmartScreen / Defender)
Unsigned builds get "Windows protected your PC — Unknown publisher" from SmartScreen, and Defender's ML heuristics
sometimes block the exe outright. **SIGNING.md** has the whole story: which certificate to buy (Azure Trusted Signing,
SSL.com eSigner, Certum SimplySign, a classic OV .pfx), how to report a false positive to Microsoft, and what the build
does to stay off the heuristics. The build signs everything as soon as credentials exist and stays unsigned otherwise:

```
cat > .sign.env <<'X'          # git-ignored
SIGN_PFX=/root/secrets/fpsboost.pfx      # a certificate file …
SIGN_PASS=…
# … or a cloud signing service through jsign (/root/tools/jsign.jar), e.g. Azure Trusted Signing:
# SIGN_JSIGN="--storetype TRUSTEDSIGNING --keystore weu.codesigning.azure.net --storepass <tenant>|<client>|<secret> --alias <account>/<profile>"
X
bash scripts/build.sh          # "== FPS Boost x.y.z (signed)": fpsboost.exe, FPSBoost-Setup.exe and Uninstall.exe
```
`scripts/sign.sh` uses osslsigncode for a .pfx and jsign for cloud providers (sha256, DigiCert RFC 3161 timestamp);
`installer.nsi` signs the installer and the uninstaller stub through `!finalize` / `!uninstfinalize`.

## Updates — what the user sees
- The app asks `/api/app/update` 8 s after start, every 6 h in the tray, and whenever the window is opened (at most
  every 10 min). A newer `APP_LATEST` on the server → banner "FPS Boost x.y.z is available" with a button.
- Automatic updates (default on): the installer downloads in the background → banner "ready to install" + **Update now**;
  with the window closed a tray balloon announces it once; the download is installed when the app quits anyway.
- **Update now** runs the verified installer silently, the app quits, the installer restarts it and (because of the
  `update/reopen` marker) the window opens again on the new version with an "Updated to x.y.z" toast.
- Release: `bash scripts/build.sh && bash scripts/release.sh && bash ../server/deploy.sh` — nothing reaches installed
  apps before the deploy.

## Preview the UI without Windows
`python3 -m http.server 8731 --directory ui` then open `http://127.0.0.1:8731/index.html?stateMs=50&page=guard`
(mock.js answers the RPC; query flags: `login=0`, `active=0`, `lang=fa`, `lite=1`, `page=…`, `upd=ready`, `game=0`, `admin=0`).

## Runtime notes
- Data folder `%APPDATA%\fpsboost` (same as the Electron versions): backup.json, auth.json, settings.json, state.json,
  guard.json, app.log, update/, webview/ (WebView2 user data).
- Flags: `--tray` (start hidden; the logon task uses it), `--restore` (revert everything + remove the task; the
  uninstaller calls it), `--quit` (ask the running instance to exit and wait — the installer uses it instead of
  taskkill), `--unregister`, `--debug` (devtools, context menu), `--state file.json`, `--version`.
- WebView2: nothing is bundled (1.0.4+). The installer and the app point at Microsoft's download page when the runtime
  is missing; Windows 11 and updated Windows 10 ship it.
- Frameless window: the caption is removed in WM_NCCALCSIZE, side/bottom borders stay Windows-owned; the top 6 px of the
  client area belong to the parent window (top resize + drag). Dragging the title bar uses WebView2's
  `app-region: drag` (runtime ≥ 123) with a JS → Go `WM_NCLBUTTONDOWN` fallback.
- The Guard sets HIGH_PRIORITY_CLASS on the game, requests a 0.5 ms timer (NtSetTimerResolution — system-wide only
  with the `timer_global` tweak on Windows 10 2004+/11), trims other processes' working sets + purges the standby list
  when a game starts or memory load ≥ 88 %, and re-applies registry tweaks that have a backup every 30 min.
