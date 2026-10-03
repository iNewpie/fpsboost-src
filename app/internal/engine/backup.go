package engine

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sync"
)

// Backup is the file of original values: {"<tweak id>": <whatever the tweak stored>}. The FIRST original wins —
// applying twice never overwrites what the user started with. The format is the Electron app's backup.json.
type Backup struct {
	file string
	mu   sync.Mutex
	data map[string]json.RawMessage
}

func NewBackup(file string) *Backup { return &Backup{file: file} }

func (b *Backup) load() {
	if b.data != nil {
		return
	}
	b.data = map[string]json.RawMessage{}
	raw, err := os.ReadFile(b.file)
	if err != nil {
		return
	}
	_ = json.Unmarshal(raw, &b.data)
}

func (b *Backup) flush() error {
	if b.file == "" {
		return nil
	}
	if err := os.MkdirAll(filepath.Dir(b.file), 0o755); err != nil {
		return err
	}
	raw, _ := json.MarshalIndent(b.data, "", " ")
	tmp := b.file + ".tmp"
	if err := os.WriteFile(tmp, raw, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, b.file)
}

// Has reports whether an original is stored for the tweak.
func (b *Backup) Has(id string) bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.load()
	_, ok := b.data[id]
	return ok
}

// Get decodes the stored original into v. false when there is none.
func (b *Backup) Get(id string, v any) bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.load()
	raw, ok := b.data[id]
	if !ok {
		return false
	}
	return json.Unmarshal(raw, v) == nil
}

// SaveOnce stores the original unless one is already there. Returns true when it wrote.
func (b *Backup) SaveOnce(id string, v any) (bool, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.load()
	if _, ok := b.data[id]; ok {
		return false, nil
	}
	raw, err := json.Marshal(v)
	if err != nil {
		return false, err
	}
	b.data[id] = raw
	return true, b.flush()
}

// Replace overwrites the stored original (used when a tweak re-targets, e.g. the power plan it activated).
func (b *Backup) Replace(id string, v any) error {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.load()
	raw, err := json.Marshal(v)
	if err != nil {
		return err
	}
	b.data[id] = raw
	return b.flush()
}

// Clear forgets the original (after a revert).
func (b *Backup) Clear(id string) error {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.load()
	if _, ok := b.data[id]; !ok {
		return nil
	}
	delete(b.data, id)
	return b.flush()
}

// ClearAll forgets every original — after the user loaded a restore snapshot the stored originals are stale, and the
// Guard must not re-apply tweaks on top of the restored system.
func (b *Backup) ClearAll() error {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.data = map[string]json.RawMessage{}
	return b.flush()
}

// IDs lists the tweaks that have an original stored.
func (b *Backup) IDs() []string {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.load()
	out := make([]string, 0, len(b.data))
	for k := range b.data {
		out = append(out, k)
	}
	return out
}

var ErrNoBackup = errors.New("no backup")
