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
const menuConnections = document.getElementById('menu-connections') as HTMLButtonElement;
const menuSearchHistory = document.getElementById('menu-search-history') as HTMLButtonElement;
const uploadBlobBtn = document.getElementById('upload-blob-btn') as HTMLButtonElement;
const deleteBlobsBtn = document.getElementById('delete-blobs-btn') as HTMLButtonElement;
const connectCancelBtn = document.getElementById('connect-cancel-btn') as HTMLButtonElement;
const saveConnectionCheck = document.getElementById('save-connection-check') as HTMLInputElement;
const connectionNameInput = document.getElementById('connection-name') as HTMLInputElement;
const connectionsDropdown = document.getElementById('connections-dropdown') as HTMLElement;
const connectionsToggle = document.getElementById('connections-toggle') as HTMLElement;
const connectionsMenu = document.getElementById('connections-menu') as HTMLUListElement;
const savedConnectionsArea = document.getElementById('saved-connections-area') as HTMLElement;
const searchHistoryList = document.getElementById('search-history-list') as HTMLDataListElement;

const footerTimeToggle = document.getElementById('footer-time-toggle') as HTMLInputElement;

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
const modalOkBtn = document.getElementById('modal-ok-btn') as HTMLButtonElement;
const modalCancelBtn = document.getElementById('modal-cancel-btn') as HTMLButtonElement;
const modalConfirmDeleteBtn = document.getElementById('modal-confirm-delete-btn') as HTMLButtonElement;
const metadataSidebar = document.getElementById('metadata-sidebar') as HTMLElement;
const metadataContent = document.getElementById('metadata-content') as HTMLElement;
const closeMetadataBtn = document.getElementById('close-metadata-btn') as HTMLButtonElement;

// Electron API (from preload)
const api = (window as any).electronAPI;

// Lucide Icons
function refreshIcons() {
    if ((window as any).lucide) {
        (window as any).lucide.createIcons();
    }
}
refreshIcons();

let currentContainer: string | null = null;
let currentContinuationToken: string | undefined = undefined;
let useUTC = false;
let lastActiveElement: HTMLElement | null = null;
let selectedBlobs: Set<string> = new Set();
let tabs: any[] = [];
let activeTabId: string = 'containers-home';
let isConnected = false;
let savedConnections: any[] = [];

function isModalOpen(): boolean {
    return modalOverlay.style.display === 'flex';
}

function toggleBlobSelection(blobName: string, element: HTMLElement) {
    if (selectedBlobs.has(blobName)) {
        selectedBlobs.delete(blobName);
        element.classList.remove('selected');
    } else {
        selectedBlobs.add(blobName);
        element.classList.add('selected');
    }
    updateDeleteButtonVisibility();
    updateMetadataSidebar();
}

