// DOM Elements
const connectSection = document.getElementById('connect-section') as HTMLElement;
const explorerSection = document.getElementById('explorer-section') as HTMLElement;
const containerView = document.getElementById('container-view') as HTMLElement;
const blobView = document.getElementById('blob-view') as HTMLElement;
const tabBar = document.getElementById('tab-bar') as HTMLElement;

const connectionStringInput = document.getElementById('connection-string') as HTMLInputElement;
const connectBtn = document.getElementById('connect-btn') as HTMLButtonElement;
const disconnectBtn = document.getElementById('disconnect-btn') as HTMLButtonElement;
const refreshBlobsBtn = document.getElementById('refresh-blobs-btn') as HTMLButtonElement;
const pageSizeSelect = document.getElementById('page-size-select') as HTMLSelectElement;
const blobSearchInput = document.getElementById('blob-search-input') as HTMLInputElement;
const blobDelimiterInput = document.getElementById('blob-delimiter-input') as HTMLInputElement;
const searchBlobsBtn = document.getElementById('search-blobs-btn') as HTMLButtonElement;
const sidebarHamburger = document.getElementById('sidebar-hamburger') as HTMLButtonElement;
const hamburgerMenu = document.getElementById('hamburger-menu') as HTMLElement;
const menuSettings = document.getElementById('menu-settings') as HTMLButtonElement;
const menuAbout = document.getElementById('menu-about') as HTMLButtonElement;
const menuAccount = document.getElementById('menu-account') as HTMLButtonElement;
const menuQuit = document.getElementById('menu-quit') as HTMLButtonElement;
const menuManual = document.getElementById('menu-manual') as HTMLButtonElement;
const uploadBlobBtn = document.getElementById('upload-blob-btn') as HTMLButtonElement;

const headerTimeToggle = document.getElementById('header-time-toggle') as HTMLInputElement;

const explorerNav = document.getElementById('explorer-nav') as HTMLElement;
const sidebarTreeview = document.getElementById('sidebar-treeview') as HTMLUListElement;
const navConnectBtn = document.querySelector('.nav-item[data-section="connect-section"]') as HTMLButtonElement;

const blobList = document.getElementById('blob-list') as HTMLUListElement;
const containerCountLabel = document.getElementById('container-count') as HTMLElement;
const accountNameLabel = document.getElementById('account-name') as HTMLElement | null;
const sidebarAccountNameLabel = document.getElementById('sidebar-account-name') as HTMLElement;
const currentContainerNameLabel = document.getElementById('current-container-name') as HTMLElement;
const connectionStatus = document.getElementById('connection-status') as HTMLElement;
const statusText = document.getElementById('status-text') as HTMLElement;
const itemStatsCard = document.getElementById('item-stats-card') as HTMLElement | null;
const itemCountLabel = document.getElementById('item-count') as HTMLElement | null;
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
let tabs: any[] = [];
let activeTabId: string = 'containers-home';

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
    sidebarTreeview.innerHTML = '<li class="tree-item disabled">Loading...</li>';

    const result = await api.listContainers();
    if (result.success) {
        containerCountLabel.textContent = result.containers.length.toString();
        sidebarTreeview.innerHTML = '';
        if (result.containers.length === 0) {
            sidebarTreeview.innerHTML = '<li class="tree-item disabled" tabIndex="0">No containers</li>';
        } else {
            result.containers.forEach((container: any) => {
                // Sidebar tree item
                const treeLi = document.createElement('li');
                treeLi.className = 'tree-item';
                treeLi.tabIndex = -1; // Roving tabindex
                treeLi.setAttribute('data-container-name', container.name);
                treeLi.innerHTML = `
                    <span class="tree-item-icon">📁</span>
                    <span class="tree-item-text">${container.name}</span>
                    <span class="count-trigger-sidebar" title="Count items (Cmd+I)">#</span>
                `;
                treeLi.onclick = (e) => {
                    if ((e.target as HTMLElement).classList.contains('count-trigger-sidebar')) {
                        e.stopPropagation();
                        performRecursiveCount('', e.target as HTMLElement, container.name);
                        return;
                    }
                    openContainer(container.name);
                };
                treeLi.onkeydown = (e) => {
                    const items = Array.from(sidebarTreeview.querySelectorAll('.tree-item')) as HTMLElement[];
                    const index = items.indexOf(treeLi);

                    if (e.key === 'Enter') {
                        openContainer(container.name);
                    } else if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        const next = items[index + 1];
                        if (next) {
                            treeLi.tabIndex = -1;
                            next.tabIndex = 0;
                            next.focus();
                        }
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        const prev = items[index - 1];
                        if (prev) {
                            treeLi.tabIndex = -1;
                            prev.tabIndex = 0;
                            prev.focus();
                        }
                    } else if (e.key === 'Home') {
                        e.preventDefault();
                        const first = items[0];
                        if (first) {
                            treeLi.tabIndex = -1;
                            first.tabIndex = 0;
                            first.focus();
                        }
                    } else if (e.key === 'End') {
                        e.preventDefault();
                        const last = items[items.length - 1];
                        if (last) {
                            treeLi.tabIndex = -1;
                            last.tabIndex = 0;
                            last.focus();
                        }
                    } else if (e.key === 'Tab' && !e.shiftKey && activeTabId === container.name) {
                        const firstBlob = blobList.querySelector('.list-item:not(.empty)') as HTMLElement;
                        if (firstBlob) {
                            e.preventDefault();
                            firstBlob.focus();
                        }
                    } else if (e.key.toLowerCase() === 'i' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        const trigger = treeLi.querySelector('.count-trigger-sidebar') as HTMLElement;
                        if (trigger) performRecursiveCount('', trigger, container.name);
                    }
                };
                sidebarTreeview.appendChild(treeLi);
            });
            // Focus first container immediately after connection
            const firstTreeItem = sidebarTreeview.querySelector('.tree-item') as HTMLElement;
            if (firstTreeItem) {
                firstTreeItem.tabIndex = 0;
                if (document.activeElement === document.body || document.activeElement?.closest('#connect-section')) {
                    firstTreeItem.focus();
                }
            }
        }
    } else {
        sidebarTreeview.innerHTML = `<li class="tree-item disabled text-danger" tabIndex="0">Error: ${result.error}</li>`;
    }
}

