// preload.js

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('fileAPI', {
  openMany: () => ipcRenderer.invoke('file:openMany'),
  uploadByTokens: (tokens, backendUrl) => ipcRenderer.invoke('file:uploadByTokens', tokens, backendUrl),
});

contextBridge.exposeInMainWorld('permissions', {
  get: async () => {
    return await ipcRenderer.invoke('permissions:get');
  },
});

contextBridge.exposeInMainWorld('externalLinks', {
  open: async (url) => {
    return await ipcRenderer.invoke('shell:openExternal', url);
  },
});

contextBridge.exposeInMainWorld('backend', {
  baseUrl: process.env.BACKEND_URL || '',
});

