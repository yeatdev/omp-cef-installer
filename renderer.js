document.addEventListener('DOMContentLoaded', async () => {
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

    let currentVersion = null;
    let selectedPath = null;

    try {
        const result = await window.api.getVersion();
        if (!result.success) throw new Error(result.error);
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

    btnBrowse.addEventListener('click', async () => {
        const path = await window.api.selectDirectory();
        if (path) {
            selectedPath = path;
            gtaPathInput.value = selectedPath;
            await checkCurrentInstallation();
        }
    });

    async function checkCurrentInstallation() {
        if (!selectedPath) return;

        const result = await window.api.checkInstallation(selectedPath);

        if (result.installed) {
            btnUninstall.disabled = false;
            installedVersionDisplay.textContent = `v${result.version}`;
            installedVersionDisplay.style.color = '#9083d2';

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
            installedVersionDisplay.style.color = '#a0a0a0';
            btnUninstall.disabled = true;
            btnInstall.textContent = 'Install';
            if (currentVersion) {
                btnInstall.disabled = false;
            }
            messageArea.classList.add('hidden');
        }
    }

    btnInstall.addEventListener('click', async () => {
        if (!selectedPath || !currentVersion) return;

        btnInstall.disabled = true;
        btnUninstall.disabled = true;
        btnBrowse.disabled = true;
        progressContainer.classList.remove('hidden');
        messageArea.classList.add('hidden');
        progressBar.style.width = '0%';
        progressStatus.textContent = 'Starting installation...';

        const result = await window.api.installCef({
            targetPath: selectedPath,
            version: currentVersion
        });

        if (result.success) {
            progressBar.style.width = '100%';
            progressStatus.textContent = 'Done!';
            showMessage('Successfully installed Open.MP CEF client files!', 'success');
            await checkCurrentInstallation();
        } else {
            showMessage(`Installation failed: ${result.error}`, 'error');
            progressBar.style.background = '#ef4444';
        }

        btnBrowse.disabled = false;
        btnUninstall.disabled = false;
        btnInstall.disabled = false;
    });

    btnUninstall.addEventListener('click', async () => {
        if (!selectedPath) return;

        btnInstall.disabled = true;
        btnUninstall.disabled = true;
        btnBrowse.disabled = true;
        messageArea.classList.add('hidden');
        progressContainer.classList.add('hidden');

        const result = await window.api.uninstallCef({
            targetPath: selectedPath
        });

        if (result.success) {
            showMessage(result.message, 'success');
            await checkCurrentInstallation();
        } else {
            showMessage(`Uninstallation failed: ${result.error}`, 'error');
        }

        btnBrowse.disabled = false;
        if (currentVersion) btnInstall.disabled = false;
    });

    window.api.onInstallProgress((data) => {
        progressStatus.textContent = data.status;
        progressBar.style.width = `${data.percent}%`;
    });

    function showMessage(text, type) {
        messageArea.textContent = text;
        messageArea.className = `message ${type}`;
        messageArea.classList.remove('hidden');
    }
});
