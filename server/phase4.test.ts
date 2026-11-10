process.env.JOBRADAR_QUIET = '1';
process.env.JOBRADAR_DATA_DIR = `${process.cwd()}/data-test-p4-${process.pid}`;

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { after, before, test } from 'node:test';
import { emptyFilters } from '../src/lib/filters';
import type { Job } from '../src/types';
import { addNotification, closeDb, kvGet, kvSet, listNotifications, openDb, upsertJob } from './db';
import { deadlineReminders, notifyNewJobs, sendDigests, sourceHealth } from './notify';
import { nextDue } from './scheduler';

const ahead = (d: number) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
const job = (id: string, o: Partial<Job> = {}): Job => ({
  id, title: `Job ${id}`, employer: 'Acme', category: 'Electrical Engineering', type: 'Full-time', level: 'Junior', levelInferred: false, expMin: 1,
  county: 'Nairobi', town: 'Nairobi', mode: 'On-site', salaryMin: null, salaryMax: null, deadline: ahead(20), published: new Date().toISOString(),
  collected: new Date().toISOString(), lastVerified: null, source: 'Test', sourceUrl: `https://x.test/${id}`, applyUrl: `https://x.test/${id}`, education: null,
  description: 'x', responsibilities: [], requirements: [], skills: [], status: 'active', flags: [], ...o,
});

before(async () => { await openDb(`${process.env.JOBRADAR_DATA_DIR}/test.db`); });
after(() => { closeDb(); fs.rmSync(process.env.JOBRADAR_DATA_DIR!, { recursive: true, force: true }); });

test('schedule: never-run is due, interval respected, failures retry sooner', () => {
  const now = Date.now();
  const ago = (m: number) => new Date(now - m * 60_000).toISOString();
  assert.equal(nextDue({ last_run: null, fails: 0 }, 60), 0);
  assert.ok(nextDue({ last_run: ago(30), fails: 0 }, 60) > now);
  assert.ok(nextDue({ last_run: ago(61), fails: 0 }, 60) <= now);
  assert.ok(nextDue({ last_run: ago(6), fails: 1 }, 60) <= now, 'first failure retries after 5 min');
  assert.ok(nextDue({ last_run: ago(10), fails: 2 }, 60) > now, 'second failure waits 15 min');
  assert.ok(nextDue({ last_run: ago(1), fails: 0 }, 1) > now, 'interval never below the 15 min floor');
});

test('instant alert: matching new jobs notify once, repeats are ignored', () => {
  kvSet('searches', [{ id: 'a1', name: 'Electrical Nairobi', notify: true, frequency: 'instant', filters: { ...emptyFilters, category: 'Electrical Engineering', county: 'Nairobi' } },
    { id: 'a2', name: 'Off', notify: false, filters: emptyFilters }]);
  const hits = [job('m1'), job('m2'), job('other', { category: 'Accounting' })];
  assert.equal(notifyNewJobs(hits), 1);
  assert.equal(notifyNewJobs(hits), 0, 'same jobs, no duplicate');
  const n = listNotifications().find((x) => x.kind === 'match')!;
  assert.match(n.title, /2 new jobs/);
  assert.equal(n.delivered, false);
});

test('daily alert waits for the digest, then sends one summary', () => {
  kvSet('searches', [{ id: 'd1', name: 'Daily IT', notify: true, frequency: 'daily', filters: { ...emptyFilters, category: 'Information Technology' } }]);
  upsertJob(job('it1', { category: 'Information Technology' }));
  assert.equal(notifyNewJobs([job('it1', { category: 'Information Technology' })]), 0);
  kvSet('prefs', { digestHour: 0 });
  assert.equal(sendDigests(new Date()), 1);
  assert.equal(sendDigests(new Date()), 0, 'only once per day');
});

test('deadline reminders: saved + open applications, stepped, never repeated, none for applied', () => {
  upsertJob(job('s1', { deadline: ahead(1) }));
  upsertJob(job('s2', { deadline: ahead(10) }));
  upsertJob(job('s3', { deadline: ahead(2) }));
  kvSet('saved', ['s1', 's2']);
  kvSet('apps', { s3: { status: 'Applied', date: '', contact: '', notes: '' } });
  assert.equal(deadlineReminders(), 1, 's1 closes tomorrow; s2 is far off; s3 already applied');
  assert.equal(deadlineReminders(), 0);
  kvSet('apps', { s3: { status: 'Preparing Application', date: '', contact: '', notes: '' } });
  assert.equal(deadlineReminders(), 1, 'still preparing, so remind');
});

test('notifications switched off are stored silently (listed in-app, no pop-up)', () => {
  kvSet('prefs', { notify: false, digestHour: 0 });
  assert.equal(addNotification({ dedupe: 'x1', kind: 'source', title: 't', body: 'b', silent: true }), true);
  assert.equal(listNotifications().find((n) => n.title === 't')!.delivered, true);
  upsertJob(job('s9', { deadline: ahead(0) }));
  kvSet('saved', ['s9']);
  deadlineReminders();
  assert.equal(listNotifications().find((n) => n.title === 'Deadline: Job s9')!.delivered, true);
  assert.equal(kvGet<{ notify: boolean }>('prefs')!.notify, false);
});

test('source health: warns on the 3rd failure and on a sudden empty result', () => {
  sourceHealth('Src', 'src', { ok: false, found: 0, fails: 2, prevFound: 10, error: 'boom' });
  assert.equal(listNotifications().filter((n) => n.kind === 'source' && n.title.includes('Src')).length, 0);
  sourceHealth('Src', 'src', { ok: false, found: 0, fails: 3, prevFound: 10, error: 'boom' });
  sourceHealth('Src2', 'src2', { ok: true, found: 0, fails: 0, prevFound: 20, error: null });
  assert.equal(listNotifications().filter((n) => n.kind === 'source' && /Src/.test(n.title)).length, 2);
});
