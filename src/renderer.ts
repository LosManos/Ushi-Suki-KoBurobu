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

// Electron API (from preload)
const api = (window as any).electronAPI;

let currentContainer: string | null = null;
let currentContinuationToken: string | undefined = undefined;
let useUTC = false;

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
                li.setAttribute('data-tooltip', '↑↓ to navigate, Enter to open');
                li.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span>📁</span>
                        <span>${container.name}</span>
                    </div>
                    <span class="text-secondary" style="font-size: 0.8rem">${formatDateTime(container.lastModified)}</span>
                `;
                li.onclick = () => openContainer(container.name);
                li.onkeydown = (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        openContainer(container.name);
                    }
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

    updateBlobList();
}

async function performRecursiveCount(path: string, badgeElement: HTMLElement) {
    if (!currentContainer) return;

    badgeElement.textContent = '...';
    badgeElement.classList.add('loading');

    // Use the dedicated countBlobs API which does a flat (recursive) listing of blobs
    const result = await api.countBlobs(currentContainer, path);

    if (result.success) {
        badgeElement.textContent = result.count.toString();
        badgeElement.classList.remove('loading');
        badgeElement.classList.add('counted');
    } else {
        badgeElement.textContent = '!';
        badgeElement.classList.remove('loading');
    }
}

async function updateBlobList(isLoadMore = false) {
    if (!currentContainer) return;

    updateBreadcrumbs();

    if (!isLoadMore) {
        blobList.innerHTML = '<li class="list-item empty">Loading blobs...</li>';
        currentContinuationToken = undefined;
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
                li.tabIndex = 0;
                li.setAttribute('data-tooltip', '↑↓ to navigate, Enter to select');
                li.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span>${blob.type === 'directory' ? '📁' : '📄'}</span>
                        <div style="display: flex; flex-direction: column;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span>${blob.name}</span>
                                ${blob.type === 'directory' ? `<span class="count-trigger" title="Count items">#</span>` : ''}
                            </div>
                            <span class="text-secondary" style="font-size: 0.7rem">${blob.type || 'unknown'}</span>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <span class="text-secondary" style="font-size: 0.8rem; display: block;">${blob.type === 'directory' ? '--' : formatBytes(blob.size)}</span>
                        <span class="text-secondary" style="font-size: 0.7rem">${blob.type === 'directory' ? '--' : formatDateTime(blob.lastModified)}</span>
                    </div>
                `;
                li.onclick = (e) => {
                    const target = e.target as HTMLElement;
                    if (target.classList.contains('count-trigger')) {
                        e.stopPropagation();
                        performRecursiveCount(blob.name, target);
                        return;
                    }

                    if (blob.type === 'directory') {
                        blobSearchInput.value = blob.name;
                        updateBlobList();
                    } else {
                        console.log('Selected blob:', blob.name);
                    }
                };
                li.onkeydown = (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        if (blob.type === 'directory') {
                            blobSearchInput.value = blob.name;
                            updateBlobList();
                        } else {
                            console.log('Selected blob:', blob.name);
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
