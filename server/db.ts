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
  last_found: number | null; last_added: number | null; last_error: string | null; total: number;
}

export async function openDb(target?: string): Promise<void> {
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
    last_found INTEGER, last_added INTEGER, last_error TEXT, total INTEGER NOT NULL DEFAULT 0);`);
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
  return { id, enabled: 1, last_run: null, last_ok: null, last_found: null, last_added: null, last_error: null, total: 0 };
}

export function saveRun(id: string, r: { ok: boolean; found: number; added: number; error: string | null }): void {
  const now = new Date().toISOString();
  getState(id);
  run('UPDATE source_state SET last_run=?, last_ok=CASE WHEN ? THEN ? ELSE last_ok END, last_found=?, last_added=?, last_error=? WHERE id=?',
    [now, r.ok ? 1 : 0, now, r.found, r.added, r.error, id]);
}

export function setEnabled(id: string, enabled: boolean): void { getState(id); run('UPDATE source_state SET enabled=? WHERE id=?', [enabled ? 1 : 0, id]); }
