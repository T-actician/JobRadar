import { type ChildProcess, spawn } from 'child_process';
import { app, BrowserWindow, ipcMain, Menu, nativeImage, Notification, shell, Tray } from 'electron';
import fs from 'fs';
import path from 'path';

const dev = process.argv.includes('--dev');
const startHidden = process.argv.includes('--hidden');
const DEV_URL = 'http://localhost:5173';
const API = 'http://127.0.0.1:4317/api';
const ICON = path.join(__dirname, '../assets/icon.png');

let win: BrowserWindow | null = null;
let tray: Tray | null = null;
let backend: ChildProcess | null = null;
let quitting = false;

function createWindow(): void {
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1100, minHeight: 700, title: 'JobRadar', icon: ICON,
    backgroundColor: '#030b14', autoHideMenuBar: true, show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(DEV_URL) && !url.startsWith('file://')) e.preventDefault();
  });
  win.once('ready-to-show', () => { if (!startHidden) win?.show(); });
  // Closing the window keeps JobRadar running in the tray so collection and alerts continue.
  win.on('close', (e) => { if (!quitting) { e.preventDefault(); win?.hide(); } });
  if (dev) void win.loadURL(DEV_URL);
  else void win.loadFile(path.join(__dirname, '../dist/index.html'));
}

function showWindow(): void {
  if (!win) createWindow();
  win?.show();
  if (win?.isMinimized()) win.restore();
  win?.focus();
}

// ---- backend: started with the app (outside dev, where `npm run dev` starts it) and restarted if it dies ----
async function backendUp(): Promise<boolean> {
  try { return (await fetch(`${API}/health`, { signal: AbortSignal.timeout(1500) })).ok; } catch { return false; }
}
async function ensureBackend(): Promise<void> {
  if (dev || backend || quitting || (await backendUp())) return;
  const home = app.getPath('userData');
  fs.mkdirSync(home, { recursive: true });
  const out = fs.openSync(path.join(home, 'backend.log'), 'a');
  // Installed app: run the bundled server and keep the database in the user's profile (Program Files is read-only).
  // Project folder: run the TypeScript source, as before.
  const args = app.isPackaged ? [path.join(process.resourcesPath, 'server', 'server.cjs')] : ['--import', 'tsx', 'server/index.ts'];
  const env = { ...process.env, ELECTRON_RUN_AS_NODE: '1', ...(app.isPackaged ? { JOBRADAR_DATA_DIR: path.join(home, 'data') } : {}) };
  backend = spawn(process.execPath, args, { cwd: app.isPackaged ? home : app.getAppPath(), env, windowsHide: true, stdio: ['ignore', out, out] });
  backend.on('exit', () => { backend = null; });
}

// ---- desktop notifications: the backend creates them, we show them ----
const shown = new Set<number>();
async function pollNotifications(): Promise<void> {
  try {
    const r = await fetch(`${API}/notifications?undelivered=1`, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) return;
    const list = ((await r.json()) as { id: number; title: string; body: string; jobId: string | null }[]).filter((n) => !shown.has(n.id)).reverse();
    if (!list.length) return;
    list.forEach((n) => shown.add(n.id));
    if (Notification.isSupported()) {
      for (const n of list.slice(0, 5)) {
        const note = new Notification({ title: n.title, body: n.body, icon: ICON });
        note.on('click', () => { showWindow(); if (n.jobId) win?.webContents.send('open-job', n.jobId); });
        note.show();
      }
      if (list.length > 5) new Notification({ title: 'JobRadar', body: `${list.length - 5} more notifications. Open Job Alerts to see them.`, icon: ICON }).show();
    }
    await fetch(`${API}/notifications/delivered`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: list.map((n) => n.id) }) });
  } catch { /* backend not up yet */ }
}

function createTray(): void {
  tray = new Tray(nativeImage.createFromPath(ICON).resize({ width: 16, height: 16 }));
  tray.setToolTip('JobRadar: collecting in the background');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open JobRadar', click: showWindow },
    { label: 'Collect now', click: () => { void fetch(`${API}/collect`, { method: 'POST' }).catch(() => undefined); } },
    { type: 'separator' },
    { label: 'Quit JobRadar (stops background collection)', click: () => { quitting = true; app.quit(); } },
  ]));
  tray.on('click', showWindow);
}

const loginOpts = () => (app.isPackaged ? { args: ['--hidden'] } : { path: process.execPath, args: [app.getAppPath(), '--hidden'] });
ipcMain.handle('login-item:get', () => app.getLoginItemSettings(loginOpts()).openAtLogin);
ipcMain.handle('login-item:set', (_e, on: unknown) => {
  app.setLoginItemSettings({ openAtLogin: on === true, ...loginOpts() });
  return app.getLoginItemSettings(loginOpts()).openAtLogin;
});

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

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showWindow);
  app.setAppUserModelId('com.jobradar.app'); // needed for Windows toast notifications
  app.whenReady().then(() => {
    createWindow();
    createTray();
    void ensureBackend();
    setInterval(() => void ensureBackend(), 30_000);
    setInterval(() => void pollNotifications(), 15_000);
    app.on('activate', showWindow);
  });
  app.on('before-quit', () => { quitting = true; backend?.kill(); });
  app.on('window-all-closed', () => { /* stay in the tray */ });
}
