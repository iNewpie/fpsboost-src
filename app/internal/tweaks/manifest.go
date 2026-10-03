// Package tweaks is every tweak the app offers (category fps | network, level safe | advanced) plus the game presets.
// Titles and descriptions are bilingual; registry tweaks are declarative (engine.RegTweak), the rest are hand-written.
package tweaks

import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	"fpsboost.ir/app/internal/dns"
	. "fpsboost.ir/app/internal/engine"
)

const (
	HKCU = "HKCU"
	HKLM = "HKLM"
	mm   = HKLM + `\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile`
	gms  = mm + `\Tasks\Games`
	gcs  = HKCU + `\System\GameConfigStore`
	cdm  = HKCU + `\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager`
	gbar = HKCU + `\Software\Microsoft\GameBar`
)

func T(en, fa string) Text { return Text{En: en, Fa: fa} }

func meta(id, cat, level string, rec bool, reboot bool, title, desc Text) Meta {
	return Meta{ID: id, Category: cat, Level: level, Recommended: rec, Reboot: reboot, Title: title, Desc: desc}
}

// FPS tweaks
var FPS = []*Tweak{
	RegTweak(meta("game_dvr_off", "fps", "safe", true, false,
		T("Turn off Game DVR / background recording", "خاموش کردن Game DVR و ضبط پس‌زمینه"),
		T("Windows records gameplay in the background for the Xbox Game Bar. Off = no hidden encoder eating FPS.", "ویندوز در پس‌زمینه برای Xbox Game Bar گیم‌پلی ضبط می‌کند. خاموش = هیچ انکودر پنهانی FPS نمی‌خورد.")),
		DW(gcs, "GameDVR_Enabled", 0), DW(HKCU+`\Software\Microsoft\Windows\CurrentVersion\GameDVR`, "AppCaptureEnabled", 0), DW(HKLM+`\SOFTWARE\Policies\Microsoft\Windows\GameDVR`, "AllowGameDVR", 0)),
	RegTweak(meta("game_mode_on", "fps", "safe", true, false,
		T("Enable Game Mode", "فعال کردن Game Mode"),
		T("Windows gives the game priority over background tasks and Windows Update while playing.", "ویندوز هنگام بازی، بازی را بر کارهای پس‌زمینه و آپدیت ویندوز مقدم می‌کند.")),
		DW(gbar, "AutoGameModeEnabled", 1), DW(gbar, "AllowAutoGameMode", 1)),
	RegTweak(meta("fse_off", "fps", "safe", true, false,
		T("Disable fullscreen optimizations", "غیرفعال کردن Fullscreen Optimizations"),
		T("Games get true exclusive fullscreen instead of the borderless compositor path — lower input lag, steadier frame times.", "بازی‌ها فول‌اسکرین واقعی می‌گیرند به‌جای مسیر ترکیب‌ساز ویندوز — تأخیر ورودی کمتر، فریم‌تایم پایدارتر.")),
		DW(gcs, "GameDVR_FSEBehaviorMode", 2), DW(gcs, "GameDVR_HonorUserFSEBehaviorMode", 1), DW(gcs, "GameDVR_DXGIHonorFSEWindowsCompatible", 1), DW(gcs, "GameDVR_EFSEFeatureFlags", 0)),
	RegTweak(meta("mm_games_priority", "fps", "safe", true, false,
		T("Prioritise games in the multimedia scheduler", "اولویت بازی‌ها در زمان‌بند چندرسانه‌ای"),
		T("SystemResponsiveness 0 and the \"Games\" task at high GPU/CPU priority: the scheduler stops reserving CPU for background work while a game runs.", "SystemResponsiveness روی ۰ و تسک «Games» با اولویت بالای GPU/CPU: زمان‌بند دیگر برای کارهای پس‌زمینه CPU رزرو نمی‌کند.")),
		DW(mm, "SystemResponsiveness", 0), DW(gms, "GPU Priority", 8), DW(gms, "Priority", 6), SZ(gms, "Scheduling Category", "High"), SZ(gms, "SFIO Priority", "High")),
	RegTweak(meta("mouse_accel_off", "fps", "safe", true, false,
		T("Disable mouse acceleration", "غیرفعال کردن شتاب ماوس"),
		T("\"Enhance pointer precision\" off: the same hand movement always moves the same distance — what every aim guide asks for.", "خاموش کردن Enhance pointer precision: حرکت یکسان دست همیشه به یک اندازه جابه‌جا می‌کند — چیزی که هر راهنمای ایم می‌خواهد.")),
		SZ(HKCU+`\Control Panel\Mouse`, "MouseSpeed", "0"), SZ(HKCU+`\Control Panel\Mouse`, "MouseThreshold1", "0"), SZ(HKCU+`\Control Panel\Mouse`, "MouseThreshold2", "0")),
	RegTweak(meta("background_apps_off", "fps", "safe", true, false,
		T("Stop Store apps running in the background", "توقف اجرای پس‌زمینهٔ برنامه‌های استور"),
		T("UWP apps (Xbox, Weather, News…) stop waking up behind your game.", "برنامه‌های UWP (ایکس‌باکس، هواشناسی، اخبار…) دیگر پشت بازی شما بیدار نمی‌شوند.")),
		DW(HKCU+`\Software\Microsoft\Windows\CurrentVersion\BackgroundAccessApplications`, "GlobalUserDisabled", 1)),
	RegTweak(meta("game_bar_off", "fps", "safe", true, false,
		T("Disable the Xbox Game Bar overlay", "غیرفعال کردن اورلی Xbox Game Bar"),
		T("No overlay hooks into your games and no startup panel — one less process drawing on top of every frame.", "هیچ اورلی‌ای به بازی قلاب نمی‌شود و پنل شروع نمی‌آید — یک پروسهٔ کمتر روی هر فریم.")),
		DW(gbar, "ShowStartupPanel", 0), DW(gbar, "UseNexusForGameBarEnabled", 0), DW(gbar, "GamePanelStartupTipIndex", 3)),
	RegTweak(meta("telemetry_off", "fps", "safe", true, false,
		T("Stop diagnostics & telemetry uploads", "توقف ارسال دیاگنوستیک و تله‌متری"),
		T("Windows stops collecting and uploading usage data in the background — less disk and network activity while you play.", "ویندوز دیگر در پس‌زمینه دادهٔ مصرف جمع و آپلود نمی‌کند — فعالیت دیسک و شبکهٔ کمتر هنگام بازی.")),
		DW(HKLM+`\SOFTWARE\Policies\Microsoft\Windows\DataCollection`, "AllowTelemetry", 0), DW(HKLM+`\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\DataCollection`, "AllowTelemetry", 0)),
	RegTweak(meta("widgets_off", "fps", "safe", true, false,
		T("Turn off taskbar widgets / news feed", "خاموش کردن ویجت‌ها و فید خبری تسک‌بار"),
		T("The Windows 11 widgets board and the Windows 10 news feed refresh in the background all day. Off = no Edge WebView processes idling behind your game.", "ویجت‌های ویندوز ۱۱ و فید خبری ویندوز ۱۰ تمام روز در پس‌زمینه رفرش می‌شوند. خاموش = هیچ پروسهٔ WebView پشت بازی بیکار نمی‌چرخد.")),
		DW(HKLM+`\SOFTWARE\Policies\Microsoft\Dsh`, "AllowNewsAndInterests", 0), DW(HKCU+`\Software\Microsoft\Windows\CurrentVersion\Feeds`, "ShellFeedsTaskbarViewMode", 2)),
	RegTweak(meta("tips_off", "fps", "safe", true, false,
		T("Disable tips, suggestions and Start ads", "غیرفعال کردن نکته‌ها، پیشنهادها و تبلیغ‌های Start"),
		T("Content Delivery Manager stops fetching suggested apps and tips — fewer surprise downloads and notifications mid-game.", "Content Delivery Manager دیگر برنامهٔ پیشنهادی و نکته دانلود نمی‌کند — دانلود و نوتیفیکیشن ناگهانی کمتر وسط بازی.")),
		DW(cdm, "SubscribedContent-338389Enabled", 0), DW(cdm, "SoftLandingEnabled", 0), DW(cdm, "SystemPaneSuggestionsEnabled", 0), DW(cdm, "SilentInstalledAppsEnabled", 0)),
	RegTweak(meta("startup_delay_off", "fps", "safe", true, false,
		T("Remove the startup app delay", "حذف تأخیر اجرای برنامه‌های استارتاپ"),
		T("Windows waits ~10 seconds after sign-in before starting your startup apps. Off = launchers, Discord and this app are ready when the desktop is.", "ویندوز بعد از ورود حدود ۱۰ ثانیه صبر می‌کند تا برنامه‌های استارتاپ را اجرا کند. خاموش = لانچرها، دیسکورد و همین برنامه با دسکتاپ آماده‌اند.")),
		DW(HKCU+`\Software\Microsoft\Windows\CurrentVersion\Explorer\Serialize`, "StartupDelayInMSec", 0)),
	RegTweak(meta("menu_delay_off", "fps", "safe", true, false,
		T("Instant menus and a snappier desktop", "منوهای آنی و دسکتاپ چابک‌تر"),
		T("Removes the 400 ms delay before menus open. Pure feel — the desktop reacts the moment you click.", "تأخیر ۴۰۰ میلی‌ثانیه‌ای باز شدن منوها را حذف می‌کند. فقط حس — دسکتاپ همان لحظهٔ کلیک واکنش می‌دهد.")),
		SZ(HKCU+`\Control Panel\Desktop`, "MenuShowDelay", "0")),
	RegTweak(meta("sticky_keys_off", "fps", "safe", true, false,
		T("Disable Sticky / Filter / Toggle Keys shortcuts", "غیرفعال کردن میان‌برهای Sticky / Filter / Toggle Keys"),
		T("Pressing Shift five times in a fight will never again pop the Sticky Keys dialog over your game.", "دیگر پنج بار Shift زدن وسط درگیری، پنجرهٔ Sticky Keys را روی بازی نمی‌آورد.")),
		SZ(HKCU+`\Control Panel\Accessibility\StickyKeys`, "Flags", "506"), SZ(HKCU+`\Control Panel\Accessibility\ToggleKeys`, "Flags", "58"), SZ(HKCU+`\Control Panel\Accessibility\Keyboard Response`, "Flags", "122")),
	powerPlan(),
	RegTweak(meta("hags_on", "fps", "advanced", false, true,
		T("Hardware-accelerated GPU scheduling", "زمان‌بندی سخت‌افزاری GPU (HAGS)"),
		T("Lets the GPU manage its own memory queue (Windows 10 2004+, recent GPUs). Helps some systems, hurts a few — test with a game you know.", "اجازه می‌دهد GPU صف حافظهٔ خودش را مدیریت کند (ویندوز ۱۰ ۲۰۰۴ به بالا، کارت‌های جدید). به بعضی سیستم‌ها کمک و به بعضی ضرر می‌زند — با بازی آشنا تست کنید.")),
		DW(HKLM+`\SYSTEM\CurrentControlSet\Control\GraphicsDrivers`, "HwSchMode", 2)),
	RegTweak(meta("power_throttling_off", "fps", "advanced", false, true,
		T("Disable power throttling", "غیرفعال کردن Power Throttling"),
		T("Windows no longer slows background processes to save power — for laptops on the charger and desktops.", "ویندوز دیگر پردازش‌های پس‌زمینه را برای صرفه‌جویی برق کند نمی‌کند — برای لپ‌تاپ روی شارژر و دسکتاپ.")),
		DW(HKLM+`\SYSTEM\CurrentControlSet\Control\Power\PowerThrottling`, "PowerThrottlingOff", 1)),
	RegTweak(meta("visual_fx_perf", "fps", "advanced", false, false,
		T("Visual effects: best performance", "جلوه‌های بصری: بهترین کارایی"),
		T("Turns off window animations, shadows and transparency. Frees a little GPU and makes the desktop snappier — looks plainer.", "انیمیشن پنجره‌ها، سایه‌ها و شفافیت را خاموش می‌کند. کمی GPU آزاد می‌کند و دسکتاپ چابک‌تر می‌شود — ظاهر ساده‌تر.")),
		DW(HKCU+`\Software\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects`, "VisualFXSetting", 2), DW(HKCU+`\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize`, "EnableTransparency", 0)),
	RegTweak(meta("win32_priority", "fps", "advanced", false, false,
		T("Longer CPU time slices for the foreground app", "زمان CPU طولانی‌تر برای برنامهٔ جلو"),
		T("Win32PrioritySeparation 0x26: the active window (your game) gets long, fixed quanta with a foreground boost. Background downloads and launchers get less. Revert if a streaming/recording app stutters.", "Win32PrioritySeparation روی 0x26: پنجرهٔ فعال (بازی) سهم بلند و ثابت CPU با بوست جلو می‌گیرد. دانلود و لانچرهای پس‌زمینه کمتر. اگر برنامهٔ استریم/ضبط لگ زد برگردانید.")),
		DW(HKLM+`\SYSTEM\CurrentControlSet\Control\PriorityControl`, "Win32PrioritySeparation", 38)),
	RegTweak(meta("paging_executive_off", "fps", "advanced", false, true,
		T("Keep the Windows kernel in RAM", "نگه داشتن هستهٔ ویندوز در رم"),
		T("DisablePagingExecutive: kernel code and drivers are never paged to disk. Smoother on PCs with 16 GB or more — skip it with 8 GB.", "DisablePagingExecutive: کد هسته و درایورها هیچ‌وقت به دیسک منتقل نمی‌شوند. روی سیستم‌های ۱۶ گیگ به بالا روان‌تر — با ۸ گیگ بی‌خیالش شوید.")),
		DW(HKLM+`\SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management`, "DisablePagingExecutive", 1)),
	RegTweak(meta("timer_global", "fps", "advanced", false, true,
		T("Allow a global 0.5 ms system timer", "اجازهٔ تایمر سراسری ۰٫۵ میلی‌ثانیه"),
		T("Windows 10 2004+ and 11 ignore timer requests from other processes. With this, the background Guard's 0.5 ms timer applies to your game too — steadier frame pacing and lower input delay.", "ویندوز ۱۰ ۲۰۰۴ به بالا و ۱۱ درخواست تایمر برنامه‌های دیگر را نادیده می‌گیرند. با این گزینه تایمر ۰٫۵ میلی‌ثانیه‌ای گارد پس‌زمینه برای بازی شما هم اعمال می‌شود — فریم‌پیسینگ پایدارتر و تأخیر ورودی کمتر.")),
		DW(HKLM+`\SYSTEM\CurrentControlSet\Control\Session Manager\kernel`, "GlobalTimerResolutionRequests", 1)),
	RegTweak(meta("hags_off", "fps", "advanced", false, true,
		T("Turn OFF hardware-accelerated GPU scheduling (freeze fix)", "خاموش کردن زمان‌بندی سخت‌افزاری GPU (رفع فریز)"),
		T("The opposite of HAGS on: on older or integrated GPUs, HAGS causes multi-second screen freezes and stutter in Valorant (Unreal Engine 5) and other games. Off = the CPU schedules the GPU again. Needs a restart.", "برعکس HAGS روشن: روی کارت‌های قدیمی یا داخلی، HAGS باعث فریزهای چندثانیه‌ای و لگ در والورانت (آنریل ۵) و بازی‌های دیگر می‌شود. خاموش = CPU دوباره GPU را زمان‌بندی می‌کند. نیاز به ریستارت.")),
		DW(HKLM+`\SYSTEM\CurrentControlSet\Control\GraphicsDrivers`, "HwSchMode", 1)),
	RegTweak(meta("mpo_off", "fps", "advanced", false, true,
		T("Disable Multi-Plane Overlay (black screens, flicker, freezes)", "غیرفعال کردن Multi-Plane Overlay (صفحهٔ سیاه، پرش، فریز)"),
		T("MPO lets the desktop compositor hand game frames to the display driver directly; on many NVIDIA/AMD/Intel drivers it causes stutter, flicker, black screens and freezes when alt-tabbing or in fullscreen games. Microsoft's own workaround. Needs a restart.", "MPO اجازه می‌دهد فریم‌های بازی مستقیم به درایور نمایشگر برسند؛ روی خیلی از درایورهای انویدیا/AMD/اینتل باعث لگ، پرش تصویر، صفحهٔ سیاه و فریز هنگام Alt+Tab یا در بازی فول‌اسکرین می‌شود. راه‌حل خود مایکروسافت. نیاز به ریستارت.")),
		DW(HKLM+`\SOFTWARE\Microsoft\Windows\Dwm`, "OverlayTestMode", 5)),
	pagefileFixed(),
	RegTweak(meta("hvci_off", "fps", "advanced", false, true,
		T("Turn off Memory Integrity (core isolation)", "خاموش کردن Memory Integrity (ایزوله‌سازی هسته)"),
		T("Hypervisor-protected code integrity costs 5–15% CPU on older processors and adds frame-time spikes. Off = that overhead is gone. It is a real security feature (blocks some driver exploits); turn it back on when you stop gaming on this PC. Needs a restart.", "Memory Integrity روی پردازنده‌های قدیمی ۵ تا ۱۵٪ CPU می‌خورد و جهش فریم‌تایم اضافه می‌کند. خاموش = این سربار می‌رود. یک ویژگی امنیتی واقعی است (جلوی بعضی اکسپلویت‌های درایور را می‌گیرد)؛ وقتی دیگر با این سیستم بازی نمی‌کنید روشنش کنید. نیاز به ریستارت.")),
		DW(HKLM+`\SYSTEM\CurrentControlSet\Control\DeviceGuard\Scenarios\HypervisorEnforcedCodeIntegrity`, "Enabled", 0)),
	PowercfgTweak(meta("core_parking_off", "fps", "advanced", false, false,
		T("Disable CPU core parking", "غیرفعال کردن پارک شدن هسته‌های CPU"),
		T("Keeps every core awake instead of parking idle ones. Removes the micro-stutter when a game suddenly needs more threads.", "همهٔ هسته‌ها را بیدار نگه می‌دارد به‌جای پارک کردن هسته‌های بیکار. میکرو‌لگ وقتی بازی ناگهان ترد بیشتری می‌خواهد از بین می‌رود.")),
		"54533251-82be-4824-96c1-47b60b740d00", "0cc5b647-c1df-4637-891a-dec35c318583", 100),
	ServiceTweak(meta("sysmain_off", "fps", "advanced", false, false,
		T("Disable SysMain (Superfetch)", "غیرفعال کردن SysMain (Superfetch)"),
		T("SysMain preloads apps into RAM and thrashes hard drives. Worth it on an HDD or a PC with little RAM; leave it on with an SSD and 16 GB+.", "SysMain برنامه‌ها را در رم پیش‌بارگذاری می‌کند و هارد را به کار می‌اندازد. روی HDD یا رم کم می‌ارزد؛ با SSD و ۱۶ گیگ به بالا روشن بگذارید.")),
		"SysMain"),
	ServiceTweak(meta("wsearch_off", "fps", "advanced", false, false,
		T("Disable Windows Search indexing", "غیرفعال کردن ایندکس Windows Search"),
		T("The indexer rescans your drives in the background. Off = no disk spikes mid-game; Start menu search still works, just slower for files.", "ایندکسر در پس‌زمینه درایوها را دوباره اسکن می‌کند. خاموش = بدون جهش دیسک وسط بازی؛ جستجوی Start کار می‌کند، فقط برای فایل‌ها کندتر.")),
		"WSearch"),
}

