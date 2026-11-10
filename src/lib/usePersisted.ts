import { useEffect, useRef, useState } from 'react';
import { api } from './api';

let loading: Promise<Record<string, unknown>> | null = null;
const loadServerState = () => (loading ??= api.state().catch((e) => { loading = null; throw e; }));

/**
 * Like useState, but saved to the backend so alerts and reminders work while the window is closed.
 * localStorage keeps the UI instant and works if the backend is briefly down.
 */
export function usePersisted<T>(key: string, initial: T) {
  const storeKey = `jr.${key}`;
  const [value, setValue] = useState<T>(() => {
    try { const raw = localStorage.getItem(storeKey); return raw ? (JSON.parse(raw) as T) : initial; } catch { return initial; }
  });
  const latest = useRef(value);
  const skipPut = useRef(true);
  const hydrated = useRef(false);
  const touched = useRef(false);
  const timer = useRef<number>();

  useEffect(() => {
    let dead = false;
    let retry: number;
    const attempt = () => {
      loadServerState().then((all) => {
        if (dead) return;
        hydrated.current = true;
        if (touched.current) { void api.put(key, latest.current).catch(() => undefined); return; }
        if (key in all) {
          if (JSON.stringify(all[key]) !== JSON.stringify(latest.current)) { skipPut.current = true; setValue(all[key] as T); }
        } else if (localStorage.getItem(storeKey) !== null) {
          void api.put(key, latest.current).catch(() => undefined);
        }
      }).catch(() => { if (!dead) retry = window.setTimeout(attempt, 4000); });
    };
    attempt();
    return () => { dead = true; window.clearTimeout(retry); };
  }, [key, storeKey]);

  useEffect(() => {
    latest.current = value;
    try { localStorage.setItem(storeKey, JSON.stringify(value)); } catch { /* storage unavailable */ }
    if (skipPut.current) { skipPut.current = false; return; }
    if (!hydrated.current) { touched.current = true; return; }
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { void api.put(key, value).catch(() => undefined); }, 400);
  }, [value, key, storeKey]);

  return [value, setValue] as const;
}
