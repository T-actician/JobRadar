import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { DEFAULT_PROFILE } from '../src/constants';
import { hasProfile, recommend, scoreJob } from '../src/lib/match';
import { detectEducation, detectYears, extractProfile } from '../src/lib/profile';
import { findSkills } from '../src/lib/skills';
import type { Job, Profile } from '../src/types';
import { CvError, parseCv } from './cv';

const ahead = (d: number) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
const job = (id: string, o: Partial<Job> = {}): Job => ({
  id, title: `Job ${id}`, employer: 'Acme', category: 'Electrical Engineering', type: 'Full-time', level: 'Junior', levelInferred: false, expMin: 1,
  county: 'Nairobi', town: 'Nairobi', mode: 'On-site', salaryMin: null, salaryMax: null, deadline: ahead(20), published: new Date().toISOString(),
  collected: new Date().toISOString(), lastVerified: null, source: 'Test', sourceUrl: 'https://x.test', applyUrl: 'https://x.test', education: "Bachelor's degree",
  description: 'Needs Power Systems, AutoCAD and SCADA knowledge.', responsibilities: [], requirements: [], skills: [], status: 'active', flags: [], ...o,
});
const me: Profile = { ...DEFAULT_PROFILE, hasCv: true, skills: ['Power Systems', 'AutoCAD', 'MATLAB'], categories: ['Electrical Engineering'], years: 2, yearsSource: 'stated', education: "Bachelor's degree", counties: ['Nairobi'] };

test('skills: aliases, punctuation-heavy names and look-alikes', () => {
  const s = findSkills('Proficient in C++, Node.js and PostgreSQL. Also JavaScript, MySQL, ASP.NET and MS Project. Not a java developer.');
  for (const x of ['C++', 'Node.js', 'PostgreSQL', 'JavaScript', 'MySQL', '.NET', 'Project Scheduling', 'Java']) assert.ok(s.includes(x), x);
  assert.ok(!s.includes('SQL'), 'MySQL must not also count as SQL');
  assert.deepEqual(findSkills('We value a swift response and a good attitude'), []);
});

test('education: highest level stated, nothing invented', () => {
  assert.equal(detectEducation('BSc Electrical Engineering; Diploma in IT'), "Bachelor's degree");
  assert.equal(detectEducation('MSc Data Science, BSc Maths'), "Master's degree");
  assert.equal(detectEducation('Worked at a school for 3 years'), '');
});

test('experience: stated beats estimated; study dates are not counted; none means null', () => {
  assert.deepEqual(detectYears('Over 5 years of experience in power systems'), { years: 5, source: 'stated' });
  const cv = 'University of Nairobi BSc 2015 - 2019\nElectrical Technician, ABC Ltd, Jan 2019 - Dec 2021\nEngineer, XYZ 2022 - Present';
  const r = detectYears(cv, 2026);
  assert.equal(r.source, 'estimated');
  assert.ok(r.years! >= 6 && r.years! <= 8, String(r.years));
  assert.deepEqual(detectYears('Fresh graduate, eager to learn'), { years: null, source: '' });
});

test('scoring: strong fit beats weak fit; missing skills are named', () => {
  const good = scoreJob(job('g'), me)!;
  const bad = scoreJob(job('b', { category: 'Accounting', description: 'Needs IFRS, QuickBooks and Auditing.', county: 'Mombasa', education: 'Diploma' }), me)!;
  assert.ok(good.score >= 70, String(good.score));
  assert.ok(bad.score <= 30, String(bad.score));
  assert.deepEqual(good.missing, ['SCADA']);
  assert.deepEqual(good.matched.sort(), ['AutoCAD', 'Power Systems']);
});

test('scoring: information a job does not state never lowers the score', () => {
  const stated = scoreJob(job('s', { expMin: 10 }), me)!;
  const unstated = scoreJob(job('u', { expMin: null, education: null }), me)!;
  assert.ok(unstated.score > stated.score);
  assert.ok(unstated.confidence < 1, 'less to compare means lower confidence');
});

test('scoring: no profile means no score', () => {
  assert.equal(hasProfile(DEFAULT_PROFILE), false);
  assert.equal(scoreJob(job('x'), DEFAULT_PROFILE), null);
});

test('recommendations: skip saved, applied, flagged and expired; rank by fit; use saved jobs as a signal', () => {
  const jobs = [job('best'), job('saved'), job('applied'), job('scam', { flags: ['fee'] }), job('old', { deadline: '2020-01-01' }),
    job('weak', { category: 'Accounting', description: 'Needs IFRS and Auditing.', county: 'Mombasa', education: 'Diploma' })];
  const recs = recommend(jobs, me, { saved: ['saved'], recent: [], apps: { applied: { status: 'Applied', date: '', contact: '', notes: '' } } });
  assert.deepEqual(recs.map((r) => r.job.id), ['best']);
  assert.match(recs[0].reason, /Matches 2 of your skills/);

  const acc = [job('a1', { category: 'Accounting' }), job('a2', { category: 'Accounting' }), job('e1')];
  const byHistory = recommend(acc, DEFAULT_PROFILE, { saved: [], recent: ['a1'], apps: {} });
  assert.deepEqual(byHistory.map((r) => r.job.id).sort(), ['a1', 'a2'], 'no CV: only the field of jobs you opened is suggested');
});

test('CV extraction end to end: DOCX and PDF files give the same details', async () => {
  for (const f of ['cv-sample.docx', 'cv-sample.pdf', 'cv-word.pdf']) {
    const p = extractProfile(await parseCv(f, fs.readFileSync(`server/fixtures/${f}`)), 2026);
    for (const s of ['AutoCAD', 'MATLAB', 'SCADA', 'PLC', 'Python', 'Power Systems']) assert.ok(p.skills.includes(s), `${f}: ${s}`);
    assert.equal(p.education, "Bachelor's degree");
    assert.equal(p.years, 5);
    assert.equal(p.categories[0], 'Electrical Engineering');
  }
});

test('CV upload: clear errors for bad files', async () => {
  await assert.rejects(parseCv('cv.exe', Buffer.from('x'.repeat(60))), CvError);
  await assert.rejects(parseCv('cv.txt', Buffer.from('tiny')), /No readable text/);
  await assert.rejects(parseCv('cv.pdf', Buffer.from('not really a pdf '.repeat(5))), /Could not read/);
  await assert.rejects(parseCv('cv.txt', Buffer.alloc(5_000_001, 97)), /larger than 5 MB/);
});
