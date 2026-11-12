import * as cheerio from 'cheerio';
import type { RawJob } from './normalize';

export function htmlToText(html: string): string {
  const $ = cheerio.load(`<div id="__r">${html}</div>`);
  const root = $('#__r');
  root.find('script,style,noscript,svg,iframe,form,nav,footer').remove();
  root.find('br').replaceWith('\n');
  root.find('li').each((_, el) => { $(el).prepend('• ').append('\n'); });
  root.find('p,div,h1,h2,h3,h4,h5,h6,tr,ul,ol,section,article').each((_, el) => { $(el).append('\n'); });
  return root.text().replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

type Json = Record<string, unknown>;
const flatten = (x: unknown): Json[] => {
  if (!x || typeof x !== 'object') return [];
  if (Array.isArray(x)) return x.flatMap(flatten);
  const o = x as Json;
  return o['@graph'] ? flatten(o['@graph']) : [o];
};
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : undefined);

export function jsonLdJobPostings($: cheerio.CheerioAPI): Json[] {
  const out: Json[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try { out.push(...flatten(JSON.parse($(el).contents().text()))); } catch { /* ignore malformed blocks */ }
  });
  return out.filter((o) => ([] as unknown[]).concat((o['@type'] as unknown) ?? []).includes('JobPosting'));
}

function placeText(loc: unknown): string {
  return flatten(loc).map((l) => {
    const a = (l.address ?? l) as Json;
    const country = typeof a.addressCountry === 'object' ? str((a.addressCountry as Json).name) : str(a.addressCountry);
    return [str(a.addressLocality), str(a.addressRegion), country].filter(Boolean).join(', ');
  }).filter(Boolean).join(' / ');
}

function salaryText(b: unknown): string | undefined {
  if (!b || typeof b !== 'object') return undefined;
  const o = b as Json;
  const v = (o.value ?? {}) as Json;
  const cur = str(o.currency) ?? '';
  const lo = str(v.minValue) ?? str(v.value);
  const hi = str(v.maxValue);
  if (!lo) return undefined;
  return `${cur} ${lo}${hi ? ` - ${hi}` : ''} ${str(v.unitText) ?? ''}`.trim();
}

const BOILERPLATE = /\s*[|–—-]\s*(brightermonday|myjobmag|career point|corporate staffing|jobweb|fuzu|jobs? in kenya|kenya).*$/i;

export function parseDetailPage(html: string): Partial<RawJob> {
  const $ = cheerio.load(html);
  const jp = jsonLdJobPostings($)[0];
  if (jp) {
    const org = jp.hiringOrganization as Json | undefined;
    const types = ([] as unknown[]).concat((jp.employmentType as unknown) ?? []).map(String).join(' ');
    // Some boards (BrighterMonday) put only "Kenya" in JSON-LD but state the real place in their page data.
    let place = placeText(jp.jobLocation);
    const pageData = html.match(/"location_name"\s*:\s*"([^"]{2,40})"/)?.[1];
    if (pageData && (!place || /^(kenya|ke)(\s*,\s*(kenya|ke))*$/i.test(place.trim()))) place = pageData;
    return {
      title: str(jp.title), employer: str(org?.name) ?? str(jp.hiringOrganization),
      postedAt: str(jp.datePosted), deadline: str(jp.validThrough),
      location: [place, jp.jobLocationType === 'TELECOMMUTE' ? 'Remote' : ''].filter(Boolean).join(' '),
      typeText: types, salaryText: salaryText(jp.baseSalary),
      description: htmlToText(str(jp.description) ?? ''),
    };
  }
  const ogTitle = $('meta[property="og:title"]').attr('content');
  const title = ($('h1').first().text() || ogTitle || $('title').text() || '').replace(BOILERPLATE, '').trim();
  let description = '';
  for (const sel of ['.job-description', '.job_description', '[itemprop="description"]', 'article', '.entry-content', '.post-content', 'main', '#content']) {
    const el = $(sel).first();
    if (el.length) { const t = htmlToText(el.html() ?? ''); if (t.length > 200) { description = t; break; } }
  }
  if (!description) description = $('meta[property="og:description"]').attr('content') ?? $('meta[name="description"]').attr('content') ?? '';
  const posted = $('meta[property="article:published_time"]').attr('content') ?? $('time[datetime]').first().attr('datetime');
  return { title, postedAt: posted, description, location: html.match(/"location_name"\s*:\s*"([^"]{2,40})"/)?.[1] };
}

export const absUrl = (href: string, base: string): string | null => {
  try { const u = new URL(href, base); u.hash = ''; for (const k of [...u.searchParams.keys()]) if (/^utm_|^fbclid$/.test(k)) u.searchParams.delete(k); return /^https?:$/.test(u.protocol) ? u.toString() : null; } catch { return null; }
};
