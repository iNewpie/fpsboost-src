package restore_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
	"unicode/utf16"

	"fpsboost.ir/app/internal/engine"
	"fpsboost.ir/app/internal/restore"
)

type fake struct {
	reg   map[string]engine.RegValue
	calls [][]string
}

func (f *fake) RegGet(key, name string) (*engine.RegValue, error) {
	v, ok := f.reg[strings.ToLower(key+`\`+name)]
	if !ok {
		return nil, nil
	}
	return &v, nil
}
func (f *fake) RegSet(key, name string, v engine.RegValue) error { return nil }
func (f *fake) RegDel(key, name string) error                    { return nil }
func (f *fake) RegSubkeys(key string) ([]string, error)          { return nil, nil }
func (f *fake) Run(_ time.Duration, cmd string, args ...string) engine.RunResult {
	f.calls = append(f.calls, append([]string{cmd}, args...))
	switch {
	case cmd == "reg" && args[0] == "export":
		if strings.Contains(args[1], "Missing") {
			return engine.RunResult{Code: 1, Err: "ERROR: The system was unable to find the specified registry key or value."}
		}
		txt := "Windows Registry Editor Version 5.00\r\n\r\n[" + args[1] + "]\r\n\"Start\"=dword:00000002\r\n\r\n"
		u := utf16.Encode([]rune(txt))
		b := []byte{0xff, 0xfe}
		for _, c := range u {
			b = append(b, byte(c), byte(c>>8))
		}
		_ = os.WriteFile(args[2], b, 0o644)
		return engine.RunResult{Code: 0}
	case cmd == "powercfg" && args[0] == "/getactivescheme":
		return engine.RunResult{Out: "Power Scheme GUID: 381b4222-f694-41f0-9685-ff5bb260df2e  (Balanced)"}
	case cmd == "powercfg" && args[0] == "/export":
		_ = os.WriteFile(args[1], []byte("pow"), 0o644)
		return engine.RunResult{Code: 0}
	case cmd == "powercfg" && args[0] == "/import":
		return engine.RunResult{Out: "Imported Power Scheme GUID: 11111111-2222-3333-4444-555555555555"}
	}
	return engine.RunResult{Code: 0}
}

func TestSnapshotWritesRegPowAndReadmeAndLoadImportsThem(t *testing.T) {
	f := &fake{reg: map[string]engine.RegValue{}}
	f.reg[strings.ToLower(`HKCU\Software\Microsoft\GameBar\AutoGameModeEnabled`)] = engine.RegValue{Type: "REG_DWORD", Value: uint32(1)}
	tw := []*engine.Tweak{
		engine.RegTweak(engine.Meta{ID: "a"}, engine.DW(`HKCU\Software\Microsoft\GameBar`, "AutoGameModeEnabled", 1), engine.DW(`HKLM\SOFTWARE\Policies\Microsoft\Windows\GameDVR`, "AllowGameDVR", 0)),
		engine.RegTweak(engine.Meta{ID: "b"}, engine.DW(`HKCU\Software\Microsoft\GameBar\Sub`, "X", 1)), // child of an exported tree
		engine.ServiceTweak(engine.Meta{ID: "c"}, "Fax"),
		engine.ServicesTweak(engine.Meta{ID: "d"}, "Missing", "Spooler"),
		(&engine.Tweak{Meta: engine.Meta{ID: "e"}}).WithTrees(`HKCU\AppEvents\Schemes`).WithPins(func(engine.Sys) []engine.RegVal {
			return []engine.RegVal{{Key: `HKCU\AppEvents\Schemes`, Name: ""}, {Key: `HKCU\T`, Name: "Ding"}, {Key: `HKCU\T`, Name: "PagingFiles"}, {Key: `HKCU\T`, Name: "Q"}, {Key: `HKCU\T`, Name: "S"}}
		}),
	}
	f.reg[strings.ToLower(`HKCU\AppEvents\Schemes\`)] = engine.RegValue{Type: "REG_SZ", Value: ".Default"}
	f.reg[strings.ToLower(`HKCU\T\Ding`)] = engine.RegValue{Type: "REG_EXPAND_SZ", Value: "%S"}
	f.reg[strings.ToLower(`HKCU\T\PagingFiles`)] = engine.RegValue{Type: "REG_MULTI_SZ", Value: []string{"a", "b"}}
	f.reg[strings.ToLower(`HKCU\T\Q`)] = engine.RegValue{Type: "REG_QWORD", Value: uint64(1)}
	f.reg[strings.ToLower(`HKCU\T\S`)] = engine.RegValue{Type: "REG_SZ", Value: `a\b "c"`}
	trees := restore.Trees(tw)
	want := []string{`HKCU\AppEvents\Schemes`, `HKCU\Software\Microsoft\GameBar`, `HKLM\SOFTWARE\Policies\Microsoft\Windows\GameDVR`, `HKLM\SYSTEM\CurrentControlSet\Services\Fax`, `HKLM\SYSTEM\CurrentControlSet\Services\Missing`, `HKLM\SYSTEM\CurrentControlSet\Services\Spooler`}
	if strings.Join(trees, "|") != strings.Join(want, "|") {
		t.Fatalf("trees = %v", trees)
	}
	dir := filepath.Join(t.TempDir(), "restore")
	info, err := restore.Snapshot(f, dir, tw, func(engine.Sys) (string, error) { return "created", nil })
	if err != nil {
		t.Fatal(err)
	}
	if info.Keys != 5 || info.PowerFile == "" || info.Scheme != "381b4222-f694-41f0-9685-ff5bb260df2e" || info.Windows != "created" {
		t.Fatalf("info %+v", info)
	}
	raw, _ := os.ReadFile(filepath.Join(dir, info.RegFile))
	if raw[0] != 0xff || raw[1] != 0xfe {
		t.Fatal(".reg must be UTF-16LE with BOM")
	}
	u := make([]uint16, (len(raw)-2)/2)
	for i := range u {
		u[i] = uint16(raw[2+2*i]) | uint16(raw[3+2*i])<<8
	}
	txt := string(utf16.Decode(u))
	if strings.Count(txt, "Windows Registry Editor Version 5.00") != 1 {
		t.Fatal("exactly one header")
	}
	if !strings.Contains(txt, `[HKLM\SYSTEM\CurrentControlSet\Services\Spooler]`) || strings.Contains(txt, `Services\Missing]`) {
		t.Fatalf("exports merged wrongly:\n%s", txt)
	}
	// AllowGameDVR and Sub\X did not exist → the import must delete them; AutoGameModeEnabled existed → pinned to its value
	if !strings.Contains(txt, "[HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\Microsoft\\Windows\\GameDVR]\r\n\"AllowGameDVR\"=-") || !strings.Contains(txt, "\"X\"=-") || !strings.Contains(txt, "\"AutoGameModeEnabled\"=dword:00000001") {
		t.Fatalf("pinned section wrong:\n%s", txt)
	}
	// hand-written pins: the default value of a key, REG_EXPAND_SZ, REG_MULTI_SZ, REG_QWORD and an escaped REG_SZ
	if !strings.Contains(txt, "[HKEY_CURRENT_USER\\AppEvents\\Schemes]\r\n@=\".Default\"") {
		t.Fatalf("default value pin missing:\n%s", txt)
	}
	if !strings.Contains(txt, "\"Ding\"=hex(2):25,00,53,00,00,00") || !strings.Contains(txt, "\"PagingFiles\"=hex(7):61,00,00,00,62,00,00,00,00,00") || !strings.Contains(txt, "\"Q\"=hex(b):01,00,00,00,00,00,00,00") || !strings.Contains(txt, `"S"="a\\b \"c\""`) {
		t.Fatalf("typed pins wrong:\n%s", txt)
	}
	if info.Pins != 8 {
		t.Fatalf("pins = %d", info.Pins)
	}
	if _, err := os.Stat(filepath.Join(dir, "README.txt")); err != nil {
		t.Fatal("README missing")
	}
	if _, err := os.Stat(filepath.Join(dir, info.PowerFile)); err != nil {
		t.Fatal(".pow missing")
	}
	if files, _ := filepath.Glob(filepath.Join(dir, "*.tmp")); len(files) != 0 {
		t.Fatal("temp parts must be removed")
	}
	// load
	f.calls = nil
	if err := restore.Load(f, info); err != nil {
		t.Fatal(err)
	}
	joined := ""
	for _, c := range f.calls {
		joined += strings.Join(c, " ") + "\n"
	}
	if !strings.Contains(joined, "reg import "+filepath.Join(dir, info.RegFile)) || !strings.Contains(joined, "powercfg /import") || !strings.Contains(joined, "/setactive 11111111-2222-3333-4444-555555555555") {
		t.Fatalf("load calls:\n%s", joined)
	}
	// an unavailable restore point is recorded, not fatal
	info2, err := restore.Snapshot(f, dir, tw, func(engine.Sys) (string, error) { return "", os.ErrPermission })
	if err != nil || !strings.HasPrefix(info2.Windows, "unavailable") {
		t.Fatalf("%v %+v", err, info2)
	}
	if err := restore.Load(f, &restore.Info{Dir: dir, RegFile: "nope.reg"}); err == nil {
		t.Fatal("a missing file must be an error")
	}
}
