const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getVersion: () => ipcRenderer.invoke('get-version'),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  checkInstallation: (path) => ipcRenderer.invoke('check-installation', path),
  installCef: (data) => ipcRenderer.invoke('install-cef', data),
  uninstallCef: (data) => ipcRenderer.invoke('uninstall-cef', data),
  onInstallProgress: (callback) => ipcRenderer.on('install-progress', (_event, value) => callback(value))
});
