import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';

const dev = process.argv.includes('--dev');
const DEV_URL = 'http://localhost:5173';

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: 'JobRadar',
    backgroundColor: '#030b14',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(DEV_URL) && !url.startsWith('file://')) e.preventDefault();
  });

  if (dev) win.loadURL(DEV_URL);
  else win.loadFile(path.join(__dirname, '../dist/index.html'));
}

// Only http(s) links are ever handed to the OS browser.
ipcMain.handle('open-external', async (_event, url: unknown): Promise<boolean> => {
  if (typeof url !== 'string') return false;
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    await shell.openExternal(u.toString());
    return true;
  } catch {
    return false;
  }
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
