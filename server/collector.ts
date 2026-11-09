import { MAX_NEW_PER_RUN } from './config';
import { getState, knownUrls, saveRun, touchSeen, upsertJob } from './db';
import { log } from './log';
import { normalizeJob } from './normalize';
import { ADAPTERS } from './sources';

export interface RunResult { id: string; name: string; ok: boolean; found: number; added: number; updated: number; error: string | null; ms: number }
let running = false;
export const isRunning = () => running;

export async function runSource(id: string): Promise<RunResult> {
  const a = ADAPTERS.find((x) => x.id === id)!;
  const t0 = Date.now();
  const known = knownUrls(a.name);
  log(`Collecting from ${a.name}...`);
  try {
    const out = await a.run({ known, maxNew: MAX_NEW_PER_RUN, log });
    let added = 0, updated = 0;
    for (const raw of out.jobs) {
      try {
        const r = upsertJob(normalizeJob(raw));
        if (r === 'added') added++; else if (r === 'updated') updated++;
      } catch (e) { log(`${a.name}: could not store "${raw.title}": ${(e as Error).message}`, 'warn'); }
    }
    touchSeen(a.name, out.seen);
    saveRun(id, { ok: true, found: out.seen.length, added, error: null });
    log(`${a.name}: ${out.seen.length} listings seen, ${added} new, ${updated} updated`);
    return { id, name: a.name, ok: true, found: out.seen.length, added, updated, error: null, ms: Date.now() - t0 };
  } catch (e) {
    const msg = (e as Error).message;
    saveRun(id, { ok: false, found: 0, added: 0, error: msg });
    log(`${a.name} failed: ${msg}`, 'error');
    return { id, name: a.name, ok: false, found: 0, added: 0, updated: 0, error: msg, ms: Date.now() - t0 };
  }
}

/** Runs enabled sources one after another. Returns false if a run is already in progress. */
export async function runAll(only?: string): Promise<RunResult[] | null> {
  if (running) return null;
  running = true;
  try {
    const out: RunResult[] = [];
    for (const a of ADAPTERS) {
      if (only && a.id !== only) continue;
      if (!only && !getState(a.id).enabled) continue;
      out.push(await runSource(a.id));
    }
    log(`Collection finished: ${out.filter((r) => r.ok).length}/${out.length} sources OK, ${out.reduce((n, r) => n + r.added, 0)} new jobs`);
    return out;
  } finally { running = false; }
}
