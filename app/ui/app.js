/* FPS Boost UI. Talks to Go over window.chrome.webview (JSON-RPC: {id, m, a} → __rpc(id, ok, data); events → __ev(name, data)).
   Without a host (plain browser) mock.js answers instead, so the page can be developed and screenshot-tested anywhere. */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const native = !!(window.chrome && window.chrome.webview);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---- bridge ---- */
let seq = 0; const pend = {};
window.__rpc = (id, ok, data) => { const p = pend[id]; if (!p) return; delete pend[id]; ok ? p.res(data) : p.rej(new Error(data)); };
const listeners = {};
window.__ev = (n, d) => (listeners[n] || []).forEach(f => { try { f(d); } catch (e) { console.error(e); } });
const on = (n, f) => (listeners[n] = listeners[n] || []).push(f);
const api = (m, ...a) => new Promise((res, rej) => { const id = ++seq; pend[id] = { res, rej }; if (native) window.chrome.webview.postMessage(JSON.stringify({ id, m, a })); else window.__mock(id, m, a); });

/* ---- strings ---- */
const I18N = {
  en: {
    lang: 'فارسی', login_sub: 'Sign in with your fpsboost.ir account', username: 'Username', password: 'Password', login: 'Sign in', signing_in: 'Signing in…', no_account: 'Create an account', forgot: 'Forgot password?', logout: 'Log out',
    nav_home: 'Home', nav_fps: 'FPS Boost', nav_network: 'Network', nav_games: 'Games', nav_guard: 'Guard', nav_tools: 'Tools', nav_settings: 'Settings',
    hi: 'Hi, {u}', home_sub: 'Your PC at a glance', score: 'Boost score', tiles_active: 'Tweaks active', tiles_ping: 'Last ping', tiles_guard: 'Guard', never: 'not tested yet', no_reply: 'no reply', guard_idle: 'Watching', guard_off: 'Off', guard_nosub: 'No plan', guard_game: 'Boosting',
    boost_title: 'One-click boost', boost_sub: 'Applies every recommended FPS and network tweak. A restore point is created first; everything can be undone here.', boost_now: 'Boost now', boosting: 'Boosting…', restore_all: 'Restore everything', restore_sub: 'Puts back every original value.',
    this_pc: 'This PC', os: 'Windows', cpu: 'Processor', gpu: 'Graphics', ram: 'Memory', cores: 'Threads', activity: 'Activity', activity_empty: 'Nothing yet — apply a tweak or run a tool.',
    fps_title: 'FPS Boost', fps_sub: 'Windows settings that cost frames. Flip a switch to apply, flip it back to undo.', net_title: 'Network', net_sub: 'Lower ping and steadier connections for online games.', count: '{a} of {n} active', rec_count: '{a} of {n} recommended',
    apply_recommended: 'Apply recommended', revert_all: 'Restore', all: 'All', rec: 'Recommended', adv: 'Advanced', reboot: 'restart needed', applied: 'on', not_applied: 'off', unknown: 'unknown', checking: 'Checking your PC…', checking_short: 'checking…',
    games_title: 'Game presets', games_sub: 'One button per game: the tweaks that matter for it, plus in-game settings worth changing. The Guard recognises these games automatically.', optimize: 'Optimize', optimized: 'Optimized', preset_n: '{a} of {n} tweaks applied', tips: 'In-game tips',
    guard_title: 'Background Guard', guard_sub: 'Lives in the tray and works while you play: higher priority for the game, a 0.5 ms timer, free RAM, and your tweaks kept in place.', guard_log: 'Guard log', guard_empty: 'No events yet — start a game.', clean_now: 'Free RAM now', ram_title: 'Memory', ram_in_use: 'RAM in use', g_boosted: 'games boosted', g_freed: 'RAM freed', g_enforced: 'tweaks restored',
    g_state_off: 'Guard is off', g_state_off_s: 'Turn it on to boost games automatically.', g_state_idle: 'Watching for games', g_state_idle_s: 'The moment a game is in front, it gets priority, a fast timer and free RAM.', g_state_game: 'Boosting {g}', g_state_game_s: 'High priority · 0.5 ms timer · RAM cleaned', g_state_nosub: 'Guard needs an active plan', g_state_nosub_s: 'Renew on fpsboost.ir to keep the background boost.', since: 'since {t}',
    g_enable: 'Background Guard', g_enable_s: 'Master switch. Off = nothing runs in the background.', g_priority: 'Raise the game\'s CPU priority', g_priority_s: 'The game gets more CPU time than launchers, browsers and Discord. Restored when the game closes.', g_ram: 'Free RAM when a game starts', g_ram_s: 'Trims idle apps and purges the standby cache; also when memory runs low mid-game.', g_timer: '0.5 ms timer while playing', g_timer_s: 'Steadier frame pacing and lower input delay. Enable "global 0.5 ms timer" in FPS Boost → Advanced so it reaches the game on Windows 11.', g_enforce: 'Keep tweaks in place', g_enforce_s: 'Windows Update likes to turn Game DVR back on. The Guard re-applies anything you had on (checked every 30 min).', g_startup: 'Start with Windows', g_startup_s: 'Starts hidden in the tray at sign-in, no UAC prompt.',
    ping_title: 'Ping test', ping_sub: 'Run before and after the network tweaks (hosts separated by spaces).', ping_run: 'Run test', ping_ms: 'ms', ping_loss: 'lost', ping_timeout: 'no reply', ping_running: 'Testing…',
    tools_title: 'Tools', tools_sub: 'One-click fixes that need no undo.', run: 'Run', running: 'Running…',
    settings_title: 'Settings', settings_sub: 'Language, behaviour, updates and your account.', s_language: 'Language', s_language_sub: 'App language and direction.', s_lite: 'Lite mode', s_lite_sub: 'No shadows, gradients or animations — for very old or integrated graphics.', s_tray: 'Close to tray', s_tray_sub: 'The X button hides the app; the Guard keeps working. Exit from the tray icon.', s_account: 'Account', s_manage: 'Manage account', s_about: 'About', s_site: 'Open fpsboost.ir', s_version: 'Version', s_behaviour: 'Behaviour', s_appearance: 'Appearance',
    sub_plan: 'Plan', sub_active: 'active until {d}', sub_days: '{n} days left', sub_none: 'No active plan', sub_offline: 'offline · last check {d}', renew: 'Renew', buy: 'Buy a plan',
    need_sub: 'Your subscription is not active — buy a plan on fpsboost.ir to apply tweaks.', need_admin: 'Not running as administrator — right-click FPS Boost and choose "Run as administrator", otherwise tweaks will fail.', reboot_hint: 'Some changes need a Windows restart to take effect.',
    done: 'Done', applied_n: '{n} applied', reverted_n: '{n} restored', error: 'Error', restore_point_made: 'Restore point created', restore_point_skip: 'Today\'s restore point reused', restore_point_err: 'No restore point: {e}', freed: 'Freed {n}',
    log_apply: 'Applied: {t}', log_revert: 'Restored: {t}', log_preset: '{g} optimized ({n} tweaks)', log_tool: '{t}: {r}', log_boost: 'Boost: {n} tweaks applied', log_restore: 'Restore: {n} tweaks put back',
    win: 'Windows 10 / 11 · 64-bit', made: 'Made for gamers in Iran · fpsboost.ir',
    upd_title: 'Updates', upd_sub: 'New versions install over this one — no download page, no uninstall.', upd_auto: 'Download updates automatically and install when the app closes', upd_check: 'Check for updates', upd_checking: 'Checking…', upd_uptodate: 'You have the latest version', upd_available: 'Version {v} is available', upd_download: 'Download update', upd_downloading: 'Downloading {v}… {p}%', upd_ready: 'Version {v} is downloaded and ready', upd_install: 'Update now', upd_installing: 'Installing — the app will restart', upd_error: 'Update failed: {e}', upd_banner: 'FPS Boost {v} is ready to install.', upd_banner_avail: 'FPS Boost {v} is available.', upd_done: 'Updated to FPS Boost {v}',
    gb: 'GB', mb: 'MB',
  },
  fa: {
    lang: 'English', login_sub: 'با حساب fpsboost.ir وارد شوید', username: 'نام کاربری', password: 'رمز عبور', login: 'ورود', signing_in: 'در حال ورود…', no_account: 'ساخت حساب', forgot: 'رمز را فراموش کرده‌اید؟', logout: 'خروج',
    nav_home: 'خانه', nav_fps: 'افزایش FPS', nav_network: 'شبکه', nav_games: 'بازی‌ها', nav_guard: 'گارد', nav_tools: 'ابزارها', nav_settings: 'تنظیمات',
    hi: 'سلام، {u}', home_sub: 'وضعیت کامپیوتر شما در یک نگاه', score: 'امتیاز بوست', tiles_active: 'تنظیمات فعال', tiles_ping: 'آخرین پینگ', tiles_guard: 'گارد', never: 'هنوز تست نشده', no_reply: 'بدون پاسخ', guard_idle: 'در حال پایش', guard_off: 'خاموش', guard_nosub: 'بدون پلن', guard_game: 'در حال بوست',
    boost_title: 'بوست یک‌کلیکی', boost_sub: 'همهٔ تنظیمات پیشنهادی FPS و شبکه را اعمال می‌کند. اول یک نقطهٔ بازیابی ساخته می‌شود و همه‌چیز از همین‌جا قابل بازگشت است.', boost_now: 'بوست کن', boosting: 'در حال بوست…', restore_all: 'بازگشت همه', restore_sub: 'همهٔ مقدارهای اصلی را برمی‌گرداند.',
    this_pc: 'این کامپیوتر', os: 'ویندوز', cpu: 'پردازنده', gpu: 'گرافیک', ram: 'رم', cores: 'ترد', activity: 'فعالیت‌ها', activity_empty: 'هنوز چیزی نیست — یک تنظیم اعمال کنید یا ابزاری اجرا کنید.',
    fps_title: 'افزایش FPS', fps_sub: 'تنظیماتی از ویندوز که فریم می‌خورند. کلید را بزنید تا اعمال شود، برگردانید تا لغو شود.', net_title: 'شبکه', net_sub: 'پینگ کمتر و اتصال پایدارتر برای بازی آنلاین.', count: '{a} از {n} فعال', rec_count: '{a} از {n} پیشنهادی',
    apply_recommended: 'اعمال پیشنهادی', revert_all: 'بازگشت', all: 'همه', rec: 'پیشنهادی', adv: 'پیشرفته', reboot: 'نیاز به ریستارت', applied: 'روشن', not_applied: 'خاموش', unknown: 'نامشخص', checking: 'در حال بررسی سیستم…', checking_short: 'بررسی…',
    games_title: 'پریست بازی‌ها', games_sub: 'برای هر بازی یک دکمه: تنظیماتی که برایش مهم است، به‌همراه تنظیمات داخل بازی که ارزش تغییر دارند. گارد این بازی‌ها را خودکار می‌شناسد.', optimize: 'بهینه کن', optimized: 'بهینه شد', preset_n: '{a} از {n} تنظیم اعمال شده', tips: 'نکته‌های داخل بازی',
    guard_title: 'گارد پس‌زمینه', guard_sub: 'در تری می‌ماند و هنگام بازی کار می‌کند: اولویت بالاتر برای بازی، تایمر ۰٫۵ میلی‌ثانیه، آزادسازی رم و حفظ تنظیمات شما.', guard_log: 'گزارش گارد', guard_empty: 'هنوز رویدادی نیست — یک بازی اجرا کنید.', clean_now: 'آزادسازی رم', ram_title: 'حافظه', ram_in_use: 'رم در حال استفاده', g_boosted: 'بازی بوست شده', g_freed: 'رم آزاد شده', g_enforced: 'تنظیم برگردانده',
    g_state_off: 'گارد خاموش است', g_state_off_s: 'روشنش کنید تا بازی‌ها خودکار بوست شوند.', g_state_idle: 'در انتظار بازی', g_state_idle_s: 'همان لحظه که بازی جلو بیاید، اولویت، تایمر سریع و رم آزاد می‌گیرد.', g_state_game: 'در حال بوست {g}', g_state_game_s: 'اولویت بالا · تایمر ۰٫۵ms · رم پاک شد', g_state_nosub: 'گارد به پلن فعال نیاز دارد', g_state_nosub_s: 'برای ادامهٔ بوست پس‌زمینه از fpsboost.ir تمدید کنید.', since: 'از {t}',
    g_enable: 'گارد پس‌زمینه', g_enable_s: 'کلید اصلی. خاموش = هیچ‌چیز در پس‌زمینه اجرا نمی‌شود.', g_priority: 'افزایش اولویت CPU بازی', g_priority_s: 'بازی بیشتر از لانچرها، مرورگر و دیسکورد CPU می‌گیرد. با بسته شدن بازی برمی‌گردد.', g_ram: 'آزادسازی رم هنگام شروع بازی', g_ram_s: 'برنامه‌های بیکار را فشرده و کش standby را خالی می‌کند؛ وسط بازی هم اگر رم کم شود.', g_timer: 'تایمر ۰٫۵ میلی‌ثانیه هنگام بازی', g_timer_s: 'فریم‌پیسینگ پایدارتر و تأخیر ورودی کمتر. «تایمر سراسری ۰٫۵ms» را در افزایش FPS → پیشرفته روشن کنید تا در ویندوز ۱۱ به بازی برسد.', g_enforce: 'حفظ تنظیمات', g_enforce_s: 'آپدیت ویندوز دوست دارد Game DVR را دوباره روشن کند. گارد هر چیزی را که روشن داشتید دوباره اعمال می‌کند (هر ۳۰ دقیقه).', g_startup: 'اجرا با ویندوز', g_startup_s: 'هنگام ورود، پنهان در تری اجرا می‌شود؛ بدون پیام UAC.',
    ping_title: 'تست پینگ', ping_sub: 'قبل و بعد از تنظیمات شبکه اجرا کنید (آدرس‌ها با فاصله).', ping_run: 'اجرای تست', ping_ms: 'ms', ping_loss: 'گم‌شده', ping_timeout: 'بدون پاسخ', ping_running: 'در حال تست…',
    tools_title: 'ابزارها', tools_sub: 'رفع‌های یک‌کلیکی که نیاز به بازگشت ندارند.', run: 'اجرا', running: 'در حال اجرا…',
    settings_title: 'تنظیمات', settings_sub: 'زبان، رفتار، به‌روزرسانی و حساب شما.', s_language: 'زبان', s_language_sub: 'زبان و جهت برنامه.', s_lite: 'حالت سبک', s_lite_sub: 'بدون سایه، گرادیان و انیمیشن — برای گرافیک‌های خیلی قدیمی یا داخلی.', s_tray: 'بستن به تری', s_tray_sub: 'دکمهٔ ضربدر برنامه را پنهان می‌کند؛ گارد به کار ادامه می‌دهد. خروج از آیکون تری.', s_account: 'حساب', s_manage: 'مدیریت حساب', s_about: 'درباره', s_site: 'باز کردن fpsboost.ir', s_version: 'نسخه', s_behaviour: 'رفتار', s_appearance: 'ظاهر',
    sub_plan: 'پلن', sub_active: 'فعال تا {d}', sub_days: '{n} روز مانده', sub_none: 'پلن فعالی ندارید', sub_offline: 'آفلاین · آخرین بررسی {d}', renew: 'تمدید', buy: 'خرید پلن',
    need_sub: 'اشتراک شما فعال نیست — برای اعمال تنظیمات از fpsboost.ir پلن بخرید.', need_admin: 'برنامه با دسترسی مدیر اجرا نشده — روی FPS Boost راست‌کلیک و «Run as administrator» را بزنید، وگرنه تنظیمات اعمال نمی‌شوند.', reboot_hint: 'بعضی تغییرات برای اثر کردن به ریستارت ویندوز نیاز دارند.',
    done: 'انجام شد', applied_n: '{n} مورد اعمال شد', reverted_n: '{n} مورد برگشت', error: 'خطا', restore_point_made: 'نقطهٔ بازیابی ساخته شد', restore_point_skip: 'نقطهٔ بازیابی امروز از قبل هست', restore_point_err: 'نقطهٔ بازیابی ساخته نشد: {e}', freed: '{n} آزاد شد',
    log_apply: 'اعمال شد: {t}', log_revert: 'برگشت: {t}', log_preset: '{g} بهینه شد ({n} تنظیم)', log_tool: '{t}: {r}', log_boost: 'بوست: {n} تنظیم اعمال شد', log_restore: 'بازگشت: {n} تنظیم برگشت',
    win: 'ویندوز ۱۰ / ۱۱ · ۶۴ بیت', made: 'ساخته‌شده برای گیمرهای ایران · fpsboost.ir',
    upd_title: 'به‌روزرسانی', upd_sub: 'نسخه‌های جدید روی همین نسخه نصب می‌شوند — بدون صفحهٔ دانلود، بدون حذف برنامه.', upd_auto: 'دانلود خودکار به‌روزرسانی و نصب هنگام بستن برنامه', upd_check: 'بررسی به‌روزرسانی', upd_checking: 'در حال بررسی…', upd_uptodate: 'آخرین نسخه را دارید', upd_available: 'نسخهٔ {v} آماده است', upd_download: 'دانلود به‌روزرسانی', upd_downloading: 'در حال دانلود {v}… {p}٪', upd_ready: 'نسخهٔ {v} دانلود شده و آمادهٔ نصب است', upd_install: 'همین حالا به‌روز کن', upd_installing: 'در حال نصب — برنامه دوباره اجرا می‌شود', upd_error: 'به‌روزرسانی ناموفق: {e}', upd_banner: 'FPS Boost {v} آمادهٔ نصب است.', upd_banner_avail: 'FPS Boost {v} منتشر شده است.', upd_done: 'به FPS Boost {v} به‌روز شد',
    gb: 'GB', mb: 'MB',
  },
};
const ICONS = { game_dvr_off: 'eye-off', game_mode_on: 'pad', fse_off: 'monitor', mm_games_priority: 'layers', hags_on: 'gpu', mouse_accel_off: 'mouse', background_apps_off: 'layers', power_throttling_off: 'power', visual_fx_perf: 'monitor', game_bar_off: 'pad', telemetry_off: 'eye-off', widgets_off: 'layers', tips_off: 'info', win32_priority: 'cpu', power_plan_high: 'power', startup_delay_off: 'clock', menu_delay_off: 'zap', sticky_keys_off: 'keyboard', paging_executive_off: 'ram', timer_global: 'clock', core_parking_off: 'cpu', sysmain_off: 'ram', wsearch_off: 'eye-off', nagle_off: 'zap', network_throttling_off: 'wifi', qos_reserve_off: 'wifi', delivery_optimization_off: 'download', tcp_tuning: 'net', dns_fast: 'dns', wifi_power_max: 'wifi' };

