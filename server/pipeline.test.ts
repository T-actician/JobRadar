import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';

process.env.JOBRADAR_QUIET = '1';
process.env.JOBRADAR_MIN_GAP_MS = '0';
process.env.JOBRADAR_DATA_DIR = `${process.cwd()}/data-test-${process.pid}`;

import fs from 'node:fs';
import { closeDb, listJobs, openDb, upsertJob, knownUrls } from './db';
import { crawlListing, wpFeed } from './sources/base';
import { normalizeJob, toDateOnly } from './normalize';
import { parseDetailPage } from './extract';
import { parseRobots, robotsAllows } from './http';
import { brightermondayCard, careerPointTitle } from './sources/parsers';
import { htmlToText } from './extract';

let srv: http.Server;
let base = '';
const jobLd = (extra = '') => `<html><head><script type="application/ld+json">${JSON.stringify({
  '@context': 'https://schema.org', '@type': 'JobPosting', title: 'Graduate Electrical Engineer', datePosted: '2026-11-05',
  validThrough: '2026-12-20', employmentType: 'FULL_TIME', hiringOrganization: { name: 'Nairobi Grid Services' },
  jobLocation: { address: { addressLocality: 'Westlands', addressRegion: 'Nairobi', addressCountry: 'KE' } },
  description: '<p>Rotation across teams.</p><h3>Requirements</h3><ul><li>Bachelor\'s degree in Electrical Engineering</li><li>EBK registration</li></ul>' + extra,
})}</script></head><body><h1>x</h1></body></html>`;

before(async () => {
  srv = http.createServer((req, res) => {
    const u = req.url ?? '';
    if (u === '/robots.txt') { res.end('User-agent: *\nDisallow: /private/\n'); return; }
    if (u === '/jobs') { res.end('<a href="/job/a-1">A</a><a href="/job/b-2">B</a><a href="/about">x</a><a href="/private/job/c">p</a>'); return; }
    if (u === '/cards') { res.end('<main><ul><li><div><h3><a href="/job/a-1">Graduate Electrical Engineer</a></h3><div>Card Employer Ltd</div><div>Posted 1 day ago</div><div>Kisumu Part Time KSh 50,000</div><a href="/job/a-1">Apply</a></div></li><li><div><h3><a href="/job/b-2">Other Role</a></h3><div>Second Co</div><div>Posted 2 days ago</div><div>Nakuru Full Time Confidential</div></div></li></ul></main>'); return; }
    if (u.startsWith('/job/')) { res.end(jobLd()); return; }
    if (u.startsWith('/feed')) {
      res.setHeader('content-type', 'application/xml');
      res.end(`<?xml version="1.0"?><rss xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel>
        <item><title>Electrical Intern at Globeleq</title><link>${base}/electrical-intern-at-globeleq/</link><pubDate>Mon, 09 Nov 2026 08:00:00 +0000</pubDate><category>Engineering</category>
        <content:encoded><![CDATA[<p>Duty Station: Menengai, Nakuru</p><p>Deadline: 20th November 2026</p><ul><li>Diploma in Electrical Engineering</li></ul>]]></content:encoded></item>
        <item><title>KCSE results released</title><link>${base}/kcse/</link></item></channel></rss>`);
      return;
    }
    res.statusCode = 404; res.end('nope');
  });
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
  await openDb();
});
after(() => { srv.close(); closeDb(); fs.rmSync(process.env.JOBRADAR_DATA_DIR!, { recursive: true, force: true }); });

test('dates parse day-first and in words', () => {
  assert.equal(toDateOnly('20th November 2026'), '2026-11-20');
  assert.equal(toDateOnly('Wednesday, October 22 2025'), '2025-10-22');
  assert.equal(toDateOnly('05/11/2026'), '2026-11-05');
  assert.equal(toDateOnly('2026-12-20T00:00'), '2026-12-20');
});

test('robots rules: longest match wins', () => {
  const r = parseRobots('User-agent: *\nDisallow: /private/\nAllow: /private/ok\n');
  assert.equal(robotsAllows(r, '/private/x'), false);
  assert.equal(robotsAllows(r, '/private/ok'), true);
  assert.equal(robotsAllows(r, '/job/1'), true);
});

test('JSON-LD detail page normalises honestly', () => {
  const j = normalizeJob({ source: 'Test', url: `${base}/job/a-1`, ...(parseDetailPage(jobLd()) as { title: string }), verified: true });
  assert.equal(j.employer, 'Nairobi Grid Services');
  assert.equal(j.county, 'Nairobi');
  assert.equal(j.town, 'Westlands');
  assert.equal(j.category, 'Electrical Engineering');
  assert.equal(j.level, 'Graduate');
  assert.equal(j.deadline, '2026-12-20');
  assert.equal(j.type, 'Full-time');
  assert.equal(j.salaryMin, null);
  assert.equal(j.mode, 'Not specified');
  assert.deepEqual(j.requirements, ["Bachelor's degree in Electrical Engineering", 'EBK registration']);
  assert.ok(j.lastVerified);
});

