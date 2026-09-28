// Self-update: ask the server (signed answer) for the latest version, download the installer into userData/update,
// verify its SHA-256 against the signed manifest, then run it silently (NSIS /S) — either on "Update now" or when the
// app quits. Nothing is ever installed that the server did not sign a hash for.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const cmp = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d; } return 0; };

class Updater {
  constructor({ auth, version, dir, fetchFn, onState }) {
    this.auth = auth; this.version = version; this.dir = dir; this.fetch = fetchFn || ((url, o) => fetch(url, o)); this.onState = onState || (() => {});
    this.state = { status: 'idle', current: version, latest: '', progress: 0, file: '', error: '' }; this.busy = false;
  }
  set(patch) { Object.assign(this.state, patch); this.onState({ ...this.state }); return { ...this.state }; }
  /* signed manifest from our server; 'available' when it is newer than us */
  async check() {
    if (this.busy) return { ...this.state };
    this.set({ status: 'checking', error: '' });
    try {
      const m = await this.auth.post('/api/app/update', { version: this.version });
      if (!/^\d+\.\d+\.\d+$/.test(m.latest) || !/^https:\/\//.test(m.url) || !/^[0-9a-f]{64}$/.test(m.sha256)) return this.set({ status: 'uptodate', latest: m.latest || '' });
      this.manifest = m;
      if (cmp(m.latest, this.version) <= 0) return this.set({ status: 'uptodate', latest: m.latest });
      const ready = this.readyFile(m); if (ready) return this.set({ status: 'ready', latest: m.latest, file: ready, progress: 100 });
      return this.set({ status: 'available', latest: m.latest });
    } catch (e) { return this.set({ status: 'error', error: e.message }); }
  }
  readyFile(m) { const f = path.join(this.dir, `FPSBoost-Setup-${m.latest}.exe`); try { return fs.existsSync(f) && sha256(f) === m.sha256 ? f : ''; } catch (e) { return ''; } }
  /* stream the installer to disk, hashing as it goes; keep it only if the hash matches the signed one */
  async download() {
    if (this.busy || !this.manifest || this.state.status === 'ready') return { ...this.state };
    const m = this.manifest; this.busy = true; this.set({ status: 'downloading', progress: 0, error: '' });
    const final = path.join(this.dir, `FPSBoost-Setup-${m.latest}.exe`), tmp = final + '.part';
    try {
      fs.mkdirSync(this.dir, { recursive: true });
      const r = await this.fetch(m.url, { redirect: 'follow', signal: AbortSignal.timeout(20 * 60000) });
      if (!r.ok || !r.body) throw new Error('download failed: HTTP ' + r.status);
      const total = Number(r.headers.get('content-length')) || 0, hash = crypto.createHash('sha256'); let got = 0, last = 0;
      const out = fs.createWriteStream(tmp);
      for await (const chunk of r.body) { hash.update(chunk); got += chunk.length; if (!out.write(chunk)) await new Promise(res => out.once('drain', res)); const pc = total ? Math.floor(got / total * 100) : 0; if (pc !== last) { last = pc; this.set({ progress: pc }); } }
      await new Promise((res, rej) => out.end(err => err ? rej(err) : res()));
      if (hash.digest('hex') !== m.sha256) { fs.rmSync(tmp, { force: true }); throw new Error('downloaded file does not match the signed checksum'); }
      fs.renameSync(tmp, final);
      for (const f of fs.readdirSync(this.dir)) if (f !== path.basename(final)) fs.rmSync(path.join(this.dir, f), { force: true });   // old downloads
      this.busy = false; return this.set({ status: 'ready', file: final, progress: 100 });
    } catch (e) { fs.rmSync(tmp, { force: true }); this.busy = false; return this.set({ status: 'error', error: e.message, progress: 0 }); }
  }
  /* the verified installer, silent; the caller quits the app right after */
  install() {
    const f = this.state.status === 'ready' && this.state.file; if (!f || !this.manifest) throw new Error('no update downloaded');
    if (sha256(f) !== this.manifest.sha256) { fs.rmSync(f, { force: true }); this.set({ status: 'available', file: '' }); throw new Error('installer changed on disk — download it again'); }
    if (process.platform === 'win32') { const child = spawn(f, ['/S'], { detached: true, stdio: 'ignore', windowsHide: true }); child.unref(); }
    this.set({ status: 'installing' }); return true;
  }
}
function sha256(file) { const h = crypto.createHash('sha256'); const fd = fs.openSync(file, 'r'); const buf = Buffer.alloc(1 << 20); let n; while ((n = fs.readSync(fd, buf, 0, buf.length, null)) > 0) h.update(buf.subarray(0, n)); fs.closeSync(fd); return h.digest('hex'); }
module.exports = { Updater, cmp, sha256 };
