//go:build windows

// Package guard is the background optimizer: a cheap loop (every 2 s) that notices when a game is in the foreground,
// raises its CPU priority, requests a 0.5 ms timer, frees RAM when the game starts or memory runs low, and re-applies
// tweaks Windows reverted. It is what keeps running in the tray.
package guard

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"fpsboost.ir/app/internal/tweaks"
	"fpsboost.ir/app/internal/win"
)

// Options mirror the settings.
type Options struct {
	Enabled, Priority, RAM, Timer, Enforce bool
}

// Event is one line of the guard log.
type Event struct {
	At   int64  `json:"at"`
	Kind string `json:"kind"` // game | ram | enforce | info
	Game string `json:"game,omitempty"`
	Text string `json:"text"`
	Fa   string `json:"fa"`
	MB   int    `json:"mb,omitempty"`
}

// Status is what the UI shows.
type Status struct {
	Enabled     bool    `json:"enabled"`
	Game        string  `json:"game"`     // friendly name of the running game ("" = none)
	GameExe     string  `json:"gameExe"`  //
	Since       int64   `json:"since"`    // ms when the game was detected
	Boosted     int     `json:"boosted"`  // games boosted (lifetime)
	FreedMB     int     `json:"freedMb"`  // RAM freed (lifetime)
	Enforced    int     `json:"enforced"` // tweaks re-applied (lifetime)
	TotalMB     int     `json:"totalMb"`
	AvailMB     int     `json:"availMb"`
	Load        int     `json:"load"`
	Events      []Event `json:"events"`
	Timer       bool    `json:"timer"`
	LastCleanAt int64   `json:"lastCleanAt"`
}

type persisted struct {
	Boosted  int     `json:"boosted"`
	FreedMB  int     `json:"freedMb"`
	Enforced int     `json:"enforced"`
	Events   []Event `json:"events"`
}

// Guard is the loop.
type Guard struct {
	file        string
	opts        Options
	mu          sync.Mutex
	st          Status
	p           persisted
	game        *session
	stop        chan struct{}
	running     bool
	Active      func() bool     // subscription gate
	Enforce     func() []string // engine.Enforce
	OnChange    func(Status)
	lastEnforce time.Time
	lastClean   time.Time
	ourPID      uint32
}

type session struct {
	pid      uint32
	exe      string
	name     string
	prevPrio uint32
	since    time.Time
	lastSeen time.Time
	boosted  bool
}

// New loads the persisted counters.
func New(file string) *Guard {
	g := &Guard{file: file, stop: make(chan struct{}), ourPID: uint32(os.Getpid())}
	if raw, err := os.ReadFile(file); err == nil {
		_ = json.Unmarshal(raw, &g.p)
	}
	return g
}

func (g *Guard) save() {
	raw, _ := json.Marshal(g.p)
	_ = os.MkdirAll(filepath.Dir(g.file), 0o755)
	_ = os.WriteFile(g.file, raw, 0o644)
}

// SetOptions updates behaviour live.
func (g *Guard) SetOptions(o Options) {
	g.mu.Lock()
	was := g.opts
	g.opts = o
	g.mu.Unlock()
	if was.Enabled && !o.Enabled {
		g.release()
	}
	if (!was.Timer || !was.Enabled) && o.Timer && o.Enabled {
		g.mu.Lock()
		hasGame := g.game != nil
		g.mu.Unlock()
		if hasGame {
			win.TimerResolution(true)
		}
	}
	g.publish()
}

// Start runs the loop in a goroutine.
func (g *Guard) Start() {
	g.mu.Lock()
	if g.running {
		g.mu.Unlock()
		return
	}
	g.running = true
	g.mu.Unlock()
	go g.loop()
}

// Stop ends the loop and undoes priority / timer changes.
func (g *Guard) Stop() {
	g.mu.Lock()
	if !g.running {
		g.mu.Unlock()
		return
	}
	g.running = false
	close(g.stop)
	g.mu.Unlock()
	g.release()
}

func (g *Guard) loop() {
	t := time.NewTicker(2 * time.Second)
	defer t.Stop()
	g.tick()
	for {
		select {
		case <-g.stop:
			return
		case <-t.C:
			g.tick()
		}
	}
}

func (g *Guard) event(e Event) {
	e.At = time.Now().UnixMilli()
	g.p.Events = append([]Event{e}, g.p.Events...)
	if len(g.p.Events) > 40 {
		g.p.Events = g.p.Events[:40]
	}
}

