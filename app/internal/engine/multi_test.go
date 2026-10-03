package engine_test

import (
	"strings"
	"testing"

	. "fpsboost.ir/app/internal/engine"
)

const svcKey = `HKLM\SYSTEM\CurrentControlSet\Services\`

func TestServicesTweakSkipsMissingServicesAndRestoresEachStartType(t *testing.T) {
	f := NewFake()
	f.Set(svcKey+"Fax", "Start", RegValue{Type: "REG_DWORD", Value: uint32(3)})
	f.Set(svcKey+"MapsBroker", "Start", RegValue{Type: "REG_DWORD", Value: uint32(2)})
	f.Set(svcKey+"MapsBroker", "DelayedAutostart", RegValue{Type: "REG_DWORD", Value: uint32(1)})
	// AJRouter is not installed
	f.Cmd = func(cmd string, args []string) RunResult {
		if cmd == "sc" && args[0] == "config" {
			start := map[string]uint32{"disabled": 4, "demand": 3, "auto": 2, "delayed-auto": 2}[args[3]]
			f.Set(svcKey+args[1], "Start", RegValue{Type: "REG_DWORD", Value: start})
		}
		return RunResult{Code: 0}
	}
	tw := ServicesTweak(Meta{ID: "svc"}, "AJRouter", "Fax", "MapsBroker")
	e := New([]*Tweak{tw}, f, NewBackup(""))
	if st := e.State(); *st[0].Applied {
		t.Fatal("should be off")
	}
	if r := e.Apply("svc", ""); r.Error != "" || !*r.Applied {
		t.Fatalf("apply %+v", r)
	}
	if f.HasCall("sc", "config", "AJRouter") {
		t.Fatal("a missing service must not be touched")
	}
	if !f.HasCall("sc", "stop", "Fax") || !f.HasCall("sc", "stop", "MapsBroker") {
		t.Fatal("installed services must be stopped")
	}
	if r := e.Revert("svc"); r.Error != "" || *r.Applied {
		t.Fatalf("revert %+v", r)
	}
	if !f.HasCall("sc", "config", "Fax", "start=", "demand") || !f.HasCall("sc", "config", "MapsBroker", "start=", "delayed-auto") {
		t.Fatalf("original start types not restored: %v", f.Calls)
	}
	if !f.HasCall("sc", "start", "MapsBroker") || f.HasCall("sc", "start", "Fax") {
		t.Fatal("only automatic services are started again")
	}
	// none installed → a clear error
	g := NewFake()
	e2 := New([]*Tweak{ServicesTweak(Meta{ID: "svc"}, "Nope")}, g, NewBackup(""))
	if r := e2.Apply("svc", ""); r.Error == "" {
		t.Fatal("want an error when no service exists")
	}
}

func TestPowerSettingsTweakACOnlyLeavesBatteryAlone(t *testing.T) {
	f := NewFake()
	vals := map[string][2]string{ // setting → ac, dc
		"29f6c1db-86da-48c5-9fdb-f2b67b1f44da": {"0x00000708", "0x0000012c"}, // sleep after 30 / 5 min
		"9d7815a6-7ee4-497e-8888-515a05f02364": {"0x00000e10", "0x00000e10"}, // hibernate after
	}
	f.Cmd = func(cmd string, args []string) RunResult {
		if cmd != "powercfg" {
			return RunResult{Code: 1}
		}
		switch args[0] {
		case "/q":
			v, ok := vals[args[3]]
			if !ok {
				return RunResult{Code: 1, Err: "The power scheme, subgroup or setting specified does not exist."}
			}
			return RunResult{Out: "Current AC Power Setting Index: " + v[0] + "\n    Current DC Power Setting Index: " + v[1] + "\n"}
		case "/setacvalueindex", "/setdcvalueindex":
			v := vals[args[3]]
			hx := "0x" + strings.Repeat("0", 8-len(strings.TrimLeft(dec2hex(args[4]), "0"))) + strings.TrimLeft(dec2hex(args[4]), "0")
			if args[4] == "0" {
				hx = "0x00000000"
			}
			if args[0] == "/setacvalueindex" {
				v[0] = hx
			} else {
				v[1] = hx
			}
			vals[args[3]] = v
		}
		return RunResult{Code: 0}
	}
	sleep := "238c9fa8-0aad-41ed-83f4-97be242c8f20"
	tw := PowerSettingsTweak(Meta{ID: "sleep"}, true,
		PowerSetting{sleep, "29f6c1db-86da-48c5-9fdb-f2b67b1f44da", 0},
		PowerSetting{sleep, "9d7815a6-7ee4-497e-8888-515a05f02364", 0},
		PowerSetting{sleep, "94ac6d29-73ce-41a6-809f-6363ba21b47e", 0}) // hybrid sleep: not on this PC
	e := New([]*Tweak{tw}, f, NewBackup(""))
	if r := e.Apply("sleep", ""); r.Error != "" || !*r.Applied {
		t.Fatalf("apply %+v", r)
	}
	if f.HasCall("powercfg", "/setdcvalueindex") {
		t.Fatal("AC-only tweak must not touch the battery profile")
	}
	if f.HasCall("powercfg", "/setacvalueindex", "SCHEME_CURRENT", sleep, "94ac6d29-73ce-41a6-809f-6363ba21b47e") {
		t.Fatal("a setting that does not exist must be skipped")
	}
	if vals["29f6c1db-86da-48c5-9fdb-f2b67b1f44da"] != [2]string{"0x00000000", "0x0000012c"} {
		t.Fatalf("sleep ac/dc = %v", vals["29f6c1db-86da-48c5-9fdb-f2b67b1f44da"])
	}
	if r := e.Revert("sleep"); r.Error != "" || *r.Applied {
		t.Fatalf("revert %+v", r)
	}
	if vals["29f6c1db-86da-48c5-9fdb-f2b67b1f44da"][0] != "0x00000708" || vals["9d7815a6-7ee4-497e-8888-515a05f02364"][0] != "0x00000e10" {
		t.Fatalf("originals not restored: %v", vals)
	}
}

func dec2hex(d string) string {
	n := 0
	for _, c := range d {
		n = n*10 + int(c-'0')
	}
	const digits = "0123456789abcdef"
	if n == 0 {
		return "0"
	}
	s := ""
	for n > 0 {
		s = string(digits[n%16]) + s
		n /= 16
	}
	return s
}

func TestTasksTweakDisablesOnlyExistingTasksAndReenablesTheOnesThatWereOn(t *testing.T) {
	f := NewFake()
	state := map[string]int{ // path → State (1 disabled, 3 ready)
		`\Microsoft\Windows\Defrag\ScheduledDefrag`:                          3,
		`\Microsoft\Windows\Customer Experience Improvement Program\UsbCeip`: 1, // already off: must stay out of the backup
	}
	var disabled, enabled []string
	f.Cmd = func(cmd string, args []string) RunResult {
		if cmd != "powershell" {
			return RunResult{Code: 1}
		}
		script := args[len(args)-1]
		switch {
		case strings.Contains(script, "Get-ScheduledTask"):
			var parts []string
			for _, name := range tasksIn(script) {
				if s, ok := state[name]; ok {
					parts = append(parts, `{"n":"`+strings.ReplaceAll(name, `\`, `\\`)+`","s":`+string(rune('0'+s))+`}`)
				}
			}
			return RunResult{Out: "[" + strings.Join(parts, ",") + "]"}
		case strings.Contains(script, "Disable-ScheduledTask"):
			for _, name := range tasksIn(script) {
				disabled = append(disabled, name)
				state[name] = 1
			}
		case strings.Contains(script, "Enable-ScheduledTask"):
			for _, name := range tasksIn(script) {
				enabled = append(enabled, name)
				state[name] = 3
			}
		}
		return RunResult{Code: 0}
	}
	tw := TasksTweak(Meta{ID: "tasks"},
		`\Microsoft\Windows\Defrag\ScheduledDefrag`,
		`\Microsoft\Windows\Customer Experience Improvement Program\UsbCeip`,
		`\Microsoft\Windows\Maps\MapsUpdateTask`) // not on this PC
	e := New([]*Tweak{tw}, f, NewBackup(""))
	if st := e.State(); *st[0].Applied {
		t.Fatal("ScheduledDefrag is ready → not applied")
	}
	if r := e.Apply("tasks", ""); r.Error != "" || !*r.Applied {
		t.Fatalf("apply %+v", r)
	}
	if strings.Join(disabled, ",") != `\Microsoft\Windows\Defrag\ScheduledDefrag` {
		t.Fatalf("only the enabled, existing task is disabled: %v", disabled)
	}
	var bk []string
	e.Backup.Get("tasks", &bk)
	if len(bk) != 1 || bk[0] != `\Microsoft\Windows\Defrag\ScheduledDefrag` {
		t.Fatalf("backup %v", bk)
	}
	if r := e.Revert("tasks"); r.Error != "" || *r.Applied {
		t.Fatalf("revert %+v", r)
	}
	if strings.Join(enabled, ",") != `\Microsoft\Windows\Defrag\ScheduledDefrag` || state[`\Microsoft\Windows\Customer Experience Improvement Program\UsbCeip`] != 1 {
		t.Fatalf("revert must re-enable exactly what was on: %v", enabled)
	}
}

// tasksIn pulls the single-quoted task paths out of a generated script.
func tasksIn(script string) []string {
	i := strings.Index(script, "in @(") + 3
	j := strings.Index(script[i:], ")")
	var out []string
	for _, q := range strings.Split(script[i+2:i+j], ",") {
		out = append(out, strings.Trim(q, "'"))
	}
	return out
}
