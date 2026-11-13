/// <reference types="vite/client" />
interface Window {
  jobradar?: {
    desktop: boolean;
    openExternal(url: string): Promise<boolean>;
    onOpenJob(cb: (jobId: string) => void): () => void;
    getVersion(): Promise<string>;
    getUpdateStatus(): Promise<import('./types').UpdateStatus>;
    checkForUpdates(): Promise<import('./types').UpdateStatus>;
    installUpdate(): Promise<void>;
    onUpdateStatus(cb: (s: import('./types').UpdateStatus) => void): () => void;
    getLoginItem(): Promise<boolean>;
    setLoginItem(on: boolean): Promise<boolean>;
  };
}