async function openContainer(name: string) {
    const existingTab = tabs.find(t => t.id === name);

    if (existingTab) {
        switchTab(name);
    } else {
        const newTab = {
            id: name,
            name: name,
            prefix: '',
            delimiter: '/',
            pageSize: '100',
            searchTerm: ''
        };
        tabs.push(newTab);
        renderTabs();
        switchTab(name);
    }
}

function renderTabs() {
    const renderedTabs = tabs.map(tab => `
        <button class="tab-item ${activeTabId === tab.id ? 'active' : ''}" data-tab-id="${tab.id}">
            <span>📁 ${tab.name}</span>
            <div class="tab-close" data-tab-id="${tab.id}">&times;</div>
        </button>
    `).join('');

    tabBar.innerHTML = renderedTabs;
    tabBar.style.display = tabs.length > 0 ? 'flex' : 'none';

    // Add event listeners
    tabBar.querySelectorAll('.tab-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            if (target.classList.contains('tab-close')) {
                e.stopPropagation();
                closeTab(target.getAttribute('data-tab-id')!);
                return;
            }
            switchTab((btn as HTMLElement).getAttribute('data-tab-id')!);
        });
    });
}

function switchTab(id: string) {
    // Save current state if switching from a container tab
    if (activeTabId && activeTabId !== 'containers-home') {
        const currentTab = tabs.find(t => t.id === activeTabId);
        if (currentTab) {
            currentTab.prefix = blobSearchInput.value;
            currentTab.delimiter = blobDelimiterInput.value;
            currentTab.pageSize = pageSizeSelect.value;
        }
    }

    activeTabId = id;
    renderTabs();

    if (id === 'containers-home') {
        currentContainer = null;
        containerView.style.display = 'block';
        blobView.style.display = 'none';
        updateContainerList();
    } else {
        const tab = tabs.find(t => t.id === id);
        if (tab) {
            currentContainer = tab.id;
            blobSearchInput.value = tab.prefix;
            blobDelimiterInput.value = tab.delimiter;
            pageSizeSelect.value = tab.pageSize;

            containerView.style.display = 'none';
            blobView.style.display = 'block';

            clearSelection();
            updateBreadcrumbs();
            updateBlobList(false, true);
        } else if (tabs.length === 0) {
            // Revert to containers view if no tabs left
            activeTabId = 'containers-home';
            currentContainer = null;
            containerView.style.display = 'block';
            blobView.style.display = 'none';
            updateContainerList();
        }
    }

    // Sync treeview selection and manage roving tabindex
    let hasTabFocus = false;
    const treeItems = sidebarTreeview.querySelectorAll('.tree-item');
    treeItems.forEach((item: any) => {
        item.classList.remove('active');
        item.tabIndex = -1;
        if (item.getAttribute('data-container-name') === currentContainer) {
            item.classList.add('active');
            item.tabIndex = 0;
            hasTabFocus = true;
        }
    });

    // If no active container, make the first item the tab entry point
    if (!hasTabFocus && treeItems.length > 0) {
        (treeItems[0] as HTMLElement).tabIndex = 0;
    }
}

