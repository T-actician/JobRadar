import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('jobradar', {
  openExternal: (url: string): Promise<boolean> => ipcRenderer.invoke('open-external', url),
});
