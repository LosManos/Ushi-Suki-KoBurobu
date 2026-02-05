// DOM Elements
const connectSection = document.getElementById('connect-section') as HTMLElement;
const explorerSection = document.getElementById('explorer-section') as HTMLElement;
const connectionStringInput = document.getElementById('connection-string') as HTMLInputElement;
const connectBtn = document.getElementById('connect-btn') as HTMLButtonElement;
const disconnectBtn = document.getElementById('disconnect-btn') as HTMLButtonElement;
const refreshBtn = document.getElementById('refresh-btn') as HTMLButtonElement;
const containerList = document.getElementById('container-list') as HTMLUListElement;
const containerCount = document.getElementById('container-count') as HTMLElement;
const accountNameLabel = document.getElementById('account-name') as HTMLElement;
const connectionStatus = document.getElementById('connection-status') as HTMLElement;
const statusText = document.getElementById('status-text') as HTMLElement;

// Electron API (from preload)
const api = (window as any).electronAPI;

async function updateContainerList() {
    containerList.innerHTML = '<li class="list-item empty">Loading containers...</li>';

    const result = await api.listContainers();
    if (result.success) {
        containerCount.textContent = result.containers.length.toString();
        if (result.containers.length === 0) {
            containerList.innerHTML = '<li class="list-item empty">No containers found.</li>';
        } else {
            containerList.innerHTML = '';
            result.containers.forEach((container: any) => {
                const li = document.createElement('li');
                li.className = 'list-item';
                li.innerHTML = `
                    <span>${container.name}</span>
                    <span class="text-secondary" style="font-size: 0.8rem">${new Date(container.lastModified).toLocaleDateString()}</span>
                `;
                li.onclick = () => console.log('Selected container:', container.name);
                containerList.appendChild(li);
            });
        }
    } else {
        containerList.innerHTML = `<li class="list-item empty text-danger">Error: ${result.error}</li>`;
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
        // Update UI state
        connectSection.style.display = 'none';
        explorerSection.style.display = 'block';
        accountNameLabel.textContent = result.accountName;

        connectionStatus.classList.remove('disconnected');
        connectionStatus.classList.add('connected');
        statusText.textContent = 'Connected';

        updateContainerList();
    } else {
        alert('Connection failed: ' + result.error);
    }

    connectBtn.disabled = false;
    connectBtn.textContent = 'Connect Account';
});

disconnectBtn.addEventListener('click', async () => {
    await api.disconnect();

    connectSection.style.display = 'block';
    explorerSection.style.display = 'none';

    connectionStatus.classList.remove('connected');
    connectionStatus.classList.add('disconnected');
    statusText.textContent = 'Disconnected';

    connectionStringInput.value = '';
});

refreshBtn.addEventListener('click', updateContainerList);

// Tab switching (sidebar)
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
    });
});

console.log('Renderer initialized');
