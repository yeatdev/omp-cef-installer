const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const extract = require('extract-zip');
const { pipeline } = require('stream/promises');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 400,
    resizable: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    show: false,
    backgroundColor: '#0f172a'
  });

  mainWindow.loadFile('index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select GTA San Andreas Directory'
  });

  if (result.canceled) {
    return null;
  } else {
    return result.filePaths[0];
  }
});

ipcMain.handle('get-version', async () => {
  try {
    const response = await axios.get('https://raw.githubusercontent.com/yeatdev/omp-cef-installer/main/version.txt?t=' + Date.now());
    return { success: true, version: response.data.toString().trim() };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('install-cef', async (event, { targetPath, version }) => {
  try {
    const downloadUrl = `https://github.com/aurora-mp/omp-cef/releases/download/v${version}/client-files-v${version}.zip`;
    const tempZipPath = path.join(app.getPath('temp'), `omp-cef-${version}.zip`);

    event.sender.send('install-progress', { status: 'Downloading...', percent: 0 });

    const response = await axios({
      method: 'GET',
      url: downloadUrl,
      responseType: 'stream'
    });

    const totalLength = response.headers['content-length'];
    let downloaded = 0;

    response.data.on('data', (chunk) => {
      downloaded += chunk.length;
      if (totalLength) {
        const percent = Math.round((downloaded / totalLength) * 100);
        event.sender.send('install-progress', { status: `Downloading... ${percent}%`, percent: percent });
      } else {
        event.sender.send('install-progress', { status: `Downloading... (${(downloaded / 1024 / 1024).toFixed(2)} MB)`, percent: 50 });
      }
    });

    const writer = fs.createWriteStream(tempZipPath);
    await pipeline(response.data, writer);

    event.sender.send('install-progress', { status: 'Extracting files...', percent: 100 });

    await extract(tempZipPath, { dir: targetPath });

    event.sender.send('install-progress', { status: 'Finalizing...', percent: 100 });
    fs.unlinkSync(tempZipPath);
    fs.writeFileSync(path.join(targetPath, 'cef-version.txt'), version, 'utf8');

    return { success: true };
  } catch (error) {
    console.error('Installation failed:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('uninstall-cef', async (event, { targetPath }) => {
  try {
    const asiPath = path.join(targetPath, 'cef.asi');
    const cefDir = path.join(targetPath, 'cef');
    const versionFile = path.join(targetPath, 'cef-version.txt');

    let removed = false;

    if (fs.existsSync(asiPath)) {
      fs.unlinkSync(asiPath);
      removed = true;
    }

    if (fs.existsSync(cefDir)) {
      fs.rmSync(cefDir, { recursive: true, force: true });
      removed = true;
    }

    if (fs.existsSync(versionFile)) {
      fs.unlinkSync(versionFile);
    }

    if (removed) {
      return { success: true, message: 'Successfully uninstalled Open.MP CEF.' };
    } else {
      return { success: true, message: 'Open.MP CEF was not found in this directory.' };
    }
  } catch (error) {
    console.error('Uninstallation failed:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('check-installation', async (event, targetPath) => {
  try {
    const asiPath = path.join(targetPath, 'cef.asi');
    const versionFile = path.join(targetPath, 'cef-version.txt');

    if (fs.existsSync(asiPath)) {
      let installedVersion = 'Unknown';
      if (fs.existsSync(versionFile)) {
        installedVersion = fs.readFileSync(versionFile, 'utf8').trim();
      }
      return { installed: true, version: installedVersion };
    }
    return { installed: false, version: null };
  } catch (error) {
    return { installed: false, version: null };
  }
});
