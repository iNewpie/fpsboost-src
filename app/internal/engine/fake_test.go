package engine_test

import (
	"fmt"
	"strings"
	"sync"
	"time"

	. "fpsboost.ir/app/internal/engine"
)

// Fake is an in-memory Windows: a registry map plus canned command answers. Shared by the engine, tweaks and tools tests.
type Fake struct {
	mu    sync.Mutex
	Reg   map[string]RegValue // key + "\\" + name (lower-cased) → value
	Keys  map[string]bool     // existing keys (lower-cased)
	Calls [][]string
	Cmd   func(cmd string, args []string) RunResult
}

func NewFake() *Fake {
	return &Fake{Reg: map[string]RegValue{}, Keys: map[string]bool{}}
}

func norm(key string) string {
	k := strings.ToLower(strings.TrimRight(key, `\`))
	k = strings.Replace(k, "hkey_local_machine", "hklm", 1)
	k = strings.Replace(k, "hkey_current_user", "hkcu", 1)
	return k
}

func (f *Fake) Set(key, name string, v RegValue) {
	f.mu.Lock()
	defer f.mu.Unlock()
	k := norm(key)
	f.Keys[k] = true
	f.Reg[k+`\`+strings.ToLower(name)] = v
}

func (f *Fake) RegGet(key, name string) (*RegValue, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	v, ok := f.Reg[norm(key)+`\`+strings.ToLower(name)]
	if !ok {
		return nil, nil
	}
	cp := v
	return &cp, nil
}

func (f *Fake) RegSet(key, name string, v RegValue) error {
	f.Set(key, name, v)
	return nil
}

func (f *Fake) RegDel(key, name string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	delete(f.Reg, norm(key)+`\`+strings.ToLower(name))
	return nil
}

func (f *Fake) RegSubkeys(key string) ([]string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	k := norm(key)
	seen := map[string]bool{}
	var out []string
	for kk := range f.Keys {
		if strings.HasPrefix(kk, k+`\`) {
			rest := strings.TrimPrefix(kk, k+`\`)
			first := strings.SplitN(rest, `\`, 2)[0]
			if !seen[first] {
				seen[first] = true
				out = append(out, key+`\`+first)
			}
		}
	}
	return out, nil
}

func (f *Fake) Run(_ time.Duration, cmd string, args ...string) RunResult {
	f.mu.Lock()
	f.Calls = append(f.Calls, append([]string{cmd}, args...))
	h := f.Cmd
	f.mu.Unlock()
	if h != nil {
		return h(cmd, args)
	}
	return RunResult{Code: 1, Err: fmt.Sprintf("%s: not faked", cmd)}
}

// HasCall reports whether a command with these leading args ran.
func (f *Fake) HasCall(parts ...string) bool {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, c := range f.Calls {
		if len(c) >= len(parts) {
			ok := true
			for i, p := range parts {
				if c[i] != p {
					ok = false
					break
				}
			}
			if ok {
				return true
			}
		}
	}
	return false
}
