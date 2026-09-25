/* ============================================================
   fpsboost.ir — the website + account API for FPS Boost — one Cloudflare Worker (free plan) with a Durable Object (SQLite) for
   accounts, subscriptions and payments. Persian (RTL) + English.

     /                       landing: features, prices, download, login/register
     /register /login /logout
     /account                subscription status, buy a plan (Zarinpal), devices, payment history, download
     /pay/start (POST plan)  → Zarinpal request → redirect to the gateway
     /pay/callback           Zarinpal returns here (?Authority=&Status=OK|NOK) → verify → extend the subscription
     /download               → DOWNLOAD_URL (the latest installer, e.g. a GitHub release)
     /admin                  users, subscriptions, payments, stats — HTTP basic auth with ADMIN_USER / ADMIN_PASS
     /api/app/login          the desktop app: {username, password, machine} → {token, expires, ...}
     /api/app/status         {token} → {active, expires, username}  (the app checks daily; offline grace is in the app)

   Vars (wrangler.toml): APP_NAME, PRICES (JSON months→Toman), DOWNLOAD_URL, MAX_MACHINES, ZARINPAL_SANDBOX
   Secrets: ADMIN_USER, ADMIN_PASS, ZARINPAL_MERCHANT, SESSION_SECRET
   Passwords: PBKDF2-SHA256 (100k) + per-user salt. Sessions/tokens: HMAC-SHA256 over "id.exp[.machine]".
   ============================================================ */
import { DurableObject } from 'cloudflare:workers';

const BUILD = '2026-09-25a';
const SESSION_DAYS = 30, APP_TOKEN_DAYS = 30, MONTH_MS = 30 * 86400000;

export default {
  async fetch(request, env, ctx) {
    try { return await route(request, env); }
    catch (e) { console.log('error: ' + (e && e.stack || e)); return new Response('server error', { status: 500 }); }
  },
};

