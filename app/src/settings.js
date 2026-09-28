// Tiny JSON settings store (userData/settings.json): language, lite mode (no GPU acceleration) and the like.
const fs = require('node:fs'), path = require('node:path');
const DEFAULTS = { lang: '', lite: false, lastPing: null, autoUpdate: true };
const ALLOWED = { lang: (v) => v === 'fa' || v === 'en' || v === '', lite: (v) => typeof v === 'boolean', autoUpdate: (v) => typeof v === 'boolean', lastPing: (v) => v == null || (typeof v === 'object' && Object.keys(v).length < 20) };
class Settings {
  constructor(file) { this.file = file; this.data = null; }
  load() { if (!this.data) { try { this.data = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(this.file, 'utf8')) }; } catch (e) { this.data = { ...DEFAULTS }; } } return this.data; }
  get() { return { ...this.load() }; }
  set(patch) {
    const d = this.load();
    for (const [k, v] of Object.entries(patch || {})) { if (ALLOWED[k] && ALLOWED[k](v)) d[k] = v; }
    fs.mkdirSync(path.dirname(this.file), { recursive: true }); fs.writeFileSync(this.file, JSON.stringify(d));
    return { ...d };
  }
}
module.exports = Settings;
