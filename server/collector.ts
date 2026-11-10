import { MAX_NEW_PER_RUN } from './config';
import { getState, knownUrls, saveRun, touchSeen, upsertJob } from './db';
import { log } from './log';
import { normalizeJob } from './normalize';
import { notifyNewJobs, sourceHealth } from './notify';
import type { Job } from '../src/types';
import { ADAPTERS } from './sources';

export interface RunResult { id: string; name: string; ok: boolean; found: number; added: number; updated: number; error: string | null; ms: number }
let running = false;
export const isRunning = () => running;

export async function runSource(id: string): Promise<RunResult> {
  const a = ADAPTERS.find((x) => x.id === id)!;
  const t0 = Date.now();
  const known = knownUrls(a.name);
  const prevFound = getState(id).last_found;
  const addedJobs: Job[] = [];
  log(`Collecting from ${a.name}...`);
  try {
    const out = await a.run({ known, maxNew: MAX_NEW_PER_RUN, log });
    let added = 0, updated = 0;
    for (const raw of out.jobs) {
      try {
        const job = normalizeJob(raw);
        const r = upsertJob(job);
        if (r === 'added') { added++; addedJobs.push(job); } else if (r === 'updated') updated++;
      } catch (e) { log(`${a.name}: could not store "${raw.title}": ${(e as Error).message}`, 'warn'); }
    }
    touchSeen(a.name, out.seen);
    saveRun(id, { ok: true, found: out.seen.length, added, error: null });
    log(`${a.name}: ${out.seen.length} listings seen, ${added} new, ${updated} updated`);
    notifyNewJobs(addedJobs);
    sourceHealth(a.name, id, { ok: true, found: out.seen.length, fails: 0, prevFound, error: null });
    return { id, name: a.name, ok: true, found: out.seen.length, added, updated, error: null, ms: Date.now() - t0 };
  } catch (e) {
    const msg = (e as Error).message;
    saveRun(id, { ok: false, found: 0, added: 0, error: msg });
    log(`${a.name} failed: ${msg}`, 'error');
    sourceHealth(a.name, id, { ok: false, found: 0, fails: getState(id).fails, prevFound, error: msg });
    return { id, name: a.name, ok: false, found: 0, added: 0, updated: 0, error: msg, ms: Date.now() - t0 };
  }
}

/** Runs enabled sources one after another. Returns false if a run is already in progress. */
export async function runAll(only?: string | string[]): Promise<RunResult[] | null> {
  const ids = only === undefined ? null : ([] as string[]).concat(only);
  if (running) return null;
  running = true;
  try {
    const out: RunResult[] = [];
    for (const a of ADAPTERS) {
      if (ids && !ids.includes(a.id)) continue;
      if (!ids && !getState(a.id).enabled) continue;
      out.push(await runSource(a.id));
    }
    log(`Collection finished: ${out.filter((r) => r.ok).length}/${out.length} sources OK, ${out.reduce((n, r) => n + r.added, 0)} new jobs`);
    return out;
  } finally { running = false; }
}
