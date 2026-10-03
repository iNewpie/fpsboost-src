// Package tools is the one-shot actions (no state to revert): ping test, flush DNS, Winsock reset, temp + shader cache
// cleanup, System Restore point, IP renew, and the Windows repair / diagnostic programs (SFC + DISM, chkdsk, memory
// test, Defender full scan, Resource Monitor) which open in their own window. The RAM cleaner lives in the guard package
// and is plugged in by main.
package tools

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"fpsboost.ir/app/internal/engine"
)

// Action is one tool.
type Action struct {
	ID     string                                  `json:"id"`
	Title  engine.Text                             `json:"title"`
	Desc   engine.Text                             `json:"desc"`
	Reboot bool                                    `json:"reboot,omitempty"`
	Icon   string                                  `json:"icon,omitempty"`
	Run    func(s engine.Sys) (engine.Text, error) `json:"-"`
}

// Env tells the cleaners where Windows keeps things. Start opens a program in its own visible window and returns at
// once (win.StartVisible); nil on non-Windows.
type Env struct {
	Temp, SystemRoot, LocalAppData string
	Start                          func(exe, cmdLine string) error
}

func t(en, fa string) engine.Text { return engine.Text{En: en, Fa: fa} }

// Actions builds the list. ramClean is the guard's cleaner (nil on non-Windows).
func Actions(env Env, ramClean func() (freedMB int, err error)) []*Action {
	list := []*Action{
		{ID: "ram_clean", Icon: "ram", Title: t("Free RAM now", "آزادسازی رم همین حالا"),
			Desc: t("Trims idle apps and purges the standby cache — what the background Guard does when a game starts.", "برنامه‌های بیکار را فشرده و کش standby را خالی می‌کند — همان کاری که گارد پس‌زمینه هنگام شروع بازی انجام می‌دهد."),
			Run: func(engine.Sys) (engine.Text, error) {
				if ramClean == nil {
					return engine.Text{}, fmt.Errorf("not available on this system")
				}
				mb, err := ramClean()
				if err != nil {
					return engine.Text{}, err
				}
				return t(fmt.Sprintf("Freed %d MB", mb), fmt.Sprintf("%d مگابایت آزاد شد", mb)), nil
			}},
		{ID: "restore_point", Icon: "shield", Title: t("Create a System Restore point", "ساخت نقطهٔ بازیابی ویندوز (System Restore)"),
			Desc: t("A Windows snapshot you can roll back to from Settings → Recovery, independent of this app. Made automatically before the first boost.", "یک عکس فوری از ویندوز که از Settings → Recovery می‌توانید به آن برگردید، مستقل از این برنامه. قبل از اولین بوست خودکار ساخته می‌شود."),
			Run: func(s engine.Sys) (engine.Text, error) {
				r, err := RestorePoint(s)
				if err != nil {
					return engine.Text{}, err
				}
				if r.Skipped {
					return t("A restore point from the last 24 h already exists", "نقطهٔ بازیابی ۲۴ ساعت اخیر از قبل وجود دارد"), nil
				}
				return t("Restore point created", "نقطهٔ بازیابی ساخته شد"), nil
			}},
		{ID: "flush_dns", Icon: "dns", Title: t("Flush DNS cache", "پاک کردن کش DNS"),
			Desc: t("Forget cached name lookups — fixes sites that resolve to a dead or slow address.", "رکوردهای کش‌شده را فراموش می‌کند — سایت‌هایی که به آدرس مرده یا کند می‌روند درست می‌شوند."),
			Run: func(s engine.Sys) (engine.Text, error) {
				if _, err := engine.Must(s, 20*time.Second, "ipconfig", "/flushdns"); err != nil {
					return engine.Text{}, err
				}
				return t("DNS cache flushed", "کش DNS پاک شد"), nil
			}},
		{ID: "ip_renew", Icon: "net", Title: t("Renew the IP address", "گرفتن IP جدید"),
			Desc: t("Releases and renews the DHCP lease on every adapter — the quick fix for \"no internet\" after a modem restart.", "اجارهٔ DHCP همهٔ کارت‌ها را آزاد و دوباره می‌گیرد — رفع سریع «بدون اینترنت» بعد از ریستارت مودم."),
			Run: func(s engine.Sys) (engine.Text, error) {
				s.Run(30*time.Second, "ipconfig", "/release")
				if _, err := engine.Must(s, 60*time.Second, "ipconfig", "/renew"); err != nil {
					return engine.Text{}, err
				}
				return t("IP address renewed", "IP جدید گرفته شد"), nil
			}},
		{ID: "winsock_reset", Icon: "reset", Reboot: true, Title: t("Reset Winsock + TCP/IP stack", "ریست Winsock و TCP/IP"),
			Desc: t("Rebuilds the network stack config. The fix for \"connected but nothing loads\" after VPNs or antivirus leftovers. Needs a restart.", "پیکربندی شبکه را از نو می‌سازد. درمان «وصل است ولی چیزی باز نمی‌شود» بعد از VPN یا آنتی‌ویروس. نیاز به ریستارت."),
			Run: func(s engine.Sys) (engine.Text, error) {
				if _, err := engine.Must(s, 30*time.Second, "netsh", "winsock", "reset"); err != nil {
					return engine.Text{}, err
				}
				s.Run(30*time.Second, "netsh", "int", "ip", "reset")
				return t("Network stack reset — restart Windows", "شبکه ریست شد — ویندوز را ریستارت کنید"), nil
			}},
		{ID: "clean_temp", Icon: "broom", Title: t("Clean temporary files", "پاک‌سازی فایل‌های موقت"),
			Desc: t("Deletes files in your Temp and Windows\\Temp folders (files in use are skipped).", "فایل‌های پوشهٔ Temp شما و Windows\\Temp را حذف می‌کند (فایل‌های در حال استفاده رد می‌شوند)."),
			Run: func(engine.Sys) (engine.Text, error) {
				var dirs []string
				if env.Temp != "" {
					dirs = append(dirs, env.Temp)
				}
				if env.SystemRoot != "" {
					dirs = append(dirs, filepath.Join(env.SystemRoot, "Temp"))
				}
				mb := CleanDirs(dirs, 0)
				return t(fmt.Sprintf("Freed %d MB", mb), fmt.Sprintf("%d مگابایت آزاد شد", mb)), nil
			}},
		{ID: "clean_shader", Icon: "gpu", Title: t("Clear shader caches", "پاک کردن کش شیدرها"),
			Desc: t("Deletes the DirectX, NVIDIA and AMD shader caches. Games rebuild them on the next launch — cures stutter left behind by a driver update.", "کش شیدر DirectX، انویدیا و AMD را حذف می‌کند. بازی‌ها در اجرای بعدی دوباره می‌سازند — لگ باقی‌مانده از آپدیت درایور را درمان می‌کند."),
			Run: func(engine.Sys) (engine.Text, error) {
				if env.LocalAppData == "" {
					return engine.Text{}, fmt.Errorf("not available on this system")
				}
				var dirs []string
				for _, d := range []string{`D3DSCache`, `NVIDIA\DXCache`, `NVIDIA\GLCache`, `AMD\DxCache`, `AMD\DxcCache`, `AMD\GLCache`, `AMD\VkCache`} {
					dirs = append(dirs, filepath.Join(env.LocalAppData, d))
				}
				mb := CleanDirs(dirs, 0)
				return t(fmt.Sprintf("Freed %d MB — games rebuild their cache on first launch", mb), fmt.Sprintf("%d مگابایت آزاد شد — بازی‌ها در اولین اجرا کش را دوباره می‌سازند", mb)), nil
			}},
		{ID: "sfc_scan", Icon: "tool", Title: t("Repair Windows system files (DISM + SFC)", "ترمیم فایل‌های سیستمی ویندوز (DISM + SFC)"),
			Desc: t("Opens a window that runs DISM /RestoreHealth and then sfc /scannow: damaged Windows files are replaced from Microsoft's copy. The cure for random crashes and DirectX errors after a bad update. Takes 10–30 minutes; needs internet.", "پنجره‌ای باز می‌کند که DISM /RestoreHealth و بعد sfc /scannow را اجرا می‌کند: فایل‌های خراب ویندوز از نسخهٔ مایکروسافت جایگزین می‌شوند. درمان کرش‌های تصادفی و خطاهای DirectX بعد از یک آپدیت بد. ۱۰ تا ۳۰ دقیقه؛ اینترنت لازم است."),
			Run: visible(env, "cmd.exe", `cmd.exe /c "title FPS Boost - Windows repair & echo Step 1/2: DISM & DISM /Online /Cleanup-Image /RestoreHealth & echo. & echo Step 2/2: SFC & sfc /scannow & echo. & pause"`,
				t("Started in a new window — wait for it to finish, then restart Windows", "در پنجرهٔ جدید شروع شد — تا تمام شود صبر کنید، بعد ویندوز را ریستارت کنید"))},
		{ID: "chkdsk_scan", Icon: "tool", Title: t("Check the Windows drive for errors (chkdsk)", "بررسی خطاهای درایو ویندوز (chkdsk)"),
			Desc: t("Opens a window that runs an online chkdsk scan of the Windows drive — no restart needed. File-system errors and bad sectors make games load wrong files and crash at random; this finds them and schedules the repair.", "پنجره‌ای باز می‌کند که اسکن آنلاین chkdsk روی درایو ویندوز اجرا می‌کند — بدون ریستارت. خطاهای فایل‌سیستم و بدسکتور باعث می‌شوند بازی فایل اشتباه بارگذاری کند و تصادفی کرش کند؛ این آن‌ها را پیدا و تعمیر را زمان‌بندی می‌کند."),
			Run: visible(env, "cmd.exe", `cmd.exe /c "title FPS Boost - Disk check & chkdsk %SystemDrive% /scan & echo. & pause"`,
				t("Started in a new window — a few minutes", "در پنجرهٔ جدید شروع شد — چند دقیقه"))},
		{ID: "mem_test", Icon: "ram", Reboot: true, Title: t("Test the RAM (Windows Memory Diagnostic)", "تست رم (Windows Memory Diagnostic)"),
			Desc: t("Opens the Windows Memory Diagnostic. Faulty RAM shows up as blue screens and crashes that no setting fixes. Choose 'Restart now' — the test runs before Windows starts and reports after sign-in.", "Windows Memory Diagnostic را باز می‌کند. رم خراب به‌شکل صفحهٔ آبی و کرش‌هایی که هیچ تنظیمی درست نمی‌کند ظاهر می‌شود. «Restart now» را بزنید — تست قبل از بالا آمدن ویندوز اجرا و بعد از ورود گزارش می‌شود."),
			Run:  visible(env, "mdsched.exe", "", t("Memory Diagnostic opened — choose 'Restart now'", "Memory Diagnostic باز شد — «Restart now» را بزنید"))},
		{ID: "defender_scan", Icon: "shield", Title: t("Full Microsoft Defender scan", "اسکن کامل Microsoft Defender"),
			Desc: t("Opens a window that runs a full Defender scan of every file. Malware and miners are a classic hidden FPS killer — scan before you blame your hardware. Takes 30–90 minutes; keep playing meanwhile if you like.", "پنجره‌ای باز می‌کند که اسکن کامل Defender روی همهٔ فایل‌ها اجرا می‌کند. بدافزار و ماینر FPS‌کش پنهان کلاسیک‌اند — قبل از اینکه سخت‌افزار را مقصر بدانید اسکن کنید. ۳۰ تا ۹۰ دقیقه؛ در این بین می‌توانید بازی کنید."),
			Run: visible(env, "cmd.exe", `cmd.exe /c "title FPS Boost - Defender full scan & "%ProgramFiles%\Windows Defender\MpCmdRun.exe" -Scan -ScanType 2 & echo. & pause"`,
				t("Started in a new window", "در پنجرهٔ جدید شروع شد"))},
		{ID: "resmon", Icon: "cpu", Title: t("Open Resource Monitor", "باز کردن Resource Monitor"),
			Desc: t("Windows' detailed live view of which process eats CPU, disk, network and memory — find the updater or launcher that steals frames while you play.", "نمای زندهٔ دقیق ویندوز از اینکه کدام پروسه CPU، دیسک، شبکه و حافظه را می‌خورد — آپدیتر یا لانچری که هنگام بازی فریم می‌دزدد را پیدا کنید."),
			Run:  visible(env, "resmon.exe", "", t("Resource Monitor opened", "Resource Monitor باز شد"))},
	}
	return list
}

