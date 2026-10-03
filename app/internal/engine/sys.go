// Package engine runs tweaks (check / apply / revert) against a Sys: the real Windows registry + commands, or a fake in
// tests. Every apply stores the original values in the backup file first and revert puts them back, so the user can
// always return to exactly where they started — even after a reinstall.
package engine

import (
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"
)

// RegValue is a registry value as the backup file stores it: {"type":"REG_DWORD","value":1}. Numbers come back from
// JSON as float64, from the live registry as uint32/uint64 — compare with Same().
type RegValue struct {
	Type  string `json:"type"`
	Value any    `json:"value"`
}

// RunResult is what a hidden command returned.
type RunResult struct {
	Out  string
	Err  string
	Code int
}

func (r RunResult) Text() string { return strings.TrimSpace(r.Err + "\n" + r.Out) }

// Sys is the OS surface the engine touches. Keys look like `HKLM\SOFTWARE\...` (HKLM / HKCU / HKEY_LOCAL_MACHINE /
// HKEY_CURRENT_USER). RegGet returns (nil, nil) for a missing key or value.
type Sys interface {
	RegGet(key, name string) (*RegValue, error)
	RegSet(key, name string, v RegValue) error
	RegDel(key, name string) error
	RegSubkeys(key string) ([]string, error)
	Run(timeout time.Duration, cmd string, args ...string) RunResult
}

// Must runs a command and fails when it does not exit 0.
func Must(s Sys, timeout time.Duration, cmd string, args ...string) (RunResult, error) {
	r := s.Run(timeout, cmd, args...)
	if r.Code != 0 {
		return r, fmt.Errorf("%s %s failed (%d): %s", cmd, strings.Join(args, " "), r.Code, clip(r.Text(), 200))
	}
	return r, nil
}

// PS runs a PowerShell snippet and returns its stdout.
func PS(s Sys, timeout time.Duration, script string) (string, error) {
	r := s.Run(timeout, "powershell", "-NoProfile", "-NonInteractive", "-Command", script)
	if r.Code != 0 {
		return "", fmt.Errorf("powershell failed: %s", clip(r.Text(), 300))
	}
	return r.Out, nil
}

func clip(s string, n int) string {
	s = strings.TrimSpace(s)
	if len(s) > n {
		return s[:n] + "…"
	}
	return s
}

// Num converts any JSON / registry number to float64. ok=false for non-numbers.
func Num(v any) (float64, bool) {
	switch x := v.(type) {
	case float64:
		return x, true
	case float32:
		return float64(x), true
	case int:
		return float64(x), true
	case int32:
		return float64(x), true
	case int64:
		return float64(x), true
	case uint32:
		return float64(x), true
	case uint64:
		return float64(x), true
	case uint:
		return float64(x), true
	case string: // "0x26" style from reg.exe era backups
		if strings.HasPrefix(strings.ToLower(x), "0x") {
			if n, err := strconv.ParseUint(x[2:], 16, 64); err == nil {
				return float64(n), true
			}
		}
	}
	return 0, false
}

// Same compares a live value with a wanted one: numbers numerically, everything else as text.
func Same(a, b any) bool {
	if fa, ok := Num(a); ok {
		if fb, ok2 := Num(b); ok2 {
			return math.Abs(fa-fb) < 0.5
		}
	}
	return fmt.Sprint(a) == fmt.Sprint(b)
}
