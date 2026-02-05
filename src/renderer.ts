// DOM Elements
const connectSection = document.getElementById('connect-section') as HTMLElement;
const explorerSection = document.getElementById('explorer-section') as HTMLElement;
const containerView = document.getElementById('container-view') as HTMLElement;
const blobView = document.getElementById('blob-view') as HTMLElement;

const connectionStringInput = document.getElementById('connection-string') as HTMLInputElement;
const connectBtn = document.getElementById('connect-btn') as HTMLButtonElement;
const disconnectBtn = document.getElementById('disconnect-btn') as HTMLButtonElement;
const refreshContainersBtn = document.getElementById('refresh-containers-btn') as HTMLButtonElement;
const refreshBlobsBtn = document.getElementById('refresh-blobs-btn') as HTMLButtonElement;
const pageSizeSelect = document.getElementById('page-size-select') as HTMLSelectElement;
const backToContainersBtn = document.getElementById('back-to-containers') as HTMLButtonElement;

const containerList = document.getElementById('container-list') as HTMLUListElement;
const blobList = document.getElementById('blob-list') as HTMLUListElement;
const containerCountLabel = document.getElementById('container-count') as HTMLElement;
const accountNameLabel = document.getElementById('account-name') as HTMLElement;
const currentContainerNameLabel = document.getElementById('current-container-name') as HTMLElement;
const connectionStatus = document.getElementById('connection-status') as HTMLElement;
const statusText = document.getElementById('status-text') as HTMLElement;

// Electron API (from preload)
const api = (window as any).electronAPI;

let currentContainer: string | null = null;
let currentContinuationToken: string | undefined = undefined;

function formatBytes(bytes: number, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
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
                    <span class="text-secondary" style="font-size: 0.8rem">${new Date(container.lastModified).toLocaleDateString()}</span>
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
    currentContainerNameLabel.textContent = name;
    containerView.style.display = 'none';
    blobView.style.display = 'block';
    updateBlobList();
}

async function updateBlobList(isLoadMore = false) {
    if (!currentContainer) return;

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
    const result = await api.listBlobs(currentContainer, pageSize, currentContinuationToken);

    // Remove loading more indicator
    const loadingMore = blobList.querySelector('.loading-more-indicator');
    if (loadingMore) loadingMore.remove();

    if (result.success) {
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
                        <span>📄</span>
                        <div style="display: flex; flex-direction: column;">
                            <span>${blob.name}</span>
                            <span class="text-secondary" style="font-size: 0.7rem">${blob.type || 'unknown'}</span>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <span class="text-secondary" style="font-size: 0.8rem; display: block;">${formatBytes(blob.size)}</span>
                        <span class="text-secondary" style="font-size: 0.7rem">${new Date(blob.lastModified).toLocaleDateString()}</span>
                    </div>
                `;
                li.onclick = () => console.log('Selected blob:', blob.name);
                li.onkeydown = (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        console.log('Selected blob:', blob.name);
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
    containerView.style.display = 'block';
    blobView.style.display = 'none';

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
        if (explorerSection.style.display !== 'none') {
            e.preventDefault();
            disconnectBtn.click();
        }
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

    // Backspace to go back to containers
    if (e.key === 'Backspace') {
        if (blobView.style.display !== 'none') {
            const activeElement = document.activeElement;
            // Check if focus is NOT in an input/textarea to avoid breaking text editing
            if (activeElement?.tagName !== 'INPUT' && activeElement?.tagName !== 'TEXTAREA') {
                e.preventDefault();
                backToContainersBtn.click();
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
});

backToContainersBtn.addEventListener('click', () => {
    currentContainer = null;
    blobView.style.display = 'none';
    containerView.style.display = 'block';
    updateContainerList();
});

refreshContainersBtn.addEventListener('click', updateContainerList);
refreshBlobsBtn.addEventListener('click', () => updateBlobList());

pageSizeSelect.addEventListener('change', () => {
    if (currentContainer) {
        updateBlobList();
    }
});

// Tab switching (sidebar)
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');

        // Focus connection string if Dashboard is clicked and connect section is visible
        if (item.textContent === 'Dashboard' && connectSection.style.display !== 'none') {
            connectionStringInput.focus();
        }
    });
});

console.log('Renderer initialized');
connectionStringInput.focus();
