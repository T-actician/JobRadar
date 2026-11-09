import { USER_AGENT } from './config';
import { log } from './log';

export class HttpError extends Error {
  constructor(public status: number, url: string) { super(`HTTP ${status} for ${url}`); }
}
export class RobotsBlocked extends Error {
  constructor(url: string) { super(`Blocked by robots.txt: ${url}`); }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const minGap = () => Number(process.env.JOBRADAR_MIN_GAP_MS ?? 1500);
const chains = new Map<string, Promise<void>>();
const nextAt = new Map<string, number>();

/** Serialises requests per host and keeps a minimum gap between them. */
async function throttle(host: string): Promise<void> {
  const mine = (chains.get(host) ?? Promise.resolve()).then(async () => {
    const wait = (nextAt.get(host) ?? 0) - Date.now();
    if (wait > 0) await sleep(wait);
    nextAt.set(host, Date.now() + minGap());
  });
  chains.set(host, mine.catch(() => undefined));
  await mine;
}

interface Rule { allow: boolean; path: string }
const robotsCache = new Map<string, { rules: Rule[] | 'all-blocked'; at: number }>();

export function parseRobots(txt: string): Rule[] {
  const groups: { agents: string[]; rules: Rule[] }[] = [];
  let cur: { agents: string[]; rules: Rule[] } | null = null;
  let prevAgent = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const i = line.indexOf(':');
    if (!line || i < 0) continue;
    const k = line.slice(0, i).trim().toLowerCase();
    const v = line.slice(i + 1).trim();
    if (k === 'user-agent') {
      if (!cur || !prevAgent) { cur = { agents: [], rules: [] }; groups.push(cur); }
      cur.agents.push(v.toLowerCase());
      prevAgent = true;
    } else if ((k === 'allow' || k === 'disallow') && cur) {
      prevAgent = false;
      if (v) cur.rules.push({ allow: k === 'allow', path: v });
    }
  }
  const g = groups.find((x) => x.agents.includes('jobradar')) ?? groups.find((x) => x.agents.includes('*'));
  return g?.rules ?? [];
}

export function robotsAllows(rules: Rule[], pathAndQuery: string): boolean {
  let best: Rule | null = null;
  let bestLen = -1;
  for (const r of rules) {
    const re = new RegExp('^' + r.path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'));
    if (re.test(pathAndQuery) && (r.path.length > bestLen || (r.path.length === bestLen && r.allow))) { best = r; bestLen = r.path.length; }
  }
  return best ? best.allow : true;
}

async function allowed(url: string): Promise<boolean> {
  const u = new URL(url);
  const key = u.origin;
  let entry = robotsCache.get(key);
  if (!entry || Date.now() - entry.at > 12 * 36e5) {
    let rules: Rule[] | 'all-blocked' = [];
    try {
      await throttle(u.host);
      const res = await fetch(`${key}/robots.txt`, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(10000) });
      if (res.ok) rules = parseRobots(await res.text());
      else if (res.status >= 500) rules = 'all-blocked';
    } catch (e) {
      log(`robots.txt unreachable for ${u.host} (${(e as Error).message}); continuing politely`, 'warn');
    }
    entry = { rules, at: Date.now() };
    robotsCache.set(key, entry);
  }
  return entry.rules === 'all-blocked' ? false : robotsAllows(entry.rules, u.pathname + u.search);
}

export interface FetchOpts { robots?: boolean; headers?: Record<string, string>; retries?: number; method?: 'GET' | 'POST'; body?: string }

export async function politeFetch(url: string, opts: FetchOpts = {}): Promise<string> {
  const { robots = true, retries = 2 } = opts;
  if (robots && !(await allowed(url))) throw new RobotsBlocked(url);
  const host = new URL(url).host;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await throttle(host);
      const res = await fetch(url, {
        method: opts.method ?? 'GET',
        body: opts.body,
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml,application/xml,application/json;q=0.9,*/*;q=0.8', 'Accept-Language': 'en-KE,en;q=0.9', ...opts.headers },
        signal: AbortSignal.timeout(20000),
        redirect: 'follow',
      });
      if (res.status === 429 || res.status >= 500) throw new HttpError(res.status, url);
      if (!res.ok) { const e = new HttpError(res.status, url); (e as { fatal?: boolean }).fatal = true; throw e; }
      const text = await res.text();
      if (text.length > 4_000_000) throw new Error(`Response too large: ${url}`);
      return text;
    } catch (e) {
      lastErr = e;
      if ((e as { fatal?: boolean }).fatal || attempt === retries) break;
      await sleep(2000 * 2 ** attempt);
    }
  }
  throw lastErr;
}