// visible builds a Run that opens a program in its own window (see Env.Start) and reports msg.
func visible(env Env, exe, cmdLine string, msg engine.Text) func(engine.Sys) (engine.Text, error) {
	return func(engine.Sys) (engine.Text, error) {
		if env.Start == nil {
			return engine.Text{}, fmt.Errorf("not available on this system")
		}
		if err := env.Start(exe, cmdLine); err != nil {
			return engine.Text{}, fmt.Errorf("could not start %s: %v", exe, err)
		}
		return msg, nil
	}
}

// Find returns an action by id.
func Find(list []*Action, id string) *Action {
	for _, a := range list {
		if a.ID == id {
			return a
		}
	}
	return nil
}

// CleanDirs deletes files under the folders (never the folders themselves); files in use are skipped. minAge skips
// files younger than that. Returns MB freed.
func CleanDirs(dirs []string, minAge time.Duration) int {
	var freed int64
	cutoff := time.Now().Add(-minAge)
	for _, d := range dirs {
		if d == "" {
			continue
		}
		_ = filepath.WalkDir(d, func(p string, e os.DirEntry, err error) error {
			if err != nil || e.IsDir() || p == d {
				return nil
			}
			info, err := e.Info()
			if err != nil || (minAge > 0 && info.ModTime().After(cutoff)) {
				return nil
			}
			if os.Remove(p) == nil {
				freed += info.Size()
			}
			return nil
		})
		// empty sub folders
		_ = filepath.WalkDir(d, func(p string, e os.DirEntry, err error) error {
			if err == nil && e.IsDir() && p != d {
				os.Remove(p)
			}
			return nil
		})
	}
	return int(freed / 1048576)
}

