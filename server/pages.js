/* ============================================================
   fpsboost.ir — every HTML page. Dark violet theme (spotlight beams, glass cards, gradient headings) with a handful of
   scroll effects: word-by-word heading reveal, floating tokens + particle field in the hero, the tilted app mock-up that
   straightens as you scroll, a scroll-driven marquee band, count-up stats, cursor glow on the module cards, section reveal.
   Persian (RTL) + English. Everything inline (one Worker), scripts/styles carry the per-request CSP nonce.
   Reduced motion: every effect renders in its final state, nothing is skipped or hidden.
   ============================================================ */

export const STR = {
  en: {
    home: 'Home', nav_features: 'Features', nav_games: 'Games', nav_plans: 'Plans', nav_faq: 'FAQ', nav_how: 'How it works',
    hero_pill: 'Windows 10 / 11 · one click · full undo', scroll_hint: 'Scroll to explore',
    rep_pill: 'Why it works', rep_h: 'Stop losing frames to Windows.', rep_sub: 'Background recording, telemetry, the Balanced power plan and a dozen services you never asked for eat frames and add latency. FPS Boost turns them off in one pass — and back on whenever you want.', rep_word: 'Higher FPS',
    marquee2: ['Let’s boost', 'Lower ping', 'Higher FPS', 'One click'], ba_pill: 'Before / after', ba_h: 'Same PC. Same game.', ba_before: 'BEFORE', ba_after: 'AFTER', ba_cap: 'One pass of “Apply recommended”. Your numbers depend on your PC and the game — these are from our test machine.', restore_ok: 'System Restore point created', compare: 'Compare plans', cmp_pcs: 'PCs per account', cmp_pm: 'Per month (Toman)',
    h1a: 'Lower ping.', h1b: 'Higher FPS.', h1c: 'One click.',
    lead: 'A Windows app that applies the proven PC, network, Windows and per-game tweaks for you — with a backup of every change and a one-click undo — so your games run smoother and your connection reacts faster.',
    download: 'Download for Windows', download_short: 'Download', register: 'Create account', login: 'Log in', logout: 'Log out', account: 'My account', get_started: 'Get started',
    tok1: '+FPS', tok2: '−ms ping', tok3: 'Game DVR off', tok4: 'DNS 1.1.1.1', tok5: 'Nagle off', tok6: 'Ultimate power plan', tok7: '1% lows ↑', tok8: 'GPU scheduling',
    st1: 'tweaks', st2: 'modules', st3: 'game presets', st4: 'undo — every change is backed up',
    marquee: ['PC optimization', 'Network optimization', 'Windows optimization', 'Game presets'],
    feat_pill: 'Features', feat_h: 'Four modules. One button.', feat_sub: 'Pick a module or press “Apply recommended” and let the app do the safe set for you. Everything can be reverted from the same screen.',
    m1: 'PC optimization', m1d: 'Ultimate power plan, GPU hardware scheduling, fullscreen optimizations, mouse acceleration, background apps, visual effects.',
    m2: 'Network optimization', m2d: 'Nagle off, TCP tuning, network throttling index, QoS reserve, fast DNS (Cloudflare / Shecan / 403 / Electro), flush & Winsock reset.',
    m3: 'Windows optimization', m3d: 'Game DVR & Game Bar, Xbox services, telemetry, startup apps, temp files, notifications and the other things Windows runs while you play.',
    m4: 'Game optimizations', m4d: 'Presets per game — launch options, config values and the process priority that fits each title. Minecraft, Valorant, CS2 and more.',
    games_pill: 'Game presets', games_h: 'One preset per game.', games_sub: 'Each preset bundles the tweaks that matter for that title. Apply it before you play, revert it when you are done.',
    g_mc: 'JVM flags, RAM allocation, priority', g_val: 'Raw input, priority, network', g_cs2: 'Launch options, priority', g_fn: 'Priority, Game Mode', g_apex: 'Launch options, network', g_wz: 'Priority, shader cache', g_rbx: 'Priority, background apps', g_gta: 'Priority, Game Mode',
    how_pill: 'How it works', how_h: 'Up and running in three steps.', how_sub: 'No settings to study. The app does the work and keeps a way back.',
    how1: 'Create an account and pick a plan', how1d: 'Your username works on the website and inside the app, on up to {n} PCs.',
    how2: 'Download the app and log in', how2d: 'A small installer for Windows 10 / 11. It asks for administrator rights because it changes Windows settings.',
    how3: 'Press “Apply recommended”', how3d: 'A System Restore point is created first. Every change is backed up and can be undone with one click.',
    step: 'Step', pricing: 'Plans', plans_h: 'Simple plans.', plans_sub: 'One account, up to {n} PCs. Cancel any time — nothing renews by itself.', popular: 'Most popular',
    month: 'month', months: 'months', toman: 'Toman', buy: 'Buy', per_month: '/ month',
    p1: 'All four modules', p2: 'Game presets', p3: 'One-click undo + System Restore point', p4: 'Updates during the subscription',
    faq_pill: 'FAQ', faq_h: 'Questions, answered.',
    faq: [
      ['Is it safe? What if something breaks?', 'Every change is backed up before it is applied and can be reverted from the app with one click. Before “Apply recommended” the app also creates a Windows System Restore point.'],
      ['Will it really raise my FPS?', 'It removes the things that cost frames — background recording, the balanced power plan, unneeded services — and sets the options that help. How much you gain depends on your PC and the game; there is no magic.'],
      ['Why does Windows show a SmartScreen warning?', 'The installer is not code-signed yet, so Windows warns about it. Click “More info” → “Run anyway”. The download always comes from our GitHub releases page.'],
      ['How many PCs can I use?', 'Up to {n} PCs per account at the same time. You can reset your devices from your account page if you change your PC.'],
      ['Does it need an internet connection?', 'Only to log in and to check the subscription once a day. It keeps working for 7 days offline.'],
      ['Can I get a refund?', 'If the app does not run on your PC and support cannot fix it, you get the money back within 7 days of the purchase.'],
    ],
    cta_h: 'Ready when you are.', cta_sub: 'Create an account, download the app, press one button.',
    f_product: 'Product', f_account: 'Account', f_legal: 'Legal & support', terms: 'Terms & refunds', support: 'Support', rights: 'All rights reserved.',
    username: 'Username', password: 'Password', subscription: 'Subscription', active_until: 'Active until', expired: 'Expired', no_sub: 'No active subscription',
    devices: 'Devices', devices_hint: 'The app works on up to {n} PCs per account. Reset if you changed your PC.', reset_devices: 'Reset devices', payments: 'Payments', none: 'none yet',
    pay_success: 'Payment received — your subscription is active.', pay_failed: 'Payment was not completed.', pay_unknown: 'Unknown payment.', ref: 'Tracking code', back_account: 'Back to my account',
    err_username: 'Username: 3–20 letters, digits or _', err_password: 'Password: at least 8 characters', err_taken: 'That username is taken', err_login: 'Wrong username or password', err_disabled: 'This account is disabled',
    err_braked: 'Too many attempts — wait 10 minutes', err_plan: 'Unknown plan', err_gateway: 'Payment gateway is not available right now', err_csrf: 'The form came from another site — please try again from fpsboost.ir.',
    status: 'Status', date: 'Date', amount: 'Amount', plan: 'Plan',
    have_account: 'Already have an account?', no_account: 'No account yet?', welcome_back: 'Welcome back.', create_h: 'Create your account.', auth_note: 'The same username and password work inside the app.',
    lang: 'فارسی',
  },
  fa: {
    home: 'خانه', nav_features: 'امکانات', nav_games: 'بازی‌ها', nav_plans: 'اشتراک', nav_faq: 'سوالات', nav_how: 'نحوهٔ کار',
    hero_pill: 'ویندوز ۱۰ / ۱۱ · یک کلیک · بازگشت کامل', scroll_hint: 'اسکرول کنید',
    rep_pill: 'چرا جواب می‌دهد', rep_h: 'فریم‌هایتان را به ویندوز نبازید.', rep_sub: 'ضبط پس‌زمینه، تله‌متری، پاور پلن Balanced و ده‌ها سرویسی که هرگز نخواستید فریم می‌خورند و تأخیر اضافه می‌کنند. FPS Boost همه را در یک مرحله خاموش می‌کند — و هر وقت خواستید، برمی‌گرداند.', rep_word: 'FPS بیشتر',
    marquee2: ['بوست کنیم', 'پینگ کمتر', 'FPS بیشتر', 'یک کلیک'], ba_pill: 'قبل / بعد', ba_h: 'همان سیستم. همان بازی.', ba_before: 'قبل', ba_after: 'بعد', ba_cap: 'یک بار «اعمال پیشنهادی». عدد شما به سیستم و بازی‌تان بستگی دارد — این‌ها از سیستم تست ما هستند.', restore_ok: 'System Restore Point ساخته شد', compare: 'مقایسهٔ پلن‌ها', cmp_pcs: 'کامپیوتر برای هر حساب', cmp_pm: 'ماهانه (تومان)',
    h1a: 'پینگ کمتر.', h1b: 'FPS بیشتر.', h1c: 'با یک کلیک.',
    lead: 'برنامه‌ای برای ویندوز که تنظیمات ثابت‌شدهٔ سیستم، شبکه، ویندوز و هر بازی را برایتان اعمال می‌کند — از هر تغییر نسخهٔ پشتیبان می‌گیرد و با یک کلیک برمی‌گرداند — تا بازی‌ها روان‌تر و اینترنت سریع‌تر واکنش نشان دهد.',
    download: 'دانلود برای ویندوز', download_short: 'دانلود', register: 'ساخت حساب', login: 'ورود', logout: 'خروج', account: 'حساب من', get_started: 'شروع کنید',
    tok1: '+FPS', tok2: 'پینگ کمتر', tok3: 'Game DVR خاموش', tok4: 'DNS 1.1.1.1', tok5: 'Nagle خاموش', tok6: 'پاور پلن Ultimate', tok7: '1% lows ↑', tok8: 'زمان‌بندی GPU',
    st1: 'تنظیم', st2: 'ماژول', st3: 'پریست بازی', st4: 'بازگشت — از هر تغییر پشتیبان گرفته می‌شود',
    marquee: ['بهینه‌سازی سیستم', 'بهینه‌سازی شبکه', 'بهینه‌سازی ویندوز', 'پریست بازی‌ها'],
    feat_pill: 'امکانات', feat_h: 'چهار ماژول. یک دکمه.', feat_sub: 'یک ماژول را انتخاب کنید یا «اعمال پیشنهادی» را بزنید تا برنامه مجموعهٔ امن را برایتان اعمال کند. همه‌چیز از همان صفحه قابل بازگشت است.',
    m1: 'بهینه‌سازی سیستم', m1d: 'پاور پلن Ultimate، زمان‌بندی سخت‌افزاری GPU، بهینه‌سازی فول‌اسکرین، شتاب ماوس، برنامه‌های پس‌زمینه، جلوه‌های بصری.',
    m2: 'بهینه‌سازی شبکه', m2d: 'خاموش کردن Nagle، تنظیم TCP، محدودیت شبکه، رزرو QoS، DNS سریع (کلادفلر / شکن / ۴۰۳ / الکترو)، فلاش و ریست Winsock.',
    m3: 'بهینه‌سازی ویندوز', m3d: 'Game DVR و Game Bar، سرویس‌های Xbox، تله‌متری، برنامه‌های استارتاپ، فایل‌های موقت، نوتیفیکیشن‌ها و بقیهٔ چیزهایی که ویندوز حین بازی اجرا می‌کند.',
    m4: 'بهینه‌سازی بازی‌ها', m4d: 'پریست مخصوص هر بازی — گزینه‌های اجرا، مقادیر کانفیگ و اولویت پردازشی مناسب همان بازی. ماینکرفت، ولورانت، CS2 و بیشتر.',
    games_pill: 'پریست بازی‌ها', games_h: 'برای هر بازی یک پریست.', games_sub: 'هر پریست تنظیماتی را که برای همان بازی مهم است یکجا جمع می‌کند. قبل از بازی اعمال کنید، بعدش برگردانید.',
    g_mc: 'فلگ‌های JVM، تخصیص رم، اولویت', g_val: 'Raw input، اولویت، شبکه', g_cs2: 'گزینه‌های اجرا، اولویت', g_fn: 'اولویت، Game Mode', g_apex: 'گزینه‌های اجرا، شبکه', g_wz: 'اولویت، کش شیدر', g_rbx: 'اولویت، برنامه‌های پس‌زمینه', g_gta: 'اولویت، Game Mode',
    how_pill: 'نحوهٔ کار', how_h: 'در سه قدم آماده است.', how_sub: 'لازم نیست تنظیمات را یاد بگیرید. برنامه کار را انجام می‌دهد و راه برگشت را نگه می‌دارد.',
    how1: 'حساب بسازید و یک پلن انتخاب کنید', how1d: 'نام کاربری شما هم در سایت و هم داخل برنامه کار می‌کند، روی حداکثر {n} کامپیوتر.',
    how2: 'برنامه را دانلود کنید و وارد شوید', how2d: 'یک نصب‌کنندهٔ کوچک برای ویندوز ۱۰ / ۱۱. چون تنظیمات ویندوز را تغییر می‌دهد، دسترسی Administrator می‌خواهد.',
    how3: '«اعمال پیشنهادی» را بزنید', how3d: 'اول یک System Restore Point ساخته می‌شود. از هر تغییر پشتیبان گرفته می‌شود و با یک کلیک برمی‌گردد.',
    step: 'قدم', pricing: 'اشتراک', plans_h: 'پلن‌های ساده.', plans_sub: 'یک حساب، تا {n} کامپیوتر. هر وقت خواستید تمامش کنید — هیچ‌چیز خودکار تمدید نمی‌شود.', popular: 'محبوب‌ترین',
    month: 'ماهه', months: 'ماهه', toman: 'تومان', buy: 'خرید', per_month: '/ ماه',
    p1: 'هر چهار ماژول', p2: 'پریست بازی‌ها', p3: 'بازگشت یک‌کلیکی + System Restore Point', p4: 'آپدیت‌ها در طول اشتراک',
    faq_pill: 'سوالات', faq_h: 'سوال‌های رایج.',
    faq: [
      ['امن است؟ اگر چیزی خراب شود چه؟', 'از هر تغییر قبل از اعمال پشتیبان گرفته می‌شود و از داخل برنامه با یک کلیک برمی‌گردد. قبل از «اعمال پیشنهادی» برنامه یک System Restore Point ویندوز هم می‌سازد.'],
      ['واقعاً FPS را بالا می‌برد؟', 'چیزهایی را که فریم می‌خورند حذف می‌کند — ضبط پس‌زمینه، پاور پلن Balanced، سرویس‌های اضافه — و گزینه‌های مفید را تنظیم می‌کند. مقدار افزایش به سیستم و بازی شما بستگی دارد؛ جادویی در کار نیست.'],
      ['چرا ویندوز هشدار SmartScreen می‌دهد؟', 'نصب‌کننده هنوز امضای دیجیتال ندارد، برای همین ویندوز هشدار می‌دهد. روی «More info» و بعد «Run anyway» بزنید. دانلود همیشه از صفحهٔ GitHub Releases ماست.'],
      ['روی چند کامپیوتر می‌توانم استفاده کنم؟', 'همزمان تا {n} کامپیوتر برای هر حساب. اگر کامپیوترتان عوض شد، از صفحهٔ حساب دستگاه‌ها را ریست کنید.'],
      ['به اینترنت نیاز دارد؟', 'فقط برای ورود و بررسی روزانهٔ اشتراک. تا ۷ روز بدون اینترنت هم کار می‌کند.'],
      ['می‌توانم پولم را پس بگیرم؟', 'اگر برنامه روی کامپیوتر شما اجرا نشود و پشتیبانی نتواند حلش کند، تا ۷ روز پس از خرید مبلغ برگردانده می‌شود.'],
    ],
    cta_h: 'هر وقت آماده بودید.', cta_sub: 'حساب بسازید، برنامه را دانلود کنید، یک دکمه را بزنید.',
    f_product: 'محصول', f_account: 'حساب', f_legal: 'قوانین و پشتیبانی', terms: 'قوانین و بازگشت وجه', support: 'پشتیبانی', rights: 'تمام حقوق محفوظ است.',
    username: 'نام کاربری', password: 'رمز عبور', subscription: 'اشتراک', active_until: 'فعال تا', expired: 'منقضی شده', no_sub: 'اشتراک فعالی ندارید',
    devices: 'دستگاه‌ها', devices_hint: 'برنامه روی حداکثر {n} کامپیوتر برای هر حساب کار می‌کند. اگر کامپیوترتان عوض شد ریست کنید.', reset_devices: 'ریست دستگاه‌ها', payments: 'پرداخت‌ها', none: 'هنوز چیزی نیست',
    pay_success: 'پرداخت انجام شد — اشتراک شما فعال است.', pay_failed: 'پرداخت کامل نشد.', pay_unknown: 'پرداخت ناشناخته.', ref: 'کد پیگیری', back_account: 'بازگشت به حساب',
    err_username: 'نام کاربری: ۳ تا ۲۰ حرف انگلیسی، عدد یا _', err_password: 'رمز عبور: حداقل ۸ کاراکتر', err_taken: 'این نام کاربری گرفته شده', err_login: 'نام کاربری یا رمز اشتباه است', err_disabled: 'این حساب غیرفعال است',
    err_braked: 'تلاش‌های زیاد — ۱۰ دقیقه صبر کنید', err_plan: 'پلن ناشناخته', err_gateway: 'درگاه پرداخت فعلاً در دسترس نیست', err_csrf: 'فرم از سایت دیگری ارسال شده — لطفاً دوباره از fpsboost.ir امتحان کنید.',
    status: 'وضعیت', date: 'تاریخ', amount: 'مبلغ', plan: 'پلن',
    have_account: 'حساب دارید؟', no_account: 'حساب ندارید؟', welcome_back: 'خوش برگشتید.', create_h: 'حسابتان را بسازید.', auth_note: 'همین نام کاربری و رمز داخل برنامه هم کار می‌کند.',
    lang: 'English',
  },
};
export const t = (lang, k) => (STR[lang] || STR.en)[k] || STR.en[k] || k;
export const fmtNum = (lang, n) => lang === 'fa' ? Number(n).toLocaleString('fa-IR') : Number(n).toLocaleString('en-US');
export const fmtDate = (lang, ms) => new Date(ms).toLocaleDateString(lang === 'fa' ? 'fa-IR' : 'en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
export function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// the mark: /logo.png (white chevrons, served by the worker) used as a CSS mask so it can take any gradient
const MARK = '<span class="mark" aria-hidden="true"></span>';
// SUPPORT: an email, a https:// link or a @telegram handle
export function supportLink(v) {
  const href = v.includes('@') && !v.startsWith('@') ? 'mailto:' + v : v.startsWith('@') ? 'https://t.me/' + v.slice(1) : v;
  return `<a href="${esc(href)}" dir="ltr" rel="noopener">${esc(v)}</a>`;
}
const machines = (env) => Number(env.MAX_MACHINES) || 2;
const fill = (s, lang, env) => s.replace('{n}', fmtNum(lang, machines(env)));
export function prices(env) { try { return JSON.parse(env.PRICES || '{}'); } catch (e) { return {}; } }

/* ============================================================ CSS ============================================================ */
const CSS = `
:root{color-scheme:dark;--bg:#050507;--bg2:#0a0a10;--card:#0c0c13;--card2:#11111a;--line:rgba(255,255,255,.07);--line2:rgba(167,139,250,.38);
--text:#f4f2fb;--muted:#9a96ad;--dim:#66627a;--accent:#8b5cf6;--accent2:#a78bfa;--accent3:#c4b5fd;--ok:#5fd38d;--bad:#ff6b6b;--warn:#ffb457;--r:20px}
*{box-sizing:border-box}html{scroll-behavior:smooth}html,body{margin:0;min-height:100%;overflow-x:clip}
body{background:var(--bg);color:var(--text);font:15px/1.65 Inter,Vazirmatn,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;-webkit-font-smoothing:antialiased;animation:fadein .9s ease both}
body.fa{font-family:Vazirmatn,Inter,system-ui,Tahoma,sans-serif}
@keyframes fadein{from{opacity:0}to{opacity:1}}@keyframes up{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
a{color:var(--accent2);text-decoration:none}img,svg{display:block}
.wrap{max-width:1140px;margin:0 auto;padding:0 20px}
.mark{display:inline-block;width:34px;height:22px;background:linear-gradient(90deg,#fff,#c4b5fd);-webkit-mask:url(/logo.png) center/contain no-repeat;mask:url(/logo.png) center/contain no-repeat;flex:none}
.btn,button{position:relative;overflow:hidden;display:inline-flex;align-items:center;gap:8px;background:linear-gradient(135deg,#8b5cf6,#6d3ff0);color:#fff;border:0;border-radius:999px;padding:11px 20px;font-weight:600;cursor:pointer;font-size:14.5px;font-family:inherit;
box-shadow:0 0 0 1px rgba(255,255,255,.1) inset,0 10px 30px -10px rgba(139,92,246,.8);transition:transform .25s cubic-bezier(.2,.7,.2,1),box-shadow .25s;will-change:transform}
.btn:after,button:after{content:"";position:absolute;top:-40%;bottom:-40%;width:40%;left:-60%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.28),transparent);transform:skewX(-20deg);transition:left .6s}
.btn:hover:after,button:hover:after{left:130%}.btn:hover,button:hover{box-shadow:0 0 0 1px rgba(255,255,255,.16) inset,0 16px 40px -10px rgba(139,92,246,1)}
.btn.ghost,button.ghost{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.12);box-shadow:none}.btn.ghost:hover,button.ghost:hover{background:rgba(255,255,255,.08);border-color:var(--line2);box-shadow:0 0 30px -10px rgba(139,92,246,.7)}
button.sm{padding:6px 12px;font-size:12.5px}button.danger{background:#3a1c22;border:1px solid #5a2a33;color:#ffb3b3;box-shadow:none}
input,select{background:rgba(255,255,255,.03);color:var(--text);border:1px solid var(--line);border-radius:12px;padding:12px 14px;font-size:14.5px;width:100%;font-family:inherit;outline:0;transition:border-color .2s,box-shadow .2s}
input:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(139,92,246,.18)}
.muted{color:var(--muted)}h1,h2,h3{margin:0;line-height:1.12;letter-spacing:-.015em}h2{font-size:clamp(30px,4.2vw,46px);font-weight:600}h3{font-size:17px;font-weight:600}
.grad{background:linear-gradient(90deg,#efeaff 0%,#b79bff 50%,#8b5cf6 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
.pill{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--line2);background:rgba(139,92,246,.1);color:var(--accent3);border-radius:999px;padding:5px 12px;font-size:12.5px;font-weight:500}
.pill i{width:6px;height:6px;border-radius:50%;background:var(--accent2);box-shadow:0 0 10px var(--accent2)}
.lbl{font:500 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--dim)}
.card{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:22px;min-width:0;position:relative}
.card.wide{grid-column:1/-1}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}
.light{position:fixed;inset:0;z-index:0;pointer-events:none;background:radial-gradient(600px circle at var(--lx,-1000px) var(--ly,-1000px),rgba(139,92,246,.09),transparent 60%)}
main{position:relative;z-index:1}

/* nav */
.nav{position:sticky;top:0;z-index:20;backdrop-filter:blur(14px);background:rgba(5,5,7,.6);border-bottom:1px solid rgba(255,255,255,.05);animation:up .8s .7s both}
.nav .wrap{display:flex;align-items:center;justify-content:space-between;gap:14px;height:64px}
.brand{display:flex;align-items:center;gap:10px;color:var(--text);font-weight:800;font-size:15px;letter-spacing:.12em;text-transform:uppercase}
.links{display:flex;gap:24px;font-size:14px}.links a{color:var(--muted);position:relative;padding:4px 0}.links a:after{content:"";position:absolute;left:0;right:100%;bottom:0;height:1px;background:var(--accent2);transition:right .3s}.links a:hover{color:var(--text)}.links a:hover:after{right:0}
.navr{display:flex;gap:10px;align-items:center;white-space:nowrap}.navr .lang{color:var(--muted);font-size:13.5px;padding:6px 8px}
@media(max-width:820px){.links{display:none}}@media(max-width:520px){.navr .lang.login{display:none}.navr .btn{padding:9px 14px}}

/* hero */
.hero{position:relative;padding:80px 0 0;text-align:center;overflow:hidden;isolation:isolate}
.cone{position:absolute;left:50%;top:-40px;width:900px;height:900px;margin-left:-450px;z-index:-1;pointer-events:none;filter:blur(24px);opacity:.75;
background:conic-gradient(from 0deg at 50% 0,transparent 0 42%,rgba(139,92,246,.45) 47%,rgba(196,181,253,.55) 50%,rgba(139,92,246,.45) 53%,transparent 58% 100%);animation:breathe 7s ease-in-out infinite}
.beam{position:absolute;top:-140px;width:520px;height:900px;pointer-events:none;z-index:-1;filter:blur(30px);opacity:.6;background:conic-gradient(from 0deg at 50% 0,transparent 0 44%,rgba(139,92,246,.5) 48.5%,rgba(192,132,252,.4) 51.5%,transparent 56% 100%);animation:breathe 7s ease-in-out infinite}
.beam.b1{left:-140px;transform:rotate(24deg)}.beam.b2{right:-140px;transform:rotate(-24deg);animation-delay:-3.5s}
@keyframes breathe{0%,100%{opacity:.5}50%{opacity:.85}}
#stars{position:absolute;inset:0;z-index:-1;width:100%;height:100%;pointer-events:none}
.wmk{position:absolute;left:50%;top:40px;width:min(1100px,120vw);height:560px;margin-left:min(-550px,-60vw);z-index:-1;pointer-events:none;opacity:.045;background:#fff;-webkit-mask:url(/logo.png) center/contain no-repeat;mask:url(/logo.png) center/contain no-repeat;transform:translateY(var(--py,0))}
.wm{display:inline-block;overflow:hidden;vertical-align:bottom;padding:0 .04em .12em;margin:0 -.04em -.12em}.w{display:inline-block}
.hero h1{font-size:clamp(40px,6.6vw,78px);font-weight:600;letter-spacing:-.025em;margin:18px auto 16px;max-width:920px}
.hero h1 .w{opacity:0;transform:translateY(110%) rotate(6deg);filter:blur(8px);animation:wr .9s cubic-bezier(.2,.7,.2,1) forwards;animation-delay:calc(.25s + var(--i)*.1s)}
@keyframes wr{60%{filter:blur(0)}to{opacity:1;transform:none;filter:none}}
.hero .pill{animation:up .7s .15s both}.hero .lead{color:var(--muted);font-size:17px;max-width:640px;margin:0 auto 26px;animation:up .8s 1.05s both}.hero .actions{animation:up .8s 1.2s both}.mockwrap{animation:up 1.1s 1.35s both}
.actions{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;align-items:center}
.hint{position:fixed;inset-inline-end:22px;bottom:18px;z-index:15;color:var(--muted);font-size:12px;display:flex;align-items:center;gap:8px;transition:opacity .4s;animation:up .8s 2s both}.hint.off{opacity:0;pointer-events:none}
.hint i{width:18px;height:28px;border:1px solid var(--line2);border-radius:10px;position:relative}.hint i:after{content:"";position:absolute;left:50%;top:6px;width:3px;height:6px;margin-left:-1.5px;border-radius:2px;background:var(--accent2);animation:wheel 1.6s ease-in-out infinite}
@keyframes wheel{0%{transform:translateY(0);opacity:1}100%{transform:translateY(10px);opacity:0}}
.tok{position:absolute;padding:6px 11px;border-radius:999px;border:1px solid var(--line);background:rgba(10,10,16,.75);color:var(--accent3);font-size:12.5px;font-weight:500;backdrop-filter:blur(6px);direction:ltr;unicode-bidi:isolate;
box-shadow:0 0 30px -8px rgba(139,92,246,.6);animation:tin 1.3s cubic-bezier(.2,.7,.2,1) var(--e,1.3s) both,float 6s ease-in-out calc(var(--e,1.3s) + 1.3s) infinite;will-change:transform;pointer-events:none;white-space:nowrap}
.tok.sq{width:50px;height:50px;padding:0;display:grid;place-items:center;border-radius:10px;font-size:15px;font-weight:600;color:#ece7ff;--rot:-12deg}.tok.sq:nth-child(odd){--rot:10deg}
.tok.far{filter:blur(1.5px);font-size:11px;animation-name:tin,floatfar}.tok.far.sq{width:40px;height:40px;font-size:12px}
@keyframes tin{from{opacity:0;transform:translate(var(--fx,0),var(--fy,60px)) rotate(calc(var(--rot,0deg) + 40deg)) scale(.5)}to{opacity:1;transform:translate(var(--px,0),0) rotate(var(--rot,0deg)) scale(1)}}
@keyframes float{0%,100%{transform:translate(var(--px,0),0) rotate(var(--rot,0deg))}50%{transform:translate(var(--px,0),-14px) rotate(calc(var(--rot,0deg) + 3deg))}}
@keyframes floatfar{0%,100%{opacity:.55;transform:translate(var(--px,0),0) rotate(var(--rot,0deg))}50%{opacity:.55;transform:translate(var(--px,0),-10px) rotate(var(--rot,0deg))}}
@media(max-width:900px){.tok,.tok.sq{display:none}}
.mockwrap{perspective:1600px;margin:56px auto 0;max-width:980px;position:relative}
.mock{transform:rotateX(var(--tilt,14deg)) rotateY(var(--ty,0deg));transform-origin:50% 0;transition:transform .15s linear;border-radius:18px;border:1px solid var(--line2);background:linear-gradient(180deg,#0f0e18,#08080d);
box-shadow:0 40px 120px -30px rgba(139,92,246,.55),0 0 0 1px rgba(255,255,255,.03) inset;overflow:hidden;text-align:start;display:grid;grid-template-columns:190px 1fr 230px;min-height:440px;font-size:12.5px}
.mockglow{position:absolute;left:10%;right:10%;bottom:-40px;height:160px;background:radial-gradient(closest-side,rgba(139,92,246,.55),transparent);filter:blur(30px);z-index:-1}
.m-side{border-inline-end:1px solid rgba(255,255,255,.06);padding:16px 12px;display:grid;align-content:start;gap:4px}
.m-side .b{display:flex;align-items:center;gap:8px;font-weight:800;letter-spacing:.1em;font-size:11px;margin-bottom:12px;padding:0 6px}.m-side .b .mark{width:24px;height:16px}
.m-nav{padding:8px 10px;border-radius:9px;color:var(--muted);display:flex;gap:8px;align-items:center}.m-nav i{width:8px;height:8px;border-radius:3px;background:currentColor;opacity:.5}
.m-nav.on{background:rgba(139,92,246,.18);color:#ece7ff}.m-nav.on i{background:var(--accent2);opacity:1;box-shadow:0 0 8px var(--accent2)}
.m-main{padding:16px 18px;display:grid;gap:14px;align-content:start}
.m-top{display:flex;justify-content:space-between;align-items:center}.m-top b{font-size:14px}.m-top .btn{padding:7px 12px;font-size:12px}
.m-tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.m-tile{background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:12px}
.m-tile b{display:block;font-size:20px;letter-spacing:-.02em;direction:ltr}.m-tile span{color:var(--muted);font-size:11.5px}.m-tile em{font-style:normal;color:var(--ok);font-size:11px;margin-inline-start:6px}
.m-chart{background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:12px 14px 6px}.m-chart .l{display:flex;justify-content:space-between;color:var(--muted);font-size:11.5px;margin-bottom:4px}
.m-chart svg{width:100%;height:110px}.m-chart .p1{stroke:#3a3550;fill:none;stroke-width:2}.m-chart .p2{stroke:#a78bfa;fill:none;stroke-width:2.5;filter:drop-shadow(0 0 6px rgba(167,139,250,.8))}.m-chart .a2{fill:url(#mg)}
.m-right{border-inline-start:1px solid rgba(255,255,255,.06);padding:16px 14px;display:grid;gap:8px;align-content:start}
.m-right h4{margin:0 0 4px;font-size:12px;color:var(--muted);font-weight:500}
.m-row{display:flex;justify-content:space-between;align-items:center;padding:8px 10px;border-radius:9px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.05)}
.sw{width:30px;height:17px;border-radius:999px;background:#26223a;position:relative;flex:none;transition:background .3s}.sw:after{content:"";position:absolute;top:2px;inset-inline-start:2px;width:13px;height:13px;border-radius:50%;background:#7a7495;transition:inset-inline-start .3s,background .3s}
.sw.on{background:var(--accent)}.sw.on:after{inset-inline-start:15px;background:#fff}
.m-preset{margin-top:6px;background:linear-gradient(135deg,rgba(139,92,246,.25),rgba(192,132,252,.08));border:1px solid var(--line2);border-radius:12px;padding:12px}
.m-preset b{display:block;font-size:13px}.m-preset span{color:var(--muted);font-size:11px}.m-preset .btn{margin-top:8px;padding:6px 10px;font-size:11.5px}
@media(max-width:820px){.mock{grid-template-columns:1fr;min-height:0}.m-side,.m-right{display:none}}@media(max-width:520px){.m-tile b{font-size:15px}.m-tile em{margin-inline-start:3px}}

/* stats */
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:0;margin:70px auto 0;border:1px solid var(--line);border-radius:var(--r);overflow:hidden;background:var(--card);position:relative;
background-image:linear-gradient(rgba(167,139,250,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(167,139,250,.06) 1px,transparent 1px);background-size:40px 40px}
.xh{position:absolute;pointer-events:none;opacity:0}.stats.in .xh{opacity:1}
.xh.v{top:0;bottom:0;width:1px;background:linear-gradient(180deg,transparent,var(--accent2) 40%,#fff 50%,var(--accent2) 60%,transparent);box-shadow:0 0 12px var(--accent2);animation:xv 7s ease-in-out infinite}
.xh.h{left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,var(--accent2) 40%,#fff 50%,var(--accent2) 60%,transparent);box-shadow:0 0 12px var(--accent2);animation:xhh 9s ease-in-out infinite}
@keyframes xv{0%{left:4%}50%{left:96%}100%{left:4%}}@keyframes xhh{0%{top:8%}50%{top:92%}100%{top:8%}}
.stat{padding:22px 24px;border-inline-end:1px solid var(--line);position:relative;opacity:0;transform:translateY(20px);transition:opacity .7s,transform .7s,background .3s;transition-delay:calc(var(--i)*.12s)}.stat:last-child{border:0}.stat.in{opacity:1;transform:none}.stat:hover{background:rgba(139,92,246,.06)}
.stat b{display:block;font-size:34px;font-weight:600;letter-spacing:-.02em;background:linear-gradient(90deg,#fff,#c4b5fd);-webkit-background-clip:text;background-clip:text;color:transparent}.stat span{color:var(--muted);font-size:13px}
@media(max-width:640px){.stat{border-inline-end:0;border-bottom:1px solid var(--line)}}

/* marquee */
.marq{overflow:hidden;margin:90px 0 0;padding:8px 0;border-top:1px solid rgba(255,255,255,.04);border-bottom:1px solid rgba(255,255,255,.04);mask:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent);position:relative}
.marq .track{display:flex;gap:44px;white-space:nowrap;width:max-content;will-change:transform;font-size:clamp(44px,8vw,96px);font-weight:600;letter-spacing:-.03em;line-height:1.1}
.marq .track span{background:linear-gradient(90deg,#fff 0%,#c4b5fd 55%,#8b5cf6 100%);-webkit-background-clip:text;background-clip:text;color:transparent}.marq .track span:nth-child(4n+3){background:none;color:transparent;-webkit-text-stroke:1px rgba(196,181,253,.7)}
.marq .track em{font-style:normal;color:var(--accent);-webkit-text-stroke:0}
.marq.big{margin:0;padding:40px 0;border:0;mask:none;isolation:isolate}.marq.big .track span{color:#fff;background:none;-webkit-text-stroke:0;font-size:clamp(70px,13vw,190px);font-weight:700;letter-spacing:-.04em;mix-blend-mode:screen}.marq.big .track em{font-size:.5em;align-self:center}
.discs{position:absolute;inset:0;z-index:-1;pointer-events:none;perspective:900px;overflow:hidden}
.disc{position:absolute;left:50%;top:50%;width:var(--s);height:var(--s);margin:calc(var(--s)/-2) 0 0 calc(var(--s)/-2);border-radius:50%;
background:radial-gradient(circle at 40% 35%,rgba(196,181,253,.55),rgba(139,92,246,.3) 45%,rgba(109,40,217,.08) 75%,transparent 80%);border:1px solid rgba(196,181,253,.25);filter:blur(.5px);
transform:translateX(var(--x)) rotate3d(1,1,0,var(--a));animation:discspin 14s ease-in-out infinite;animation-delay:var(--d)}
@keyframes discspin{0%,100%{transform:translateX(var(--x)) rotate3d(1,1,0,var(--a)) translateZ(0)}50%{transform:translateX(var(--x)) rotate3d(1,1,0,calc(var(--a) + 40deg)) translateZ(60px)}}

/* sections + reveal */
section.s{padding:110px 0 0}.s .head{text-align:center;max-width:640px;margin:0 auto 44px}.s .head h2{margin:14px 0 12px}.s .head p{color:var(--muted);font-size:16px;margin:0}
.rv{opacity:0;transform:translateY(26px);transition:opacity .8s cubic-bezier(.2,.7,.2,1),transform .8s cubic-bezier(.2,.7,.2,1)}.rv.in{opacity:1;transform:none}
.rv.l{transform:translateX(-46px) rotate(-2deg)}.rv.r{transform:translateX(46px) rotate(2deg)}.rv.sc{transform:translateY(40px) scale(.94)}
[dir=rtl] .rv.l{transform:translateX(46px) rotate(2deg)}[dir=rtl] .rv.r{transform:translateX(-46px) rotate(-2deg)}
.rv.d1{transition-delay:.1s}.rv.d2{transition-delay:.2s}.rv.d3{transition-delay:.3s}
.words .w{opacity:0;transform:translateY(110%) rotate(5deg);filter:blur(6px);transition:opacity .5s,transform .9s cubic-bezier(.2,.7,.2,1),filter .6s;transition-delay:calc(var(--i)*.07s)}.words.in .w{opacity:1;transform:none;filter:none}

/* before / after */
.ba{position:relative;overflow:hidden;padding-bottom:20px}
.ba-row{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:20px;min-height:360px}
.ba-w{font-size:clamp(48px,9vw,132px);font-weight:700;letter-spacing:-.04em;line-height:1;white-space:nowrap;will-change:transform}
.ba-w.l{text-align:end;color:transparent;-webkit-text-stroke:1px rgba(196,181,253,.5);transform:translateX(calc(var(--p,0) * -160px))}
.ba-w.r{text-align:start;background:linear-gradient(90deg,#fff,#c4b5fd);-webkit-background-clip:text;background-clip:text;color:transparent;transform:translateX(calc(var(--p,0) * 160px))}
[dir=rtl] .ba-w.l{transform:translateX(calc(var(--p,0) * 160px))}[dir=rtl] .ba-w.r{transform:translateX(calc(var(--p,0) * -160px))}
.ba-card{width:340px;max-width:80vw;border-radius:18px;border:1px solid var(--line2);background:linear-gradient(180deg,#12111c,#0a0a10);padding:18px;box-shadow:0 30px 90px -30px rgba(139,92,246,.8),0 0 0 1px rgba(255,255,255,.03) inset;
transform:perspective(1200px) rotateY(calc(-18deg + var(--p,0) * 36deg)) rotateX(6deg);will-change:transform;position:relative;text-align:start}
.ba-card:before{content:"";position:absolute;inset:-40px;z-index:-1;background:radial-gradient(closest-side,rgba(139,92,246,.35),transparent);filter:blur(20px)}
.ba-card .t{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}.ba-card .t b{font-size:13px}
.ba-cols{display:grid;grid-template-columns:1fr 1fr;gap:10px}.ba-col{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:12px}
.ba-col .lbl{margin-bottom:8px}.ba-col b{display:block;font-size:26px;letter-spacing:-.02em;direction:ltr}.ba-col b small{font-size:11px;color:var(--muted);font-weight:400;margin-inline-start:4px}
.ba-col .bar{height:6px;border-radius:3px;background:rgba(255,255,255,.06);margin:8px 0 10px;overflow:hidden}.ba-col .bar i{display:block;height:100%;width:var(--w);border-radius:3px;background:#4b4664}
.ba-col.a .bar i{background:linear-gradient(90deg,var(--accent),var(--accent3));box-shadow:0 0 10px rgba(167,139,250,.8)}.ba-col.a b{color:#fff}.ba-col:not(.a) b{color:var(--muted)}
.ba-cap{text-align:center;color:var(--muted);margin:6px 0 0}
@media(max-width:820px){.ba-row{grid-template-columns:1fr;text-align:center;gap:10px}.ba-w{font-size:56px}.ba-w.l,.ba-w.r{text-align:center}.ba-card{margin:0 auto;transform:none}}

/* modules */
.mods{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px;perspective:1200px}
.mod{padding:24px;overflow:hidden;transform:rotateX(var(--rx,0)) rotateY(var(--ry,0));transition:transform .2s,border-color .3s,box-shadow .3s;will-change:transform}
.mod:before{content:"";position:absolute;inset:0;background:radial-gradient(260px circle at var(--mx,50%) var(--my,0%),rgba(139,92,246,.24),transparent 60%);opacity:0;transition:opacity .35s;pointer-events:none}
.mod:hover:before{opacity:1}.mod:hover{border-color:var(--line2);box-shadow:0 30px 80px -40px rgba(139,92,246,.8)}
.mod .ic{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;background:rgba(139,92,246,.14);border:1px solid var(--line2);color:var(--accent3);margin-bottom:16px}.mod .ic svg{width:20px;height:20px}
.mod h3{margin-bottom:8px}.mod p{color:var(--muted);margin:0;font-size:14px}
.mod .art{margin:-6px -24px 16px;height:120px;position:relative;overflow:hidden;border-bottom:1px solid rgba(255,255,255,.05);background:linear-gradient(180deg,rgba(139,92,246,.08),transparent)}
.mod .art .bar{position:absolute;left:24px;right:24px;height:9px;border-radius:5px;background:rgba(255,255,255,.05);overflow:hidden}.mod .art .bar i{display:block;height:100%;width:var(--w);background:linear-gradient(90deg,var(--accent),var(--accent3));border-radius:5px;box-shadow:0 0 12px rgba(167,139,250,.7);transform:scaleX(0);transform-origin:0 50%;transition:transform 1.2s cubic-bezier(.2,.7,.2,1)}
[dir=rtl] .mod .art .bar i{transform-origin:100% 50%}.mod.in .art .bar i{transform:none}
.mod .art .lbl{position:absolute;inset-inline-start:24px}
.mod .art .grid{position:absolute;inset:0;background-image:linear-gradient(rgba(167,139,250,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(167,139,250,.08) 1px,transparent 1px);background-size:20px 20px;mask:radial-gradient(closest-side at 50% 100%,#000,transparent)}
.mod .art .ping{position:absolute;left:50%;top:38px;width:10px;height:10px;border-radius:50%;background:var(--accent2);box-shadow:0 0 14px var(--accent2)}.mod .art .ping:before,.mod .art .ping:after{content:"";position:absolute;inset:-14px;border-radius:50%;border:1px solid var(--accent2);animation:ring 2.4s ease-out infinite;opacity:0}.mod .art .ping:after{animation-delay:1.2s}
@keyframes ring{0%{transform:scale(.3);opacity:.9}100%{transform:scale(2.2);opacity:0}}
.mod .art .win{position:absolute;left:50%;top:22px;transform:translateX(-50%);width:170px;height:100px;border-radius:9px 9px 0 0;border:1px solid var(--line2);background:rgba(10,10,16,.8);padding:8px;display:grid;gap:6px;align-content:start}
.mod .art .win i{display:block;height:8px;border-radius:4px;background:rgba(255,255,255,.07)}.mod .art .win i:nth-child(2){width:70%}.mod .art .win i:nth-child(3){width:45%;background:rgba(139,92,246,.4)}
.mod .art .keys{position:absolute;inset-inline:24px;top:26px;display:flex;gap:6px;flex-wrap:wrap}.mod .art .keys i{padding:3px 8px;border-radius:6px;border:1px solid var(--line);font-size:10.5px;color:var(--accent3);font-style:normal;background:rgba(10,10,16,.7);direction:ltr}

/* pinned stage (how it works) */
.stage-wrap{height:320vh;position:relative}.stage{position:sticky;top:64px;height:calc(100vh - 64px);display:grid;align-content:center;gap:22px;padding:20px 0}
.frame{position:relative;border:1px solid var(--line);border-radius:22px;background:rgba(12,12,19,.6);min-height:min(480px,58vh);overflow:hidden;isolation:isolate}
.smoke{position:absolute;inset:-20%;z-index:-1;pointer-events:none;filter:blur(50px);opacity:.7;
background:radial-gradient(40% 30% at 20% 70%,rgba(139,92,246,.35),transparent 70%),radial-gradient(35% 28% at 70% 30%,rgba(124,58,237,.3),transparent 70%),radial-gradient(30% 25% at 55% 80%,rgba(196,181,253,.16),transparent 70%);animation:smoke 16s ease-in-out infinite alternate}
@keyframes smoke{from{transform:translate(0,0) rotate(0)}to{transform:translate(4%,-6%) rotate(8deg)}}
.cb{position:absolute;width:22px;height:22px;pointer-events:none}.cb:before,.cb:after{content:"";position:absolute;background:var(--accent2);box-shadow:0 0 10px var(--accent2);opacity:.35;transition:opacity .4s}
.cb:before{width:100%;height:1px}.cb:after{width:1px;height:100%}.cb.tl{top:14px;left:14px}.cb.tr{top:14px;right:14px;transform:scaleX(-1)}.cb.bl{bottom:14px;left:14px;transform:scaleY(-1)}.cb.br{bottom:14px;right:14px;transform:scale(-1)}
.cb.on:before,.cb.on:after{opacity:1}
.panel{position:absolute;inset:0;display:grid;grid-template-columns:1fr 1fr;align-items:center;gap:30px;padding:40px 48px;opacity:0;filter:blur(12px);transform:scale(.96);transition:opacity .7s,filter .7s,transform .7s;pointer-events:none}
.panel.on{opacity:1;filter:none;transform:none;pointer-events:auto}
.panel .txt h3{font-size:26px;margin:12px 0 10px;letter-spacing:-.02em}.panel .txt p{color:var(--muted);margin:0;font-size:15px}
.panel .vis{display:grid;place-items:center;min-height:260px;perspective:1000px}
.stack{position:relative;width:260px;height:180px}.stack .sc{position:absolute;inset:0;border-radius:14px;border:1px solid var(--line2);background:linear-gradient(180deg,#15132a,#0b0b12);padding:16px;box-shadow:0 20px 50px -20px rgba(139,92,246,.7);transform:translate(var(--dx),var(--dy)) rotate(var(--rr));transition:transform .8s cubic-bezier(.2,.7,.2,1)}
.stack .sc b{display:block;font-size:22px;letter-spacing:-.02em}.stack .sc span{color:var(--muted);font-size:12px}.stack .sc .btn{margin-top:12px;padding:6px 12px;font-size:12px}
.panel:not(.on) .stack .sc{transform:translate(0,30px) rotate(0)}
.lwin{width:280px;border-radius:14px;border:1px solid var(--line2);background:#0c0c13;box-shadow:0 20px 50px -20px rgba(139,92,246,.7);overflow:hidden;text-align:start}
.lwin .bar{display:flex;gap:6px;padding:10px 12px;border-bottom:1px solid var(--line)}.lwin .bar i{width:9px;height:9px;border-radius:50%;background:#2a2740}.lwin .bar i:first-child{background:#ff5f56}.login .bar i:nth-child(2){background:#ffbd2e}.login .bar i:nth-child(3){background:#27c93f}
.lwin .body{padding:16px;display:grid;gap:10px}.lwin .f{border:1px solid var(--line);border-radius:9px;padding:9px 11px;font-size:12.5px;color:var(--text);background:rgba(255,255,255,.03);direction:ltr}.lwin .f.pw{letter-spacing:.2em}.lwin .btn{justify-content:center;padding:9px;font-size:12.5px}
.lwin .chip{display:inline-flex;gap:6px;align-items:center;font-size:11px;color:var(--muted);border:1px dashed var(--line2);border-radius:8px;padding:5px 9px;direction:ltr}
.applyv{width:290px;display:grid;gap:8px}.applyv .m-row{opacity:0;transform:translateX(20px);transition:opacity .5s,transform .5s;transition-delay:calc(var(--i)*.18s)}.panel.on .applyv .m-row{opacity:1;transform:none}
.applyv .rp{display:flex;gap:8px;align-items:center;color:var(--ok);font-size:12.5px;margin-top:4px;opacity:0;transition:opacity .5s 1.1s}.panel.on .applyv .rp{opacity:1}
.applyv .big{font-size:34px;font-weight:600;letter-spacing:-.02em;direction:ltr;text-align:center;background:linear-gradient(90deg,#fff,#c4b5fd);-webkit-background-clip:text;background-clip:text;color:transparent}
.steps-row{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;position:relative;padding-top:14px}
.steps-row:before{content:"";position:absolute;top:0;left:0;right:0;height:1px;background:rgba(255,255,255,.08)}
.steps-row .prog{position:absolute;top:0;inset-inline-start:0;height:1px;width:calc(var(--p,0) * 100%);background:linear-gradient(90deg,var(--accent),var(--accent3));box-shadow:0 0 10px var(--accent2);transition:width .2s linear}
.steps-row .st{display:grid;gap:4px;color:var(--dim);transition:color .3s;cursor:pointer}.steps-row .st b{font-weight:500;font-size:13.5px;color:var(--muted);transition:color .3s}.steps-row .st.on{color:var(--accent3)}.steps-row .st.on b{color:var(--text)}
@media(max-width:820px){.stage-wrap{height:auto}.stage{position:static;height:auto}.frame{min-height:0;display:grid;gap:14px;padding:14px}.panel{position:relative;opacity:1;filter:none;transform:none;grid-template-columns:1fr;padding:18px;pointer-events:auto;border:1px solid var(--line);border-radius:14px;background:rgba(255,255,255,.02)}.panel .vis{min-height:0;margin-top:16px}.steps-row{display:none}.panel .stack .sc{transform:translate(var(--dx),var(--dy)) rotate(var(--rr))}.applyv .m-row,.applyv .rp{opacity:1;transform:none}}

/* repeated text + helix */
.rep-grid{display:grid;grid-template-columns:1fr 1fr;gap:40px;align-items:center}
.rep-copy h2{margin:14px 0 12px}.rep-copy p{color:var(--muted);font-size:16px;margin:0 0 22px}.rep-copy .actions{justify-content:flex-start}
.rep-stack{position:relative;min-height:440px;display:grid;align-content:center;perspective:900px}
.lines{display:grid;font-size:clamp(44px,5.6vw,76px);font-weight:600;letter-spacing:-.03em;line-height:1.02;text-align:end}
.lines span{display:block;background:linear-gradient(90deg,#8b5cf6,#c4b5fd 60%,#fff);-webkit-background-clip:text;background-clip:text;color:transparent;opacity:0;transform:translateX(60px);transition:opacity .8s,transform .9s cubic-bezier(.2,.7,.2,1);transition-delay:calc(var(--i)*.1s)}
[dir=rtl] .lines{text-align:start}[dir=rtl] .lines span{transform:translateX(-60px)}
.rep-stack.in .lines span{opacity:calc(.28 + var(--i)*.12);transform:none}
.helix{position:absolute;inset-inline-end:16%;top:0;bottom:0;width:180px;transform-style:preserve-3d;pointer-events:none}
.helix i{position:absolute;left:50%;top:calc(var(--k)*7% + 2%);width:var(--sz,16px);height:var(--sz,16px);margin-left:calc(var(--sz,16px)/-2);border-radius:50%;
background:radial-gradient(circle at 35% 35%,#fff,#c4b5fd 30%,#8b5cf6 70%,rgba(139,92,246,0));box-shadow:0 0 18px rgba(167,139,250,.9);animation:orbit 9s linear infinite;animation-delay:calc(var(--k)*-.64s)}
.helix i:nth-child(3n){--sz:24px}.helix i:nth-child(4n){--sz:11px}
@keyframes orbit{from{transform:rotateY(0deg) translateZ(90px)}to{transform:rotateY(360deg) translateZ(90px)}}
.helix svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}.helix path{fill:none;stroke:url(#hg);stroke-width:1.2;stroke-dasharray:1;stroke-dashoffset:1;transition:stroke-dashoffset 2.4s ease}.rep-stack.in .helix path{stroke-dashoffset:0}
@media(max-width:820px){.rep-grid{grid-template-columns:1fr}.rep-stack{min-height:320px}.helix{inset-inline-end:0}}

/* games carousel */
.s.games{position:relative;overflow:hidden}.floor{position:absolute;inset-inline:-20%;bottom:-30px;height:320px;z-index:-1;pointer-events:none;
background-image:linear-gradient(rgba(167,139,250,.22) 1px,transparent 1px),linear-gradient(90deg,rgba(167,139,250,.22) 1px,transparent 1px);background-size:64px 64px;transform:perspective(700px) rotateX(64deg);transform-origin:50% 100%;mask:linear-gradient(transparent,#000 45%,#000 85%,transparent);animation:flow 6s linear infinite}
@keyframes flow{from{background-position:0 0}to{background-position:0 64px}}
.floorglow{position:absolute;left:50%;bottom:-80px;width:60%;height:200px;transform:translateX(-50%);background:radial-gradient(closest-side,rgba(139,92,246,.35),transparent);filter:blur(30px);z-index:-1;pointer-events:none}
.gwrap{overflow:hidden;mask:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent);padding:10px 0 30px}
.gtrack{display:flex;gap:16px;width:max-content;animation:gscroll 40s linear infinite}.gwrap:hover .gtrack{animation-play-state:paused}
@keyframes gscroll{to{transform:translateX(-50%)}}
[dir=rtl] .gwrap{direction:ltr}[dir=rtl] .gcard{direction:rtl}
.gcard{width:250px;height:170px;border-radius:18px;border:1px solid var(--line);background:linear-gradient(180deg,#0f0f17,#09090e);position:relative;overflow:hidden;padding:18px;display:grid;align-content:end;gap:4px;transition:transform .3s,border-color .3s,box-shadow .3s;flex:none;text-align:start}
.gcard:hover{transform:translateY(-6px);border-color:var(--line2);box-shadow:0 30px 60px -30px var(--g1)}
.gcard:before{content:"";position:absolute;inset:-30% -30% auto auto;width:200px;height:200px;background:radial-gradient(closest-side,var(--g1),transparent);opacity:.35;filter:blur(20px);transition:opacity .3s}.gcard:hover:before{opacity:.7}
.gcard .gw{position:absolute;inset-inline-end:10px;top:-14px;font-size:96px;font-weight:800;letter-spacing:-.05em;line-height:1;color:transparent;-webkit-text-stroke:1px rgba(255,255,255,.12);direction:ltr}
.gcard .circ{position:absolute;inset-inline-end:16px;top:26px;width:70px;height:48px;border:1px solid rgba(255,255,255,.14);border-radius:6px 20px 6px 20px;opacity:.6}.gcard .circ:before{content:"";position:absolute;left:-30px;top:50%;width:30px;height:1px;background:rgba(255,255,255,.18)}
.gcard b{font-size:16px}.gcard span{color:var(--muted);font-size:12.5px}.gcard .gi{position:absolute;inset-inline-start:18px;top:18px;width:34px;height:34px;border-radius:9px;display:grid;place-items:center;font-weight:800;font-size:13px;color:#fff;background:linear-gradient(135deg,var(--g1),var(--g2));box-shadow:0 8px 20px -8px var(--g1)}

/* plans */
.plans{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;align-items:stretch}
.plan{padding:26px 24px;display:grid;align-content:start;gap:8px;overflow:hidden;transition:transform .3s,border-color .3s}.plan:hover{transform:translateY(-4px);border-color:var(--line2)}
.plan.pop{border-color:var(--line2);background:linear-gradient(180deg,rgba(139,92,246,.14),var(--card));box-shadow:0 30px 80px -40px rgba(139,92,246,.7)}
.plan.pop .sweep{position:absolute;top:0;bottom:0;width:1px;left:-2px;background:linear-gradient(180deg,transparent,#fff,var(--accent2),transparent);box-shadow:0 0 14px var(--accent2);animation:sweep 5s ease-in-out infinite}
@keyframes sweep{0%{left:-2px;opacity:0}10%{opacity:1}90%{opacity:1}100%{left:100%;opacity:0}}
.plan .tag{position:absolute;top:14px;inset-inline-end:14px}.plan h3{color:var(--muted);font-weight:500;font-size:14px}
.plan .price{font-size:34px;font-weight:600;letter-spacing:-.02em}.plan .price small{font-size:13px;color:var(--muted);font-weight:400;margin-inline-start:6px}.plan .per{color:var(--dim);font-size:12.5px;margin-top:-6px}
.plan ul{list-style:none;padding:0;margin:10px 0 16px;display:grid;gap:7px;font-size:13.5px;color:#c9c4de}.plan li:before{content:"✓";color:var(--accent2);margin-inline-end:8px}
.plan form{margin-top:auto}.plan form button{width:100%;justify-content:center}
.cmp{margin-top:18px}.cmp summary{list-style:none;cursor:pointer;text-align:center;color:var(--accent3);font-size:13.5px;padding:10px}.cmp summary::-webkit-details-marker{display:none}.cmp summary:after{content:" ↓";display:inline-block;transition:transform .3s}.cmp[open] summary:after{transform:rotate(180deg)}
.cmp .card{margin-top:8px;animation:up .5s both}.cmp th:not(:first-child),.cmp td:not(:first-child){text-align:center}

/* faq */
.faqbox{position:relative;max-width:800px;margin:0 auto;padding:22px}.faqbox .cb{width:30px;height:30px}
.faq{display:grid;gap:10px}
details.q{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:0 20px;transition:border-color .3s,background .3s}details.q:hover{background:var(--card2)}details.q[open]{border-color:var(--line2)}
details.q summary{cursor:pointer;list-style:none;padding:16px 0;font-weight:500;display:flex;justify-content:space-between;align-items:center;gap:14px}details.q summary::-webkit-details-marker{display:none}
details.q summary:after{content:"+";color:var(--accent2);font-size:20px;line-height:1;transition:transform .25s;flex:none}details.q[open] summary:after{transform:rotate(45deg)}
details.q p{margin:0 0 16px;color:var(--muted);font-size:14px;animation:up .4s both}

/* cta: radar + planet */
.cta{position:relative;text-align:center;padding:150px 0 230px;overflow:hidden;isolation:isolate}
.radar{position:absolute;left:50%;top:44%;width:0;height:0;z-index:-1;pointer-events:none}
.radar i{position:absolute;left:50%;top:50%;width:var(--s);height:var(--s);margin:calc(var(--s)/-2) 0 0 calc(var(--s)/-2);border-radius:50%;border:1px dashed rgba(167,139,250,.35);animation:spin var(--t) linear infinite}
.radar i:nth-child(even){animation-direction:reverse;border-style:dotted;border-color:rgba(196,181,253,.28)}
.radar i.pulse{border:1px solid rgba(196,181,253,.6);animation:pulse 4s ease-out infinite;animation-delay:var(--d)}
@keyframes spin{to{transform:rotate(360deg)}}@keyframes pulse{0%{transform:scale(.2);opacity:.9}100%{transform:scale(1.6);opacity:0}}
.cta .mark{width:70px;height:46px;margin:0 auto 18px;animation:float 6s ease-in-out infinite;filter:drop-shadow(0 0 18px rgba(167,139,250,.8))}.cta h2{margin-bottom:10px}.cta p{color:var(--muted);margin:0 0 24px}
.planet{position:absolute;left:50%;top:100%;width:220vw;height:220vw;max-width:2600px;max-height:2600px;margin-top:-190px;transform:translateX(-50%);border-radius:50%;background:#040406;z-index:-1;
box-shadow:0 -1px 0 1px rgba(233,227,255,.95),0 -8px 24px rgba(196,181,253,.7),0 -40px 120px rgba(139,92,246,.55),0 -120px 260px rgba(109,40,217,.35)}
@media(max-width:700px){.planet{margin-top:-120px}}
.sky{position:absolute;inset:0;z-index:-1;pointer-events:none;background-image:radial-gradient(1.2px 1.2px at 12% 30%,#fff,transparent),radial-gradient(1px 1px at 28% 70%,#fff,transparent),radial-gradient(1.5px 1.5px at 45% 20%,#c4b5fd,transparent),radial-gradient(1px 1px at 62% 55%,#fff,transparent),radial-gradient(1.4px 1.4px at 78% 25%,#fff,transparent),radial-gradient(1px 1px at 88% 68%,#c4b5fd,transparent),radial-gradient(1.2px 1.2px at 35% 45%,#fff,transparent),radial-gradient(1px 1px at 70% 80%,#fff,transparent),radial-gradient(1.2px 1.2px at 8% 75%,#fff,transparent),radial-gradient(1px 1px at 93% 40%,#fff,transparent);animation:twinkle 4s ease-in-out infinite}
@keyframes twinkle{0%,100%{opacity:.5}50%{opacity:1}}
.comet{position:absolute;top:var(--t);left:var(--l);width:180px;height:2px;border-radius:2px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.9));box-shadow:0 0 10px rgba(196,181,253,.9);transform:rotate(-35deg);transform-origin:100% 50%;opacity:0;animation:shoot 7s ease-in infinite;animation-delay:var(--d);z-index:-1;pointer-events:none}
@keyframes shoot{0%{opacity:0;transform:rotate(-35deg) translateX(240px)}6%{opacity:1}22%{opacity:0;transform:rotate(-35deg) translateX(-360px)}100%{opacity:0;transform:rotate(-35deg) translateX(-360px)}}

/* footer */
footer{border-top:1px solid rgba(255,255,255,.05);padding:44px 0 30px;font-size:13.5px;color:var(--muted);position:relative;z-index:1;background:var(--bg)}
.fcols{display:grid;grid-template-columns:1.4fr repeat(3,1fr);gap:24px}.fcols h4{color:var(--text);font-size:13px;margin:0 0 12px;font-weight:600}.fcols a{display:block;color:var(--muted);margin:6px 0}.fcols a:hover{color:var(--text)}
.fbot{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:34px;padding-top:18px;border-top:1px solid rgba(255,255,255,.05);font-size:12.5px;color:var(--dim)}
@media(max-width:760px){.fcols{grid-template-columns:1fr 1fr}}

/* inner pages */
.page{padding:50px 0 80px}.page .head{margin-bottom:26px}
.auth{max-width:420px;margin:56px auto 80px;padding:30px 28px}.auth form{display:grid;gap:10px;margin-top:18px}.auth form button{justify-content:center;margin-top:4px}.err{color:var(--bad);min-height:20px;font-size:13.5px;margin:0}
.auth .note{font-size:13px;color:var(--dim);margin:14px 0 0}
table{width:100%;border-collapse:collapse;font-size:14px}td,th{padding:10px 8px;border-top:1px solid rgba(255,255,255,.06);vertical-align:top;text-align:start}th{color:var(--muted);font-weight:500;font-size:12.5px}
.st{font-size:12px;border-radius:999px;padding:3px 10px;border:1px solid var(--line)}.st.on{color:var(--ok)}.st.off{color:var(--bad)}.st.warn{color:var(--warn)}
.acts form{display:inline}.tbl{overflow-x:auto}.kpis{display:flex;gap:12px;flex-wrap:wrap}.kpi{background:rgba(255,255,255,.03);border:1px solid var(--line);border-radius:12px;padding:10px 16px}.kpi b{font-size:20px;display:block}
ol.terms{margin:0;padding-inline-start:20px}ol.terms li{margin:10px 0;color:#c9c4de}

@media(prefers-reduced-motion:reduce){body,.nav,.hero .pill,.hero .lead,.hero .actions,.mockwrap,.hint,.hero h1 .w,.tok,.beam,.cone,.cta .mark,.xh,.helix i,.floor,.sky,.comet,.smoke,.radar i,.disc,.gtrack,.plan.pop .sweep,.mod .art .ping:before,.mod .art .ping:after,.btn:after,button:after{animation:none!important}
.hero h1 .w,.words .w,.rv,.stat,.lines span,.xh,.tok,.panel,.applyv .m-row,.applyv .rp{opacity:1!important;transform:none!important;filter:none!important;transition:none!important}.lines span{opacity:.6!important}.mock,.ba-card,.ba-w,.mod{transform:none!important}.mod .art .bar i{transform:none;transition:none}.marq .track{transform:none!important}
.helix path{stroke-dashoffset:0!important}.comet,.radar i.pulse{display:none}.stage-wrap{height:auto}.stage{position:static;height:auto}.frame{min-height:0;display:grid;gap:14px;padding:14px}.panel{position:relative;grid-template-columns:1fr;padding:18px;border:1px solid var(--line);border-radius:14px}.steps-row{display:none}}`;

/* ============================================================ JS (landing) ============================================================ */
const JS = `
(function(){
var rm=matchMedia('(prefers-reduced-motion: reduce)').matches,rtl=document.dir==='rtl',fa=document.documentElement.lang==='fa';
var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);if(e.target.dataset.n)countUp(e.target);}})},{rootMargin:'0px 0px -8% 0px',threshold:.15});
document.querySelectorAll('.rv,.words,.stat,.mod,.stats,.rep-stack').forEach(function(el){io.observe(el)});
document.querySelectorAll('.stat').forEach(function(el,i){el.style.setProperty('--i',i)});
function countUp(el){var b=el.querySelector('b'),n=+el.dataset.n,suf=el.dataset.suf||'';function fmt(x){return fa?x.toLocaleString('fa-IR'):String(x)}
  if(rm){b.textContent=fmt(n)+suf;return}var t0=performance.now(),d=1100;(function f(now){var p=Math.min(1,(now-t0)/d);p=1-Math.pow(1-p,3);b.textContent=fmt(Math.round(n*p))+suf;if(p<1)requestAnimationFrame(f)})(t0)}
// cursor light + magnetic buttons + tilt on the module cards
var light=document.querySelector('.light');
addEventListener('mousemove',function(e){if(light){light.style.setProperty('--lx',e.clientX+'px');light.style.setProperty('--ly',e.clientY+'px')}},{passive:true});
if(!rm){document.querySelectorAll('.btn,button').forEach(function(b){b.addEventListener('mousemove',function(e){var r=b.getBoundingClientRect();b.style.transform='translate('+((e.clientX-r.left-r.width/2)*.12)+'px,'+((e.clientY-r.top-r.height/2)*.25)+'px)'});b.addEventListener('mouseleave',function(){b.style.transform=''})});
  document.querySelectorAll('.mod').forEach(function(m){m.addEventListener('mousemove',function(e){var r=m.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;m.style.setProperty('--mx',(x*100)+'%');m.style.setProperty('--my',(y*100)+'%');m.style.setProperty('--ry',((x-.5)*8)+'deg');m.style.setProperty('--rx',((.5-y)*8)+'deg')});m.addEventListener('mouseleave',function(){m.style.setProperty('--rx','0deg');m.style.setProperty('--ry','0deg')})})}
// hero: particle field, token parallax, mock tilt (scroll + mouse), watermark parallax
var c=document.getElementById('stars');if(c&&!rm){var x=c.getContext('2d'),W,H,P=[],mx=0,my=0;function rs(){W=c.width=c.offsetWidth*devicePixelRatio;H=c.height=c.offsetHeight*devicePixelRatio}rs();addEventListener('resize',rs);
  for(var i=0;i<70;i++)P.push({x:Math.random(),y:Math.random(),z:.3+Math.random()*.7,s:Math.random()*6.28});
  addEventListener('mousemove',function(e){mx=(e.clientX/innerWidth-.5);my=(e.clientY/innerHeight-.5);var dx=mx*-36;document.querySelectorAll('.tok').forEach(function(t,i){t.style.setProperty('--px',dx*(1+i%3*.5)+'px')})},{passive:true});
  (function draw(t){x.clearRect(0,0,W,H);for(var i=0;i<P.length;i++){var p=P[i],px=(p.x+mx*.03*p.z)*W,py=(p.y+my*.03*p.z+Math.sin(t/2200+p.s)*.004)*H,r=(0.8+p.z*1.4)*devicePixelRatio;x.beginPath();x.arc(px,py,r,0,6.28);x.fillStyle='rgba(196,181,253,'+(0.15+p.z*.45)+')';x.fill()}requestAnimationFrame(draw)})(0)}
var mock=document.querySelector('.mock'),mw=document.querySelector('.mockwrap'),wmk=document.querySelector('.wmk'),hint=document.querySelector('.hint');
if(mw&&!rm){mw.addEventListener('mousemove',function(e){var r=mw.getBoundingClientRect();mock.style.setProperty('--ty',(((e.clientX-r.left)/r.width-.5)*10)+'deg')});mw.addEventListener('mouseleave',function(){mock.style.setProperty('--ty','0deg')})}
// scroll-driven: marquee bands, mock straightening, before/after, pinned stage
var track=document.querySelector('.marq:not(.big) .track'),track2=document.querySelector('.marq.big .track'),ba=document.querySelector('.ba'),sw=document.querySelector('.stage-wrap'),panels=document.querySelectorAll('.panel'),steps=document.querySelectorAll('.steps-row .st'),prog=document.querySelector('.steps-row .prog'),cbs=document.querySelectorAll('.frame .cb'),off=0,cur=-1;
function onScroll(){var y=scrollY;if(hint)hint.classList.toggle('off',y>120);if(rm)return;
  if(mock){var r=mock.getBoundingClientRect(),p=Math.min(1,Math.max(0,1-(r.top-80)/(innerHeight*.6)));mock.style.setProperty('--tilt',(14*(1-p)).toFixed(2)+'deg')}
  if(wmk)wmk.style.setProperty('--py',(y*.25)+'px');
  if(ba){var rb=ba.getBoundingClientRect(),pb=Math.min(1,Math.max(0,1-(rb.top+rb.height*.5-innerHeight*.55)/(innerHeight*.9)));ba.style.setProperty('--p',pb.toFixed(3))}
  if(sw&&innerWidth>820){var rs2=sw.getBoundingClientRect(),h=rs2.height-innerHeight,ps=Math.min(1,Math.max(0,-rs2.top/Math.max(1,h)));var idx=Math.min(panels.length-1,Math.floor(ps*panels.length));if(prog)prog.style.setProperty('--p',ps.toFixed(3));
    if(idx!==cur){cur=idx;panels.forEach(function(p,i){p.classList.toggle('on',i===idx)});steps.forEach(function(s,i){s.classList.toggle('on',i===idx)});cbs.forEach(function(cb,i){cb.classList.toggle('on',(i+idx)%2===0)})}}}
addEventListener('scroll',onScroll,{passive:true});addEventListener('resize',onScroll);onScroll();
if(innerWidth<=820||rm){panels.forEach(function(p){p.classList.add('on')})}
steps.forEach(function(s,i){s.addEventListener('click',function(){if(!sw)return;var top=sw.getBoundingClientRect().top+scrollY,h=sw.offsetHeight-innerHeight;scrollTo({top:top+h*(i+.5)/panels.length,behavior:'smooth'})})});
function band(tr,speed,dir){if(!tr||rm)return;var half=tr.scrollWidth/2,o0=0;(function m(){o0+=speed;var o=((o0+scrollY*0.7*dir)%half+half)%half;tr.style.transform='translateX('+((rtl?1:-1)*o)+'px)';requestAnimationFrame(m)})()}
band(track,0.5,1);band(track2,0.4,-1);
})();`;

/* ============================================================ layout ============================================================ */
export function layout(ctx, title, body, opts = {}) {
  const { env, lang, user, url, nonce } = ctx, name = env.APP_NAME || 'FPS Boost', fa = lang === 'fa';
  const other = fa ? 'en' : 'fa'; const u = new URL(url); u.searchParams.set('lang', other);
  const font = fa ? 'Vazirmatn:wght@400;500;600;700;800' : 'Inter:wght@400;500;600;700;800';
  return `<!doctype html><html lang="${lang}" dir="${fa ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(name)} · ${esc(title)}</title><meta name="description" content="${esc(t(lang, 'lead'))}"><meta name="theme-color" content="#050507">
<link rel="icon" href="/favicon.png" type="image/png"><link rel="apple-touch-icon" href="/icon-192.png"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${font}&display=swap">
<style nonce="${nonce}">${CSS}</style></head><body class="${fa ? 'fa' : ''}"><div class="light" aria-hidden="true"></div>
<header class="nav"><div class="wrap"><a class="brand" href="/">${MARK}${esc(name)}</a>
<nav class="links"><a href="/#features">${t(lang, 'nav_features')}</a><a href="/#how">${t(lang, 'nav_how')}</a><a href="/#games">${t(lang, 'nav_games')}</a><a href="/#plans">${t(lang, 'nav_plans')}</a><a href="/#faq">${t(lang, 'nav_faq')}</a></nav>
<div class="navr"><a class="lang" href="${esc(u.pathname + u.search)}" hreflang="${other}">${t(lang, 'lang')}</a>${user ? `<a class="btn ghost" href="/account">${t(lang, 'account')}</a>` : `<a class="lang login" href="/login">${t(lang, 'login')}</a><a class="btn" href="/download">${t(lang, 'download_short')}</a>`}</div></div></header>
<main>${body}</main>
<footer><div class="wrap"><div class="fcols"><div><a class="brand" href="/">${MARK}${esc(name)}</a><p class="muted" style="max-width:300px;margin:12px 0 0">${t(lang, 'cta_sub')}</p></div>
<div><h4>${t(lang, 'f_product')}</h4><a href="/download">${t(lang, 'download')}</a><a href="/#features">${t(lang, 'nav_features')}</a><a href="/#games">${t(lang, 'nav_games')}</a><a href="/#plans">${t(lang, 'nav_plans')}</a></div>
<div><h4>${t(lang, 'f_account')}</h4>${user ? `<a href="/account">${t(lang, 'account')}</a><a href="/logout">${t(lang, 'logout')}</a>` : `<a href="/login">${t(lang, 'login')}</a><a href="/register">${t(lang, 'register')}</a>`}</div>
<div><h4>${t(lang, 'f_legal')}</h4><a href="/terms">${t(lang, 'terms')}</a><a href="/#faq">${t(lang, 'nav_faq')}</a>${env.SUPPORT ? `<div>${t(lang, 'support')}: ${supportLink(env.SUPPORT)}</div>` : ''}</div></div>
<div class="fbot"><span>© ${new Date().getFullYear()} ${esc(name)} · ${t(lang, 'rights')}</span><span>fpsboost.ir</span></div></div></footer>
${opts.script ? `<script nonce="${nonce}">${opts.script}</script>` : ''}</body></html>`;
}

/* ============================================================ landing ============================================================ */
const words = (s, cls = '') => s.split(' ').map((w, i) => `<span class="wm"><span class="w${cls ? ' ' + cls : ''}" style="--i:${i}">${esc(w)}</span></span>`).join(' ');
const ICONS = {
  pc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>',
  net: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 9a15 15 0 0 1 20 0M5.5 12.5a10 10 0 0 1 13 0M9 16a5 5 0 0 1 6 0"/><circle cx="12" cy="19.5" r="1"/></svg>',
  win: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 5.5 11 4.4v7.1H3zM12 4.2 21 3v8.5h-9zM3 12.5h8v7.1L3 18.5zM12 12.5h9V21l-9-1.2z"/></svg>',
  game: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 8h12a4 4 0 0 1 4 4v2a4 4 0 0 1-7 2.6L14 16h-4l-1 .6A4 4 0 0 1 2 14v-2a4 4 0 0 1 4-4z"/><path d="M7 11v3M5.5 12.5h3M16.5 11.5h.01M18.5 13.5h.01"/></svg>',
};
const GAMES = [['MC', 'Minecraft', 'g_mc', '#3fa34d', '#1f6b2d'], ['VAL', 'Valorant', 'g_val', '#ff4655', '#b8202d'], ['CS2', 'Counter-Strike 2', 'g_cs2', '#f5a623', '#c26f00'], ['FN', 'Fortnite', 'g_fn', '#4f8bff', '#2a4fd6'],
  ['APX', 'Apex Legends', 'g_apex', '#ff5a36', '#b02d12'], ['WZ', 'Warzone', 'g_wz', '#8b93a5', '#374151'], ['RBX', 'Roblox', 'g_rbx', '#e53e3e', '#9b1c1c'], ['GTA', 'GTA V', 'g_gta', '#22c55e', '#15803d']];

function mockHtml(ctx) {
  const { lang } = ctx, fa = lang === 'fa';
  const L = fa ? { dash: 'داشبورد', pc: 'سیستم', net: 'شبکه', win: 'ویندوز', games: 'بازی‌ها', tools: 'ابزارها', apply: 'اعمال پیشنهادی', fps: 'میانگین FPS', ping: 'پینگ', ft: 'فریم‌تایم', before: 'قبل', after: 'بعد', act: 'تنظیمات فعال', preset: 'پریست Valorant', pr: '۶ تنظیم · آماده', ap: 'اعمال' }
    : { dash: 'Dashboard', pc: 'PC', net: 'Network', win: 'Windows', games: 'Games', tools: 'Tools', apply: 'Apply recommended', fps: 'Avg FPS', ping: 'Ping', ft: 'Frame time', before: 'before', after: 'after', act: 'Active tweaks', preset: 'Valorant preset', pr: '6 tweaks · ready', ap: 'Apply' };
  const nav = [['dash', 1], ['pc', 0], ['net', 0], ['win', 0], ['games', 0], ['tools', 0]].map(([k, on]) => `<div class="m-nav${on ? ' on' : ''}"><i></i>${L[k]}</div>`).join('');
  const rows = [['Game DVR', 1], ['Power plan: Ultimate', 1], ['Nagle', 1], ['DNS 1.1.1.1', 1], ['GPU scheduling', 0]].map(([k, on]) => `<div class="m-row"><span>${k}</span><i class="sw${on ? ' on' : ''}"></i></div>`).join('');
  return `<div class="mockwrap"><div class="mock" aria-hidden="true">
<div class="m-side"><div class="b">${MARK}FPS BOOST</div>${nav}</div>
<div class="m-main"><div class="m-top"><b>${L.dash}</b><span class="btn">${L.apply}</span></div>
<div class="m-tiles"><div class="m-tile"><span>${L.fps}</span><b>142<em>+38</em></b></div><div class="m-tile"><span>${L.ping}</span><b>18 ms<em>−11</em></b></div><div class="m-tile"><span>${L.ft}</span><b>7.0 ms<em>−2.6</em></b></div></div>
<div class="m-chart"><div class="l"><span>FPS</span><span>${L.before} / ${L.after}</span></div><svg viewBox="0 0 400 110" preserveAspectRatio="none"><defs><linearGradient id="mg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a78bfa" stop-opacity=".35"/><stop offset="1" stop-color="#a78bfa" stop-opacity="0"/></linearGradient></defs>
<path class="a2" d="M0 60 C40 55 60 70 100 62 S160 40 200 44 S260 30 300 26 S360 22 400 18 V110 H0 Z"/><path class="p1" d="M0 84 C40 80 60 92 100 86 S160 78 200 82 S260 74 300 78 S360 72 400 74"/><path class="p2" d="M0 60 C40 55 60 70 100 62 S160 40 200 44 S260 30 300 26 S360 22 400 18"/></svg></div></div>
<div class="m-right"><h4>${L.act}</h4>${rows}<div class="m-preset"><b>${L.preset}</b><span>${L.pr}</span><span class="btn">${L.ap}</span></div></div>
</div><div class="mockglow"></div></div>`;
}
export function landing(ctx) {
  const { env, lang } = ctx, fa = lang === 'fa', P = Object.entries(prices(env));
  const toks = [['tok1', '8%', '30%', '', '-120px', '40px', '1.3s'], ['tok2', '84%', '26%', '', '120px', '40px', '1.45s'], ['tok3', '4%', '58%', 'far', '-100px', '60px', '1.6s'], ['tok4', '86%', '52%', '', '120px', '60px', '1.5s'],
    ['tok5', '14%', '78%', 'far', '-80px', '80px', '1.9s'], ['tok6', '78%', '76%', 'far', '80px', '80px', '1.8s'], ['tok7', '20%', '10%', '', '-60px', '-60px', '1.7s'], ['tok8', '72%', '8%', '', '60px', '-60px', '1.55s'],
    ['144', '26%', '20%', 'sq', '-80px', '-40px', '1.65s'], ['+38', '68%', '40%', 'sq', '90px', '20px', '1.75s'], ['−11', '10%', '46%', 'sq far', '-90px', '30px', '2s'], ['7.0', '90%', '14%', 'sq far', '90px', '-40px', '1.95s'], ['1%', '80%', '64%', 'sq', '80px', '60px', '1.85s'], ['60', '4%', '16%', 'sq far', '-80px', '-50px', '2.1s']]
    .map(([k, l, tp, cls, fx, fy, e]) => `<span class="tok ${cls}" style="left:${l};top:${tp};--fx:${fx};--fy:${fy};--e:${e}">${k.startsWith('tok') ? t(lang, k) : k}</span>`).join('');
  const stats = [[20, '+', 'st1'], [4, '', 'st2'], [8, '', 'st3'], [100, '%', 'st4']].map(([v, s, k]) => `<div class="stat" data-n="${v}" data-suf="${s}"><b>0</b><span>${t(lang, k)}</span></div>`).join('');
  const mq = t(lang, 'marquee'); const track = [...mq, ...mq].map(w => `<span>${esc(w)}</span><em>✦</em>`).join('');
  const mq2 = t(lang, 'marquee2'); const track2 = [...mq2, ...mq2].map(w => `<span>${esc(w)}</span><em>✦</em>`).join('');
  const discs = [['-520px', '520px', '30deg', '0s'], ['-300px', '620px', '55deg', '-3s'], ['-80px', '680px', '70deg', '-6s'], ['160px', '640px', '50deg', '-9s'], ['400px', '560px', '35deg', '-12s']].map(([x, s, a, d]) => `<i class="disc" style="--x:${x};--s:${s};--a:${a};--d:${d}"></i>`).join('');
  const arts = {
    m1: `<div class="art"><span class="lbl" style="top:14px">FPS</span><div class="bar" style="top:34px;--w:52%"><i></i></div><span class="lbl" style="top:58px">1% low</span><div class="bar" style="top:78px;--w:84%"><i></i></div></div>`,
    m2: `<div class="art"><div class="grid"></div><div class="ping"></div><span class="lbl" style="top:84px;left:50%;transform:translateX(-50%);color:var(--accent3)">18 ms</span></div>`,
    m3: `<div class="art"><div class="win"><i></i><i></i><i></i></div></div>`,
    m4: `<div class="art"><div class="keys"><i>-XX:+UseG1GC</i><i>-high</i><i>raw input</i><i>-novid</i><i>priority: high</i></div></div>`,
  };
  const mods = [['m1', 'pc'], ['m2', 'net'], ['m3', 'win'], ['m4', 'game']].map(([k, ic], i) => `<div class="card mod rv ${i % 2 ? 'r' : 'l'} d${i % 4}">${arts[k]}<div class="ic">${ICONS[ic]}</div><h3>${t(lang, k)}</h3><p>${t(lang, k + 'd')}</p></div>`).join('');
  const gcards = GAMES.map(([ab, name, k, g1, g2]) => `<div class="gcard" style="--g1:${g1};--g2:${g2}"><span class="gw">${ab}</span><i class="circ"></i><span class="gi">${ab}</span><b>${name}</b><span>${t(lang, k)}</span></div>`).join('');
  // the pinned stage: three panels, one per step
  const pop = P[1] || P[0] || ['3', 390000];
  const stack = P.slice(0, 3).reverse().map(([m, price], i) => `<div class="sc" style="--dx:${(i - 1) * 26}px;--dy:${(2 - i) * -14}px;--rr:${(i - 1) * 6}deg"><b>${fmtNum(lang, m)} ${t(lang, Number(m) > 1 ? 'months' : 'month')}</b><span>${fmtNum(lang, price)} ${t(lang, 'toman')}</span><br><span class="btn">${t(lang, 'buy')}</span></div>`).join('');
  const applyRows = [['Game DVR', 'off'], ['Power plan', 'Ultimate'], ['Nagle', 'off'], ['DNS', '1.1.1.1']].map(([k, v], i) => `<div class="m-row" style="--i:${i}"><span>${k} · ${v}</span><i class="sw on"></i></div>`).join('');
  const panels = [
    `<div class="txt"><span class="lbl">[ ${t(lang, 'step')} ${fmtNum(lang, 1)} ]</span><h3>${t(lang, 'how1')}</h3><p>${fill(t(lang, 'how1d'), lang, env)}</p></div><div class="vis"><div class="stack">${stack}</div></div>`,
    `<div class="txt"><span class="lbl">[ ${t(lang, 'step')} ${fmtNum(lang, 2)} ]</span><h3>${t(lang, 'how2')}</h3><p>${t(lang, 'how2d')}</p></div><div class="vis"><div class="lwin"><div class="bar"><i></i><i></i><i></i></div><div class="body"><span class="chip">⬇ FPSBoost-Setup.exe · 110 MB</span><div class="f">gamer_01</div><div class="f pw">••••••••••</div><span class="btn">${t(lang, 'login')}</span></div></div></div>`,
    `<div class="txt"><span class="lbl">[ ${t(lang, 'step')} ${fmtNum(lang, 3)} ]</span><h3>${t(lang, 'how3')}</h3><p>${t(lang, 'how3d')}</p></div><div class="vis"><div class="applyv"><div class="big">60 → 144 FPS</div>${applyRows}<div class="rp">✓ ${t(lang, 'restore_ok')}</div></div></div>`,
  ].map((h, i) => `<div class="panel${i === 0 ? ' on' : ''}" data-i="${i}">${h}</div>`).join('');
  const stepsRow = [1, 2, 3].map(i => `<div class="st${i === 1 ? ' on' : ''}"><span class="lbl">[ ${t(lang, 'step')} ${fmtNum(lang, i)} ]</span><b>${t(lang, 'how' + i)}</b></div>`).join('');
  const faq = t(lang, 'faq').map(([q, a], i) => `<details class="q rv d${i % 4}"><summary>${esc(q)}</summary><p>${esc(fill(a, lang, env))}</p></details>`).join('');
  const comets = [['8%', '10%', '0s'], ['60%', '4%', '2.3s'], ['80%', '30%', '4.1s'], ['30%', '40%', '5.6s']].map(([l, tp, d]) => `<i class="comet" style="--l:${l};--t:${tp};--d:${d}"></i>`).join('');
  const radar = [['420px', '40s'], ['560px', '55s'], ['700px', '70s'], ['860px', '90s']].map(([s, tm]) => `<i style="--s:${s};--t:${tm}"></i>`).join('') + [['0s'], ['-2s']].map(([d]) => `<i class="pulse" style="--s:560px;--d:${d}"></i>`).join('');
  const lines = Array.from({ length: 6 }, (_, i) => `<span style="--i:${i}">${t(lang, 'rep_word')}</span>`).join('');
  const helix = Array.from({ length: 14 }, (_, k) => `<i style="--k:${k}"></i>`).join('') + `<svg viewBox="0 0 180 440" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="hg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c4b5fd" stop-opacity=".1"/><stop offset=".5" stop-color="#a78bfa"/><stop offset="1" stop-color="#c4b5fd" stop-opacity=".1"/></linearGradient></defs><path pathLength="1" d="M90 0 C170 40 10 100 90 140 S170 240 90 280 S10 380 90 440"/><path pathLength="1" d="M90 0 C10 40 170 100 90 140 S10 240 90 280 S170 380 90 440"/></svg>`;
  const cmpRows = [['p1', P.map(() => '✓')], ['p2', P.map(() => '✓')], ['p3', P.map(() => '✓')], ['p4', P.map(() => '✓')], ['cmp_pcs', P.map(() => fmtNum(lang, machines(env)))], ['cmp_pm', P.map(([m, price]) => fmtNum(lang, Math.round(price / Number(m) / 1000) * 1000))]];
  const cmp = `<details class="cmp"><summary>${t(lang, 'compare')}</summary><div class="card"><div class="tbl"><table><tr><th></th>${P.map(([m]) => `<th>${fmtNum(lang, m)} ${t(lang, Number(m) > 1 ? 'months' : 'month')}</th>`).join('')}</tr>${cmpRows.map(([k, vals]) => `<tr><td>${t(lang, k)}</td>${vals.map(v => `<td>${v}</td>`).join('')}</tr>`).join('')}</table></div></div></details>`;
  const body = `
<section class="hero"><div class="cone"></div><div class="beam b1"></div><div class="beam b2"></div><div class="wmk"></div><canvas id="stars"></canvas><div class="wrap">
<span class="pill"><i></i>${t(lang, 'hero_pill')}</span>
<h1>${words(t(lang, 'h1a'))} ${words(t(lang, 'h1b'), 'grad')}<br>${words(t(lang, 'h1c'))}</h1>
<p class="lead">${t(lang, 'lead')}</p><div class="hint"><i></i>${t(lang, 'scroll_hint')}</div>
<div class="actions"><a class="btn" href="/download">${t(lang, 'download')}</a><a class="btn ghost" href="/register">${t(lang, 'register')}</a></div>
${toks}${mockHtml(ctx)}
<div class="stats"><i class="xh v"></i><i class="xh h"></i>${stats}</div></div></section>
<div class="marq" aria-hidden="true"><div class="track">${track}</div></div>
<section class="s ba"><div class="wrap"><div class="head rv"><span class="pill"><i></i>${t(lang, 'ba_pill')}</span><h2 class="words">${words(t(lang, 'ba_h'))}</h2></div>
<div class="ba-row"><div class="ba-w l">${t(lang, 'ba_before')}</div><div class="ba-card"><div class="t"><b>Valorant · 1080p</b><span class="lbl">RTX 3060</span></div><div class="ba-cols">
<div class="ba-col"><span class="lbl">${t(lang, 'ba_before')}</span><b>60<small>FPS</small></b><div class="bar"><i style="--w:40%"></i></div><b>42<small>ms</small></b></div>
<div class="ba-col a"><span class="lbl">${t(lang, 'ba_after')}</span><b>144<small>FPS</small></b><div class="bar"><i style="--w:96%"></i></div><b>18<small>ms</small></b></div></div></div><div class="ba-w r">${t(lang, 'ba_after')}</div></div>
<p class="ba-cap rv">${t(lang, 'ba_cap')}</p></div></section>
<section class="s" id="features"><div class="wrap"><div class="head rv"><span class="pill"><i></i>${t(lang, 'feat_pill')}</span><h2 class="words">${words(t(lang, 'feat_h'))}</h2><p>${t(lang, 'feat_sub')}</p></div><div class="mods">${mods}</div></div></section>
<section class="s" id="how"><div class="wrap"><div class="stage-wrap"><div class="stage"><div class="head rv" style="margin-bottom:0"><span class="pill"><i></i>${t(lang, 'how_pill')}</span><h2 class="words">${words(t(lang, 'how_h'))}</h2><p>${t(lang, 'how_sub')}</p></div>
<div class="frame"><div class="smoke"></div><i class="cb tl on"></i><i class="cb tr"></i><i class="cb bl"></i><i class="cb br on"></i>${panels}</div>
<div class="steps-row"><i class="prog"></i>${stepsRow}</div></div></div></div></section>
<section class="s rep"><div class="wrap"><div class="rep-grid"><div class="rep-copy rv l"><span class="pill"><i></i>${t(lang, 'rep_pill')}</span><h2 class="words">${words(t(lang, 'rep_h'))}</h2><p>${t(lang, 'rep_sub')}</p><div class="actions"><a class="btn" href="/download">${t(lang, 'download')}</a><a class="btn ghost" href="/#features">${t(lang, 'nav_features')}</a></div></div>
<div class="rep-stack" aria-hidden="true"><div class="helix">${helix}</div><div class="lines">${lines}</div></div></div></div></section>
<section class="s games" id="games"><div class="floor"></div><div class="floorglow"></div><div class="wrap"><div class="head rv"><span class="pill"><i></i>${t(lang, 'games_pill')}</span><h2 class="words">${words(t(lang, 'games_h'))}</h2><p>${t(lang, 'games_sub')}</p></div></div>
<div class="gwrap"><div class="gtrack">${gcards}${gcards}</div></div></section>
<section class="s" id="plans"><div class="wrap"><div class="head rv"><span class="pill"><i></i>${t(lang, 'pricing')}</span><h2 class="words">${words(t(lang, 'plans_h'))}</h2><p>${fill(t(lang, 'plans_sub'), lang, env)}</p></div>${plansHtml(ctx)}${cmp}</div></section>
<section class="s" id="faq"><div class="wrap"><div class="head rv"><span class="pill"><i></i>${t(lang, 'faq_pill')}</span><h2 class="words">${words(t(lang, 'faq_h'))}</h2></div><div class="faqbox"><i class="cb tl on"></i><i class="cb tr"></i><i class="cb bl"></i><i class="cb br on"></i><div class="faq">${faq}</div></div></div></section>
<section class="cta"><div class="sky"></div>${comets}<div class="radar">${radar}</div><div class="planet"></div><div class="wrap rv">${MARK}<h2>${t(lang, 'cta_h')}</h2><p>${t(lang, 'cta_sub')}</p><div class="actions"><a class="btn" href="/register">${t(lang, 'get_started')}</a><a class="btn ghost" href="/download">${t(lang, 'download')}</a></div></div></section>
<div class="marq big" aria-hidden="true"><div class="discs">${discs}</div><div class="track">${track2}</div></div>`;
  return layout(ctx, t(lang, 'home'), body, { script: JS });
}
export function plansHtml(ctx) {
  const { env, lang, user } = ctx, P = Object.entries(prices(env)), pop = P.length > 1 ? P[1][0] : null;
  return `<div class="plans">${P.map(([m, price], i) => `<div class="card plan${m === pop ? ' pop' : ''} rv d${i}">${m === pop ? `<i class="sweep"></i><span class="pill tag"><i></i>${t(lang, 'popular')}</span>` : ''}<h3>${fmtNum(lang, m)} ${t(lang, Number(m) > 1 ? 'months' : 'month')}</h3>
<div class="price">${fmtNum(lang, price)}<small>${t(lang, 'toman')}</small></div>${Number(m) > 1 ? `<div class="per">${fmtNum(lang, Math.round(price / Number(m) / 1000) * 1000)} ${t(lang, 'toman')} ${t(lang, 'per_month')}</div>` : ''}
<ul><li>${t(lang, 'p1')}</li><li>${t(lang, 'p2')}</li><li>${t(lang, 'p3')}</li><li>${t(lang, 'p4')}</li></ul>
<form method="post" action="${user ? '/pay/start' : '/register'}"><input type="hidden" name="plan" value="${m}"><button class="${m === pop ? '' : 'ghost'}">${t(lang, user ? 'buy' : 'register')}</button></form></div>`).join('')}</div>`;
}

/* ============================================================ inner pages ============================================================ */
const REVEAL_JS = `var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{threshold:.1});document.querySelectorAll('.rv').forEach(function(el){io.observe(el)});`;
export function authPage(ctx, kind, error) {
  const { lang } = ctx, login = kind === 'login';
  return layout(ctx, t(lang, login ? 'login' : 'register'), `<div class="wrap"><section class="card auth"><span class="pill"><i></i>${t(lang, login ? 'login' : 'register')}</span><h2 style="margin-top:14px">${t(lang, login ? 'welcome_back' : 'create_h')}</h2>
<form method="post" action="/${kind}"><input name="username" placeholder="${t(lang, 'username')}" autocomplete="username" required autofocus pattern="[A-Za-z0-9_]{3,20}" maxlength="20"><input name="password" type="password" placeholder="${t(lang, 'password')}" autocomplete="${login ? 'current' : 'new'}-password" required minlength="8" maxlength="200"><p class="err">${esc(error || '')}</p><button>${t(lang, login ? 'login' : 'register')}</button></form>
<p class="note">${t(lang, 'auth_note')}</p><p class="muted">${login ? `${t(lang, 'no_account')} <a href="/register">${t(lang, 'register')}</a>` : `${t(lang, 'have_account')} <a href="/login">${t(lang, 'login')}</a>`}</p></section></div>`);
}
const TERMS = {
  en: ['FPS Boost is a subscription for a Windows 10/11 app. The price of each plan is shown on the site in Toman; the subscription starts the moment the payment is verified.',
    'One account works on up to {n} PCs at a time. You can reset your devices from your account page. Sharing or reselling an account is not allowed and can get it disabled.',
    'The app needs administrator rights because it changes Windows settings. Every change it makes is backed up and can be reverted from the app, and it creates a System Restore point before “Apply recommended”.',
    'Results depend on your hardware, your games and your internet connection — we do not promise a specific FPS or ping number.',
    'Refunds: if the app does not run on your PC and support cannot fix it, you get your money back within 7 days of the purchase. Contact support with your username and the payment tracking code.',
    'Payments go through Zarinpal. We never see or store your card details; we keep your username, a hashed password, your device IDs and your payment records.'],
  fa: ['FPS Boost اشتراک یک برنامهٔ ویندوز ۱۰/۱۱ است. قیمت هر پلن به تومان روی سایت نوشته شده و اشتراک از لحظهٔ تأیید پرداخت شروع می‌شود.',
    'هر حساب همزمان روی حداکثر {n} کامپیوتر کار می‌کند و از صفحهٔ حساب می‌توانید دستگاه‌ها را ریست کنید. اشتراک‌گذاری یا فروش حساب مجاز نیست و ممکن است حساب غیرفعال شود.',
    'برنامه برای تغییر تنظیمات ویندوز به دسترسی Administrator نیاز دارد. از هر تغییر نسخهٔ پشتیبان گرفته می‌شود و از داخل برنامه قابل بازگشت است، و قبل از «اعمال پیشنهادی» یک System Restore Point ساخته می‌شود.',
    'نتیجه به سخت‌افزار، بازی و اینترنت شما بستگی دارد — عدد مشخصی برای FPS یا پینگ تضمین نمی‌شود.',
    'بازگشت وجه: اگر برنامه روی کامپیوتر شما اجرا نشود و پشتیبانی نتواند مشکل را حل کند، تا ۷ روز پس از خرید مبلغ کامل برگردانده می‌شود. با نام کاربری و کد پیگیری پرداخت به پشتیبانی پیام دهید.',
    'پرداخت از طریق زرین‌پال انجام می‌شود. اطلاعات کارت شما نزد ما ذخیره نمی‌شود؛ فقط نام کاربری، رمز هش‌شده، شناسهٔ دستگاه‌ها و سوابق پرداخت نگهداری می‌شود.'],
};
export function termsPage(ctx) {
  const { env, lang } = ctx;
  return layout(ctx, t(lang, 'terms'), `<div class="wrap page"><div class="head"><span class="pill"><i></i>${t(lang, 'f_legal')}</span><h2 style="margin-top:14px">${t(lang, 'terms')}</h2></div><section class="card"><ol class="terms">${(TERMS[lang] || TERMS.en).map(x => `<li>${esc(fill(x, lang, env))}</li>`).join('')}</ol>${env.SUPPORT ? `<p>${t(lang, 'support')}: ${supportLink(env.SUPPORT)}</p>` : ''}</section></div>`);
}
export function accountPage(ctx, payments, isActive) {
  const { env, lang, user } = ctx, active = isActive(user); let machinesList = []; try { machinesList = JSON.parse(user.machines || '[]'); } catch (e) {}
  return layout(ctx, t(lang, 'account'), `<div class="wrap page"><div class="head"><span class="pill"><i></i>${t(lang, 'account')}</span><h2 style="margin-top:14px">${esc(user.username)}</h2></div><div class="grid">
<section class="card"><h3>${t(lang, 'subscription')}</h3><p>${active ? `<span class="st on">${t(lang, 'active_until')} ${fmtDate(lang, user.expires)}</span>` : `<span class="st off">${t(lang, user.expires ? 'expired' : 'no_sub')}</span>`}</p><div class="actions" style="justify-content:flex-start"><a class="btn" href="/download">${t(lang, 'download')}</a><a class="btn ghost" href="/logout">${t(lang, 'logout')}</a></div></section>
<section class="card"><h3>${t(lang, 'devices')}</h3><p class="muted">${fill(t(lang, 'devices_hint'), lang, env)}</p><p>${machinesList.length ? machinesList.map(m => `<span class="st">${esc(m.slice(0, 10))}…</span> `).join('') : `<span class="muted">${t(lang, 'none')}</span>`}</p><form method="post" action="/account/devices"><button class="ghost sm">${t(lang, 'reset_devices')}</button></form></section>
<section class="card wide"><h3 style="margin-bottom:14px">${t(lang, 'pricing')}</h3>${plansHtml(ctx)}</section>
<section class="card wide"><h3>${t(lang, 'payments')}</h3>${payments.length ? `<div class="tbl"><table><tr><th>${t(lang, 'date')}</th><th>${t(lang, 'plan')}</th><th>${t(lang, 'amount')}</th><th>${t(lang, 'status')}</th><th>${t(lang, 'ref')}</th></tr>${payments.map(p => `<tr><td>${fmtDate(lang, p.created)}</td><td>${fmtNum(lang, p.months)} ${t(lang, 'months')}</td><td>${fmtNum(lang, p.amount)} ${t(lang, 'toman')}</td><td><span class="st ${p.status === 'paid' ? 'on' : p.status === 'pending' ? 'warn' : 'off'}">${p.status}</span></td><td>${esc(p.ref_id || '—')}</td></tr>`).join('')}</table></div>` : `<p class="muted">${t(lang, 'none')}</p>`}</section></div></div>`, { script: REVEAL_JS });
}
export function payPage(ctx, ok, pay) {
  const { lang } = ctx;
  return layout(ctx, t(lang, 'payments'), `<div class="wrap"><section class="card auth"><h2>${ok ? '✅ ' + t(lang, 'pay_success') : '❌ ' + t(lang, 'pay_failed')}</h2>${pay.ref_id ? `<p>${t(lang, 'ref')}: <b>${esc(pay.ref_id)}</b></p>` : ''}<p><a class="btn" href="/account">${t(lang, 'back_account')}</a></p></section></div>`);
}
export function messagePage(ctx, title, text) {
  return layout(ctx, title, `<div class="wrap"><section class="card auth"><h2>${esc(title)}</h2>${text ? `<p class="muted">${esc(text)}</p>` : ''}<p><a class="btn ghost" href="/">${t(ctx.lang, 'home')}</a></p></section></div>`);
}
export function adminPage(ctx, users, stats, payments, q) {
  const now = Date.now();
  const row = (u) => { let m = []; try { m = JSON.parse(u.machines || '[]'); } catch (e) {}
    const st = u.disabled ? '<span class="st off">disabled</span>' : (u.expires || 0) > now ? `<span class="st on">until ${new Date(u.expires).toISOString().slice(0, 10)}</span>` : '<span class="st warn">no sub</span>';
    const f = (act, label, extra = '', cls = 'ghost sm') => `<form method="post"><input type="hidden" name="id" value="${u.id}"><input type="hidden" name="act" value="${act}">${extra}<button class="${cls}">${label}</button></form>`;
    return `<tr><td><b>${esc(u.username)}</b><div class="muted">${esc(u.note || '')}</div></td><td>${st}</td><td>${u.last_seen ? new Date(u.last_seen).toISOString().slice(0, 16).replace('T', ' ') : 'never'}</td><td>${m.length}</td><td>${new Date(u.created).toISOString().slice(0, 10)}</td>
<td class="acts">${f('extend', '+1 mo', '<input type="hidden" name="months" value="1">')} ${f('extend', '+3', '<input type="hidden" name="months" value="3">')} ${f('extend', '+12', '<input type="hidden" name="months" value="12">')} ${f('expire', 'expire')} ${f('toggle', u.disabled ? 'enable' : 'disable')} ${f('devices', 'reset devices')} ${f('password', 'set pw', '<input name="password" placeholder="new password" class="inl">')} ${f('note', 'note', `<input name="note" value="${esc(u.note || '')}" placeholder="note" class="inl">`)} ${f('delete', 'delete', '', 'danger sm')}</td></tr>`; };
  return layout(ctx, 'admin', `<style nonce="${ctx.nonce}">.inl{width:120px;display:inline;padding:4px 8px;border-radius:8px}</style><div class="wrap page"><div class="grid">
<section class="card wide"><h3>Stats</h3><div class="kpis"><div class="kpi"><b>${stats.users}</b>users</div><div class="kpi"><b>${stats.active}</b>active subs</div><div class="kpi"><b>${stats.seen24h}</b>seen 24h</div><div class="kpi"><b>${stats.payments}</b>payments</div><div class="kpi"><b>${fmtNum('en', stats.revenue)}</b>Toman</div></div></section>
<section class="card wide"><h3>Users</h3><form method="get" class="actions" style="justify-content:flex-start"><input name="q" value="${esc(q)}" placeholder="search username" style="max-width:260px"><button class="ghost sm">Search</button></form>
<div class="tbl"><table><tr><th>User</th><th>Subscription</th><th>Last seen</th><th>Devices</th><th>Created</th><th></th></tr>${users.map(row).join('') || '<tr><td colspan="6" class="muted">no users</td></tr>'}</table></div></section>
<section class="card wide"><h3>Payments</h3><div class="tbl"><table><tr><th>Date</th><th>User</th><th>Plan</th><th>Amount</th><th>Status</th><th>Ref</th><th>Card</th></tr>${payments.map(p => `<tr><td>${new Date(p.created).toISOString().slice(0, 16).replace('T', ' ')}</td><td>${esc(p.username || p.user_id)}</td><td>${p.months} mo</td><td>${fmtNum('en', p.amount)}</td><td><span class="st ${p.status === 'paid' ? 'on' : p.status === 'pending' ? 'warn' : 'off'}">${p.status}</span></td><td>${esc(p.ref_id || '')}</td><td>${esc(p.card_pan || '')}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">none</td></tr>'}</table></div></section></div></div>`);
}
