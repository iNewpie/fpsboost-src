// The tweak engine: runs each tweak's check / apply / revert against a "runner" (real Windows commands, or a mock in
// tests). Every apply first stores the original values in the backup file, and revert puts them back — so a user can
// always return to exactly where they started, even after a reinstall of the app.
const { execFile } = require('node:child_process');
const fs = require('node:fs');

/* ---- runners ---- */
function windowsRunner() {
  return {
    run: (cmd, args, opts = {}) => new Promise((resolve) => {
      execFile(cmd, args, { windowsHide: true, maxBuffer: 16e6, timeout: opts.timeout || 60000 }, (err, stdout, stderr) =>
        resolve({ code: err ? (typeof err.code === 'number' ? err.code : 1) : 0, out: String(stdout || ''), err: String(stderr || '') }));
    }),
  };
}

/* ---- helpers on top of a runner: registry, powershell ---- */
function makeCtx(runner, backup, option) {
  const run = (cmd, args, opts) => runner.run(cmd, args, opts);
  const must = async (cmd, args, opts) => { const r = await run(cmd, args, opts); if (r.code !== 0) throw new Error(`${cmd} ${args.join(' ')} failed: ${(r.err || r.out).trim().slice(0, 200)}`); return r; };
  const reg = {
    async get(key, name) {
      const r = await run('reg', ['query', key, '/v', name]);
      if (r.code !== 0) return null;
      const m = r.out.match(new RegExp('^\\s*' + escapeRe(name) + '\\s+(REG_[A-Z_]+)\\s*(.*)$', 'mi'));
      return m ? { type: m[1], value: parseRegValue(m[1], m[2].trim()) } : null;
    },
    async set(key, name, type, value) { await must('reg', ['add', key, '/v', name, '/t', type, '/d', type === 'REG_DWORD' ? String(value >>> 0) : String(value), '/f']); },
    async del(key, name) { await run('reg', ['delete', key, '/v', name, '/f']); },
    async subkeys(key) { const r = await run('reg', ['query', key]); return r.code ? [] : r.out.split(/\r?\n/).map(l => l.trim()).filter(l => /^HKEY_/.test(l)); },
  };
  const ps = async (script, opts) => {
    const r = await run('powershell', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], opts);
    if (r.code !== 0) throw new Error('powershell failed: ' + (r.err || r.out).trim().slice(0, 300));
    return r.out;
  };
  const psJson = async (script, opts) => { const out = (await ps(script, opts)).trim(); if (!out) return null; const j = JSON.parse(out); return j; };
  return { run, must, reg, ps, psJson, backup, option };
}
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function parseRegValue(type, raw) {
  if (type === 'REG_DWORD' || type === 'REG_QWORD') return /^0x/i.test(raw) ? parseInt(raw, 16) : Number(raw);
  return raw;
}
const same = (a, b) => (typeof b === 'number' ? Number(a) === b : String(a) === String(b));

/* ---- backups ---- */
class FileBackup {
  constructor(file) { this.file = file; this.data = null; }
  load() { if (!this.data) { try { this.data = JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch (e) { this.data = {}; } } return this.data; }
  flush() { fs.mkdirSync(require('node:path').dirname(this.file), { recursive: true }); fs.writeFileSync(this.file, JSON.stringify(this.data, null, 1)); }
  async get(id) { return this.load()[id] || null; }
  async saveOnce(id, value) { const d = this.load(); if (d[id]) return false; d[id] = value; this.flush(); return true; }   // the FIRST original wins
  async clear(id) { const d = this.load(); delete d[id]; this.flush(); }
}
class MemoryBackup {
  constructor() { this.data = {}; }
  async get(id) { return this.data[id] || null; }
  async saveOnce(id, value) { if (this.data[id]) return false; this.data[id] = value; return true; }
  async clear(id) { delete this.data[id]; }
}

/* ---- a tweak made of plain registry values: check = all present, apply = backup + set, revert = restore or delete ---- */
function regTweak(def) {
  return {
    ...def,
    async check(ctx) { for (const v of def.values) { const cur = await ctx.reg.get(v.key, v.name); if (!cur || !same(cur.value, v.value)) return false; } return true; },
    async apply(ctx) {
      const originals = []; for (const v of def.values) originals.push({ key: v.key, name: v.name, was: await ctx.reg.get(v.key, v.name) });
      await ctx.backup.saveOnce(def.id, originals);
      for (const v of def.values) await ctx.reg.set(v.key, v.name, v.type, v.value);
    },
    async revert(ctx) {
      const originals = (await ctx.backup.get(def.id)) || def.values.map(v => ({ key: v.key, name: v.name, was: null }));
      for (const o of originals) { if (o.was) await ctx.reg.set(o.key, o.name, o.was.type, o.was.value); else await ctx.reg.del(o.key, o.name); }
      await ctx.backup.clear(def.id);
    },
  };
}

/* ---- the engine ---- */
class Engine {
  constructor({ tweaks, runner, backup }) { this.tweaks = tweaks; this.runner = runner; this.backup = backup || new MemoryBackup(); }
  find(id) { const t = this.tweaks.find(x => x.id === id); if (!t) throw new Error('unknown tweak ' + id); return t; }
  async state() {
    const out = [];
    for (const t of this.tweaks) {
      let applied = null, error = null;
      try { applied = await t.check(makeCtx(this.runner, this.backup)); } catch (e) { error = e.message; }
      const { check, apply, revert, ...meta } = t;
      out.push({ ...meta, applied, error, hasBackup: !!(await this.backup.get(t.id)) });
    }
    return out;
  }
  async apply(id, option) { const t = this.find(id); await t.apply(makeCtx(this.runner, this.backup, option)); return { id, applied: await t.check(makeCtx(this.runner, this.backup, option)), reboot: !!t.reboot }; }
  async revert(id) { const t = this.find(id); await t.revert(makeCtx(this.runner, this.backup)); return { id, applied: await t.check(makeCtx(this.runner, this.backup)), reboot: !!t.reboot }; }
  async applyRecommended(category) {
    const results = [];
    for (const t of this.tweaks.filter(x => x.recommended && (!category || x.category === category))) {
      try { results.push(await this.apply(t.id)); } catch (e) { results.push({ id: t.id, error: e.message }); }
    }
    return results;
  }
  async revertAll(category) {
    const results = [];
    for (const t of this.tweaks.filter(x => !category || x.category === category)) {
      try { if (await t.check(makeCtx(this.runner, this.backup)) || await this.backup.get(t.id)) results.push(await this.revert(t.id)); } catch (e) { results.push({ id: t.id, error: e.message }); }
    }
    return results;
  }
}

module.exports = { Engine, windowsRunner, FileBackup, MemoryBackup, regTweak, makeCtx, parseRegValue };