/* ============================================================ storage (Durable Object, SQLite) ============================================================ */
export class Store extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS users(
      id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, pass_hash TEXT NOT NULL, salt TEXT NOT NULL, created INTEGER NOT NULL,
      expires INTEGER, disabled INTEGER NOT NULL DEFAULT 0, last_seen INTEGER, machines TEXT NOT NULL DEFAULT '[]', note TEXT)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS payments(
      authority TEXT PRIMARY KEY, user_id TEXT NOT NULL, months INTEGER NOT NULL, amount INTEGER NOT NULL, status TEXT NOT NULL,
      ref_id TEXT, card_pan TEXT, created INTEGER NOT NULL, verified INTEGER)`);
    this.sql.exec(`CREATE INDEX IF NOT EXISTS payments_user ON payments(user_id, created)`);
  }
  async fetch(request) {
    const b = await request.json(), now = Date.now();
    const one = (q, ...a) => this.sql.exec(q, ...a).toArray()[0] || null;
    switch (b.op) {
      case 'user.create': {
        if (one('SELECT 1 FROM users WHERE username = ?', b.username)) return Response.json({ error: 'taken' }, { status: 409 });
        const id = crypto.randomUUID();
        this.sql.exec('INSERT INTO users(id, username, pass_hash, salt, created, expires) VALUES(?, ?, ?, ?, ?, ?)', id, b.username, b.pass_hash, b.salt, now, b.expires || null);
        return Response.json(one('SELECT * FROM users WHERE id = ?', id));
      }
      case 'user.byName': return Response.json(one('SELECT * FROM users WHERE username = ?', b.username));
      case 'user.byId': return Response.json(one('SELECT * FROM users WHERE id = ?', b.id));
      case 'user.update': {
        const u = one('SELECT * FROM users WHERE id = ?', b.id); if (!u) return Response.json({ error: 'no such user' }, { status: 404 });
        for (const k of ['expires', 'disabled', 'machines', 'last_seen', 'note', 'pass_hash', 'salt']) if (k in b) this.sql.exec(`UPDATE users SET ${k} = ? WHERE id = ?`, b[k], b.id);
        return Response.json(one('SELECT * FROM users WHERE id = ?', b.id));
      }
      case 'user.extend': {   // subscription: from now if expired, from the current end if still active
        const u = one('SELECT * FROM users WHERE id = ?', b.id); if (!u) return Response.json({ error: 'no such user' }, { status: 404 });
        const from = Math.max(now, u.expires || 0), exp = from + b.months * MONTH_MS;
        this.sql.exec('UPDATE users SET expires = ? WHERE id = ?', exp, b.id);
        return Response.json(one('SELECT * FROM users WHERE id = ?', b.id));
      }
      case 'user.delete': { this.sql.exec('DELETE FROM users WHERE id = ?', b.id); this.sql.exec('DELETE FROM payments WHERE user_id = ?', b.id); return Response.json({ ok: true }); }
      case 'user.list': {
        const q = '%' + (b.q || '') + '%';
        return Response.json(this.sql.exec('SELECT * FROM users WHERE username LIKE ? ORDER BY created DESC LIMIT 500', q).toArray());
      }
      case 'payment.create': {
        this.sql.exec('INSERT INTO payments(authority, user_id, months, amount, status, created) VALUES(?, ?, ?, ?, ?, ?)', b.authority, b.user_id, b.months, b.amount, 'pending', now);
        return Response.json({ ok: true });
      }
      case 'payment.get': return Response.json(one('SELECT * FROM payments WHERE authority = ?', b.authority));
      case 'payment.update': {
        this.sql.exec('UPDATE payments SET status = ?, ref_id = ?, card_pan = ?, verified = ? WHERE authority = ?', b.status, b.ref_id || null, b.card_pan || null, b.status === 'paid' ? now : null, b.authority);
        return Response.json({ ok: true });
      }
      case 'payment.listByUser': return Response.json(this.sql.exec('SELECT * FROM payments WHERE user_id = ? ORDER BY created DESC LIMIT 50', b.user_id).toArray());
      case 'payment.listAll': return Response.json(this.sql.exec('SELECT p.*, u.username FROM payments p LEFT JOIN users u ON u.id = p.user_id ORDER BY p.created DESC LIMIT 300').toArray());
      case 'stats': {
        const users = one('SELECT COUNT(*) n FROM users').n, active = one('SELECT COUNT(*) n FROM users WHERE expires > ? AND disabled = 0', now).n;
        const paid = one('SELECT COUNT(*) n, COALESCE(SUM(amount), 0) sum FROM payments WHERE status = ?', 'paid');
        const seen = one('SELECT COUNT(*) n FROM users WHERE last_seen > ?', now - 86400000).n;
        return Response.json({ users, active, seen24h: seen, payments: paid.n, revenue: paid.sum });
      }
    }
    return Response.json({ error: 'bad op' }, { status: 400 });
  }
}
const store = (env) => env.STORE.get(env.STORE.idFromName('main'));
async function db(env, body) { const r = await store(env).fetch('https://store/', { method: 'POST', body: JSON.stringify(body) }); return r.json(); }

/* ============================================================ crypto: passwords, sessions, app tokens ============================================================ */
const enc = new TextEncoder();
async function hashPassword(password, saltB64) {
  const salt = saltB64 ? b64d(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, key, 256);
  return { hash: b64e(new Uint8Array(bits)), salt: b64e(salt) };
}
async function verifyPassword(password, user) { const { hash } = await hashPassword(password, user.salt); return timingSafeEqual(hash, user.pass_hash); }
function timingSafeEqual(a, b) { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
async function hmacKey(env) {
  const raw = enc.encode('optimizer:' + (env.SESSION_SECRET || env.ADMIN_PASS || 'dev'));
  return crypto.subtle.importKey('raw', await crypto.subtle.digest('SHA-256', raw), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
async function sign(env, payload) { return payload + '.' + b64e(new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(env), enc.encode(payload)))); }
async function verifySigned(env, token) {
  const i = token.lastIndexOf('.'); if (i < 0) return null;
  const payload = token.slice(0, i), sig = b64d(token.slice(i + 1)); if (!sig) return null;
  try { if (!await crypto.subtle.verify('HMAC', await hmacKey(env), sig, enc.encode(payload))) return null; } catch (e) { return null; }
  const parts = payload.split('.'); if (Number(parts[1]) < Date.now()) return null;
  return parts;   // [id, exp, ...]
}
const b64e = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function b64d(s) { try { const bin = atob(String(s).replace(/-/g, '+').replace(/_/g, '/')); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; } catch (e) { return null; } }

/* per-isolate brute-force brake: 8 failures per IP → 10 minutes */
const fails = new Map();
function braked(ip) { const f = fails.get(ip); return !!(f && f.until > Date.now()); }
function failed(ip) { const f = fails.get(ip) || { n: 0, until: 0 }; f.n++; if (f.n >= 8) { f.until = Date.now() + 600000; f.n = 0; } fails.set(ip, f); }

/* ============================================================ routing ============================================================ */
async function route(request, env) {
  const url = new URL(request.url), p = url.pathname, method = request.method;
  const ip = request.headers.get('cf-connecting-ip') || '?';
  const lang = pickLang(request, url);
  const langCookie = url.searchParams.has('lang') ? `lang=${lang}; Path=/; Max-Age=31536000; SameSite=Lax` : null;
  const user = await sessionUser(request, env);
  const ctx = { env, lang, user, url, ip, langCookie };

  if (p.startsWith('/api/app/')) return appApi(request, env, p, ip);
  if (p === '/download') return redirect(env.DOWNLOAD_URL || '/');
  if (p === '/favicon.svg' || p === '/favicon.ico') return new Response(ICON_SVG, { headers: { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=86400' } });
  if (p === '/terms') return html(termsPage(ctx), 200, langCookie);
  if (p === '/health') return Response.json({ ok: true, build: BUILD });
  if (p === '/') return html(landing(ctx), 200, langCookie);
  if (p === '/login') return method === 'POST' ? doLogin(request, ctx) : html(authPage(ctx, 'login'), 200, langCookie);
  if (p === '/register') return method === 'POST' ? doRegister(request, ctx) : html(authPage(ctx, 'register'), 200, langCookie);
  if (p === '/logout') return redirect('/', 's=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax');
  if (p === '/account') return user ? html(accountPage(ctx, await db(env, { op: 'payment.listByUser', user_id: user.id })), 200, langCookie) : redirect('/login');
  if (p === '/account/devices' && method === 'POST') { if (!user) return redirect('/login'); await db(env, { op: 'user.update', id: user.id, machines: '[]' }); return redirect('/account'); }
  if (p === '/pay/start' && method === 'POST') return user ? payStart(request, ctx) : redirect('/login');
  if (p === '/pay/callback') return payCallback(ctx);
  if (p.startsWith('/admin')) return admin(request, ctx);
  return html(layout(ctx, '404', `<section class="card"><h2>404</h2><p><a href="/">${t(lang, 'home')}</a></p></section>`), 404);
}
const html = (body, status = 200, cookie) => new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', ...(cookie ? { 'set-cookie': cookie } : {}) } });
const redirect = (to, cookie) => new Response(null, { status: 302, headers: cookie ? { location: to, 'set-cookie': cookie } : { location: to } });
function pickLang(request, url) {
  const q = url.searchParams.get('lang'); if (q === 'fa' || q === 'en') return q;
  const m = (request.headers.get('cookie') || '').match(/(?:^|;\s*)lang=(fa|en)/); if (m) return m[1];
  return /\bfa\b/i.test(request.headers.get('accept-language') || '') ? 'fa' : 'en';
}
async function sessionUser(request, env) {
  const m = (request.headers.get('cookie') || '').match(/(?:^|;\s*)s=([^;]+)/); if (!m) return null;
  const parts = await verifySigned(env, m[1]); if (!parts) return null;
  const u = await db(env, { op: 'user.byId', id: parts[0] });
  return u && !u.disabled ? u : null;
}
const isActive = (u) => !!u && !u.disabled && (u.expires || 0) > Date.now();
async function readForm(request) { const f = await request.formData().catch(() => null); return (k) => f ? String(f.get(k) || '').trim() : ''; }

/* ---- register / login (website) ---- */
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
async function doRegister(request, ctx) {
  const { env, lang, ip } = ctx; const f = await readForm(request);
  const username = f('username').toLowerCase(), password = f('password');
  if (braked(ip)) return html(authPage(ctx, 'register', t(lang, 'err_braked')), 429);
  if (!USERNAME_RE.test(username)) return html(authPage(ctx, 'register', t(lang, 'err_username')), 400);
  if (password.length < 8) return html(authPage(ctx, 'register', t(lang, 'err_password')), 400);
  const { hash, salt } = await hashPassword(password);
  const u = await db(env, { op: 'user.create', username, pass_hash: hash, salt, expires: Number(env.TRIAL_DAYS) > 0 ? Date.now() + Number(env.TRIAL_DAYS) * 86400000 : null });
  if (u.error) return html(authPage(ctx, 'register', t(lang, 'err_taken')), 409);
  return redirect('/account', await sessionCookie(env, u.id));
}
async function doLogin(request, ctx) {
  const { env, lang, ip } = ctx; const f = await readForm(request);
  if (braked(ip)) return html(authPage(ctx, 'login', t(lang, 'err_braked')), 429);
  const u = await db(env, { op: 'user.byName', username: f('username').toLowerCase() });
  if (!u || !(await verifyPassword(f('password'), u))) { failed(ip); return html(authPage(ctx, 'login', t(lang, 'err_login')), 401); }
  if (u.disabled) return html(authPage(ctx, 'login', t(lang, 'err_disabled')), 403);
  return redirect('/account', await sessionCookie(env, u.id));
}
async function sessionCookie(env, id) {
  const tok = await sign(env, `${id}.${Date.now() + SESSION_DAYS * 86400000}`);
  return `s=${tok}; Path=/; Max-Age=${SESSION_DAYS * 86400}; HttpOnly; Secure; SameSite=Lax`;
}

/* ---- the desktop app ---- */
async function appApi(request, env, p, ip) {
  if (request.method !== 'POST') return Response.json({ error: 'method' }, { status: 405 });
  const b = await request.json().catch(() => ({}));
  const max = Number(env.MAX_MACHINES) || 2;
  if (p === '/api/app/login') {
    if (braked(ip)) return Response.json({ error: 'too many attempts, wait 10 minutes' }, { status: 429 });
    const u = await db(env, { op: 'user.byName', username: String(b.username || '').toLowerCase().trim() });
    if (!u || !(await verifyPassword(String(b.password || ''), u))) { failed(ip); return Response.json({ error: 'wrong username or password' }, { status: 401 }); }
    if (u.disabled) return Response.json({ error: 'account disabled' }, { status: 403 });
    const machine = String(b.machine || '').slice(0, 64);
    let machines = []; try { machines = JSON.parse(u.machines || '[]'); } catch (e) {}
    if (machine && !machines.includes(machine)) {
      if (machines.length >= max) return Response.json({ error: `this account is already used on ${max} devices — reset devices on the website` }, { status: 403 });
      machines.push(machine);
    }
    await db(env, { op: 'user.update', id: u.id, machines: JSON.stringify(machines), last_seen: Date.now() });
    const token = await sign(env, `${u.id}.${Date.now() + APP_TOKEN_DAYS * 86400000}.${machine}`);
    return Response.json({ token, username: u.username, active: isActive(u), expires: u.expires || 0, now: Date.now() });
  }
  if (p === '/api/app/status') {
    const parts = await verifySigned(env, String(b.token || '')); if (!parts) return Response.json({ error: 'token expired, log in again' }, { status: 401 });
    const u = await db(env, { op: 'user.byId', id: parts[0] }); if (!u || u.disabled) return Response.json({ error: 'account disabled' }, { status: 403 });
    let machines = []; try { machines = JSON.parse(u.machines || '[]'); } catch (e) {}
    if (parts[2] && !machines.includes(parts[2])) return Response.json({ error: 'this device was removed from the account, log in again' }, { status: 403 });
    await db(env, { op: 'user.update', id: u.id, last_seen: Date.now() });
    return Response.json({ username: u.username, active: isActive(u), expires: u.expires || 0, now: Date.now() });
  }
  return Response.json({ error: 'not found' }, { status: 404 });
}

/* ---- Zarinpal ---- */
const zp = (env) => env.ZARINPAL_SANDBOX === '1' ? 'https://sandbox.zarinpal.com/pg' : 'https://payment.zarinpal.com/pg';
function prices(env) { try { return JSON.parse(env.PRICES || '{}'); } catch (e) { return {}; } }
async function payStart(request, ctx) {
  const { env, user, url, lang } = ctx; const f = await readForm(request);
  const months = Number(f('plan')), amount = prices(env)[months];
  if (!amount) return html(layout(ctx, 'error', `<section class="card"><h2>${t(lang, 'err_plan')}</h2></section>`), 400);
  if (!env.ZARINPAL_MERCHANT) return html(layout(ctx, 'error', `<section class="card"><h2>${t(lang, 'err_gateway')}</h2></section>`), 503);
  const r = await fetch(zp(env) + '/v4/payment/request.json', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({
    merchant_id: env.ZARINPAL_MERCHANT, amount, currency: 'IRT', description: `${env.APP_NAME || 'Optimizer'} — ${months} ${lang === 'fa' ? 'ماه' : 'month(s)'} — ${user.username}`,
    callback_url: `${url.origin}/pay/callback`, metadata: { order_id: user.id } }) });
  const j = await r.json().catch(() => ({}));
  const authority = j.data && j.data.authority;
  if (!authority) { console.log('zarinpal request failed: ' + JSON.stringify(j)); return html(layout(ctx, 'error', `<section class="card"><h2>${t(lang, 'err_gateway')}</h2><p class="muted">${esc(JSON.stringify(j.errors || j))}</p></section>`), 502); }
  await db(env, { op: 'payment.create', authority, user_id: user.id, months, amount });
  return redirect(zp(env) + '/StartPay/' + authority);
}
async function payCallback(ctx) {
  const { env, url, lang } = ctx;
  const authority = url.searchParams.get('Authority') || '', status = url.searchParams.get('Status');
  const pay = await db(env, { op: 'payment.get', authority });
  if (!pay) return html(layout(ctx, 'error', `<section class="card"><h2>${t(lang, 'pay_unknown')}</h2></section>`), 404);
  if (pay.status === 'paid') return html(payPage(ctx, true, pay), 200);
  if (status !== 'OK') { await db(env, { op: 'payment.update', authority, status: 'failed' }); return html(payPage(ctx, false, pay), 200); }
  const r = await fetch(zp(env) + '/v4/payment/verify.json', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ merchant_id: env.ZARINPAL_MERCHANT, amount: pay.amount, authority }) });
  const j = await r.json().catch(() => ({})), code = j.data && j.data.code;
  if (code === 100 || code === 101) {
    await db(env, { op: 'payment.update', authority, status: 'paid', ref_id: String(j.data.ref_id || ''), card_pan: j.data.card_pan || '' });
    await db(env, { op: 'user.extend', id: pay.user_id, months: pay.months });
    return html(payPage(ctx, true, { ...pay, ref_id: j.data.ref_id }), 200);
  }
  console.log('zarinpal verify failed: ' + JSON.stringify(j));
  await db(env, { op: 'payment.update', authority, status: 'failed' });
  return html(payPage(ctx, false, pay), 200);
}

/* ---- admin (basic auth) ---- */
async function admin(request, ctx) {
  const { env, url } = ctx;
  const a = request.headers.get('authorization') || '', want = 'Basic ' + btoa(`${env.ADMIN_USER || ''}:${env.ADMIN_PASS || ''}`);
  if (!env.ADMIN_USER || !env.ADMIN_PASS || !timingSafeEqual(a, want)) return new Response('admin', { status: 401, headers: { 'www-authenticate': 'Basic realm="admin"' } });
  if (request.method === 'POST') {
    const f = await readForm(request); const id = f('id'), act = f('act');
    if (act === 'extend') await db(env, { op: 'user.extend', id, months: Number(f('months')) || 1 });
    else if (act === 'expire') await db(env, { op: 'user.update', id, expires: Date.now() });
    else if (act === 'toggle') { const u = await db(env, { op: 'user.byId', id }); if (u) await db(env, { op: 'user.update', id, disabled: u.disabled ? 0 : 1 }); }
    else if (act === 'devices') await db(env, { op: 'user.update', id, machines: '[]' });
    else if (act === 'password') { const { hash, salt } = await hashPassword(f('password')); if (f('password').length >= 8) await db(env, { op: 'user.update', id, pass_hash: hash, salt }); }
    else if (act === 'note') await db(env, { op: 'user.update', id, note: f('note').slice(0, 200) });
    else if (act === 'delete') await db(env, { op: 'user.delete', id });
    return redirect('/admin' + (url.search || ''));
  }
  const q = url.searchParams.get('q') || '';
  const [users, stats, payments] = await Promise.all([db(env, { op: 'user.list', q }), db(env, { op: 'stats' }), db(env, { op: 'payment.listAll' })]);
  return html(adminPage(ctx, users, stats, payments, q));
}

/* ============================================================ pages ============================================================ */
const STR = {
  en: {
    home: 'Home', tagline: 'Lower ping. Higher FPS. One click.', lead: 'A Windows app that applies the proven network and gaming tweaks for you — with a full undo — so your games run smoother and your connection reacts faster.',
    f1: 'FPS tweaks', f1d: 'Power plan, Game DVR, GPU scheduling, fullscreen optimizations, background apps, mouse acceleration — with one click and one click back.',
    f2: 'Network tweaks', f2d: 'Nagle off, fast DNS (Cloudflare / Shecan / 403), TCP tuning, throttling index, QoS reserve, flush & reset tools.',
    f3: 'Before / after', f3d: 'Ping test before and after, so you see what changed. Everything you apply is backed up and can be reverted.',
    pricing: 'Plans', month: 'month', months: 'months', toman: 'Toman', buy: 'Buy', download: 'Download for Windows', login: 'Log in', register: 'Create account', logout: 'Log out',
    username: 'Username', password: 'Password', account: 'My account', subscription: 'Subscription', active_until: 'Active until', expired: 'Expired', no_sub: 'No active subscription',
    devices: 'Devices', devices_hint: 'The app works on up to {n} PCs per account. Reset if you changed your PC.', reset_devices: 'Reset devices', payments: 'Payments', none: 'none yet',
    pay_success: 'Payment received — your subscription is active.', pay_failed: 'Payment was not completed.', pay_unknown: 'Unknown payment.', ref: 'Tracking code', back_account: 'Back to my account',
    err_username: 'Username: 3–20 letters, digits or _', err_password: 'Password: at least 8 characters', err_taken: 'That username is taken', err_login: 'Wrong username or password', err_disabled: 'This account is disabled',
    err_braked: 'Too many attempts — wait 10 minutes', err_plan: 'Unknown plan', err_gateway: 'Payment gateway is not available right now', status: 'Status', date: 'Date', amount: 'Amount', plan: 'Plan',
    have_account: 'Already have an account?', no_account: 'No account yet?', how: 'How it works', how1: 'Create an account and buy a plan.', how2: 'Download the app and log in with the same username.', how3: 'Press "Apply recommended" — done. Revert anything any time.',
    lang: 'فارسی', terms: 'Terms & refunds', support: 'Support',
  },
  fa: {
    home: 'خانه', tagline: 'پینگ کمتر. FPS بیشتر. با یک کلیک.', lead: 'برنامه‌ای برای ویندوز که تنظیمات ثابت‌شدهٔ شبکه و گیمینگ را برایتان اعمال می‌کند — با قابلیت بازگشت کامل — تا بازی‌ها روان‌تر و اینترنت سریع‌تر واکنش نشان دهد.',
    f1: 'بهینه‌سازی FPS', f1d: 'پاور پلن، Game DVR، زمان‌بندی GPU، بهینه‌سازی فول‌اسکرین، برنامه‌های پس‌زمینه، شتاب ماوس — با یک کلیک اعمال و با یک کلیک برگشت.',
    f2: 'بهینه‌سازی شبکه', f2d: 'خاموش کردن Nagle، DNS سریع (کلادفلر / شکن / ۴۰۳)، تنظیم TCP، محدودیت شبکه، رزرو QoS، ابزار فلاش و ریست.',
    f3: 'قبل / بعد', f3d: 'تست پینگ قبل و بعد تا تفاوت را ببینید. از هر تغییری نسخهٔ پشتیبان گرفته می‌شود و قابل بازگشت است.',
    pricing: 'اشتراک', month: 'ماهه', months: 'ماهه', toman: 'تومان', buy: 'خرید', download: 'دانلود برای ویندوز', login: 'ورود', register: 'ساخت حساب', logout: 'خروج',
    username: 'نام کاربری', password: 'رمز عبور', account: 'حساب من', subscription: 'اشتراک', active_until: 'فعال تا', expired: 'منقضی شده', no_sub: 'اشتراک فعالی ندارید',
    devices: 'دستگاه‌ها', devices_hint: 'برنامه روی حداکثر {n} کامپیوتر برای هر حساب کار می‌کند. اگر کامپیوترتان عوض شد ریست کنید.', reset_devices: 'ریست دستگاه‌ها', payments: 'پرداخت‌ها', none: 'هنوز چیزی نیست',
    pay_success: 'پرداخت انجام شد — اشتراک شما فعال است.', pay_failed: 'پرداخت کامل نشد.', pay_unknown: 'پرداخت ناشناخته.', ref: 'کد پیگیری', back_account: 'بازگشت به حساب',
    err_username: 'نام کاربری: ۳ تا ۲۰ حرف انگلیسی، عدد یا _', err_password: 'رمز عبور: حداقل ۸ کاراکتر', err_taken: 'این نام کاربری گرفته شده', err_login: 'نام کاربری یا رمز اشتباه است', err_disabled: 'این حساب غیرفعال است',
    err_braked: 'تلاش‌های زیاد — ۱۰ دقیقه صبر کنید', err_plan: 'پلن ناشناخته', err_gateway: 'درگاه پرداخت فعلاً در دسترس نیست', status: 'وضعیت', date: 'تاریخ', amount: 'مبلغ', plan: 'پلن',
    have_account: 'حساب دارید؟', no_account: 'حساب ندارید؟', how: 'چطور کار می‌کند', how1: 'حساب بسازید و یک پلن بخرید.', how2: 'برنامه را دانلود کنید و با همان نام کاربری وارد شوید.', how3: 'دکمهٔ «اعمال پیشنهادی» را بزنید — تمام. هر وقت خواستید برگردانید.',
    lang: 'English', terms: 'قوانین و بازگشت وجه', support: 'پشتیبانی',
  },
};
const t = (lang, k) => (STR[lang] || STR.en)[k] || STR.en[k] || k;
const fmtNum = (lang, n) => lang === 'fa' ? Number(n).toLocaleString('fa-IR') : Number(n).toLocaleString('en-US');
const fmtDate = (lang, ms) => new Date(ms).toLocaleDateString(lang === 'fa' ? 'fa-IR' : 'en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

const CSS = `
:root{color-scheme:dark;--bg:#0a0c12;--card:#12161f;--line:#232a3a;--text:#e7eaf1;--muted:#98a1b3;--accent:#5b8cff;--accent2:#7c5cff;--ok:#5fd38d;--bad:#ff6b6b;--warn:#ffb457}
*{box-sizing:border-box}html,body{margin:0;min-height:100%}
body{background:radial-gradient(1200px 600px at 20% -10%,#1a2340 0%,transparent 60%),radial-gradient(900px 500px at 110% 10%,#2a1a4a 0%,transparent 55%),var(--bg);color:var(--text);font:15px/1.6 Vazirmatn,system-ui,-apple-system,Segoe UI,Roboto,Tahoma,sans-serif}
a{color:var(--accent);text-decoration:none}
button,.btn{display:inline-block;background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;border:0;border-radius:10px;padding:10px 18px;font-weight:600;cursor:pointer;font-size:14.5px;font-family:inherit}
.btn.ghost,button.ghost{background:#1b2130;border:1px solid var(--line)}button.sm{padding:5px 10px;font-size:12.5px;border-radius:7px}button.danger{background:#3a1c22;border:1px solid #5a2a33;color:#ffb3b3}
input,select{background:#0b0e15;color:var(--text);border:1px solid var(--line);border-radius:9px;padding:10px 12px;font-size:14.5px;width:100%;font-family:inherit}
.wrap{max-width:1000px;margin:0 auto;padding:24px 16px 60px}
header{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:26px}
.brand{display:flex;align-items:center;gap:12px;color:var(--text)}.logo svg{width:22px;height:22px}.logo{width:38px;height:38px;border-radius:11px;background:linear-gradient(135deg,var(--accent),var(--accent2));display:grid;place-items:center;font-weight:800}
nav{display:flex;gap:14px;align-items:center;flex-wrap:wrap}nav a{color:var(--muted)}nav a:hover{color:var(--text)}
h1{font-size:22px;margin:0}.hero{padding:34px 0 26px}.hero h2{font-size:34px;line-height:1.2;margin:0 0 10px}.hero p{color:var(--muted);font-size:17px;max-width:680px;margin:0 0 20px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:20px;min-width:0}.card.wide{grid-column:1/-1}
h2{font-size:17px;margin:0 0 10px}h3{font-size:15px;margin:0 0 6px}.muted{color:var(--muted);font-size:13.5px}
.plans{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px}.plan{text-align:center}.plan .price{font-size:26px;font-weight:800;margin:6px 0}.plan .per{color:var(--muted)}
table{width:100%;border-collapse:collapse;font-size:14px}td,th{padding:9px 6px;border-top:1px solid var(--line);vertical-align:top;text-align:start}th{color:var(--muted);font-weight:500;font-size:12.5px}
.st{font-size:12px;border-radius:999px;padding:2px 9px;border:1px solid var(--line)}.st.on{color:var(--ok)}.st.off{color:var(--bad)}.st.warn{color:var(--warn)}
.auth{max-width:400px;margin:40px auto}.auth form{display:grid;gap:10px;margin-top:14px}.err{color:var(--bad);min-height:20px;font-size:13.5px;margin:0}
.actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;align-items:center}.acts form{display:inline}
ol.how{margin:0;padding-inline-start:20px;color:#c9cfdb}ol.how li{margin:6px 0}
.tbl{overflow-x:auto}.stats{display:flex;gap:12px;flex-wrap:wrap}.stat{background:#0b0e15;border:1px solid var(--line);border-radius:10px;padding:10px 14px}.stat b{font-size:20px;display:block}
footer{margin-top:40px;color:var(--muted);font-size:13px;text-align:center;display:grid;gap:4px}.terms li{margin:8px 0;color:#c9cfdb}`;

function layout(ctx, title, body) {
  const { env, lang, user, url } = ctx, name = env.APP_NAME || 'FPS Boost', fa = lang === 'fa';
  const other = fa ? 'en' : 'fa'; const u = new URL(url); u.searchParams.set('lang', other);
  return `<!doctype html><html lang="${lang}" dir="${fa ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(name)} · ${esc(title)}</title><meta name="description" content="${esc(t(lang, 'lead'))}"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><style>${CSS}</style></head><body><div class="wrap">
<header><a class="brand" href="/"><div class="logo">${BOLT}</div><h1>${esc(name)}</h1></a>
<nav><a href="/#plans">${t(lang, 'pricing')}</a><a href="/download">${t(lang, 'download')}</a>${user ? `<a href="/account">${t(lang, 'account')}</a><a href="/logout">${t(lang, 'logout')}</a>` : `<a href="/login">${t(lang, 'login')}</a><a class="btn" href="/register">${t(lang, 'register')}</a>`}<a href="${esc(u.pathname + u.search)}">${t(lang, 'lang')}</a></nav></header>
${body}
<footer><div><a href="/terms">${t(lang, 'terms')}</a>${env.SUPPORT ? ` · ${t(lang, 'support')}: ${supportLink(env.SUPPORT)}` : ''}</div><div>${esc(name)} · ${new Date().getFullYear()}</div></footer></div></body></html>`;
}
const BOLT = '<svg viewBox="0 0 1024 1024" aria-hidden="true"><path fill="#fff" d="M590 130 270 580h220l-70 320 340-480H535l105-290z"/></svg>';
const ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5b8cff"/><stop offset="1" stop-color="#7c5cff"/></linearGradient></defs><rect width="1024" height="1024" rx="230" fill="url(#g)"/><path fill="#fff" d="M590 130 270 580h220l-70 320 340-480H535l105-290z"/></svg>';
// SUPPORT: an email, a https:// link or a @telegram handle
function supportLink(v) {
  const href = v.includes('@') && !v.startsWith('@') ? 'mailto:' + v : v.startsWith('@') ? 'https://t.me/' + v.slice(1) : v;
  return `<a href="${esc(href)}" dir="ltr">${esc(v)}</a>`;
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
function termsPage(ctx) {
  const { env, lang } = ctx, n = fmtNum(lang, Number(env.MAX_MACHINES) || 2);
  return layout(ctx, t(lang, 'terms'), `<section class="card"><h2>${t(lang, 'terms')}</h2><ol class="terms">${(TERMS[lang] || TERMS.en).map(x => `<li>${esc(x.replace('{n}', n))}</li>`).join('')}</ol>${env.SUPPORT ? `<p>${t(lang, 'support')}: ${supportLink(env.SUPPORT)}</p>` : ''}</section>`);
}
function plansHtml(ctx) {
  const { env, lang, user } = ctx, P = prices(env);
  return `<div class="plans">${Object.entries(P).map(([m, price]) => `<div class="card plan"><h3>${fmtNum(lang, m)} ${t(lang, Number(m) > 1 ? 'months' : 'month')}</h3><div class="price">${fmtNum(lang, price)}</div><div class="per">${t(lang, 'toman')}</div>
<form method="post" action="${user ? '/pay/start' : '/register'}" style="margin-top:12px"><input type="hidden" name="plan" value="${m}"><button>${t(lang, user ? 'buy' : 'register')}</button></form></div>`).join('')}</div>`;
}
function landing(ctx) {
  const { lang } = ctx;
  return layout(ctx, t(lang, 'home'), `<section class="hero"><h2>${t(lang, 'tagline')}</h2><p>${t(lang, 'lead')}</p><div class="actions"><a class="btn" href="/download">${t(lang, 'download')}</a><a class="btn ghost" href="/register">${t(lang, 'register')}</a></div></section>
<div class="grid"><section class="card"><h2>${t(lang, 'f1')}</h2><p class="muted">${t(lang, 'f1d')}</p></section><section class="card"><h2>${t(lang, 'f2')}</h2><p class="muted">${t(lang, 'f2d')}</p></section><section class="card"><h2>${t(lang, 'f3')}</h2><p class="muted">${t(lang, 'f3d')}</p></section>
<section class="card wide" id="plans"><h2>${t(lang, 'pricing')}</h2>${plansHtml(ctx)}</section>
<section class="card wide"><h2>${t(lang, 'how')}</h2><ol class="how"><li>${t(lang, 'how1')}</li><li>${t(lang, 'how2')}</li><li>${t(lang, 'how3')}</li></ol></section></div>`);
}
function authPage(ctx, kind, error) {
  const { lang } = ctx, login = kind === 'login';
  return layout(ctx, t(lang, login ? 'login' : 'register'), `<section class="card auth"><h2>${t(lang, login ? 'login' : 'register')}</h2>
<form method="post" action="/${kind}"><input name="username" placeholder="${t(lang, 'username')}" autocomplete="username" required autofocus pattern="[A-Za-z0-9_]{3,20}"><input name="password" type="password" placeholder="${t(lang, 'password')}" autocomplete="${login ? 'current' : 'new'}-password" required minlength="8"><p class="err">${esc(error || '')}</p><button>${t(lang, login ? 'login' : 'register')}</button></form>
<p class="muted">${login ? `${t(lang, 'no_account')} <a href="/register">${t(lang, 'register')}</a>` : `${t(lang, 'have_account')} <a href="/login">${t(lang, 'login')}</a>`}</p></section>`);
}
function accountPage(ctx, payments) {
  const { env, lang, user } = ctx, active = isActive(user); let machines = []; try { machines = JSON.parse(user.machines || '[]'); } catch (e) {}
  return layout(ctx, t(lang, 'account'), `<div class="grid">
<section class="card"><h2>${t(lang, 'subscription')}</h2><p><b>${esc(user.username)}</b></p><p>${active ? `<span class="st on">${t(lang, 'active_until')} ${fmtDate(lang, user.expires)}</span>` : `<span class="st off">${t(lang, user.expires ? 'expired' : 'no_sub')}</span>`}</p><div class="actions"><a class="btn" href="/download">${t(lang, 'download')}</a></div></section>
<section class="card"><h2>${t(lang, 'devices')}</h2><p class="muted">${t(lang, 'devices_hint').replace('{n}', fmtNum(lang, Number(env.MAX_MACHINES) || 2))}</p><p>${machines.length ? machines.map(m => `<span class="st">${esc(m.slice(0, 10))}…</span> `).join('') : `<span class="muted">${t(lang, 'none')}</span>`}</p><form method="post" action="/account/devices"><button class="ghost sm">${t(lang, 'reset_devices')}</button></form></section>
<section class="card wide"><h2>${t(lang, 'pricing')}</h2>${plansHtml(ctx)}</section>
<section class="card wide"><h2>${t(lang, 'payments')}</h2>${payments.length ? `<div class="tbl"><table><tr><th>${t(lang, 'date')}</th><th>${t(lang, 'plan')}</th><th>${t(lang, 'amount')}</th><th>${t(lang, 'status')}</th><th>${t(lang, 'ref')}</th></tr>${payments.map(p => `<tr><td>${fmtDate(lang, p.created)}</td><td>${fmtNum(lang, p.months)} ${t(lang, 'months')}</td><td>${fmtNum(lang, p.amount)} ${t(lang, 'toman')}</td><td><span class="st ${p.status === 'paid' ? 'on' : p.status === 'pending' ? 'warn' : 'off'}">${p.status}</span></td><td>${esc(p.ref_id || '—')}</td></tr>`).join('')}</table></div>` : `<p class="muted">${t(lang, 'none')}</p>`}</section></div>`);
}
function payPage(ctx, ok, pay) {
  const { lang } = ctx;
  return layout(ctx, t(lang, 'payments'), `<section class="card auth"><h2>${ok ? '✅ ' + t(lang, 'pay_success') : '❌ ' + t(lang, 'pay_failed')}</h2>${pay.ref_id ? `<p>${t(lang, 'ref')}: <b>${esc(pay.ref_id)}</b></p>` : ''}<p><a class="btn" href="/account">${t(lang, 'back_account')}</a></p></section>`);
}
function adminPage(ctx, users, stats, payments, q) {
  const { lang } = ctx, now = Date.now();
  const row = (u) => { let m = []; try { m = JSON.parse(u.machines || '[]'); } catch (e) {}
    const st = u.disabled ? '<span class="st off">disabled</span>' : (u.expires || 0) > now ? `<span class="st on">until ${new Date(u.expires).toISOString().slice(0, 10)}</span>` : '<span class="st warn">no sub</span>';
    const f = (act, label, extra = '', cls = 'ghost sm') => `<form method="post"><input type="hidden" name="id" value="${u.id}"><input type="hidden" name="act" value="${act}">${extra}<button class="${cls}">${label}</button></form>`;
    return `<tr><td><b>${esc(u.username)}</b><div class="muted">${esc(u.note || '')}</div></td><td>${st}</td><td>${u.last_seen ? new Date(u.last_seen).toISOString().slice(0, 16).replace('T', ' ') : 'never'}</td><td>${m.length}</td><td>${new Date(u.created).toISOString().slice(0, 10)}</td>
<td class="acts">${f('extend', '+1 mo', '<input type="hidden" name="months" value="1">')} ${f('extend', '+3', '<input type="hidden" name="months" value="3">')} ${f('extend', '+12', '<input type="hidden" name="months" value="12">')} ${f('expire', 'expire')} ${f('toggle', u.disabled ? 'enable' : 'disable')} ${f('devices', 'reset devices')} ${f('password', 'set pw', '<input name="password" placeholder="new password" style="width:120px;display:inline;padding:4px 6px">')} ${f('note', 'note', `<input name="note" value="${esc(u.note || '')}" placeholder="note" style="width:120px;display:inline;padding:4px 6px">`)} ${f('delete', 'delete', '', 'danger sm')}</td></tr>`; };
  return layout(ctx, 'admin', `<div class="grid">
<section class="card wide"><h2>Stats</h2><div class="stats"><div class="stat"><b>${stats.users}</b>users</div><div class="stat"><b>${stats.active}</b>active subs</div><div class="stat"><b>${stats.seen24h}</b>seen 24h</div><div class="stat"><b>${stats.payments}</b>payments</div><div class="stat"><b>${fmtNum('en', stats.revenue)}</b>Toman</div></div></section>
<section class="card wide"><h2>Users</h2><form method="get" class="actions"><input name="q" value="${esc(q)}" placeholder="search username" style="max-width:260px"><button class="ghost sm">Search</button></form>
<div class="tbl"><table><tr><th>User</th><th>Subscription</th><th>Last seen</th><th>Devices</th><th>Created</th><th></th></tr>${users.map(row).join('') || '<tr><td colspan="6" class="muted">no users</td></tr>'}</table></div></section>
<section class="card wide"><h2>Payments</h2><div class="tbl"><table><tr><th>Date</th><th>User</th><th>Plan</th><th>Amount</th><th>Status</th><th>Ref</th><th>Card</th></tr>${payments.map(p => `<tr><td>${new Date(p.created).toISOString().slice(0, 16).replace('T', ' ')}</td><td>${esc(p.username || p.user_id)}</td><td>${p.months} mo</td><td>${fmtNum('en', p.amount)}</td><td><span class="st ${p.status === 'paid' ? 'on' : p.status === 'pending' ? 'warn' : 'off'}">${p.status}</span></td><td>${esc(p.ref_id || '')}</td><td>${esc(p.card_pan || '')}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">none</td></tr>'}</table></div></section></div>`);
}