/* ---- state ---- */
const S = { lang: 'en', page: 'home', info: {}, settings: {}, auth: {}, tweaks: null, presets: [], tools: [], guard: {}, upd: {}, system: {}, dns: [], filter: { fps: 'all', network: 'all' }, busy: new Set(), log: [], ping: null, live: false, max: false };
const t = (k, v) => { let s = (I18N[S.lang] || I18N.en)[k] ?? I18N.en[k] ?? k; if (v) for (const [a, b] of Object.entries(v)) s = s.replaceAll('{' + a + '}', b); return s; };
const tx = (o) => (o && (o[S.lang] || o.en)) || '';
const loc = () => S.lang === 'fa' ? 'fa-IR' : 'en-GB';
const fmtDate = (ms) => ms ? new Date(ms).toLocaleDateString(loc(), { year: 'numeric', month: 'short', day: 'numeric' }) : '';
const fmtTime = (ms) => new Date(ms).toLocaleTimeString(loc(), { hour: '2-digit', minute: '2-digit' });
const fmtMB = (mb) => mb >= 1024 ? (mb / 1024).toFixed(1) + ' ' + t('gb') : Math.round(mb) + ' ' + t('mb');
const num = (s) => `<bdi>${esc(s)}</bdi>`;
const titleOf = (id) => { const tw = (S.tweaks || []).find(x => x.id === id); return tw ? tx(tw.title) : id; };