// RestoreResult of RestorePoint.
type RestoreResult struct {
	Skipped bool
}

// RestorePoint enables protection on the system drive if it is off, then checkpoints. Windows makes at most one restore
// point per 24 h through this API (it silently skips otherwise) — reported as Skipped.
func RestorePoint(s engine.Sys) (*RestoreResult, error) {
	const script = `try { Enable-ComputerRestore -Drive "$env:SystemDrive\" -ErrorAction SilentlyContinue; $before = (Get-ComputerRestorePoint | Measure-Object).Count; Checkpoint-Computer -Description "FPS Boost" -RestorePointCreationType MODIFY_SETTINGS -ErrorAction Stop; $after = (Get-ComputerRestorePoint | Measure-Object).Count; if ($after -gt $before) { 'created' } else { 'skipped' } } catch { 'unavailable: ' + $_.Exception.Message }`
	out, err := engine.PS(s, 3*time.Minute, script)
	if err != nil {
		return nil, fmt.Errorf("System Restore is not available on this PC")
	}
	out = strings.TrimSpace(out)
	if strings.HasPrefix(out, "unavailable") {
		return nil, fmt.Errorf("System Restore is not available: %s", strings.TrimPrefix(out, "unavailable: "))
	}
	return &RestoreResult{Skipped: out == "skipped"}, nil
}

