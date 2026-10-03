// Auth against a fake signed server: good signatures pass, tampered / replayed / foreign-machine answers are refused.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const os = require('node:os'), path = require('node:path'), fs = require('node:fs');
const Auth = require('../src/auth');
const PRESETS = require('../tweaks/presets');
const TWEAKS = require('../tweaks/manifest');

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const pub = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
const signed = (obj) => { const d = JSON.stringify(obj); return { d, sig: crypto.sign(null, Buffer.from(d), privateKey).toString('base64') }; };
const res = (status, body) => ({ ok: status < 400, status, json: async () => body });
const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'auth-')), 'auth.json');

test('login accepts a correctly signed answer echoing nonce + machine', async () => {
  let seen;
  const auth = new Auth({ serverUrl: 'https://x', storePath: tmp(), graceDays: 7, publicKey: pub, fetchFn: async (url, o) => { seen = JSON.parse(o.body); return res(200, signed({ token: 't1', username: 'bob', active: true, expires: Date.now() + 86400000, now: Date.now(), nonce: seen.nonce, machine: seen.machine })); } });
  const v = await auth.login('bob', 'pw');
  assert.equal(v.loggedIn, true); assert.equal(v.active, true); assert.equal(seen.username, 'bob'); assert.equal(seen.nonce.length, 32);
});
test('a forged, replayed or foreign answer is refused', async () => {
  const mk = (twist) => new Auth({ serverUrl: 'https://x', storePath: tmp(), publicKey: pub, fetchFn: async (url, o) => { const b = JSON.parse(o.body); return res(200, twist(b)); } });
  // wrong key
  const other = crypto.generateKeyPairSync('ed25519').privateKey;
  await assert.rejects(mk(b => { const d = JSON.stringify({ token: 't', active: true, nonce: b.nonce, machine: b.machine }); return { d, sig: crypto.sign(null, Buffer.from(d), other).toString('base64') }; }).login('a', 'b'), /bad server signature/);
  // payload edited after signing
  await assert.rejects(mk(b => { const s = signed({ token: 't', active: false, nonce: b.nonce, machine: b.machine }); s.d = s.d.replace('false', 'true'); return s; }).login('a', 'b'), /bad server signature/);
  // replay: old nonce
  await assert.rejects(mk(b => signed({ token: 't', active: true, nonce: 'deadbeef', machine: b.machine })).login('a', 'b'), /does not match/);
  // answer meant for another PC
  await assert.rejects(mk(b => signed({ token: 't', active: true, nonce: b.nonce, machine: 'other' })).login('a', 'b'), /does not match/);
  // unsigned (old server)
  await assert.rejects(mk(b => ({ token: 't', active: true })).login('a', 'b'), /bad server signature/);
});
test('status: offline grace keeps active, 401 logs out', async () => {
  const store = tmp(); let mode = 'ok';
  const auth = new Auth({ serverUrl: 'https://x', storePath: store, graceDays: 7, publicKey: pub, fetchFn: async (url, o) => {
    const b = JSON.parse(o.body);
    if (mode === 'down') throw new Error('ECONNREFUSED');
    if (mode === '401') return res(401, { error: 'token expired' });
    return res(200, signed({ token: 't1', username: 'bob', active: true, expires: Date.now() + 86400000, now: Date.now(), nonce: b.nonce, machine: b.machine }));
  } });
  await auth.login('bob', 'pw');
  auth.cache.checked = Date.now() - 120000;   // past the 60 s cache
  mode = 'down'; let s = await auth.status(); assert.equal(s.active, true); assert.equal(s.offline, true);
  auth.cache.checked = Date.now() - 8 * 86400000; s = await auth.status(); assert.equal(s.active, false);   // grace over (no new request: retried at most once a minute)
  mode = '401'; s = await auth.status(); assert.equal(s.loggedIn, true, 'still within the retry minute — the server is not asked');
  auth.lastTry = Date.now() - 61000; s = await auth.status(); assert.equal(s.loggedIn, false);
});
test('presets only reference existing tweaks and have icons + tips', () => {
  const ids = new Set(TWEAKS.map(t => t.id));
  for (const p of PRESETS) { assert.ok(p.tweaks.length >= 5, p.id); for (const id of p.tweaks) assert.ok(ids.has(id), `${p.id}: ${id}`); assert.ok(p.icon && p.tips.length, p.id); assert.ok(fs.existsSync(path.join(__dirname, '..', 'renderer', 'games', p.icon)), p.icon); }
});
