import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppNotification, Job } from '../types';
import { api, type SourceInfo } from './api';

export interface BackendState {
  status: 'loading' | 'ready' | 'error';
  jobs: Job[]; sources: SourceInfo[]; lastCollected: string | null; running: boolean; error: string;
  notes: AppNotification[]; unread: number;
}

/** Loads jobs from the local backend, streams its log into the terminal and reloads when a collection finishes. */
export function useBackend(log: (m: string) => void) {
  const [s, setS] = useState<BackendState>({ status: 'loading', jobs: [], sources: [], lastCollected: null, running: false, error: '', notes: [], unread: 0 });
  const lastLog = useRef(0);
  const wasRunning = useRef(false);
  const failing = useRef(true);
  const notifSeq = useRef(-1);

  const load = useCallback(async () => {
    try {
      const [j, src, notes] = await Promise.all([api.jobs(), api.sources(), api.notifications()]);
      failing.current = false;
      setS((p) => ({ ...p, status: 'ready', jobs: j.jobs, sources: src, lastCollected: j.lastCollected, error: '', notes, unread: notes.filter((n) => !n.read).length }));
    } catch (e) {
      failing.current = true;
      setS((p) => ({ ...p, status: 'error', error: (e as Error).message }));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const tick = async () => {
      try {
        const h = await api.health();
        if (failing.current) { await load(); log('Connected to the JobRadar backend.'); }
        const entries = await api.log(lastLog.current);
        for (const e of entries) log(e.level === 'info' ? e.m : `${e.level.toUpperCase()}: ${e.m}`);
        if (entries.length) lastLog.current = entries[entries.length - 1].id;
        else if (lastLog.current === 0) lastLog.current = h.lastLog;
        if (wasRunning.current && !h.running) await load();
        wasRunning.current = h.running;
        if (h.notifSeq !== notifSeq.current) {
          notifSeq.current = h.notifSeq;
          const notes = await api.notifications();
          setS((p) => ({ ...p, notes, unread: h.unread }));
        }
        setS((p) => (p.running === h.running ? p : { ...p, running: h.running }));
      } catch {
        if (!failing.current) { failing.current = true; setS((p) => ({ ...p, status: 'error', error: 'Lost connection to the backend' })); }
      }
    };
    const t = setInterval(() => void tick(), 3000);
    return () => clearInterval(t);
  }, [load, log]);

  const collect = useCallback(async (source?: string) => {
    try { await api.collect(source); setS((p) => ({ ...p, running: true })); wasRunning.current = true; }
    catch (e) { log(`Could not start collection: ${(e as Error).message}`); }
  }, [log]);

  const toggle = useCallback(async (id: string, enabled: boolean) => { await api.toggle(id, enabled); await load(); }, [load]);

  const markRead = useCallback(async () => {
    await api.readAll();
    setS((p) => ({ ...p, unread: 0, notes: p.notes.map((n) => ({ ...n, read: true })) }));
  }, []);

  return { ...s, reload: load, collect, toggle, markRead };
}