/* ---- toast + log ---- */
let toastT;
function toast(msg, kind = '') { const el = $('#toast'); el.textContent = msg; el.className = 'toast show ' + kind; clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 3200); }
function addLog(text, kind = '') { S.log.unshift({ t: Date.now(), text, kind }); S.log = S.log.slice(0, 60); renderLog(); }
function renderLog() {
  const ul = $('#log'); if (!ul) return;
  ul.innerHTML = S.log.length ? S.log.map(l => `<li class="${l.kind}"><time>${fmtTime(l.t)}</time><span>${esc(l.text)}</span></li>`).join('') : `<li class="empty">${t('activity_empty')}</li>`;
}
function fail(e) {
  const m = e && e.message || String(e);
  if (/no active subscription/i.test(m)) { showBanner('sub'); toast(t('need_sub'), 'bad'); return; }
  toast(t('error') + ': ' + m, 'bad'); addLog(t('error') + ': ' + m, 'bad');
}

/* ---- language ---- */
function setLang(l, save = true) {
  S.lang = l === 'fa' ? 'fa' : 'en';
  document.documentElement.lang = S.lang; document.documentElement.dir = S.lang === 'fa' ? 'rtl' : 'ltr';
  document.documentElement.classList.toggle('fa', S.lang === 'fa');
  $$('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  $$('.lang').forEach(el => { el.textContent = t('lang'); });
  if (save) api('settings.set', { lang: S.lang }).then(s => { S.settings = s; }).catch(() => {});
  renderAll();
}
function applyLite() { document.documentElement.classList.toggle('lite', !!S.settings.lite); }

/* ---- navigation ---- */
function go(page) {
  S.page = page;
  $$('.nav-i').forEach(b => b.classList.toggle('on', b.dataset.page === page));
  $$('section[data-page]').forEach(s => { s.hidden = s.dataset.page !== page; });
  $('#content').scrollTop = 0;
}

/* ---- banners ---- */
function showBanner(kind) {
  const b = $('#banner'); if (!b) return;
  if (kind === 'none') { b.hidden = true; return; }
  b.hidden = false; b.className = 'banner' + (kind === 'admin' ? ' warn' : '');
  $('span', b).textContent = kind === 'admin' ? t('need_admin') : t('need_sub');
}
function renderBanner() {
  if (S.info.isAdmin === false) showBanner('admin');
  else if (S.auth.loggedIn && !S.auth.active) showBanner('sub');
  else showBanner('none');
}

/* ---- subscription card ---- */
function renderSub() {
  const c = $('#subcard'), a = S.auth; if (!c) return;
  const days = a.expires ? Math.max(0, Math.ceil((a.expires - Date.now()) / 864e5)) : 0;
  const pct = Math.min(100, Math.round(days / 30 * 100));
  c.className = 'subcard ' + (a.active ? (days <= 5 ? 'on warn' : 'on') : 'off');
  c.innerHTML = `<small>${t('sub_plan')}</small><b>${a.active ? t('sub_days', { n: days }) : t('sub_none')}</b>
    <span class="subcard-s">${a.active ? t('sub_active', { d: fmtDate(a.expires) }) : (a.offline ? t('sub_offline', { d: fmtDate(a.checked) }) : esc(a.username || ''))}</span>
    ${a.active ? `<div class="days"><i style="width:${pct}%"></i></div>` : ''}
    <button class="${a.active ? 'ghost' : 'pri'}" data-open="/account">${a.active ? t('renew') : t('buy')}</button>`;
  const u = $('#hi'); if (u) u.textContent = t('hi', { u: a.username || '' });
}

/* ---- home ---- */
function recStats() {
  const tw = S.tweaks || [];
  const rec = tw.filter(x => x.recommended), on = rec.filter(x => x.applied === true);
  return { rec: rec.length, on: on.length, all: tw.length, allOn: tw.filter(x => x.applied === true).length, pct: rec.length ? Math.round(on.length / rec.length * 100) : 0 };
}
function renderHome() {
  const st = recStats(), known = !!S.tweaks;
  const ring = $('#ringfg'); const score = $('#score');
  if (ring) { ring.style.strokeDashoffset = (326.7 * (1 - (known ? st.pct : 0) / 100)).toFixed(1); ring.closest('.score').classList.toggle('good', st.pct >= 80); }
  if (score) score.textContent = known ? st.pct : '–';
  $('#t-active').innerHTML = known ? num(`${st.allOn}/${st.all}`) : '–';
  $('#t-active').className = st.pct >= 80 ? 'ok' : st.pct >= 40 ? 'warn' : '';
  $('#t-active-s').textContent = known ? t('rec_count', { a: st.on, n: st.rec }) : t('checking_short');
  const p = S.ping; const bestPing = p && p.results ? p.results.map(r => r.avg).filter(v => v != null) : [];
  $('#t-ping').innerHTML = bestPing.length ? num(Math.min(...bestPing) + ' ms') : '–';
  $('#t-ping').className = bestPing.length ? (Math.min(...bestPing) < 50 ? 'ok' : Math.min(...bestPing) < 100 ? 'warn' : 'bad') : '';
  $('#t-ping-s').textContent = p && p.at ? fmtDate(p.at) + ' ' + fmtTime(p.at) : t('never');
  const g = S.guard || {};
  const gstate = !S.settings.guard ? 'off' : !S.auth.active ? 'nosub' : g.game ? 'game' : 'idle';
  $('#t-guard').textContent = { off: t('guard_off'), nosub: t('guard_nosub'), game: t('guard_game'), idle: t('guard_idle') }[gstate];
  $('#t-guard').className = { off: '', nosub: 'warn', game: 'acc', idle: 'ok' }[gstate];
  $('#t-guard-s').textContent = g.game || (g.boosted ? t('g_boosted') + ': ' + g.boosted : '');
  const boost = $('#boost'); boost.classList.toggle('ready', known && st.pct < 100 && !S.busy.has('boost'));
  const info = S.system || {};
  $('#pcinfo').innerHTML = [[t('os'), info.os], [t('cpu'), info.cpu], [t('gpu'), info.gpu], [t('ram'), info.ramGb ? num(info.ramGb + ' GB') : ''], [t('cores'), info.cores ? num(info.cores) : '']].filter(x => x[1]).map(([k, v]) => `<dt>${k}</dt><dd title="${esc(v)}">${v}</dd>`).join('');
  $('#sysline').textContent = [info.cpu, info.gpu].filter(Boolean).join(' · ') || t('home_sub');
  renderGuard();
  renderLog();
}

/* ---- guard ---- */
function renderGuard() {
  const g = S.guard || {}, on = !!S.settings.guard, sub = !!S.auth.active;
  const mode = !on ? 'off' : !sub ? 'nosub' : g.game ? 'game' : 'idle';
  // title bar chip + nav dot
  const chip = $('#tbguard'); chip.hidden = !on || !S.auth.loggedIn; chip.className = 'tb-c ' + (mode === 'game' ? 'game' : mode === 'idle' ? '' : 'idle');
  $('span', chip).textContent = mode === 'game' ? t('g_state_game', { g: g.game }) : mode === 'idle' ? t('g_state_idle') : mode === 'nosub' ? t('g_state_nosub') : t('g_state_off');
  const dot = $('#cnt-guard'); dot.textContent = on && sub ? '•' : ''; dot.classList.toggle('game', mode === 'game');
  // home card
  const pill = $('#gpill'); pill.className = 'pill ' + ({ off: 'off', nosub: 'off', game: 'live', idle: 'ok' }[mode]); pill.textContent = { off: t('guard_off'), nosub: t('guard_nosub'), game: t('guard_game'), idle: t('guard_idle') }[mode];
  const gs = $('#gstate'); gs.className = 'gstate ' + (mode === 'game' ? 'game' : mode === 'idle' ? 'on' : '');
  gs.innerHTML = `<div class="gi"><svg><use href="#i-${mode === 'game' ? 'play' : mode === 'idle' ? 'shield' : 'power'}"/></svg></div><div><b>${esc(t('g_state_' + mode, { g: g.game || '' }))}</b><small>${esc(mode === 'game' && g.since ? t('since', { t: fmtTime(g.since) }) + ' · ' + t('g_state_game_s') : t('g_state_' + mode + '_s'))}</small></div>`;
  const used = g.totalMb ? g.totalMb - g.availMb : 0, pct = g.totalMb ? Math.round(used / g.totalMb * 100) : 0;
  for (const sfx of ['', '2']) {
    const txt = $('#ramtxt' + sfx), bar = $('#rambar' + sfx); if (!txt) continue;
    txt.innerHTML = g.totalMb ? num(`${fmtMB(used)} / ${fmtMB(g.totalMb)} · ${pct}%`) : '–';
    bar.style.width = pct + '%'; bar.className = pct >= 90 ? 'bad' : pct >= 75 ? 'warn' : '';
  }
  for (const [pre, sel] of [['g-', ''], ['g2-', '']]) {
    $('#' + pre + 'boosted').innerHTML = num(g.boosted || 0); $('#' + pre + 'freed').innerHTML = num(fmtMB(g.freedMb || 0)); $('#' + pre + 'enforced').innerHTML = num(g.enforced || 0);
  }
  // guard page
  const big = $('#gbig'); big.className = 'card gbig ' + (mode === 'game' ? 'game' : mode === 'idle' ? 'on' : '');
  big.innerHTML = `<div class="orb"><svg><use href="#i-${mode === 'game' ? 'play' : mode === 'idle' ? 'shield' : 'power'}"/></svg></div><div><b>${esc(t('g_state_' + mode, { g: g.game || '' }))}</b><p>${esc(t('g_state_' + mode + '_s'))}</p>${mode === 'game' && g.since ? `<div class="since">${esc(t('since', { t: fmtTime(g.since) }))} · <bdi>${esc(g.gameExe || '')}</bdi></div>` : ''}</div>`;
  const s = S.settings;
  const row = (key, icon, title, sub, checked, disabled) => `<div class="srow"><div><h4><svg><use href="#i-${icon}"/></svg>${t(title)}</h4><p class="muted">${t(sub)}</p></div><label class="sw"><input type="checkbox" data-set="${key}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}><i></i></label></div>`;
  $('#guardset').innerHTML = row('guard', 'shield', 'g_enable', 'g_enable_s', s.guard) + row('guardPriority', 'cpu', 'g_priority', 'g_priority_s', s.guardPriority, !s.guard) + row('guardRam', 'ram', 'g_ram', 'g_ram_s', s.guardRam, !s.guard) + row('guardTimer', 'clock', 'g_timer', 'g_timer_s', s.guardTimer, !s.guard) + row('guardEnforce', 'refresh', 'g_enforce', 'g_enforce_s', s.guardEnforce, !s.guard) + row('startup', 'power', 'g_startup', 'g_startup_s', s.startup);
  const ul = $('#glog');
  ul.innerHTML = (g.events || []).length ? g.events.map(e => `<li class="${esc(e.kind)}"><time>${fmtTime(e.at)}</time><i class="k"></i><span>${esc(S.lang === 'fa' ? (e.fa || e.text) : e.text)}</span></li>`).join('') : `<li class="empty">${t('guard_empty')}</li>`;
  $('#cleannow').disabled = !sub;
}

/* ---- tweak lists ---- */
function renderList(cat) {
  const box = $('#list-' + cat); if (!box) return;
  if (!S.tweaks) { box.innerHTML = `<p class="wait">${t('checking')}</p>`; $('#' + cat + '-count').textContent = ''; return; }
  const f = S.filter[cat];
  const rows = S.tweaks.filter(x => x.category === cat);
  const shown = rows.filter(x => f === 'all' || (f === 'rec' ? x.recommended : !x.recommended));
  box.innerHTML = shown.map(tw => {
    const on = tw.applied === true, unknown = tw.applied == null, busy = S.busy.has(tw.id);
    const opts = tw.options ? `<select data-opt="${tw.id}" ${on || busy ? 'disabled' : ''}>${(S.dns.length ? S.dns : Object.keys(tw.options)).filter(k => tw.options[k]).map(k => `<option value="${k}" ${k === (tw.defaultOption || '') ? 'selected' : ''}>${esc(tw.options[k])}</option>`).join('')}</select>` : '';
    return `<div class="tw ${on ? 'on' : ''} ${busy ? 'busy' : ''} ${unknown ? 'unknown' : ''}" data-id="${tw.id}">
      <div class="tw-ic"><svg><use href="#i-${ICONS[tw.id] || (cat === 'fps' ? 'bolt' : 'wifi')}"/></svg></div>
      <div class="tw-b"><h4>${esc(tx(tw.title))} ${tw.recommended ? `<span class="tag rec">${t('rec')}</span>` : `<span class="tag adv">${t('adv')}</span>`}${tw.reboot ? `<span class="tag reboot">${t('reboot')}</span>` : ''}</h4><p>${esc(tx(tw.desc))}</p></div>
      <div class="tw-c">${opts}<span class="st ${tw.error ? 'err' : ''}" title="${esc(tw.error || '')}">${busy ? '…' : tw.error ? t('error') : unknown ? t('unknown') : on ? t('applied') : t('not_applied')}</span><label class="sw"><input type="checkbox" data-tw="${tw.id}" ${on ? 'checked' : ''} ${busy || !S.live && unknown ? 'disabled' : ''}><i></i></label></div>
    </div>`;
  }).join('');
  const onN = rows.filter(x => x.applied === true).length;
  $('#' + cat + '-count').textContent = t('count', { a: onN, n: rows.length });
  $('#cnt-' + cat).textContent = `${onN}/${rows.length}`;
  box.classList.toggle('wait', !S.live);
}
function renderLists() { renderList('fps'); renderList('network'); }

async function toggleTweak(id, want) {
  const tw = (S.tweaks || []).find(x => x.id === id); if (!tw || S.busy.has(id)) return;
  S.busy.add(id); renderList(tw.category);
  try {
    const sel = $(`select[data-opt="${id}"]`);
    const r = await api(want ? 'tweaks.apply' : 'tweaks.revert', id, want && sel ? sel.value : undefined);
    if (r.error) throw new Error(r.error);
    tw.applied = r.applied; tw.hasBackup = !!want; tw.error = '';
    addLog(t(want ? 'log_apply' : 'log_revert', { t: tx(tw.title) }), 'ok');
    if (r.reboot && want) toast(t('reboot_hint'));
  } catch (e) { fail(e); }
  S.busy.delete(id); renderList(tw.category); renderHome(); renderGames();
}

/* ---- progress bar for batch operations ---- */
function progress(done, total) { const p = $('#prog'); if (!total) { p.hidden = true; return; } p.hidden = false; $('i', p).style.width = Math.round(done / total * 100) + '%'; if (done >= total) setTimeout(() => { p.hidden = true; $('i', p).style.width = '0'; }, 600); }
on('progress', (d) => progress(d.done, d.total));

async function batch(key, method, arg, logKey, btn) {
  if (S.busy.has(key)) return;
  S.busy.add(key); if (btn) { btn.disabled = true; } renderHome();
  try {
    const res = await api(method, arg);
    const ok = res.filter(r => !r.error);
    const bad = res.filter(r => r.error);
    toast(t(logKey === 'log_restore' ? 'reverted_n' : 'applied_n', { n: ok.length }) + (bad.length ? ` · ${bad.length} ${t('error').toLowerCase()}` : ''), bad.length ? 'bad' : 'ok');
    addLog(t(logKey, { n: ok.length, g: arg }), bad.length ? 'bad' : 'ok');
    bad.forEach(r => addLog(`${titleOf(r.id)}: ${r.error}`, 'bad'));
    if (ok.some(r => r.reboot) && logKey !== 'log_restore') toast(t('reboot_hint'));
    await refreshState();
  } catch (e) { fail(e); }
  S.busy.delete(key); if (btn) btn.disabled = false; progress(0, 0); renderHome();
}

/* ---- games ---- */
function renderGames() {
  const box = $('#games'); if (!box) return;
  box.innerHTML = S.presets.map(p => {
    const list = p.tweaks.map(id => (S.tweaks || []).find(x => x.id === id)).filter(Boolean);
    const onN = list.filter(x => x.applied === true).length, all = S.tweaks && onN === p.tweaks.length, busy = S.busy.has('preset:' + p.id);
    return `<div class="g ${all ? 'on' : ''}" data-preset="${p.id}">
      <div class="g-h"><img src="assets/games/${esc(p.icon)}" alt=""><div><h4>${esc(p.name)}</h4><small>${S.tweaks ? t('preset_n', { a: onN, n: p.tweaks.length }) : t('checking_short')}</small></div></div>
      <div class="bar"><i style="width:${S.tweaks ? Math.round(onN / p.tweaks.length * 100) : 0}%"></i></div>
      <div class="g-a"><button class="pri" data-opt-preset="${p.id}" ${busy || !S.tweaks ? 'disabled' : ''}>${busy ? '…' : all ? `<svg><use href="#i-check"/></svg>${t('optimized')}` : t('optimize')}</button></div>
      <details><summary><svg><use href="#i-chev"/></svg>${t('tips')}</summary><ul>${p.tips.map(x => `<li>${esc(tx(x))}</li>`).join('')}</ul></details>
    </div>`;
  }).join('');
}

/* ---- tools ---- */
const toolRes = {};
function renderTools() {
  $('#tools').innerHTML = S.tools.map(a => `<div class="tool" data-tool="${a.id}"><div class="tw-ic"><svg><use href="#i-${esc(a.icon || 'tool')}"/></svg></div><div><h4>${esc(tx(a.title))}${a.reboot ? ` <span class="tag reboot">${t('reboot')}</span>` : ''}</h4><p>${esc(tx(a.desc))}</p>
    <div class="ta"><button class="pri sm" data-run="${a.id}" ${S.busy.has('tool:' + a.id) ? 'disabled' : ''}>${S.busy.has('tool:' + a.id) ? t('running') : t('run')}</button><span class="res ${toolRes[a.id] ? toolRes[a.id].kind : ''}">${esc(toolRes[a.id] ? toolRes[a.id].text : '')}</span></div></div></div>`).join('');
}
async function runTool(id) {
  const a = S.tools.find(x => x.id === id); if (!a || S.busy.has('tool:' + id)) return;
  S.busy.add('tool:' + id); renderTools();
  try {
    const r = await api('tools.action', id);
    toolRes[id] = { kind: 'ok', text: tx(r.message) }; addLog(t('log_tool', { t: tx(a.title), r: tx(r.message) }), 'ok');
    if (r.reboot) toast(t('reboot_hint'));
  } catch (e) { toolRes[id] = { kind: 'err', text: e.message }; fail(e); }
  S.busy.delete('tool:' + id); renderTools();
}

/* ---- ping ---- */
function renderPing() {
  const box = $('#pingr'); const p = S.ping;
  box.innerHTML = p && p.results ? p.results.map(r => `<div class="pr"><span title="${esc(r.host)}">${esc(r.host)}</span><b class="${r.avg == null ? 'bad' : r.avg < 50 ? 'ok' : r.avg < 100 ? 'warn' : 'bad'}">${r.avg == null ? t('ping_timeout') : num(r.avg + ' ' + t('ping_ms'))}</b>${r.loss ? `<small>${num(r.loss + '/4')} ${t('ping_loss')}</small>` : (r.avg != null ? `<small>${num(r.min + '–' + r.max)}</small>` : '')}</div>`).join('') : '';
}
async function runPing() {
  const btn = $('#pingbtn'); if (btn.disabled) return;
  btn.disabled = true; btn.textContent = t('ping_running');
  try { const res = await api('tools.ping', $('#pinghosts').value.split(/\s+/).filter(Boolean)); S.ping = { at: Date.now(), results: res }; renderPing(); renderHome(); }
  catch (e) { fail(e); }
  btn.disabled = false; btn.textContent = t('ping_run');
}

/* ---- settings ---- */
function renderSettings() {
  const s = S.settings, a = S.auth, u = S.upd || {};
  const sw = (key, title, sub, checked) => `<div class="srow"><div><h4>${t(title)}</h4><p class="muted">${t(sub)}</p></div><label class="sw"><input type="checkbox" data-set="${key}" ${checked ? 'checked' : ''}><i></i></label></div>`;
  $('#settings').innerHTML = `
    <div class="sh">${t('s_appearance')}</div>
    <div class="card set">
      <div class="srow"><div><h4>${t('s_language')}</h4><p class="muted">${t('s_language_sub')}</p></div><div class="lrow"><button class="${S.lang === 'en' ? 'on' : ''}" data-lang="en">English</button><button class="${S.lang === 'fa' ? 'on' : ''}" data-lang="fa">فارسی</button></div></div>
      ${sw('lite', 's_lite', 's_lite_sub', s.lite)}
    </div>
    <div class="sh">${t('s_behaviour')}</div>
    <div class="card set">
      ${sw('closeToTray', 's_tray', 's_tray_sub', s.closeToTray)}
      ${sw('startup', 'g_startup', 'g_startup_s', s.startup)}
    </div>
    <div class="sh">${t('upd_title')}</div>
    <div class="card set">
      <div class="srow"><div><h4>${t('upd_title')}</h4><p class="muted">${t('upd_sub')}</p></div></div>
      ${sw('autoUpdate', 'upd_auto', 'upd_sub', s.autoUpdate)}
      <div class="srow"><div class="upd" id="updrow"></div></div>
    </div>
    <div class="sh">${t('s_account')}</div>
    <div class="card set">
      <div class="srow"><div><h4>${esc(a.username || '')}</h4><p class="muted">${a.active ? t('sub_active', { d: fmtDate(a.expires) }) : t('sub_none')}${a.offline ? ' · ' + t('sub_offline', { d: fmtDate(a.checked) }) : ''}</p></div><div class="lrow"><button class="ghost sm" data-open="/account"><svg><use href="#i-ext"/></svg>${t('s_manage')}</button><button class="ghost sm" id="logout"><svg><use href="#i-logout"/></svg>${t('logout')}</button></div></div>
    </div>
    <div class="sh">${t('s_about')}</div>
    <div class="card"><div class="about"><img src="assets/logo.png" alt=""><div><b>FPS Boost <bdi>${esc(S.info.version || '')}</bdi></b><span class="muted">${t('win')} · ${t('made')}</span></div><button class="ghost sm" data-open="/"><svg><use href="#i-globe"/></svg>${t('s_site')}</button></div></div>`;
  renderUpdate();
}
function renderUpdate() {
  const u = S.upd || {}, row = $('#updrow'); if (!row) return;
  const v = u.latest || '';
  const text = { idle: t('upd_check'), checking: t('upd_checking'), uptodate: t('upd_uptodate'), available: t('upd_available', { v }), downloading: t('upd_downloading', { v, p: u.progress || 0 }), ready: t('upd_ready', { v }), installing: t('upd_installing'), error: t('upd_error', { e: u.error || '' }) }[u.status] || '';
  let btn = '';
  if (u.status === 'available' || u.status === 'error') btn = `<button class="pri sm" data-upd="download">${t('upd_download')}</button>`;
  if (u.status === 'ready') btn = `<button class="pri sm" data-upd="install">${t('upd_install')}</button>`;
  if (u.status === 'idle' || u.status === 'uptodate' || u.status === 'error') btn += ` <button class="ghost sm" data-upd="check">${t('upd_check')}</button>`;
  row.innerHTML = `<span class="muted">${esc(text)}</span>${u.status === 'downloading' ? `<div class="bar uprog"><i style="width:${u.progress || 0}%"></i></div>` : ''}${btn}`;
  const ub = $('#ubanner');
  if (u.status === 'ready' || u.status === 'available') { ub.hidden = false; $('#ubanner-t').textContent = t(u.status === 'ready' ? 'upd_banner' : 'upd_banner_avail', { v }); $('#ubanner-b').textContent = t(u.status === 'ready' ? 'upd_install' : 'upd_download'); $('#ubanner-b').dataset.upd = u.status === 'ready' ? 'install' : 'download'; }
  else ub.hidden = true;
}

function renderAll() {
  $('#tbver').textContent = S.info.version ? 'v' + S.info.version : '';
  $('#version1').textContent = S.info.version ? 'v' + S.info.version : '';
  renderSub(); renderBanner(); renderHome(); renderLists(); renderGames(); renderTools(); renderSettings(); renderPing();
}

/* ---- data refresh ---- */
async function refreshState() {
  try { const st = await api('tweaks.state'); if (st) applyState(st); } catch (e) { console.error(e); }
}
function applyState(st) { S.tweaks = st; S.live = true; renderLists(); renderHome(); renderGames(); }
on('state', applyState);
on('auth', (a) => { S.auth = a; renderSub(); renderBanner(); renderHome(); renderSettings(); });
on('guard', (g) => { S.guard = g; renderGuard(); renderHome(); });
on('update', (u) => { S.upd = u; renderUpdate(); });
on('settings', (s) => { S.settings = s; applyLite(); renderGuard(); renderSettings(); });
on('win', (w) => { S.max = !!w.max; $('#maxico use').setAttribute('href', S.max ? '#i-restore' : '#i-max'); });
on('restore', (r) => { if (r.status === 'created') toast(t('restore_point_made'), 'ok'); else if (r.status === 'skipped') toast(t('restore_point_skip')); else toast(t('restore_point_err', { e: r.error || '' }), 'bad'); });

/* ---- events ---- */
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-page],[data-win],[data-open],.lang,[data-rec],[data-revert],.chip,[data-opt-preset],[data-run],[data-lang],[data-upd],#boost,#unboost,#pingbtn,#logout,#cleannow');
  if (!el) return;
  if (el.dataset.page) go(el.dataset.page);
  else if (el.dataset.win) api('app.win', el.dataset.win);
  else if (el.dataset.open !== undefined) { e.preventDefault(); api('app.open', (S.info.serverUrl || 'https://fpsboost.ir') + (el.dataset.open === '/' ? '' : el.dataset.open)); }
  else if (el.classList.contains('lang')) { e.preventDefault(); setLang(S.lang === 'fa' ? 'en' : 'fa'); }
  else if (el.dataset.lang) setLang(el.dataset.lang);
  else if (el.dataset.rec) batch('rec:' + el.dataset.rec, 'tweaks.applyRecommended', el.dataset.rec, 'log_boost', el);
  else if (el.dataset.revert) batch('revert:' + el.dataset.revert, 'tweaks.revertAll', el.dataset.revert, 'log_restore', el);
  else if (el.classList.contains('chip')) { const cat = el.closest('.chips').dataset.filterFor; S.filter[cat] = el.dataset.f; $$('.chip', el.parentElement).forEach(c => c.classList.toggle('on', c === el)); renderList(cat); }
  else if (el.dataset.optPreset) { const id = el.dataset.optPreset; S.busy.add('preset:' + id); renderGames(); batch('preset:' + id, 'presets.apply', id, 'log_preset', null).then(() => { S.busy.delete('preset:' + id); renderGames(); }); }
  else if (el.dataset.run) runTool(el.dataset.run);
  else if (el.dataset.upd) { const act = el.dataset.upd; api('update.' + act).then(u => { if (act !== 'install') { S.upd = u; renderUpdate(); } }).catch(fail); }
  else if (el.id === 'boost') batch('boost', 'tweaks.applyRecommended', '', 'log_boost', el);
  else if (el.id === 'unboost') batch('unboost', 'tweaks.revertAll', '', 'log_restore', el);
  else if (el.id === 'pingbtn') runPing();
  else if (el.id === 'logout') api('auth.logout').then(a => { S.auth = a; showLogin(); });
  else if (el.id === 'cleannow') { el.disabled = true; api('guard.clean').then(r => { toast(t('freed', { n: fmtMB(r.mb || 0) }), 'ok'); addLog(t('freed', { n: fmtMB(r.mb || 0) }), 'ok'); }).catch(fail).finally(() => { el.disabled = !S.auth.active; }); }
});
document.addEventListener('change', (e) => {
  const tw = e.target.closest('input[data-tw]'); if (tw) { toggleTweak(tw.dataset.tw, tw.checked); return; }
  const st = e.target.closest('input[data-set]'); if (st) { const patch = {}; patch[st.dataset.set] = st.checked; api('settings.set', patch).then(s => { S.settings = s; applyLite(); renderGuard(); renderSettings(); renderHome(); }).catch(fail); }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'pinghosts') runPing(); });
