import { createHash } from 'node:crypto';
import { DEFAULT_PREFS, OPEN_APP_STATUSES } from '../src/constants';
import { applyFilters, daysLeft } from '../src/lib/filters';
import type { AppRecord, Job, Prefs, SavedSearch } from '../src/types';
import { addNotification, getJob, kvGet, kvSet } from './db';
import { log } from './log';

export const getPrefs = (): Prefs => ({ ...DEFAULT_PREFS, ...(kvGet<Partial<Prefs>>('prefs') ?? {}) });
const alerts = (): SavedSearch[] => (kvGet<SavedSearch[]>('searches') ?? []).filter((s) => s.notify);
const hash = (s: string) => createHash('sha1').update(s).digest('hex').slice(0, 16);
const titles = (jobs: Job[]) => jobs.slice(0, 2).map((j) => j.title).join(', ') + (jobs.length > 2 ? ` and ${jobs.length - 2} more` : '');
const push = (n: Parameters<typeof addNotification>[0]) => addNotification({ ...n, silent: !getPrefs().notify });

/** Called with the jobs a collection just ADDED. Instant alerts notify now; daily alerts wait for the digest. */
export function notifyNewJobs(added: Job[]): number {
  if (!added.length) return 0;
  let made = 0;
  for (const a of alerts()) {
    const hits = applyFilters(added, a.filters);
    if (!hits.length) continue;
    if (a.frequency === 'daily') {
      const q = kvGet<Record<string, string[]>>('digestQueue') ?? {};
      q[a.id] = [...new Set([...(q[a.id] ?? []), ...hits.map((j) => j.id)])];
      kvSet('digestQueue', q);
      continue;
    }
    const key = `match:${a.id}:${hash(hits.map((j) => j.id).sort().join('|'))}`;
    if (push({ dedupe: key, kind: 'match', title: `${hits.length} new job${hits.length > 1 ? 's' : ''}: ${a.name}`, body: titles(hits), jobId: hits[0].id })) made++;
  }
  if (made) log(`Alerts: ${made} notification${made > 1 ? 's' : ''} created`);
  return made;
}

/** One digest per daily alert, once per day, at or after the chosen hour. */
export function sendDigests(now = new Date()): number {
  const day = now.toISOString().slice(0, 10);
  if (now.getHours() < getPrefs().digestHour || kvGet<string>('lastDigest') === day) return 0;
  kvSet('lastDigest', day);
  const q = kvGet<Record<string, string[]>>('digestQueue') ?? {};
  let made = 0;
  for (const a of alerts().filter((x) => x.frequency === 'daily')) {
    const jobs = (q[a.id] ?? []).map(getJob).filter((j): j is Job => !!j);
    if (!jobs.length) continue;
    if (push({ dedupe: `digest:${a.id}:${day}`, kind: 'digest', title: `Daily digest: ${a.name}`, body: `${jobs.length} new: ${titles(jobs)}`, jobId: jobs[0].id })) made++;
  }
  kvSet('digestQueue', {});
  return made;
}

/** Saved jobs and applications still in progress get a reminder 3 days, 1 day and on the day of the deadline. */
export function deadlineReminders(): number {
  if (!getPrefs().deadlines) return 0;
  const apps = kvGet<Record<string, AppRecord>>('apps') ?? {};
  const ids = new Set([...(kvGet<string[]>('saved') ?? []), ...Object.keys(apps)]);
  let made = 0;
  for (const id of ids) {
    if (apps[id] && !OPEN_APP_STATUSES.includes(apps[id].status)) continue; // already applied, rejected, withdrawn...
    const j = getJob(id);
    const d = j ? daysLeft(j.deadline) : null;
    if (!j || d === null || d < 0 || d > 3) continue;
    const step = d === 0 ? 0 : d === 1 ? 1 : 3;
    const when = d === 0 ? 'closes today' : d === 1 ? 'closes tomorrow' : `closes in ${d} days`;
    if (push({ dedupe: `deadline:${id}:${step}`, kind: 'deadline', title: `Deadline: ${j.title}`, body: `${j.employer} ${when}.`, jobId: id })) made++;
  }
  return made;
}

/** Warns when a source keeps failing, or suddenly returns nothing (its page layout may have changed). */
export function sourceHealth(name: string, id: string, r: { ok: boolean; found: number; fails: number; prevFound: number | null; error: string | null }): void {
  if (!r.ok && r.fails === 3) push({ dedupe: `health:${id}:down:${new Date().toISOString().slice(0, 10)}`, kind: 'source', title: `${name} is not responding`, body: `Failed ${r.fails} runs in a row: ${r.error ?? 'unknown error'}` });
  if (r.ok && r.found === 0 && (r.prevFound ?? 0) >= 5) push({ dedupe: `health:${id}:empty:${new Date().toISOString().slice(0, 10)}`, kind: 'source', title: `${name} returned no jobs`, body: 'Its page layout may have changed. Check the source in Settings.' });
}