/* ---- fixed page file: no on-the-fly growth, no "out of memory" freezes on 8 GB PCs ---- */

// TotalRAMMB is set by main (GlobalMemoryStatusEx); 0 = unknown (tests, non-Windows).
var TotalRAMMB = func() int { return 0 }

// SystemDrive is where pagefile.sys lives ("C:" unless Windows says otherwise).
var SystemDrive = func() string {
	if d := strings.TrimSpace(os.Getenv("SystemDrive")); d != "" {
		return d
	}
	return "C:"
}

const memMgmt = HKLM + `\SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management`

// PagefileSizeMB: 1.5× RAM, at least 4 GB, at most 16 GB — a fixed file Windows never has to grow mid-game.
func PagefileSizeMB(ramMB int) int {
	n := ramMB * 3 / 2
	if n < 4096 {
		n = 4096
	}
	if n > 16384 {
		n = 16384
	}
	return n
}

func pagefileLine(drive string, mb int) string {
	return fmt.Sprintf(`%s\pagefile.sys %d %d`, drive, mb, mb)
}

type pagefileBackup struct {
	Paging *RegValue `json:"paging"` // PagingFiles before (nil = value absent = system managed)
}

func pagefileFixed() *Tweak {
	t := &Tweak{Meta: meta("pagefile_fixed", "fps", "advanced", false, true,
		T("Fixed-size page file (1.5× RAM)", "فایل صفحه‌بندی با اندازهٔ ثابت (۱٫۵ برابر رم)"),
		T("Windows grows the page file on the fly when a game runs out of RAM — on 8 GB PCs with Unreal Engine 5 games (Valorant) that growth is the multi-second freeze. A fixed file of 1.5× your RAM (4–16 GB) on the Windows drive means no growth, no fragmentation, no 'out of memory' crash. Undo returns to system-managed. Needs a restart.", "وقتی بازی رم کم می‌آورد ویندوز فایل صفحه‌بندی را همان لحظه بزرگ می‌کند — روی سیستم‌های ۸ گیگ با بازی‌های آنریل ۵ (والورانت) همین رشد، همان فریز چندثانیه‌ای است. فایل ثابت ۱٫۵ برابر رم (۴ تا ۱۶ گیگ) روی درایو ویندوز یعنی بدون رشد، بدون تکه‌تکه شدن، بدون کرش «کمبود حافظه». بازگشت = مدیریت خودکار ویندوز. نیاز به ریستارت."))}
	want := func() (string, error) {
		ram := TotalRAMMB()
		if ram <= 0 {
			return "", fmt.Errorf("RAM size unknown on this PC")
		}
		return pagefileLine(SystemDrive(), PagefileSizeMB(ram)), nil
	}
	t.Check = func(c *Ctx) (bool, error) {
		w, err := want()
		if err != nil {
			return false, nil
		}
		v, err := c.Sys.RegGet(memMgmt, "PagingFiles")
		if err != nil || v == nil {
			return false, err
		}
		for _, line := range multiSZ(v.Value) {
			if strings.EqualFold(strings.TrimSpace(line), w) {
				return true, nil
			}
		}
		return false, nil
	}
	t.Apply = func(c *Ctx) error {
		w, err := want()
		if err != nil {
			return err
		}
		cur, err := c.Sys.RegGet(memMgmt, "PagingFiles")
		if err != nil {
			return err
		}
		if _, err := c.Backup.SaveOnce(c.ID, pagefileBackup{Paging: cur}); err != nil {
			return err
		}
		return c.Sys.RegSet(memMgmt, "PagingFiles", RegValue{Type: "REG_MULTI_SZ", Value: []string{w}})
	}
	t.Revert = func(c *Ctx) error {
		var b pagefileBackup
		if c.Backup.Get(c.ID, &b) && b.Paging != nil {
			if err := c.Sys.RegSet(memMgmt, "PagingFiles", *b.Paging); err != nil {
				return err
			}
		} else { // system managed
			if err := c.Sys.RegSet(memMgmt, "PagingFiles", RegValue{Type: "REG_MULTI_SZ", Value: []string{`?:\pagefile.sys`}}); err != nil {
				return err
			}
		}
		return c.Backup.Clear(c.ID)
	}
	return t
}

