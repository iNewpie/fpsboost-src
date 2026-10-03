package tweaks

// Stage: tweaks adapted from Deskew's "Ultimate Guide to Optimize your Windows PC for the Stage" (gigperformer.com) —
// the things a real-time audio PC and a gaming PC want alike: no power saving on USB / PCIe / CPU / disks, no update or
// telemetry jobs waking up mid-session, fewer idle services, no Windows sounds. Everything here is undone from
// backup.json. The guide's one-way steps are deliberately NOT here: uninstalling Store apps, disabling hardware in
// Device Manager, BIOS settings, turning the antivirus / SmartScreen off, and the Xbox services (games need them).

import (
	"fmt"
	"strings"

	. "fpsboost.ir/app/internal/engine"
)

// powercfg sub group / setting GUIDs (fixed across Windows versions and languages)
const (
	subUSB     = "2a737441-1930-4402-8d77-b2bebba308a3" // USB settings
	subPCIe    = "501a4d13-42af-4429-9fd1-a8218c268e20" // PCI Express
	subCPU     = "54533251-82be-4824-96c1-47b60b740d00" // Processor power management
	subDisk    = "0012ee47-9041-4b5d-9b77-535fba8b1442" // Hard disk
	subSleep   = "238c9fa8-0aad-41ed-83f4-97be242c8f20" // Sleep
	subDesktop = "0d7dbae2-4294-402a-ba8e-26777e8488cd" // Desktop background settings

	setUSBSuspend  = "48e6b7a6-50f5-4782-a5d4-53bb50f7e73c" // USB selective suspend (0 disabled)
	setPCIeASPM    = "ee12f906-d277-404b-b6da-e5fa1a576df5" // Link State Power Management (0 off)
	setCPUMin      = "893dee8e-2bef-41e0-89c6-b55d0929964c" // Minimum processor state (%)
	setCPUMax      = "bc5038f7-23e0-4960-96da-33abaf5935ec" // Maximum processor state (%)
	setCooling     = "94d3a615-a899-4ac5-ae2b-e4d8f634367f" // System cooling policy (1 active)
	setDiskOff     = "6738e2c4-e8a5-4a42-b16a-e040e769756e" // Turn off hard disk after (s, 0 never)
	setSleepAfter  = "29f6c1db-86da-48c5-9fdb-f2b67b1f44da" // Sleep after (s, 0 never)
	setHibernate   = "9d7815a6-7ee4-497e-8888-515a05f02364" // Hibernate after (s, 0 never)
	setHybridSleep = "94ac6d29-73ce-41a6-809f-6363ba21b47e" // Allow hybrid sleep (0 off)
	setSlideshow   = "309dce9b-bef4-4119-9921-a851fb12f0f4" // Desktop slide show (1 paused)
)

func ps(sub, setting string, want uint64) PowerSetting {
	return PowerSetting{Sub: sub, Setting: setting, Want: want}
}

const (
	wuAU   = HKLM + `\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU`
	priv   = HKCU + `\Software\Microsoft\Windows\CurrentVersion\Privacy`
	inputP = HKCU + `\Software\Microsoft\InputPersonalization`
	sysPol = HKLM + `\SOFTWARE\Policies\Microsoft\Windows\System`
)

