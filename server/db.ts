import fs from 'node:fs';
import path from 'node:path';
import initSqlJs, { type Database } from 'sql.js';
import type { Job } from '../src/types';
import { DATA_DIR } from './config';

let db: Database;
let file = '';
let timer: NodeJS.Timeout | null = null;

export interface SourceState {
  id: string; enabled: number; last_run: string | null; last_ok: string | null;
  last_found: number | null; last_added: number | null; last_error: string | null; total: number; fails: number;
}

export async function openDb(target?: string): Promise<void> {
  if (!target && process.env.NODE_TEST_CONTEXT) throw new Error('Tests must open a temporary database, never the real one');
  file = target ?? path.join(DATA_DIR, 'jobradar.db');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const SQL = await initSqlJs();
  db = fs.existsSync(file) ? new SQL.Database(fs.readFileSync(file)) : new SQL.Database();
  db.run(`CREATE TABLE IF NOT EXISTS jobs(
    id TEXT PRIMARY KEY, source TEXT NOT NULL, url TEXT NOT NULL, published TEXT, collected TEXT,
    last_seen TEXT, deadline TEXT, status TEXT, data TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS jobs_source ON jobs(source);
  CREATE TABLE IF NOT EXISTS source_state(
    id TEXT PRIMARY KEY, enabled INTEGER NOT NULL DEFAULT 1, last_run TEXT, last_ok TEXT,
    last_found INTEGER, last_added INTEGER, last_error TEXT, total INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE IF NOT EXISTS kv(key TEXT PRIMARY KEY, value TEXT NOT NULL, updated TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS notifications(
    id INTEGER PRIMARY KEY AUTOINCREMENT, dedupe TEXT UNIQUE, kind TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL,
    job_id TEXT, created TEXT NOT NULL, delivered INTEGER NOT NULL DEFAULT 0, read INTEGER NOT NULL DEFAULT 0);`);
  if (!all<{ name: string }>('PRAGMA table_info(source_state)').some((c) => c.name === 'fails')) db.run('ALTER TABLE source_state ADD COLUMN fails INTEGER NOT NULL DEFAULT 0');
  flush();
}

/** Atomic write: temp file then rename, so a crash never corrupts the database. */
export function flush(): void {
  if (timer) { clearTimeout(timer); timer = null; }
  if (!db || !file) return;
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, Buffer.from(db.export()));
  fs.renameSync(tmp, file);
}
const dirty = () => { if (!timer) timer = setTimeout(flush, 1500); };
export function closeDb(): void { flush(); db?.close(); }

function all<T>(sql: string, params: (string | number | null)[] = []): T[] {
  const st = db.prepare(sql);
  st.bind(params);
  const out: T[] = [];
  while (st.step()) out.push(st.getAsObject() as T);
  st.free();
  return out;
}
function run(sql: string, params: (string | number | null)[] = []): void { db.run(sql, params); dirty(); }

export type UpsertResult = 'added' | 'updated' | 'same';

export function upsertJob(job: Job): UpsertResult {
  const now = new Date().toISOString();
  const old = all<{ data: string }>('SELECT data FROM jobs WHERE id = ?', [job.id])[0];
  if (!old) {
    run('INSERT INTO jobs(id,source,url,published,collected,last_seen,deadline,status,data) VALUES(?,?,?,?,?,?,?,?,?)',
      [job.id, job.source, job.applyUrl, job.published, job.collected, now, job.deadline, job.status, JSON.stringify(job)]);
    return 'added';
  }
  const prev = JSON.parse(old.data) as Job;
  const changed = prev.title !== job.title || prev.deadline !== job.deadline || prev.description !== job.description || prev.employer !== job.employer;
  if (!changed) { run('UPDATE jobs SET last_seen = ? WHERE id = ?', [now, job.id]); return 'same'; }
  const merged: Job = { ...job, collected: prev.collected, published: prev.published, status: 'updated' };
  run('UPDATE jobs SET deadline=?, status=?, last_seen=?, data=? WHERE id=?', [merged.deadline, 'updated', now, JSON.stringify(merged), job.id]);
  return 'updated';
}

export const listJobs = (): Job[] =>
  all<{ data: string }>('SELECT data FROM jobs ORDER BY published DESC LIMIT 5000').map((r) => JSON.parse(r.data) as Job);

export const jobCount = (): number => all<{ n: number }>('SELECT COUNT(*) AS n FROM jobs')[0]?.n ?? 0;
export const lastCollected = (): string | null => all<{ m: string | null }>('SELECT MAX(collected) AS m FROM jobs')[0]?.m ?? null;
export const sourceTotals = (): Record<string, number> =>
  Object.fromEntries(all<{ source: string; n: number }>('SELECT source, COUNT(*) AS n FROM jobs GROUP BY source').map((r) => [r.source, r.n]));

