package engine

import (
	"errors"
	"fmt"
	"sort"
	"sync"
	"time"
)

// Text is a bilingual string.
type Text struct {
	En string `json:"en"`
	Fa string `json:"fa"`
}

// Meta is what the UI sees of a tweak.
type Meta struct {
	ID            string            `json:"id"`
	Category      string            `json:"category"` // fps | network
	Level         string            `json:"level"`    // safe | advanced
	Recommended   bool              `json:"recommended"`
	Reboot        bool              `json:"reboot,omitempty"`
	Title         Text              `json:"title"`
	Desc          Text              `json:"desc"`
	Options       map[string]string `json:"options,omitempty"`
	DefaultOption string            `json:"defaultOption,omitempty"`
	Icon          string            `json:"icon,omitempty"`
}

// Tweak = meta + behaviour.
type Tweak struct {
	Meta
	Check  func(c *Ctx) (bool, error)
	Apply  func(c *Ctx) error
	Revert func(c *Ctx) error

	regValues []RegVal // set by RegTweak: a declarative registry tweak (cheap to check, safe to re-apply)
}

// Ctx is handed to a tweak's functions.
type Ctx struct {
	Sys    Sys
	Backup *Backup
	Option string
	ID     string
}

// State is one row of the UI list.
type State struct {
	Meta
	Applied   *bool  `json:"applied"` // nil = unknown (check failed)
	Error     string `json:"error,omitempty"`
	HasBackup bool   `json:"hasBackup"`
}

// Result of an apply / revert.
type Result struct {
	ID      string `json:"id"`
	Applied *bool  `json:"applied,omitempty"`
	Reboot  bool   `json:"reboot,omitempty"`
	Error   string `json:"error,omitempty"`
	Skipped bool   `json:"skipped,omitempty"` // ApplyMissing: it was already on, nothing was run
}

// Engine runs the tweaks.
type Engine struct {
	Tweaks []*Tweak
	Sys    Sys
	Backup *Backup
	mu     sync.Mutex // one apply / revert at a time
}

func New(tweaks []*Tweak, sys Sys, backup *Backup) *Engine {
	return &Engine{Tweaks: tweaks, Sys: sys, Backup: backup}
}

func (e *Engine) Find(id string) (*Tweak, error) {
	for _, t := range e.Tweaks {
		if t.ID == id {
			return t, nil
		}
	}
	return nil, fmt.Errorf("unknown tweak %q", id)
}

func (e *Engine) ctx(id, option string) *Ctx {
	return &Ctx{Sys: e.Sys, Backup: e.Backup, Option: option, ID: id}
}

// State checks every tweak, several at a time (PowerShell ones take a second or two each).
func (e *Engine) State() []State {
	out := make([]State, len(e.Tweaks))
	var wg sync.WaitGroup
	sem := make(chan struct{}, 6)
	for i, t := range e.Tweaks {
		wg.Add(1)
		go func(i int, t *Tweak) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			st := State{Meta: t.Meta, HasBackup: e.Backup.Has(t.ID)}
			applied, err := t.Check(e.ctx(t.ID, ""))
			if err != nil {
				st.Error = err.Error()
			} else {
				st.Applied = &applied
			}
			out[i] = st
		}(i, t)
	}
	wg.Wait()
	return out
}

// Apply runs a tweak (option = e.g. the DNS provider) and reports its state afterwards.
func (e *Engine) Apply(id, option string) Result {
	e.mu.Lock()
	defer e.mu.Unlock()
	t, err := e.Find(id)
	if err != nil {
		return Result{ID: id, Error: err.Error()}
	}
	if option == "" {
		option = t.DefaultOption
	}
	if err := t.Apply(e.ctx(id, option)); err != nil {
		return Result{ID: id, Error: err.Error(), Reboot: t.Reboot}
	}
	applied, _ := t.Check(e.ctx(id, option))
	return Result{ID: id, Applied: &applied, Reboot: t.Reboot}
}

// Revert puts the original values back.
func (e *Engine) Revert(id string) Result {
	e.mu.Lock()
	defer e.mu.Unlock()
	t, err := e.Find(id)
	if err != nil {
		return Result{ID: id, Error: err.Error()}
	}
	if err := t.Revert(e.ctx(id, "")); err != nil {
		return Result{ID: id, Error: err.Error(), Reboot: t.Reboot}
	}
	applied, _ := t.Check(e.ctx(id, ""))
	return Result{ID: id, Applied: &applied, Reboot: t.Reboot}
}

// ApplyMany applies the given ids in order; errors are per item, never fatal. progress (optional) is called after each.
func (e *Engine) ApplyMany(ids []string, progress func(done, total int, r Result)) []Result {
	out := make([]Result, 0, len(ids))
	for i, id := range ids {
		r := e.Apply(id, "")
		out = append(out, r)
		if progress != nil {
			progress(i+1, len(ids), r)
		}
	}
	return out
}

// ApplyMissing is ApplyMany for presets: a tweak that is already on is reported as Skipped instead of being run again
// (re-running the PowerShell ones costs seconds, re-running dns_fast would scan again). progress is called for every id.
func (e *Engine) ApplyMissing(ids []string, progress func(done, total int, r Result)) []Result {
	out := make([]Result, 0, len(ids))
	for i, id := range ids {
		var r Result
		if t, err := e.Find(id); err != nil {
			r = Result{ID: id, Error: err.Error()}
		} else if on, err := t.Check(e.ctx(id, "")); err == nil && on {
			yes := true
			r = Result{ID: id, Applied: &yes, Skipped: true}
		} else {
			r = e.Apply(id, "")
		}
		out = append(out, r)
		if progress != nil {
			progress(i+1, len(ids), r)
		}
	}
	return out
}

// Recommended lists the recommended tweak ids of a category ("" = all).
func (e *Engine) Recommended(category string) []string {
	var ids []string
	for _, t := range e.Tweaks {
		if t.Recommended && (category == "" || t.Category == category) {
			ids = append(ids, t.ID)
		}
	}
	return ids
}

// RevertAll reverts every tweak of a category that is applied or has a backup.
func (e *Engine) RevertAll(category string, progress func(done, total int, r Result)) []Result {
	var todo []string
	for _, t := range e.Tweaks {
		if category != "" && t.Category != category {
			continue
		}
		applied, _ := t.Check(e.ctx(t.ID, ""))
		if applied || e.Backup.Has(t.ID) {
			todo = append(todo, t.ID)
		}
	}
	out := make([]Result, 0, len(todo))
	for i, id := range todo {
		r := e.Revert(id)
		out = append(out, r)
		if progress != nil {
			progress(i+1, len(todo), r)
		}
	}
	return out
}

// Enforce re-applies registry tweaks the user had applied (they have a backup) that Windows reverted — Windows Update
// loves to turn Game DVR back on. Only cheap registry tweaks are considered. Returns the ids it re-applied.
func (e *Engine) Enforce() []string {
	var fixed []string
	for _, t := range e.Tweaks {
		if !t.Enforceable() || !e.Backup.Has(t.ID) {
			continue
		}
		applied, err := t.Check(e.ctx(t.ID, ""))
		if err != nil || applied {
			continue
		}
		if r := e.Apply(t.ID, ""); r.Error == "" {
			fixed = append(fixed, t.ID)
		}
	}
	sort.Strings(fixed)
	return fixed
}

// Enforceable: pure registry tweaks (they carry a Values list).
func (t *Tweak) Enforceable() bool { return t.regValues != nil }

var errNotAvailable = errors.New("not available on this PC")

// timeouts
const (
	shortTimeout = 20 * time.Second
	longTimeout  = 90 * time.Second
)