function closeTab(id: string) {
    const index = tabs.findIndex(t => t.id === id);
    if (index === -1) return;

    tabs.splice(index, 1);

    if (activeTabId === id) {
        // Switch to containers home or previous tab
        if (tabs.length > 0) {
            switchTab(tabs[Math.max(0, index - 1)].id);
        } else {
            switchTab('containers-home');
        }
    } else {
        renderTabs();
    }
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
        closeTab(activeTabId);
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
        if (itemCountLabel) {
            const totalIndicator = itemCountLabel.textContent?.includes('+') ? '+' : '';
            itemCountLabel.textContent = loadedItems.toString() + totalIndicator;
        }
        // Update blob list stats in header too
        if (blobListStats) {
            blobListStats.textContent = `(${loadedItems} items loaded)`;
        }
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

async function updateBlobList(isLoadMore = false, focusFirst = false) {
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
            li.innerHTML = `
                <div class="blob-item-main">
                    <span>${blob.type === 'directory' ? '📁' : '📄'}</span>
                    <span class="blob-name">${blob.name}</span>
                </div>
                <div class="blob-meta">
                    ${blob.type === 'directory' ? '' : `
                        <span class="blob-size">${formatBytes(blob.size)}</span>
                        <span class="blob-date">${formatDateTime(blob.lastModified)}</span>
                    `}
                </div>
            `;
            li.onclick = (e) => {
                if (blob.type === 'directory') {
                    blobSearchInput.value = blob.name;
                    updateBlobList();
                } else {
                    if (e.altKey) {
                        showBlobProperties(blob.name);
                    } else {
                        toggleBlobSelection(blob.name, li);
                    }
                }
            };
            li.ondblclick = () => {
                if (blob.type !== 'directory') {
                    showBlobProperties(blob.name);
                }
            };
            li.oncontextmenu = (e) => {
                if (blob.type !== 'directory') {
                    e.preventDefault();
                    if (isImage(blob.name, blob.type)) {
                        showBlobImage(blob.name, blob.type);
                    } else {
                        showBlobProperties(blob.name);
                    }
                }
            };
            li.onkeydown = (e) => {
                const items = Array.from(blobList.querySelectorAll('.list-item:not(.empty)')) as HTMLElement[];
                const index = items.indexOf(li);

                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    if (blob.type === 'directory') {
                        blobSearchInput.value = blob.name;
                        updateBlobList(false, true); // Keep focus when entering folder
                    } else {
                        if (e.altKey) {
                            showBlobProperties(blob.name);
                        } else if (isImage(blob.name, blob.type)) {
                            showBlobImage(blob.name, blob.type);
                        } else {
                            showBlobProperties(blob.name);
                        }
                    }
                } else if (e.key === ' ') {
                    e.preventDefault();
                    if (blob.type !== 'directory') {
                        toggleBlobSelection(blob.name, li);
                    }
                } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    const next = items[index + 1];
                    if (next) {
                        li.tabIndex = -1;
                        next.tabIndex = 0;
                        next.focus();
                    }
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    const prev = items[index - 1];
                    if (prev) {
                        li.tabIndex = -1;
                        prev.tabIndex = 0;
                        prev.focus();
                    }
                } else if (e.key === 'Home') {
                    e.preventDefault();
                    const first = items[0];
                    if (first) {
                        li.tabIndex = -1;
                        first.tabIndex = 0;
                        first.focus();
                    }
                } else if (e.key === 'End') {
                    e.preventDefault();
                    const last = items[items.length - 1];
                    if (last) {
                        li.tabIndex = -1;
                        last.tabIndex = 0;
                        last.focus();
                    }
                } else if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    const activeTreeItem = sidebarTreeview.querySelector('.tree-item.active') as HTMLElement;
                    if (activeTreeItem) {
                        activeTreeItem.focus();
                    }
                }
            };
            blobList.appendChild(li);
        });

        if (result.hasMore) {
            const loadMoreLi = document.createElement('li');
            loadMoreLi.className = 'list-item load-more-item';
            loadMoreLi.tabIndex = -1;
            loadMoreLi.innerHTML = `<span class="text-accent" style="width: 100%; text-align: center;">More items available (Enter/Click to load)</span>`;
            loadMoreLi.onclick = () => updateBlobList(true);
            loadMoreLi.onkeydown = (e) => {
                const items = Array.from(blobList.querySelectorAll('.list-item:not(.empty)')) as HTMLElement[];
                const index = items.indexOf(loadMoreLi);

                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    updateBlobList(true);
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    const prev = items[index - 1];
                    if (prev) {
                        loadMoreLi.tabIndex = -1;
                        prev.tabIndex = 0;
                        prev.focus();
                    }
                } else if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    const activeTreeItem = sidebarTreeview.querySelector('.tree-item.active') as HTMLElement;
                    if (activeTreeItem) {
                        activeTreeItem.focus();
                    }
                }
            };
            blobList.appendChild(loadMoreLi);
        }

        // Ensure first blob is the tab entry point
        const firstBlob = blobList.querySelector('.list-item:not(.empty)') as HTMLElement;
        if (firstBlob) {
            // ... wait, if we are loading more, we might want to keep the focus where it was.
            // But for now, ensuring the roving index is consistent.
            if (!isLoadMore) {
                firstBlob.tabIndex = 0;
                if (focusFirst) {
                    firstBlob.focus();
                }
            }
        }
        currentContinuationToken = result.continuationToken;
        countLoadedItems();
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

