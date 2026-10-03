# FPS Boost — the Windows app

One native executable (Go + WebView2, no Electron, no cgo): the UI window, the tray icon, the background **Guard** and
the tweak engine. Installer ≈ 6 MB, exe ≈ 10 MB, background footprint = the Go process alone (the browser is destroyed
when the window closes to the tray).

```
app/
  main_windows.go        wiring: flags, data folder, RPC handlers, tray menu, window open/close, update loop
  internal/engine        Sys interface (registry + commands), Backup (backup.json), Tweak, RegTweak/ServiceTweak/PowercfgTweak, Engine
  internal/tweaks        the 30 tweaks (fps / network) + game presets + the Guard's game exe list
  internal/sysimpl       the real Sys: golang.org/x/sys/windows/registry + hidden commands; registry-only system info
  internal/auth          fpsboost.ir login, Ed25519-signed answers, offline grace (auth.json)
  internal/update        self-update: signed manifest → download → sha256 → FPSBoost-Setup.exe /S
  internal/guard         background loop: game detection, priority, 0.5 ms timer, RAM clean, tweak enforcement
  internal/win           Win32: frameless window, tray + menu, message loop, process/memory helpers, schtasks logon task
  internal/webui         WebView2 host: embedded assets over https://app.fpsboost.internal, JSON-RPC bridge, events
  ui/                    index.html + app.css + app.js (+ mock.js for browser preview), assets (icons, Vazirmatn)
  build/                 icon, winres.json (manifest: requireAdministrator, per-monitor DPI), installer.nsi, art, WebView2 bootstrapper
  scripts/build.sh       go-winres → GOOS=windows go build → makensis   → dist/fpsboost.exe, dist/FPSBoost-Setup.exe
  scripts/release.sh     sha256 → server/wrangler.toml APP_LATEST/APP_SHA256 → GitHub release iNewpie/fpsboost
```

## Build (Linux)
`bash scripts/build.sh` — needs Go in /usr/local/go, `go-winres` in ~/go/bin and electron-builder's makensis cache.
Version comes from `VERSION`. Tests: `go test ./...` (fake Windows, runs on Linux). `GOOS=windows go vet ./...` for the
Windows-only packages.

## Preview the UI without Windows
`python3 -m http.server 8731 --directory ui` then open `http://127.0.0.1:8731/index.html?stateMs=50&page=guard`
(mock.js answers the RPC; query flags: `login=0`, `active=0`, `lang=fa`, `lite=1`, `page=…`, `upd=ready`, `game=0`, `admin=0`).

## Runtime notes
- Data folder `%APPDATA%\fpsboost` (same as the Electron versions): backup.json, auth.json, settings.json, state.json,
  guard.json, app.log, update/, webview/ (WebView2 user data).
- Flags: `--tray` (start hidden; the logon task uses it), `--restore` (revert everything + remove the task; the
  uninstaller calls it), `--unregister`, `--debug` (devtools, context menu), `--state file.json`, `--version`.
- Frameless window: the caption is removed in WM_NCCALCSIZE, side/bottom borders stay Windows-owned; the top 6 px of the
  client area belong to the parent window (top resize + drag). Dragging the title bar uses WebView2's
  `app-region: drag` (runtime ≥ 123) with a JS → Go `WM_NCLBUTTONDOWN` fallback.
- The Guard sets HIGH_PRIORITY_CLASS on the game, requests a 0.5 ms timer (NtSetTimerResolution — system-wide only
  with the `timer_global` tweak on Windows 10 2004+/11), trims other processes' working sets + purges the standby list
  when a game starts or memory load ≥ 88 %, and re-applies registry tweaks that have a backup every 30 min.
