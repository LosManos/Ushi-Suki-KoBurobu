// DOM Elements
const connectSection = document.getElementById('connect-section') as HTMLElement;
const explorerSection = document.getElementById('explorer-section') as HTMLElement;
const settingsSection = document.getElementById('settings-section') as HTMLElement;
const containerView = document.getElementById('container-view') as HTMLElement;
const blobView = document.getElementById('blob-view') as HTMLElement;

const connectionStringInput = document.getElementById('connection-string') as HTMLInputElement;
const connectBtn = document.getElementById('connect-btn') as HTMLButtonElement;
const disconnectBtn = document.getElementById('disconnect-btn') as HTMLButtonElement;
const refreshContainersBtn = document.getElementById('refresh-containers-btn') as HTMLButtonElement;
const refreshBlobsBtn = document.getElementById('refresh-blobs-btn') as HTMLButtonElement;
const pageSizeSelect = document.getElementById('page-size-select') as HTMLSelectElement;
const backToContainersBtn = document.getElementById('back-to-containers') as HTMLButtonElement;
const blobSearchInput = document.getElementById('blob-search-input') as HTMLInputElement;
const blobDelimiterInput = document.getElementById('blob-delimiter-input') as HTMLInputElement;
const searchBlobsBtn = document.getElementById('search-blobs-btn') as HTMLButtonElement;

const localTimeBtn = document.getElementById('local-time-btn') as HTMLButtonElement;
const utcTimeBtn = document.getElementById('utc-time-btn') as HTMLButtonElement;
const headerTimeToggle = document.getElementById('header-time-toggle') as HTMLInputElement;

const containerList = document.getElementById('container-list') as HTMLUListElement;
const blobList = document.getElementById('blob-list') as HTMLUListElement;
const containerCountLabel = document.getElementById('container-count') as HTMLElement;
const accountNameLabel = document.getElementById('account-name') as HTMLElement;
const currentContainerNameLabel = document.getElementById('current-container-name') as HTMLElement;
const connectionStatus = document.getElementById('connection-status') as HTMLElement;
const statusText = document.getElementById('status-text') as HTMLElement;
const itemStatsCard = document.getElementById('item-stats-card') as HTMLElement;
const itemCountLabel = document.getElementById('item-count') as HTMLElement;
const blobListStats = document.getElementById('blob-list-stats') as HTMLElement;
const containerCountCard = document.querySelector('.stat-card') as HTMLElement; // First card

const modalOverlay = document.getElementById('modal-overlay') as HTMLElement;
const modal = modalOverlay.querySelector('.modal') as HTMLElement;
const modalTitle = modalOverlay.querySelector('.modal-header h3') as HTMLElement;
const modalContent = document.getElementById('modal-content') as HTMLElement;
const closeModalBtn = document.getElementById('close-modal-btn') as HTMLButtonElement;
const modalOkBtn = document.getElementById('modal-ok-btn') as HTMLButtonElement;
const modalCancelBtn = document.getElementById('modal-cancel-btn') as HTMLButtonElement;
const modalConfirmDeleteBtn = document.getElementById('modal-confirm-delete-btn') as HTMLButtonElement;

// Electron API (from preload)
const api = (window as any).electronAPI;

let currentContainer: string | null = null;
let currentContinuationToken: string | undefined = undefined;
let useUTC = false;
let lastActiveElement: HTMLElement | null = null;
let selectedBlobs: Set<string> = new Set();

function toggleBlobSelection(blobName: string, element: HTMLElement) {
    if (selectedBlobs.has(blobName)) {
        selectedBlobs.delete(blobName);
        element.classList.remove('selected');
    } else {
        selectedBlobs.add(blobName);
        element.classList.add('selected');
    }
}

function selectAllBlobs() {
    const items = blobList.querySelectorAll('.list-item:not(.empty):not(.load-more-item)');
    items.forEach(item => {
        const blobName = item.getAttribute('data-blob-name');
        if (blobName) {
            selectedBlobs.add(blobName);
            item.classList.add('selected');
        }
    });
}

function clearSelection() {
    selectedBlobs.clear();
    const items = blobList.querySelectorAll('.list-item.selected');
    items.forEach(item => item.classList.remove('selected'));
}

