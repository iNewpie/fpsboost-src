package tweaks_test

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"testing"
	"time"

	"fpsboost.ir/app/internal/dns"
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

func TestDNSAutoPicksTheISPResolverThenTheFastest(t *testing.T) {
	f := newFake()
	const IF = `HKLM\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters\Interfaces`
	f.set(IF+`\{A}`, "DhcpIPAddress", engine.RegValue{Type: "REG_SZ", Value: "192.168.1.5"})
	f.set(IF+`\{A}`, "DhcpNameServer", engine.RegValue{Type: "REG_SZ", Value: "217.218.127.127 217.218.155.155"}) // a TCI line
	var setCmds []string
	f.cmd = func(cmd string, args []string) engine.RunResult {
		if cmd == "powershell" {
			script := args[len(args)-1]
			if strings.Contains(script, "Get-NetAdapter") {
				return engine.RunResult{Out: `{"idx":7,"alias":"Ethernet","static":"","servers":["192.168.1.1"]}`}
			}
			if strings.Contains(script, "Set-DnsClientServerAddress") {
				setCmds = append(setCmds, script)
			}
		}
		return engine.RunResult{Code: 0}
	}
	ms := func(n int) *int { return &n }
	oldScan, oldISP := tweaks.ScanDNS, tweaks.DetectISP
	defer func() { tweaks.ScanDNS, tweaks.DetectISP = oldScan, oldISP }()
	// 1) TCI answers → its resolver, even though Cloudflare is faster
	tweaks.ScanDNS = func(context.Context) []dns.Result {
		return []dns.Result{
			{ID: "cloudflare", Group: dns.GroupGlobal, Ms: ms(20), Answers: 8, Queries: 8},
			{ID: "tci", Group: dns.GroupISP, Ms: ms(35), Answers: 8, Queries: 8},
		}
	}
	e := engine.New(tweaks.All, f, engine.NewBackup(""))
	if r := e.Apply("dns_fast", dns.Auto); r.Error != "" {
		t.Fatalf("apply auto: %+v", r)
	}
	if len(setCmds) != 1 || !strings.Contains(setCmds[0], "217.218.127.127,217.218.155.155") || tweaks.LastAutoPick != "tci" {
		t.Fatalf("TCI line must get the TCI resolver: %v (pick %q)", setCmds, tweaks.LastAutoPick)
	}
	// 2) TCI silent → the fastest public resolver
	setCmds = nil
	tweaks.ScanDNS = func(context.Context) []dns.Result {
		return []dns.Result{
			{ID: "shecan", Group: dns.GroupIran, Ms: ms(12), Answers: 8, Queries: 8},
			{ID: "cloudflare", Group: dns.GroupGlobal, Ms: ms(20), Answers: 8, Queries: 8},
			{ID: "tci", Group: dns.GroupISP, Answers: 0, Queries: 8},
		}
	}
	_ = e.Revert("dns_fast")
	setCmds = nil
	if r := e.Apply("dns_fast", ""); r.Error != "" {
		t.Fatalf("apply (empty option = auto): %+v", r)
	}
	if len(setCmds) != 1 || !strings.Contains(setCmds[0], "178.22.122.100,185.51.200.2") {
		t.Fatalf("fallback must be the fastest answering resolver: %v", setCmds)
	}
	// 3) nothing answers → a clear error, nothing changed
	tweaks.ScanDNS = func(context.Context) []dns.Result { return []dns.Result{{ID: "tci", Group: dns.GroupISP, Queries: 8}} }
	_ = e.Revert("dns_fast")
	setCmds = nil
	if r := e.Apply("dns_fast", dns.Auto); r.Error == "" || len(setCmds) != 0 {
		t.Fatalf("want an error and no change: %+v %v", r, setCmds)
	}
}

