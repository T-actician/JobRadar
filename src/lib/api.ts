import type { AppNotification, Job } from '../types';

const BASE = 'http://127.0.0.1:4317/api';

export interface SourceInfo {
  id: string; name: string; homepage: string; kind: 'api' | 'feed' | 'html'; enabled: boolean; needsKey: string | null; keyMissing: boolean;
  lastRun: string | null; lastOk: string | null; lastFound: number | null; lastAdded: number | null; lastError: string | null; total: number;
}
export interface Health { ok: boolean; jobs: number; running: boolean; lastLog: number; lastCollected: string | null; notifSeq: number; unread: number }
export interface LogEntry { id: number; t: string; m: string; level: 'info' | 'warn' | 'error' }

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { 'Content-Type': 'application/json' } });
  if (!res.ok) throw new Error(`Backend returned ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  health: () => req<Health>('/health'),
  jobs: () => req<{ jobs: Job[]; lastCollected: string | null }>('/jobs'),
  sources: () => req<SourceInfo[]>('/sources'),
  log: (after: number) => req<LogEntry[]>(`/log?after=${after}`),
  collect: (source?: string) => req<{ started: boolean }>(`/collect${source ? `?source=${source}` : ''}`, { method: 'POST' }),
  state: () => req<Record<string, unknown>>('/state'),
  put: (key: string, value: unknown) => req<{ ok: boolean }>(`/state/${key}`, { method: 'PUT', body: JSON.stringify({ value }) }),
  notifications: () => req<AppNotification[]>('/notifications'),
  readAll: () => req<{ ok: boolean }>('/notifications/read', { method: 'POST' }),
  toggle: (id: string, enabled: boolean) => req<{ ok: boolean }>(`/sources/${id}`, { method: 'PATCH', body: JSON.stringify({ enabled }) }),
};
