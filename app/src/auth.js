// Account login for the app: talks to the site worker (/api/app/*), keeps the token on disk, and tolerates being
// offline for OFFLINE_GRACE_DAYS after the last successful "active" answer.
// Every answer is { d: '<json>', sig } — d is signed by the server's Ed25519 key and echoes our nonce and machine id,
// so a fake server, a proxy rewriting "active", or a replayed old answer cannot unlock the app.
const fs = require('node:fs');
const os = require('node:os');
const crypto = require('node:crypto');

class Auth {
  constructor({ serverUrl, storePath, runner, graceDays = 7, fetchFn, publicKey }) {
    this.serverUrl = serverUrl.replace(/\/$/, ''); this.storePath = storePath; this.runner = runner; this.graceMs = graceDays * 86400000;
    this.fetch = fetchFn || ((url, opts) => fetch(url, { ...opts, signal: AbortSignal.timeout(10000) }));
    this.key = publicKey ? crypto.createPublicKey({ key: Buffer.from(publicKey, 'base64'), format: 'der', type: 'spki' }) : null;
    this.cache = null; this.machineId = null;
  }
  load() { if (!this.cache) { try { this.cache = JSON.parse(fs.readFileSync(this.storePath, 'utf8')); } catch (e) { this.cache = {}; } } return this.cache; }
  save() { fs.mkdirSync(require('node:path').dirname(this.storePath), { recursive: true }); fs.writeFileSync(this.storePath, JSON.stringify(this.cache)); }
  /* a stable id for this PC: Windows MachineGuid + hostname, hashed (never sent raw) */
  async machine() {
    if (this.machineId) return this.machineId;
    let guid = '';
    if (process.platform === 'win32' && this.runner) { const r = await this.runner.run('reg', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid']); const m = r.out.match(/MachineGuid\s+REG_SZ\s+(\S+)/i); guid = m ? m[1] : ''; }
    return (this.machineId = crypto.createHash('sha256').update(guid + '|' + os.hostname()).digest('hex').slice(0, 32));
  }
  /* POST + verify: returns the signed payload object */
  async post(path, body) {
    const nonce = crypto.randomBytes(16).toString('hex'), machine = await this.machine();
    const r = await this.fetch(this.serverUrl + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...body, machine, nonce }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error || ('HTTP ' + r.status)); e.status = r.status; throw e; }
    if (!this.key) throw new Error('no server key');
    if (typeof j.d !== 'string' || typeof j.sig !== 'string' || !crypto.verify(null, Buffer.from(j.d, 'utf8'), this.key, Buffer.from(j.sig, 'base64'))) throw new Error('bad server signature');
    let d; try { d = JSON.parse(j.d); } catch (e) { throw new Error('bad server answer'); }
    if (d.nonce !== nonce || d.machine !== machine) throw new Error('server answer does not match this request');
    return d;
  }
  async login(username, password) {
    const j = await this.post('/api/app/login', { username, password });
    this.cache = { token: j.token, username: j.username, active: j.active, expires: j.expires, checked: Date.now() }; this.save();
    return this.view();
  }
  async logout() { this.cache = {}; this.save(); return this.view(); }
  view(extra = {}) {
    const c = this.load();
    return { loggedIn: !!c.token, username: c.username || '', active: !!c.active && (c.expires || 0) > Date.now(), expires: c.expires || 0, checked: c.checked || 0, ...extra };
  }
  /* fresh answer from the server when reachable (at most once a minute); the cached one (within the grace period) when not */
  async status() {
    const c = this.load(); if (!c.token) return this.view();
    if (Date.now() - (c.checked || 0) < 60000 && !c.offline) return this.view({ offline: false });
    // offline: retry the server at most once a minute — otherwise every click would wait out the 10 s timeout
    if (c.offline && Date.now() - (this.lastTry || 0) < 60000) return this.offlineView(c, this.lastError);
    this.lastTry = Date.now();
    try {
      const j = await this.post('/api/app/status', { token: c.token });
      Object.assign(c, { active: j.active, expires: j.expires, username: j.username, checked: Date.now(), offline: false }); this.save();
      return this.view({ offline: false });
    } catch (e) {
      if (e.status === 401 || e.status === 403) { this.cache = {}; this.save(); return this.view({ error: e.message }); }   // token/device rejected: log in again
      c.offline = true; this.lastError = e.message;
      return this.offlineView(c, e.message);
    }
  }
  offlineView(c, error) {
    const fresh = Date.now() - (c.checked || 0) < this.graceMs;
    return { ...this.view({ offline: true, error }), active: fresh && !!c.active && (c.expires || 0) > Date.now() };
  }
}
module.exports = Auth;
