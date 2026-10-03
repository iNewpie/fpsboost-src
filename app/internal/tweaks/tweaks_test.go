package tweaks_test

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"
	"time"

	"fpsboost.ir/app/internal/engine"
	"fpsboost.ir/app/internal/tweaks"
)

// a small fake Windows (the engine package has the full one; tests cannot import another package's _test files)
type fake struct {
	reg   map[string]engine.RegValue
	keys  map[string]bool
	calls [][]string
	cmd   func(cmd string, args []string) engine.RunResult
}

func newFake() *fake       { return &fake{reg: map[string]engine.RegValue{}, keys: map[string]bool{}} }
func norm(k string) string { return strings.ToLower(k) }
func (f *fake) set(key, name string, v engine.RegValue) {
	f.keys[norm(key)] = true
	f.reg[norm(key)+`\`+strings.ToLower(name)] = v
}
func (f *fake) RegGet(key, name string) (*engine.RegValue, error) {
	v, ok := f.reg[norm(key)+`\`+strings.ToLower(name)]
	if !ok {
		return nil, nil
	}
	return &v, nil
}
func (f *fake) RegSet(key, name string, v engine.RegValue) error { f.set(key, name, v); return nil }
func (f *fake) RegDel(key, name string) error {
	delete(f.reg, norm(key)+`\`+strings.ToLower(name))
	return nil
}
func (f *fake) RegSubkeys(key string) ([]string, error) {
	k := norm(key)
	seen := map[string]bool{}
	var out []string
	for kk := range f.keys {
		if strings.HasPrefix(kk, k+`\`) {
			first := strings.SplitN(strings.TrimPrefix(kk, k+`\`), `\`, 2)[0]
			if !seen[first] {
				seen[first] = true
				out = append(out, key+`\`+first)
			}
		}
	}
	return out, nil
}
func (f *fake) Run(_ time.Duration, cmd string, args ...string) engine.RunResult {
	f.calls = append(f.calls, append([]string{cmd}, args...))
	if f.cmd != nil {
		return f.cmd(cmd, args)
	}
	return engine.RunResult{Code: 1, Err: "not faked"}
}

func TestManifestIsConsistent(t *testing.T) {
	ids := map[string]bool{}
	for _, tw := range tweaks.All {
		if ids[tw.ID] {
			t.Fatalf("duplicate id %s", tw.ID)
		}
		ids[tw.ID] = true
		if tw.Title.En == "" || tw.Title.Fa == "" || tw.Desc.En == "" || tw.Desc.Fa == "" {
			t.Fatalf("%s: missing text", tw.ID)
		}
		if tw.Category != "fps" && tw.Category != "network" {
			t.Fatalf("%s: bad category", tw.ID)
		}
		if tw.Level != "safe" && tw.Level != "advanced" {
			t.Fatalf("%s: bad level", tw.ID)
		}
		if tw.Check == nil || tw.Apply == nil || tw.Revert == nil {
			t.Fatalf("%s: missing function", tw.ID)
		}
	}
	for _, p := range tweaks.Presets {
		if len(p.Exes) == 0 || len(p.Tips) == 0 || p.Icon == "" {
			t.Fatalf("preset %s incomplete", p.ID)
		}
		for _, id := range p.Tweaks {
			if !ids[id] {
				t.Fatalf("preset %s references unknown tweak %s", p.ID, id)
			}
		}
	}
	if len(tweaks.All) < 30 {
		t.Fatalf("expected 30 tweaks, got %d", len(tweaks.All))
	}
	if tweaks.GameExes["valorant-win64-shipping.exe"] != "Valorant" || tweaks.GameExes["cs2.exe"] == "" {
		t.Fatal("game exe map")
	}
}

func TestEveryRegistryTweakAppliesAndRevertsOnTheFake(t *testing.T) {
	f := newFake()
	b := engine.NewBackup("")
	e := engine.New(tweaks.All, f, b)
	for _, tw := range tweaks.All {
		if !tw.Enforceable() {
			continue
		}
		r := e.Apply(tw.ID, "")
		if r.Error != "" || r.Applied == nil || !*r.Applied {
			t.Fatalf("%s apply: %+v", tw.ID, r)
		}
		r = e.Revert(tw.ID)
		if r.Error != "" || *r.Applied {
			t.Fatalf("%s revert: %+v", tw.ID, r)
		}
	}
}

func TestNagleCoversEveryInterfaceAndRevertRestoresOriginals(t *testing.T) {
	f := newFake()
	const IF = `HKLM\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters\Interfaces`
	f.set(IF+`\{A}`, "DhcpIPAddress", engine.RegValue{Type: "REG_SZ", Value: "10.0.0.2"})
	f.set(IF+`\{B}`, "TCPNoDelay", engine.RegValue{Type: "REG_DWORD", Value: uint32(0)})
	e := engine.New(tweaks.All, f, engine.NewBackup(""))
	if r := e.Apply("nagle_off", ""); r.Error != "" || !*r.Applied {
		t.Fatalf("apply %+v", r)
	}
	for _, k := range []string{`{A}`, `{B}`} {
		for _, n := range []string{"TcpAckFrequency", "TCPNoDelay"} {
			v, _ := f.RegGet(IF+`\`+k, n)
			if v == nil || !engine.Same(v.Value, 1) {
				t.Fatalf("%s %s not set", k, n)
			}
		}
	}
	// a new adapter appeared after the backup
	f.set(IF+`\{C}`, "TCPNoDelay", engine.RegValue{Type: "REG_DWORD", Value: uint32(1)})
	if r := e.Revert("nagle_off"); r.Error != "" || *r.Applied {
		t.Fatalf("revert %+v", r)
	}
	if v, _ := f.RegGet(IF+`\{B}`, "TCPNoDelay"); v == nil || !engine.Same(v.Value, 0) {
		t.Fatalf("B original not restored: %v", v)
	}
	if v, _ := f.RegGet(IF+`\{A}`, "TcpAckFrequency"); v != nil {
		t.Fatal("A should be clean")
	}
	if v, _ := f.RegGet(IF+`\{C}`, "TCPNoDelay"); v != nil {
		t.Fatal("new adapter C should be cleaned too")
	}
}

func TestDNSCheckUsesRegistryAndApplyUsesPowerShell(t *testing.T) {
	f := newFake()
	const IF = `HKLM\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters\Interfaces`
	f.set(IF+`\{A}`, "DhcpIPAddress", engine.RegValue{Type: "REG_SZ", Value: "192.168.1.5"})
	f.set(IF+`\{B}`, "DhcpIPAddress", engine.RegValue{Type: "REG_SZ", Value: "0.0.0.0"}) // dead adapter: ignored
	f.set(IF+`\{B}`, "NameServer", engine.RegValue{Type: "REG_SZ", Value: ""})
	var psCalls []string
	f.cmd = func(cmd string, args []string) engine.RunResult {
		if cmd == "powershell" {
			script := args[len(args)-1]
			psCalls = append(psCalls, script)
			if strings.Contains(script, "Get-NetAdapter") {
				return engine.RunResult{Out: `{"idx":12,"alias":"Wi-Fi","static":"","servers":["192.168.1.1"]}`}
			}
			if strings.Contains(script, "Set-DnsClientServerAddress -InterfaceIndex 12 -ServerAddresses 178.22.122.100,185.51.200.2") {
				f.set(IF+`\{A}`, "NameServer", engine.RegValue{Type: "REG_SZ", Value: "178.22.122.100,185.51.200.2"})
			}
			if strings.Contains(script, "ResetServerAddresses") {
				f.set(IF+`\{A}`, "NameServer", engine.RegValue{Type: "REG_SZ", Value: ""})
			}
			return engine.RunResult{Code: 0}
		}
		return engine.RunResult{Code: 0}
	}
	e := engine.New(tweaks.All, f, engine.NewBackup(""))
	if st := e.State(); func() bool {
		for _, s := range st {
			if s.ID == "dns_fast" {
				return s.Applied != nil && !*s.Applied && s.Error == ""
			}
		}
		return false
	}() == false {
		t.Fatal("dns_fast should be off without PowerShell")
	}
	for _, c := range psCalls {
		if strings.Contains(c, "Dns") || strings.Contains(c, "NetAdapter") {
			t.Fatalf("the DNS check must not run PowerShell: %v", psCalls)
		}
	}
	psCalls = nil
	if r := e.Apply("dns_fast", "shecan"); r.Error != "" || !*r.Applied {
		t.Fatalf("apply %+v", r)
	}
	var bk []map[string]any
	if !e.Backup.Get("dns_fast", &bk) || len(bk) != 1 || bk[0]["idx"].(float64) != 12 || bk[0]["static"] != "" {
		t.Fatalf("backup %v", bk)
	}
	if r := e.Revert("dns_fast"); r.Error != "" || *r.Applied {
		t.Fatalf("revert %+v", r)
	}
	if !strings.Contains(strings.Join(psCalls, "\n"), "-InterfaceIndex 12 -ResetServerAddresses") {
		t.Fatalf("revert should reset to DHCP: %v", psCalls)
	}
}

func TestPowerPlanFallsBackAndRemembersTheSchemeItSet(t *testing.T) {
	f := newFake()
	active := "381b4222-f694-41f0-9685-ff5bb260df2e"
	f.cmd = func(cmd string, args []string) engine.RunResult {
		switch args[0] {
		case "/getactivescheme":
			return engine.RunResult{Out: "Power Scheme GUID: " + active + "  (Balanced)"}
		case "/setactive":
			if args[1] == "e9a42b02-d5df-448d-aa00-03f14749eb61" {
				return engine.RunResult{Code: 1, Err: "The power scheme, subgroup or setting specified does not exist."}
			}
			active = args[1]
			return engine.RunResult{}
		case "/duplicatescheme":
			return engine.RunResult{Out: "Power Scheme GUID: 11111111-2222-3333-4444-555555555555  (Ultimate Performance)"}
		}
		return engine.RunResult{Code: 1}
	}
	e := engine.New(tweaks.All, f, engine.NewBackup(""))
	if r := e.Apply("power_plan_high", ""); r.Error != "" || !*r.Applied {
		t.Fatalf("apply %+v active=%s", r, active)
	}
	if active != "11111111-2222-3333-4444-555555555555" {
		t.Fatalf("duplicated scheme not activated: %s", active)
	}
	var b map[string]string
	e.Backup.Get("power_plan_high", &b)
	if b["scheme"] != "381b4222-f694-41f0-9685-ff5bb260df2e" || b["set"] != active {
		t.Fatalf("backup %v", b)
	}
	if r := e.Revert("power_plan_high"); r.Error != "" || *r.Applied || active != "381b4222-f694-41f0-9685-ff5bb260df2e" {
		t.Fatalf("revert %+v", r)
	}
}

func TestStateJSONShape(t *testing.T) {
	e := engine.New(tweaks.All, newFake(), engine.NewBackup(""))
	raw, _ := json.Marshal(e.State()[0])
	for _, k := range []string{`"id"`, `"category"`, `"level"`, `"recommended"`, `"title"`, `"desc"`, `"applied"`, `"hasBackup"`} {
		if !strings.Contains(string(raw), k) {
			t.Fatalf("missing %s in %s", k, raw)
		}
	}
	fmt.Println(string(raw)[:80])
}
