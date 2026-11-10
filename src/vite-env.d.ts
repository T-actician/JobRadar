/// <reference types="vite/client" />
interface Window {
  jobradar?: {
    desktop: boolean;
    openExternal(url: string): Promise<boolean>;
    onOpenJob(cb: (jobId: string) => void): () => void;
    getLoginItem(): Promise<boolean>;
    setLoginItem(on: boolean): Promise<boolean>;
  };
}
