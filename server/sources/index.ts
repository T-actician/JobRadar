import { politeFetch } from '../http';
import type { RawJob } from '../normalize';
import { type Adapter, crawlListing, wpFeed } from './base';

const sameHost = (host: string) => (u: URL) => u.hostname.replace(/^www\./, '') === host;

export const ADAPTERS: Adapter[] = [
  {
    id: 'myjobmag', name: 'MyJobMag Kenya', homepage: 'https://www.myjobmag.co.ke/', kind: 'html',
    run: (ctx) => crawlListing(ctx, {
      source: 'MyJobMag Kenya', followNext: 2,
      listUrls: ['https://www.myjobmag.co.ke/', 'https://www.myjobmag.co.ke/jobs'],
      isJobLink: (u) => sameHost('myjobmag.co.ke')(u) && /^\/job\/[^/]+/.test(u.pathname),
    }),
  },
  {
    id: 'brightermonday', name: 'BrighterMonday Kenya', homepage: 'https://www.brightermonday.co.ke/', kind: 'html',
    run: (ctx) => crawlListing(ctx, {
      source: 'BrighterMonday Kenya',
      listUrls: [1, 2, 3].map((p) => `https://www.brightermonday.co.ke/jobs${p > 1 ? `?page=${p}` : ''}`),
      isJobLink: (u) => sameHost('brightermonday.co.ke')(u) && /^\/listings\/[^/]+/.test(u.pathname),
    }),
  },
  {
    id: 'careerpoint', name: 'Career Point Kenya', homepage: 'https://www.careerpointkenya.co.ke/', kind: 'feed',
    run: (ctx) => wpFeed(ctx, { source: 'Career Point Kenya', base: 'https://www.careerpointkenya.co.ke' }),
  },
  {
    id: 'openedcareer', name: 'Opened Career', homepage: 'https://openedcareer.com/', kind: 'feed',
    run: (ctx) => wpFeed(ctx, { source: 'Opened Career', base: 'https://openedcareer.com' }),
  },
  {
    id: 'psc', name: 'PSC Kenya', homepage: 'https://www.psckjobs.go.ke/', kind: 'html',
    run: (ctx) => crawlListing(ctx, {
      source: 'PSC Kenya', followNext: 1,
      listUrls: ['https://www.psckjobs.go.ke/'],
      isJobLink: (u) => sameHost('psckjobs.go.ke')(u) && u.pathname.length > 6 && /vacanc|advert|job|position|recruit/i.test(u.pathname) && !/\.(pdf|docx?|xlsx?)$/i.test(u.pathname),
    }),
  },
  {
    id: 'careerjet', name: 'Careerjet', homepage: 'https://www.careerjet.co.ke/', kind: 'api', needsKey: 'CAREERJET_API_KEY',
    async run(ctx) {
      const key = process.env.CAREERJET_API_KEY;
      if (!key) throw new Error('CAREERJET_API_KEY is not set (add it to .env, see .env.example)');
      const ip = process.env.CAREERJET_USER_IP || (await politeFetch('https://api.ipify.org', { robots: false })).trim();
      const auth = `Basic ${Buffer.from(`${key}:`).toString('base64')}`;
      const jobs: RawJob[] = [];
      const seen: string[] = [];
      for (const kw of ['engineer', 'software developer', 'ICT', 'intern', 'attachment', 'graduate trainee', 'technician', 'analyst']) {
        const qs = new URLSearchParams({ locale_code: 'en_KE', keywords: kw, location: 'Kenya', page_size: '30', page: '1', sort: 'date', user_ip: ip, user_agent: 'Mozilla/5.0 JobRadar' });
        try {
          const body = JSON.parse(await politeFetch(`https://search.api.careerjet.net/v4/query?${qs}`, { robots: false, headers: { Authorization: auth, Accept: 'application/json' } })) as { jobs?: Record<string, string>[] };
          for (const j of body.jobs ?? []) {
            if (!j.url || !j.title) continue;
            seen.push(j.url);
            if (ctx.known.has(j.url) || jobs.some((x) => x.url === j.url)) continue;
            jobs.push({ source: 'Careerjet', url: j.url, title: j.title, employer: j.company, postedAt: j.date, location: j.locations, salaryText: j.salary,
              description: [j.site ? `Listed via ${j.site}.` : '', j.description ?? ''].filter(Boolean).join('\n') });
          }
        } catch (e) { ctx.log(`Careerjet "${kw}": ${(e as Error).message}`, 'warn'); }
      }
      if (!seen.length) throw new Error('Careerjet returned no jobs (check the API key and IP settings)');
      return { jobs, seen };
    },
  },
];
