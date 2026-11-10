import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('jobradar', {
  desktop: true,
  openExternal: (url: string): Promise<boolean> => ipcRenderer.invoke('open-external', url),
  /** Called when the user clicks a desktop notification about a job. */
  onOpenJob: (cb: (jobId: string) => void): (() => void) => {
    const h = (_e: unknown, id: string) => cb(id);
    ipcRenderer.on('open-job', h);
    return () => { ipcRenderer.removeListener('open-job', h); };
  },
  getLoginItem: (): Promise<boolean> => ipcRenderer.invoke('login-item:get'),
  setLoginItem: (on: boolean): Promise<boolean> => ipcRenderer.invoke('login-item:set', on),
});
