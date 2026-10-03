// Package restore is the safety net the app builds BEFORE its first change to a PC: a Windows System Restore point plus
// a local snapshot in %APPDATA%\fpsboost\restore — a .reg file of every registry tree the tweaks touch (with "=-"
// lines that remove the values the tweaks would add), the active power plan exported as .pow, and a README. The user
// can double-click the .reg file even when the app no longer starts; Load() does the same from inside the app.
package restore

import (
	"encoding/binary"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
	"unicode/utf16"

	"fpsboost.ir/app/internal/engine"
)

// Info describes one snapshot (stored in settings.json, shown on the home page).
type Info struct {
	At        int64  `json:"at"`                  // unix ms
	Dir       string `json:"dir"`                 // the restore folder
	RegFile   string `json:"regFile"`             // restore-<stamp>.reg
	PowerFile string `json:"powerFile,omitempty"` // power-<stamp>.pow ("" when powercfg could not export)
	Scheme    string `json:"scheme,omitempty"`    // active power scheme GUID at snapshot time
	Windows   string `json:"windows"`             // the System Restore point: created | skipped | unavailable: <why>
	Keys      int    `json:"keys"`                // registry trees exported
	Pins      int    `json:"pins"`                // individual values recorded
}

// Trees collects the registry trees a set of tweaks touches: declarative values' keys, service keys, and the trees
// hand-written tweaks declared with WithTrees. Sorted, de-duplicated, parents swallow children.
func Trees(tweaks []*engine.Tweak) []string {
	seen := map[string]string{}
	add := func(k string) {
		k = strings.TrimRight(k, `\`)
		if k != "" {
			seen[strings.ToLower(k)] = k
		}
	}
	for _, t := range tweaks {
		for _, v := range t.RegValues() {
			add(v.Key)
		}
		for _, s := range t.Services() {
			add(`HKLM\SYSTEM\CurrentControlSet\Services\` + s)
		}
		for _, k := range t.Trees() {
			add(k)
		}
	}
	keys := make([]string, 0, len(seen))
	for lk := range seen {
		keys = append(keys, lk)
	}
	sort.Strings(keys)
	var out []string
	for _, lk := range keys {
		if n := len(out); n > 0 && strings.HasPrefix(lk, strings.ToLower(out[n-1])+`\`) {
			continue // a parent is already exported
		}
		out = append(out, seen[lk])
	}
	return out
}

// Pin is one registry value as it is right now (Val nil = it does not exist, so importing the snapshot deletes it).
type Pin struct {
	Key, Name string
	Val       *engine.RegValue
}

// Pins reads the current state of every value the tweaks can write — the part of the snapshot that is exact even when
// reg.exe could not export a tree (the network class key has SYSTEM-only subkeys, some PCs block reg.exe).
func Pins(s engine.Sys, tweaks []*engine.Tweak) []Pin {
	var out []Pin
	seen := map[string]bool{}
	for _, t := range tweaks {
		for _, v := range t.Pins(s) {
			id := strings.ToLower(v.Key + `\` + v.Name)
			if seen[id] {
				continue
			}
			seen[id] = true
			cur, err := s.RegGet(v.Key, v.Name)
			if err != nil {
				continue
			}
			out = append(out, Pin{Key: v.Key, Name: v.Name, Val: cur})
		}
	}
	return out
}

// regLine renders one value in .reg syntax ("Name"=… or @=… for the default value).
func regLine(p Pin) string {
	name := "@"
	if p.Name != "" {
		name = `"` + regEsc(p.Name) + `"`
	}
	if p.Val == nil {
		return name + "=-"
	}
	switch strings.ToUpper(p.Val.Type) {
	case "REG_DWORD":
		n, _ := engine.Num(p.Val.Value)
		return fmt.Sprintf("%s=dword:%08x", name, uint32(uint64(n)))
	case "REG_QWORD":
		n, _ := engine.Num(p.Val.Value)
		return name + "=hex(b):" + hexBytes(le64(uint64(n)))
	case "REG_SZ":
		return name + `="` + regEsc(fmt.Sprint(p.Val.Value)) + `"`
	case "REG_EXPAND_SZ":
		return name + "=hex(2):" + hexBytes(utf16z(fmt.Sprint(p.Val.Value)))
	case "REG_MULTI_SZ":
		var b []byte
		for _, line := range multi(p.Val.Value) {
			b = append(b, utf16z(line)...)
		}
		return name + "=hex(7):" + hexBytes(append(b, 0, 0))
	default: // REG_BINARY and anything else: RegGet stores it as hex text
		raw := strings.ToLower(fmt.Sprint(p.Val.Value))
		var parts []string
		for i := 0; i+1 < len(raw); i += 2 {
			parts = append(parts, raw[i:i+2])
		}
		return name + "=hex:" + strings.Join(parts, ",")
	}
}

func regEsc(s string) string { return strings.NewReplacer(`\`, `\\`, `"`, `\"`).Replace(s) }

func hexBytes(b []byte) string {
	parts := make([]string, len(b))
	for i, c := range b {
		parts[i] = fmt.Sprintf("%02x", c)
	}
	return strings.Join(parts, ",")
}

func utf16z(s string) []byte {
	u := utf16.Encode([]rune(s))
	b := make([]byte, 0, 2*len(u)+2)
	for _, c := range u {
		b = append(b, byte(c), byte(c>>8))
	}
	return append(b, 0, 0)
}

func le64(n uint64) []byte {
	b := make([]byte, 8)
	binary.LittleEndian.PutUint64(b, n)
	return b
}

func multi(v any) []string {
	switch x := v.(type) {
	case []string:
		return x
	case []any:
		out := make([]string, 0, len(x))
		for _, e := range x {
			out = append(out, fmt.Sprint(e))
		}
		return out
	case string:
		return []string{x}
	}
	return nil
}

// WinRestorePoint makes the Windows System Restore point; it returns "created" | "skipped" or an error.
type WinRestorePoint func(s engine.Sys) (string, error)

// Snapshot writes the restore files into dir and makes the Windows restore point. It fails only when the .reg file
// could not be produced — that file is the part the user can always fall back on.
func Snapshot(s engine.Sys, dir string, tweaks []*engine.Tweak, winRP WinRestorePoint) (*Info, error) {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	now := time.Now()
	stamp := now.Format("2006-01-02_1504")
	info := &Info{At: now.UnixMilli(), Dir: dir}

	// 1. registry
	trees := Trees(tweaks)
	var body strings.Builder
	exported := 0
	for i, k := range trees {
		tmp := filepath.Join(dir, fmt.Sprintf("part%02d.tmp", i))
		r := s.Run(60*time.Second, "reg", "export", k, tmp, "/y")
		raw, err := os.ReadFile(tmp)
		_ = os.Remove(tmp)
		if r.Code != 0 || err != nil {
			continue // the key does not exist on this PC
		}
		txt := stripHeader(decode(raw))
		if strings.TrimSpace(txt) == "" {
			continue
		}
		exported++
		body.WriteString(txt)
		if !strings.HasSuffix(txt, "\n") {
			body.WriteString("\r\n")
		}
	}
	info.Keys = exported
	// the exact values FPS Boost can write, as they are now — written last so they win over the tree exports
	if pins := Pins(s, tweaks); len(pins) > 0 {
		body.WriteString("\r\n; --- every value FPS Boost can change, exactly as it was when this snapshot was made (\"=-\" = did not exist) ---\r\n")
		byKey := map[string][]Pin{}
		var order []string
		for _, p := range pins {
			if _, ok := byKey[p.Key]; !ok {
				order = append(order, p.Key)
			}
			byKey[p.Key] = append(byKey[p.Key], p)
		}
		for _, k := range order {
			fmt.Fprintf(&body, "\r\n[%s]\r\n", longRoot(k))
			for _, p := range byKey[k] {
				body.WriteString(regLine(p) + "\r\n")
			}
		}
		info.Pins = len(pins)
	}
	head := fmt.Sprintf("Windows Registry Editor Version 5.00\r\n\r\n; FPS Boost restore snapshot — %s\r\n; Double-click this file (Merge) to put the registry back to this state, then restart Windows.\r\n\r\n", now.Format("2006-01-02 15:04"))
	info.RegFile = "restore-" + stamp + ".reg"
	if info.Keys == 0 && info.Pins == 0 {
		return nil, fmt.Errorf("nothing could be read from the registry")
	}
	if err := writeUTF16(filepath.Join(dir, info.RegFile), head+body.String()); err != nil {
		return nil, err
	}

	// 2. the active power plan
	if g := engine.FirstGUID(s.Run(10*time.Second, "powercfg", "/getactivescheme").Out); g != "" {
		info.Scheme = g
		f := "power-" + stamp + ".pow"
		if r := s.Run(20*time.Second, "powercfg", "/export", filepath.Join(dir, f), g); r.Code == 0 {
			info.PowerFile = f
		}
	}

	// 3. the Windows restore point (may be unavailable: System Restore off, Home edition without protection…)
	if winRP != nil {
		if st, err := winRP(s); err != nil {
			info.Windows = "unavailable: " + err.Error()
		} else {
			info.Windows = st
		}
	} else {
		info.Windows = "unavailable: not supported here"
	}

	_ = os.WriteFile(filepath.Join(dir, "README.txt"), []byte(readme(info)), 0o644)
	prune(dir, 5)
	return info, nil
}

// Load imports the snapshot's .reg file and power plan again — the "load the previous restore" button.
func Load(s engine.Sys, info *Info) error {
	if info == nil || info.RegFile == "" {
		return fmt.Errorf("no restore snapshot yet")
	}
	reg := filepath.Join(info.Dir, info.RegFile)
	if _, err := os.Stat(reg); err != nil {
		return fmt.Errorf("the restore file is missing: %s", reg)
	}
	if _, err := engine.Must(s, 2*time.Minute, "reg", "import", reg); err != nil {
		return err
	}
	if info.PowerFile != "" {
		if r := s.Run(20*time.Second, "powercfg", "/import", filepath.Join(info.Dir, info.PowerFile)); r.Code == 0 {
			if g := engine.FirstGUID(r.Out); g != "" {
				s.Run(10*time.Second, "powercfg", "/setactive", g)
			}
		} else if info.Scheme != "" {
			s.Run(10*time.Second, "powercfg", "/setactive", info.Scheme)
		}
	}
	return nil
}

func readme(i *Info) string {
	return fmt.Sprintf(`FPS Boost — restore snapshot (%s)
==========================================

These files were made BEFORE FPS Boost changed anything on this PC.

If something misbehaves and the app's own "Restore everything" button is not enough (or the app will not start):

  1. %s  — double-click it, confirm "Merge". Every registry setting FPS Boost can touch goes back to how it was.
  2. %s  — the power plan that was active. In an admin Command Prompt:  powercfg /import "<this file>"  then
     powercfg /setactive <the GUID it prints>.   (Or just pick your old plan in Control Panel → Power Options.)
  3. Restart Windows. Services and adapter power settings take effect after the restart.
  4. Windows System Restore point: %s. Settings → System → Recovery → "Open System Restore" lists the "FPS Boost" point.

FPS Boost — فایل‌های بازیابی (%s)
این فایل‌ها قبل از اولین تغییر FPS Boost روی این سیستم ساخته شده‌اند.
  ۱. روی فایل .reg دوبار کلیک کنید و Merge را تأیید کنید؛ همهٔ تنظیمات رجیستری به حالت قبل برمی‌گردد.
  ۲. فایل .pow پاور پلن قبلی است (powercfg /import) — یا پلن قبلی را از Control Panel → Power Options انتخاب کنید.
  ۳. ویندوز را ریستارت کنید.
  ۴. نقطهٔ بازیابی ویندوز: %s — از Settings → System → Recovery → Open System Restore.
`, time.UnixMilli(i.At).Format("2006-01-02 15:04"), i.RegFile, orNone(i.PowerFile), i.Windows, time.UnixMilli(i.At).Format("2006-01-02 15:04"), i.Windows)
}

func orNone(s string) string {
	if s == "" {
		return "(power plan export was not possible)"
	}
	return s
}

// prune keeps the newest n snapshots (by file name = time stamp).
func prune(dir string, n int) {
	for _, pat := range []string{"restore-*.reg", "power-*.pow"} {
		files, _ := filepath.Glob(filepath.Join(dir, pat))
		sort.Strings(files)
		for len(files) > n {
			_ = os.Remove(files[0])
			files = files[1:]
		}
	}
}

// longRoot writes a key the way .reg files want it (HKEY_LOCAL_MACHINE, not HKLM).
func longRoot(k string) string {
	for short, long := range map[string]string{`HKLM\`: `HKEY_LOCAL_MACHINE\`, `HKCU\`: `HKEY_CURRENT_USER\`, `HKU\`: `HKEY_USERS\`, `HKCR\`: `HKEY_CLASSES_ROOT\`} {
		if strings.HasPrefix(strings.ToUpper(k), short) {
			return long + k[len(short):]
		}
	}
	return k
}

// stripHeader drops reg.exe's "Windows Registry Editor Version 5.00" line so several exports concatenate into one file.
func stripHeader(txt string) string {
	txt = strings.TrimLeft(txt, "\ufeff")
	if i := strings.Index(txt, "\n"); i >= 0 && strings.HasPrefix(txt, "Windows Registry Editor") {
		return strings.TrimLeft(txt[i+1:], "\r\n")
	}
	return txt
}

// decode turns reg.exe output (UTF-16LE with BOM) into a string; plain text passes through.
func decode(b []byte) string {
	if len(b) >= 2 && b[0] == 0xff && b[1] == 0xfe {
		u := make([]uint16, (len(b)-2)/2)
		for i := range u {
			u[i] = binary.LittleEndian.Uint16(b[2+2*i:])
		}
		return string(utf16.Decode(u))
	}
	return string(b)
}

// writeUTF16 writes a .reg file the way regedit expects it: UTF-16LE with a BOM.
func writeUTF16(path, s string) error {
	u := utf16.Encode([]rune(s))
	b := make([]byte, 2+2*len(u))
	b[0], b[1] = 0xff, 0xfe
	for i, c := range u {
		binary.LittleEndian.PutUint16(b[2+2*i:], c)
	}
	return os.WriteFile(path, b, 0o644)
}
