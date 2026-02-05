import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { BlobServiceClient } from '@azure/storage-blob';

let blobServiceClient: BlobServiceClient | null = null;

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        },
        titleBarStyle: 'hiddenInset',
        backgroundColor: '#0f172a' // Matches CSS --bg-dark
    });

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

    ipcMain.handle('azure:listBlobs', async (_event, containerName: string, pageSize: number = 100, continuationToken?: string) => {
        if (!blobServiceClient) return { success: false, error: 'Not connected' };
        try {
            const containerClient = blobServiceClient.getContainerClient(containerName);
            const blobs = [];

            // Fetch the page (optionally with continuation token)
            const iterator = containerClient.listBlobsFlat().byPage({
                maxPageSize: pageSize,
                continuationToken: continuationToken
            });
            const response = await iterator.next();

            let nextContinuationToken = undefined;
            if (!response.done && response.value) {
                nextContinuationToken = response.value.continuationToken;
                for (const blob of response.value.segment.blobItems) {
                    blobs.push({
                        name: blob.name,
                        size: blob.properties.contentLength,
                        lastModified: blob.properties.lastModified,
                        type: blob.properties.contentType
                    });
                }
            }

            return { success: true, blobs, hasMore: !!nextContinuationToken, continuationToken: nextContinuationToken };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
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
