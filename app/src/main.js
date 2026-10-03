// Electron main process: window, IPC between the renderer and the tweak engine / auth / tools.
const { app, BrowserWindow, ipcMain, shell, Menu, session, nativeTheme } = require('electron');
const path = require('node:path');
const os = require('node:os');
const CONFIG = require('./config');
const { Engine, windowsRunner, FileBackup } = require('./engine');
const TWEAKS = require('../tweaks/manifest');
const PRESETS = require('../tweaks/presets');
const Auth = require('./auth');
const Settings = require('./settings');
const { Updater } = require('./update');
const tools = require('./tools');

if (!app.requestSingleInstanceLock()) app.quit();

/* ---- settings are needed before 'ready': lite mode turns GPU acceleration off for weak / old machines ---- */
const settings = new Settings(path.join(app.getPath('userData'), 'settings.json'));
if (settings.get().lite) app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-features', 'SpareRendererForSitePerProcess');   // one renderer, no spare process
nativeTheme.themeSource = 'dark';

let win = null, engine = null, auth = null, updater = null;
const RENDERER = require('node:fs').existsSync(path.join(__dirname, 'renderer')) ? path.join(__dirname, 'renderer') : path.join(__dirname, '..', 'renderer');   // out/renderer in a build, ../renderer from source

function createWindow() {
  win = new BrowserWindow({
    width: 1000, height: 660, minWidth: 880, minHeight: 580, show: false, backgroundColor: '#101114',
    title: CONFIG.APP_NAME, autoHideMenuBar: true, icon: path.join(__dirname, '..', 'build', 'icon.png'),
    titleBarStyle: 'hidden', titleBarOverlay: { color: '#14151a', symbolColor: '#9aa0ad', height: 40 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true,
      devTools: !app.isPackaged, spellcheck: false, webgl: false, backgroundThrottling: true,
    },
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(RENDERER, 'index.html'));
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e) => e.preventDefault());   // the page never leaves index.html
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((wc, permission, cb) => cb(false));   // no camera / notifications / anything
  const runner = windowsRunner();
  engine = new Engine({ tweaks: TWEAKS, runner, backup: new FileBackup(path.join(app.getPath('userData'), 'backup.json')) });
  auth = new Auth({ serverUrl: CONFIG.SERVER_URL, storePath: path.join(app.getPath('userData'), 'auth.json'), runner, graceDays: CONFIG.OFFLINE_GRACE_DAYS, publicKey: CONFIG.SERVER_PUBKEY });
  updater = new Updater({ auth, version: app.getVersion(), dir: path.join(app.getPath('userData'), 'update'), onState: (st) => { if (win && !win.isDestroyed()) win.webContents.send('update:state', st); } });
  createWindow();
  // quiet check a few seconds after start; with autoUpdate on, the installer is fetched in the background and the
  // page shows "update ready" — installed on "Update now" or when the app is closed
  setTimeout(async () => { const st = await updater.check(); if (st.status === 'available' && settings.get().autoUpdate) updater.download(); }, 8000);
  setInterval(() => { if (updater.state.status === 'idle' || updater.state.status === 'uptodate') updater.check(); }, 6 * 3600000);
});
app.on('before-quit', () => { if (updater && updater.state.status === 'ready' && settings.get().autoUpdate) { try { updater.install(); } catch (e) {} } });
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.on('window-all-closed', () => app.quit());

/* ---- IPC: everything the renderer may ask for. Tweaks are refused without an active subscription. ---- */
const gated = (fn) => async (event, ...args) => { const s = await auth.status(); if (!s.active) throw new Error('no active subscription'); return fn(...args); };
const wrap = (fn) => async (event, ...args) => { try { return { ok: true, data: await fn(event, ...args) }; } catch (e) { return { ok: false, error: e && e.message || String(e) }; } };
const str = (v, n = 200) => String(v == null ? '' : v).slice(0, n);

