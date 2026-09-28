// Every tweak the app offers. category: 'fps' | 'network'. level: 'safe' (recommended set) | 'advanced'.
// reboot: true when Windows needs a restart for it to take effect. Titles/descriptions in both languages.
// Registry tweaks are declarative (regTweak); the rest implement check/apply/revert by hand.
const { regTweak } = require('../src/engine');

const HKCU = 'HKCU', HKLM = 'HKLM';
const DW = 'REG_DWORD', SZ = 'REG_SZ';
const v = (key, name, value, type = DW) => ({ key, name, type, value });

const MM = `${HKLM}\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile`;
const GAMES = `${MM}\\Tasks\\Games`;
const GCS = `${HKCU}\\System\\GameConfigStore`;

const FPS = [
  regTweak({
    id: 'game_dvr_off', category: 'fps', level: 'safe', recommended: true,
    title: { en: 'Turn off Game DVR / background recording', fa: 'خاموش کردن Game DVR و ضبط پس‌زمینه' },
    desc: { en: 'Windows records gameplay in the background for the Xbox Game Bar. Off = no hidden encoder eating FPS.', fa: 'ویندوز در پس‌زمینه برای Xbox Game Bar گیم‌پلی ضبط می‌کند. خاموش = هیچ انکودر پنهانی FPS نمی‌خورد.' },
    values: [v(GCS, 'GameDVR_Enabled', 0), v(`${HKCU}\\Software\\Microsoft\\Windows\\CurrentVersion\\GameDVR`, 'AppCaptureEnabled', 0), v(`${HKLM}\\SOFTWARE\\Policies\\Microsoft\\Windows\\GameDVR`, 'AllowGameDVR', 0)],
  }),
  regTweak({
    id: 'game_mode_on', category: 'fps', level: 'safe', recommended: true,
    title: { en: 'Enable Game Mode', fa: 'فعال کردن Game Mode' },
    desc: { en: 'Windows gives the game priority over background tasks and Windows Update while playing.', fa: 'ویندوز هنگام بازی، بازی را بر کارهای پس‌زمینه و آپدیت ویندوز مقدم می‌کند.' },
    values: [v(`${HKCU}\\Software\\Microsoft\\GameBar`, 'AutoGameModeEnabled', 1), v(`${HKCU}\\Software\\Microsoft\\GameBar`, 'AllowAutoGameMode', 1)],
  }),
  regTweak({
    id: 'fse_off', category: 'fps', level: 'safe', recommended: true,
    title: { en: 'Disable fullscreen optimizations', fa: 'غیرفعال کردن Fullscreen Optimizations' },
    desc: { en: 'Games get true exclusive fullscreen instead of the borderless compositor path — lower input lag, steadier frame times.', fa: 'بازی‌ها فول‌اسکرین واقعی می‌گیرند به‌جای مسیر ترکیب‌ساز ویندوز — تأخیر ورودی کمتر، فریم‌تایم پایدارتر.' },
    values: [v(GCS, 'GameDVR_FSEBehaviorMode', 2), v(GCS, 'GameDVR_HonorUserFSEBehaviorMode', 1), v(GCS, 'GameDVR_DXGIHonorFSEWindowsCompatible', 1), v(GCS, 'GameDVR_EFSEFeatureFlags', 0)],
  }),
  regTweak({
    id: 'mm_games_priority', category: 'fps', level: 'safe', recommended: true,
    title: { en: 'Prioritise games in the multimedia scheduler', fa: 'اولویت بازی‌ها در زمان‌بند چندرسانه‌ای' },
    desc: { en: 'SystemResponsiveness 0 and the "Games" task at high GPU/CPU priority: the scheduler stops reserving CPU for background work while a game runs.', fa: 'SystemResponsiveness روی ۰ و تسک «Games» با اولویت بالای GPU/CPU: زمان‌بند دیگر برای کارهای پس‌زمینه CPU رزرو نمی‌کند.' },
    values: [v(MM, 'SystemResponsiveness', 0), v(GAMES, 'GPU Priority', 8), v(GAMES, 'Priority', 6), v(GAMES, 'Scheduling Category', 'High', SZ), v(GAMES, 'SFIO Priority', 'High', SZ)],
  }),
  regTweak({
    id: 'hags_on', category: 'fps', level: 'advanced', recommended: false, reboot: true,
    title: { en: 'Hardware-accelerated GPU scheduling', fa: 'زمان‌بندی سخت‌افزاری GPU (HAGS)' },
    desc: { en: 'Lets the GPU manage its own memory queue (Windows 10 2004+, recent GPUs). Helps some systems, hurts a few — test with a game you know.', fa: 'اجازه می‌دهد GPU صف حافظهٔ خودش را مدیریت کند (ویندوز ۱۰ ۲۰۰۴ به بالا، کارت‌های جدید). به بعضی سیستم‌ها کمک و به بعضی ضرر می‌زند — با بازی آشنا تست کنید.' },
    values: [v(`${HKLM}\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers`, 'HwSchMode', 2)],
  }),
  regTweak({
    id: 'mouse_accel_off', category: 'fps', level: 'safe', recommended: true,
    title: { en: 'Disable mouse acceleration', fa: 'غیرفعال کردن شتاب ماوس' },
    desc: { en: '"Enhance pointer precision" off: the same hand movement always moves the same distance — what every aim guide asks for.', fa: 'خاموش کردن Enhance pointer precision: حرکت یکسان دست همیشه به یک اندازه جابه‌جا می‌کند — چیزی که هر راهنمای ایم می‌خواهد.' },
    values: [v(`${HKCU}\\Control Panel\\Mouse`, 'MouseSpeed', '0', SZ), v(`${HKCU}\\Control Panel\\Mouse`, 'MouseThreshold1', '0', SZ), v(`${HKCU}\\Control Panel\\Mouse`, 'MouseThreshold2', '0', SZ)],
  }),
  regTweak({
    id: 'background_apps_off', category: 'fps', level: 'safe', recommended: true,
    title: { en: 'Stop Store apps running in the background', fa: 'توقف اجرای پس‌زمینهٔ برنامه‌های استور' },
    desc: { en: 'UWP apps (Xbox, Weather, News…) stop waking up behind your game.', fa: 'برنامه‌های UWP (ایکس‌باکس، هواشناسی، اخبار…) دیگر پشت بازی شما بیدار نمی‌شوند.' },
    values: [v(`${HKCU}\\Software\\Microsoft\\Windows\\CurrentVersion\\BackgroundAccessApplications`, 'GlobalUserDisabled', 1)],
  }),
  regTweak({
    id: 'power_throttling_off', category: 'fps', level: 'advanced', recommended: false, reboot: true,
    title: { en: 'Disable power throttling', fa: 'غیرفعال کردن Power Throttling' },
    desc: { en: 'Windows no longer slows background processes to save power — for laptops on the charger and desktops.', fa: 'ویندوز دیگر پردازش‌های پس‌زمینه را برای صرفه‌جویی برق کند نمی‌کند — برای لپ‌تاپ روی شارژر و دسکتاپ.' },
    values: [v(`${HKLM}\\SYSTEM\\CurrentControlSet\\Control\\Power\\PowerThrottling`, 'PowerThrottlingOff', 1)],
  }),
  regTweak({
    id: 'visual_fx_perf', category: 'fps', level: 'advanced', recommended: false,
    title: { en: 'Visual effects: best performance', fa: 'جلوه‌های بصری: بهترین کارایی' },
    desc: { en: 'Turns off window animations, shadows and transparency. Frees a little GPU and makes the desktop snappier — looks plainer.', fa: 'انیمیشن پنجره‌ها، سایه‌ها و شفافیت را خاموش می‌کند. کمی GPU آزاد می‌کند و دسکتاپ چابک‌تر می‌شود — ظاهر ساده‌تر.' },
    values: [v(`${HKCU}\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects`, 'VisualFXSetting', 2), v(`${HKCU}\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize`, 'EnableTransparency', 0)],
  }),
  regTweak({
    id: 'game_bar_off', category: 'fps', level: 'safe', recommended: true,
    title: { en: 'Disable the Xbox Game Bar overlay', fa: 'غیرفعال کردن اورلی Xbox Game Bar' },
    desc: { en: 'No overlay hooks into your games and no startup panel — one less process drawing on top of every frame.', fa: 'هیچ اورلی‌ای به بازی قلاب نمی‌شود و پنل شروع نمی‌آید — یک پروسهٔ کمتر روی هر فریم.' },
    values: [v(`${HKCU}\\Software\\Microsoft\\GameBar`, 'ShowStartupPanel', 0), v(`${HKCU}\\Software\\Microsoft\\GameBar`, 'UseNexusForGameBarEnabled', 0), v(`${HKCU}\\Software\\Microsoft\\GameBar`, 'GamePanelStartupTipIndex', 3)],
  }),
  regTweak({
    id: 'telemetry_off', category: 'fps', level: 'safe', recommended: true,
    title: { en: 'Stop diagnostics & telemetry uploads', fa: 'توقف ارسال دیاگنوستیک و تله‌متری' },
    desc: { en: 'Windows stops collecting and uploading usage data in the background — less disk and network activity while you play.', fa: 'ویندوز دیگر در پس‌زمینه دادهٔ مصرف جمع و آپلود نمی‌کند — فعالیت دیسک و شبکهٔ کمتر هنگام بازی.' },
    values: [v(`${HKLM}\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection`, 'AllowTelemetry', 0), v(`${HKLM}\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\DataCollection`, 'AllowTelemetry', 0)],
  }),
  regTweak({
    id: 'widgets_off', category: 'fps', level: 'safe', recommended: true,
    title: { en: 'Turn off taskbar widgets / news feed', fa: 'خاموش کردن ویجت‌ها و فید خبری تسک‌بار' },
    desc: { en: 'The Windows 11 widgets board and the Windows 10 news feed refresh in the background all day. Off = no Edge WebView processes idling behind your game.', fa: 'ویجت‌های ویندوز ۱۱ و فید خبری ویندوز ۱۰ تمام روز در پس‌زمینه رفرش می‌شوند. خاموش = هیچ پروسهٔ WebView پشت بازی بیکار نمی‌چرخد.' },
    values: [v(`${HKLM}\\SOFTWARE\\Policies\\Microsoft\\Dsh`, 'AllowNewsAndInterests', 0), v(`${HKCU}\\Software\\Microsoft\\Windows\\CurrentVersion\\Feeds`, 'ShellFeedsTaskbarViewMode', 2)],
  }),
  regTweak({
    id: 'tips_off', category: 'fps', level: 'safe', recommended: true,
    title: { en: 'Disable tips, suggestions and Start ads', fa: 'غیرفعال کردن نکته‌ها، پیشنهادها و تبلیغ‌های Start' },
    desc: { en: 'Content Delivery Manager stops fetching suggested apps and tips — fewer surprise downloads and notifications mid-game.', fa: 'Content Delivery Manager دیگر برنامهٔ پیشنهادی و نکته دانلود نمی‌کند — دانلود و نوتیفیکیشن ناگهانی کمتر وسط بازی.' },
    values: [v(`${HKCU}\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager`, 'SubscribedContent-338389Enabled', 0), v(`${HKCU}\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager`, 'SoftLandingEnabled', 0), v(`${HKCU}\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager`, 'SystemPaneSuggestionsEnabled', 0), v(`${HKCU}\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager`, 'SilentInstalledAppsEnabled', 0)],
  }),
  regTweak({
    id: 'win32_priority', category: 'fps', level: 'advanced', recommended: false,
    title: { en: 'Longer CPU time slices for the foreground app', fa: 'زمان CPU طولانی‌تر برای برنامهٔ جلو' },
    desc: { en: 'Win32PrioritySeparation 0x26: the active window (your game) gets long, fixed quanta with a foreground boost. Background downloads and launchers get less. Advanced — revert if a streaming/recording app stutters.', fa: 'Win32PrioritySeparation روی 0x26: پنجرهٔ فعال (بازی) سهم بلند و ثابت CPU با بوست جلو می‌گیرد. دانلود و لانچرهای پس‌زمینه کمتر. پیشرفته — اگر برنامهٔ استریم/ضبط لگ زد برگردانید.' },
    values: [v(`${HKLM}\\SYSTEM\\CurrentControlSet\\Control\\PriorityControl`, 'Win32PrioritySeparation', 38)],
  }),
  {
    id: 'power_plan_high', category: 'fps', level: 'safe', recommended: true,
    title: { en: 'High performance power plan', fa: 'پاور پلن High performance' },
    desc: { en: 'Uses the Ultimate Performance plan when Windows has it, else High performance: no CPU parking, no clock ramp-down between frames.', fa: 'از پلن Ultimate Performance استفاده می‌کند اگر ویندوز داشته باشد، وگرنه High performance: بدون پارک شدن هسته‌ها، بدون افت کلاک بین فریم‌ها.' },
    ULTIMATE: 'e9a42b02-d5df-448d-aa00-03f14749eb61', HIGH: '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c',
    async current(ctx) { const r = await ctx.run('powercfg', ['/getactivescheme']); const m = r.out.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i); return m ? m[1].toLowerCase() : null; },
    // applied = the well-known Ultimate/High GUID is active, or the scheme this app activated (a duplicated Ultimate gets a
    // new GUID; plan names are localized, so the GUID we set is remembered in the backup instead of matching names)
    async check(ctx) { const cur = await this.current(ctx); if (!cur) return false; if (cur === this.ULTIMATE || cur === this.HIGH) return true; const b = await ctx.backup.get(this.id); return !!(b && b.set && b.set === cur); },
    async apply(ctx) {
      const cur = await this.current(ctx);
      let target = this.ULTIMATE, r = await ctx.run('powercfg', ['/setactive', this.ULTIMATE]);
      if (r.code !== 0) {   // Ultimate is hidden on most Windows 10/11 Home installs: duplicating it creates a visible copy with a new GUID
        const d = await ctx.run('powercfg', ['/duplicatescheme', this.ULTIMATE]); const m = d.out.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
        if (m) { target = m[1].toLowerCase(); r = await ctx.run('powercfg', ['/setactive', target]); }
      }
      if (r.code !== 0) { target = this.HIGH; await ctx.must('powercfg', ['/setactive', this.HIGH]); }
      const b = await ctx.backup.get(this.id);
      if (b) { b.set = target; await ctx.backup.clear(this.id); await ctx.backup.saveOnce(this.id, b); } else await ctx.backup.saveOnce(this.id, { scheme: cur, set: target });
    },
    async revert(ctx) { const b = await ctx.backup.get(this.id); await ctx.must('powercfg', ['/setactive', b && b.scheme || '381b4222-f694-41f0-9685-ff5bb260df2e']); await ctx.backup.clear(this.id); },
  },
];