// Stage tweaks (category fps unless they are about the network adapter).
var Stage = []*Tweak{
	/* ---- power plan details (chapter 4.1) ---- */
	PowerSettingsTweak(meta("usb_suspend_off", "fps", "safe", true, false,
		T("Never suspend USB devices (mouse, keyboard, headset)", "هیچ‌وقت دستگاه‌های USB به حالت تعلیق نروند (ماوس، کیبورد، هدست)"),
		T("USB selective suspend lets Windows power down idle USB ports. Off = no first-click delay, no headset drop-outs, no controller that 'wakes up' late. Set for both plugged in and on battery.", "USB selective suspend به ویندوز اجازه می‌دهد پورت‌های بیکار را خاموش کند. خاموش = بدون تأخیر کلیک اول، بدون قطع صدای هدست، بدون دستهٔ بازی که دیر بیدار می‌شود. برای شارژر و باتری هر دو.")),
		false, ps(subUSB, setUSBSuspend, 0)),
	PowerSettingsTweak(meta("pcie_aspm_off", "fps", "safe", false, false,
		T("PCI Express link power management: off", "مدیریت مصرف لینک PCI Express: خاموش"),
		T("Stops the PCIe link to the graphics card, NVMe drive and network card dropping to a low-power state between bursts. Removes the tiny wake-up stalls that show as frame-time spikes. Laptops lose a little battery life.", "جلوی افتادن لینک PCIe کارت گرافیک، درایو NVMe و کارت شبکه به حالت کم‌مصرف بین بارها را می‌گیرد. مکث‌های ریز بیدار شدن که به‌شکل جهش فریم‌تایم دیده می‌شوند حذف می‌شوند. لپ‌تاپ کمی باتری بیشتر مصرف می‌کند.")),
		false, ps(subPCIe, setPCIeASPM, 0)),
	PowerSettingsTweak(meta("disk_sleep_off", "fps", "safe", false, false,
		T("Never turn off hard disks", "هارد دیسک هیچ‌وقت خاموش نشود"),
		T("Windows spins down idle hard drives after 20 minutes; the next texture load from that drive then waits several seconds for the disk to spin up. Never = no mid-game stall. SSDs are unaffected either way.", "ویندوز هارد بیکار را بعد از ۲۰ دقیقه می‌خواباند؛ بارگذاری بعدی تکسچر از آن درایو چند ثانیه منتظر راه افتادن دیسک می‌ماند. هیچ‌وقت = بدون مکث وسط بازی. SSD در هر دو حالت فرقی نمی‌کند.")),
		false, ps(subDisk, setDiskOff, 0)),
	PowerSettingsTweak(meta("cpu_min_100", "fps", "advanced", false, false,
		T("CPU never downclocks (minimum processor state 100%)", "CPU هیچ‌وقت کلاک پایین نیاورد (حداقل وضعیت پردازنده ۱۰۰٪)"),
		T("The CPU stays at full clock instead of ramping down between frames and back up when the game needs it — the classic cause of stutter on quiet scenes. More heat and fan noise; laptops: plugged in only. Also sets maximum state to 100%.", "CPU همیشه روی کلاک کامل می‌ماند به‌جای پایین آمدن بین فریم‌ها و بالا رفتن وقتی بازی لازم دارد — دلیل کلاسیک لگ در صحنه‌های آرام. گرما و صدای فن بیشتر؛ لپ‌تاپ: فقط روی شارژر. حداکثر وضعیت را هم روی ۱۰۰٪ می‌گذارد.")),
		true, ps(subCPU, setCPUMin, 100), ps(subCPU, setCPUMax, 100)),
	PowerSettingsTweak(meta("cooling_active", "fps", "advanced", false, false,
		T("System cooling policy: active (fans before throttling)", "سیاست خنک‌کاری: فعال (فن قبل از کاهش سرعت)"),
		T("When the CPU gets hot, Windows can either speed up the fans (active) or slow the CPU down (passive). Active keeps your clocks and makes the fans louder — pick this on a desktop or a gaming laptop with good cooling.", "وقتی CPU داغ می‌شود ویندوز یا فن‌ها را سریع‌تر می‌کند (فعال) یا CPU را کند می‌کند (غیرفعال). فعال کلاک را نگه می‌دارد و فن‌ها بلندتر می‌شوند — روی دسکتاپ یا لپ‌تاپ گیمینگ با خنک‌کاری خوب انتخاب کنید.")),
		false, ps(subCPU, setCooling, 1)),
	PowerSettingsTweak(meta("sleep_never_ac", "fps", "advanced", false, false,
		T("Never sleep or hibernate while plugged in", "روی شارژر هیچ‌وقت Sleep یا Hibernate نشود"),
		T("A download, a long match-making queue or a stream must not end in the PC going to sleep. Sleep, hibernate and hybrid sleep timers are set to never — only for the plugged-in profile; battery settings stay as they are.", "یک دانلود، صف طولانی مچ‌میکینگ یا استریم نباید با خوابیدن سیستم تمام شود. تایمرهای Sleep، Hibernate و Hybrid sleep روی هیچ‌وقت — فقط برای پروفایل شارژر؛ تنظیمات باتری همان می‌ماند.")),
		true, ps(subSleep, setSleepAfter, 0), ps(subSleep, setHibernate, 0), ps(subSleep, setHybridSleep, 0)),
	PowerSettingsTweak(meta("slideshow_paused", "fps", "safe", false, false,
		T("Pause the desktop background slideshow", "توقف اسلایدشو پس‌زمینهٔ دسکتاپ"),
		T("A rotating wallpaper decodes a new image every few minutes — a small but pointless CPU and disk hit behind your game. Paused in this power plan; your wallpaper stays.", "والپیپر چرخشی هر چند دقیقه یک تصویر جدید دیکد می‌کند — ضربهٔ کوچک ولی بی‌دلیل به CPU و دیسک پشت بازی. در این پاور پلن متوقف می‌شود؛ والپیپر شما می‌ماند.")),
		false, ps(subDesktop, setSlideshow, 1)),

	/* ---- device power management (4.2) ---- */
	nicPowerManagement(),

	/* ---- Fast Startup (4.3) ---- */
	RegTweak(meta("fast_startup_off", "fps", "safe", false, false,
		T("Turn off Fast Startup (real shutdowns)", "خاموش کردن Fast Startup (خاموش شدن واقعی)"),
		T("With Fast Startup a 'shutdown' is a hibernation of the kernel: drivers (audio, anti-cheat, GPU) carry their state over for weeks, which is where odd stutter, no-sound and 'restart fixed it' problems come from. Off = every boot is clean; booting takes a few seconds longer on hard disks.", "با Fast Startup «خاموش کردن» در واقع هایبرنیت هسته است: درایورها (صدا، آنتی‌چیت، GPU) وضعیتشان را هفته‌ها نگه می‌دارند و همین منبع لگ عجیب، بی‌صدایی و «ریستارت درستش کرد» است. خاموش = هر بوت تمیز است؛ روی هارد چند ثانیه بوت طولانی‌تر.")),
		DW(HKLM+`\SYSTEM\CurrentControlSet\Control\Session Manager\Power`, "HiberbootEnabled", 0)),

	/* ---- background services (5.4) ---- */
	ServicesTweak(meta("diagtrack_off", "fps", "safe", true, false,
		T("Stop the telemetry service (Connected User Experiences)", "توقف سرویس تله‌متری (Connected User Experiences)"),
		T("DiagTrack is the process that gathers diagnostics and uploads them. Disabled = it never runs; pairs with the telemetry policy tweak above. Nothing you use depends on it.", "DiagTrack پروسه‌ای است که دیاگنوستیک جمع و آپلود می‌کند. غیرفعال = هیچ‌وقت اجرا نمی‌شود؛ مکمل تنظیم سیاست تله‌متری بالا. هیچ چیزی که استفاده می‌کنید به آن وابسته نیست.")),
		"DiagTrack"),
	ServicesTweak(meta("svc_unused_off", "fps", "safe", false, false,
		T("Disable unused services: AllJoyn, Fax, Maps, Retail Demo, Remote Registry, Insider, Phone", "غیرفعال کردن سرویس‌های بی‌استفاده: AllJoyn، Fax، Maps، Retail Demo، Remote Registry، Insider، Phone"),
		T("Seven services almost nobody uses on a gaming PC: smart-home routing, faxing, offline Bing maps, the shop-floor demo mode, remote registry access, Insider builds and the phone-link telephony state. Each one is skipped if it is not installed.", "هفت سرویسی که تقریباً هیچ‌کس روی سیستم گیمینگ استفاده نمی‌کند: روتینگ خانهٔ هوشمند، فکس، نقشهٔ آفلاین Bing، حالت دمو فروشگاه، دسترسی ریموت به رجیستری، بیلدهای Insider و وضعیت تلفن Phone Link. هر کدام نصب نباشد رد می‌شود.")),
		"AJRouter", "Fax", "MapsBroker", "RetailDemo", "RemoteRegistry", "wisvc", "PhoneSvc"),
	ServicesTweak(meta("wer_off", "fps", "safe", false, false,
		T("Turn off Windows Error Reporting", "خاموش کردن Windows Error Reporting"),
		T("When something crashes, WER collects a dump and uploads it to Microsoft — exactly the moment your disk and connection are busiest. Off = crashes just close. Your own crash logs (game, Event Viewer) are not affected.", "وقتی چیزی کرش می‌کند WER یک dump جمع و برای مایکروسافت آپلود می‌کند — دقیقاً وقتی دیسک و اینترنت پرمشغله‌اند. خاموش = کرش فقط بسته می‌شود. لاگ کرش خودتان (بازی، Event Viewer) تغییری نمی‌کند.")),
		"WerSvc"),
	ServicesTweak(meta("geolocation_off", "fps", "safe", false, false,
		T("Disable the Geolocation service", "غیرفعال کردن سرویس Geolocation"),
		T("Shares your location with apps and the weather tile. Off = one less background service and one less thing phoning home. Maps and 'Find my device' stop knowing where you are.", "موقعیت شما را با برنامه‌ها و کاشی هواشناسی به اشتراک می‌گذارد. خاموش = یک سرویس پس‌زمینهٔ کمتر و یک چیز کمتر که خانه زنگ بزند. Maps و Find my device دیگر جای شما را نمی‌دانند.")),
		"lfsvc"),
	ServicesTweak(meta("hyperv_guest_off", "fps", "safe", false, false,
		T("Disable Hyper-V guest services", "غیرفعال کردن سرویس‌های مهمان Hyper-V"),
		T("Eight services that only do something when Windows itself runs inside a Hyper-V virtual machine (heartbeat, time sync, shutdown, data exchange…). On a real PC they just sit there. Hyper-V, WSL 2 and Windows Sandbox keep working — this is not the hypervisor.", "هشت سرویس که فقط وقتی خود ویندوز داخل ماشین مجازی Hyper-V اجرا شود کاری می‌کنند (heartbeat، همگام‌سازی زمان، خاموش کردن، تبادل داده…). روی PC واقعی فقط نشسته‌اند. Hyper-V، WSL 2 و Windows Sandbox کار می‌کنند — این هایپروایزر نیست.")),
		"vmicguestinterface", "vmicheartbeat", "vmickvpexchange", "vmicrdv", "vmicshutdown", "vmictimesync", "vmicvmsession", "vmicvss"),
	ServicesTweak(meta("bluetooth_off", "fps", "advanced", false, false,
		T("Disable Bluetooth services (no Bluetooth devices)", "غیرفعال کردن سرویس‌های بلوتوث (بدون دستگاه بلوتوثی)"),
		T("Only if you use NO Bluetooth headset, controller, mouse or keyboard. Bluetooth radio drivers are a known source of DPC latency (micro-stutter); with the services off the radio stays idle. Turn back on before pairing anything.", "فقط اگر هیچ هدست، دسته، ماوس یا کیبورد بلوتوثی ندارید. درایور رادیوی بلوتوث منبع شناخته‌شدهٔ تأخیر DPC (میکرولگ) است؛ با سرویس‌ها خاموش رادیو بیکار می‌ماند. قبل از جفت کردن هر چیزی دوباره روشن کنید.")),
		"bthserv", "BTAGService", "BthAvctpSvc"),
	ServicesTweak(meta("print_off", "fps", "advanced", false, false,
		T("Disable printing (Print Spooler)", "غیرفعال کردن چاپ (Print Spooler)"),
		T("Only if this PC never prints. The spooler polls printers and has been the entry point of several Windows security holes. Off = no printing, no 'Print to PDF', no new printers until you turn it back on.", "فقط اگر این سیستم هیچ‌وقت چاپ نمی‌کند. اسپولر پرینترها را پول می‌کند و ورودی چند حفرهٔ امنیتی ویندوز بوده. خاموش = بدون چاپ، بدون Print to PDF، بدون پرینتر جدید تا دوباره روشنش کنید.")),
		"Spooler", "PrintNotify"),
	ServicesTweak(meta("imaging_off", "fps", "advanced", false, false,
		T("Disable webcam & scanner services (no camera use)", "غیرفعال کردن سرویس‌های وب‌کم و اسکنر (بدون استفاده از کمرا)"),
		T("Windows Camera Frame Server and Windows Image Acquisition. Only if you never use a webcam in Discord, OBS or video calls on this PC — with the frame server off, cameras show black. Scanners stop working too.", "Windows Camera Frame Server و Windows Image Acquisition. فقط اگر هیچ‌وقت در دیسکورد، OBS یا تماس تصویری روی این سیستم از وب‌کم استفاده نمی‌کنید — با فریم‌سرور خاموش، کمرا سیاه نشان می‌دهد. اسکنر هم کار نمی‌کند.")),
		"FrameServer", "FrameServerMonitor", "stisvc"),
	ServicesTweak(meta("mixed_reality_off", "fps", "advanced", false, false,
		T("Disable the Windows Mixed Reality OpenXR service", "غیرفعال کردن سرویس Windows Mixed Reality OpenXR"),
		T("Only for Windows Mixed Reality headsets (HP Reverb, Samsung Odyssey, HoloLens). No WMR headset = safe to disable. Meta Quest / SteamVR do not use it.", "فقط برای هدست‌های Windows Mixed Reality (HP Reverb، Samsung Odyssey، HoloLens). هدست WMR ندارید = غیرفعال کردنش بی‌خطر است. Meta Quest و SteamVR از آن استفاده نمی‌کنند.")),
		"MixedRealityOpenXRSvc"),
	ServicesTweak(meta("netbios_helper_off", "network", "advanced", false, false,
		T("Disable the TCP/IP NetBIOS Helper", "غیرفعال کردن TCP/IP NetBIOS Helper"),
		T("Legacy name resolution for Windows file and printer sharing over NetBIOS. Off = less broadcast chatter on the LAN. Keep it on if you reach other PCs on your network by name (\\\\PC-NAME) or use LAN game browsers.", "نام‌یابی قدیمی برای اشتراک فایل و پرینتر ویندوز روی NetBIOS. خاموش = ترافیک broadcast کمتر در شبکهٔ محلی. اگر به کامپیوترهای دیگر شبکه با نام (\\\\PC-NAME) وصل می‌شوید یا از LAN browser بازی‌ها استفاده می‌کنید روشن بگذارید.")),
		"lmhosts"),
	ServicesTweak(meta("iphelper_off", "network", "advanced", false, false,
		T("Disable IP Helper (IPv6 tunnels)", "غیرفعال کردن IP Helper (تونل‌های IPv6)"),
		T("Runs the 6to4, ISATAP and Teredo tunnels that carry IPv6 over an IPv4 connection — pointless on IPv4-only ISPs and a steady background CPU user on some PCs. Keep it on if your ISP gives you IPv6 or for Xbox app party chat.", "تونل‌های 6to4، ISATAP و Teredo را اجرا می‌کند که IPv6 را روی اتصال IPv4 حمل می‌کنند — روی اینترنت فقط-IPv4 بی‌فایده و روی بعضی سیستم‌ها مصرف‌کنندهٔ دائم CPU در پس‌زمینه. اگر اپراتورتان IPv6 می‌دهد یا از party chat برنامهٔ Xbox استفاده می‌کنید روشن بگذارید.")),
		"iphlpsvc"),

	/* ---- Task Scheduler (5.5, 7.6) ---- */
	TasksTweak(meta("telemetry_tasks_off", "fps", "safe", false, false,
		T("Disable telemetry & compatibility scheduled tasks", "غیرفعال کردن تسک‌های زمان‌بندی‌شدهٔ تله‌متری و سازگاری"),
		T("The Customer Experience Improvement Program, Compatibility Appraiser, disk diagnostics, feedback and error-report uploads, Bing Maps updates — all scheduled to run 'when idle', which Windows decides is the moment you alt-tab out of a match. Disabled; tasks that do not exist on your Windows are skipped. Undo re-enables exactly the ones that were on.", "Customer Experience Improvement Program، Compatibility Appraiser، دیاگنوستیک دیسک، آپلود بازخورد و گزارش خطا، آپدیت Bing Maps — همه زمان‌بندی شده‌اند که «در زمان بیکاری» اجرا شوند، که ویندوز تصمیم می‌گیرد همان لحظه‌ای است که شما Alt+Tab می‌زنید. غیرفعال؛ تسک‌هایی که روی ویندوز شما نیست رد می‌شوند. بازگشت دقیقاً همان‌هایی را که روشن بودند روشن می‌کند.")),
		`\Microsoft\Windows\Customer Experience Improvement Program\Consolidator`,
		`\Microsoft\Windows\Customer Experience Improvement Program\UsbCeip`,
		`\Microsoft\Windows\Customer Experience Improvement Program\KernelCeipTask`,
		`\Microsoft\Windows\Application Experience\Microsoft Compatibility Appraiser`,
		`\Microsoft\Windows\Application Experience\ProgramDataUpdater`,
		`\Microsoft\Windows\Autochk\Proxy`,
		`\Microsoft\Windows\DiskDiagnostic\Microsoft-Windows-DiskDiagnosticDataCollector`,
		`\Microsoft\Windows\Feedback\Siuf\DmClient`,
		`\Microsoft\Windows\Feedback\Siuf\DmClientOnScenarioDownload`,
		`\Microsoft\Windows\Windows Error Reporting\QueueReporting`,
		`\Microsoft\Windows\Maps\MapsUpdateTask`,
		`\Microsoft\Windows\Maps\MapsToastTask`,
		`\Microsoft\Windows\Power Efficiency Diagnostics\AnalyzeSystem`),
	TasksTweak(meta("defrag_schedule_off", "fps", "advanced", false, false,
		T("Turn off scheduled drive optimization (defrag / TRIM)", "خاموش کردن بهینه‌سازی زمان‌بندی‌شدهٔ درایو (defrag / TRIM)"),
		T("Windows defragments hard disks and TRIMs SSDs weekly 'when idle' — on a hard disk that is minutes of 100% disk activity, sometimes while you play. Off = you run Optimize Drives by hand when it suits you. Do not forget it for months on an HDD.", "ویندوز هر هفته «در زمان بیکاری» هارد را defrag و SSD را TRIM می‌کند — روی هارد یعنی چند دقیقه دیسک ۱۰۰٪، بعضی وقت‌ها وسط بازی. خاموش = Optimize Drives را وقتی خودتان بخواهید دستی اجرا می‌کنید. روی HDD ماه‌ها فراموشش نکنید.")),
		`\Microsoft\Windows\Defrag\ScheduledDefrag`),

	/* ---- update mechanisms (6.1, 6.2) ---- */
	RegTweak(meta("wu_notify_only", "fps", "safe", false, false,
		T("Windows Update: notify, never auto-download", "آپدیت ویندوز: فقط اطلاع بده، هیچ‌وقت خودکار دانلود نکن"),
		T("The Group Policy setting 'Notify for download and auto install': Windows still finds updates and tells you, but downloads and installs only when you click. No surprise multi-gigabyte download or 'restart pending' mid-game. Updates are not disabled — you choose when.", "تنظیم Group Policy «Notify for download and auto install»: ویندوز همچنان آپدیت را پیدا می‌کند و به شما می‌گوید، ولی فقط وقتی کلیک کنید دانلود و نصب می‌کند. بدون دانلود چند گیگ ناگهانی یا «در انتظار ریستارت» وسط بازی. آپدیت غیرفعال نمی‌شود — شما زمانش را انتخاب می‌کنید.")),
		DW(wuAU, "NoAutoUpdate", 0), DW(wuAU, "AUOptions", 2)),
	RegTweak(meta("store_autoupdate_off", "fps", "safe", false, false,
		T("Microsoft Store: no automatic app updates", "مایکروسافت استور: بدون آپدیت خودکار برنامه‌ها"),
		T("Store apps (and game launchers installed from it) update themselves in the background, often right after sign-in. Off = you update from the Store's Library page when you want. Game Pass games still update when you launch them.", "برنامه‌های استور (و لانچرهای نصب‌شده از آن) در پس‌زمینه خودشان را آپدیت می‌کنند، اغلب درست بعد از ورود. خاموش = از صفحهٔ Library استور وقتی بخواهید آپدیت می‌کنید. بازی‌های Game Pass هنگام اجرا همچنان آپدیت می‌شوند.")),
		DW(HKLM+`\SOFTWARE\Policies\Microsoft\WindowsStore`, "AutoDownload", 2)),

	/* ---- Cortana and privacy (5.7, 5.8) ---- */
	RegTweak(meta("cortana_off", "fps", "safe", false, false,
		T("Disable Cortana", "غیرفعال کردن Cortana"),
		T("The policy switch that stops the Cortana app from running and listening in the background on Windows 10. Start-menu search keeps working. Windows 11 has already retired Cortana — harmless there.", "سوییچ سیاستی که جلوی اجرا و گوش دادن Cortana در پس‌زمینهٔ ویندوز ۱۰ را می‌گیرد. جستجوی Start کار می‌کند. ویندوز ۱۱ خودش Cortana را بازنشسته کرده — آنجا بی‌اثر و بی‌خطر.")),
		DW(HKLM+`\SOFTWARE\Policies\Microsoft\Windows\Windows Search`, "AllowCortana", 0)),
	RegTweak(meta("privacy_off", "fps", "safe", true, false,
		T("Privacy: no advertising ID, activity history, typing data, tailored tips", "حریم خصوصی: بدون شناسهٔ تبلیغاتی، تاریخچهٔ فعالیت، دادهٔ تایپ، نکته‌های شخصی‌سازی‌شده"),
		T("Turns off the background collectors in Settings → Privacy: the advertising ID, activity history upload (Timeline), inking & typing personalisation, online speech recognition, tailored experiences and feedback prompts. Less data leaving the PC while you play; nothing you can see changes.", "جمع‌کننده‌های پس‌زمینهٔ Settings → Privacy را خاموش می‌کند: شناسهٔ تبلیغاتی، آپلود تاریخچهٔ فعالیت (Timeline)، شخصی‌سازی دست‌خط و تایپ، تشخیص گفتار آنلاین، تجربه‌های شخصی‌سازی‌شده و درخواست بازخورد. دادهٔ کمتری هنگام بازی از سیستم بیرون می‌رود؛ چیزی که ببینید تغییر نمی‌کند.")),
		DW(HKCU+`\Software\Microsoft\Windows\CurrentVersion\AdvertisingInfo`, "Enabled", 0),
		DW(priv, "TailoredExperiencesWithDiagnosticDataEnabled", 0),
		DW(sysPol, "EnableActivityFeed", 0), DW(sysPol, "PublishUserActivities", 0), DW(sysPol, "UploadUserActivities", 0),
		DW(inputP, "RestrictImplicitInkCollection", 1), DW(inputP, "RestrictImplicitTextCollection", 1),
		DW(HKCU+`\Software\Microsoft\Personalization\Settings`, "AcceptedPrivacyPolicy", 0),
		DW(HKCU+`\Software\Microsoft\Speech_OneCore\Settings\OnlineSpeechPrivacy`, "HasAccepted", 0),
		DW(HKCU+`\Software\Microsoft\Siuf\Rules`, "NumberOfSIUFInPeriod", 0)),

	/* ---- Windows sounds (7.1) ---- */
	windowsSounds(),
}