// PingResult is one host.
type PingResult struct {
	Host string `json:"host"`
	Avg  *int   `json:"avg"` // nil = no reply
	Min  int    `json:"min"`
	Max  int    `json:"max"`
	Loss int    `json:"loss"`
}

var msRe = regexp.MustCompile(`[=<](\d+)\s*ms`)

// Ping runs Windows ping per host — all hosts at once, 4 echoes with a 1 s reply window, so the whole test takes about
// as long as the slowest host instead of the sum. Works on any Windows language (parses the digits before "ms").
func Ping(s engine.Sys, hosts []string) []PingResult {
	out := make([]PingResult, len(hosts))
	var wg sync.WaitGroup
	for i, h := range hosts {
		wg.Add(1)
		go func(i int, h string) {
			defer wg.Done()
			r := s.Run(12*time.Second, "ping", "-n", "4", "-w", "1000", h)
			var times []int
			for _, m := range msRe.FindAllStringSubmatch(r.Out, -1) {
				n, _ := strconv.Atoi(m[1])
				times = append(times, n)
			}
			pr := PingResult{Host: h, Loss: 4 - len(times)}
			if len(times) > 0 {
				sum, mn, mx := 0, times[0], times[0]
				for _, v := range times {
					sum += v
					if v < mn {
						mn = v
					}
					if v > mx {
						mx = v
					}
				}
				avg := int(float64(sum)/float64(len(times)) + 0.5)
				pr.Avg, pr.Min, pr.Max = &avg, mn, mx
			}
			if pr.Loss < 0 {
				pr.Loss = 0
			}
			out[i] = pr
		}(i, h)
	}
	wg.Wait()
	return out
}

var hostRe = regexp.MustCompile(`^[A-Za-z0-9.:-]{1,100}$`)

// CleanHosts keeps only sane host names / IPs (max 8).
func CleanHosts(in []string, fallback []string) []string {
	var out []string
	for _, h := range in {
		h = strings.TrimSpace(h)
		if hostRe.MatchString(h) {
			out = append(out, h)
		}
		if len(out) == 8 {
			break
		}
	}
	if len(out) == 0 {
		return fallback
	}
	return out
}