func TestPagefileFixedUsesRAMAndRestoresSystemManaged(t *testing.T) {
	f := newFake()
	const MM = `HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management`
	f.set(MM, "PagingFiles", engine.RegValue{Type: "REG_MULTI_SZ", Value: []string{`?:\pagefile.sys`}})
	oldRAM, oldDrive := tweaks.TotalRAMMB, tweaks.SystemDrive
	defer func() { tweaks.TotalRAMMB, tweaks.SystemDrive = oldRAM, oldDrive }()
	tweaks.TotalRAMMB = func() int { return 8192 }
	tweaks.SystemDrive = func() string { return "C:" }
	if tweaks.PagefileSizeMB(8192) != 12288 || tweaks.PagefileSizeMB(2048) != 4096 || tweaks.PagefileSizeMB(32768) != 16384 {
		t.Fatal("size rule: 1.5× RAM, 4–16 GB")
	}
	e := engine.New(tweaks.All, f, engine.NewBackup(""))
	if r := e.Apply("pagefile_fixed", ""); r.Error != "" || !*r.Applied || !r.Reboot {
		t.Fatalf("apply %+v", r)
	}
	v, _ := f.RegGet(MM, "PagingFiles")
	if got := fmt.Sprint(v.Value); got != `[C:\pagefile.sys 12288 12288]` {
		t.Fatalf("PagingFiles = %s", got)
	}
	if r := e.Revert("pagefile_fixed"); r.Error != "" || *r.Applied {
		t.Fatalf("revert %+v", r)
	}
	v, _ = f.RegGet(MM, "PagingFiles")
	if got := fmt.Sprint(v.Value); got != `[?:\pagefile.sys]` {
		t.Fatalf("after revert PagingFiles = %s (want system managed)", got)
	}
	// RAM unknown → a clear error, nothing written
	tweaks.TotalRAMMB = func() int { return 0 }
	if r := e.Apply("pagefile_fixed", ""); r.Error == "" {
		t.Fatal("unknown RAM must fail")
	}
}

func TestHiddenPowercfgSettingIsUnhiddenBeforeReading(t *testing.T) {
	f := newFake()
	hidden := true
	var cmds []string
	f.cmd = func(cmd string, args []string) engine.RunResult {
		line := cmd + " " + strings.Join(args, " ")
		cmds = append(cmds, line)
		if cmd == "powercfg" {
			if len(args) > 0 && args[0] == "/attributes" {
				hidden = false
				return engine.RunResult{Code: 0}
			}
			if len(args) > 0 && args[0] == "/q" {
				if hidden {
					return engine.RunResult{Code: 0, Out: "Subgroup GUID: 54533251-82be-4824-96c1-47b60b740d00  (Processor power management)\n"}
				}
				return engine.RunResult{Code: 0, Out: "Current AC Power Setting Index: 0x00000001\n    Current DC Power Setting Index: 0x00000001\n"}
			}
		}
		return engine.RunResult{Code: 0}
	}
	e := engine.New(tweaks.All, f, engine.NewBackup(""))
	if r := e.Apply("core_parking_off", ""); r.Error != "" {
		t.Fatalf("core parking must apply once unhidden: %+v", r)
	}
	if !strings.Contains(strings.Join(cmds, "\n"), "/attributes 54533251-82be-4824-96c1-47b60b740d00 0cc5b647-c1df-4637-891a-dec35c318583 -ATTRIB_HIDE") {
		t.Fatalf("expected the ATTRIB_HIDE removal: %v", cmds)
	}
	if !strings.Contains(strings.Join(cmds, "\n"), "/setacvalueindex SCHEME_CURRENT 54533251-82be-4824-96c1-47b60b740d00 0cc5b647-c1df-4637-891a-dec35c318583 100") {
		t.Fatalf("expected the value to be set: %v", cmds)
	}
}

