/// <reference types="vite/client" />
interface Window {
  jobradar?: { openExternal(url: string): Promise<boolean> };
}
