window.onerror = function (msg, url, lineNo, columnNo, error) {
    document.getElementById('message-area').textContent = msg + ' at ' + lineNo + ':' + columnNo;
    document.getElementById('message-area').className = 'message error';
    document.getElementById('message-area').classList.remove('hidden');
    return false;
};

const tauri = window.__TAURI__ || {};
const { invoke } = tauri.core || {};
const { listen } = tauri.event || {};

if (!invoke) {
    throw new Error('Tauri API is not injected! window.__TAURI__ is missing or incomplete.');
}

// ─── DOM Elements ────────────────────────────────────────────

const versionDisplay = document.getElementById('version-display');
const installedVersionDisplay = document.getElementById('installed-version');
const gtaPathInput = document.getElementById('gta-path');
const btnBrowse = document.getElementById('btn-browse');
const btnInstall = document.getElementById('btn-install');
const btnUninstall = document.getElementById('btn-uninstall');
const progressContainer = document.getElementById('progress-container');
const progressBar = document.getElementById('progress-bar');
const progressStatus = document.getElementById('progress-status');
const messageArea = document.getElementById('message-area');

// ─── State ───────────────────────────────────────────────────

let currentVersion = null;
let selectedPath = null;

// ─── Initialize ──────────────────────────────────────────────

async function init() {
    try {
        const result = await invoke('get_remote_version');

        if (!result.success) {
            throw new Error(result.error || 'Unknown error');
        }

        currentVersion = result.version;
        versionDisplay.textContent = `v${currentVersion}`;
        versionDisplay.classList.remove('loading');

        if (selectedPath) {
            btnInstall.disabled = false;
            btnUninstall.disabled = false;
        }
    } catch (error) {
        versionDisplay.textContent = 'Error';
        versionDisplay.classList.remove('loading');
        showMessage('Failed to fetch latest version. Check your connection.', 'error');
    }
}

init();

// ─── Browse Directory ────────────────────────────────────────

btnBrowse.addEventListener('click', async () => {
    const path = await invoke('select_directory');

    if (path) {
        selectedPath = path;
        gtaPathInput.value = selectedPath;
        await checkCurrentInstallation();
    }
});

// ─── Check Installation ──────────────────────────────────────

async function checkCurrentInstallation() {
    if (!selectedPath) return;

    const result = await invoke('check_installation', { targetPath: selectedPath });

    if (result.installed) {
        btnUninstall.disabled = false;
        installedVersionDisplay.textContent = `v${result.version}`;
        installedVersionDisplay.classList.remove('muted');

        if (currentVersion && result.version !== currentVersion) {
            btnInstall.textContent = 'Update';
            btnInstall.disabled = false;
            showMessage('An update is available!', 'success');
        } else {
            btnInstall.textContent = 'Reinstall';
            btnInstall.disabled = false;
            messageArea.classList.add('hidden');
        }
    } else {
        installedVersionDisplay.textContent = 'Not Installed';
        installedVersionDisplay.classList.add('muted');
        btnUninstall.disabled = true;
        btnInstall.textContent = 'Install';
        if (currentVersion) {
            btnInstall.disabled = false;
        }
        messageArea.classList.add('hidden');
    }
}

// ─── Install ─────────────────────────────────────────────────

btnInstall.addEventListener('click', async () => {
    if (!selectedPath || !currentVersion) return;

    btnInstall.disabled = true;
    btnUninstall.disabled = true;
    btnBrowse.disabled = true;
    progressContainer.classList.remove('hidden');
    messageArea.classList.add('hidden');
    progressBar.style.width = '0%';
    progressBar.style.background = '';
    progressStatus.textContent = 'Starting installation...';

    const result = await invoke('install_cef', {
        targetPath: selectedPath,
        version: currentVersion,
    });

    if (result.success) {
        progressBar.style.width = '100%';
        progressStatus.textContent = 'Done!';
        showMessage('Successfully installed Open.MP CEF client files!', 'success');
        await checkCurrentInstallation();
    } else {
        showMessage(`Installation failed: ${result.error}`, 'error');
        progressBar.style.background = 'linear-gradient(90deg, #ef4444, #dc2626)';
    }

    btnBrowse.disabled = false;
    btnUninstall.disabled = false;
    btnInstall.disabled = false;
});

// ─── Uninstall ───────────────────────────────────────────────

btnUninstall.addEventListener('click', async () => {
    if (!selectedPath) return;

    btnInstall.disabled = true;
    btnUninstall.disabled = true;
    btnBrowse.disabled = true;
    messageArea.classList.add('hidden');
    progressContainer.classList.add('hidden');

    const result = await invoke('uninstall_cef', { targetPath: selectedPath });

    if (result.success) {
        showMessage(result.message, 'success');
        await checkCurrentInstallation();
    } else {
        showMessage(`Uninstallation failed: ${result.error}`, 'error');
    }

    btnBrowse.disabled = false;
    if (currentVersion) btnInstall.disabled = false;
});

// ─── Progress Events ─────────────────────────────────────────

listen('install-progress', (event) => {
    const data = event.payload;
    progressStatus.textContent = data.status;
    progressBar.style.width = `${data.percent}%`;
});

// ─── Helpers ─────────────────────────────────────────────────

function showMessage(text, type) {
    messageArea.textContent = text;
    messageArea.className = `message ${type}`;
    messageArea.classList.remove('hidden');
}
