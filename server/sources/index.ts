import { type Adapter, crawlListing, wpFeed } from './base';
import { brightermondayCard, careerPointTitle } from './parsers';

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
      parseCard: brightermondayCard,
    }),
  },
  {
    id: 'careerpoint', name: 'Career Point Kenya', homepage: 'https://www.careerpointkenya.co.ke/', kind: 'feed',
    run: (ctx) => wpFeed(ctx, { source: 'Career Point Kenya', base: 'https://www.careerpointkenya.co.ke', parseTitle: careerPointTitle, detail: true }),
  },
  {
    id: 'openedcareer', name: 'Opened Career', homepage: 'https://openedcareer.com/', kind: 'feed',
    run: (ctx) => wpFeed(ctx, { source: 'Opened Career', base: 'https://openedcareer.com' }),
  },
];
