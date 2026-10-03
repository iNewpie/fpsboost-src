//go:build windows

// Package sysimpl is the real Windows engine.Sys: the registry through the native API (microseconds, no reg.exe) and
// commands run without a console window.
package sysimpl

import (
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"golang.org/x/sys/windows/registry"

	"fpsboost.ir/app/internal/engine"
	"fpsboost.ir/app/internal/win"
)

// Windows implements engine.Sys.
type Windows struct{}

func root(key string) (registry.Key, string, string, error) {
	i := strings.IndexByte(key, '\\')
	r, path := key, ""
	if i >= 0 {
		r, path = key[:i], key[i+1:]
	}
	var prefix string
	switch strings.ToUpper(r) {
	case "HKLM", "HKEY_LOCAL_MACHINE":
		return registry.LOCAL_MACHINE, path, "HKLM", nil
	case "HKCU", "HKEY_CURRENT_USER":
		return registry.CURRENT_USER, path, "HKCU", nil
	case "HKU", "HKEY_USERS":
		return registry.USERS, path, "HKU", nil
	case "HKCR", "HKEY_CLASSES_ROOT":
		return registry.CLASSES_ROOT, path, "HKCR", nil
	}
	return 0, path, prefix, fmt.Errorf("unknown registry root in %q", key)
}

func typeName(t uint32) string {
	switch t {
	case registry.SZ:
		return "REG_SZ"
	case registry.EXPAND_SZ:
		return "REG_EXPAND_SZ"
	case registry.BINARY:
		return "REG_BINARY"
	case registry.DWORD:
		return "REG_DWORD"
	case registry.QWORD:
		return "REG_QWORD"
	case registry.MULTI_SZ:
		return "REG_MULTI_SZ"
	}
	return fmt.Sprintf("REG_%d", t)
}

func (Windows) RegGet(key, name string) (*engine.RegValue, error) {
	rk, path, _, err := root(key)
	if err != nil {
		return nil, err
	}
	k, err := registry.OpenKey(rk, path, registry.QUERY_VALUE)
	if err != nil {
		if errors.Is(err, registry.ErrNotExist) {
			return nil, nil
		}
		return nil, err
	}
	defer k.Close()
	_, t, err := k.GetValue(name, nil)
	if err != nil {
		if errors.Is(err, registry.ErrNotExist) {
			return nil, nil
		}
		return nil, err
	}
	v := &engine.RegValue{Type: typeName(t)}
	switch t {
	case registry.DWORD, registry.QWORD:
		n, _, err := k.GetIntegerValue(name)
		if err != nil {
			return nil, err
		}
		v.Value = n
	case registry.SZ, registry.EXPAND_SZ:
		s, _, err := k.GetStringValue(name)
		if err != nil {
			return nil, err
		}
		v.Value = s
	case registry.MULTI_SZ:
		s, _, err := k.GetStringsValue(name)
		if err != nil {
			return nil, err
		}
		v.Value = s
	default:
		b, _, err := k.GetBinaryValue(name)
		if err != nil {
			return nil, err
		}
		v.Value = hex.EncodeToString(b)
	}
	return v, nil
}

func (Windows) RegSet(key, name string, v engine.RegValue) error {
	rk, path, _, err := root(key)
	if err != nil {
		return err
	}
	k, _, err := registry.CreateKey(rk, path, registry.SET_VALUE)
	if err != nil {
		return fmt.Errorf("open %s: %w", key, err)
	}
	defer k.Close()
	switch strings.ToUpper(v.Type) {
	case "REG_DWORD":
		n, ok := engine.Num(v.Value)
		if !ok {
			return fmt.Errorf("%s\\%s: not a number", key, name)
		}
		return k.SetDWordValue(name, uint32(uint64(n)))
	case "REG_QWORD":
		n, ok := engine.Num(v.Value)
		if !ok {
			return fmt.Errorf("%s\\%s: not a number", key, name)
		}
		return k.SetQWordValue(name, uint64(n))
	case "REG_EXPAND_SZ":
		return k.SetExpandStringValue(name, fmt.Sprint(v.Value))
	case "REG_MULTI_SZ":
		var list []string
		switch x := v.Value.(type) {
		case []string:
			list = x
		case []any:
			for _, e := range x {
				list = append(list, fmt.Sprint(e))
			}
		default:
			list = []string{fmt.Sprint(x)}
		}
		return k.SetStringsValue(name, list)
	case "REG_BINARY":
		b, err := hex.DecodeString(fmt.Sprint(v.Value))
		if err != nil {
			return err
		}
		return k.SetBinaryValue(name, b)
	default:
		return k.SetStringValue(name, fmt.Sprint(v.Value))
	}
}