// multiSZ turns a registry MULTI_SZ value (live: []string, from JSON: []any, or a plain string) into lines.
func multiSZ(v any) []string {
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

/* ---- power plan: Ultimate Performance when Windows has it, else High performance ---- */

const (
	planUltimate = "e9a42b02-d5df-448d-aa00-03f14749eb61"
	planHigh     = "8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c"
	planBalanced = "381b4222-f694-41f0-9685-ff5bb260df2e"
)

type planBackup struct {
	Scheme string `json:"scheme"` // what was active before
	Set    string `json:"set"`    // what we activated (a duplicated Ultimate gets a fresh GUID)
}

func activePlan(s Sys) string {
	return FirstGUID(s.Run(10*time.Second, "powercfg", "/getactivescheme").Out)
}

func powerPlan() *Tweak {
	t := &Tweak{Meta: meta("power_plan_high", "fps", "safe", true, false,
		T("High performance power plan", "پاور پلن High performance"),
		T("Uses the Ultimate Performance plan when Windows has it, else High performance: no CPU parking, no clock ramp-down between frames.", "از پلن Ultimate Performance استفاده می‌کند اگر ویندوز داشته باشد، وگرنه High performance: بدون پارک شدن هسته‌ها، بدون افت کلاک بین فریم‌ها."))}
	t.Check = func(c *Ctx) (bool, error) {
		cur := activePlan(c.Sys)
		if cur == "" {
			return false, nil
		}
		if cur == planUltimate || cur == planHigh {
			return true, nil
		}
		var b planBackup
		return c.Backup.Get(c.ID, &b) && b.Set == cur, nil
	}
	t.Apply = func(c *Ctx) error {
		cur := activePlan(c.Sys)
		target := planUltimate
		r := c.Sys.Run(10*time.Second, "powercfg", "/setactive", planUltimate)
		if r.Code != 0 { // Ultimate is hidden on most Home installs: duplicating it creates a visible copy with a new GUID
			d := c.Sys.Run(10*time.Second, "powercfg", "/duplicatescheme", planUltimate)
			if g := FirstGUID(d.Out); g != "" {
				target = g
				r = c.Sys.Run(10*time.Second, "powercfg", "/setactive", target)
			}
		}
		if r.Code != 0 {
			target = planHigh
			if _, err := Must(c.Sys, 10*time.Second, "powercfg", "/setactive", planHigh); err != nil {
				return err
			}
		}
		var b planBackup
		if c.Backup.Get(c.ID, &b) {
			b.Set = target
			return c.Backup.Replace(c.ID, b)
		}
		_, err := c.Backup.SaveOnce(c.ID, planBackup{Scheme: cur, Set: target})
		return err
	}
	t.Revert = func(c *Ctx) error {
		b := planBackup{Scheme: planBalanced}
		c.Backup.Get(c.ID, &b)
		if b.Scheme == "" {
			b.Scheme = planBalanced
		}
		if _, err := Must(c.Sys, 10*time.Second, "powercfg", "/setactive", b.Scheme); err != nil {
			return err
		}
		return c.Backup.Clear(c.ID)
	}
	return t
}

/* ---- network ---- */

const ifaces = HKLM + `\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters\Interfaces`

// DNS resolvers live in internal/dns (ISP / anti-sanction / DNS Jumper lists + the benchmark). The dns_fast tweak
// offers every provider plus dns.Auto: scan, detect the ISP and pick (Shatel → 85.15.1.14, TCI → 217.218.127.127 …
// when they answer, otherwise the fastest public resolver).

// DNSOrder: option ids in display order (auto first).
var DNSOrder = append([]string{dns.Auto}, dns.IDs()...)

// DetectISP returns the ISP id ("" = unknown). main replaces it with a version that asks the site worker for the
// connection's ASN first; this default reads the DHCP-assigned resolvers from the registry.
var DetectISP = func(s Sys) string { return dns.ISPFromIPs(dns.DHCPNameServers(s)) }

// ScanDNS benchmarks the resolvers (replaceable in tests).
var ScanDNS = func(ctx context.Context) []dns.Result { return dns.Scan(ctx, nil, nil, dns.Options{}) }

// LastAutoPick is the provider the last "auto" apply chose (for the UI; "" = none yet).
var LastAutoPick string

func dnsOptions() map[string]string {
	m := map[string]string{dns.Auto: "Auto — best for my network (ISP first, then fastest)"}
	for _, p := range dns.Providers {
		m[p.ID] = p.Label
	}
	return m
}

// ResolveDNSOption turns dns.Auto into a concrete provider id (scan + ISP), passes other ids through.
func ResolveDNSOption(s Sys, option string) (string, error) {
	if option != dns.Auto && option != "" {
		if dns.Find(option) == nil {
			return "", fmt.Errorf("unknown DNS provider %q", option)
		}
		return option, nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 12*time.Second)
	defer cancel()
	isp := DetectISP(s)
	best := dns.Best(ScanDNS(ctx), isp)
	if best == "" {
		return "", fmt.Errorf("no DNS server answered — check the connection and try again")
	}
	LastAutoPick = best
	return best, nil
}

var Network = []*Tweak{
	nagle(),
	RegTweak(meta("network_throttling_off", "network", "safe", true, false,
		T("Remove the network throttling limit", "حذف محدودیت Network Throttling"),
		T("Windows caps non-multimedia network traffic at 10 packets/ms while media plays. Off = your game traffic is never throttled.", "ویندوز هنگام پخش رسانه، ترافیک غیرچندرسانه‌ای را به ۱۰ پکت در میلی‌ثانیه محدود می‌کند. خاموش = ترافیک بازی هیچ‌وقت محدود نمی‌شود.")),
		DW(mm, "NetworkThrottlingIndex", 0xffffffff)),
	RegTweak(meta("qos_reserve_off", "network", "safe", true, false,
		T("Stop reserving bandwidth for QoS", "لغو رزرو پهنای باند برای QoS"),
		T("Windows can hold back up to 20% of bandwidth for QoS traffic. Set the reserve to 0%.", "ویندوز می‌تواند تا ۲۰٪ پهنای باند را برای QoS نگه دارد. رزرو را روی ۰٪ می‌گذارد.")),
		DW(HKLM+`\SOFTWARE\Policies\Microsoft\Windows\Psched`, "NonBestEffortLimit", 0)),
	RegTweak(meta("delivery_optimization_off", "network", "safe", true, false,
		T("Stop Windows Update uploading to other PCs", "توقف آپلود آپدیت ویندوز به کامپیوترهای دیگر"),
		T("Delivery Optimization shares update files with strangers over your connection. Off = no surprise upload eating your ping.", "Delivery Optimization فایل‌های آپدیت را با غریبه‌ها روی اینترنت شما به اشتراک می‌گذارد. خاموش = آپلود ناگهانی پینگ شما را نمی‌خورد.")),
		DW(HKLM+`\SOFTWARE\Policies\Microsoft\Windows\DeliveryOptimization`, "DODownloadMode", 0)),
	tcpTuning(),
	dnsFast(),
	PowercfgTweak(meta("wifi_power_max", "network", "safe", false, false,
		T("Wi-Fi adapter: maximum performance", "کارت Wi-Fi: حداکثر کارایی"),
		T("Stops Windows putting the wireless adapter to sleep between packets — the cause of ping spikes on laptops. Only exists on PCs with Wi-Fi.", "جلوی خواباندن کارت وایرلس بین پکت‌ها را می‌گیرد — دلیل جهش پینگ روی لپ‌تاپ‌ها. فقط روی سیستم‌های دارای Wi-Fi وجود دارد.")),
		"19cbb8fa-5279-450e-9fac-8a3d5fedd0c1", "12bbebe6-58d6-4636-95bb-3217ef867c1a", 0),
}

type nagleOriginal struct {
	Key  string    `json:"key"`
	Name string    `json:"name"`
	Was  *RegValue `json:"was"`
}

func nagle() *Tweak {
	t := &Tweak{Meta: meta("nagle_off", "network", "safe", true, false,
		T("Disable Nagle's algorithm", "غیرفعال کردن الگوریتم Nagle"),
		T("Small packets (game input, chat) are sent immediately instead of being held to fill a bigger packet. The classic ping tweak for online games.", "پکت‌های کوچک (ورودی بازی، چت) فوراً فرستاده می‌شوند به‌جای صبر برای پر شدن پکت بزرگ‌تر. تغییر کلاسیک پینگ برای بازی آنلاین."))}
	names := []string{"TcpAckFrequency", "TCPNoDelay"}
	t.Check = func(c *Ctx) (bool, error) {
		keys, err := c.Sys.RegSubkeys(ifaces)
		if err != nil || len(keys) == 0 {
			return false, err
		}
		for _, k := range keys {
			for _, n := range names {
				v, _ := c.Sys.RegGet(k, n)
				if v == nil || !Same(v.Value, 1) {
					return false, nil
				}
			}
		}
		return true, nil
	}
	t.Apply = func(c *Ctx) error {
		keys, err := c.Sys.RegSubkeys(ifaces)
		if err != nil {
			return err
		}
		var originals []nagleOriginal
		for _, k := range keys {
			for _, n := range names {
				v, _ := c.Sys.RegGet(k, n)
				originals = append(originals, nagleOriginal{Key: k, Name: n, Was: v})
			}
		}
		if _, err := c.Backup.SaveOnce(c.ID, originals); err != nil {
			return err
		}
		for _, k := range keys {
			for _, n := range names {
				if err := c.Sys.RegSet(k, n, RegValue{Type: "REG_DWORD", Value: uint32(1)}); err != nil {
					return err
				}
			}
		}
		return nil
	}
	t.Revert = func(c *Ctx) error {
		var originals []nagleOriginal
		if c.Backup.Get(c.ID, &originals) {
			for _, o := range originals {
				if o.Was != nil {
					_ = c.Sys.RegSet(o.Key, o.Name, *o.Was)
				} else {
					_ = c.Sys.RegDel(o.Key, o.Name)
				}
			}
		} else {
			keys, _ := c.Sys.RegSubkeys(ifaces)
			for _, k := range keys {
				for _, n := range names {
					_ = c.Sys.RegDel(k, n)
				}
			}
		}
		// new adapters since the backup still carry our values: clean them too
		keys, _ := c.Sys.RegSubkeys(ifaces)
		for _, k := range keys {
			known := false
			for _, o := range originals {
				if o.Key == k {
					known = true
					break
				}
			}
			if !known {
				for _, n := range names {
					_ = c.Sys.RegDel(k, n)
				}
			}
		}
		return c.Backup.Clear(c.ID)
	}
	return t
}

type tcpSettings struct {
	AutoTuningLevelLocal string `json:"AutoTuningLevelLocal"`
	EcnCapability        string `json:"EcnCapability"`
	Timestamps           string `json:"Timestamps"`
}

func tcpTuning() *Tweak {
	t := &Tweak{Meta: meta("tcp_tuning", "network", "safe", true, false,
		T("TCP tuning: autotuning normal, ECN and timestamps off, RSS on", "تنظیم TCP: autotuning نرمال، ECN و timestamps خاموش، RSS روشن"),
		T("The Windows TCP stack settings that give the best throughput and latency on consumer connections. Reverted to your previous values on undo.", "تنظیمات TCP ویندوز که بهترین سرعت و تأخیر را روی اینترنت خانگی می‌دهد. با بازگشت، مقادیر قبلی شما برمی‌گردد."))}
	read := func(c *Ctx) (*tcpSettings, error) {
		var s tcpSettings
		if err := PSJSON(c.Sys, 40*time.Second, "Get-NetTCPSetting -SettingName Internet | Select-Object AutoTuningLevelLocal, EcnCapability, Timestamps | ConvertTo-Json -Compress", &s); err != nil {
			return nil, err
		}
		return &s, nil
	}
	want := tcpSettings{"Normal", "Disabled", "Disabled"}
	eq := func(a, b string) bool { return strings.EqualFold(strings.TrimSpace(a), b) }
	t.Check = func(c *Ctx) (bool, error) {
		s, err := read(c)
		if err != nil {
			return false, err
		}
		return eq(s.AutoTuningLevelLocal, want.AutoTuningLevelLocal) && eq(s.EcnCapability, want.EcnCapability) && eq(s.Timestamps, want.Timestamps), nil
	}
	t.Apply = func(c *Ctx) error {
		if s, err := read(c); err == nil {
			if _, err := c.Backup.SaveOnce(c.ID, s); err != nil {
				return err
			}
		}
		if _, err := PS(c.Sys, 40*time.Second, "Set-NetTCPSetting -SettingName Internet -AutoTuningLevelLocal Normal -EcnCapability Disabled -Timestamps Disabled"); err != nil {
			return err
		}
		c.Sys.Run(20*time.Second, "netsh", "int", "tcp", "set", "global", "rss=enabled")
		return nil
	}
	t.Revert = func(c *Ctx) error {
		var b tcpSettings
		if c.Backup.Get(c.ID, &b) && b.AutoTuningLevelLocal != "" {
			if _, err := PS(c.Sys, 40*time.Second, fmt.Sprintf("Set-NetTCPSetting -SettingName Internet -AutoTuningLevelLocal %s -EcnCapability %s -Timestamps %s", word(b.AutoTuningLevelLocal), word(b.EcnCapability), word(b.Timestamps))); err != nil {
				return err
			}
		}
		return c.Backup.Clear(c.ID)
	}
	return t
}

// word keeps only letters (PowerShell enum names) so a backup can never inject into the command line.
func word(s string) string {
	return strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') {
			return r
		}
		return -1
	}, s)
}

