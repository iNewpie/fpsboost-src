//go:build windows

// FPS Boost — a native Go + WebView2 Windows optimizer. One executable: the UI window (created on demand), the tray icon,
// the background guard and the tweak engine. See README.md for the build.
package main

import (
	"context"
	"embed"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"io/fs"
	"log"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/jchv/go-webview2/webviewloader"

	"fpsboost.ir/app/internal/auth"
	"fpsboost.ir/app/internal/config"
	"fpsboost.ir/app/internal/dns"
	"fpsboost.ir/app/internal/engine"
	"fpsboost.ir/app/internal/guard"
	"fpsboost.ir/app/internal/settings"
	"fpsboost.ir/app/internal/sysimpl"
	"fpsboost.ir/app/internal/tools"
	"fpsboost.ir/app/internal/tweaks"
	"fpsboost.ir/app/internal/update"
	"fpsboost.ir/app/internal/webui"
	"fpsboost.ir/app/internal/win"
)

//go:embed ui
var uiFS embed.FS

// quitEvent is the named event the installer signals (fpsboost.exe --quit) so a running instance exits cleanly instead
// of being killed.
const quitEvent = `Local\FPSBoost.Quit`

func init() { runtime.LockOSThread() }

type application struct {
	dataDir  string
	sys      engine.Sys
	engine   *engine.Engine
	auth     *auth.Auth
	updater  *update.Updater
	settings *settings.Store
	guard    *guard.Guard
	actions  []*tools.Action
	app      *win.App
	host     *webui.Host
	debug    bool

	stateMu     sync.Mutex
	stateRun    bool
	restoreOnce sync.Once
	quitting    bool

	ispMu  sync.Mutex
	isp    string    // detected ISP id ("" = unknown)
	ispAt  time.Time // when the server was last asked
	dnsMu  sync.Mutex
	dnsRun bool

	updMu     sync.Mutex
	lastCheck time.Time // last /api/app/update call (window open re-checks after 10 min)
	notified  string    // version the tray balloon already announced
	updated   bool      // first run of a new version (the UI shows "updated to …")
}