/* ---- network adapters: "Allow the computer to turn off this device to save power" unticked ---- */

const netClass = HKLM + `\SYSTEM\CurrentControlSet\Control\Class\{4d36e972-e325-11ce-bfc1-08002be10318}`

// pnpNoPowerOff is the PnPCapabilities value Microsoft documents for unticking the two Power Management boxes of a
// network adapter (0x10 = the computer may not turn the device off, 0x8 = the device may not wake the computer).
const pnpNoPowerOff = 24

// nicKeys lists the class keys of real (PCI / USB) network adapters; virtual ones (VPN, Hyper-V, loopback) have no
// power management and are left alone.
func nicKeys(s Sys) []string {
	keys, _ := s.RegSubkeys(netClass)
	var out []string
	for _, k := range keys {
		if v, _ := s.RegGet(k, "NetCfgInstanceId"); v == nil {
			continue
		}
		v, _ := s.RegGet(k, "DeviceInstanceID")
		if v == nil {
			continue
		}
		id := strings.ToUpper(fmt.Sprint(v.Value))
		if strings.HasPrefix(id, `PCI\`) || strings.HasPrefix(id, `USB\`) {
			out = append(out, k)
		}
	}
	return out
}

func nicPowerManagement() *Tweak {
	t := &Tweak{Meta: meta("nic_power_mgmt_off", "network", "safe", false, true,
		T("Network adapter: never powered down to save energy", "کارت شبکه: هیچ‌وقت برای صرفه‌جویی خاموش نشود"),
		T("Unticks 'Allow the computer to turn off this device to save power' on every Ethernet and Wi-Fi adapter (Device Manager → Power Management). The adapter no longer naps between packets — the fix for a connection that drops or lags after a few idle minutes. Needs a restart to take effect.", "گزینهٔ «Allow the computer to turn off this device to save power» را روی همهٔ کارت‌های Ethernet و Wi-Fi برمی‌دارد (Device Manager → Power Management). کارت دیگر بین پکت‌ها چرت نمی‌زند — درمان اتصالی که بعد از چند دقیقه بیکاری قطع یا لگ می‌کند. برای اثر، ریستارت لازم است."))}
	t.Check = func(c *Ctx) (bool, error) {
		keys := nicKeys(c.Sys)
		if len(keys) == 0 {
			return false, nil
		}
		for _, k := range keys {
			v, ok := RegUint(c.Sys, k, "PnPCapabilities")
			if !ok || v&0x10 == 0 {
				return false, nil
			}
		}
		return true, nil
	}
	t.Apply = func(c *Ctx) error {
		keys := nicKeys(c.Sys)
		if len(keys) == 0 {
			return fmt.Errorf("no physical network adapter found")
		}
		var originals []nagleOriginal
		for _, k := range keys {
			v, _ := c.Sys.RegGet(k, "PnPCapabilities")
			originals = append(originals, nagleOriginal{Key: k, Name: "PnPCapabilities", Was: v})
		}
		if _, err := c.Backup.SaveOnce(c.ID, originals); err != nil {
			return err
		}
		for _, k := range keys {
			if err := c.Sys.RegSet(k, "PnPCapabilities", RegValue{Type: "REG_DWORD", Value: uint32(pnpNoPowerOff)}); err != nil {
				return err
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
			for _, k := range nicKeys(c.Sys) { // no backup: the value is absent by default (power management allowed)
				_ = c.Sys.RegDel(k, "PnPCapabilities")
			}
		}
		return c.Backup.Clear(c.ID)
	}
	return t
}

/* ---- Windows sounds: the "No Sounds" scheme ---- */

const (
	schemesKey = HKCU + `\AppEvents\Schemes`
	appsKey    = schemesKey + `\Apps`
)

type soundBackup struct {
	Scheme *RegValue       `json:"scheme"` // the scheme name before (default value of ...\Schemes)
	Events []nagleOriginal `json:"events"` // every Apps\<app>\<event>\.Current default value before
}

// soundEventKeys lists HKCU\AppEvents\Schemes\Apps\<app>\<event>\.Current for every event that has one.
func soundEventKeys(s Sys) []string {
	var out []string
	apps, _ := s.RegSubkeys(appsKey)
	for _, app := range apps {
		events, _ := s.RegSubkeys(app)
		for _, ev := range events {
			subs, _ := s.RegSubkeys(ev)
			for _, sub := range subs {
				if strings.EqualFold(sub[strings.LastIndex(sub, `\`)+1:], ".Current") {
					out = append(out, sub)
				}
			}
		}
	}
	return out
}

func windowsSounds() *Tweak {
	t := &Tweak{Meta: meta("win_sounds_off", "fps", "safe", false, false,
		T("Windows sounds: 'No Sounds' scheme", "صداهای ویندوز: طرح No Sounds"),
		T("No more ding, USB plug chime or notification sound through your headset in the middle of a round — the same as choosing the 'No Sounds' scheme in Control Panel → Sound. Game, Discord and media audio are untouched. Undo restores the exact sound set you had.", "دیگر دینگ، صدای وصل شدن USB یا نوتیفیکیشن وسط راند توی هدست نمی‌آید — همان انتخاب طرح No Sounds در Control Panel → Sound. صدای بازی، دیسکورد و رسانه دست نمی‌خورد. بازگشت دقیقاً مجموعهٔ صداهای قبلی شما را برمی‌گرداند."))}
	t.Check = func(c *Ctx) (bool, error) {
		v, err := c.Sys.RegGet(schemesKey, "")
		if err != nil || v == nil {
			return false, err
		}
		return strings.EqualFold(strings.TrimSpace(fmt.Sprint(v.Value)), ".None"), nil
	}
	t.Apply = func(c *Ctx) error {
		keys := soundEventKeys(c.Sys)
		if len(keys) == 0 {
			return fmt.Errorf("no sound events found for this user")
		}
		scheme, _ := c.Sys.RegGet(schemesKey, "")
		b := soundBackup{Scheme: scheme}
		for _, k := range keys {
			v, _ := c.Sys.RegGet(k, "")
			b.Events = append(b.Events, nagleOriginal{Key: k, Name: "", Was: v})
		}
		if _, err := c.Backup.SaveOnce(c.ID, b); err != nil {
			return err
		}
		for _, k := range keys {
			if err := c.Sys.RegSet(k, "", RegValue{Type: "REG_SZ", Value: ""}); err != nil {
				return err
			}
		}
		return c.Sys.RegSet(schemesKey, "", RegValue{Type: "REG_SZ", Value: ".None"})
	}
	t.Revert = func(c *Ctx) error {
		var b soundBackup
		if c.Backup.Get(c.ID, &b) && len(b.Events) > 0 {
			for _, o := range b.Events {
				if o.Was != nil {
					_ = c.Sys.RegSet(o.Key, "", *o.Was)
				} else {
					_ = c.Sys.RegDel(o.Key, "")
				}
			}
			if b.Scheme != nil {
				_ = c.Sys.RegSet(schemesKey, "", *b.Scheme)
			} else {
				_ = c.Sys.RegSet(schemesKey, "", RegValue{Type: "REG_SZ", Value: ".Default"})
			}
		} else { // no backup: copy every event's Windows default sound back into .Current
			for _, k := range soundEventKeys(c.Sys) {
				def, _ := c.Sys.RegGet(k[:len(k)-len(".Current")]+".Default", "")
				if def != nil {
					_ = c.Sys.RegSet(k, "", *def)
				}
			}
			_ = c.Sys.RegSet(schemesKey, "", RegValue{Type: "REG_SZ", Value: ".Default"})
		}
		return c.Backup.Clear(c.ID)
	}
	return t
}