// title bar: drag + double-click fallbacks for runtimes without app-region support (the host swallows them otherwise)
$('#tb').addEventListener('mousedown', (e) => { if (e.button === 0 && !e.target.closest('button')) api('app.win', 'drag'); });
$('#tb').addEventListener('dblclick', (e) => { if (!e.target.closest('button')) api('app.win', 'max'); });

/* ---- login ---- */
function showLogin() { $('#main').hidden = true; $('#login').hidden = false; $('#tbguard').hidden = true; $('#lerr').textContent = ''; setTimeout(() => $('#lu').focus(), 50); }
async function showMain() {
  $('#login').hidden = true; $('#main').hidden = false;
  renderAll();
  // the server + the slow live check happen after the first paint
  api('auth.status').then(a => { S.auth = a; renderSub(); renderBanner(); renderHome(); renderSettings(); if (!a.loggedIn) showLogin(); }).catch(() => {});
  refreshState();
}
$('#loginform').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#lbtn'); btn.disabled = true; $('span', btn).textContent = t('signing_in'); $('#lerr').textContent = '';
  try { S.auth = await api('auth.login', $('#lu').value.trim(), $('#lp').value); $('#lp').value = ''; await showMain(); }
  catch (err) { $('#lerr').textContent = err.message; }
  btn.disabled = false; $('span', btn).textContent = t('login');
});

/* ---- boot ---- */
(async () => {
  if (!native) await new Promise(r => { const s = document.createElement('script'); s.src = 'mock.js'; s.onload = r; document.head.appendChild(s); });
  const b = await api('app.boot');
  Object.assign(S, { info: b.info || {}, settings: b.settings || {}, auth: b.auth || {}, tweaks: b.state || null, presets: b.presets || [], tools: b.tools || [], guard: b.guard || {}, upd: b.update || {}, system: b.system || {}, dns: b.dns || [] });
  try { S.ping = S.settings.lastPing ? JSON.parse(S.settings.lastPing) : null; } catch (e) { S.ping = null; }
  if (S.ping && !S.ping.results) S.ping = null;
  $('#pinghosts').value = (S.info.pingHosts || []).join(' ');
  applyLite();
  setLang(S.settings.lang || (navigator.language.startsWith('fa') ? 'fa' : 'en'), false);
  const q = new URLSearchParams(location.search); if (q.get('page')) go(q.get('page'));
  if (S.auth.loggedIn) await showMain(); else showLogin();
  if (S.info.updated) toast(t('upd_done', { v: S.info.version || '' }), 'ok');
})();
})();