func main() {
	tray := flag.Bool("tray", false, "start hidden in the tray")
	restore := flag.Bool("restore", false, "revert every tweak and exit (uninstaller)")
	unregister := flag.Bool("unregister", false, "remove the start-with-Windows task and exit")
	debug := flag.Bool("debug", false, "developer tools + verbose log")
	stateFile := flag.String("state", "", "write the tweak state as JSON to this file and exit (tests)")
	applyID := flag.String("apply", "", "apply one tweak id (with --out for the result) and exit (tests / support)")
	revertID := flag.String("revert", "", "revert one tweak id and exit")
	outFile := flag.String("out", "", "where --apply / --revert write their JSON result")
	version := flag.Bool("version", false, "print the version")
	quit := flag.Bool("quit", false, "ask the running instance to exit and wait for it (the installer uses it)")
	flag.Parse()
	if *version {
		fmt.Println(config.Version)
		return
	}

	a := &application{debug: *debug}
	a.dataDir = filepath.Join(os.Getenv("APPDATA"), config.DataDirName)
	_ = os.MkdirAll(a.dataDir, 0o755)
	a.setupLog()
	log.Printf("FPS Boost %s starting (args %v)", config.Version, os.Args[1:])

	a.sys = sysimpl.Windows{}
	a.engine = engine.New(tweaks.All, a.sys, engine.NewBackup(filepath.Join(a.dataDir, "backup.json")))
	a.settings = settings.New(filepath.Join(a.dataDir, "settings.json"))
	if prev := a.settings.Get().LastVersion; prev != config.Version {
		a.updated = prev != ""
		a.settings.Update(func(d *settings.Data) { d.LastVersion = config.Version })
	}
	au, err := auth.New(config.ServerURL, filepath.Join(a.dataDir, "auth.json"), config.ServerPubKey, sysimpl.MachineGUID(), config.OfflineGraceDays)
	if err != nil {
		win.MessageBox("FPS Boost", "Broken build: "+err.Error(), win.MB_ICONERROR)
		return
	}
	a.auth = au
	tweaks.DetectISP = func(engine.Sys) string { return a.detectISP() }
	tweaks.TotalRAMMB = func() int { total, _, _ := win.Memory(); return total }

	switch {
	case *restore:
		a.engine.RevertAll("", nil)
		win.RemoveStartupTask()
		return
	case *unregister:
		win.RemoveStartupTask()
		return
	case *stateFile != "":
		raw, _ := json.MarshalIndent(a.engine.State(), "", " ")
		_ = os.WriteFile(*stateFile, raw, 0o644)
		return
	case *applyID != "" || *revertID != "":
		var r engine.Result
		if *applyID != "" {
			r = a.engine.Apply(*applyID, "")
		} else {
			r = a.engine.Revert(*revertID)
		}
		raw, _ := json.Marshal(r)
		log.Printf("cli %s", raw)
		if *outFile != "" {
			_ = os.WriteFile(*outFile, raw, 0o644)
		}
		return
	}

	if *quit {
		if win.QuitOther(`Local\FPSBoost.App`, quitEvent, 20*time.Second) {
			return
		}
		os.Exit(1)
	}
	if !win.SingleInstance(`Local\FPSBoost.App`) {
		if !*tray {
			win.WakeOther()
		}
		return
	}
	win.OnQuitRequest(quitEvent, func() {
		log.Printf("quit requested by another process (installer)")
		a.quitting = true
		a.app.Dispatch(func() {
			if a.host != nil && a.host.IsOpen() {
				a.host.Window().Close()
			} else {
				a.app.Quit()
			}
		})
	})
	win.LoadIcons("APP")
	a.app = win.NewApp()

	a.guard = guard.New(filepath.Join(a.dataDir, "guard.json"))
	a.guard.Active = a.auth.Active
	a.guard.Enforce = a.engine.Enforce
	a.guard.OnChange = func(s guard.Status) { a.emit("guard", s); a.trayTip() }
	a.actions = tools.Actions(tools.Env{Temp: os.Getenv("TEMP"), SystemRoot: os.Getenv("SystemRoot"), LocalAppData: os.Getenv("LOCALAPPDATA")}, a.guard.CleanNow)
	a.updater = update.New(a.auth, config.Version, filepath.Join(a.dataDir, "update"), func(s update.State) { a.emit("update", s); a.notifyUpdate(s) })
	a.updater.Launch = win.StartDetached

	sub, _ := fs.Sub(uiFS, "ui")
	a.host = webui.New(a.app, sub, a.dataDir)
	a.host.Debug = *debug
	a.host.InitJS = a.initJS
	a.host.OnClose = a.onWindowClose
	a.registerHandlers()

	a.app.OnShow = func() { a.openWindow() }
	a.app.OnTray = a.onTray
	a.applySettings(a.settings.Get(), true)
	a.guard.Start()

	if !*tray || a.consumeReopen() {
		a.openWindow()
	} else {
		a.app.Tray(config.AppName)
	}
	go a.updateLoop()
	a.app.Run()

	// shutting down
	a.guard.Stop()
	st := a.settings.Get()
	if st.AutoUpdate && a.updater.Ready() {
		if err := a.updater.Install(); err != nil {
			log.Printf("install at quit: %v", err)
		}
	}
	log.Printf("bye")
}

/* ---- logging: app.log in the data folder, and the WebView2 library's fatal errors become a dialog ---- */

type fatalWatcher struct{ w io.Writer }

func (f fatalWatcher) Write(p []byte) (int, error) {
	if strings.Contains(string(p), "failed with") && strings.Contains(string(p), "Creating") {
		go win.MessageBox("FPS Boost", "The Microsoft Edge WebView2 runtime could not start.\n\nReinstall FPS Boost or install WebView2 from microsoft.com, then try again.\n\n"+string(p), win.MB_ICONERROR)
		time.Sleep(8 * time.Second)
	}
	return f.w.Write(p)
}

func (a *application) setupLog() {
	path := filepath.Join(a.dataDir, "app.log")
	if st, err := os.Stat(path); err == nil && st.Size() > 1<<20 {
		_ = os.Rename(path, path+".1")
	}
	f, err := os.OpenFile(path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		return
	}
	log.SetOutput(fatalWatcher{f})
	log.SetFlags(log.Ldate | log.Ltime | log.Lshortfile)
}