export const knownUrls = (source: string): Set<string> =>
  new Set(all<{ url: string }>('SELECT url FROM jobs WHERE source = ?', [source]).map((r) => r.url));

export function touchSeen(source: string, urls: string[]): void {
  const now = new Date().toISOString();
  for (const u of urls) db.run('UPDATE jobs SET last_seen = ? WHERE source = ? AND url = ?', [now, source, u]);
  dirty();
}

export function getState(id: string): SourceState {
  const r = all<SourceState>('SELECT * FROM source_state WHERE id = ?', [id])[0];
  if (r) return r;
  run('INSERT INTO source_state(id) VALUES(?)', [id]);
  return { id, enabled: 1, last_run: null, last_ok: null, last_found: null, last_added: null, last_error: null, total: 0, fails: 0 };
}

export function saveRun(id: string, r: { ok: boolean; found: number; added: number; error: string | null }): void {
  const now = new Date().toISOString();
  getState(id);
  run('UPDATE source_state SET last_run=?, last_ok=CASE WHEN ? THEN ? ELSE last_ok END, last_found=?, last_added=?, last_error=?, fails=CASE WHEN ? THEN 0 ELSE fails + 1 END WHERE id=?',
    [now, r.ok ? 1 : 0, now, r.found, r.added, r.error, r.ok ? 1 : 0, id]);
}

export function setEnabled(id: string, enabled: boolean): void { getState(id); run('UPDATE source_state SET enabled=? WHERE id=?', [enabled ? 1 : 0, id]); }

export const getJob = (id: string): Job | null => {
  const r = all<{ data: string }>('SELECT data FROM jobs WHERE id = ?', [id])[0];
  return r ? (JSON.parse(r.data) as Job) : null;
};

// ---- key-value store: the user's saved jobs, applications, searches and preferences live here ----
export function kvGet<T>(key: string): T | undefined {
  const r = all<{ value: string }>('SELECT value FROM kv WHERE key = ?', [key])[0];
  if (!r) return undefined;
  try { return JSON.parse(r.value) as T; } catch { return undefined; }
}
export function kvSet(key: string, value: unknown): void {
  run('INSERT INTO kv(key,value,updated) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated=excluded.updated', [key, JSON.stringify(value), new Date().toISOString()]);
}
export const kvAll = (): Record<string, unknown> =>
  Object.fromEntries(all<{ key: string; value: string }>('SELECT key, value FROM kv').map((r) => [r.key, JSON.parse(r.value)]));

// ---- notifications ----
export interface NoteIn { dedupe: string; kind: string; title: string; body: string; jobId?: string | null; silent?: boolean }
/** Returns true when a new notification was stored (false = same event already notified). */
export function addNotification(n: NoteIn): boolean {
  if (all('SELECT 1 FROM notifications WHERE dedupe = ?', [n.dedupe]).length) return false;
  run('INSERT INTO notifications(dedupe,kind,title,body,job_id,created,delivered) VALUES(?,?,?,?,?,?,?)',
    [n.dedupe, n.kind, n.title, n.body, n.jobId ?? null, new Date().toISOString(), n.silent ? 1 : 0]);
  // keep the table small
  run('DELETE FROM notifications WHERE id NOT IN (SELECT id FROM notifications ORDER BY id DESC LIMIT 300)');
  return true;
}
interface NoteRow { id: number; kind: string; title: string; body: string; job_id: string | null; created: string; delivered: number; read: number }
export const listNotifications = (o: { undelivered?: boolean; limit?: number } = {}) =>
  all<NoteRow>(`SELECT * FROM notifications ${o.undelivered ? 'WHERE delivered = 0' : ''} ORDER BY id DESC LIMIT ?`, [o.limit ?? 50])
    .map((r) => ({ id: r.id, kind: r.kind, title: r.title, body: r.body, jobId: r.job_id, createdAt: r.created, delivered: !!r.delivered, read: !!r.read }));
export const markDelivered = (ids: number[]): void => { for (const id of ids) db.run('UPDATE notifications SET delivered = 1 WHERE id = ?', [id]); dirty(); };
export const markAllRead = (): void => run('UPDATE notifications SET read = 1, delivered = 1');
export const unreadCount = (): number => all<{ n: number }>('SELECT COUNT(*) AS n FROM notifications WHERE read = 0')[0]?.n ?? 0;
export const lastNotificationId = (): number => all<{ m: number | null }>('SELECT MAX(id) AS m FROM notifications')[0]?.m ?? 0;

/** Removes every job of one source (used to clean up test data left in the real database by older test runs). */
export function deleteBySource(source: string): number {
  const n = all<{ n: number }>('SELECT COUNT(*) AS n FROM jobs WHERE source = ?', [source])[0]?.n ?? 0;
  run('DELETE FROM jobs WHERE source = ?', [source]);
  return n;
}
