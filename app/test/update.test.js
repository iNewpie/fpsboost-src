// Updater against a fake signed server + fake download: newer version → download → hash check → ready; bad hash refused.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto'), os = require('node:os'), path = require('node:path'), fs = require('node:fs');
const Auth = require('../src/auth');
const { Updater, cmp } = require('../src/update');

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const pub = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
const signed = (obj) => { const d = JSON.stringify(obj); return { d, sig: crypto.sign(null, Buffer.from(d), privateKey).toString('base64') }; };
const installer = crypto.randomBytes(300000), sha = crypto.createHash('sha256').update(installer).digest('hex');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'upd-'));

function setup(latest, hash = sha) {
  const dir = tmp();
  const auth = new Auth({ serverUrl: 'https://x', storePath: path.join(dir, 'auth.json'), publicKey: pub, fetchFn: async (url, o) => { const b = JSON.parse(o.body); return { ok: true, status: 200, json: async () => signed({ latest, url: 'https://dl.example/FPSBoost-Setup.exe', sha256: hash, current: b.version, nonce: b.nonce, machine: b.machine }) }; } });
  const states = [];
  const up = new Updater({ auth, version: '0.2.0', dir: path.join(dir, 'update'), onState: (s) => states.push(s.status + ':' + s.progress), fetchFn: async () => ({ ok: true, status: 200, headers: new Map([['content-length', String(installer.length)]]), body: (async function* () { for (let i = 0; i < installer.length; i += 65536) yield installer.subarray(i, i + 65536); })() }) });
  return { up, states, dir };
}
test('version compare', () => { assert.ok(cmp('0.3.0', '0.2.9') > 0); assert.ok(cmp('1.0.0', '0.9.9') > 0); assert.equal(cmp('0.2.0', '0.2.0'), 0); assert.ok(cmp('0.2.0', '0.10.0') < 0); });
test('same or older version → up to date', async () => {
  assert.equal((await setup('0.2.0').up.check()).status, 'uptodate');
  assert.equal((await setup('0.1.9').up.check()).status, 'uptodate');
});
test('newer version → available → downloaded, verified, ready; second check finds the file', async () => {
  const { up, states, dir } = setup('0.3.0');
  assert.equal((await up.check()).status, 'available');
  const r = await up.download(); assert.equal(r.status, 'ready'); assert.equal(r.progress, 100); assert.ok(fs.existsSync(r.file)); assert.ok(states.includes('downloading:50') || states.some(s => s.startsWith('downloading:')));
  assert.equal(fs.readFileSync(r.file).length, installer.length);
  const again = new Updater({ auth: up.auth, version: '0.2.0', dir: path.join(dir, 'update') }); assert.equal((await again.check()).status, 'ready');
  assert.equal(up.install(), true);   // no spawn off Windows, but the hash re-check passes
});
test('a download whose hash does not match the signed manifest is thrown away', async () => {
  const { up } = setup('0.3.0', 'ab'.repeat(32));
  await up.check(); const r = await up.download(); assert.equal(r.status, 'error'); assert.match(r.error, /checksum/); assert.equal(fs.readdirSync(up.dir).length, 0);
});
test('a manifest with a bad url / hash shape is ignored', async () => {
  const dir = tmp();
  const auth = new Auth({ serverUrl: 'https://x', storePath: path.join(dir, 'a.json'), publicKey: pub, fetchFn: async (url, o) => { const b = JSON.parse(o.body); return { ok: true, status: 200, json: async () => signed({ latest: '9.9.9', url: 'http://evil/x.exe', sha256: '', nonce: b.nonce, machine: b.machine }) }; } });
  assert.equal((await new Updater({ auth, version: '0.2.0', dir }).check()).status, 'uptodate');
});