/* ---- window / tray ---- */

func (a *application) openWindow() {
	go a.checkUpdates(false) // a release pushed while the app sat in the tray shows its button right away
	a.app.Dispatch(func() {
		if a.host.IsOpen() {
			a.host.Window().Show()
			return
		}
		if _, err := webviewloader.GetInstalledVersion(); err != nil {
			if win.MessageBox(config.AppName, "FPS Boost needs the Microsoft Edge WebView2 runtime, which is missing on this PC.\n\nOpen the download page now?", win.MB_YESNO|win.MB_ICONWARNING) == win.IDYES {
				win.OpenURL("https://developer.microsoft.com/microsoft-edge/webview2/#download")
			}
			if !a.host.IsOpen() && a.app != nil {
				a.app.Tray(config.AppName)
			}
			return
		}
		st := a.settings.Get()
		p := win.Placement{X: st.Win.Px, Y: st.Win.Py, W: st.Win.Pw, H: st.Win.Ph, Max: st.Win.Max, Valid: st.Win.Pw > 0}
		if err := a.host.Open(p); err != nil {
			log.Printf("open window: %v", err)
			if win.MessageBox(config.AppName, err.Error()+"\n\nFPS Boost needs the Microsoft Edge WebView2 runtime. Open the download page now?", win.MB_YESNO|win.MB_ICONERROR) == win.IDYES {
				win.OpenURL("https://developer.microsoft.com/microsoft-edge/webview2/#download")
			}
			if !a.hasTray() {
				a.app.Quit()
			}
			return
		}
		a.app.Tray(config.AppName)
	})
}

// onWindowClose: hide to the tray (default) or quit.
func (a *application) onWindowClose() bool {
	if w := a.host.Window(); w != nil {
		p := w.Placement()
		if p.Valid {
			a.settings.Update(func(d *settings.Data) { d.Win = settings.Window{Px: p.X, Py: p.Y, Pw: p.W, Ph: p.H, Max: p.Max} })
		}
	}
	st := a.settings.Get()
	if a.quitting || !st.CloseToTray {
		a.app.Quit()
		return true
	}
	if t := a.app.Tray(config.AppName); !st.Seen["tray"] {
		a.settings.Update(func(d *settings.Data) {
			if d.Seen == nil {
				d.Seen = map[string]bool{}
			}
			d.Seen["tray"] = true
		})
		if a.lang() == "fa" {
			t.Balloon("FPS Boost در پس‌زمینه است", "گارد همچنان بازی‌های شما را بوست می‌کند. برای باز کردن روی آیکون کلیک کنید.")
		} else {
			t.Balloon("FPS Boost keeps running", "The Guard still boosts your games in the background. Click the tray icon to open the app.")
		}
	}
	return true
}

const (
	menuOpen = iota + 1
	menuGuard
	menuClean
	menuSite
	menuExit
)

func (a *application) onTray(event uint32, _, _ int32) {
	switch event {
	case win.WM_LBUTTONUP, win.NIN_SELECT, win.NIN_KEYSELECT, win.NIN_BALLOONUSERCLICK:
		a.openWindow()
	case win.WM_CONTEXTMENU, win.WM_RBUTTONUP:
		fa := a.lang() == "fa"
		st := a.settings.Get()
		tx := func(en, f string) string {
			if fa {
				return f
			}
			return en
		}
		items := []win.MenuItem{
			{ID: menuOpen, Text: tx("Open FPS Boost", "باز کردن FPS Boost"), Default: true},
			{ID: menuClean, Text: tx("Free RAM now", "آزادسازی رم")},
			{ID: menuGuard, Text: tx("Background Guard", "گارد پس‌زمینه"), Checked: st.Guard},
			{},
			{ID: menuSite, Text: "fpsboost.ir"},
			{},
			{ID: menuExit, Text: tx("Exit", "خروج")},
		}
		switch a.app.Menu(items, fa) {
		case menuOpen:
			a.openWindow()
		case menuClean:
			go func() {
				if a.auth.Active() {
					a.guard.CleanNow()
				} else {
					a.openWindow()
				}
			}()
		case menuGuard:
			d := a.settings.Update(func(d *settings.Data) { d.Guard = !d.Guard })
			a.applySettings(d, false)
			a.emit("settings", d)
		case menuSite:
			win.OpenURL(config.ServerURL)
		case menuExit:
			a.quitting = true
			if a.host.IsOpen() {
				a.host.Window().Close()
			} else {
				a.app.Quit()
			}
		}
	}
}

