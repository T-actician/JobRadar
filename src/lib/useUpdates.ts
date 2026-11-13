import { useEffect, useState } from 'react';
import type { UpdateStatus } from '../types';

/** Update state from the desktop app. In a plain browser there is nothing to update. */
export function useUpdates() {
  const bridge = window.jobradar;
  const [status, setStatus] = useState<UpdateStatus>({ state: bridge ? 'idle' : 'dev' });
  const [version, setVersion] = useState('');
  useEffect(() => {
    if (!bridge) return;
    void bridge.getUpdateStatus().then(setStatus);
    void bridge.getVersion().then(setVersion);
    return bridge.onUpdateStatus(setStatus);
  }, [bridge]);
  return {
    status, version, desktop: !!bridge,
    check: () => { void bridge?.checkForUpdates().then(setStatus); },
    install: () => { void bridge?.installUpdate(); },
  };
}
