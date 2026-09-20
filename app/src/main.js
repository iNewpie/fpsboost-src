// Electron main process: window, IPC between the renderer and the tweak engine / auth / tools.
const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
const path = require('node:path');
const os = require('node:os');
const CONFIG = require('./config');
const { Engine, windowsRunner, FileBackup } = require('./engine');
const TWEAKS = require('../tweaks/manifest');
const Auth = require('./auth');
const tools = require('./tools');

if (!app.requestSingleInstanceLock()) app.quit();

let win = null, engine = null, auth = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1040, height: 720, minWidth: 820, minHeight: 560, show: false, backgroundColor: '#0a0c12',
    title: CONFIG.APP_NAME, autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
}

app.whenReady().then(() => {
  const runner = windowsRunner();
  engine = new Engine({ tweaks: TWEAKS, runner, backup: new FileBackup(path.join(app.getPath('userData'), 'backup.json')) });
  auth = new Auth({ serverUrl: CONFIG.SERVER_URL, storePath: path.join(app.getPath('userData'), 'auth.json'), runner, graceDays: CONFIG.OFFLINE_GRACE_DAYS });
  createWindow();
});
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.on('window-all-closed', () => app.quit());

/* ---- IPC: everything the renderer may ask for. Tweaks are refused without an active subscription. ---- */
const gated = (fn) => async (event, ...args) => { const s = await auth.status(); if (!s.active) throw new Error('no active subscription'); return fn(...args); };
const wrap = (fn) => async (event, ...args) => { try { return { ok: true, data: await fn(event, ...args) }; } catch (e) { return { ok: false, error: e && e.message || String(e) }; } };

ipcMain.handle('app:info', wrap(async () => ({ name: CONFIG.APP_NAME, version: app.getVersion(), serverUrl: CONFIG.SERVER_URL, platform: process.platform, isAdmin: await tools.isAdmin(engine.runner), pingHosts: CONFIG.PING_HOSTS })));
ipcMain.handle('app:open', wrap(async (e, url) => { if (/^https?:\/\//.test(url)) await shell.openExternal(url); }));
ipcMain.handle('auth:login', wrap((e, username, password) => auth.login(username, password)));
ipcMain.handle('auth:status', wrap(() => auth.status()));
ipcMain.handle('auth:logout', wrap(() => auth.logout()));
ipcMain.handle('tweaks:state', wrap(() => engine.state()));
ipcMain.handle('tweaks:apply', wrap(gated((id, option) => engine.apply(id, option))));
ipcMain.handle('tweaks:revert', wrap(gated((id) => engine.revert(id))));
ipcMain.handle('tweaks:applyRecommended', wrap(gated(async (category) => {
  const restore = await tools.restorePoint(engine.runner);   // best effort: a System Restore point before the first batch of changes
  const results = await engine.applyRecommended(category);
  return results.concat(restore ? [{ id: 'restore_point', info: restore }] : []);
})));
ipcMain.handle('tweaks:revertAll', wrap(gated((category) => engine.revertAll(category))));
ipcMain.handle('tools:ping', wrap((e, hosts) => tools.ping(engine.runner, hosts || CONFIG.PING_HOSTS)));
ipcMain.handle('tools:action', wrap(gated((id) => tools.action(engine.runner, id))));
ipcMain.handle('tools:list', wrap(() => tools.actionList()));
ipcMain.handle('system:info', wrap(() => tools.systemInfo(engine.runner, os)));