func (a *application) hasTray() bool { return a.app != nil && a.app.HasTray() }

func (a *application) trayTip() {
	s := a.guard.Status()
	tip := config.AppName
	if s.Game != "" {
		tip += " — boosting " + s.Game
	}
	a.app.Dispatch(func() {
		if t := a.app.Tray(tip); t != nil {
			t.SetTip(tip)
		}
	})
}

func (a *application) lang() string {
	if l := a.settings.Get().Lang; l != "" {
		return l
	}
	return "en"
}

// applySettings turns settings into side effects (guard options, startup task).
func (a *application) applySettings(d settings.Data, first bool) {
	a.guard.SetOptions(guard.Options{Enabled: d.Guard, Priority: d.GuardPriority, RAM: d.GuardRAM, Timer: d.GuardTimer, Enforce: d.GuardEnforce})
	go func() {
		exe := win.ExePath()
		if d.Startup {
			if err := win.InstallStartupTask(exe); err != nil {
				log.Printf("startup task: %v", err)
			}
		} else if !first || win.HasStartupTask() {
			win.RemoveStartupTask()
		}
	}()
}

func (a *application) emit(name string, payload any) {
	if a.host != nil {
		a.host.Emit(name, payload)
	}
}

func (a *application) initJS() string {
	b, _ := json.Marshal(map[string]any{"version": config.Version, "debug": a.debug, "isAdmin": win.IsAdmin(), "platform": "windows"})
	return "window.__host=" + string(b) + ";"
}

func (a *application) updateLoop() {
	time.Sleep(8 * time.Second)
	for {
		a.checkUpdates(true)
		time.Sleep(6 * time.Hour)
	}
}

// checkUpdates asks the server for the newest version (at most every 10 min unless forced) and, with automatic updates
// on, downloads it in the background so the UI goes straight to "Update now".
func (a *application) checkUpdates(force bool) {
	a.updMu.Lock()
	if !force && time.Since(a.lastCheck) < 10*time.Minute {
		a.updMu.Unlock()
		return
	}
	a.lastCheck = time.Now()
	a.updMu.Unlock()
	st := a.updater.Check()
	if st.Status == "available" && a.settings.Get().AutoUpdate {
		a.updater.Download()
	}
}

// notifyUpdate: with the window closed, a tray balloon once per version when an update is ready (or available, if
// automatic downloads are off). Clicking the balloon opens the app on its Update button.
func (a *application) notifyUpdate(s update.State) {
	if s.Status != "ready" && !(s.Status == "available" && !a.settings.Get().AutoUpdate) {
		return
	}
	a.updMu.Lock()
	seen := a.notified == s.Latest
	a.notified = s.Latest
	a.updMu.Unlock()
	if seen || a.host.IsOpen() || !a.hasTray() {
		return
	}
	title, text := "FPS Boost "+s.Latest+" is ready", "Click to open the app and press Update."
	if s.Status == "available" {
		title, text = "FPS Boost "+s.Latest+" is available", "Click to open the app and download it."
	}
	if a.lang() == "fa" {
		title, text = "FPS Boost "+s.Latest+" آماده است", "برای باز کردن برنامه و زدن دکمهٔ به‌روزرسانی کلیک کنید."
		if s.Status == "available" {
			title, text = "FPS Boost "+s.Latest+" منتشر شد", "برای باز کردن برنامه و دانلود آن کلیک کنید."
		}
	}
	a.app.Dispatch(func() {
		if t := a.app.Tray(config.AppName); t != nil {
			t.Balloon(title, text)
		}
	})
}

func (a *application) reopenMarker() string { return filepath.Join(a.dataDir, "update", "reopen") }