func TestNICPowerManagementTouchesOnlyPhysicalAdapters(t *testing.T) {
	f := newFake()
	const CLS = `HKLM\SYSTEM\CurrentControlSet\Control\Class\{4d36e972-e325-11ce-bfc1-08002be10318}`
	sz := func(v string) engine.RegValue { return engine.RegValue{Type: "REG_SZ", Value: v} }
	f.set(CLS+`\0001`, "NetCfgInstanceId", sz("{A}"))
	f.set(CLS+`\0001`, "DeviceInstanceID", sz(`PCI\VEN_10EC&DEV_8168\4&2b3c`)) // Ethernet
	f.set(CLS+`\0001`, "PnPCapabilities", engine.RegValue{Type: "REG_DWORD", Value: uint32(0)})
	f.set(CLS+`\0002`, "NetCfgInstanceId", sz("{B}"))
	f.set(CLS+`\0002`, "DeviceInstanceID", sz(`usb\VID_0BDA&PID_8153\00E0`)) // USB Wi-Fi dongle, no value yet
	f.set(CLS+`\0003`, "NetCfgInstanceId", sz("{C}"))
	f.set(CLS+`\0003`, "DeviceInstanceID", sz(`ROOT\NET\0000`)) // VPN TAP adapter: left alone
	f.set(CLS+`\Properties`, "Something", sz("x"))              // the class's own Properties key: no NetCfgInstanceId
	e := engine.New(tweaks.All, f, engine.NewBackup(""))
	if r := e.Apply("nic_power_mgmt_off", ""); r.Error != "" || !*r.Applied || !r.Reboot {
		t.Fatalf("apply %+v", r)
	}
	for _, k := range []string{`\0001`, `\0002`} {
		if v, _ := f.RegGet(CLS+k, "PnPCapabilities"); v == nil || !engine.Same(v.Value, 24) {
			t.Fatalf("%s: PnPCapabilities = %v", k, v)
		}
	}
	if v, _ := f.RegGet(CLS+`\0003`, "PnPCapabilities"); v != nil {
		t.Fatal("virtual adapter must not be touched")
	}
	if r := e.Revert("nic_power_mgmt_off"); r.Error != "" || *r.Applied {
		t.Fatalf("revert %+v", r)
	}
	if v, _ := f.RegGet(CLS+`\0001`, "PnPCapabilities"); v == nil || !engine.Same(v.Value, 0) {
		t.Fatalf("0001 original (0) not restored: %v", v)
	}
	if v, _ := f.RegGet(CLS+`\0002`, "PnPCapabilities"); v != nil {
		t.Fatal("0002 had no value before: must be deleted again")
	}
}

func TestWindowsSoundsSchemeSilencesEveryEventAndRevertRestoresIt(t *testing.T) {
	f := newFake()
	const S = `HKCU\AppEvents\Schemes`
	sz := func(v string) engine.RegValue { return engine.RegValue{Type: "REG_SZ", Value: v} }
	f.set(S, "", sz(".Default"))
	f.set(S+`\Apps\.Default\.Default\.Current`, "", engine.RegValue{Type: "REG_EXPAND_SZ", Value: `%SystemRoot%\media\Windows Ding.wav`})
	f.set(S+`\Apps\.Default\.Default\.Default`, "", engine.RegValue{Type: "REG_EXPAND_SZ", Value: `%SystemRoot%\media\Windows Ding.wav`})
	f.set(S+`\Apps\.Default\DeviceConnect\.Current`, "", sz(`C:\Windows\media\Windows Hardware Insert.wav`))
	f.set(S+`\Apps\Explorer\Navigating\.Current`, "", sz(""))
	f.set(S+`\Apps\Explorer\Navigating\.Default`, "", sz(`C:\Windows\media\Windows Navigation Start.wav`))
	f.set(S+`\Names\.None`, "", sz("No Sounds")) // not an app: ignored
	e := engine.New(tweaks.All, f, engine.NewBackup(""))
	if st := state(e, "win_sounds_off"); st.Applied == nil || *st.Applied {
		t.Fatalf("should be off: %+v", st)
	}
	if r := e.Apply("win_sounds_off", ""); r.Error != "" || !*r.Applied {
		t.Fatalf("apply %+v", r)
	}
	for _, k := range []string{`\Apps\.Default\.Default\.Current`, `\Apps\.Default\DeviceConnect\.Current`, `\Apps\Explorer\Navigating\.Current`} {
		if v, _ := f.RegGet(S+k, ""); v == nil || fmt.Sprint(v.Value) != "" {
			t.Fatalf("%s not silenced: %v", k, v)
		}
	}
	if v, _ := f.RegGet(S+`\Apps\.Default\.Default\.Default`, ""); fmt.Sprint(v.Value) == "" {
		t.Fatal("the .Default sound of an event must stay (Windows uses it to restore the scheme)")
	}
	if v, _ := f.RegGet(S, ""); fmt.Sprint(v.Value) != ".None" {
		t.Fatalf("scheme = %v", v)
	}
	if r := e.Revert("win_sounds_off"); r.Error != "" || *r.Applied {
		t.Fatalf("revert %+v", r)
	}
	if v, _ := f.RegGet(S+`\Apps\.Default\.Default\.Current`, ""); v == nil || v.Type != "REG_EXPAND_SZ" || fmt.Sprint(v.Value) != `%SystemRoot%\media\Windows Ding.wav` {
		t.Fatalf("Ding not restored with its type: %v", v)
	}
	if v, _ := f.RegGet(S+`\Apps\Explorer\Navigating\.Current`, ""); fmt.Sprint(v.Value) != "" {
		t.Fatal("an event that was already silent must stay silent")
	}
	if v, _ := f.RegGet(S, ""); fmt.Sprint(v.Value) != ".Default" {
		t.Fatalf("scheme after revert = %v", v)
	}
	// revert without a backup falls back to each event's .Default sound
	_ = e.Apply("win_sounds_off", "")
	_ = e.Backup.Clear("win_sounds_off")
	if r := e.Revert("win_sounds_off"); r.Error != "" {
		t.Fatalf("revert without backup %+v", r)
	}
	if v, _ := f.RegGet(S+`\Apps\Explorer\Navigating\.Current`, ""); fmt.Sprint(v.Value) != `C:\Windows\media\Windows Navigation Start.wav` {
		t.Fatalf("fallback must copy .Default into .Current: %v", v)
	}
}

