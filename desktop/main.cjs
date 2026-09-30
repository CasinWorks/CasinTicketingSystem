const { app, BrowserWindow, dialog, shell } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const fs = require('fs');

const PORT = Number(process.env.OPS_DESKTOP_PORT || 47821);
const APP_URL = `http://127.0.0.1:${PORT}`;

let mainWindow = null;
let serverProcess = null;
let quitting = false;

function isPackaged() {
  return app.isPackaged;
}

function serverDir() {
  return isPackaged()
    ? path.join(process.resourcesPath, 'server')
    : path.join(__dirname, '..', 'server');
}

function clientDistDir() {
  return isPackaged()
    ? path.join(process.resourcesPath, 'client-dist')
    : path.join(__dirname, '..', 'client', 'dist');
}

function probeHealth() {
  return new Promise((resolve) => {
    const req = http.get(`${APP_URL}/api/health`, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function waitForServer(attempts = 80) {
  return new Promise((resolve, reject) => {
    let left = attempts;
    const tryOnce = async () => {
      if (await probeHealth()) {
        resolve();
        return;
      }
      left -= 1;
      if (left <= 0) reject(new Error('Server did not start in time'));
      else setTimeout(tryOnce, 250);
    };
    tryOnce();
  });
}

function stopBackend() {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
  }
  serverProcess = null;
}

function startBackend() {
  if (serverProcess && !serverProcess.killed) return;

  const cwd = serverDir();
  const entry = path.join(cwd, 'index.js');
  if (!fs.existsSync(entry)) {
    throw new Error(`Server entry not found: ${entry}`);
  }

  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    PORT: String(PORT),
    CLIENT_ORIGIN: APP_URL,
    CLIENT_DIST: clientDistDir(),
    SERVE_CLIENT: 'true',
  };

  // Packaged apps don't have `node` on PATH — reuse Electron's Node runtime.
  serverProcess = spawn(process.execPath, [entry], {
    cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  serverProcess.stdout.on('data', (buf) => process.stdout.write(`[ops] ${buf}`));
  serverProcess.stderr.on('data', (buf) => process.stderr.write(`[ops] ${buf}`));
  serverProcess.on('error', (err) => {
    console.error('Failed to spawn OPS server', err);
  });
  serverProcess.on('exit', (code) => {
    console.log(`OPS server exited with code ${code}`);
    serverProcess = null;
  });
}

async function ensureBackend() {
  if (await probeHealth()) return;
  startBackend();
  await waitForServer();
}

async function createWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.focus();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: 'CasinWorks OPS',
    backgroundColor: '#12181f',
    icon: path.join(__dirname, 'build', 'icon-source.png'),
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  await mainWindow.loadURL(APP_URL);
  mainWindow.show();
}

async function boot() {
  try {
    await ensureBackend();
    await createWindow();
  } catch (err) {
    dialog.showErrorBox(
      'CasinWorks OPS failed to start',
      `${err.message}\n\nIf this keeps happening, reinstall from the latest DMG or run the web app with npm run dev:server / npm run dev:client.`
    );
    app.quit();
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', async () => {
    try {
      await ensureBackend();
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      } else {
        await createWindow();
      }
    } catch (err) {
      console.error(err);
    }
  });
  app.whenReady().then(boot);
}

// Keep the backend alive on macOS when the window closes (Dock reactivation).
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stopBackend();
    app.quit();
  }
});

app.on('before-quit', () => {
  quitting = true;
  stopBackend();
});

app.on('activate', async () => {
  if (quitting) return;
  try {
    await ensureBackend();
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    } else if (mainWindow) {
      mainWindow.focus();
    }
  } catch (err) {
    dialog.showErrorBox('CasinWorks OPS failed to reopen', err.message);
  }
});