// consumeReopen: "Update now" leaves a marker so the new version, started by the silent installer with --tray, opens
// its window instead of hiding — the user sees the new version straight away.
func (a *application) consumeReopen() bool {
	if _, err := os.Stat(a.reopenMarker()); err != nil {
		return false
	}
	_ = os.Remove(a.reopenMarker())
	return true
}

/* ---- RPC ---- */

func arg[T any](args []json.RawMessage, i int) (T, error) {
	var v T
	if i >= len(args) {
		return v, nil
	}
	err := json.Unmarshal(args[i], &v)
	return v, err
}

func (a *application) gated(fn webui.Handler) webui.Handler {
	return func(args []json.RawMessage) (any, error) {
		if !a.auth.Active() {
			return nil, errors.New("no active subscription")
		}
		return fn(args)
	}
}

func (a *application) registerHandlers() {
	h := a.host
	h.Handle("app.boot", func(args []json.RawMessage) (any, error) {
		return map[string]any{
			"info":     map[string]any{"name": config.AppName, "version": config.Version, "isAdmin": win.IsAdmin(), "pingHosts": config.PingHosts, "debug": a.debug, "serverUrl": config.ServerURL, "updated": a.updated},
			"settings": a.settings.Get(),
			"auth":     a.auth.View(),
			"state":    a.cachedState(),
			"presets":  tweaks.Presets,
			"tools":    a.actions,
			"guard":    a.guard.Status(),
			"update":   a.updater.State(),
			"system":   sysimpl.Info(runtime.NumCPU()),
			"dns":      dns.Providers,
			"dnsScan":  a.settings.Get().LastDNS,
		}, nil
	})
	h.Handle("app.open", func(args []json.RawMessage) (any, error) {
		u, _ := arg[string](args, 0)
		if u == config.ServerURL || strings.HasPrefix(u, config.ServerURL+"/") || strings.HasPrefix(u, "https://t.me/") || strings.HasPrefix(u, "mailto:") {
			win.OpenURL(u)
		}
		return nil, nil
	})
	h.Handle("app.win", func(args []json.RawMessage) (any, error) {
		act, _ := arg[string](args, 0)
		a.app.Dispatch(func() {
			w := a.host.Window()
			if w == nil {
				return
			}
			switch act {
			case "min":
				w.Minimize()
			case "max":
				w.ToggleMaximize()
			case "close":
				w.Close()
			case "drag":
				w.Drag()
			}
		})
		return nil, nil
	})
	h.Handle("app.quit", func(args []json.RawMessage) (any, error) {
		a.quitting = true
		a.app.Dispatch(func() {
			if w := a.host.Window(); w != nil {
				w.Close()
			} else {
				a.app.Quit()
			}
		})
		return nil, nil
	})
	h.Handle("auth.login", func(args []json.RawMessage) (any, error) {
		u, _ := arg[string](args, 0)
		p, _ := arg[string](args, 1)
		v, err := a.auth.Login(strings.TrimSpace(u), p)
		if err != nil {
			return nil, err
		}
		a.emit("auth", v)
		return v, nil
	})
	h.Handle("auth.status", func(args []json.RawMessage) (any, error) { return a.auth.Status(), nil })
	h.Handle("auth.logout", func(args []json.RawMessage) (any, error) { return a.auth.Logout(), nil })
	h.Handle("auth.account", func(args []json.RawMessage) (any, error) {
		acc, err := a.auth.Account()
		if err != nil {
			a.emit("auth", a.auth.View())
			return nil, err
		}
		a.emit("auth", a.auth.View())
		return acc, nil
	})
	h.Handle("auth.password", func(args []json.RawMessage) (any, error) {
		cur, _ := arg[string](args, 0)
		next, _ := arg[string](args, 1)
		if err := a.auth.ChangePassword(cur, next); err != nil {
			return nil, err
		}
		return true, nil
	})
	h.Handle("auth.devices", func(args []json.RawMessage) (any, error) {
		n, err := a.auth.ResetDevices()
		if err != nil {
			a.emit("auth", a.auth.View())
			return nil, err
		}
		return map[string]any{"machines": n}, nil
	})

	h.Handle("tweaks.state", func(args []json.RawMessage) (any, error) { return a.liveState(), nil })
	h.Handle("tweaks.apply", a.gated(func(args []json.RawMessage) (any, error) {
		id, _ := arg[string](args, 0)
		opt, _ := arg[string](args, 1)
		r := a.engine.Apply(id, opt)
		go a.liveState()
		return r, nil
	}))
	h.Handle("tweaks.revert", a.gated(func(args []json.RawMessage) (any, error) {
		id, _ := arg[string](args, 0)
		r := a.engine.Revert(id)
		go a.liveState()
		return r, nil
	}))
	h.Handle("tweaks.applyRecommended", a.gated(func(args []json.RawMessage) (any, error) {
		cat, _ := arg[string](args, 0)
		a.restorePoint()
		ids := a.engine.Recommended(cat)
		res := a.engine.ApplyMany(ids, func(done, total int, r engine.Result) {
			a.emit("progress", map[string]any{"op": "boost", "done": done, "total": total, "id": r.ID})
		})
		go a.liveState()
		return res, nil
	}))
	h.Handle("tweaks.revertAll", a.gated(func(args []json.RawMessage) (any, error) {
		cat, _ := arg[string](args, 0)
		res := a.engine.RevertAll(cat, func(done, total int, r engine.Result) {
			a.emit("progress", map[string]any{"op": "restore", "done": done, "total": total, "id": r.ID})
		})
		go a.liveState()
		return res, nil
	}))
	h.Handle("presets.apply", a.gated(func(args []json.RawMessage) (any, error) {
		id, _ := arg[string](args, 0)
		p := tweaks.PresetByID(id)
		if p == nil {
			return nil, errors.New("unknown preset")
		}
		a.restorePoint()
		res := a.engine.ApplyMany(p.Tweaks, func(done, total int, r engine.Result) {
			a.emit("progress", map[string]any{"op": "preset", "done": done, "total": total, "id": r.ID, "preset": id})
		})
		go a.liveState()
		return res, nil
	}))
	h.Handle("tools.action", a.gated(func(args []json.RawMessage) (any, error) {
		id, _ := arg[string](args, 0)
		act := tools.Find(a.actions, id)
		if act == nil {
			return nil, errors.New("unknown tool")
		}
		msg, err := act.Run(a.sys)
		if err != nil {
			return nil, err
		}
		if id == "ram_clean" {
			a.emit("guard", a.guard.Status())
		}
		return map[string]any{"id": id, "message": msg, "reboot": act.Reboot}, nil
	}))
	h.Handle("tools.ping", func(args []json.RawMessage) (any, error) {
		hosts, _ := arg[[]string](args, 0)
		res := tools.Ping(a.sys, tools.CleanHosts(hosts, config.PingHosts))
		raw, _ := json.Marshal(map[string]any{"at": time.Now().UnixMilli(), "results": res})
		a.settings.Update(func(d *settings.Data) { d.LastPing = raw })
		return res, nil
	})
	h.Handle("dns.scan", func(args []json.RawMessage) (any, error) {
		ids, _ := arg[[]string](args, 0)
		return a.dnsScan(ids)
	})
	h.Handle("guard.status", func(args []json.RawMessage) (any, error) { return a.guard.Status(), nil })
	h.Handle("guard.clean", a.gated(func(args []json.RawMessage) (any, error) {
		mb, err := a.guard.CleanNow()
		return map[string]any{"mb": mb}, err
	}))
	h.Handle("update.check", func(args []json.RawMessage) (any, error) { return a.updater.Check(), nil })
	h.Handle("update.download", func(args []json.RawMessage) (any, error) { return a.updater.Download(), nil })
	h.Handle("update.install", func(args []json.RawMessage) (any, error) {
		if err := a.updater.Install(); err != nil {
			return nil, err
		}
		_ = os.WriteFile(a.reopenMarker(), []byte("1"), 0o644)
		go func() {
			time.Sleep(400 * time.Millisecond)
			a.quitting = true
			a.app.Quit()
		}()
		return true, nil
	})
	h.Handle("settings.set", func(args []json.RawMessage) (any, error) {
		if len(args) == 0 {
			return a.settings.Get(), nil
		}
		d, err := a.settings.Patch(args[0])
		if err != nil {
			return nil, err
		}
		a.applySettings(d, false)
		return d, nil
	})
	h.Handle("system.info", func(args []json.RawMessage) (any, error) { return sysimpl.Info(runtime.NumCPU()), nil })
}