test('listing crawl follows only job links and respects robots', async () => {
  const known = new Set<string>();
  const out = await crawlListing({ known, maxNew: 10, log: () => undefined }, {
    source: 'Test', listUrls: [`${base}/jobs`], isJobLink: (u) => u.pathname.startsWith('/job/') || u.pathname.startsWith('/private/'),
  });
  assert.equal(out.seen.length, 3);
  assert.equal(out.jobs.length, 2, 'the robots-disallowed page must not be fetched');
});

test('WordPress feed: filters non-jobs, extracts deadline and place', async () => {
  const out = await wpFeed({ known: new Set(), maxNew: 10, log: () => undefined }, { source: 'Feed', base });
  assert.equal(out.jobs.length, 1);
  const j = normalizeJob(out.jobs[0]);
  assert.equal(j.title, 'Electrical Intern');
  assert.equal(j.employer, 'Globeleq');
  assert.equal(j.type, 'Internship');
  assert.equal(j.level, 'Internship');
  assert.equal(j.county, 'Nakuru');
  assert.equal(j.deadline, '2026-11-20');
  assert.equal(j.education, 'Diploma');
});

test('database upsert: add, unchanged, updated; known urls skip refetch', () => {
  const j = normalizeJob({ source: 'Test', url: `${base}/job/z`, title: 'Accountant at Foo Ltd', description: 'Deadline: 30 November 2026' });
  assert.equal(upsertJob(j), 'added');
  assert.equal(upsertJob(j), 'same');
  assert.equal(upsertJob({ ...j, description: 'changed' }), 'updated');
  assert.equal(listJobs().find((x) => x.id === j.id)?.status, 'updated');
  assert.ok(knownUrls('Test').has(`${base}/job/z`));
});

test('scam heuristics flag fee requests', () => {
  const j = normalizeJob({ source: 'Test', url: `${base}/s`, title: 'Data Entry', description: 'Pay a registration fee to start. Contact us on WhatsApp.' });
  assert.ok(j.flags.includes('Asks applicants to pay a fee'));
});

test('BrighterMonday card: employer, place, type and salary come from the listing', () => {
  const html = `<div><div class="card"><span>T</span><h3><a href="/listings/x">Marketing Operations Manager</a></h3><div>Cobetwin Technical Limited</div><div>Posted 2 days ago</div>
    <p><a href="/jobs/marketing">Marketing</a> - 3+ years of marketing experience</p><div>Nairobi Full Time KSh 75,000 - 90,000</div><a href="/listings/x">Apply</a></div></div>`;
  const c = brightermondayCard(htmlToText(html).split('\n'), 'Marketing Operations Manager');
  assert.equal(c.employer, 'Cobetwin Technical Limited');
  assert.equal(c.location, 'Nairobi');
  assert.equal(c.typeText, 'Full Time');
  assert.equal(c.salaryText, 'KSh 75,000 - 90,000');
  const conf = brightermondayCard(['Legal Officers', 'Takaful Insurance of Africa', 'Posted 1 week ago', 'Nairobi Full Time Confidential', 'Apply'], 'Legal Officers');
  assert.equal(conf.employer, 'Takaful Insurance of Africa');
  assert.equal(conf.salaryText, undefined);
  const j = normalizeJob({ source: 'BM', url: `${base}/l`, title: 'Marketing Operations Manager', ...c });
  assert.equal(j.salaryMin, 75000);
  assert.equal(j.salaryMax, 90000);
  assert.equal(j.type, 'Full-time');
});

test('Career Point titles split into title and employer', () => {
  assert.deepEqual(careerPointTitle('YDN Director NGO Job CFK Africa'), { title: 'YDN Director', employer: 'CFK Africa' });
  assert.deepEqual(careerPointTitle('Environment & Sustainability Consultant Trainers Job IRES'), { title: 'Environment & Sustainability Consultant Trainers', employer: 'IRES' });
  assert.deepEqual(careerPointTitle('Plain title'), { title: 'Plain title' });
});

test('jobs abroad are flagged, "Job Type:" lines are read', () => {
  const j = normalizeJob({ source: 'T', url: `${base}/d`, title: 'Warehouse Helper (Loading & Unloading) – Dubai, UAE', description: 'Job Type: Contract' });
  assert.ok(j.flags.some((f) => f.startsWith('Job is outside Kenya')));
  assert.equal(j.type, 'Contract');
});

test('crawl merges listing-card data over the detail page', async () => {
  const out = await crawlListing({ known: new Set(), maxNew: 5, log: () => undefined }, {
    source: 'Cards', listUrls: [`${base}/cards`], isJobLink: (u) => u.pathname.startsWith('/job/'), parseCard: brightermondayCard,
  });
  const a = out.jobs.find((j) => j.url.endsWith('a-1'))!;
  assert.equal(a.employer, 'Card Employer Ltd');
  assert.equal(a.location, 'Kisumu');
  assert.equal(a.typeText, 'Part Time');
  const b = out.jobs.find((j) => j.url.endsWith('b-2'))!;
  assert.equal(b.employer, 'Second Co');
  assert.equal(b.location, 'Nakuru');
});