func (Windows) RegDel(key, name string) error {
	rk, path, _, err := root(key)
	if err != nil {
		return err
	}
	k, err := registry.OpenKey(rk, path, registry.SET_VALUE)
	if err != nil {
		if errors.Is(err, registry.ErrNotExist) {
			return nil
		}
		return err
	}
	defer k.Close()
	if err := k.DeleteValue(name); err != nil && !errors.Is(err, registry.ErrNotExist) {
		return err
	}
	return nil
}

func (Windows) RegSubkeys(key string) ([]string, error) {
	rk, path, prefix, err := root(key)
	if err != nil {
		return nil, err
	}
	k, err := registry.OpenKey(rk, path, registry.ENUMERATE_SUB_KEYS)
	if err != nil {
		if errors.Is(err, registry.ErrNotExist) {
			return nil, nil
		}
		return nil, err
	}
	defer k.Close()
	names, err := k.ReadSubKeyNames(-1)
	if err != nil {
		return nil, err
	}
	out := make([]string, 0, len(names))
	for _, n := range names {
		out = append(out, prefix+`\`+path+`\`+n)
	}
	return out, nil
}

func (Windows) Run(timeout time.Duration, cmd string, args ...string) engine.RunResult {
	return win.Run(timeout, cmd, args...)
}

// MachineGUID is Windows' per-install id (hashed with the host name into the account's device id).
func MachineGUID() string {
	v, _ := Windows{}.RegGet(`HKLM\SOFTWARE\Microsoft\Cryptography`, "MachineGuid")
	if v == nil {
		return ""
	}
	return fmt.Sprint(v.Value)
}

// SystemInfo is the "This PC" card.
type SystemInfo struct {
	OS    string `json:"os"`
	CPU   string `json:"cpu"`
	Cores int    `json:"cores"`
	RAMGB int    `json:"ramGb"`
	GPU   string `json:"gpu"`
}

// Info reads everything from the registry — no WMI, no PowerShell, a few milliseconds.
func Info(cores int) SystemInfo {
	s := Windows{}
	get := func(key, name string) string {
		v, _ := s.RegGet(key, name)
		if v == nil {
			return ""
		}
		return strings.TrimSpace(fmt.Sprint(v.Value))
	}
	cv := `HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion`
	osName := get(cv, "ProductName")
	build := get(cv, "CurrentBuildNumber")
	if b, ok := engine.Num(build); ok && b >= 22000 {
		osName = strings.Replace(osName, "Windows 10", "Windows 11", 1)
	}
	if dv := get(cv, "DisplayVersion"); dv != "" {
		osName += " " + dv
	}
	info := SystemInfo{OS: osName, Cores: cores, CPU: strings.Join(strings.Fields(get(`HKLM\HARDWARE\DESCRIPTION\System\CentralProcessor\0`, "ProcessorNameString")), " ")}
	total, _, _ := win.Memory()
	info.RAMGB = (total + 512) / 1024
	keys, _ := s.RegSubkeys(`HKLM\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}`)
	var gpus []string
	for _, k := range keys {
		if d := get(k, "DriverDesc"); d != "" && !strings.Contains(strings.ToLower(d), "basic display") {
			gpus = append(gpus, d)
		}
	}
	info.GPU = strings.Join(gpus, ", ")
	if info.GPU == "" {
		info.GPU = "?"
	}
	return info
}
