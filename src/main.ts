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