func TestStageTweaksAreWiredIn(t *testing.T) {
	want := []string{"usb_suspend_off", "pcie_aspm_off", "disk_sleep_off", "cpu_min_100", "cooling_active", "sleep_never_ac", "slideshow_paused", "nic_power_mgmt_off", "fast_startup_off", "diagtrack_off", "svc_unused_off", "wer_off", "geolocation_off", "hyperv_guest_off", "bluetooth_off", "print_off", "imaging_off", "mixed_reality_off", "netbios_helper_off", "iphelper_off", "telemetry_tasks_off", "defrag_schedule_off", "wu_notify_only", "store_autoupdate_off", "cortana_off", "privacy_off", "win_sounds_off"}
	for _, id := range want {
		if tweaks.ByID(id) == nil {
			t.Fatalf("%s missing from All", id)
		}
	}
	if len(tweaks.Stage) != len(want) {
		t.Fatalf("Stage has %d tweaks, the list above %d", len(tweaks.Stage), len(want))
	}
	// the guide's Fast Startup advice is part of the Valorant freeze bundle
	if p := tweaks.PresetByID("val_freeze"); p == nil || !contains(p.Tweaks, "fast_startup_off") {
		t.Fatal("val_freeze should include fast_startup_off")
	}
	// the one-click boost stays cheap: no PowerShell-based stage tweak is recommended
	for _, id := range []string{"telemetry_tasks_off", "defrag_schedule_off"} {
		if tweaks.ByID(id).Recommended {
			t.Fatalf("%s must not be in the recommended set", id)
		}
	}
	// nothing the guide marks as a trade-off is applied by the one-click boost
	for _, id := range []string{"bluetooth_off", "print_off", "imaging_off", "sleep_never_ac", "cpu_min_100", "wu_notify_only", "nic_power_mgmt_off", "fast_startup_off"} {
		tw := tweaks.ByID(id)
		if tw.Recommended {
			t.Fatalf("%s must not be recommended", id)
		}
	}
}

func state(e *engine.Engine, id string) engine.State {
	for _, s := range e.State() {
		if s.ID == id {
			return s
		}
	}
	return engine.State{}
}

func contains(list []string, s string) bool {
	for _, x := range list {
		if x == s {
			return true
		}
	}
	return false
}
