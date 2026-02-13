import { app, BrowserWindow, ipcMain, shell, safeStorage, nativeImage } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { BlobServiceClient } from '@azure/storage-blob';

let blobServiceClient: BlobServiceClient | null = null;
const isDev = !app.isPackaged;

function getIconPath() {
    // In dev mode, we want the source assets folder with the DEV banner
    // In production, we want the standard assets folder next to the main script (dist/assets)
    return isDev
        ? path.join(app.getAppPath(), 'assets', 'logo_dev.png')
        : path.join(__dirname, 'assets', 'logo.png');
}

function createWindow() {
    const iconPath = getIconPath();
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        },
        titleBarStyle: 'hiddenInset',
        backgroundColor: '#0f172a', // Matches CSS --bg-dark
        icon: iconPath,
        title: isDev ? `Dev - KoBurobu v${app.getVersion()}` : `KoBurobu v${app.getVersion()}`
    });

    // On macOS, set the dock icon explicitly in dev mode
    if (process.platform === 'darwin' && isDev && app.dock) {
        const image = nativeImage.createFromPath(iconPath);
        app.dock.setIcon(image);
    }

    // Ensure the title always starts with 'Dev - ' in dev mode
    if (isDev) {
        win.on('page-title-updated', (event, title) => {
            if (!title.startsWith('Dev - ')) {
                event.preventDefault();
                win.setTitle(`Dev - ${title}`);
            }
        });
    }

    win.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
    console.log('App is ready');
    createWindow();
    console.log('Window created');

    // Azure IPC Handlers
    ipcMain.handle('azure:connect', async (_event, connectionString: string) => {
        try {
            blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
            // Verify connection by listing one container (optional but good for validation)
            const properties = await blobServiceClient.getAccountInfo();
            return { success: true, accountName: blobServiceClient.accountName };
        } catch (error: any) {
            console.error('Azure Connection Error:', error);
            blobServiceClient = null;
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('azure:disconnect', () => {
        blobServiceClient = null;
        return { success: true };
    });

    ipcMain.handle('azure:listContainers', async () => {
        if (!blobServiceClient) return { success: false, error: 'Not connected' };
        try {
            const containers = [];
            for await (const container of blobServiceClient.listContainers()) {
                containers.push({
                    name: container.name,
                    lastModified: container.properties.lastModified
                });
            }
            return { success: true, containers };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('azure:listBlobs', async (_event, containerName: string, pageSize: number = 100, continuationToken?: string, prefix?: string, delimiter?: string) => {
        if (!blobServiceClient) return { success: false, error: 'Not connected' };
        try {
            const containerClient = blobServiceClient.getContainerClient(containerName);
            const blobs = [];

            let iterator;
            if (delimiter) {
                // Hierarchical listing
                iterator = containerClient.listBlobsByHierarchy(delimiter, { prefix }).byPage({
                    maxPageSize: pageSize,
                    continuationToken: continuationToken
                });
            } else {
                // Flat listing
                iterator = containerClient.listBlobsFlat({ prefix }).byPage({
                    maxPageSize: pageSize,
                    continuationToken: continuationToken
                });
            }

            const response = await iterator.next();

            let nextContinuationToken = undefined;
            if (!response.done && response.value) {
                nextContinuationToken = response.value.continuationToken;

                // Handle blobs/segments
                const segment = response.value.segment as any;

                // Add prefixes (directories) if using hierarchical listing
                if (segment.blobPrefixes) {
                    for (const prefixItem of segment.blobPrefixes) {
                        blobs.push({
                            name: prefixItem.name,
                            type: 'directory',
                            size: 0,
                            lastModified: new Date()
                        });
                    }
                }

                // Add actual blobs
                if (segment.blobItems) {
                    for (const blob of segment.blobItems) {
                        blobs.push({
                            name: blob.name,
                            size: blob.properties.contentLength,
                            lastModified: blob.properties.lastModified,
                            type: blob.properties.contentType || 'blob'
                        });
                    }
                }
            }

            return { success: true, blobs, hasMore: !!nextContinuationToken, continuationToken: nextContinuationToken };
        } catch (error: any) {
            console.error('List Blobs Error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('azure:getBlobData', async (_event, containerName: string, blobName: string) => {
        if (!blobServiceClient) return { success: false, error: 'Not connected' };
        try {
            const containerClient = blobServiceClient.getContainerClient(containerName);
            const blockBlobClient = containerClient.getBlockBlobClient(blobName);
            const buffer = await blockBlobClient.downloadToBuffer();
            return { success: true, data: buffer };
        } catch (error: any) {
            console.error('Get Blob Data Error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('azure:getBlobProperties', async (_event, containerName: string, blobName: string) => {
        if (!blobServiceClient) return { success: false, error: 'Not connected' };
        try {
            const containerClient = blobServiceClient.getContainerClient(containerName);
            const blobClient = containerClient.getBlobClient(blobName);
            const properties = await blobClient.getProperties();
            return {
                success: true,
                properties: {
                    name: blobName,
                    contentType: properties.contentType,
                    contentMD5: properties.contentMD5 ? Buffer.from(properties.contentMD5).toString('base64') : undefined,
                    contentLength: properties.contentLength,
                    lastModified: properties.lastModified,
                    createdOn: properties.createdOn,
                    accessTier: properties.accessTier,
                    blobType: properties.blobType,
                    etag: properties.etag,
                    metadata: properties.metadata
                }
            };
        } catch (error: any) {
            console.error('Get Blob Properties Error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('azure:countBlobs', async (_event, containerName: string, prefix: string) => {
        if (!blobServiceClient) return { success: false, error: 'Not connected' };
        try {
            const containerClient = blobServiceClient.getContainerClient(containerName);
            let count = 0;
            // Iterate through all blobs flatly to get total recursive count
            // We use the iterator directly to avoid loading all properties at once
            for await (const _blob of containerClient.listBlobsFlat({ prefix })) {
                count++;
            }
            return { success: true, count };
        } catch (error: any) {
            console.error('Count Blobs Error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('azure:deleteBlob', async (_event, containerName: string, blobName: string) => {
        if (!blobServiceClient) return { success: false, error: 'Not connected' };
        try {
            const containerClient = blobServiceClient.getContainerClient(containerName);
            const blobClient = containerClient.getBlobClient(blobName);
            await blobClient.delete();
            return { success: true };
        } catch (error: any) {
            console.error('Delete Blob Error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('azure:deleteBlobs', async (_event, containerName: string, blobNames: string[]) => {
        if (!blobServiceClient) return { success: false, error: 'Not connected' };
        try {
            const containerClient = blobServiceClient.getContainerClient(containerName);
            const results = {
                successCount: 0,
                errorCount: 0,
                errors: [] as { name: string, error: string }[]
            };

            for (const name of blobNames) {
                try {
                    const blobClient = containerClient.getBlobClient(name);
                    await blobClient.delete();
                    results.successCount++;
                } catch (error: any) {
                    results.errorCount++;
                    results.errors.push({ name, error: error.message });
                }
            }

            return { success: true, results };
        } catch (error: any) {
            console.error('Delete Blobs Error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('azure:uploadBlob', async (_event, containerName: string) => {
        if (!blobServiceClient) return { success: false, error: 'Not connected' };
        try {
            const { dialog } = require('electron');
            const result = await dialog.showOpenDialog({
                properties: ['openFile', 'multiSelections']
            });

            if (result.canceled) return { success: true, error: 'Canceled' };

            const containerClient = blobServiceClient.getContainerClient(containerName);
            const fs = require('fs');

            for (const filePath of result.filePaths) {
                const blobName = path.basename(filePath);
                const blockBlobClient = containerClient.getBlockBlobClient(blobName);
                const fileBuffer = fs.readFileSync(filePath);
                await blockBlobClient.upload(fileBuffer, fileBuffer.length);
            }

            return { success: true };
        } catch (error: any) {
            console.error('Upload Blob Error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('utils:openExternal', async (_event, url: string) => {
        try {
            await shell.openExternal(url);
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('utils:openPath', async (_event, relativePath: string) => {
        try {
            const absolutePath = path.join(app.getAppPath(), relativePath);
            await shell.openPath(absolutePath);
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('app:getVersion', () => {
        return app.getVersion();
    });

    ipcMain.handle('utils:readManual', async () => {
        try {
            const fs = require('fs').promises;
            const { marked } = require('marked');
            const manualPath = path.join(app.getAppPath(), 'manual.md');
            const content = await fs.readFile(manualPath, 'utf-8');
            const html = marked.parse(content);
            return { success: true, content: html };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('utils:openConnectionsFile', async () => {
        try {
            const userDataPath = app.getPath('userData');
            const connectionsPath = path.join(userDataPath, 'connections.json');
            await shell.openPath(connectionsPath);
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('utils:openSearchHistoryFile', async () => {
        try {
            const userDataPath = app.getPath('userData');
            const historyPath = path.join(userDataPath, 'search_history.json');
            await shell.openPath(historyPath);
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:saveConnection', async (_event, name: string, connectionString: string) => {
        try {
            const userDataPath = app.getPath('userData');
            const connectionsPath = path.join(userDataPath, 'connections.json');

            let connections = [];
            if (fs.existsSync(connectionsPath)) {
                const content = fs.readFileSync(connectionsPath, 'utf-8').trim();
                if (content) {
                    try {
                        connections = JSON.parse(content);
                    } catch (e) {
                        console.warn('Failed to parse connections file, starting fresh');
                    }
                }
            }

            if (!safeStorage.isEncryptionAvailable()) {
                throw new Error('Safe storage is not available on this system.');
            }

            const encrypted = safeStorage.encryptString(connectionString);
            const connection = {
                id: Date.now().toString(),
                name: name,
                connectionString: encrypted.toString('base64')
            };

            connections.push(connection);
            fs.writeFileSync(connectionsPath, JSON.stringify(connections, null, 2));
            return { success: true };
        } catch (error: any) {
            console.error('Save Connection Error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:getConnections', async () => {
        try {
            const userDataPath = app.getPath('userData');
            const connectionsPath = path.join(userDataPath, 'connections.json');

            if (!fs.existsSync(connectionsPath)) {
                return { success: true, connections: [] };
            }

            if (!safeStorage.isEncryptionAvailable()) {
                return { success: false, error: 'Safe storage is not available.' };
            }

            const content = fs.readFileSync(connectionsPath, 'utf-8').trim();
            if (!content) return { success: true, connections: [] };

            let connections = [];
            try {
                connections = JSON.parse(content);
            } catch (e) {
                return { success: false, error: 'Failed to parse connections file' };
            }

            const decryptedConnections = connections.map((conn: any) => {
                try {
                    const decrypted = safeStorage.decryptString(Buffer.from(conn.connectionString, 'base64'));
                    return { id: conn.id, name: conn.name, connectionString: decrypted.toString() };
                } catch (e) {
                    return { id: conn.id, name: conn.name, connectionString: '', error: 'Decryption failed' };
                }
            });

            return { success: true, connections: decryptedConnections };
        } catch (error: any) {
            console.error('Get Connections Error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:deleteConnection', async (_event, id: string) => {
        try {
            const userDataPath = app.getPath('userData');
            const connectionsPath = path.join(userDataPath, 'connections.json');

            if (!fs.existsSync(connectionsPath)) return { success: true };

            let connections = JSON.parse(fs.readFileSync(connectionsPath, 'utf-8'));
            connections = connections.filter((conn: any) => conn.id !== id);
            fs.writeFileSync(connectionsPath, JSON.stringify(connections, null, 2));
            return { success: true };
        } catch (error: any) {
            console.error('Delete Connection Error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:getSearchHistory', async (_event, accountName: string, containerName: string) => {
        try {
            const userDataPath = app.getPath('userData');
            const historyPath = path.join(userDataPath, 'search_history.json');

            if (!fs.existsSync(historyPath)) {
                return { success: true, history: [] };
            }

            const content = fs.readFileSync(historyPath, 'utf-8').trim();
            if (!content) return { success: true, history: [] };

            let root: any = {};
            try {
                root = JSON.parse(content);
            } catch (e) {
                return { success: false, error: 'Failed to parse history file' };
            }

            const accounts = Array.isArray(root.accounts) ? root.accounts : [];
            const accountEntry = accounts.find((a: any) => a.account === accountName);
            if (!accountEntry || !Array.isArray(accountEntry.containers)) {
                return { success: true, history: [] };
            }

            const containerEntry = accountEntry.containers.find((c: any) => c.container === containerName);
            if (!containerEntry || !Array.isArray(containerEntry.history)) {
                return { success: true, history: [] };
            }

            // Return terms for the UI
            const history = containerEntry.history.map((item: any) => item.term);
            return { success: true, history };
        } catch (error: any) {
            console.error('Get Search History Error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:saveSearchHistory', async (_event, accountName: string, containerName: string, searchTerm: string) => {
        try {
            const userDataPath = app.getPath('userData');
            const historyPath = path.join(userDataPath, 'search_history.json');

            let root: any = { accounts: [] };
            if (fs.existsSync(historyPath)) {
                const content = fs.readFileSync(historyPath, 'utf-8').trim();
                if (content) {
                    try {
                        const parsed = JSON.parse(content);
                        if (parsed && Array.isArray(parsed.accounts)) {
                            root = parsed;
                        }
                    } catch (e) {
                        console.warn('Failed to parse history file, starting fresh');
                    }
                }
            }

            // Find or Create Account
            let accountEntry = root.accounts.find((a: any) => a.account === accountName);
            if (!accountEntry) {
                accountEntry = { account: accountName, containers: [] };
                root.accounts.push(accountEntry);
            }

            // Find or Create Container
            let containerEntry = accountEntry.containers.find((c: any) => c.container === containerName);
            if (!containerEntry) {
                containerEntry = { container: containerName, history: [] };
                accountEntry.containers.push(containerEntry);
            }

            // Update History
            let items = containerEntry.history;
            const newItem = {
                term: searchTerm,
                lastUsed: new Date().toISOString()
            };

            // Deduplicate and push to top
            items = items.filter((item: any) => item.term !== searchTerm);
            items.unshift(newItem);

            if (items.length > 30) {
                items = items.slice(0, 30);
            }
            containerEntry.history = items;

            fs.writeFileSync(historyPath, JSON.stringify(root, null, 2));
            return { success: true };
        } catch (error: any) {
            console.error('Save Search History Error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:clearSearchHistory', async () => {
        try {
            const userDataPath = app.getPath('userData');
            const historyPath = path.join(userDataPath, 'search_history.json');
            if (fs.existsSync(historyPath)) {
                fs.unlinkSync(historyPath);
            }
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.on('app:quit', () => {
        app.quit();
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    console.log('All windows closed');
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
