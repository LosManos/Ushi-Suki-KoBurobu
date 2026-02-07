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
const blobSearchInput = document.getElementById('blob-search-input') as HTMLInputElement;
const blobDelimiterInput = document.getElementById('blob-delimiter-input') as HTMLInputElement;
const searchBlobsBtn = document.getElementById('search-blobs-btn') as HTMLButtonElement;
const sidebarHamburger = document.getElementById('sidebar-hamburger') as HTMLButtonElement;
const hamburgerMenu = document.getElementById('hamburger-menu') as HTMLElement;
const menuSettings = document.getElementById('menu-settings') as HTMLButtonElement;
const menuAbout = document.getElementById('menu-about') as HTMLButtonElement;
const menuAccount = document.getElementById('menu-account') as HTMLButtonElement;
const menuQuit = document.getElementById('menu-quit') as HTMLButtonElement;

const headerTimeToggle = document.getElementById('header-time-toggle') as HTMLInputElement;

const explorerNav = document.getElementById('explorer-nav') as HTMLElement;
const sidebarTreeview = document.getElementById('sidebar-treeview') as HTMLUListElement;
const navConnectBtn = document.querySelector('.nav-item[data-section="connect-section"]') as HTMLButtonElement;

const containerList = document.getElementById('container-list') as HTMLUListElement;
const blobList = document.getElementById('blob-list') as HTMLUListElement;
const containerCountLabel = document.getElementById('container-count') as HTMLElement;
const accountNameLabel = document.getElementById('account-name') as HTMLElement;
const sidebarAccountNameLabel = document.getElementById('sidebar-account-name') as HTMLElement;
const currentContainerNameLabel = document.getElementById('current-container-name') as HTMLElement;
const connectionStatus = document.getElementById('connection-status') as HTMLElement;
const statusText = document.getElementById('status-text') as HTMLElement;
const itemStatsCard = document.getElementById('item-stats-card') as HTMLElement;
const itemCountLabel = document.getElementById('item-count') as HTMLElement;
const blobListStats = document.getElementById('blob-list-stats') as HTMLElement;
const footerVersion = document.getElementById('footer-version') as HTMLElement;

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
    sidebarTreeview.innerHTML = '';

    const result = await api.listContainers();
    if (result.success) {
        containerCountLabel.textContent = result.containers.length.toString();
        if (result.containers.length === 0) {
            containerList.innerHTML = '<li class="list-item empty">No containers found.</li>';
        } else {
            containerList.innerHTML = '';
            result.containers.forEach((container: any) => {
                // Main view item
                const li = document.createElement('li');
                li.className = 'list-item';
                li.tabIndex = 0;
                li.setAttribute('data-container-name', container.name);
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

                // Sidebar tree item
                const treeLi = document.createElement('li');
                treeLi.className = 'tree-item';
                treeLi.tabIndex = -1; // Roving tabindex
                treeLi.setAttribute('data-container-name', container.name);
                treeLi.innerHTML = `
                    <span class="tree-item-icon">📁</span>
                    <span class="tree-item-text">${container.name}</span>
                `;
                treeLi.onclick = () => openContainer(container.name);
                treeLi.onkeydown = (e) => {
                    if (e.key === 'Enter') {
                        openContainer(container.name);
                    } else if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        const next = treeLi.nextElementSibling as HTMLElement;
                        if (next) {
                            treeLi.tabIndex = -1;
                            next.tabIndex = 0;
                            next.focus();
                        }
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        const prev = treeLi.previousElementSibling as HTMLElement;
                        if (prev) {
                            treeLi.tabIndex = -1;
                            prev.tabIndex = 0;
                            prev.focus();
                        }
                    } else if (e.key === 'ArrowRight') {
                        e.preventDefault();
                        blobSearchInput.focus();
                    } else if (e.key === 'Tab' && !e.shiftKey) {
                        const firstBlob = blobList.querySelector('.list-item:not(.empty)') as HTMLElement;
                        if (firstBlob) {
                            e.preventDefault();
                            firstBlob.focus();
                        }
                    }
                };
                sidebarTreeview.appendChild(treeLi);
            });
            // Focus first container immediately after connection
            const firstTreeItem = sidebarTreeview.querySelector('.tree-item') as HTMLElement;
            if (firstTreeItem) {
                firstTreeItem.tabIndex = 0;
                firstTreeItem.focus();
            }
        }
    } else {
        containerList.innerHTML = `<li class="list-item empty text-danger">Error: ${result.error}</li>`;
    }
}