/* ---- DNS: ISP detection + the resolver benchmark ---- */

// detectISP: the server's view of the connection (Cloudflare ASN / organisation, cached 10 min), else the DHCP-assigned
// resolvers in the registry.
func (a *application) detectISP() string {
	a.ispMu.Lock()
	defer a.ispMu.Unlock()
	if time.Since(a.ispAt) < 10*time.Minute {
		return a.isp
	}
	a.ispAt = time.Now()
	a.isp = ""
	if n, err := a.auth.Net(); err == nil {
		a.isp = dns.ISPFromASN(n.ASN)
		if a.isp == "" {
			a.isp = dns.ISPFromOrg(n.Org)
		}
		if a.isp == "" && n.IP != "" {
			a.isp = dns.ISPFromIPs([]string{n.IP})
		}
	}
	if a.isp == "" {
		a.isp = dns.ISPFromIPs(dns.DHCPNameServers(a.sys))
	}
	return a.isp
}

// DNSScan is what dns.scan answers (and what settings.json caches as lastDns).
type DNSScan struct {
	At      int64        `json:"at"`
	ISP     string       `json:"isp"`
	ISPName string       `json:"ispName,omitempty"`
	Best    string       `json:"best"`
	Results []dns.Result `json:"results"`
}

// dnsScan benchmarks the resolvers (one run at a time) and remembers the outcome for the next start.
func (a *application) dnsScan(ids []string) (*DNSScan, error) {
	a.dnsMu.Lock()
	if a.dnsRun {
		a.dnsMu.Unlock()
		return nil, errors.New("a DNS scan is already running")
	}
	a.dnsRun = true
	a.dnsMu.Unlock()
	defer func() {
		a.dnsMu.Lock()
		a.dnsRun = false
		a.dnsMu.Unlock()
	}()
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	isp := a.detectISP()
	res := dns.Scan(ctx, ids, nil, dns.Options{})
	out := &DNSScan{At: time.Now().UnixMilli(), ISP: isp, ISPName: dns.ISPNames[isp], Best: dns.Best(res, isp), Results: res}
	if len(ids) == 0 {
		raw, _ := json.Marshal(out)
		a.settings.Update(func(d *settings.Data) { d.LastDNS = raw })
	}
	return out, nil
}