const IFACES = `${HKLM}\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces`;
const DNS_PROVIDERS = {
  cloudflare: { label: 'Cloudflare 1.1.1.1', servers: ['1.1.1.1', '1.0.0.1'] },
  google: { label: 'Google 8.8.8.8', servers: ['8.8.8.8', '8.8.4.4'] },
  shecan: { label: 'Shecan (شکن — anti-sanction)', servers: ['178.22.122.100', '185.51.200.2'] },
  electro: { label: 'Electro (الکترو — anti-sanction)', servers: ['78.157.42.100', '78.157.42.101'] },
  begzar: { label: 'Begzar (بگذر — anti-sanction)', servers: ['185.55.226.26', '185.55.225.25'] },
  radar: { label: 'Radar Game (رادار — gaming)', servers: ['10.202.10.10', '10.202.10.11'] },
  '403': { label: '403.online (anti-sanction)', servers: ['10.202.10.202', '10.202.10.102'] },
};
const NETWORK = [
  {
    id: 'nagle_off', category: 'network', level: 'safe', recommended: true,
    title: { en: "Disable Nagle's algorithm", fa: 'غیرفعال کردن الگوریتم Nagle' },
    desc: { en: 'Small packets (game input, chat) are sent immediately instead of being held to fill a bigger packet. The classic ping tweak for online games.', fa: 'پکت‌های کوچک (ورودی بازی، چت) فوراً فرستاده می‌شوند به‌جای صبر برای پر شدن پکت بزرگ‌تر. تغییر کلاسیک پینگ برای بازی آنلاین.' },
    async check(ctx) { const keys = await ctx.reg.subkeys(IFACES); if (!keys.length) return false; for (const k of keys) { const a = await ctx.reg.get(k, 'TcpAckFrequency'), b = await ctx.reg.get(k, 'TCPNoDelay'); if (!a || a.value !== 1 || !b || b.value !== 1) return false; } return true; },
    async apply(ctx) {
      const keys = await ctx.reg.subkeys(IFACES); const originals = [];
      for (const k of keys) for (const name of ['TcpAckFrequency', 'TCPNoDelay']) originals.push({ key: k, name, was: await ctx.reg.get(k, name) });
      await ctx.backup.saveOnce(this.id, originals);
      for (const k of keys) { await ctx.reg.set(k, 'TcpAckFrequency', 'REG_DWORD', 1); await ctx.reg.set(k, 'TCPNoDelay', 'REG_DWORD', 1); }
    },
    async revert(ctx) {
      const originals = await ctx.backup.get(this.id);
      if (originals) { for (const o of originals) { if (o.was) await ctx.reg.set(o.key, o.name, o.was.type, o.was.value); else await ctx.reg.del(o.key, o.name); } }
      else for (const k of await ctx.reg.subkeys(IFACES)) { await ctx.reg.del(k, 'TcpAckFrequency'); await ctx.reg.del(k, 'TCPNoDelay'); }
      await ctx.backup.clear(this.id);
    },
  },
  regTweak({
    id: 'network_throttling_off', category: 'network', level: 'safe', recommended: true,
    title: { en: 'Remove the network throttling limit', fa: 'حذف محدودیت Network Throttling' },
    desc: { en: 'Windows caps non-multimedia network traffic at 10 packets/ms while media plays. Off = your game traffic is never throttled.', fa: 'ویندوز هنگام پخش رسانه، ترافیک غیرچندرسانه‌ای را به ۱۰ پکت در میلی‌ثانیه محدود می‌کند. خاموش = ترافیک بازی هیچ‌وقت محدود نمی‌شود.' },
    values: [v(MM, 'NetworkThrottlingIndex', 0xffffffff)],
  }),
  regTweak({
    id: 'qos_reserve_off', category: 'network', level: 'safe', recommended: true,
    title: { en: 'Stop reserving bandwidth for QoS', fa: 'لغو رزرو پهنای باند برای QoS' },
    desc: { en: 'Windows can hold back up to 20% of bandwidth for QoS traffic. Set the reserve to 0%.', fa: 'ویندوز می‌تواند تا ۲۰٪ پهنای باند را برای QoS نگه دارد. رزرو را روی ۰٪ می‌گذارد.' },
    values: [v(`${HKLM}\\SOFTWARE\\Policies\\Microsoft\\Windows\\Psched`, 'NonBestEffortLimit', 0)],
  }),
  regTweak({
    id: 'delivery_optimization_off', category: 'network', level: 'safe', recommended: true,
    title: { en: 'Stop Windows Update uploading to other PCs', fa: 'توقف آپلود آپدیت ویندوز به کامپیوترهای دیگر' },
    desc: { en: 'Delivery Optimization shares update files with strangers over your connection. Off = no surprise upload eating your ping.', fa: 'Delivery Optimization فایل‌های آپدیت را با غریبه‌ها روی اینترنت شما به اشتراک می‌گذارد. خاموش = آپلود ناگهانی پینگ شما را نمی‌خورد.' },
    values: [v(`${HKLM}\\SOFTWARE\\Policies\\Microsoft\\Windows\\DeliveryOptimization`, 'DODownloadMode', 0)],
  }),
  {
    id: 'tcp_tuning', category: 'network', level: 'safe', recommended: true,
    title: { en: 'TCP tuning: autotuning normal, ECN and timestamps off, RSS on', fa: 'تنظیم TCP: autotuning نرمال، ECN و timestamps خاموش، RSS روشن' },
    desc: { en: 'The Windows TCP stack settings that give the best throughput and latency on consumer connections. Reverted to your previous values on undo.', fa: 'تنظیمات TCP ویندوز که بهترین سرعت و تأخیر را روی اینترنت خانگی می‌دهد. با بازگشت، مقادیر قبلی شما برمی‌گردد.' },
    WANT: { AutoTuningLevelLocal: 'Normal', EcnCapability: 'Disabled', Timestamps: 'Disabled' },
    async read(ctx) { return ctx.psJson('Get-NetTCPSetting -SettingName Internet | Select-Object AutoTuningLevelLocal, EcnCapability, Timestamps | ConvertTo-Json -Compress'); },
    async check(ctx) { const s = await this.read(ctx); return !!s && Object.entries(this.WANT).every(([k, val]) => String(s[k]).toLowerCase() === val.toLowerCase()); },
    async apply(ctx) {
      const s = await this.read(ctx); if (s) await ctx.backup.saveOnce(this.id, s);
      await ctx.ps('Set-NetTCPSetting -SettingName Internet -AutoTuningLevelLocal Normal -EcnCapability Disabled -Timestamps Disabled');
      await ctx.run('netsh', ['int', 'tcp', 'set', 'global', 'rss=enabled']);
    },
    async revert(ctx) {
      const b = await ctx.backup.get(this.id);
      if (b) await ctx.ps(`Set-NetTCPSetting -SettingName Internet -AutoTuningLevelLocal ${b.AutoTuningLevelLocal} -EcnCapability ${b.EcnCapability} -Timestamps ${b.Timestamps}`);
      await ctx.backup.clear(this.id);
    },
  },
  {
    id: 'dns_fast', category: 'network', level: 'safe', recommended: true, defaultOption: 'cloudflare',
    options: Object.fromEntries(Object.entries(DNS_PROVIDERS).map(([k, p]) => [k, p.label])),
    title: { en: 'Fast DNS on every connection', fa: 'DNS سریع روی همهٔ اتصال‌ها' },
    desc: { en: 'Replaces the ISP resolver on all active adapters. Cloudflare/Google for speed; Shecan, Electro, Begzar, 403 for sanctioned sites; Radar for game servers. Undo restores what you had (DHCP or your own servers).', fa: 'DNS اپراتور را روی همهٔ کارت‌های فعال عوض می‌کند. کلادفلر/گوگل برای سرعت؛ شکن، الکترو، بگذر، ۴۰۳ برای سایت‌های تحریمی؛ رادار برای سرورهای بازی. بازگشت، تنظیم قبلی شما را برمی‌گرداند (DHCP یا سرورهای خودتان).' },
    ADAPTERS: `Get-NetAdapter -Physical | Where-Object Status -eq 'Up' | ForEach-Object { $g = $_.InterfaceGuid; $ns = (Get-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces\\$g" -Name NameServer -ErrorAction SilentlyContinue).NameServer; [pscustomobject]@{ idx = $_.ifIndex; alias = $_.Name; static = [string]$ns; servers = @((Get-DnsClientServerAddress -InterfaceIndex $_.ifIndex -AddressFamily IPv4).ServerAddresses) } } | ConvertTo-Json -Compress`,
    async adapters(ctx) { const j = await ctx.psJson(this.ADAPTERS); return j ? (Array.isArray(j) ? j : [j]) : []; },
    async check(ctx) {
      const ads = await this.adapters(ctx); if (!ads.length) return false;
      const all = Object.values(DNS_PROVIDERS).map(p => p.servers.join(','));
      return ads.every(a => all.includes((Array.isArray(a.servers) ? a.servers : [a.servers]).filter(Boolean).join(',')));
    },
    async apply(ctx) {
      const prov = DNS_PROVIDERS[ctx.option] || DNS_PROVIDERS.cloudflare;
      const ads = await this.adapters(ctx); if (!ads.length) throw new Error('no active network adapter');
      await ctx.backup.saveOnce(this.id, ads.map(a => ({ idx: a.idx, alias: a.alias, static: a.static })));
      for (const a of ads) await ctx.ps(`Set-DnsClientServerAddress -InterfaceIndex ${Number(a.idx)} -ServerAddresses ${prov.servers.join(',')}`);
      await ctx.run('ipconfig', ['/flushdns']);
    },
    async revert(ctx) {
      const b = await ctx.backup.get(this.id);
      const ads = b || (await this.adapters(ctx)).map(a => ({ idx: a.idx, static: '' }));
      for (const a of ads) {
        const own = String(a.static || '').split(/[,\s]+/).filter(Boolean);
        await ctx.ps(own.length ? `Set-DnsClientServerAddress -InterfaceIndex ${Number(a.idx)} -ServerAddresses ${own.join(',')}` : `Set-DnsClientServerAddress -InterfaceIndex ${Number(a.idx)} -ResetServerAddresses`);
      }
      await ctx.run('ipconfig', ['/flushdns']);
      await ctx.backup.clear(this.id);
    },
  },
];

module.exports = [...FPS, ...NETWORK];
module.exports.DNS_PROVIDERS = DNS_PROVIDERS;
