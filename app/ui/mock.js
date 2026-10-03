// Browser preview only (no WebView2 host): answers the RPC with fake data so the UI can be developed and screenshot
// tested on any machine. Never loaded inside the real app.
(() => {
  const q = new URLSearchParams(location.search);
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  let loggedIn = q.get('login') !== '0', active = q.get('active') !== '0';
  const T = (en, fa) => ({ en, fa });
  const applied = new Set(['game_dvr_off', 'game_mode_on', 'power_plan_high', 'mouse_accel_off', 'nagle_off', 'dns_fast', 'telemetry_off', 'sticky_keys_off']);
  const TW = [
    ['game_dvr_off', 'fps', 'safe', true, false, T('Turn off Game DVR / background recording', 'خاموش کردن Game DVR و ضبط پس‌زمینه'), T('Windows records gameplay in the background for the Xbox Game Bar. Off = no hidden encoder eating FPS.', 'ویندوز در پس‌زمینه برای Xbox Game Bar گیم‌پلی ضبط می‌کند. خاموش = هیچ انکودر پنهانی FPS نمی‌خورد.')],
    ['game_mode_on', 'fps', 'safe', true, false, T('Enable Game Mode', 'فعال کردن Game Mode'), T('Windows gives the game priority over background tasks and Windows Update while playing.', 'ویندوز هنگام بازی، بازی را بر کارهای پس‌زمینه و آپدیت ویندوز مقدم می‌کند.')],
    ['fse_off', 'fps', 'safe', true, false, T('Disable fullscreen optimizations', 'غیرفعال کردن Fullscreen Optimizations'), T('Games get true exclusive fullscreen instead of the borderless compositor path — lower input lag, steadier frame times.', 'بازی‌ها فول‌اسکرین واقعی می‌گیرند — تأخیر ورودی کمتر، فریم‌تایم پایدارتر.')],
    ['mm_games_priority', 'fps', 'safe', true, false, T('Prioritise games in the multimedia scheduler', 'اولویت بازی‌ها در زمان‌بند چندرسانه‌ای'), T('SystemResponsiveness 0 and the "Games" task at high GPU/CPU priority.', 'SystemResponsiveness روی ۰ و تسک «Games» با اولویت بالا.')],
    ['mouse_accel_off', 'fps', 'safe', true, false, T('Disable mouse acceleration', 'غیرفعال کردن شتاب ماوس'), T('"Enhance pointer precision" off: the same hand movement always moves the same distance.', 'خاموش کردن Enhance pointer precision.')],
    ['power_plan_high', 'fps', 'safe', true, false, T('High performance power plan', 'پاور پلن High performance'), T('Ultimate Performance when Windows has it, else High performance.', 'Ultimate Performance اگر ویندوز داشته باشد، وگرنه High performance.')],
    ['telemetry_off', 'fps', 'safe', true, false, T('Stop diagnostics & telemetry uploads', 'توقف ارسال دیاگنوستیک و تله‌متری'), T('Windows stops collecting and uploading usage data in the background.', 'ویندوز دیگر در پس‌زمینه دادهٔ مصرف جمع نمی‌کند.')],
    ['sticky_keys_off', 'fps', 'safe', true, false, T('Disable Sticky / Filter / Toggle Keys shortcuts', 'غیرفعال کردن میان‌برهای Sticky Keys'), T('Pressing Shift five times in a fight will never again pop a dialog over your game.', 'دیگر پنج بار Shift زدن پنجره‌ای روی بازی نمی‌آورد.')],
    ['hags_on', 'fps', 'advanced', false, true, T('Hardware-accelerated GPU scheduling', 'زمان‌بندی سخت‌افزاری GPU (HAGS)'), T('Lets the GPU manage its own memory queue. Helps some systems, hurts a few.', 'اجازه می‌دهد GPU صف حافظهٔ خودش را مدیریت کند.')],
    ['timer_global', 'fps', 'advanced', false, true, T('Allow a global 0.5 ms system timer', 'اجازهٔ تایمر سراسری ۰٫۵ میلی‌ثانیه'), T("With this, the Guard's 0.5 ms timer applies to your game too.", 'تایمر ۰٫۵ms گارد برای بازی شما هم اعمال می‌شود.')],
    ['core_parking_off', 'fps', 'advanced', false, false, T('Disable CPU core parking', 'غیرفعال کردن پارک شدن هسته‌های CPU'), T('Keeps every core awake instead of parking idle ones.', 'همهٔ هسته‌ها را بیدار نگه می‌دارد.')],
    ['nagle_off', 'network', 'safe', true, false, T("Disable Nagle's algorithm", 'غیرفعال کردن الگوریتم Nagle'), T('Small packets are sent immediately. The classic ping tweak.', 'پکت‌های کوچک فوراً فرستاده می‌شوند. تغییر کلاسیک پینگ.')],
    ['network_throttling_off', 'network', 'safe', true, false, T('Remove the network throttling limit', 'حذف محدودیت Network Throttling'), T('Your game traffic is never throttled while media plays.', 'ترافیک بازی هیچ‌وقت محدود نمی‌شود.')],
    ['tcp_tuning', 'network', 'safe', true, false, T('TCP tuning: autotuning normal, ECN and timestamps off, RSS on', 'تنظیم TCP'), T('The Windows TCP stack settings that give the best throughput and latency.', 'تنظیمات TCP ویندوز با بهترین سرعت و تأخیر.')],
    ['dns_fast', 'network', 'safe', true, false, T('Fast DNS on every connection', 'DNS سریع روی همهٔ اتصال‌ها'), T('Replaces the ISP resolver on all active adapters. Undo restores what you had.', 'DNS اپراتور را روی همهٔ کارت‌های فعال عوض می‌کند.')],
    ['usb_suspend_off', 'fps', 'safe', true, false, T('Never suspend USB devices (mouse, keyboard, headset)', 'هیچ‌وقت دستگاه‌های USB به حالت تعلیق نروند'), T('Off = no first-click delay, no headset drop-outs.', 'خاموش = بدون تأخیر کلیک اول، بدون قطع صدای هدست.')],
    ['fast_startup_off', 'fps', 'safe', false, false, T('Turn off Fast Startup (real shutdowns)', 'خاموش کردن Fast Startup'), T('Every boot is clean; drivers never carry stale state over.', 'هر بوت تمیز است.')],
    ['diagtrack_off', 'fps', 'safe', true, false, T('Stop the telemetry service (Connected User Experiences)', 'توقف سرویس تله‌متری'), T('DiagTrack never runs.', 'DiagTrack هیچ‌وقت اجرا نمی‌شود.')],
    ['privacy_off', 'fps', 'safe', true, false, T('Privacy: no advertising ID, activity history, typing data, tailored tips', 'حریم خصوصی'), T('Turns off the background collectors in Settings → Privacy.', 'جمع‌کننده‌های پس‌زمینه را خاموش می‌کند.')],
    ['telemetry_tasks_off', 'fps', 'safe', false, false, T('Disable telemetry & compatibility scheduled tasks', 'غیرفعال کردن تسک‌های تله‌متری'), T('CEIP, Compatibility Appraiser, feedback uploads… disabled.', 'CEIP و Compatibility Appraiser غیرفعال.')],
    ['win_sounds_off', 'fps', 'safe', false, false, T("Windows sounds: 'No Sounds' scheme", 'صداهای ویندوز: طرح No Sounds'), T('No ding in your headset mid-round.', 'دیگر دینگ وسط راند نمی‌آید.')],
    ['bluetooth_off', 'fps', 'advanced', false, false, T('Disable Bluetooth services (no Bluetooth devices)', 'غیرفعال کردن سرویس‌های بلوتوث'), T('Only if you use no Bluetooth devices.', 'فقط اگر دستگاه بلوتوثی ندارید.')],
    ['nic_power_mgmt_off', 'network', 'safe', false, true, T('Network adapter: never powered down to save energy', 'کارت شبکه: هیچ‌وقت خاموش نشود'), T("Unticks 'Allow the computer to turn off this device' on every adapter.", 'گزینهٔ خاموش کردن کارت شبکه برداشته می‌شود.')],
    ['wifi_power_max', 'network', 'safe', false, false, T('Wi-Fi adapter: maximum performance', 'کارت Wi-Fi: حداکثر کارایی'), T('Stops Windows putting the wireless adapter to sleep between packets.', 'جلوی خواباندن کارت وایرلس بین پکت‌ها را می‌گیرد.')],
  ].map(([id, category, level, recommended, reboot, title, desc]) => ({ id, category, level, recommended, reboot, title, desc, hasBackup: false }));
  const DNS = [
    ['shatel', 'Shatel (شاتل — ISP)', ['85.15.1.14', '85.15.1.15'], 'isp', 'shatel'], ['tci', 'TCI / Mokhabrat (مخابرات — ISP)', ['217.218.127.127', '217.218.155.155'], 'isp', 'tci'], ['pishgaman', 'Pishgaman (پیشگامان — ISP)', ['5.202.100.100', '5.202.100.101'], 'isp', 'pishgaman'],
    ['shecan', 'Shecan (شکن — anti-sanction)', ['178.22.122.100', '185.51.200.2'], 'iran'], ['electro', 'Electro (الکترو — anti-sanction)', ['78.157.42.100', '78.157.42.101'], 'iran'], ['begzar', 'Begzar (بگذر — anti-sanction)', ['185.55.226.26', '185.55.225.25'], 'iran'], ['radar', 'Radar Game (رادار — gaming)', ['10.202.10.10', '10.202.10.11'], 'iran'], ['403', '403.online (anti-sanction)', ['10.202.10.202', '10.202.10.102'], 'iran'],
    ['cloudflare', 'Cloudflare 1.1.1.1', ['1.1.1.1', '1.0.0.1'], 'global'], ['google', 'Google 8.8.8.8', ['8.8.8.8', '8.8.4.4'], 'global'], ['quad9', 'Quad9 Security', ['9.9.9.9', '149.112.112.112'], 'global'], ['opendns', 'OpenDNS', ['208.67.222.222', '208.67.220.220'], 'global'], ['level3b', 'Level 3 B (4.2.2.1)', ['4.2.2.1', '4.2.2.2'], 'global'], ['adguard', 'AdGuard', ['94.140.14.14', '94.140.15.15'], 'global'], ['yandex', 'Yandex', ['77.88.8.1', '77.88.8.8'], 'global'], ['comodo', 'Comodo Secure', ['8.26.56.26', '8.20.247.20'], 'global'],
    ['cloudflare_family', 'Cloudflare Malware + Adult Blocking', ['1.1.1.3', '1.0.0.3'], 'family'], ['adguard_family', 'AdGuard Family', ['94.140.14.15', '94.140.15.16'], 'family'], ['yandex_safe', 'Yandex Safe', ['77.88.8.88', '77.88.8.2'], 'secure'],
  ].map(([id, label, servers, group, isp]) => ({ id, label, servers, group, isp }));
  const dnsOpts = { auto: 'Auto — best for my network (ISP first, then fastest)' }; DNS.forEach(p => { dnsOpts[p.id] = p.label; });
  TW.find(t => t.id === 'dns_fast').options = dnsOpts;
  TW.find(t => t.id === 'dns_fast').defaultOption = 'auto';
  const dnsScan = () => { const lat = { shatel: 9, tci: null, pishgaman: null, shecan: 14, electro: 18, begzar: 22, radar: null, 403: null, cloudflare: 41, google: 58, quad9: 77, opendns: 96, level3b: 71, adguard: 83, yandex: 132, comodo: 160, cloudflare_family: 44, adguard_family: 88, yandex_safe: 140 };
    const results = DNS.map(p => ({ id: p.id, label: p.label, group: p.group, servers: p.servers, ms: lat[p.id] ?? null, answers: lat[p.id] == null ? 0 : (p.id === 'google' ? 5 : 8), queries: 8 })).sort((a, b) => (a.ms == null) - (b.ms == null) || (a.ms || 0) - (b.ms || 0));
    const isp = q.get('isp') === 'none' ? '' : (q.get('isp') || 'shatel'); return { at: Date.now(), isp, ispName: { shatel: 'Shatel', tci: 'TCI (Mokhabrat)' }[isp] || '', best: isp === 'shatel' ? 'shatel' : 'shecan', results }; };
  let lastScan = q.get('dns') === '1' ? dnsScan() : null;
  let account = { username: 'hawre', active: true, expires: Date.now() + 23 * 864e5, created: Date.now() - 140 * 864e5, machines: 2, max: 2, support: '@fpsboost', prices: { 1: 150000, 3: 390000, 12: 1290000 }, payments: [{ at: Date.now() - 7 * 864e5, months: 1, amount: 150000, status: 'paid', ref: '184773920' }, { at: Date.now() - 40 * 864e5, months: 1, amount: 150000, status: 'paid', ref: '173662011' }, { at: Date.now() - 41 * 864e5, months: 3, amount: 390000, status: 'failed', ref: '' }] };
  const state = () => TW.map(t => ({ ...t, applied: applied.has(t.id), hasBackup: applied.has(t.id) }));
  const auth = () => ({ loggedIn, username: loggedIn ? 'hawre' : '', active: loggedIn && active, expires: Date.now() + 23 * 864e5, checked: Date.now(), offline: q.get('offline') === '1' });
  const presets = [
    { id: 'val', name: 'Valorant', icon: 'val.webp', tweaks: ['game_dvr_off', 'game_mode_on', 'mm_games_priority', 'power_plan_high', 'sticky_keys_off', 'fse_off', 'mouse_accel_off', 'nagle_off', 'network_throttling_off', 'tcp_tuning'], tips: [T('In-game: Multithreaded Rendering ON, VSync OFF, Limit FPS Always OFF.', 'داخل بازی: Multithreaded Rendering روشن، VSync خاموش.'), T('Raw Input Buffer ON for the lowest mouse latency.', 'Raw Input Buffer روشن.')] },
    { id: 'cs2', name: 'Counter-Strike 2', icon: 'cs2.webp', tweaks: ['game_dvr_off', 'game_mode_on', 'fse_off', 'mouse_accel_off', 'nagle_off'], tips: [T('Steam launch options: -high -novid -nojoy', 'گزینه‌های اجرا: -high -novid -nojoy')] },
    { id: 'mc', name: 'Minecraft', icon: 'mc.webp', tweaks: ['game_dvr_off', 'game_mode_on', 'nagle_off', 'dns_fast'], tips: [T('Give Java 4–6 GB, never all your RAM.', 'به جاوا ۴ تا ۶ گیگ بدهید.')] },
    { id: 'fn', name: 'Fortnite', icon: 'fn.webp', tweaks: ['game_dvr_off', 'fse_off', 'network_throttling_off', 'nagle_off'], tips: [T('Rendering Mode: Performance; Textures Low.', 'Rendering Mode روی Performance.')] },
    { id: 'apex', name: 'Apex Legends', icon: 'apex.webp', tweaks: ['game_dvr_off', 'fse_off', 'nagle_off', 'tcp_tuning'], tips: [T('+fps_max unlimited -novid -high', '+fps_max unlimited -novid -high')] },
    { id: 'wz', name: 'Call of Duty: Warzone', icon: 'wz.svg', tweaks: ['game_dvr_off', 'fse_off', 'nagle_off'], tips: [T('On-Demand Texture Streaming OFF.', 'On-Demand Texture Streaming خاموش.')] },
    { id: 'rbx', name: 'Roblox', icon: 'rbx.webp', tweaks: ['game_dvr_off', 'nagle_off', 'dns_fast'], tips: [T('Graphics Mode Manual, quality 3–5.', 'Graphics Mode روی Manual.')] },
    { id: 'gta', name: 'GTA V', icon: 'gta.webp', tweaks: ['game_dvr_off', 'fse_off'], tips: [T('Keep Extended Distance Scaling and Grass low.', 'Extended Distance Scaling و Grass را پایین نگه دارید.')] },
    { id: 'lol', name: 'League of Legends', icon: 'lol.webp', tweaks: ['game_dvr_off', 'mouse_accel_off', 'nagle_off'], tips: [T('Character Inking OFF, Shadows OFF.', 'Character Inking خاموش.')] },
    { id: 'rivals', name: 'Marvel Rivals', icon: 'rivals.webp', tweaks: ['game_dvr_off', 'fse_off', 'nagle_off'], tips: [T('Turn off Lumen; Model Detail Low.', 'Lumen خاموش.')] },
  ];
  const tools = [
    { id: 'ram_clean', icon: 'ram', title: T('Free RAM now', 'آزادسازی رم همین حالا'), desc: T('Trims idle apps and purges the standby cache — what the background Guard does when a game starts.', 'برنامه‌های بیکار را فشرده و کش standby را خالی می‌کند.') },
    { id: 'restore_point', icon: 'shield', title: T('Create a System Restore point', 'ساخت نقطهٔ بازیابی ویندوز'), desc: T('A Windows snapshot you can roll back to from Settings → Recovery.', 'یک عکس فوری از ویندوز که می‌توانید به آن برگردید.') },
    { id: 'flush_dns', icon: 'dns', title: T('Flush DNS cache', 'پاک کردن کش DNS'), desc: T('Forget cached name lookups.', 'رکوردهای کش‌شده را فراموش می‌کند.') },
    { id: 'ip_renew', icon: 'net', title: T('Renew the IP address', 'گرفتن IP جدید'), desc: T('Releases and renews the DHCP lease on every adapter.', 'اجارهٔ DHCP را دوباره می‌گیرد.') },
    { id: 'sfc_scan', icon: 'tool', title: T('Repair Windows system files (DISM + SFC)', 'ترمیم فایل‌های سیستمی ویندوز'), desc: T('Opens a window that runs DISM and sfc /scannow. 10–30 minutes.', 'پنجره‌ای با DISM و sfc /scannow باز می‌کند.') },
    { id: 'mem_test', icon: 'ram', reboot: true, title: T('Test the RAM (Windows Memory Diagnostic)', 'تست رم'), desc: T('Opens the Windows Memory Diagnostic.', 'Windows Memory Diagnostic را باز می‌کند.') },
    { id: 'winsock_reset', icon: 'reset', reboot: true, title: T('Reset Winsock + TCP/IP stack', 'ریست Winsock و TCP/IP'), desc: T('Rebuilds the network stack config. Needs a restart.', 'پیکربندی شبکه را از نو می‌سازد. نیاز به ریستارت.') },
    { id: 'clean_temp', icon: 'broom', title: T('Clean temporary files', 'پاک‌سازی فایل‌های موقت'), desc: T('Deletes files in your Temp folders (files in use are skipped).', 'فایل‌های Temp را حذف می‌کند.') },
    { id: 'clean_shader', icon: 'gpu', title: T('Clear shader caches', 'پاک کردن کش شیدرها'), desc: T('Deletes the DirectX, NVIDIA and AMD shader caches.', 'کش شیدر DirectX، انویدیا و AMD را حذف می‌کند.') },
  ];
  let guard = { enabled: true, game: q.get('game') === '0' ? '' : 'Valorant', gameExe: 'valorant-win64-shipping.exe', since: Date.now() - 23 * 60000, boosted: 42, freedMb: 18650, enforced: 3, totalMb: 16000, availMb: 5200, load: 68, timer: true, lastCleanAt: Date.now() - 600000,
    events: [{ at: Date.now() - 60000, kind: 'ram', game: 'Valorant', text: 'Freed 1.2 GB of RAM for Valorant', fa: '1.2 GB رم برای Valorant آزاد شد', mb: 1228 }, { at: Date.now() - 23 * 60000, kind: 'game', game: 'Valorant', text: 'Valorant detected — priority high, 0.5 ms timer', fa: 'Valorant شناسایی شد — اولویت بالا، تایمر ۰٫۵ms' }, { at: Date.now() - 5 * 3600000, kind: 'enforce', text: 'Re-applied game_dvr_off', fa: 'دوباره اعمال شد: game_dvr_off' }] };
  if (q.get('guard') === '0') guard.enabled = false;
  let settings = { lang: q.get('lang') || '', lite: q.get('lite') === '1', autoUpdate: true, closeToTray: true, startup: true, guard: guard.enabled, guardPriority: true, guardRam: true, guardTimer: true, guardEnforce: true, lastPing: null, win: {} };
  let upd = { status: q.get('upd') || 'uptodate', current: '1.0.0', latest: '1.1.0', progress: 42, file: '', error: '' };
  const emit = (n, d) => window.__ev && window.__ev(n, d);
  const methods = {
    'app.boot': async () => ({ info: { name: 'FPS Boost', version: '1.0.2', isAdmin: q.get('admin') !== '0', pingHosts: ['1.1.1.1', '8.8.8.8', 'google.com'], debug: false, serverUrl: 'https://fpsboost.ir' }, settings, auth: auth(), state: q.get('cached') === '0' ? null : state(), presets, tools, guard, update: upd, system: { os: 'Windows 11 Pro 24H2', cpu: 'Intel Core i5-12400F', cores: 12, ramGb: 16, gpu: 'NVIDIA GeForce RTX 3060' }, dns: DNS, dnsScan: lastScan }),
    'dns.scan': async () => { await wait(Number(q.get('scanMs') || 1800)); lastScan = dnsScan(); return lastScan; },
    'auth.account': async () => { await wait(500); if (q.get('acc') === 'down') throw new Error('cannot reach https://fpsboost.ir'); return account; },
    'auth.password': async (cur, next) => { await wait(600); if (cur !== 'pw') throw new Error('the current password is wrong'); return true; },
    'auth.devices': async () => { await wait(500); account = { ...account, machines: 1 }; return { machines: 1 }; },
    'app.open': async () => null, 'app.win': async () => null, 'app.quit': async () => null,
    'auth.login': async (u, p) => { await wait(600); if (!u || !p || p === 'wrong') throw new Error('wrong username or password'); loggedIn = true; return auth(); },
    'auth.status': async () => { await wait(300); return auth(); }, 'auth.logout': async () => { loggedIn = false; return auth(); },
    'tweaks.state': async () => { await wait(Number(q.get('stateMs') || 1500)); const s = state(); emit('state', s); return s; },
    'tweaks.apply': async (id) => { if (!active) throw new Error('no active subscription'); await wait(500); applied.add(id); const t = TW.find(x => x.id === id); return { id, applied: true, reboot: !!t.reboot }; },
    'tweaks.revert': async (id) => { await wait(400); applied.delete(id); return { id, applied: false }; },
    'tweaks.applyRecommended': async (cat) => { const ids = TW.filter(t => t.recommended && (!cat || t.category === cat)).map(t => t.id); for (let i = 0; i < ids.length; i++) { await wait(120); applied.add(ids[i]); emit('progress', { op: 'boost', done: i + 1, total: ids.length, id: ids[i] }); } setTimeout(() => emit('restore', { status: 'created' }), 1500); return ids.map(id => ({ id, applied: true })); },
    'tweaks.revertAll': async (cat) => { const ids = TW.filter(t => applied.has(t.id) && (!cat || t.category === cat)).map(t => t.id); for (let i = 0; i < ids.length; i++) { await wait(100); applied.delete(ids[i]); emit('progress', { op: 'restore', done: i + 1, total: ids.length, id: ids[i] }); } return ids.map(id => ({ id, applied: false })); },
    'presets.apply': async (id) => { const p = presets.find(x => x.id === id); const out = []; for (let i = 0; i < p.tweaks.length; i++) { const tw = p.tweaks[i]; const skipped = applied.has(tw), error = q.get('fail') === tw ? 'access denied' : ''; await wait(skipped ? 60 : Number(q.get('presetMs') || 500)); if (!error) applied.add(tw); const r = { id: tw, applied: !error, skipped, error, reboot: tw === 'hags_on' }; out.push(r); emit('progress', { op: 'preset', done: i + 1, total: p.tweaks.length, id: tw, preset: id, error, skipped, reboot: r.reboot }); } return out; },
    'tools.action': async (id) => { await wait(900); if (id === 'ram_clean') return { id, message: T('Freed 1340 MB', '1340 مگابایت آزاد شد') }; if (id === 'clean_temp') return { id, message: T('Freed 412 MB', '412 مگابایت آزاد شد') }; return { id, message: T('Done', 'انجام شد'), reboot: id === 'winsock_reset' }; },
    'tools.ping': async (hosts) => { await wait(900); return (hosts.length ? hosts : ['1.1.1.1', '8.8.8.8', 'google.com']).map((host, i) => ({ host, avg: i === 2 ? null : [31, 48][i], min: 29, max: 55, loss: i === 2 ? 4 : 0 })); },
    'guard.status': async () => guard, 'guard.clean': async () => { await wait(800); guard = { ...guard, freedMb: guard.freedMb + 900, availMb: guard.availMb + 900 }; emit('guard', guard); return { mb: 900 }; },
    'update.check': async () => { upd = { ...upd, status: 'checking' }; emit('update', upd); await wait(800); upd = { ...upd, status: 'available' }; emit('update', upd); return upd; },
    'update.download': async () => { for (let p = 0; p <= 100; p += 20) { await wait(150); upd = { ...upd, status: 'downloading', progress: p }; emit('update', upd); } upd = { ...upd, status: 'ready', progress: 100 }; emit('update', upd); return upd; },
    'update.install': async () => true,
    'settings.set': async (patch) => { settings = { ...settings, ...patch }; guard.enabled = settings.guard; return settings; },
    'system.info': async () => ({ os: 'Windows 11 Pro 24H2', cpu: 'Intel Core i5-12400F', cores: 12, ramGb: 16, gpu: 'NVIDIA GeForce RTX 3060' }),
  };
  window.__mock = (id, m, a) => { const f = methods[m]; Promise.resolve().then(() => f ? f(...a) : Promise.reject(new Error('unknown method ' + m))).then(d => window.__rpc(id, true, d), e => window.__rpc(id, false, e.message)); };
  // a live guard tick for screenshots
  setInterval(() => { guard = { ...guard, availMb: 5000 + Math.round(Math.random() * 600) }; emit('guard', guard); }, 4000);
})();
