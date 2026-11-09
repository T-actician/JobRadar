import * as cheerio from 'cheerio';
import { absUrl, htmlToText, parseDetailPage } from '../extract';
import { findDeadline } from '../normalize';
import { politeFetch, RobotsBlocked } from '../http';
import type { RawJob } from '../normalize';

export interface RunCtx { known: Set<string>; maxNew: number; log: (m: string, level?: 'info' | 'warn' | 'error') => void }
export interface RunOut { jobs: RawJob[]; seen: string[] }
export interface Adapter {
  id: string;
  name: string;
  homepage: string;
  kind: 'api' | 'feed' | 'html';
  /** env var required for this source, if any */
  needsKey?: string;
  run(ctx: RunCtx): Promise<RunOut>;
}

const JOB_WORDS = /vacanc|job|intern|attach|trainee|officer|manager|engineer|analyst|assistant|developer|technician|recruit|hiring|career|opportunit|graduate|apprentice|driver|nurse|teacher|accountant|specialist|coordinator|consultant|director|supervisor|administrator|executive|lecturer|clerk|programme/i;
const NOT_JOB = /scholarship|bursary|results?\b|admission|how to|tips|\bcv\b|resume|interview|scam|fellowship|past papers|kcse|kcpe|intake|cut[- ]?off/i;
export const looksLikeJob = (s: string): boolean => JOB_WORDS.test(s) && !NOT_JOB.test(s);

/** Fetches listing pages, finds job links, and fetches only NEW detail pages. */
export async function crawlListing(ctx: RunCtx, o: {
  source: string; listUrls: string[]; isJobLink: (url: URL) => boolean; followNext?: number;
  /** optional: read employer/location/type/salary from the listing card text */
  parseCard?: (lines: string[], title: string) => Partial<RawJob>;
}): Promise<RunOut> {
  const links = new Map<string, string>();
  const cards = new Map<string, Partial<RawJob>>();
  const queue = [...o.listUrls];
  let nextBudget = o.followNext ?? 0;
  let pagesOk = 0;
  while (queue.length) {
    const page = queue.shift()!;
    try {
      const $ = cheerio.load(await politeFetch(page));
      pagesOk++;
      $('a[href]').each((_, a) => {
        const u = absUrl($(a).attr('href') ?? '', page);
        if (!u || !o.isJobLink(new URL(u)) || links.has(u)) return;
        const text = $(a).text().replace(/\s+/g, ' ').trim();
        links.set(u, text);
        if (!o.parseCard || !text) return;
        // climb to the largest ancestor that still contains only this one job link: that is the card
        let card = $(a);
        for (let i = 0; i < 8; i++) {
          const p = card.parent();
          if (!p.length || p.is('body')) break;
          const hrefs = new Set(p.find('a[href]').map((__, x) => absUrl($(x).attr('href') ?? '', page)).get().filter((h): h is string => !!h && o.isJobLink(new URL(h))));
          if (hrefs.size > 1) break;
          card = p;
        }
        cards.set(u, o.parseCard(htmlToText(card.html() ?? '').split('\n'), text));
      });
      const next = $('a[rel="next"]').attr('href') ?? $('.pagination .next a, li.next a, a.next').first().attr('href');
      const nu = next && absUrl(next, page);
      if (nu && nextBudget > 0 && !queue.includes(nu) && nu !== page) { queue.push(nu); nextBudget--; }
    } catch (e) {
      ctx.log(`${o.source}: listing ${page} failed: ${(e as Error).message}`, e instanceof RobotsBlocked ? 'warn' : 'error');
    }
  }
  if (!pagesOk) throw new Error('None of the listing pages could be fetched');
  if (!links.size) throw new Error('Listing pages loaded but no job links were found (the site layout may have changed)');

  const seen = [...links.keys()];
  const fresh = seen.filter((u) => !ctx.known.has(u)).slice(0, ctx.maxNew);
  ctx.log(`${o.source}: ${seen.length} links, ${fresh.length} new to fetch`);
  const jobs: RawJob[] = [];
  for (const url of fresh) {
    try {
      const d = parseDetailPage(await politeFetch(url));
      const title = d.title || links.get(url) || '';
      if (!title) continue;
      const c = cards.get(url) ?? {};
      jobs.push({ source: o.source, url, ...d, title,
        ...(c.employer ? { employer: c.employer } : {}), ...(c.location ? { location: c.location } : {}),
        ...(c.typeText ? { typeText: c.typeText } : {}), ...(c.salaryText ? { salaryText: c.salaryText } : {}), verified: true });
    } catch (e) {
      ctx.log(`${o.source}: skipped ${url}: ${(e as Error).message}`, 'warn');
    }
  }
  return { jobs, seen };
}