type adapter struct {
	Idx     int    `json:"idx"`
	Alias   string `json:"alias"`
	Static  string `json:"static"`
	Servers any    `json:"servers,omitempty"`
}

const adaptersScript = `Get-NetAdapter -Physical | Where-Object Status -eq 'Up' | ForEach-Object { $g = $_.InterfaceGuid; $ns = (Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters\Interfaces\$g" -Name NameServer -ErrorAction SilentlyContinue).NameServer; [pscustomobject]@{ idx = $_.ifIndex; alias = $_.Name; static = [string]$ns; servers = @((Get-DnsClientServerAddress -InterfaceIndex $_.ifIndex -AddressFamily IPv4).ServerAddresses) } } | ConvertTo-Json -Compress`

func dnsFast() *Tweak {
	m := meta("dns_fast", "network", "safe", true, false,
		T("Fast DNS on every connection", "DNS سریع روی همهٔ اتصال‌ها"),
		T("Sets the resolver on all active adapters. Auto scans every server and picks your ISP's own (Shatel, TCI/Mokhabrat, Pishgaman) when it answers, else the fastest public one. Shecan, Electro, Begzar, 403 for sanctioned sites; Radar for game servers; 50+ public resolvers from the DNS Jumper list. Undo restores what you had.", "DNS را روی همهٔ کارت‌های فعال تنظیم می‌کند. حالت خودکار همهٔ سرورها را اسکن می‌کند و اگر DNS اپراتور خودتان (شاتل، مخابرات، پیشگامان) جواب بدهد همان را، وگرنه سریع‌ترین DNS عمومی را انتخاب می‌کند. شکن، الکترو، بگذر، ۴۰۳ برای سایت‌های تحریمی؛ رادار برای سرورهای بازی؛ بیش از ۵۰ DNS عمومی از لیست DNS Jumper. بازگشت، تنظیم قبلی را برمی‌گرداند."))
	m.Options = dnsOptions()
	m.DefaultOption = dns.Auto
	t := &Tweak{Meta: m}
	// check reads the registry only (fast): every interface that has an address must carry one of our provider lists
	t.Check = func(c *Ctx) (bool, error) {
		keys, err := c.Sys.RegSubkeys(ifaces)
		if err != nil {
			return false, err
		}
		live := 0
		for _, k := range keys {
			if !ifaceLive(c.Sys, k) {
				continue
			}
			live++
			ns, _ := c.Sys.RegGet(k, "NameServer")
			if ns == nil || !isProviderList(fmt.Sprint(ns.Value)) {
				return false, nil
			}
		}
		return live > 0, nil
	}
	t.Apply = func(c *Ctx) error {
		id, err := ResolveDNSOption(c.Sys, c.Option)
		if err != nil {
			return err
		}
		prov := dns.Find(id)
		ads, err := adapters(c.Sys)
		if err != nil {
			return err
		}
		if len(ads) == 0 {
			return fmt.Errorf("no active network adapter")
		}
		bk := make([]adapter, 0, len(ads))
		for _, a := range ads {
			bk = append(bk, adapter{Idx: a.Idx, Alias: a.Alias, Static: a.Static})
		}
		if _, err := c.Backup.SaveOnce(c.ID, bk); err != nil {
			return err
		}
		for _, a := range ads {
			if _, err := PS(c.Sys, 30*time.Second, fmt.Sprintf("Set-DnsClientServerAddress -InterfaceIndex %d -ServerAddresses %s", a.Idx, strings.Join(prov.Servers, ","))); err != nil {
				return err
			}
		}
		c.Sys.Run(10*time.Second, "ipconfig", "/flushdns")
		return nil
	}
	t.Revert = func(c *Ctx) error {
		var bk []adapter
		if !c.Backup.Get(c.ID, &bk) {
			ads, _ := adapters(c.Sys)
			for _, a := range ads {
				bk = append(bk, adapter{Idx: a.Idx})
			}
		}
		for _, a := range bk {
			own := ipList(a.Static)
			var cmd string
			if len(own) > 0 {
				cmd = fmt.Sprintf("Set-DnsClientServerAddress -InterfaceIndex %d -ServerAddresses %s", a.Idx, strings.Join(own, ","))
			} else {
				cmd = fmt.Sprintf("Set-DnsClientServerAddress -InterfaceIndex %d -ResetServerAddresses", a.Idx)
			}
			if _, err := PS(c.Sys, 30*time.Second, cmd); err != nil {
				return err
			}
		}
		c.Sys.Run(10*time.Second, "ipconfig", "/flushdns")
		return c.Backup.Clear(c.ID)
	}
	return t
}