// Status snapshot.
func (g *Guard) Status() Status {
	g.mu.Lock()
	defer g.mu.Unlock()
	return g.snapshot()
}

func (g *Guard) snapshot() Status {
	s := g.st
	s.Enabled = g.opts.Enabled
	s.Boosted, s.FreedMB, s.Enforced = g.p.Boosted, g.p.FreedMB, g.p.Enforced
	s.Events = append([]Event{}, g.p.Events...)
	s.TotalMB, s.AvailMB, s.Load = win.Memory()
	if g.game != nil {
		s.Game, s.GameExe, s.Since = g.game.name, g.game.exe, g.game.since.UnixMilli()
	} else {
		s.Game, s.GameExe, s.Since = "", "", 0
	}
	s.LastCleanAt = g.lastClean.UnixMilli()
	if g.lastClean.IsZero() {
		s.LastCleanAt = 0
	}
	return s
}

func (g *Guard) publish() {
	if g.OnChange != nil {
		g.OnChange(g.Status())
	}
}

var notGames = map[string]bool{
	"explorer.exe": true, "dwm.exe": true, "searchhost.exe": true, "startmenuexperiencehost.exe": true, "shellexperiencehost.exe": true,
	"chrome.exe": true, "msedge.exe": true, "firefox.exe": true, "opera.exe": true, "brave.exe": true, "msedgewebview2.exe": true,
	"vlc.exe": true, "mpc-hc64.exe": true, "potplayermini64.exe": true, "wmplayer.exe": true, "spotify.exe": true, "discord.exe": true,
	"code.exe": true, "devenv.exe": true, "powerpnt.exe": true, "winword.exe": true, "excel.exe": true, "acrobat.exe": true,
	"lockapp.exe": true, "logonui.exe": true, "taskmgr.exe": true, "applicationframehost.exe": true, "steam.exe": true,
	"epicgameslauncher.exe": true, "battle.net.exe": true, "riotclientservices.exe": true, "obs64.exe": true, "fpsboost.exe": true,
	"textinputhost.exe": true, "systemsettings.exe": true, "telegram.exe": true, "whatsapp.exe": true, "zoom.exe": true,
}

func (g *Guard) tick() {
	g.mu.Lock()
	o := g.opts
	g.mu.Unlock()
	if !o.Enabled || (g.Active != nil && !g.Active()) {
		if g.game != nil {
			g.release()
		}
		return
	}
	pid, exe, fullscreen, _ := win.Foreground()
	name, known := tweaks.GameExes[exe]
	isGame := pid != 0 && pid != g.ourPID && (known || (fullscreen && !notGames[exe] && exe != ""))
	if isGame && !known {
		name = strings.TrimSuffix(exe, ".exe")
	}
	g.mu.Lock()
	cur := g.game
	g.mu.Unlock()
	switch {
	case isGame && (cur == nil || cur.pid != pid):
		g.startSession(pid, exe, name, o)
	case isGame && cur != nil:
		cur.lastSeen = time.Now()
		g.maybeClean(o, false)
	case !isGame && cur != nil:
		// alt-tabbed? keep the session while the process lives (up to 5 min out of focus)
		alive := false
		for _, p := range win.Processes() {
			if p.PID == cur.pid {
				alive = true
				break
			}
		}
		if !alive || time.Since(cur.lastSeen) > 5*time.Minute {
			g.endSession()
		}
	default:
		g.maybeClean(o, false)
	}
	if o.Enforce && g.Enforce != nil && time.Since(g.lastEnforce) > 30*time.Minute {
		g.lastEnforce = time.Now()
		go func() {
			fixed := g.Enforce()
			if len(fixed) > 0 {
				g.mu.Lock()
				g.p.Enforced += len(fixed)
				g.event(Event{Kind: "enforce", Text: "Re-applied " + strings.Join(fixed, ", "), Fa: "دوباره اعمال شد: " + strings.Join(fixed, "، ")})
				g.save()
				g.mu.Unlock()
				g.publish()
			}
		}()
	}
}

