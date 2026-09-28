// The only bridge between the page and Node: a fixed set of calls, each returning {ok, data|error}.
const { contextBridge, ipcRenderer } = require('electron');
const call = (ch) => (...args) => ipcRenderer.invoke(ch, ...args);
contextBridge.exposeInMainWorld('api', {
  info: call('app:info'), open: call('app:open'), relaunch: call('app:relaunch'),
  login: call('auth:login'), status: call('auth:status'), logout: call('auth:logout'),
  state: call('tweaks:state'), apply: call('tweaks:apply'), revert: call('tweaks:revert'), applyRecommended: call('tweaks:applyRecommended'), revertAll: call('tweaks:revertAll'),
  presets: call('presets:list'), applyPreset: call('presets:apply'),
  ping: call('tools:ping'), action: call('tools:action'), actions: call('tools:list'), systemInfo: call('system:info'),
  settings: call('settings:get'), saveSettings: call('settings:set'),
  updateState: call('update:state'), updateCheck: call('update:check'), updateDownload: call('update:download'), updateInstall: call('update:install'),
  onUpdate: (fn) => { ipcRenderer.on('update:state', (e, st) => fn(st)); },
});
