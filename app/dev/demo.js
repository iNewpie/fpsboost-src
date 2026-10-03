/* Browser demo: a fake window.api so the renderer can be opened without Electron (screenshots, design review).
   Loaded by dev/demo.html only — never shipped. */
(() => {
  if (window.api) return;
  const ok = (data) => Promise.resolve({ ok: true, data });
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const STATE_MS = Number(new URLSearchParams(location.search).get('stateMs') || 2500);
  const demo = new URLSearchParams(location.search);
  let loggedIn = demo.get('login') !== '0', active = demo.get('active') !== '0';
  const applied = new Set(['game_dvr_off', 'game_mode_on', 'power_plan_high', 'mouse_accel_off', 'nagle_off', 'dns_fast', 'telemetry_off']);
  const upd = { status: 'idle', current: '0.2.0', latest: '', progress: 0 }, updListeners = [];
  const emit = (patch) => { Object.assign(upd, patch); const c = { ...upd }; updListeners.forEach(f => f(c)); return c; };
  const settings = { lang: demo.get('lang') || 'en', lite: false, autoUpdate: true, lastPing: { at: Date.now() - 3600000, avg: [21, 34, 29] } };
  window.api = {
    info: () => ok({ name: 'FPS Boost', version: '0.2.0', serverUrl: 'https://fpsboost.ir', platform: 'win32', isAdmin: true, pingHosts: ['1.1.1.1', '8.8.8.8', 'google.com'], lite: false }),
    open: (u) => { window.open(u, '_blank'); return ok(); }, relaunch: () => ok(),
    login: async (u, p) => { await wait(600); if (!u || !p) return { ok: false, error: 'wrong username or password' }; loggedIn = true; return ok(status()); },
    status: () => ok(status()), logout: () => { loggedIn = false; return ok(status()); },
    state: async () => { await wait(STATE_MS); return ok(DEMO_TWEAKS.map(tw => ({ ...tw, applied: applied.has(tw.id), error: null, hasBackup: applied.has(tw.id) }))); },   // slow, like a real PC
    cachedState: () => ok(null), cachedStatus: () => ok(status()),
    apply: async (id) => { await wait(500); applied.add(id); return ok({ id, applied: true, reboot: !!(DEMO_TWEAKS.find(t => t.id === id) || {}).reboot }); },
    revert: async (id) => { await wait(400); applied.delete(id); return ok({ id, applied: false }); },
    applyRecommended: async (cat) => { await wait(1200); const rs = DEMO_TWEAKS.filter(t => t.recommended && (!cat || t.category === cat)).map(t => { applied.add(t.id); return { id: t.id, applied: true, reboot: !!t.reboot }; }); return ok(rs.concat([{ id: 'restore_point', info: { skipped: false } }])); },
    revertAll: async (cat) => { await wait(900); const rs = DEMO_TWEAKS.filter(t => (!cat || t.category === cat) && applied.has(t.id)).map(t => { applied.delete(t.id); return { id: t.id, applied: false }; }); return ok(rs); },
    presets: () => ok(DEMO_PRESETS),
    applyPreset: async (id) => { await wait(1000); const p = DEMO_PRESETS.find(x => x.id === id); return ok(p.tweaks.map(tid => { applied.add(tid); return { id: tid, applied: true }; }).concat([{ id: 'restore_point', info: { skipped: true } }])); },
    ping: async (hosts) => { await wait(1500); const r = hosts.map((host, i) => ({ host, avg: i === 2 ? 48 : 18 + i * 9, loss: 0 })); settings.lastPing = { at: Date.now(), avg: r.map(x => x.avg) }; return ok(r); },
    action: async (id) => { await wait(800); return ok({ id, message: { en: id === 'clean_temp' ? 'Freed 412 MB' : 'Done', fa: id === 'clean_temp' ? '۴۱۲ مگابایت آزاد شد' : 'انجام شد' }, reboot: id === 'winsock_reset' }); },
    actions: () => ok(DEMO_ACTIONS),
    systemInfo: () => ok({ os: 'Windows 10 Pro 22H2', cpu: 'Intel Core i5-4460 @ 3.20GHz', cores: 4, ramGb: 8, gpu: 'NVIDIA GeForce GTX 750 Ti' }),
    settings: () => ok({ ...settings }), saveSettings: (p) => { Object.assign(settings, p); return ok({ ...settings }); },
    updateState: () => ok({ ...upd }), onUpdate: (fn) => { updListeners.push(fn); },
    updateCheck: async () => { emit({ status: 'checking' }); await wait(700); return ok(emit({ status: 'available', latest: '0.3.0' })); },
    updateDownload: async () => { emit({ status: 'downloading', latest: '0.3.0', progress: 0 }); for (let p = 5; p <= 100; p += 5) { await wait(120); emit({ progress: p }); } return ok(emit({ status: 'ready', progress: 100 })); },
    updateInstall: async () => { emit({ status: 'installing' }); return ok(true); },
  };
  function status() { return loggedIn ? { loggedIn: true, username: 'hossein', active, expires: Date.now() + 23 * 86400000, checked: Date.now(), offline: false } : { loggedIn: false }; }
})();
