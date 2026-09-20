// The only bridge between the page and Node: a fixed set of calls, each returning {ok, data|error}.
const { contextBridge, ipcRenderer } = require('electron');
const call = (ch) => (...args) => ipcRenderer.invoke(ch, ...args);
contextBridge.exposeInMainWorld('api', {
  info: call('app:info'), open: call('app:open'),
  login: call('auth:login'), status: call('auth:status'), logout: call('auth:logout'),
  state: call('tweaks:state'), apply: call('tweaks:apply'), revert: call('tweaks:revert'), applyRecommended: call('tweaks:applyRecommended'), revertAll: call('tweaks:revertAll'),
  ping: call('tools:ping'), action: call('tools:action'), actions: call('tools:list'), systemInfo: call('system:info'),
});
