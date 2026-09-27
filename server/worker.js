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
   Hardening: strict CSP with a per-request nonce (no inline scripts/styles without it, no framing, forms only post here or to
   Zarinpal), HSTS, nosniff, referrer + permissions policies; every website POST must be same-origin (Sec-Fetch-Site / Origin)
   so a foreign page cannot submit our forms; __Host- session cookie (Secure, HttpOnly, SameSite=Lax, no Domain); per-IP brake
   on failed logins; usernames and password lengths are bounded before any hashing. Pages live in pages.js.
   ============================================================ */
import { DurableObject } from 'cloudflare:workers';
import { ASSETS, MAP_SVG } from './assets.js';
import { ICON_SVG, ICON_IMG } from './icons.js';
import { t, landing, authPage, termsPage, accountPage, payPage, messagePage, adminPage, prices } from './pages.js';

const BUILD = '2026-09-27h';
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
  const langCookie = url.searchParams.has('lang') ? `lang=${lang}; Path=/; Max-Age=31536000; Secure; SameSite=Lax` : null;
  const nonce = b64e(crypto.getRandomValues(new Uint8Array(16)));
  const res = await routeInner(request, env, { url, p, method, ip, lang, langCookie, nonce });
  const h = new Headers(res.headers);
  for (const [k, v] of Object.entries(secHeaders(nonce))) h.set(k, v);
  return new Response(res.body, { status: res.status, headers: h });
}
function secHeaders(nonce) {
  return {
    'content-security-policy': `default-src 'none'; script-src 'nonce-${nonce}' 'strict-dynamic'; style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com; style-src-attr 'unsafe-inline'; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; form-action 'self' https://sandbox.zarinpal.com https://payment.zarinpal.com; frame-ancestors 'none'; base-uri 'none'; object-src 'none'; upgrade-insecure-requests`,
    'strict-transport-security': 'max-age=31536000; includeSubDomains',
    'x-content-type-options': 'nosniff', 'x-frame-options': 'DENY', 'referrer-policy': 'strict-origin-when-cross-origin',
    'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()', 'cross-origin-opener-policy': 'same-origin', 'cross-origin-resource-policy': 'same-origin',
  };
}
// every POST from the website must come from this origin (browsers send Sec-Fetch-Site; older ones at least send Origin)
function sameOrigin(request, url) {
  const sfs = request.headers.get('sec-fetch-site'); if (sfs) return sfs === 'same-origin' || sfs === 'none';
  const o = request.headers.get('origin'); return !o || o === url.origin;
}
async function routeInner(request, env, base) {
  const { url, p, method, ip, lang, langCookie, nonce } = base;
  if (p.startsWith('/api/app/')) return appApi(request, env, p, ip);
  const user = await sessionUser(request, env);
  const ctx = { env, lang, user, url, ip, langCookie, nonce };
  if (method === 'POST' && !sameOrigin(request, url)) return html(messagePage(ctx, '403', t(lang, 'err_csrf')), 403);
  if (method !== 'GET' && method !== 'HEAD' && method !== 'POST') return new Response('method', { status: 405 });
  if (p === '/download') return redirect(env.DOWNLOAD_URL || '/');
  const asset = ASSETS[p === '/favicon.ico' ? 'favicon.png' : p.slice(1)];
  if (asset) return new Response(b64d(asset), { headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=604800, immutable' } });
  if (p === '/iran.svg') return new Response(MAP_SVG, { headers: { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=604800' } });
  const svg = ICON_SVG[p.slice(1)];
  if (svg) return new Response(svg, { headers: { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=604800, immutable' } });
  const img = ICON_IMG[p.slice(1)];
  if (img) return new Response(b64d(img), { headers: { 'content-type': 'image/webp', 'cache-control': 'public, max-age=604800, immutable' } });
  if (p === '/terms') return html(termsPage(ctx), 200, langCookie);
  if (p === '/health') return Response.json({ ok: true, build: BUILD });
  if (p === '/') return html(landing(ctx), 200, langCookie);
  if (p === '/login') return method === 'POST' ? doLogin(request, ctx) : html(authPage(ctx, 'login'), 200, langCookie);
  if (p === '/register') return method === 'POST' ? doRegister(request, ctx) : html(authPage(ctx, 'register'), 200, langCookie);
  if (p === '/logout') return redirect('/', '__Host-s=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax');
  if (p === '/account') return user ? html(accountPage(ctx, await db(env, { op: 'payment.listByUser', user_id: user.id }), isActive), 200, langCookie) : redirect('/login');
  if (p === '/account/devices' && method === 'POST') { if (!user) return redirect('/login'); await db(env, { op: 'user.update', id: user.id, machines: '[]' }); return redirect('/account'); }
  if (p === '/pay/start' && method === 'POST') return user ? payStart(request, ctx) : redirect('/login');
  if (p === '/pay/callback') return payCallback(ctx);
  if (p.startsWith('/admin')) return admin(request, ctx);
  return html(messagePage(ctx, '404'), 404);
}
const html = (body, status = 200, cookie) => new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', ...(cookie ? { 'set-cookie': cookie } : {}) } });
const redirect = (to, cookie) => new Response(null, { status: 302, headers: cookie ? { location: to, 'set-cookie': cookie } : { location: to } });
function pickLang(request, url) {
  const q = url.searchParams.get('lang'); if (q === 'fa' || q === 'en') return q;
  const m = (request.headers.get('cookie') || '').match(/(?:^|;\s*)lang=(fa|en)/); if (m) return m[1];
  return /\bfa\b/i.test(request.headers.get('accept-language') || '') ? 'fa' : 'en';
}
async function sessionUser(request, env) {
  const m = (request.headers.get('cookie') || '').match(/(?:^|;\s*)__Host-s=([^;]+)/); if (!m) return null;
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
  if (password.length < 8 || password.length > 200) return html(authPage(ctx, 'register', t(lang, 'err_password')), 400);
  const { hash, salt } = await hashPassword(password);
  const u = await db(env, { op: 'user.create', username, pass_hash: hash, salt, expires: Number(env.TRIAL_DAYS) > 0 ? Date.now() + Number(env.TRIAL_DAYS) * 86400000 : null });
  if (u.error) return html(authPage(ctx, 'register', t(lang, 'err_taken')), 409);
  return redirect('/account', await sessionCookie(env, u.id));
}
async function doLogin(request, ctx) {
  const { env, lang, ip } = ctx; const f = await readForm(request);
  if (braked(ip)) return html(authPage(ctx, 'login', t(lang, 'err_braked')), 429);
  const username = f('username').toLowerCase(), password = f('password');
  if (!USERNAME_RE.test(username) || password.length > 200) { failed(ip); return html(authPage(ctx, 'login', t(lang, 'err_login')), 401); }
  const u = await db(env, { op: 'user.byName', username });
  if (!u || !(await verifyPassword(password, u))) { failed(ip); return html(authPage(ctx, 'login', t(lang, 'err_login')), 401); }
  if (u.disabled) return html(authPage(ctx, 'login', t(lang, 'err_disabled')), 403);
  return redirect('/account', await sessionCookie(env, u.id));
}
async function sessionCookie(env, id) {
  const tok = await sign(env, `${id}.${Date.now() + SESSION_DAYS * 86400000}`);
  return `__Host-s=${tok}; Path=/; Max-Age=${SESSION_DAYS * 86400}; HttpOnly; Secure; SameSite=Lax`;
}

/* ---- the desktop app ---- */
async function appApi(request, env, p, ip) {
  if (request.method !== 'POST') return Response.json({ error: 'method' }, { status: 405 });
  const b = await request.json().catch(() => ({}));
  const max = Number(env.MAX_MACHINES) || 2;
  if (p === '/api/app/login') {
    if (braked(ip)) return Response.json({ error: 'too many attempts, wait 10 minutes' }, { status: 429 });
    const username = String(b.username || '').toLowerCase().trim(), password = String(b.password || '');
    if (!USERNAME_RE.test(username) || password.length > 200) { failed(ip); return Response.json({ error: 'wrong username or password' }, { status: 401 }); }
    const u = await db(env, { op: 'user.byName', username });
    if (!u || !(await verifyPassword(password, u))) { failed(ip); return Response.json({ error: 'wrong username or password' }, { status: 401 }); }
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
async function payStart(request, ctx) {
  const { env, user, url, lang } = ctx; const f = await readForm(request);
  const months = Number(f('plan')), amount = prices(env)[months];
  if (!amount) return html(messagePage(ctx, t(lang, 'err_plan')), 400);
  if (!env.ZARINPAL_MERCHANT) return html(messagePage(ctx, t(lang, 'err_gateway')), 503);
  const r = await fetch(zp(env) + '/v4/payment/request.json', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({
    merchant_id: env.ZARINPAL_MERCHANT, amount, currency: 'IRT', description: `${env.APP_NAME || 'Optimizer'} — ${months} ${lang === 'fa' ? 'ماه' : 'month(s)'} — ${user.username}`,
    callback_url: `${url.origin}/pay/callback`, metadata: { order_id: user.id } }) });
  const j = await r.json().catch(() => ({}));
  const authority = j.data && j.data.authority;
  if (!authority) { console.log('zarinpal request failed: ' + JSON.stringify(j)); return html(messagePage(ctx, t(lang, 'err_gateway'), JSON.stringify(j.errors || j)), 502); }
  await db(env, { op: 'payment.create', authority, user_id: user.id, months, amount });
  return redirect(zp(env) + '/StartPay/' + authority);
}
async function payCallback(ctx) {
  const { env, url, lang } = ctx;
  const authority = url.searchParams.get('Authority') || '', status = url.searchParams.get('Status');
  const pay = await db(env, { op: 'payment.get', authority });
  if (!pay) return html(messagePage(ctx, t(lang, 'pay_unknown')), 404);
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
