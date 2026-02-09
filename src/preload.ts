import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    platform: process.platform,
    connect: (connectionString: string) => ipcRenderer.invoke('azure:connect', connectionString),
    disconnect: () => ipcRenderer.invoke('azure:disconnect'),
    listContainers: () => ipcRenderer.invoke('azure:listContainers'),
    listBlobs: (containerName: string, pageSize: number, continuationToken?: string, prefix?: string, delimiter?: string) =>
        ipcRenderer.invoke('azure:listBlobs', containerName, pageSize, continuationToken, prefix, delimiter),
    countBlobs: (containerName: string, prefix: string) =>
        ipcRenderer.invoke('azure:countBlobs', containerName, prefix),
    getBlobProperties: (containerName: string, blobName: string) =>
        ipcRenderer.invoke('azure:getBlobProperties', containerName, blobName),
    getBlobData: (containerName: string, blobName: string) =>
        ipcRenderer.invoke('azure:getBlobData', containerName, blobName),
    deleteBlob: (containerName: string, blobName: string) =>
        ipcRenderer.invoke('azure:deleteBlob', containerName, blobName),
    deleteBlobs: (containerName: string, blobNames: string[]) =>
        ipcRenderer.invoke('azure:deleteBlobs', containerName, blobNames),
    openExternal: (url: string) => ipcRenderer.invoke('utils:openExternal', url),
    openPath: (path: string) => ipcRenderer.invoke('utils:openPath', path),
    openConnectionsFile: () => ipcRenderer.invoke('utils:openConnectionsFile'),
    readManual: () => ipcRenderer.invoke('utils:readManual'),
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    uploadBlob: (containerName: string) => ipcRenderer.invoke('azure:uploadBlob', containerName),
    saveConnection: (name: string, connectionString: string) => ipcRenderer.invoke('storage:saveConnection', name, connectionString),
    getConnections: () => ipcRenderer.invoke('storage:getConnections'),
    deleteConnection: (id: string) => ipcRenderer.invoke('storage:deleteConnection', id),
    quit: () => ipcRenderer.send('app:quit')
});
