import { ADAPTERS } from './sources';
import { MIN_INTERVAL_MIN, TICK_MS } from './config';
import { getState, type SourceState } from './db';
import { isRunning, runAll } from './collector';
import { deadlineReminders, getPrefs, sendDigests } from './notify';
import { log } from './log';

const BACKOFF_MIN = [5, 15, 30];

/** When is this source next due? Failed sources retry sooner (5, 15, 30 min) before falling back to their normal interval. */
export function nextDue(s: Pick<SourceState, 'last_run' | 'fails'>, intervalMin: number): number {
  if (!s.last_run) return 0;
  const every = Math.max(MIN_INTERVAL_MIN, intervalMin);
  const wait = s.fails > 0 ? Math.min(every, BACKOFF_MIN[Math.min(s.fails, 3) - 1]) : every;
  return new Date(s.last_run).getTime() + wait * 60_000;
}

export function dueSources(now = Date.now()): string[] {
  const p = getPrefs();
  return ADAPTERS.filter((a) => !a.needsKey || process.env[a.needsKey]).filter((a) => {
    const s = getState(a.id);
    return s.enabled && nextDue(s, p.intervals[a.id] ?? p.defaultInterval) <= now;
  }).map((a) => a.id);
}

let timer: NodeJS.Timeout | null = null;
async function tick(): Promise<void> {
  try {
    if (!isRunning()) { const due = dueSources(); if (due.length) { log(`Scheduler: ${due.length} source(s) due`); await runAll(due); } }
    deadlineReminders();
    sendDigests();
  } catch (e) { log(`Scheduler error: ${(e as Error).message}`, 'error'); }
}
export function startScheduler(): void {
  if (timer) return;
  log(`Scheduler started (checks every ${Math.round(TICK_MS / 1000)}s)`);
  void tick();
  timer = setInterval(() => void tick(), TICK_MS);
}
export const stopScheduler = (): void => { if (timer) clearInterval(timer); timer = null; };