async function openContainer(name: string) {
    currentContainer = name;
    blobSearchInput.value = '';
    clearSelection();
    updateBreadcrumbs();
    containerView.style.display = 'none';
    blobView.style.display = 'block';
    updateBlobList();

    // Sync treeview selection and manage roving tabindex
    sidebarTreeview.querySelectorAll('.tree-item').forEach((item: any) => {
        item.classList.remove('active');
        item.tabIndex = -1;
        if (item.getAttribute('data-container-name') === name) {
            item.classList.add('active');
            item.tabIndex = 0;
        }
    });
}

function updateBreadcrumbs() {
    if (!currentContainer) return;

    currentContainerNameLabel.innerHTML = '';

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

        parts.forEach((part) => {
            const separator = document.createElement('span');
            separator.className = 'breadcrumb-separator';
            separator.textContent = ` ${delimiter} `;
            currentContainerNameLabel.appendChild(separator);

            currentPath += part + delimiter;
            const segmentSpan = document.createElement('span');
            segmentSpan.className = 'breadcrumb-item';
            segmentSpan.textContent = part;

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

    let cleanPrefix = prefix;
    if (prefix.endsWith(delimiter)) {
        cleanPrefix = prefix.slice(0, -1);
    }

    const lastDelimiterIndex = cleanPrefix.lastIndexOf(delimiter);
    if (lastDelimiterIndex === -1) {
        blobSearchInput.value = '';
    } else {
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
    } else if (containerView.style.display !== 'none') {
        const loadedContainers = containerList.querySelectorAll('.list-item:not(.empty)').length;
        containerCountLabel.textContent = loadedContainers.toString();
    }
}

async function showBlobProperties(blobName: string) {
    if (!currentContainer) return;

    lastActiveElement = document.activeElement as HTMLElement;
    modalTitle.textContent = 'Blob Properties';
    modal.classList.remove('large');
    modalContent.innerHTML = '<div class="text-secondary">Fetching properties...</div>';

    modalOkBtn.style.display = 'inline-block';
    modalCancelBtn.style.display = 'none';
    modalConfirmDeleteBtn.style.display = 'none';

    modalOverlay.style.display = 'flex';
    modalContent.focus();

    const result = await api.getBlobProperties(currentContainer, blobName);

    if (result.success) {
        const props = result.properties;
        let metadataHtml = '';
        if (props.metadata && Object.keys(props.metadata).length > 0) {
            const rows = Object.entries(props.metadata).map(([key, value]) => `<tr><td>${key}</td><td>${value}</td></tr>`).join('');
            metadataHtml = `<div class="metadata-section"><span class="property-label">Metadata</span><table class="metadata-table"><tbody>${rows}</tbody></table></div>`;
        }

        modalContent.innerHTML = `
            <div class="property-grid">
                <div class="property-item"><span class="property-label">Name</span><span class="property-value">${props.name}</span></div>
                <div class="property-item"><span class="property-label">Content Type</span><span class="property-value">${props.contentType}</span></div>
                <div class="property-item"><span class="property-label">Size</span><span class="property-value">${formatBytes(props.contentLength)}</span></div>
                <div class="property-item"><span class="property-label">Created On</span><span class="property-value">${formatDateTime(props.createdOn)}</span></div>
                <div class="property-item"><span class="property-label">Last Modified</span><span class="property-value">${formatDateTime(props.lastModified)}</span></div>
                ${metadataHtml}
            </div>
        `;
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

    modalContent.innerHTML = `<p>Are you sure you want to delete ${blobNames.length > 1 ? 'these blobs' : 'this blob'}?</p>`;

    modalOkBtn.style.display = 'none';
    modalCancelBtn.style.display = 'inline-block';
    modalConfirmDeleteBtn.style.display = 'inline-block';
    modalConfirmDeleteBtn.textContent = 'Delete';
    modalConfirmDeleteBtn.disabled = false;

    modalOverlay.style.display = 'flex';

    modalConfirmDeleteBtn.onclick = async () => {
        modalConfirmDeleteBtn.disabled = true;
        const result = blobNames.length === 1 ? await api.deleteBlob(currentContainer!, blobNames[0]) : await api.deleteBlobs(currentContainer!, blobNames);
        if (result.success) {
            closeModal();
            clearSelection();
            updateBlobList();
        } else {
            alert('Delete failed: ' + result.error);
            modalConfirmDeleteBtn.disabled = false;
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
    modalContent.innerHTML = '<div>Loading image...</div>';

    modalOkBtn.style.display = 'inline-block';
    modalCancelBtn.style.display = 'none';
    modalConfirmDeleteBtn.style.display = 'none';

    modalOverlay.style.display = 'flex';

    const result = await api.getBlobData(currentContainer, blobName);

    if (result.success) {
        const blob = new Blob([result.data], { type: contentType });
        const url = URL.createObjectURL(blob);
        modalContent.innerHTML = `<img src="${url}" style="max-width: 100%; display: block;" />`;
        modalContent.focus();
    } else {
        modalContent.innerHTML = `<div class="text-danger">Error loading image: ${result.error}</div>`;
        modalContent.focus();
    }
}

function closeModal() {
    modalOverlay.style.display = 'none';
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
    }

    const pageSize = parseInt(pageSizeSelect.value) || 100;
    const prefix = blobSearchInput.value.trim() || undefined;
    const delimiter = blobDelimiterInput.value.trim() || undefined;

    const result = await api.listBlobs(currentContainer, pageSize, currentContinuationToken, prefix, delimiter);

    if (result.success) {
        if (!isLoadMore) blobList.innerHTML = '';
        if (result.blobs.length === 0 && !isLoadMore) {
            blobList.innerHTML = '<li class="list-item empty">No blobs found in this container.</li>';
        }
        result.blobs.forEach((blob: any) => {
            const li = document.createElement('li');
            li.className = 'list-item';
            li.tabIndex = -1; // Roving tabindex
            li.setAttribute('data-blob-name', blob.name);
            li.setAttribute('data-blob-type', blob.type === 'directory' ? 'directory' : 'file');
            li.innerHTML = `<span>${blob.type === 'directory' ? '📁' : '📄'} ${blob.name}</span>`;
            li.onclick = () => {
                if (blob.type === 'directory') {
                    blobSearchInput.value = blob.name;
                    updateBlobList();
                } else {
                    toggleBlobSelection(blob.name, li);
                }
            };
            li.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    if (blob.type === 'directory') {
                        blobSearchInput.value = blob.name;
                        updateBlobList();
                    } else {
                        showBlobProperties(blob.name);
                    }
                } else if (e.key === ' ') {
                    e.preventDefault();
                    if (blob.type !== 'directory') {
                        toggleBlobSelection(blob.name, li);
                    }
                } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    const next = li.nextElementSibling as HTMLElement;
                    if (next) {
                        li.tabIndex = -1;
                        next.tabIndex = 0;
                        next.focus();
                    }
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    const prev = li.previousElementSibling as HTMLElement;
                    if (prev) {
                        li.tabIndex = -1;
                        prev.tabIndex = 0;
                        prev.focus();
                    }
                }
            };
            blobList.appendChild(li);
        });

        // Ensure first blob is the tab entry point
        const firstBlob = blobList.querySelector('.list-item:not(.empty)') as HTMLElement;
        if (firstBlob) firstBlob.tabIndex = 0;
        currentContinuationToken = result.continuationToken;
    }
}

async function openSettings() {
    lastActiveElement = document.activeElement as HTMLElement;
    modalTitle.textContent = 'Settings';
    modal.classList.remove('large');

    // Switch buttons
    modalOkBtn.style.display = 'inline-block';
    modalOkBtn.textContent = 'Done';
    modalCancelBtn.style.display = 'none';
    modalConfirmDeleteBtn.style.display = 'none';

    const version = await api.getVersion();

    modalContent.innerHTML = `
        <div class="settings-container">
            <div class="settings-section">
                <div class="settings-section-title">General</div>
                <div class="settings-row">
                    <div class="settings-info">
                        <div class="settings-label">Time Display</div>
                        <div class="settings-description">Show dates in Local or UTC time globally.</div>
                    </div>
                    <div class="toggle-group">
                        <button id="modal-local-time-btn" class="btn btn-secondary btn-sm ${!useUTC ? 'active' : ''}">Local Time</button>
                        <button id="modal-utc-time-btn" class="btn btn-secondary btn-sm ${useUTC ? 'active' : ''}">UTC</button>
                    </div>
                </div>
            </div>

            <div class="settings-section">
                <div class="settings-section-title">Keyboard Shortcuts</div>
                <div class="settings-row">
                    <div class="settings-info">
                        <div class="settings-label">Shortcuts Manual</div>
                        <div class="settings-description">View all available key bindings.</div>
                    </div>
                    <button id="btn-open-manual" class="btn btn-secondary btn-sm">Open Manual</button>
                </div>
            </div>

            <div class="settings-section">
                <div class="settings-section-title">About</div>
                <div class="about-card">
                    <div class="about-logo">📦</div>
                    <div class="settings-label">KoBurobu</div>
                    <div class="about-version">v${version}</div>
                    <div class="settings-description">Premium Azure Blob Storage Explorer</div>
                    <div style="margin-top: 0.5rem;">
                        <span id="btn-check-updates" class="btn-link-alt">Check for Updates</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    modalOverlay.style.display = 'flex';

    const modalLocalBtn = document.getElementById('modal-local-time-btn') as HTMLButtonElement;
    const modalUtcBtn = document.getElementById('modal-utc-time-btn') as HTMLButtonElement;
    const btnOpenManual = document.getElementById('btn-open-manual') as HTMLButtonElement;
    const btnCheckUpdates = document.getElementById('btn-check-updates') as HTMLElement;

    modalLocalBtn.onclick = () => {
        useUTC = false;
        modalLocalBtn.classList.add('active');
        modalUtcBtn.classList.remove('active');
        headerTimeToggle.checked = false;
        updateBlobList();
        updateContainerList();
    };

    modalUtcBtn.onclick = () => {
        useUTC = true;
        modalUtcBtn.classList.add('active');
        modalLocalBtn.classList.remove('active');
        headerTimeToggle.checked = true;
        updateBlobList();
        updateContainerList();
    };

    btnOpenManual.onclick = () => {
        api.openPath('manual.md');
    };

    btnCheckUpdates.onclick = () => {
        api.openExternal('https://github.com/njord/KoBurobu');
    };

    modalContent.focus();
}

// Event Listeners
sidebarHamburger.addEventListener('click', (e) => {
    e.stopPropagation();
    hamburgerMenu.style.display = hamburgerMenu.style.display === 'block' ? 'none' : 'block';
});

document.addEventListener('click', () => hamburgerMenu.style.display = 'none');
menuSettings.addEventListener('click', openSettings);
menuAbout.addEventListener('click', openSettings);
menuQuit.addEventListener('click', () => {
    api.quit();
});

menuAccount.addEventListener('click', () => {
    connectSection.style.display = 'block';
    explorerSection.style.display = 'none';
    explorerNav.style.display = 'none';
    connectionStringInput.focus();
});

navConnectBtn.addEventListener('click', () => {
    connectSection.style.display = 'block';
    explorerSection.style.display = 'none';
    explorerNav.style.display = 'none';
    connectionStringInput.focus();
});

connectionStringInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        connectBtn.click();
    }
});

headerTimeToggle.addEventListener('change', () => {
    useUTC = headerTimeToggle.checked;
    updateBlobList();
    updateContainerList();
});

connectBtn.addEventListener('click', async () => {
    const connStr = connectionStringInput.value.trim();
    if (!connStr) return;
    const result = await api.connect(connStr);
    if (result.success) {
        connectSection.style.display = 'none';
        explorerSection.style.display = 'block';
        explorerNav.style.display = 'flex';
        containerView.style.display = 'none'; // Hide container grid
        blobView.style.display = 'block';    // Show empty blob view
        navConnectBtn.tabIndex = -1;         // Skip in tab order when connected
        accountNameLabel.textContent = result.accountName;
        sidebarAccountNameLabel.textContent = result.accountName;
        updateContainerList();
    }
});

disconnectBtn.addEventListener('click', async () => {
    await api.disconnect();
    connectSection.style.display = 'block';
    explorerSection.style.display = 'none';
    explorerNav.style.display = 'none';
    navConnectBtn.tabIndex = 0;          // Restore tab order
    sidebarAccountNameLabel.textContent = 'Not Connected';
    connectionStringInput.value = '';
    connectionStringInput.focus();
});

window.addEventListener('keydown', (e) => {
    const isMenuOpen = hamburgerMenu.style.display === 'block';

    if (e.key === 'Escape') {
        if (modalOverlay.style.display === 'flex') {
            closeModal();
            return;
        }
        if (isMenuOpen) {
            hamburgerMenu.style.display = 'none';
            sidebarHamburger.focus();
            return;
        }
    }

    if (isMenuOpen) {
        const menuItems = Array.from(hamburgerMenu.querySelectorAll('.dropdown-item')) as HTMLElement[];
        const currentIndex = menuItems.indexOf(document.activeElement as HTMLElement);

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const nextIndex = (currentIndex + 1) % menuItems.length;
            menuItems[nextIndex].focus();
            return;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            const prevIndex = (currentIndex - 1 + menuItems.length) % menuItems.length;
            menuItems[prevIndex].focus();
            return;
        }
        if (e.key === 'Enter' || e.key === ' ') {
            // Let the button click handle it
            return;
        }
    }

    if (e.altKey && e.code === 'Space') {
        e.preventDefault();
        const willOpen = hamburgerMenu.style.display !== 'block';
        hamburgerMenu.style.display = willOpen ? 'block' : 'none';
        if (willOpen) {
            const firstItem = hamburgerMenu.querySelector('.dropdown-item') as HTMLElement;
            if (firstItem) firstItem.focus();
        } else {
            sidebarHamburger.focus();
        }
    }

    if (e.key.toLowerCase() === 'r' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        if (blobView.style.display === 'block') {
            updateBlobList();
        } else {
            updateContainerList();
        }
    }

    // Focus sidebar treeview (Cmd+E)
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        const activeTreeItem = sidebarTreeview.querySelector('.tree-item.active') as HTMLElement;
        const firstTreeItem = sidebarTreeview.querySelector('.tree-item') as HTMLElement;
        if (activeTreeItem) {
            activeTreeItem.focus();
        } else if (firstTreeItem) {
            firstTreeItem.focus();
        }
    }

    if ((e.metaKey || e.ctrlKey) && (e.key === ',' || e.code === 'Comma')) {
        e.preventDefault();
        openSettings();
    }
});

window.addEventListener('load', async () => {
    connectionStringInput.focus();
    const version = await api.getVersion();
    if (footerVersion) {
        footerVersion.textContent = `v${version}`;
    }
});