func (g *Guard) startSession(pid uint32, exe, name string, o Options) {
	if g.game != nil {
		g.release()
	}
	s := &session{pid: pid, exe: exe, name: name, since: time.Now(), lastSeen: time.Now()}
	if o.Priority {
		if prev, err := win.SetPriority(pid, win.HIGH_PRIORITY_CLASS); err == nil {
			s.prevPrio = prev
			s.boosted = true
		}
	}
	if o.Timer {
		win.TimerResolution(true)
	}
	g.mu.Lock()
	g.game = s
	g.p.Boosted++
	g.st.Timer = o.Timer
	g.event(Event{Kind: "game", Game: name, Text: name + " detected — priority high, 0.5 ms timer", Fa: name + " شناسایی شد — اولویت بالا، تایمر ۰٫۵ms"})
	g.save()
	g.mu.Unlock()
	g.publish()
	if o.RAM {
		go g.clean(name)
	}
}

func (g *Guard) endSession() {
	g.release()
	g.publish()
}

// release undoes priority / timer for the current session.
func (g *Guard) release() {
	g.mu.Lock()
	s := g.game
	g.game = nil
	g.st.Timer = false
	g.mu.Unlock()
	if s == nil {
		return
	}
	win.TimerResolution(false)
	if s.boosted && s.prevPrio != 0 {
		_, _ = win.SetPriority(s.pid, s.prevPrio)
	}
}

// maybeClean frees RAM when it runs low (at most every 10 minutes).
func (g *Guard) maybeClean(o Options, force bool) {
	if !o.RAM {
		return
	}
	_, avail, load := win.Memory()
	if force || (load >= 88 && avail < 1500 && time.Since(g.lastClean) > 10*time.Minute) {
		g.mu.Lock()
		name := ""
		if g.game != nil {
			name = g.game.name
		}
		g.mu.Unlock()
		go g.clean(name)
	}
}

// clean trims every other process's working set and purges the standby list. Returns MB freed.
func (g *Guard) clean(game string) int {
	g.mu.Lock()
	if time.Since(g.lastClean) < 20*time.Second {
		g.mu.Unlock()
		return 0
	}
	g.lastClean = time.Now()
	gamePID := uint32(0)
	if g.game != nil {
		gamePID = g.game.pid
	}
	g.mu.Unlock()
	_, before, _ := win.Memory()
	for _, p := range win.Processes() {
		if p.PID <= 4 || p.PID == g.ourPID || p.PID == gamePID || critical[p.Exe] {
			continue
		}
		win.EmptyWorkingSet(p.PID)
	}
	win.PurgeStandbyList()
	time.Sleep(400 * time.Millisecond)
	_, after, _ := win.Memory()
	freed := after - before
	if freed < 0 {
		freed = 0
	}
	g.mu.Lock()
	g.p.FreedMB += freed
	txt := "Freed " + mb(freed) + " of RAM"
	fa := mb(freed) + " رم آزاد شد"
	if game != "" {
		txt += " for " + game
		fa += " برای " + game
	}
	g.event(Event{Kind: "ram", Game: game, Text: txt, Fa: fa, MB: freed})
	g.save()
	g.mu.Unlock()
	g.publish()
	return freed
}

// CleanNow is the manual "Free RAM" tool.
func (g *Guard) CleanNow() (int, error) {
	g.mu.Lock()
	g.lastClean = time.Time{}
	name := ""
	if g.game != nil {
		name = g.game.name
	}
	g.mu.Unlock()
	return g.clean(name), nil
}

func mb(n int) string {
	if n >= 1024 {
		return strings.TrimSuffix(strings.TrimRight(func() string { return trim(float64(n) / 1024) }(), "0"), ".") + " GB"
	}
	return itoa(n) + " MB"
}

func trim(f float64) string { return strings.TrimRight(strings.TrimRight(fmtFloat(f), "0"), ".") }

func fmtFloat(f float64) string {
	b, _ := json.Marshal(float64(int(f*10)) / 10)
	return string(b)
}

func itoa(n int) string {
	b, _ := json.Marshal(n)
	return string(b)
}

var critical = map[string]bool{
	"system": true, "registry": true, "smss.exe": true, "csrss.exe": true, "wininit.exe": true, "winlogon.exe": true, "services.exe": true,
	"lsass.exe": true, "svchost.exe": true, "dwm.exe": true, "fontdrvhost.exe": true, "memory compression": true, "secure system": true,
	"audiodg.exe": true, "msmpeng.exe": true, "nvcontainer.exe": true, "nvdisplay.container.exe": true, "msedgewebview2.exe": true,
	"explorer.exe": true, "sihost.exe": true, "ctfmon.exe": true, "conhost.exe": true, "spoolsv.exe": true, "wudfhost.exe": true,
}
