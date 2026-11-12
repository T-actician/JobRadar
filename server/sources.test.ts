process.env.JOBRADAR_QUIET = '1';
process.env.JOBRADAR_MIN_GAP_MS = '0';

import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import { normalizeJob } from './normalize';
import { crawlListing, wpFeed } from './sources/base';
import { corporateStaffingTitle } from './sources/parsers';

let srv: http.Server;
let base = '';

const detail = (h1: string) => `<html><head><meta property="article:published_time" content="2026-11-10T08:00:00+00:00"></head><body><h1>${h1} | Corporate Staffing Services</h1>
  <article><p>Responsible for managing small business portfolios and driving growth. Requires a Business or Finance degree and 3 years of banking experience. Full-time role in Nairobi.</p>
  <p>Key responsibilities include sales and service, business management, and risk and control. Application deadline: 28 November 2026. Click here to apply.</p></article></body></html>`;

before(async () => {
  srv = http.createServer((req, res) => {
    const u = req.url ?? '';
    if (u === '/robots.txt') { res.end('User-agent: *\nDisallow: /wp-admin/\n'); return; }
    if (u === '/jobs/' || u === '/jobs/page/2/') {
      res.end(`<main><a href="/job/sme-relationship-manager-job-absa-bank/">x</a><a href="/job/accountant-job-nairobi-kenya-css/">y</a><a href="/job/analyst-job-i-m-bank/">z</a>
        <a href="/jobs/page/2/">next</a><a href="/category/banking-jobs-in-kenya/">cat</a><a href="/cc/register-your-cv-for-free/">cv</a></main>`);
      return;
    }
    if (u.startsWith('/job/sme-relationship')) { res.end(detail('SME Relationship Manager -Voi Job Absa Bank')); return; }
    if (u.startsWith('/job/analyst-job-i-m-bank')) {
      const ld = { '@context': 'https://schema.org', '@type': 'JobPosting', title: 'Credit Analyst Job I&M Bank', datePosted: '2026-11-10', hiringOrganization: { name: 'Corporate Staffing' }, description: '<p>Assess credit applications. Bachelor\'s degree required.</p>' };
      res.end(`<html><head><script type="application/ld+json">${JSON.stringify(ld)}</script></head><body><h1>Credit Analyst Job I&M Bank</h1></body></html>`); return;
    }
    if (u.startsWith('/job/accountant')) { res.end(detail('Accountant Job Nairobi, Kenya')); return; }
    if (u.startsWith('/feed-jw/1')) {
      res.setHeader('content-type', 'application/xml');
      res.end(`<?xml version="1.0"?><rss xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:job_listing="https://wpjobmanager.com"><channel>
        <item><title>Radiographer at CURE International</title><link>${base}/jobs/radiographer-cure-international/</link><pubDate>Mon, 09 Nov 2026 08:00:00 +0000</pubDate><category>Healthcare/Medical Jobs in Kenya</category>
          <job_listing:location>Kijabe</job_listing:location><job_listing:job_type>Full-Time</job_listing:job_type><job_listing:company>CURE International</job_listing:company>
          <content:encoded><![CDATA[<p>Provide diagnostic imaging. Diploma in Radiography required. Deadline: 30th November 2026</p>]]></content:encoded></item>
        <item><title>Submit CVs – New Recruitment at Tom Mboya University</title><link>${base}/jobs/submit-cvs-tmu/</link><category>Graduates Jobs in Kenya</category></item></channel></rss>`);
      return;
    }
    if (u.startsWith('/feed-jw/')) { res.setHeader('content-type', 'application/xml'); res.end('<?xml version="1.0"?><rss><channel></channel></rss>'); return; }
    res.statusCode = 404; res.end('nope');
  });
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
});
after(() => srv.close());

test('Corporate Staffing titles split into role and employer; a place is not an employer', () => {
  assert.deepEqual(corporateStaffingTitle('Marketing Agents- Kilifi Job KMA Sacco'), { title: 'Marketing Agents- Kilifi', employer: 'KMA Sacco' });
  assert.deepEqual(corporateStaffingTitle('Head of Virtual Relationship Management Job I&M Bank'), { title: 'Head of Virtual Relationship Management', employer: 'I&M Bank' });
  assert.deepEqual(corporateStaffingTitle('Accountant Job Nairobi, Kenya'), { title: 'Accountant' });
  assert.deepEqual(corporateStaffingTitle('Treasury Officer'), { title: 'Treasury Officer' });
  assert.deepEqual(corporateStaffingTitle('Legal Operations Associate – Programs NGO Job (450-500K)'), { title: 'Legal Operations Associate – Programs' }, 'pay figure is not an employer');
  assert.deepEqual(corporateStaffingTitle('Accountant - Manufacturing Job 60-75K'), { title: 'Accountant - Manufacturing' });
});

test('Corporate Staffing crawl: only /job/ pages, site name removed from titles, employer and deadline read', async () => {
  const out = await crawlListing({ known: new Set(), maxNew: 10, log: () => undefined }, {
    source: 'Corporate Staffing Services', parseTitle: corporateStaffingTitle, listUrls: [`${base}/jobs/`],
    isJobLink: (u) => /^\/job\/[^/]+\/?$/.test(u.pathname),
  });
  assert.equal(out.seen.length, 3, 'category, CV and pagination links are not jobs');
  const jobs = out.jobs.map((r) => normalizeJob(r));
  const absa = jobs.find((j) => j.employer === 'Absa Bank')!;
  assert.equal(absa.title, 'SME Relationship Manager -Voi');
  assert.equal(absa.deadline, '2026-11-28');
  assert.equal(absa.county, 'Taita-Taveta', 'the title says Voi, which is in Taita-Taveta, and wins over the body text');
  const analyst = jobs.find((j) => j.title === 'Credit Analyst')!;
  assert.equal(analyst.employer, 'I&M Bank', 'the employer in the title beats the agency named in the page data');
  const acc = jobs.find((j) => j.title === 'Accountant')!;
  assert.ok(acc.employer === 'Not specified' || !/nairobi|kenya/i.test(acc.employer), acc.employer);
});

test('JobWeb Kenya feed: company, place and type come from the feed; "Submit CVs" posts are not vacancies', async () => {
  const out = await wpFeed({ known: new Set(), maxNew: 10, log: () => undefined }, {
    source: 'JobWeb Kenya', base, pages: 3, skip: /^(submit|send) cvs?\b/i, feedUrl: (p) => `${base}/feed-jw/${p}`,
  });
  assert.equal(out.jobs.length, 1);
  const j = normalizeJob(out.jobs[0]);
  assert.equal(j.title, 'Radiographer');
  assert.equal(j.employer, 'CURE International');
  assert.equal(j.type, 'Full-time');
  assert.equal(j.deadline, '2026-11-30');
  assert.equal(j.education, 'Diploma');
});
