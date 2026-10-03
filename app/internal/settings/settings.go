// Package settings is the tiny JSON settings store (settings.json in the data folder).
package settings

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
)

// Window placement remembered between runs.
type Window struct {
	X, Y, W, H int  `json:"-"`
	Max        bool `json:"max"`
	Px         int  `json:"x"`
	Py         int  `json:"y"`
	Pw         int  `json:"w"`
	Ph         int  `json:"h"`
}

// Data is every setting with its default.
type Data struct {
	Lang          string          `json:"lang"`          // "" = follow Windows, "fa" | "en"
	Lite          bool            `json:"lite"`          // no shadows / gradients / animations in the UI
	AutoUpdate    bool            `json:"autoUpdate"`    // download updates in the background, install at quit
	CloseToTray   bool            `json:"closeToTray"`   // the X button hides to the tray instead of quitting
	Startup       bool            `json:"startup"`       // start with Windows (hidden, in the tray)
	Guard         bool            `json:"guard"`         // background optimizer on
	GuardPriority bool            `json:"guardPriority"` // raise the game's CPU priority
	GuardRAM      bool            `json:"guardRam"`      // free RAM when a game starts / memory is low
	GuardTimer    bool            `json:"guardTimer"`    // 0.5 ms timer while a game runs
	GuardEnforce  bool            `json:"guardEnforce"`  // re-apply tweaks Windows reverted
	LastPing      json.RawMessage `json:"lastPing,omitempty"`
	LastDNS       json.RawMessage `json:"lastDns,omitempty"` // the last DNS scan (dns.scan) for the first paint
	Win           Window          `json:"win"`
	LastVersion   string          `json:"lastVersion,omitempty"` // version that ran last (a change = "updated to …" toast)
	Seen          map[string]bool `json:"seen,omitempty"`        // one-time hints shown (tray balloon …)
}

func Defaults() Data {
	return Data{AutoUpdate: true, CloseToTray: true, Startup: true, Guard: true, GuardPriority: true, GuardRAM: true, GuardTimer: true, GuardEnforce: true}
}

// Store loads / saves settings.
type Store struct {
	file string
	mu   sync.Mutex
	data *Data
}

func New(file string) *Store { return &Store{file: file} }

func (s *Store) load() *Data {
	if s.data == nil {
		d := Defaults()
		if raw, err := os.ReadFile(s.file); err == nil {
			_ = json.Unmarshal(raw, &d)
		}
		s.data = &d
	}
	return s.data
}

// Get returns a copy.
func (s *Store) Get() Data {
	s.mu.Lock()
	defer s.mu.Unlock()
	return *s.load()
}

// Update mutates under the lock and saves.
func (s *Store) Update(fn func(d *Data)) Data {
	s.mu.Lock()
	defer s.mu.Unlock()
	d := s.load()
	fn(d)
	s.flush()
	return *d
}

// Patch applies a JSON object of known fields (from the UI) and saves. Unknown fields are ignored.
func (s *Store) Patch(raw json.RawMessage) (Data, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	d := s.load()
	// decode into a copy so a bad payload cannot half-apply
	cp := *d
	if err := json.Unmarshal(raw, &cp); err != nil {
		return *d, err
	}
	if cp.Lang != "" && cp.Lang != "fa" && cp.Lang != "en" {
		cp.Lang = ""
	}
	*d = cp
	s.flush()
	return *d, nil
}

func (s *Store) flush() {
	if s.file == "" {
		return
	}
	_ = os.MkdirAll(filepath.Dir(s.file), 0o755)
	raw, _ := json.MarshalIndent(s.data, "", " ")
	_ = os.WriteFile(s.file, raw, 0o644)
}
