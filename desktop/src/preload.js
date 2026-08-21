'use strict'

const { contextBridge, ipcRenderer } = require('electron')

// Minimal, read-only bridge for the local loading/error/wizard/debug/
// appearance pages. The real dsh UI is loaded from
// http://127.0.0.1:<port> and never sees this bridge.
contextBridge.exposeInMainWorld('desktop', {
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
  quit: () => ipcRenderer.send('desktop-quit'),
  getScenarios: () => ipcRenderer.invoke('get-scenarios'),
  selectScenario: (id) => ipcRenderer.invoke('select-scenario', id),
  skipWizard: () => ipcRenderer.invoke('skip-wizard'),
  openApp: () => ipcRenderer.invoke('desktop-open-app'),
  openDebug: () => ipcRenderer.invoke('desktop-open-debug'),
  openAppearance: () => ipcRenderer.invoke('desktop-open-appearance'),
  getAppearance: () => ipcRenderer.invoke('appearance:get'),
  setAppearance: (patch) => ipcRenderer.invoke('appearance:set', patch),
  getI18n: () => ipcRenderer.invoke('i18n:get'),
  getThirdParty: () => ipcRenderer.invoke('thirdparty:get'),
  getAppInfo: () => ipcRenderer.invoke('app:info'),
  onAppearanceChanged: (callback) => {
    ipcRenderer.on('appearance:changed', (_event, settings) => callback(settings))
  },
  getDebugState: () => ipcRenderer.invoke('debug:get-state'),
  onDebugLog: (callback) => {
    ipcRenderer.on('debug:log', (_event, entry) => callback(entry))
  },
  clearDebugLog: () => ipcRenderer.invoke('debug:clear'),
  copyDebugLog: () => ipcRenderer.invoke('debug:copy'),
  restartServer: () => ipcRenderer.invoke('debug:restart'),
  openLogFile: () => ipcRenderer.invoke('debug:open-log'),
  getCredentials: () => ipcRenderer.invoke('credentials:get'),
  setCredentials: (apiKey) => ipcRenderer.invoke('credentials:set', apiKey),
})