/** WordPress job blogs: RSS feed first, WP REST API as fallback. */
export async function wpFeed(ctx: RunCtx, o: {
  source: string; base: string; pages?: number;
  parseTitle?: (t: string) => { title: string; employer?: string };
  /** fetch the post page when the feed text has no deadline (feeds are often truncated) */
  detail?: boolean;
}): Promise<RunOut> {
  const jobs: RawJob[] = [];
  const seen: string[] = [];
  const pages = o.pages ?? 2;
  let feedOk = false;
  for (let p = 1; p <= pages; p++) {
    try {
      const xml = await politeFetch(`${o.base}/feed/${p > 1 ? `?paged=${p}` : ''}`);
      const $ = cheerio.load(xml, { xmlMode: true });
      const items = $('item');
      feedOk = true;
      items.each((_, el) => {
        const it = $(el);
        const url = absUrl(it.find('link').first().text().trim(), o.base);
        const title = it.find('title').first().text().trim();
        const cats = it.find('category').map((__, c) => $(c).text()).get().join(', ');
        if (!url || !title || seen.includes(url) || !looksLikeJob(`${title} ${cats}`)) return;
        seen.push(url);
        if (ctx.known.has(url) || jobs.length >= ctx.maxNew * 2) return;
        const html = it.find('content\\:encoded').first().text() || it.find('description').first().text();
        const pt = o.parseTitle?.(title) ?? { title };
        jobs.push({ source: o.source, url, title: pt.title, employer: pt.employer, postedAt: it.find('pubDate').first().text(), categoryText: cats, description: htmlToText(html) });
      });
      if (!items.length) break;
    } catch (e) {
      ctx.log(`${o.source}: feed page ${p} failed: ${(e as Error).message}`, 'warn');
      break;
    }
  }
  if (feedOk) {
    if (o.detail) {
      let n = 0;
      for (const j of jobs) {
        if (n >= ctx.maxNew) break;
        if (findDeadline(j.description ?? '')) continue;
        n++;
        try {
          const d = parseDetailPage(await politeFetch(j.url));
          if ((d.description?.length ?? 0) > (j.description?.length ?? 0)) j.description = d.description;
          if (d.deadline) j.deadline = d.deadline;
          j.verified = true;
        } catch (e) { ctx.log(`${o.source}: detail ${j.url} failed: ${(e as Error).message}`, 'warn'); }
      }
    }
    return { jobs, seen };
  }

  ctx.log(`${o.source}: RSS unavailable, trying WordPress REST API`);
  const raw = await politeFetch(`${o.base}/wp-json/wp/v2/posts?per_page=40&_fields=link,title,date_gmt,content`);
  for (const p of JSON.parse(raw) as { link: string; title: { rendered: string }; date_gmt: string; content: { rendered: string } }[]) {
    const title = htmlToText(p.title.rendered);
    if (!looksLikeJob(title)) continue;
    seen.push(p.link);
    if (!ctx.known.has(p.link)) jobs.push({ source: o.source, url: p.link, title, postedAt: `${p.date_gmt}Z`, description: htmlToText(p.content.rendered) });
  }
  return { jobs, seen };
}