async function openManual() {
    lastActiveElement = document.activeElement as HTMLElement;
    modalTitle.textContent = 'User Manual';
    modal.classList.add('large');

    modalOkBtn.style.display = 'inline-block';
    modalOkBtn.textContent = 'Close';
    modalCancelBtn.style.display = 'none';
    modalConfirmDeleteBtn.style.display = 'none';

    modalContent.innerHTML = '<div class="text-secondary">Loading manual...</div>';
    modalOverlay.style.display = 'flex';

    const result = await api.readManual();
    if (result.success) {
        modalContent.innerHTML = `<div class="manual-container">${result.content}</div>`;
    } else {
        modalContent.innerHTML = `<div class="text-danger">Error loading manual: ${result.error}</div>`;
    }
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
menuManual.addEventListener('click', openManual);
menuQuit.addEventListener('click', () => {
    api.quit();
});

refreshBlobsBtn.addEventListener('click', () => updateBlobList());
pageSizeSelect.addEventListener('change', () => updateBlobList());
searchBlobsBtn.addEventListener('click', () => updateBlobList());
blobSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        updateBlobList();
    }
});

uploadBlobBtn.addEventListener('click', async () => {
    if (!currentContainer) return;
    const result = await api.uploadBlob(currentContainer);
    if (result.success) {
        updateBlobList();
    } else if (result.error !== 'Canceled') {
        alert('Upload failed: ' + result.error);
    }
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

        tabs = [];
        switchTab('containers-home');

        navConnectBtn.tabIndex = -1;
        if (accountNameLabel) accountNameLabel.textContent = result.accountName;
        sidebarAccountNameLabel.textContent = result.accountName;
    }
});

disconnectBtn.addEventListener('click', async () => {
    await api.disconnect();
    connectSection.style.display = 'block';
    explorerSection.style.display = 'none';
    explorerNav.style.display = 'none';
    navConnectBtn.tabIndex = 0;
    sidebarAccountNameLabel.textContent = 'Not Connected';
    connectionStringInput.value = '';
    tabs = [];
    activeTabId = 'containers-home';
    connectionStringInput.focus();
});

window.addEventListener('keydown', (e) => {
    const isMenuOpen = hamburgerMenu.style.display === 'block';

    if (e.key === 'Backspace' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        if (blobView.style.display === 'block') {
            e.preventDefault();
            navigateUp();
            return;
        }
    }

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

    if (e.key === 'Enter') {
        if (modalOverlay.style.display === 'flex' && modalOkBtn.style.display !== 'none' && !modalConfirmDeleteBtn.disabled) {
            // Only auto-close with Enter if specifically allowed or focusing something else
            if (document.activeElement === modalOkBtn || document.activeElement === modalContent || document.activeElement?.tagName !== 'BUTTON') {
                closeModal();
                return;
            }
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

    if (e.key === 'F1' || ((e.metaKey || e.ctrlKey) && (e.key === '?' || e.code === 'Slash' && e.shiftKey))) {
        e.preventDefault();
        openManual();
    }

    // Tab shortcuts
    if (e.metaKey || e.ctrlKey) {
        if (e.key >= '1' && e.key <= '9') {
            e.preventDefault();
            if (e.key === '9') {
                // Switch to last tab
                if (tabs.length > 0) {
                    switchTab(tabs[tabs.length - 1].id);
                } else {
                    switchTab('containers-home');
                }
            } else {
                const index = parseInt(e.key) - 1;
                if (index < tabs.length) {
                    switchTab(tabs[index].id);
                }
            }
        } else if (e.key.toLowerCase() === 'w' && activeTabId !== 'containers-home') {
            e.preventDefault();
            closeTab(activeTabId);
        }
    }
});

window.addEventListener('load', async () => {
    connectionStringInput.focus();
    const version = await api.getVersion();
    if (footerVersion) {
        footerVersion.textContent = `v${version}`;
    }
});
