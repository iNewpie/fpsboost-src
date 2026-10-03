package engine_test

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	. "fpsboost.ir/app/internal/engine"
)

func TestRegTweakRoundTrip(t *testing.T) {
	f := NewFake()
	f.Set(`HKCU\A`, "X", RegValue{Type: "REG_DWORD", Value: uint32(7)})
	dir := t.TempDir()
	b := NewBackup(filepath.Join(dir, "backup.json"))
	tw := RegTweak(Meta{ID: "t1"}, DW(`HKCU\A`, "X", 1), SZ(`HKCU\A`, "Y", "hi"))
	e := New([]*Tweak{tw}, f, b)

	st := e.State()
	if st[0].Applied == nil || *st[0].Applied {
		t.Fatalf("should start off: %+v", st[0])
	}
	r := e.Apply("t1", "")
	if r.Error != "" || r.Applied == nil || !*r.Applied {
		t.Fatalf("apply: %+v", r)
	}
	// backup keeps the original X and records that Y did not exist, in the Electron file format
	raw, _ := os.ReadFile(filepath.Join(dir, "backup.json"))
	var file map[string][]map[string]any
	if err := json.Unmarshal(raw, &file); err != nil {
		t.Fatal(err)
	}
	if was := file["t1"][0]["was"].(map[string]any); was["type"] != "REG_DWORD" || was["value"].(float64) != 7 {
		t.Fatalf("bad backup: %v", file["t1"])
	}
	if file["t1"][1]["was"] != nil {
		t.Fatalf("Y should have no original: %v", file["t1"][1])
	}
	// applying again must not overwrite the original
	f.Set(`HKCU\A`, "X", RegValue{Type: "REG_DWORD", Value: uint32(99)})
	e.Apply("t1", "")
	r = e.Revert("t1")
	if r.Error != "" || *r.Applied {
		t.Fatalf("revert: %+v", r)
	}
	v, _ := f.RegGet(`HKCU\A`, "X")
	if !Same(v.Value, 7) {
		t.Fatalf("X not restored: %v", v)
	}
	if y, _ := f.RegGet(`HKCU\A`, "Y"); y != nil {
		t.Fatalf("Y should be deleted: %v", y)
	}
	if b.Has("t1") {
		t.Fatal("backup should be cleared")
	}
}

func TestEnforceReappliesRevertedRegistryTweaks(t *testing.T) {
	f := NewFake()
	b := NewBackup("")
	tw := RegTweak(Meta{ID: "t1"}, DW(`HKCU\A`, "X", 1))
	svc := ServiceTweak(Meta{ID: "svc"}, "Foo")
	e := New([]*Tweak{tw, svc}, f, b)
	if len(e.Enforce()) != 0 {
		t.Fatal("nothing applied yet, nothing to enforce")
	}
	e.Apply("t1", "")
	f.Set(`HKCU\A`, "X", RegValue{Type: "REG_DWORD", Value: uint32(0)}) // Windows Update reverted it
	if fixed := e.Enforce(); len(fixed) != 1 || fixed[0] != "t1" {
		t.Fatalf("enforce: %v", fixed)
	}
	v, _ := f.RegGet(`HKCU\A`, "X")
	if !Same(v.Value, 1) {
		t.Fatal("not re-applied")
	}
}

func TestServiceTweak(t *testing.T) {
	f := NewFake()
	f.Set(`HKLM\SYSTEM\CurrentControlSet\Services\Foo`, "Start", RegValue{Type: "REG_DWORD", Value: uint32(2)})
	f.Set(`HKLM\SYSTEM\CurrentControlSet\Services\Foo`, "DelayedAutostart", RegValue{Type: "REG_DWORD", Value: uint32(1)})
	f.Cmd = func(cmd string, args []string) RunResult {
		if cmd == "sc" && args[0] == "config" && args[3] == "disabled" {
			f.Set(`HKLM\SYSTEM\CurrentControlSet\Services\Foo`, "Start", RegValue{Type: "REG_DWORD", Value: uint32(4)})
		}
		if cmd == "sc" && args[0] == "config" && args[3] == "delayed-auto" {
			f.Set(`HKLM\SYSTEM\CurrentControlSet\Services\Foo`, "Start", RegValue{Type: "REG_DWORD", Value: uint32(2)})
		}
		return RunResult{Code: 0}
	}
	e := New([]*Tweak{ServiceTweak(Meta{ID: "svc"}, "Foo")}, f, NewBackup(""))
	if r := e.Apply("svc", ""); r.Error != "" || !*r.Applied {
		t.Fatalf("apply %+v", r)
	}
	if !f.HasCall("sc", "stop", "Foo") {
		t.Fatal("service not stopped")
	}
	if r := e.Revert("svc"); r.Error != "" || *r.Applied {
		t.Fatalf("revert %+v", r)
	}
	if !f.HasCall("sc", "config", "Foo", "start=", "delayed-auto") || !f.HasCall("sc", "start", "Foo") {
		t.Fatalf("restore calls: %v", f.Calls)
	}
}

func TestPowercfgTweakParsesLocalizedOutput(t *testing.T) {
	f := NewFake()
	ac, dc := "0x00000032", "0x00000032"
	f.Cmd = func(cmd string, args []string) RunResult {
		if cmd != "powercfg" {
			return RunResult{Code: 1}
		}
		switch args[0] {
		case "/q":
			return RunResult{Out: "Subgroup GUID: 54533251-82be-4824-96c1-47b60b740d00  (Processor power management)\n  Power Setting GUID: 0cc5b647-c1df-4637-891a-dec35c318583  (Processor performance core parking min cores)\n    Minimum Possible Setting: 0x00000000\n    Maximum Possible Setting: 0x00000064\n    Possible Settings increment: 0x00000001\n    Possible Settings units: %\n  شاخص تنظیم فعلی AC: " + ac + "\n  شاخص تنظیم فعلی DC: " + dc + "\n"}
		case "/setacvalueindex":
			ac = "0x000000" + map[string]string{"100": "64", "50": "32"}[args[4]]
		case "/setdcvalueindex":
			dc = "0x000000" + map[string]string{"100": "64", "50": "32"}[args[4]]
		}
		return RunResult{Code: 0}
	}
	tw := PowercfgTweak(Meta{ID: "park"}, "54533251-82be-4824-96c1-47b60b740d00", "0cc5b647-c1df-4637-891a-dec35c318583", 100)
	e := New([]*Tweak{tw}, f, NewBackup(""))
	if st := e.State(); *st[0].Applied {
		t.Fatal("should be off at 0x32")
	}
	if r := e.Apply("park", ""); r.Error != "" || !*r.Applied {
		t.Fatalf("apply %+v", r)
	}
	if r := e.Revert("park"); r.Error != "" || *r.Applied || ac != "0x00000032" {
		t.Fatalf("revert %+v ac=%s", r, ac)
	}
}

func TestSameAndNum(t *testing.T) {
	if !Same(float64(1), uint32(1)) || !Same("0x26", 38) || Same("High", "Low") || !Same("High", "High") || Same(uint32(1), 2) {
		t.Fatal("Same is wrong")
	}
}