/* ---- tweak state: cached first paint + one live run at a time ---- */

type stateCache struct {
	At      int64          `json:"at"`
	Version string         `json:"version"`
	Tweaks  []engine.State `json:"tweaks"`
}

func (a *application) stateFile() string { return filepath.Join(a.dataDir, "state.json") }

func (a *application) cachedState() any {
	raw, err := os.ReadFile(a.stateFile())
	if err != nil {
		return nil
	}
	var c stateCache
	if json.Unmarshal(raw, &c) != nil || c.Version != config.Version {
		return nil
	}
	return c.Tweaks
}

// liveState checks every tweak (seconds on a slow PC), caches and broadcasts it. Parallel callers share one run.
func (a *application) liveState() []engine.State {
	a.stateMu.Lock()
	if a.stateRun {
		a.stateMu.Unlock()
		return nil
	}
	a.stateRun = true
	a.stateMu.Unlock()
	st := a.engine.State()
	raw, _ := json.Marshal(stateCache{At: time.Now().UnixMilli(), Version: config.Version, Tweaks: st})
	_ = os.WriteFile(a.stateFile(), raw, 0o644)
	a.stateMu.Lock()
	a.stateRun = false
	a.stateMu.Unlock()
	a.emit("state", st)
	return st
}

// restorePoint makes a System Restore point once per session, in the background, before the first batch of changes.
func (a *application) restorePoint() {
	a.restoreOnce.Do(func() {
		go func() {
			r, err := tools.RestorePoint(a.sys)
			switch {
			case err != nil:
				a.emit("restore", map[string]any{"status": "error", "error": err.Error()})
			case r.Skipped:
				a.emit("restore", map[string]any{"status": "skipped"})
			default:
				a.emit("restore", map[string]any{"status": "created"})
			}
		}()
	})
}
