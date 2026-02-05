import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    platform: process.platform,
    connect: (connectionString: string) => ipcRenderer.invoke('azure:connect', connectionString),
    disconnect: () => ipcRenderer.invoke('azure:disconnect'),
    listContainers: () => ipcRenderer.invoke('azure:listContainers')
});