ipcMain.handle('app:info', wrap(async () => ({ name: CONFIG.APP_NAME, version: app.getVersion(), serverUrl: CONFIG.SERVER_URL, platform: process.platform, isAdmin: await tools.isAdmin(engine.runner), pingHosts: CONFIG.PING_HOSTS, lite: settings.get().lite })));
ipcMain.handle('app:open', wrap(async (e, url) => { url = str(url, 500); if (url.startsWith(CONFIG.SERVER_URL + '/') || url === CONFIG.SERVER_URL) await shell.openExternal(url); }));   // only our own site
ipcMain.handle('app:relaunch', wrap(async () => { app.relaunch(); app.quit(); }));
ipcMain.handle('auth:login', wrap((e, username, password) => auth.login(str(username, 40), str(password, 200))));
ipcMain.handle('auth:status', wrap(() => auth.status()));
ipcMain.handle('auth:cached', wrap(() => auth.view()));   // what is on disk, no network — enough to draw the first screen
ipcMain.handle('auth:logout', wrap(() => auth.logout()));
/* tweak state: the live check takes seconds on a slow PC, so the page first draws the last known state (state.json)
   and swaps in the live one when it lands; parallel requests share one run */
const STATE_FILE = () => path.join(app.getPath('userData'), 'state.json');
let stateRun = null;
const liveState = () => stateRun || (stateRun = engine.state().then((st) => {
  try { require('node:fs').writeFileSync(STATE_FILE(), JSON.stringify({ at: Date.now(), version: app.getVersion(), tweaks: st })); } catch (e) {}
  return st;
}).finally(() => { stateRun = null; }));
ipcMain.handle('tweaks:state', wrap(() => liveState()));
ipcMain.handle('tweaks:cached', wrap(() => { try { const c = JSON.parse(require('node:fs').readFileSync(STATE_FILE(), 'utf8')); return c.version === app.getVersion() ? c.tweaks : null; } catch (e) { return null; } }));
ipcMain.handle('tweaks:apply', wrap(gated((id, option) => engine.apply(str(id, 40), option == null ? undefined : str(option, 40)))));
ipcMain.handle('tweaks:revert', wrap(gated((id) => engine.revert(str(id, 40)))));
ipcMain.handle('tweaks:applyRecommended', wrap(gated(async (category) => {
  const restore = await tools.restorePoint(engine.runner);   // best effort: a System Restore point before the first batch of changes
  const results = await engine.applyRecommended(category ? str(category, 20) : undefined);
  return results.concat(restore ? [{ id: 'restore_point', info: restore }] : []);
})));
ipcMain.handle('tweaks:revertAll', wrap(gated((category) => engine.revertAll(category ? str(category, 20) : undefined))));
ipcMain.handle('presets:list', wrap(() => PRESETS));
ipcMain.handle('presets:apply', wrap(gated(async (id) => {
  const p = PRESETS.find(x => x.id === id); if (!p) throw new Error('unknown preset');
  const restore = await tools.restorePoint(engine.runner);
  const results = [];
  for (const tid of p.tweaks) { try { results.push(await engine.apply(tid)); } catch (e) { results.push({ id: tid, error: e.message }); } }
  return results.concat(restore ? [{ id: 'restore_point', info: restore }] : []);
})));
ipcMain.handle('tools:ping', wrap(async (e, hosts) => {
  const list = (Array.isArray(hosts) ? hosts : CONFIG.PING_HOSTS).map(h => str(h, 100)).filter(h => /^[a-z0-9.:-]+$/i.test(h)).slice(0, 8);
  const r = await tools.ping(engine.runner, list.length ? list : CONFIG.PING_HOSTS);
  settings.set({ lastPing: { at: Date.now(), avg: r.filter(x => x.avg != null).map(x => x.avg) } });
  return r;
}));
ipcMain.handle('tools:action', wrap(gated((id) => tools.action(engine.runner, str(id, 40)))));
ipcMain.handle('tools:list', wrap(() => tools.actionList()));
ipcMain.handle('system:info', wrap(() => tools.systemInfo(engine.runner, os)));
ipcMain.handle('update:state', wrap(() => ({ ...updater.state })));
ipcMain.handle('update:check', wrap(() => updater.check()));
ipcMain.handle('update:download', wrap(() => updater.download()));
ipcMain.handle('update:install', wrap(async () => { updater.install(); setTimeout(() => app.quit(), 300); return true; }));
ipcMain.handle('settings:get', wrap(() => settings.get()));
ipcMain.handle('settings:set', wrap((e, patch) => settings.set(patch && typeof patch === 'object' ? patch : {})));