function formatBytes(bytes: number, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function formatDateTime(dateStr: string | Date): string {
    const date = new Date(dateStr);
    const pad = (num: number) => num.toString().padStart(2, '0');

    // ISO format: yyyy-mm-dd hh:MM:ss
    const y = useUTC ? date.getUTCFullYear() : date.getFullYear();
    const m = pad((useUTC ? date.getUTCMonth() : date.getMonth()) + 1);
    const d = pad(useUTC ? date.getUTCDate() : date.getDate());
    const h = pad(useUTC ? date.getUTCHours() : date.getHours());
    const min = pad(useUTC ? date.getUTCMinutes() : date.getMinutes());
    const s = pad(useUTC ? date.getUTCSeconds() : date.getSeconds());

    return `${y}-${m}-${d} ${h}:${min}:${s}`;
}

async function updateContainerList() {
    containerList.innerHTML = '<li class="list-item empty">Loading containers...</li>';

    const result = await api.listContainers();
    if (result.success) {
        containerCountLabel.textContent = result.containers.length.toString();
        if (result.containers.length === 0) {
            containerList.innerHTML = '<li class="list-item empty">No containers found.</li>';
        } else {
            containerList.innerHTML = '';
            result.containers.forEach((container: any) => {
                const li = document.createElement('li');
                li.className = 'list-item';
                li.tabIndex = 0;
                li.setAttribute('data-container-name', container.name);
                li.setAttribute('data-tooltip', '↑↓ to navigate, Enter to open, Cmd+I to count');
                li.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span>📁</span>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span>${container.name}</span>
                            <span class="count-trigger" title="Count items (Cmd+I)">#</span>
                        </div>
                    </div>
                    <span class="text-secondary" style="font-size: 0.8rem">${formatDateTime(container.lastModified)}</span>
                `;
                li.onclick = (e) => {
                    const target = e.target as HTMLElement;
                    if (target.classList.contains('count-trigger')) {
                        e.stopPropagation();
                        performRecursiveCount('', target, container.name);
                        return;
                    }
                    openContainer(container.name);
                };
                containerList.appendChild(li);
            });
            // Focus first item to enable immediate keyboard navigation
            const firstItem = containerList.querySelector('.list-item') as HTMLElement;
            if (firstItem) firstItem.focus();
        }
    } else {
        containerList.innerHTML = `<li class="list-item empty text-danger">Error: ${result.error}</li>`;
    }
}

async function openContainer(name: string) {
    currentContainer = name;
    blobSearchInput.value = ''; // Reset search/prefix when opening new container
    clearSelection();
    updateBreadcrumbs();
    containerView.style.display = 'none';
    blobView.style.display = 'block';
    updateBlobList();
}

function updateBreadcrumbs() {
    if (!currentContainer) return;

    currentContainerNameLabel.innerHTML = '';

    // Root container
    const rootSpan = document.createElement('span');
    rootSpan.className = 'breadcrumb-item';
    rootSpan.textContent = currentContainer;
    rootSpan.onclick = () => {
        blobSearchInput.value = '';
        updateBlobList();
    };
    currentContainerNameLabel.appendChild(rootSpan);

    const prefix = blobSearchInput.value;
    const delimiter = blobDelimiterInput.value || '/';

    if (prefix) {
        const parts = prefix.split(delimiter).filter(p => p.length > 0);
        let currentPath = '';

        parts.forEach((part, index) => {
            const separator = document.createElement('span');
            separator.className = 'breadcrumb-separator';
            separator.textContent = ` ${delimiter} `;
            currentContainerNameLabel.appendChild(separator);

            currentPath += part + delimiter;
            const segmentSpan = document.createElement('span');
            segmentSpan.className = 'breadcrumb-item';
            segmentSpan.textContent = part;

            // Only make it clickable if it's not the last one (or maybe always clickable to refresh)
            const capturedPath = currentPath;
            segmentSpan.onclick = () => {
                blobSearchInput.value = capturedPath;
                updateBlobList();
            };

            currentContainerNameLabel.appendChild(segmentSpan);
        });
    }
}

function navigateUp() {
    const prefix = blobSearchInput.value;
    const delimiter = blobDelimiterInput.value || '/';

    if (!prefix || prefix === '') {
        backToContainersBtn.click();
        return;
    }

    // Remove trailing delimiter if it exists
    let cleanPrefix = prefix;
    if (prefix.endsWith(delimiter)) {
        cleanPrefix = prefix.slice(0, -1);
    }

    const lastDelimiterIndex = cleanPrefix.lastIndexOf(delimiter);
    if (lastDelimiterIndex === -1) {
        // We are at the first level folder, go to root of container
        blobSearchInput.value = '';
    } else {
        // Go to parent folder
        blobSearchInput.value = cleanPrefix.slice(0, lastDelimiterIndex + 1);
    }

    clearSelection();
    updateBlobList();
}

async function performRecursiveCount(path: string, badgeElement: HTMLElement, containerOverride?: string) {
    const container = containerOverride || currentContainer;
    if (!container) return;

    badgeElement.textContent = '...';
    badgeElement.classList.add('loading');

    // Use the dedicated countBlobs API which does a flat (recursive) listing of blobs
    const result = await api.countBlobs(container, path);

    if (result.success) {
        badgeElement.textContent = result.count.toString();
        badgeElement.classList.remove('loading');
        badgeElement.classList.add('counted');
    } else {
        badgeElement.textContent = '!';
        badgeElement.classList.remove('loading');
    }
}

function countLoadedItems() {
    if (blobView.style.display !== 'none') {
        const loadedItems = blobList.querySelectorAll('.list-item:not(.empty):not(.load-more-item)').length;
        const totalIndicator = itemCountLabel.textContent?.includes('+') ? '+' : '';
        itemCountLabel.textContent = loadedItems.toString() + totalIndicator;

        // Visual feedback
        itemCountLabel.style.transition = 'none';
        itemCountLabel.style.color = 'var(--accent)';
        setTimeout(() => {
            itemCountLabel.style.transition = 'color 0.5s ease';
            itemCountLabel.style.color = '';
        }, 50);
    } else if (containerView.style.display !== 'none') {
        const loadedContainers = containerList.querySelectorAll('.list-item:not(.empty)').length;
        containerCountLabel.textContent = loadedContainers.toString();

        containerCountLabel.style.transition = 'none';
        containerCountLabel.style.color = 'var(--accent)';
        setTimeout(() => {
            containerCountLabel.style.transition = 'color 0.5s ease';
            containerCountLabel.style.color = '';
        }, 50);
    }
}

async function showBlobProperties(blobName: string) {
    if (!currentContainer) return;

    lastActiveElement = document.activeElement as HTMLElement;
    modalTitle.textContent = 'Blob Properties';
    modal.classList.remove('large');
    modalContent.innerHTML = '<div class="text-secondary">Fetching properties...</div>';

    // Reset buttons
    modalOkBtn.style.display = 'inline-block';
    modalCancelBtn.style.display = 'none';
    modalConfirmDeleteBtn.style.display = 'none';

    modalOverlay.style.display = 'flex';
    modalContent.focus(); // Focus for scrolling

    const result = await api.getBlobProperties(currentContainer, blobName);

    if (result.success) {
        const props = result.properties;
        let metadataHtml = '';
        if (props.metadata && Object.keys(props.metadata).length > 0) {
            const rows = Object.entries(props.metadata).map(([key, value]) => `
                <tr>
                    <td>${key}</td>
                    <td>${value}</td>
                </tr>
            `).join('');

            metadataHtml = `
                <div class="metadata-section">
                    <span class="property-label" style="margin-bottom: 8px; display: block;">Metadata</span>
                    <table class="metadata-table">
                        <thead>
                            <tr>
                                <th>Key</th>
                                <th>Value</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows}
                        </tbody>
                    </table>
                </div>
            `;
        }

        modalContent.innerHTML = `
            <div class="property-grid">
                <div class="property-item">
                    <span class="property-label">Name</span>
                    <span class="property-value" style="font-weight: 600;">${props.name}</span>
                </div>
                <div class="property-item">
                    <span class="property-label">Content Type</span>
                    <span class="property-value">${props.contentType}</span>
                </div>
                <div class="property-item">
                    <span class="property-label">Content-MD5</span>
                    <span class="property-value" style="font-size: 0.8rem; font-family: monospace;">${props.contentMD5 || ''}</span>
                </div>
                <div class="property-item">
                    <span class="property-label">Size</span>
                    <span class="property-value">${formatBytes(props.contentLength)}</span>
                </div>
                <div class="property-item">
                    <span class="property-label">Access Tier</span>
                    <span class="property-value">${props.accessTier || ''}</span>
                </div>
                <div class="property-item">
                    <span class="property-label">Blob Type</span>
                    <span class="property-value">${props.blobType}</span>
                </div>
                <div class="property-item">
                    <span class="property-label">Created On</span>
                    <span class="property-value">${formatDateTime(props.createdOn)}</span>
                </div>
                <div class="property-item">
                    <span class="property-label">Last Modified</span>
                    <span class="property-value">${formatDateTime(props.lastModified)}</span>
                </div>
                <div class="property-item">
                    <span class="property-label">ETag</span>
                    <span class="property-value" style="font-size: 0.7rem; font-family: monospace;">${props.etag}</span>
                </div>
                ${metadataHtml}
            </div>
        `;
        // Refocus after content update
        modalContent.focus();
    } else {
        modalContent.innerHTML = `<div class="text-danger">Error: ${result.error}</div>`;
        modalContent.focus();
    }
}

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];

function isImage(name: string, contentType: string): boolean {
    const lowerName = name.toLowerCase();
    const isExtensionMatch = IMAGE_EXTENSIONS.some(ext => lowerName.endsWith(ext));
    const isImageContentType = contentType && contentType.startsWith('image/');
    const isOctetStream = contentType === 'application/octet-stream';

    return isImageContentType || (isOctetStream && isExtensionMatch);
}

async function deleteBlobsUI(blobNames: string[]) {
    if (!currentContainer || blobNames.length === 0) return;

    lastActiveElement = document.activeElement as HTMLElement;
    modalTitle.textContent = blobNames.length > 1 ? `Confirm Delete (${blobNames.length} items)` : 'Confirm Delete';
    modal.classList.remove('large');

    const namesList = blobNames.length > 5
        ? `${blobNames.slice(0, 5).join('<br>')}<br>...and ${blobNames.length - 5} more`
        : blobNames.join('<br>');

    modalContent.innerHTML = `
        <div style="padding: 10px 0;">
            <p>Are you sure you want to delete ${blobNames.length > 1 ? 'these blobs' : 'this blob'}?</p>
            <div style="margin-top: 15px; padding: 12px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 8px; max-height: 200px; overflow-y: auto;">
                <span style="font-family: monospace; word-break: break-all; color: #ef4444; font-size: 0.85rem;">${namesList}</span>
            </div>
            <p style="margin-top: 15px; font-size: 0.85rem; color: var(--text-secondary);">This action cannot be undone.</p>
        </div>
    `;

    // Switch buttons
    modalOkBtn.style.display = 'none';
    modalCancelBtn.style.display = 'inline-block';
    modalConfirmDeleteBtn.style.display = 'inline-block';
    modalConfirmDeleteBtn.textContent = 'Delete';
    modalConfirmDeleteBtn.disabled = false;

    modalOverlay.style.display = 'flex';

    modalConfirmDeleteBtn.onclick = async () => {
        modalConfirmDeleteBtn.disabled = true;
        modalConfirmDeleteBtn.textContent = 'Deleting...';

        let result;
        if (blobNames.length === 1) {
            result = await api.deleteBlob(currentContainer!, blobNames[0]);
        } else {
            result = await api.deleteBlobs(currentContainer!, blobNames);
        }

        if (result.success) {
            closeModal();
            clearSelection();
            updateBlobList();
        } else {
            alert('Delete failed: ' + result.error);
            modalConfirmDeleteBtn.disabled = false;
            modalConfirmDeleteBtn.textContent = 'Delete';
        }
    };

    modalCancelBtn.onclick = () => closeModal();
    modalConfirmDeleteBtn.focus();
}

async function showBlobImage(blobName: string, contentType: string) {
    if (!currentContainer) return;

    lastActiveElement = document.activeElement as HTMLElement;
    modalTitle.textContent = 'Blob Preview';
    modal.classList.add('large');
    modalContent.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 15px; padding: 20px;">
            <div class="text-secondary">Loading image...</div>
            <div class="loading-spinner"></div>
        </div>
    `;

    // Reset buttons
    modalOkBtn.style.display = 'inline-block';
    modalCancelBtn.style.display = 'none';
    modalConfirmDeleteBtn.style.display = 'none';

    modalOverlay.style.display = 'flex';

    const result = await api.getBlobData(currentContainer, blobName);

    if (result.success) {
        // Use proper content type for the blob URL if it was octet-stream
        let blobType = contentType;
        if (contentType === 'application/octet-stream' || !contentType || contentType === 'blob') {
            const lowerName = blobName.toLowerCase();
            if (lowerName.endsWith('.svg')) blobType = 'image/svg+xml';
            else if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) blobType = 'image/jpeg';
            else if (lowerName.endsWith('.png')) blobType = 'image/png';
            else if (lowerName.endsWith('.gif')) blobType = 'image/gif';
            else if (lowerName.endsWith('.webp')) blobType = 'image/webp';
            else if (lowerName.endsWith('.bmp')) blobType = 'image/bmp';
        }

        const blob = new Blob([result.data], { type: blobType });
        const url = URL.createObjectURL(blob);

        modalContent.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; gap: 15px;">
                <div style="max-height: 70vh; max-width: 100%; overflow: auto; border: 1px solid var(--border-color); border-radius: 4px; background: #000;">
                    <img src="${url}" style="max-width: 100%; display: block;" onload="URL.revokeObjectURL('${url}')" />
                </div>
                <div class="text-secondary" style="font-size: 0.9rem;">${blobName}</div>
                <div class="text-secondary" style="font-size: 0.8rem;">${contentType} (${formatBytes(result.data.length)})</div>
            </div>
        `;
        modalContent.focus();
    } else {
        modalContent.innerHTML = `<div class="text-danger">Error loading image: ${result.error}</div>`;
        modalContent.focus();
    }
}

function closeModal() {
    modalOverlay.style.display = 'none';
    // Return focus to the original item that triggered the modal
    if (lastActiveElement) {
        lastActiveElement.focus();
        lastActiveElement = null;
    }
}

async function updateBlobList(isLoadMore = false) {
    if (!currentContainer) return;

    updateBreadcrumbs();

    if (!isLoadMore) {
        blobList.innerHTML = '<li class="list-item empty">Loading blobs...</li>';
        currentContinuationToken = undefined;
        clearSelection();
    } else {
        // Remove the "Load More" item if it exists
        const moreItem = blobList.querySelector('.load-more-item');
        if (moreItem) moreItem.remove();

        const loadingLi = document.createElement('li');
        loadingLi.className = 'list-item empty loading-more-indicator';
        loadingLi.innerHTML = '<span>Loading more...</span>';
        blobList.appendChild(loadingLi);
    }

    const pageSize = parseInt(pageSizeSelect.value) || 100;
    const prefix = blobSearchInput.value.trim() || undefined;
    const delimiter = blobDelimiterInput.value.trim() || undefined;

    const result = await api.listBlobs(currentContainer, pageSize, currentContinuationToken, prefix, delimiter);

    // Remove loading more indicator
    const loadingMore = blobList.querySelector('.loading-more-indicator');
    if (loadingMore) loadingMore.remove();

    if (result.success) {
        const folderCount = result.blobs.filter((b: any) => b.type === 'directory').length;
        const fileCount = result.blobs.length - folderCount;
        const totalCount = result.blobs.length;

        itemStatsCard.style.display = 'block';
        itemCountLabel.textContent = totalCount.toString() + (result.hasMore ? '+' : '');
        blobListStats.textContent = `(${folderCount} folders, ${fileCount} files)`;

        if (!isLoadMore && result.blobs.length === 0) {
            blobList.innerHTML = '<li class="list-item empty">No blobs found in this container.</li>';
        } else {
            if (!isLoadMore) blobList.innerHTML = '';

            result.blobs.forEach((blob: any) => {
                const li = document.createElement('li');
                li.className = 'list-item';
                if (selectedBlobs.has(blob.name)) li.classList.add('selected');
                li.tabIndex = 0;
                li.setAttribute('data-blob-name', blob.name);
                li.setAttribute('data-blob-type', blob.type === 'directory' ? 'directory' : 'file');
                const contentType = blob.type === 'directory' ? 'directory' : (blob.type || 'application/octet-stream');
                if (blob.type !== 'directory') {
                    li.setAttribute('data-content-type', contentType);
                }

                li.setAttribute('data-tooltip', blob.type === 'directory' ? '↑↓ to navigate, Enter to select, Cmd+I to count folder' : '↑↓ to navigate, Clicking marks, Double-click/Alt+Enter for meta data, Enter for image');
                li.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 10px; flex: 1; pointer-events: none;">
                        <span>${blob.type === 'directory' ? '📁' : '📄'}</span>
                        <div style="display: flex; flex-direction: column;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span>${blob.name}</span>
                                ${blob.type === 'directory' ? `<span class="count-trigger" style="pointer-events: auto;" title="Count items (Cmd+I)">#</span>` : ''}
                            </div>
                            <span class="text-secondary" style="font-size: 0.7rem">${blob.type || 'unknown'}</span>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <div style="text-align: right; pointer-events: none;">
                            <span class="text-secondary" style="font-size: 0.8rem; display: block;">${blob.type === 'directory' ? '--' : formatBytes(blob.size)}</span>
                            <span class="text-secondary" style="font-size: 0.7rem">${blob.type === 'directory' ? '--' : formatDateTime(blob.lastModified)}</span>
                        </div>
                        ${blob.type !== 'directory' ? `<span class="delete-trigger" title="Delete (Del)">🗑️</span>` : ''}
                    </div>
                `;

                li.onclick = (e) => {
                    const target = e.target as HTMLElement;
                    if (target.classList.contains('count-trigger')) {
                        e.stopPropagation();
                        performRecursiveCount(blob.name, target);
                        return;
                    }

                    if (target.classList.contains('delete-trigger')) {
                        e.stopPropagation();
                        deleteBlobsUI([blob.name]);
                        return;
                    }

                    if (blob.type === 'directory') {
                        blobSearchInput.value = blob.name;
                        updateBlobList();
                    } else {
                        // Mark it
                        toggleBlobSelection(blob.name, li);
                    }
                };

                li.ondblclick = (e) => {
                    if (blob.type !== 'directory') {
                        e.stopPropagation();
                        showBlobProperties(blob.name);
                    }
                };

                li.oncontextmenu = (e) => {
                    if (blob.type !== 'directory') {
                        e.preventDefault();
                        if (isImage(blob.name, contentType)) {
                            showBlobImage(blob.name, contentType);
                        }
                    }
                };

                blobList.appendChild(li);
            });

            currentContinuationToken = result.continuationToken;

            if (result.hasMore) {
                const moreLi = document.createElement('li');
                moreLi.className = 'list-item empty load-more-item';
                moreLi.style.fontSize = '0.8rem';
                moreLi.style.borderStyle = 'dashed';
                moreLi.style.cursor = 'pointer';
                moreLi.tabIndex = 0;
                moreLi.setAttribute('data-tooltip', 'Click or Enter to load more');
                moreLi.innerHTML = `<span>More items available. Click to load more...</span>`;
                moreLi.onclick = () => updateBlobList(true);
                moreLi.onkeydown = (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        updateBlobList(true);
                    }
                };
                blobList.appendChild(moreLi);
            }

            if (!isLoadMore) {
                // Focus first item to enable immediate keyboard navigation
                const firstItem = blobList.querySelector('.list-item') as HTMLElement;
                if (firstItem) firstItem.focus();
            } else {
                // Focus the first newly added item or the load more button if still present
                const items = blobList.querySelectorAll('.list-item');
                const lastItems = Array.from(items).slice(-result.blobs.length - (result.hasMore ? 1 : 0));
                if (lastItems.length > 0) (lastItems[0] as HTMLElement).focus();
            }
        }
    } else {
        blobList.innerHTML = `<li class="list-item empty text-danger">Error: ${result.error}</li>`;
    }
}

connectBtn.addEventListener('click', async () => {
    const connStr = connectionStringInput.value.trim();
    if (!connStr) {
        alert('Please enter a connection string');
        return;
    }

    connectBtn.disabled = true;
    connectBtn.textContent = 'Connecting...';

    const result = await api.connect(connStr);

    if (result.success) {
        connectSection.style.display = 'none';
        explorerSection.style.display = 'block';
        settingsSection.style.display = 'none';
        accountNameLabel.textContent = result.accountName;

        connectionStatus.classList.remove('disconnected');
        connectionStatus.classList.add('connected');
        statusText.textContent = 'Connected';
        disconnectBtn.style.display = 'inline-block';

        updateContainerList();
    } else {
        alert('Connection failed: ' + result.error);
        connectionStringInput.focus();
    }

    connectBtn.disabled = false;
    connectBtn.textContent = 'Connect Account';
});

connectionStringInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        connectBtn.click();
    }
});

disconnectBtn.addEventListener('click', async () => {
    await api.disconnect();

    connectSection.style.display = 'block';
    explorerSection.style.display = 'none';
    settingsSection.style.display = 'none';
    containerView.style.display = 'block';
    blobView.style.display = 'none';
    itemStatsCard.style.display = 'none';

    connectionStatus.classList.remove('connected');
    connectionStatus.classList.add('disconnected');
    statusText.textContent = 'Disconnected';
    disconnectBtn.style.display = 'none';

    connectionStringInput.value = '';
    currentContainer = null;
    connectionStringInput.focus();
});

// Keyboard Shortcuts
window.addEventListener('keydown', (e) => {
    // Modal Keyboard Navigation
    if (modalOverlay.style.display === 'flex') {
        if (e.key === 'Escape') {
            e.preventDefault();
            closeModal();
            return;
        }
        if (e.key === 'Enter') {
            // Only close automatically if it's an informational modal (only OK btn is visible)
            if (modalOkBtn.style.display !== 'none') {
                e.preventDefault();
                closeModal();
                return;
            }
            // Otherwise, let the specific interaction (like confirm delete) handle Enter
        }
    }

    // Cmd/Ctrl + D for Disconnect
    if ((e.metaKey || e.ctrlKey) && e.code === 'KeyD') {
        if (explorerSection.style.display !== 'none' || settingsSection.style.display !== 'none') {
            e.preventDefault();
            disconnectBtn.click();
        }
    }

    // Cmd/Ctrl + , for Settings
    if ((e.metaKey || e.ctrlKey) && (e.key === ',' || e.code === 'Comma')) {
        e.preventDefault();
        const settingsTab = Array.from(document.querySelectorAll('.nav-item')).find(item => item.textContent?.trim() === 'Settings') as HTMLElement;
        if (settingsTab) settingsTab.click();
    }

    // Cmd/Ctrl + E for Containers
    if ((e.metaKey || e.ctrlKey) && e.code === 'KeyE') {
        e.preventDefault();
        const containersTab = Array.from(document.querySelectorAll('.nav-item')).find(item => item.textContent?.trim() === 'Containers') as HTMLElement;
        if (containersTab) containersTab.click();
    }

    // Cmd/Ctrl + Enter for Connect
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        if (connectSection.style.display !== 'none' && !connectBtn.disabled) {
            e.preventDefault();
            connectBtn.click();
            return;
        }
    }

    // Cmd/Ctrl + A for Select All
    if ((e.metaKey || e.ctrlKey) && (e.key === 'a' || e.key === 'A')) {
        if (blobView.style.display !== 'none') {
            const activeElement = document.activeElement;
            if (activeElement?.tagName !== 'INPUT' && activeElement?.tagName !== 'TEXTAREA') {
                e.preventDefault();
                selectAllBlobs();
                return;
            }
        }
    }

    // List Item Interactions
    if ((e.key === 'Enter' || e.key === ' ') && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
        // Check if we are in a confirmation modal
        if (modalOverlay.style.display === 'flex' && modalConfirmDeleteBtn.style.display !== 'none') {
            if (e.key === 'Enter') {
                e.preventDefault();
                const activeBtn = document.activeElement as HTMLElement;
                if (activeBtn && (activeBtn === modalConfirmDeleteBtn || activeBtn === modalCancelBtn)) {
                    activeBtn.click();
                } else {
                    modalConfirmDeleteBtn.click();
                }
            }
            return;
        }

        const activeElement = document.activeElement as HTMLElement;
        if (activeElement && activeElement.classList.contains('list-item')) {
            const blobName = activeElement.getAttribute('data-blob-name');
            const blobType = activeElement.getAttribute('data-blob-type');
            const contentType = activeElement.getAttribute('data-content-type') || 'application/octet-stream';

            if (blobView.style.display !== 'none' && blobName) {
                if (blobType === 'directory') {
                    if (e.key === 'Enter') {
                        blobSearchInput.value = blobName;
                        updateBlobList();
                    }
                } else {
                    if (e.key === ' ') {
                        e.preventDefault();
                        toggleBlobSelection(blobName, activeElement);
                    } else if (e.key === 'Enter') {
                        e.preventDefault();
                        if (isImage(blobName, contentType)) {
                            showBlobImage(blobName, contentType);
                        } else {
                            // Signal user
                            activeElement.classList.add('shake');
                            setTimeout(() => activeElement.classList.remove('shake'), 400);
                            statusText.textContent = 'Not an image';
                            statusText.classList.add('status-message-highlight');
                            setTimeout(() => {
                                if (statusText.textContent === 'Not an image') {
                                    statusText.textContent = 'Connected';
                                    statusText.classList.remove('status-message-highlight');
                                }
                            }, 2000);
                        }
                    }
                }
            } else if (containerView.style.display !== 'none' && e.key === 'Enter') {
                const containerName = activeElement.getAttribute('data-container-name');
                if (containerName) openContainer(containerName);
            }
            return;
        }
    }

    // Alt + Enter for Meta Data (Properties)
    if (e.key === 'Enter' && e.altKey) {
        const activeElement = document.activeElement as HTMLElement;
        if (activeElement && activeElement.classList.contains('list-item')) {
            const blobName = activeElement.getAttribute('data-blob-name');
            if (blobName && activeElement.getAttribute('data-blob-type') !== 'directory') {
                e.preventDefault();
                showBlobProperties(blobName);
                return;
            }
        }
    }

    // Delete Item (Delete or Alt+Backspace)
    if ((e.key === 'Delete' || (e.altKey && e.key === 'Backspace')) && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
        if (blobView.style.display !== 'none') {
            if (selectedBlobs.size > 0) {
                e.preventDefault();
                deleteBlobsUI(Array.from(selectedBlobs));
                return;
            } else {
                const activeElement = document.activeElement as HTMLElement;
                if (activeElement && activeElement.classList.contains('list-item')) {
                    const blobName = activeElement.getAttribute('data-blob-name');
                    const blobType = activeElement.getAttribute('data-blob-type');
                    if (blobName && blobType !== 'directory') {
                        e.preventDefault();
                        deleteBlobsUI([blobName]);
                        return;
                    }
                }
            }
        }
    }

    // List Navigation (ArrowUp/ArrowDown)
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const activeElement = document.activeElement;
        if (activeElement && activeElement.classList.contains('list-item')) {
            e.preventDefault();
            const parent = activeElement.parentElement;
            if (parent) {
                const items = Array.from(parent.querySelectorAll('.list-item')) as HTMLElement[];
                const currentIndex = items.indexOf(activeElement as HTMLElement);
                let nextIndex = currentIndex;

                if (e.key === 'ArrowDown') {
                    nextIndex = Math.min(items.length - 1, currentIndex + 1);
                } else {
                    nextIndex = Math.max(0, currentIndex - 1);
                }

                items[nextIndex].focus();
            }
        }
    }

    // Backspace to go back/up
    if (e.key === 'Backspace') {
        if (blobView.style.display !== 'none') {
            const activeElement = document.activeElement;
            // Check if focus is NOT in an input/textarea to avoid breaking text editing
            if (activeElement?.tagName !== 'INPUT' && activeElement?.tagName !== 'TEXTAREA') {
                e.preventDefault();
                navigateUp();
            }
        }
    }

    // Refresh with 'R'
    if (e.key === 'r' || e.key === 'R') {
        const activeElement = document.activeElement;
        if (activeElement?.tagName !== 'INPUT' && activeElement?.tagName !== 'TEXTAREA' && activeElement?.tagName !== 'SELECT') {
            if (explorerSection.style.display !== 'none') {
                e.preventDefault();
                if (blobView.style.display !== 'none') {
                    refreshBlobsBtn.click();
                } else {
                    refreshContainersBtn.click();
                }
            }
        }
    }

    // Focus Page Size with 'P'
    if (e.key === 'p' || e.key === 'P') {
        const activeElement = document.activeElement;
        if (activeElement?.tagName !== 'INPUT' && activeElement?.tagName !== 'TEXTAREA' && activeElement?.tagName !== 'SELECT') {
            if (blobView.style.display !== 'none') {
                e.preventDefault();
                pageSizeSelect.focus();
            }
        }
    }

    // Cmd/Ctrl + F for Search
    if ((e.metaKey || e.ctrlKey) && e.code === 'KeyF') {
        if (blobView.style.display !== 'none') {
            e.preventDefault();
            blobSearchInput.focus();
            blobSearchInput.select();
        }
    }

    // Cmd/Ctrl + I for Blob Counter or Properties
    if ((e.metaKey || e.ctrlKey) && e.code === 'KeyI') {
        e.preventDefault();
        const activeElement = document.activeElement as HTMLElement;

        // Check if we are focused on a list item
        if (activeElement && activeElement.classList.contains('list-item')) {
            const countTrigger = activeElement.querySelector('.count-trigger') as HTMLElement;
            if (countTrigger) {
                countTrigger.click();
            } else {
                // Check if it's a blob file
                const blobName = activeElement.getAttribute('data-blob-name');
                const blobType = activeElement.getAttribute('data-blob-type');
                if (blobName && blobType === 'file') {
                    showBlobProperties(blobName);
                } else {
                    // Otherwise count all loaded items on client
                    countLoadedItems();
                }
            }
        } else {
            // Nothing specific focused, count all loaded items
            countLoadedItems();
        }
    }
});

closeModalBtn.addEventListener('click', closeModal);
modalOkBtn.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
});

backToContainersBtn.addEventListener('click', () => {
    const prefix = blobSearchInput.value;
    if (prefix && prefix !== '') {
        navigateUp();
    } else {
        currentContainer = null;
        blobView.style.display = 'none';
        containerView.style.display = 'block';
        itemStatsCard.style.display = 'none';
        updateContainerList();
    }
});

refreshContainersBtn.addEventListener('click', updateContainerList);
refreshBlobsBtn.addEventListener('click', () => updateBlobList());

searchBlobsBtn.addEventListener('click', () => updateBlobList());
blobSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        updateBlobList();
    }
});
blobDelimiterInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        updateBlobList();
    }
});

pageSizeSelect.addEventListener('change', () => {
    if (currentContainer) {
        updateBlobList();
    }
});

// Settings Toggle Logic
function updateTimeSetting(value: boolean) {
    useUTC = value;
    headerTimeToggle.checked = useUTC;
    if (useUTC) {
        utcTimeBtn.classList.add('active');
        localTimeBtn.classList.remove('active');
    } else {
        localTimeBtn.classList.add('active');
        utcTimeBtn.classList.remove('active');
    }
    refreshAllViews();
}

localTimeBtn.addEventListener('click', () => updateTimeSetting(false));
utcTimeBtn.addEventListener('click', () => updateTimeSetting(true));
headerTimeToggle.addEventListener('change', () => updateTimeSetting(headerTimeToggle.checked));

function refreshAllViews() {
    if (explorerSection.style.display !== 'none') {
        if (blobView.style.display !== 'none') {
            updateBlobList();
        } else {
            updateContainerList();
        }
    }
}

// Tab switching (sidebar)
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');

        const tabName = item.textContent?.trim();

        // UI helper to show/hide sections
        const showSection = (id: string) => {
            connectSection.style.display = id === 'connect' ? 'block' : 'none';
            explorerSection.style.display = id === 'explorer' ? 'block' : 'none';
            settingsSection.style.display = id === 'settings' ? 'block' : 'none';
        };

        if (tabName === 'Dashboard') {
            if (statusText.textContent === 'Connected') {
                showSection('explorer');
                if (currentContainer) {
                    containerView.style.display = 'none';
                    blobView.style.display = 'block';
                } else {
                    containerView.style.display = 'block';
                    blobView.style.display = 'none';
                }
            } else {
                showSection('connect');
                connectionStringInput.focus();
            }
        } else if (tabName === 'Containers') {
            showSection('explorer');
            containerView.style.display = 'block';
            blobView.style.display = 'none';
            currentContainer = null;
            updateContainerList();
        } else if (tabName === 'Settings') {
            showSection('settings');
        }
    });
});

console.log('Renderer initialized');
connectionStringInput.focus();