func adapters(s Sys) ([]adapter, error) {
	out, err := PS(s, 60*time.Second, adaptersScript)
	if err != nil {
		return nil, err
	}
	out = strings.TrimSpace(out)
	if out == "" {
		return nil, nil
	}
	var list []adapter
	if strings.HasPrefix(out, "[") {
		err = UnmarshalJSON(out, &list)
	} else {
		var one adapter
		err = UnmarshalJSON(out, &one)
		list = []adapter{one}
	}
	return list, err
}

// ifaceLive: the interface has an IPv4 address (DHCP or static).
func ifaceLive(s Sys, key string) bool {
	if v, _ := s.RegGet(key, "DhcpIPAddress"); v != nil {
		if ip := fmt.Sprint(v.Value); ip != "" && ip != "0.0.0.0" {
			return true
		}
	}
	if v, _ := s.RegGet(key, "IPAddress"); v != nil {
		for _, ip := range ipList(fmt.Sprint(v.Value)) {
			if ip != "0.0.0.0" {
				return true
			}
		}
	}
	return false
}

func isProviderList(ns string) bool {
	got := strings.Join(ipList(ns), ",")
	for _, p := range dns.Providers {
		if got == strings.Join(p.Servers, ",") || got == p.Servers[0] {
			return true
		}
	}
	return false
}

// ipList splits "1.1.1.1,1.0.0.1" / "1.1.1.1 1.0.0.1" / a JSON-ish list and keeps only IPv4-looking words.
func ipList(s string) []string {
	var out []string
	for _, w := range strings.FieldsFunc(s, func(r rune) bool {
		return r == ',' || r == ' ' || r == '[' || r == ']' || r == '"' || r == '\n' || r == '\r'
	}) {
		if strings.Count(w, ".") == 3 {
			out = append(out, w)
		}
	}
	return out
}

// All = every tweak in display order.
var All = append(append([]*Tweak{}, FPS...), Network...)

// ByID finds a tweak.
func ByID(id string) *Tweak {
	for _, t := range All {
		if t.ID == id {
			return t
		}
	}
	return nil
}