function updateDeleteButtonVisibility() {
    if (selectedBlobs.size > 0) {
        deleteBlobsBtn.style.display = 'inline-block';
        deleteBlobsBtn.textContent = `Delete (${selectedBlobs.size})`;
    } else {
        deleteBlobsBtn.style.display = 'none';
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
    updateDeleteButtonVisibility();
}

function clearSelection() {
    selectedBlobs.clear();
    const items = blobList.querySelectorAll('.list-item.selected');
    items.forEach(item => item.classList.remove('selected'));
    updateDeleteButtonVisibility();
    updateMetadataSidebar();
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

async function copyToClipboard(text: string, element: HTMLElement) {
    try {
        await navigator.clipboard.writeText(text);
        const originalText = element.innerHTML;
        element.innerHTML = '✓';
        element.classList.add('success');
        setTimeout(() => {
            element.innerHTML = originalText;
            element.classList.remove('success');
        }, 1500);
    } catch (err) {
        console.error('Failed to copy: ', err);
    }
}

// Expose to window for inline onclick handlers
(window as any).copyToClipboard = copyToClipboard;

async function loadSavedConnections() {
    const result = await api.getConnections();
    if (result.success) {
        savedConnections = result.connections;
        renderSavedConnections();

        // Auto-select first connection if available and nothing is currently entered
        if (savedConnections.length > 0 && !connectionStringInput.value.trim()) {
            selectConnection(savedConnections[0]);
        }
    }
}

function getCurrentAccountName(): string {
    return sidebarAccountNameLabel.textContent || 'Unknown';
}

async function loadSearchHistory() {
    if (!currentContainer) return;
    const result = await api.getSearchHistory(getCurrentAccountName(), currentContainer);
    if (result.success) {
        renderSearchHistory(result.history);
    }
}

function renderSearchHistory(history: string[]) {
    if (!searchHistoryList) return;
    searchHistoryList.innerHTML = '';
    history.forEach(term => {
        const option = document.createElement('option');
        option.value = term;
        searchHistoryList.appendChild(option);
    });
}

function renderSavedConnections() {
    if (savedConnections.length === 0) {
        savedConnectionsArea.style.display = 'none';
        return;
    }

    savedConnectionsArea.style.display = 'block';
    connectionsMenu.innerHTML = '';

    // Reset toggle text
    const toggleSpan = connectionsToggle.querySelector('span');
    if (toggleSpan) toggleSpan.textContent = 'Select a saved connection...';

    savedConnections.forEach(conn => {
        const li = document.createElement('li');
        li.className = 'connection-option';
        li.setAttribute('role', 'option');
        li.setAttribute('tabindex', '-1');
        li.setAttribute('data-id', conn.id);

        const info = document.createElement('div');
        info.className = 'option-info';

        const name = document.createElement('div');
        name.className = 'option-name';
        name.textContent = conn.name;

        const account = document.createElement('div');
        account.className = 'option-account';
        const accountMatch = conn.connectionString.match(/AccountName=([^;]+)/);
        account.textContent = accountMatch ? accountMatch[1] : 'Azure Storage';

        info.appendChild(name);
        info.appendChild(account);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-option-btn';
        deleteBtn.innerHTML = '×';
        deleteBtn.title = 'Remove connection';
        deleteBtn.onclick = async (e) => {
            e.stopPropagation();
            if (confirm(`Remove saved connection "${conn.name}"?`)) {
                const res = await api.deleteConnection(conn.id);
                if (res.success) {
                    loadSavedConnections();
                }
            }
        };

        li.appendChild(info);
        li.appendChild(deleteBtn);

        li.onclick = () => selectConnection(conn);

        li.onkeydown = (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                selectConnection(conn);
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                const next = li.nextElementSibling as HTMLElement;
                if (next) next.focus();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                const prev = li.previousElementSibling as HTMLElement;
                if (prev) {
                    prev.focus();
                } else {
                    connectionsToggle.focus();
                }
            } else if (e.key === 'Escape') {
                closeConnectionsDropdown();
                connectionsToggle.focus();
            }
        };

        connectionsMenu.appendChild(li);
    });
}

function selectConnection(conn: any) {
    connectionStringInput.value = conn.connectionString;
    const toggleSpan = connectionsToggle.querySelector('span');
    if (toggleSpan) toggleSpan.textContent = conn.name;

    saveConnectionCheck.checked = false;
    connectionNameInput.style.display = 'none';

    closeConnectionsDropdown();
    connectBtn.focus();
}

function toggleConnectionsDropdown() {
    const isOpen = connectionsDropdown.classList.contains('open');
    if (isOpen) {
        closeConnectionsDropdown();
    } else {
        openConnectionsDropdown();
    }
}

function openConnectionsDropdown() {
    connectionsDropdown.classList.add('open');
    connectionsMenu.style.display = 'block';
    connectionsToggle.setAttribute('aria-expanded', 'true');

    // Focus first option
    const firstOption = connectionsMenu.querySelector('.connection-option') as HTMLElement;
    if (firstOption) firstOption.focus();
}

function closeConnectionsDropdown() {
    connectionsDropdown.classList.remove('open');
    connectionsMenu.style.display = 'none';
    connectionsToggle.setAttribute('aria-expanded', 'false');
}

// Initializing dropdown listeners
connectionsToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleConnectionsDropdown();
});

connectionsToggle.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        openConnectionsDropdown();
    }
});

document.addEventListener('click', (e) => {
    if (!connectionsDropdown.contains(e.target as Node)) {
        closeConnectionsDropdown();
    }
});

