// Account login for the app: talks to the site worker (/api/app/*), keeps the token on disk, and tolerates being
// offline for OFFLINE_GRACE_DAYS after the last successful "active" answer.
const fs = require('node:fs');
const os = require('node:os');
const crypto = require('node:crypto');

class Auth {
  constructor({ serverUrl, storePath, runner, graceDays = 7, fetchFn }) {
    this.serverUrl = serverUrl.replace(/\/$/, ''); this.storePath = storePath; this.runner = runner; this.graceMs = graceDays * 86400000;
    this.fetch = fetchFn || ((url, opts) => fetch(url, { ...opts, signal: AbortSignal.timeout(10000) }));
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
  async post(path, body) {
    const r = await this.fetch(this.serverUrl + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error || ('HTTP ' + r.status)); e.status = r.status; throw e; }
    return j;
  }
  async login(username, password) {
    const j = await this.post('/api/app/login', { username, password, machine: await this.machine() });
    this.cache = { token: j.token, username: j.username, active: j.active, expires: j.expires, checked: Date.now() }; this.save();
    return this.view();
  }
  async logout() { this.cache = {}; this.save(); return this.view(); }
  view(extra = {}) {
    const c = this.load();
    return { loggedIn: !!c.token, username: c.username || '', active: !!c.active && (c.expires || 0) > Date.now(), expires: c.expires || 0, checked: c.checked || 0, ...extra };
  }
  /* fresh answer from the server when reachable; the cached one (within the grace period) when not */
  async status() {
    const c = this.load(); if (!c.token) return this.view();
    try {
      const j = await this.post('/api/app/status', { token: c.token });
      Object.assign(c, { active: j.active, expires: j.expires, username: j.username, checked: Date.now() }); this.save();
      return this.view({ offline: false });
    } catch (e) {
      if (e.status === 401 || e.status === 403) { this.cache = {}; this.save(); return this.view({ error: e.message }); }   // token/device rejected: log in again
      const fresh = Date.now() - (c.checked || 0) < this.graceMs;
      return { ...this.view({ offline: true, error: e.message }), active: fresh && !!c.active && (c.expires || 0) > Date.now() };
    }
  }
}
module.exports = Auth;