async function showConnectSection() {
    connectSection.style.display = 'block';
    explorerSection.style.display = 'none';
    explorerNav.style.display = 'none';

    if (isConnected) {
        connectCancelBtn.style.display = 'inline-block';
    } else {
        connectCancelBtn.style.display = 'none';
    }

    await loadSavedConnections();

    // Only focus input if nothing was auto-selected (selectConnection focuses connectBtn)
    if (document.activeElement !== connectBtn) {
        connectionStringInput.focus();
    }
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
                    if (isModalOpen()) return;
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
            loadSearchHistory();
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

    const prefix = blobSearchInput.value;
    const delimiter = blobDelimiterInput.value || '/';

    const navigateToPath = (targetPath: string) => {
        if (targetPath === prefix) return;

        let focusItem: string | undefined = undefined;
        if (prefix.startsWith(targetPath)) {
            // We are going "up" or "staying"
            const remaining = prefix.slice(targetPath.length);
            const segments = remaining.split(delimiter).filter(s => s.length > 0);
            if (segments.length > 0) {
                focusItem = targetPath + segments[0] + delimiter;
            }
        }

        blobSearchInput.value = targetPath;
        updateBlobList(false, focusItem);
    };

    const rootSpan = document.createElement('span');
    rootSpan.className = 'breadcrumb-item';
    rootSpan.textContent = currentContainer;
    rootSpan.onclick = () => navigateToPath('');
    currentContainerNameLabel.appendChild(rootSpan);

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
            segmentSpan.onclick = () => navigateToPath(capturedPath);

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

    const itemToFocus = prefix;

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
    updateBlobList(false, itemToFocus);
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
    modalConfirmDeleteBtn.style.display = 'inline-block';
    modalConfirmDeleteBtn.textContent = 'Delete';
    modalConfirmDeleteBtn.disabled = false;
    modalConfirmDeleteBtn.onclick = () => deleteBlobsUI([blobName]);

    modalOverlay.style.display = 'flex';
    modalContent.focus();

    const result = await api.getBlobProperties(currentContainer, blobName);

    if (result.success) {
        const props = result.properties;
        const delimiter = blobDelimiterInput.value || '/';
        const renderRow = (label: string, value: string, displayValue?: string) => {
            const escapedValue = value.replace(/'/g, "\\'").replace(/"/g, "&quot;");
            const escapedLabel = label.replace(/'/g, "\\'");
            return `
            <div class="property-item">
                <span class="property-label">${label}</span>
                <span class="property-value">${displayValue || value}</span>
                <div class="copy-actions" style="display: flex; gap: 4px;">
                    <button class="copy-btn" onclick="copyToClipboard('${escapedLabel}', this)" title="Copy Key: ${label}">🔑</button>
                    <button class="copy-btn" onclick="copyToClipboard('${escapedValue}', this)" title="Copy Value: ${value}">📋</button>
                </div>
            </div>`;
        };

        let metadataHtml = '';
        if (props.metadata && Object.keys(props.metadata).length > 0) {
            const rows = Object.entries(props.metadata).map(([key, value]) => {
                const valStr = String(value);
                const escapedKey = key.replace(/'/g, "\\'");
                const escapedValue = valStr.replace(/'/g, "\\'").replace(/"/g, "&quot;");
                return `
                <tr>
                    <td>${key}</td>
                    <td>${valStr}</td>
                    <td style="width: 70px;">
                        <div style="display: flex; gap: 4px;">
                            <button class="copy-btn" onclick="copyToClipboard('${escapedKey}', this)" title="Copy Key: ${key}">🔑</button>
                            <button class="copy-btn" onclick="copyToClipboard('${escapedValue}', this)" title="Copy Value: ${valStr}">📋</button>
                        </div>
                    </td>
                </tr>`;
            }).join('');
            metadataHtml = `<div class="metadata-section"><span class="property-label">Metadata</span><table class="metadata-table"><tbody>${rows}</tbody></table></div>`;
        }

        modalContent.innerHTML = `
            <div class="property-grid">
                ${renderRow('Name', props.name, formatBlobName(props.name, delimiter))}
                ${renderRow('Content Type', props.contentType)}
                ${renderRow('Size', formatBytes(props.contentLength))}
                ${renderRow('Created On', formatDateTime(props.createdOn))}
                ${renderRow('Last Modified', formatDateTime(props.lastModified))}
                ${metadataHtml}
            </div>
        `;
        modalContent.focus();
    } else {
        modalContent.innerHTML = `<div class="text-danger">Error: ${result.error}</div>`;
        modalContent.focus();
    }
}

async function updateMetadataSidebar(blobName?: string) {
    if (!currentContainer) {
        metadataSidebar.classList.add('hidden');
        return;
    }

    const activeBlobName = blobName || (selectedBlobs.size === 1 ? Array.from(selectedBlobs)[0] : null);

    if (!activeBlobName) {
        if (selectedBlobs.size > 1) {
            metadataContent.innerHTML = `
                <div class="empty-state">
                    <div style="font-size: 4rem; opacity: 0.3; margin-bottom: 1.5rem;">📦</div>
                    <p style="font-size: 1.1rem; font-weight: 600; margin-bottom: 1.5rem;">${selectedBlobs.size} items selected</p>
                    <button id="sidebar-delete-multi-btn" class="btn btn-primary btn-sm" style="background-color: #ef4444; border-color: #ef4444; width: 100%;">
                        <i data-lucide="trash-2" style="width: 16px; height: 16px; margin-right: 6px; vertical-align: middle;"></i> Delete items
                    </button>
                </div>
            `;
            metadataSidebar.classList.remove('hidden');
            const sidebarDeleteBtn = document.getElementById('sidebar-delete-multi-btn');
            if (sidebarDeleteBtn) {
                sidebarDeleteBtn.onclick = () => deleteBlobsUI(Array.from(selectedBlobs));
            }
            refreshIcons();
        } else {
            metadataSidebar.classList.add('hidden');
            metadataContent.innerHTML = '';
        }
        return;
    }

    metadataSidebar.classList.remove('hidden');
    // Don't show "Loading..." if we are just moving focus quickly, but for now it's okay
    // metadataContent.innerHTML = '<div class="text-secondary">Loading details...</div>';

    const result = await api.getBlobProperties(currentContainer, activeBlobName);

    if (result.success) {
        const props = result.properties;
        const delimiter = blobDelimiterInput.value || '/';
        const renderRow = (label: string, value: string, displayValue?: string) => {
            const escapedValue = value.replace(/'/g, "\\'").replace(/"/g, "&quot;");
            const escapedLabel = label.replace(/'/g, "\\'");
            return `
            <div class="property-item">
                <span class="property-label">${label}</span>
                <span class="property-value">${displayValue || value}</span>
                <div class="copy-actions" style="display: flex; gap: 4px;">
                    <button class="copy-btn" onclick="copyToClipboard('${escapedLabel}', this)" title="Copy Key: ${label}">🔑</button>
                    <button class="copy-btn" onclick="copyToClipboard('${escapedValue}', this)" title="Copy Value: ${value}">📋</button>
                </div>
            </div>`;
        };

        let metadataHtml = '';
        if (props.metadata && Object.keys(props.metadata).length > 0) {
            const rows = Object.entries(props.metadata).map(([key, value]) => {
                const valStr = String(value);
                const escapedKey = key.replace(/'/g, "\\'");
                const escapedValue = valStr.replace(/'/g, "\\'").replace(/"/g, "&quot;");
                return `
                <tr>
                    <td>${key}</td>
                    <td>${valStr}</td>
                    <td style="width: 70px;">
                        <div style="display: flex; gap: 4px;">
                            <button class="copy-btn" onclick="copyToClipboard('${escapedKey}', this)" title="Copy Key: ${key}">🔑</button>
                            <button class="copy-btn" onclick="copyToClipboard('${escapedValue}', this)" title="Copy Value: ${valStr}">📋</button>
                        </div>
                    </td>
                </tr>`;
            }).join('');
            metadataHtml = `<div class="metadata-section"><span class="property-label">Metadata</span><table class="metadata-table"><tbody>${rows}</tbody></table></div>`;
        }

        metadataContent.innerHTML = `
            <div class="property-grid">
                ${renderRow('Name', props.name, formatBlobName(props.name, delimiter))}
                ${renderRow('Content Type', props.contentType)}
                ${renderRow('Size', formatBytes(props.contentLength))}
                ${renderRow('Created On', formatDateTime(props.createdOn))}
                ${renderRow('Last Modified', formatDateTime(props.lastModified))}
                ${metadataHtml}
            </div>
            <div class="sidebar-actions" style="margin-top: 1.5rem; display: flex; gap: 8px;">
                <button id="sidebar-delete-btn" class="btn btn-secondary btn-sm" style="flex: 1; border-color: #ef4444; color: #ef4444; background: transparent;">
                    <i data-lucide="trash-2" style="width: 14px; height: 14px; margin-right: 4px; vertical-align: middle;"></i> Delete
                </button>
            </div>
        `;
        const sidebarDeleteBtn = document.getElementById('sidebar-delete-btn') as HTMLButtonElement;
        if (sidebarDeleteBtn) {
            sidebarDeleteBtn.onclick = () => deleteBlobsUI([activeBlobName]);
        }
        refreshIcons();
    } else {
        metadataContent.innerHTML = `<div class="text-danger">Error: ${result.error}</div>`;
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

async function deleteBlobsUI(blobNames: string[], isFolderDelete = false) {
    if (!currentContainer || blobNames.length === 0) return;

    lastActiveElement = document.activeElement as HTMLElement;
    modalTitle.textContent = isFolderDelete ? 'Confirm Delete Folder' : (blobNames.length > 1 ? `Confirm Delete (${blobNames.length} items)` : 'Confirm Delete');

    modalContent.innerHTML = `<p>Are you sure you want to delete ${isFolderDelete ? `all blobs with prefix <strong>${blobNames[0]}</strong>` : (blobNames.length > 1 ? 'these blobs' : 'this blob')}?</p>`;
    if (isFolderDelete) {
        modalContent.innerHTML += `<p class="text-danger" style="margin-top: 0.5rem; font-size: 0.85rem;">This action is recursive and cannot be undone.</p>`;
    }

    modalOkBtn.style.display = 'none';
    modalCancelBtn.style.display = 'inline-block';
    modalConfirmDeleteBtn.style.display = 'inline-block';
    modalConfirmDeleteBtn.textContent = 'Delete';
    modalConfirmDeleteBtn.disabled = false;

    modalOverlay.style.display = 'flex';
    modalConfirmDeleteBtn.focus();

    modalConfirmDeleteBtn.onclick = async () => {
        modalConfirmDeleteBtn.disabled = true;
        const result = isFolderDelete
            ? await api.deleteFolder(currentContainer!, blobNames[0])
            : (blobNames.length === 1 ? await api.deleteBlob(currentContainer!, blobNames[0]) : await api.deleteBlobs(currentContainer!, blobNames));

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
    modalOkBtn.focus();

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

function formatBlobName(fullName: string, delimiter: string) {
    if (!delimiter) return `<span class="blob-name-last">${fullName}</span>`;

    let checkPath = fullName;
    const endsWithDelimiter = fullName.endsWith(delimiter);
    if (endsWithDelimiter) {
        checkPath = fullName.slice(0, -delimiter.length);
    }

    const lastIdx = checkPath.lastIndexOf(delimiter);
    if (lastIdx === -1) {
        return `<span class="blob-name-last">${fullName}</span>`;
    }

    const parent = fullName.substring(0, lastIdx + delimiter.length);
    const last = fullName.substring(lastIdx + delimiter.length);

    return `<span class="blob-name-parent">${parent}</span><span class="blob-name-last">${last}</span>`;
}

async function updateBlobList(isLoadMore = false, focusItem?: string | boolean) {
    let itemsBefore = 0;
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
        if (!isLoadMore) {
            blobList.innerHTML = '';
        } else {
            itemsBefore = blobList.querySelectorAll('.list-item:not(.empty)').length;
            const existingLoadMore = blobList.querySelector('.load-more-item');
            if (existingLoadMore) {
                if (document.activeElement === existingLoadMore) {
                    focusItem = true;
                }
                existingLoadMore.remove();
                itemsBefore--;
            }
        }

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
                    <span class="blob-name">${formatBlobName(blob.name, delimiter || '/')}</span>
                </div>
                <div class="blob-meta">
                    ${blob.type === 'directory' ? '' : `
                        <span class="blob-size">${formatBytes(blob.size)}</span>
                        <span class="blob-date">${formatDateTime(blob.lastModified)}</span>
                    `}
                    <span class="delete-trigger tooltip-bottom" 
                        data-tooltip="Delete (Del / Alt+Backspace)" 
                        title="Delete (Del / Alt+Backspace)">
                        <i data-lucide="trash-2"></i>
                    </span>
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
                if (isModalOpen()) return;
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
                        const nextBlobName = next.getAttribute('data-blob-name');
                        const nextBlobType = next.getAttribute('data-blob-type');
                        if (nextBlobName && nextBlobType !== 'directory') {
                            updateMetadataSidebar(nextBlobName);
                        } else {
                            updateMetadataSidebar();
                        }
                    }
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    const prev = items[index - 1];
                    if (prev) {
                        li.tabIndex = -1;
                        prev.tabIndex = 0;
                        prev.focus();
                        const prevBlobName = prev.getAttribute('data-blob-name');
                        const prevBlobType = prev.getAttribute('data-blob-type');
                        if (prevBlobName && prevBlobType !== 'directory') {
                            updateMetadataSidebar(prevBlobName);
                        } else {
                            updateMetadataSidebar();
                        }
                    }
                } else if (e.key === 'Home') {
                    e.preventDefault();
                    const first = items[0];
                    if (first) {
                        li.tabIndex = -1;
                        first.tabIndex = 0;
                        first.focus();
                        const firstBlobName = first.getAttribute('data-blob-name');
                        const firstBlobType = first.getAttribute('data-blob-type');
                        if (firstBlobName && firstBlobType !== 'directory') {
                            updateMetadataSidebar(firstBlobName);
                        } else {
                            updateMetadataSidebar();
                        }
                    }
                } else if (e.key === 'End') {
                    e.preventDefault();
                    const last = items[items.length - 1];
                    if (last) {
                        li.tabIndex = -1;
                        last.tabIndex = 0;
                        last.focus();
                        const lastBlobName = last.getAttribute('data-blob-name');
                        const lastBlobType = last.getAttribute('data-blob-type');
                        if (lastBlobName && lastBlobType !== 'directory') {
                            updateMetadataSidebar(lastBlobName);
                        } else {
                            updateMetadataSidebar();
                        }
                    }
                } else if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    const activeTreeItem = sidebarTreeview.querySelector('.tree-item.active') as HTMLElement;
                    if (activeTreeItem) {
                        activeTreeItem.focus();
                    }
                }
            };
            const deleteTrigger = li.querySelector('.delete-trigger') as HTMLElement;
            if (deleteTrigger) {
                deleteTrigger.onclick = (e) => {
                    e.stopPropagation();
                    deleteBlobsUI([blob.name], blob.type === 'directory');
                };
            }
            blobList.appendChild(li);
        });
        refreshIcons();

        if (result.hasMore) {
            const loadMoreLi = document.createElement('li');
            loadMoreLi.className = 'list-item load-more-item';
            loadMoreLi.tabIndex = -1;
            loadMoreLi.innerHTML = `<span class="text-accent" style="width: 100%; text-align: center;">More items available (Enter/Click to load)</span>`;
            loadMoreLi.onclick = () => updateBlobList(true);
            loadMoreLi.onkeydown = (e) => {
                if (isModalOpen()) return;
                const items = Array.from(blobList.querySelectorAll('.list-item:not(.empty)')) as HTMLElement[];
                const index = items.indexOf(loadMoreLi);

                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    updateBlobList(true);
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    const prev = items[index - 1];
                    if (prev) {
                        loadMoreLi.tabIndex = -1;
                        prev.tabIndex = 0;
                        prev.focus();
                    }
                } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                } else if (e.key === 'Home') {
                    e.preventDefault();
                    const first = items[0];
                    if (first) {
                        loadMoreLi.tabIndex = -1;
                        first.tabIndex = 0;
                        first.focus();
                    }
                } else if (e.key === 'End') {
                    e.preventDefault();
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

        // Handle focus restoration or initial focus
        const allItems = Array.from(blobList.querySelectorAll('.list-item:not(.empty)')) as HTMLElement[];
        if (allItems.length > 0) {
            if (!isLoadMore) {
                // Default: set all items to tabIndex -1
                allItems.forEach(i => i.tabIndex = -1);

                let targetItem: HTMLElement | null = null;
                if (typeof focusItem === 'string') {
                    targetItem = allItems.find(i => i.getAttribute('data-blob-name') === focusItem) || null;
                }

                if (!targetItem && (focusItem === true || typeof focusItem === 'string')) {
                    targetItem = allItems[0];
                }

                if (targetItem) {
                    targetItem.tabIndex = 0;
                    if (focusItem) {
                        targetItem.focus();
                        // Ensure it's scrolled into view if it was focused by name
                        if (typeof focusItem === 'string') {
                            targetItem.scrollIntoView({ block: 'nearest' });
                        }

                        // Update sidebar for focused item
                        const blobName = targetItem.getAttribute('data-blob-name');
                        const blobType = targetItem.getAttribute('data-blob-type');
                        if (blobName && blobType !== 'directory') {
                            updateMetadataSidebar(blobName);
                        }
                    }
                } else {
                    allItems[0].tabIndex = 0;
                }
            } else if (focusItem === true) {
                // If we were loading more and wanted to focus, focus the first of the new items
                const targetItem = allItems[itemsBefore];
                if (targetItem) {
                    allItems.forEach(i => i.tabIndex = -1);
                    targetItem.tabIndex = 0;
                    targetItem.focus();
                    targetItem.scrollIntoView({ block: 'nearest' });
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
                    <div class="about-logo"><img src="assets/logo.png" class="about-logo-img" alt="KoBurobu Logo"></div>
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
    modalOkBtn.focus();

    const modalLocalBtn = document.getElementById('modal-local-time-btn') as HTMLButtonElement;
    const modalUtcBtn = document.getElementById('modal-utc-time-btn') as HTMLButtonElement;
    const btnOpenManual = document.getElementById('btn-open-manual') as HTMLButtonElement;
    const btnCheckUpdates = document.getElementById('btn-check-updates') as HTMLElement;

    modalLocalBtn.onclick = () => {
        useUTC = false;
        modalLocalBtn.classList.add('active');
        modalUtcBtn.classList.remove('active');
        footerTimeToggle.checked = false;
        updateBlobList();
        updateContainerList();
    };

    modalUtcBtn.onclick = () => {
        useUTC = true;
        modalUtcBtn.classList.add('active');
        modalLocalBtn.classList.remove('active');
        footerTimeToggle.checked = true;
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
    modalOkBtn.focus();

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
menuConnections.addEventListener('click', () => {
    api.openConnectionsFile();
});
menuSearchHistory.addEventListener('click', () => {
    api.openSearchHistoryFile();
});
menuQuit.addEventListener('click', () => {
    api.quit();
});

refreshBlobsBtn.addEventListener('click', () => updateBlobList());
pageSizeSelect.addEventListener('change', () => updateBlobList());
blobSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const term = blobSearchInput.value.trim();
        if (term && currentContainer) {
            api.saveSearchHistory(getCurrentAccountName(), currentContainer, term).then(() => loadSearchHistory());
        }
        updateBlobList(false, true);
    }
});

searchBlobsBtn.addEventListener('click', () => {
    const term = blobSearchInput.value.trim();
    if (term && currentContainer) {
        api.saveSearchHistory(getCurrentAccountName(), currentContainer, term).then(() => loadSearchHistory());
    }
    updateBlobList(false, true);
});

blobSearchInput.addEventListener('focus', () => {
    loadSearchHistory();
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

deleteBlobsBtn.addEventListener('click', () => deleteBlobsUI(Array.from(selectedBlobs)));

closeMetadataBtn.addEventListener('click', () => {
    metadataSidebar.classList.add('hidden');
    clearSelection();
});

menuAccount.addEventListener('click', showConnectSection);
navConnectBtn.addEventListener('click', showConnectSection);

connectionStringInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        connectBtn.click();
    }
});

connectionNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        connectBtn.click();
    }
});

footerTimeToggle.addEventListener('change', () => {
    useUTC = footerTimeToggle.checked;
    updateBlobList();
    updateContainerList();
});

connectBtn.addEventListener('click', async () => {
    const connStr = connectionStringInput.value.trim();
    if (!connStr) return;

    // Show loading state
    connectBtn.disabled = true;
    connectBtn.textContent = 'Connecting...';

    const result = await api.connect(connStr);

    if (result.success) {
        isConnected = true;

        // Save if requested
        if (saveConnectionCheck.checked) {
            const name = connectionNameInput.value.trim() || result.accountName || 'Unnamed Connection';
            await api.saveConnection(name, connStr);
            saveConnectionCheck.checked = false;
            connectionNameInput.value = '';
            connectionNameInput.style.display = 'none';
            // Refresh list for next time
            await loadSavedConnections();
        }

        connectSection.style.display = 'none';
        explorerSection.style.display = 'block';
        explorerNav.style.display = 'flex';

        tabs = [];
        switchTab('containers-home');

        navConnectBtn.tabIndex = -1;
        if (accountNameLabel) accountNameLabel.textContent = result.accountName;
        sidebarAccountNameLabel.textContent = result.accountName;
    } else {
        alert('Connection failed: ' + result.error);
    }

    connectBtn.disabled = false;
    connectBtn.textContent = 'Connect Account';
});

connectCancelBtn.addEventListener('click', () => {
    if (isConnected) {
        connectSection.style.display = 'none';
        explorerSection.style.display = 'block';
        explorerNav.style.display = 'flex';
    }
});

saveConnectionCheck.addEventListener('change', () => {
    connectionNameInput.style.display = saveConnectionCheck.checked ? 'block' : 'none';
    if (saveConnectionCheck.checked) {
        connectionNameInput.focus();
    }
});

disconnectBtn.addEventListener('click', async () => {
    await api.disconnect();
    isConnected = false;
    showConnectSection();
    sidebarAccountNameLabel.textContent = 'Not Connected';
    connectionStringInput.value = '';
    tabs = [];
    activeTabId = 'containers-home';
});

window.addEventListener('keydown', (e) => {
    const isMenuOpen = hamburgerMenu.style.display === 'block';
    const modalVisible = isModalOpen();

    if (modalVisible) {
        // Focus trapping
        if (e.key === 'Tab') {
            const focusables = Array.from(modal.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])'))
                .filter(el => {
                    const styles = window.getComputedStyle(el);
                    return (el as any).offsetParent !== null && styles.display !== 'none' && styles.visibility !== 'hidden';
                }) as HTMLElement[];

            if (focusables.length > 0) {
                const first = focusables[0];
                const last = focusables[focusables.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            } else {
                e.preventDefault(); // Nowhere to go
            }
        }

        if (e.key === 'Escape') {
            e.preventDefault();
            closeModal();
            return;
        }

        if (e.key === 'Enter') {
            // Dialogues close with Enter if it's an "update" (modalConfirmDeleteBtn) or info-only (modalOkBtn)
            if (modalConfirmDeleteBtn.style.display !== 'none' && !modalConfirmDeleteBtn.disabled) {
                if (document.activeElement === modalConfirmDeleteBtn || document.activeElement === modalContent) {
                    modalConfirmDeleteBtn.click();
                    return;
                }
            } else if (modalOkBtn.style.display !== 'none') {
                // Info-only can be closed with either Esc or Enter
                e.preventDefault();
                closeModal();
                return;
            }
        }

        // SWALLOW ALL OTHER KEY STROKES when modal is open
        // This ensures "When a modal dialogue is visible, it is the only one receiving keyboard strokes."
        const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName);
        // Only allow basic navigation and selection within the modal
        const allowedKeys = ['Tab', 'Enter', 'Escape', 'ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', ' '];
        if (!isInput && !allowedKeys.includes(e.key)) {
            e.preventDefault();
        }

        // Always stop propagation to background listeners when modal is open
        e.stopPropagation();
        return;
    }

    // Select All (Cmd+A)
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
        if (modalVisible) return;
        if (blobView.style.display === 'block' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
            e.preventDefault();
            selectAllBlobs();
            return;
        }
    }

    // Delete/Backspace key detection for Blobs
    const isDeleteKey = e.key === 'Delete' || e.code === 'Delete';
    const isBackspaceKey = e.key === 'Backspace' || e.code === 'Backspace';
    const isAltDelete = e.altKey && isBackspaceKey;

    if ((isDeleteKey || isAltDelete) && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        if (blobView.style.display === 'block') {
            let targetBlobs = Array.from(selectedBlobs);
            let isFolder = false;

            // If nothing is selected in the set, try to use the currently focused item
            if (targetBlobs.length === 0) {
                const focused = document.activeElement as HTMLElement;
                const blobName = focused?.getAttribute('data-blob-name');
                if (blobName) {
                    targetBlobs = [blobName];
                    isFolder = focused.getAttribute('data-blob-type') === 'directory';
                }
            }

            if (targetBlobs.length > 0) {
                e.preventDefault();
                e.stopPropagation();
                deleteBlobsUI(targetBlobs, isFolder);
                return;
            }
        }
    }

    // Navigate Up (Plain Backspace)
    const isPlainBackspace = isBackspaceKey && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey;
    if (isPlainBackspace && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        if (blobView.style.display === 'block') {
            e.preventDefault();
            navigateUp();
            return;
        }
    }

    if (e.key === 'Escape') {
        if (isMenuOpen) {
            hamburgerMenu.style.display = 'none';
            sidebarHamburger.focus();
            return;
        }
        if (connectSection.style.display === 'block' && isConnected) {
            connectCancelBtn.click();
            return;
        }
    }

    if (e.key === 'Enter') {
        // Handled in individual item listeners
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

    if (e.shiftKey && e.code === 'Space') {
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
        if (modalVisible) return;
        if (blobView.style.display === 'block') {
            updateBlobList();
        } else {
            updateContainerList();
        }
    }

    // Focus sidebar treeview (Cmd+E)
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'e') {
        if (modalVisible) return;
        e.preventDefault();
        const activeTreeItem = sidebarTreeview.querySelector('.tree-item.active') as HTMLElement;
        const firstTreeItem = sidebarTreeview.querySelector('.tree-item') as HTMLElement;
        if (activeTreeItem) {
            activeTreeItem.focus();
        } else if (firstTreeItem) {
            firstTreeItem.focus();
        }
    }

    // Focus Search Prefix (Cmd+F)
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        if (modalVisible) return;
        if (blobView.style.display === 'block') {
            e.preventDefault();
            blobSearchInput.focus();
            blobSearchInput.select();
        }
    }

    if ((e.metaKey || e.ctrlKey) && (e.key === ',' || e.code === 'Comma')) {
        if (modalVisible) return;
        e.preventDefault();
        openSettings();
    }

    if (e.key === 'F1' || ((e.metaKey || e.ctrlKey) && (e.key === '?' || e.code === 'Slash' && e.shiftKey))) {
        if (modalVisible) return;
        e.preventDefault();
        openManual();
    }

    // Tab shortcuts
    if ((e.metaKey || e.ctrlKey) && !modalVisible) {
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
    showConnectSection();
    loadSearchHistory();
    refreshIcons();
    const version = await api.getVersion();
    if (footerVersion) {
        footerVersion.textContent = `v${version}`;
    }
});
