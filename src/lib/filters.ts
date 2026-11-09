import { EXP_BUCKETS } from '../constants';
import type { Filters, Job, Sort } from '../types';

export const emptyFilters: Filters = { q: '', category: '', type: '', level: '', exp: '', county: '', mode: '', source: '', education: '', posted: '', closing: '', salary: '', company: '' };

const HOUR = 36e5;
const DAY = 864e5;

export const daysLeft = (deadline: string | null): number | null =>
  deadline === null ? null : Math.floor((new Date(`${deadline}T23:59:59`).getTime() - Date.now()) / DAY);

export const isExpired = (j: Job) => j.status === 'expired' || (daysLeft(j.deadline) ?? 0) < 0;
export const isNew = (j: Job) => Date.now() - new Date(j.collected).getTime() <= 24 * HOUR;

export function postedOk(j: Job, p: string): boolean {
  const t = new Date(j.published);
  const age = Date.now() - t.getTime();
  if (p === 'today') return t.toDateString() === new Date().toDateString();
  const limit = { '24h': 24 * HOUR, '3d': 3 * DAY, '7d': 7 * DAY, '30d': 30 * DAY }[p];
  return limit === undefined || age <= limit;
}

const haystack = (j: Job) => [j.title, j.employer, j.category, j.skills.join(' '), j.description, j.requirements.join(' ')].join(' ').toLowerCase();
const tokens = (q: string) => q.toLowerCase().split(/\s+/).filter(Boolean);

export function applyFilters(jobs: Job[], f: Filters): Job[] {
  const toks = tokens(f.q);
  const company = f.company.trim().toLowerCase();
  const exp = f.exp ? EXP_BUCKETS[f.exp] : null;
  const minSalary = Number(f.salary) || 0;
  return jobs.filter((j) => {
    if (isExpired(j)) return false;
    if (f.category && j.category !== f.category) return false;
    if (f.type && j.type !== f.type) return false;
    if (f.level && j.level !== f.level) return false;
    if (f.county && j.county !== f.county) return false;
    if (f.mode && j.mode !== f.mode) return false;
    if (f.source && j.source !== f.source) return false;
    if (f.education && j.education !== f.education) return false;
    if (company && !j.employer.toLowerCase().includes(company)) return false;
    if (exp && (j.expMin === null || j.expMin < exp[0] || j.expMin > exp[1])) return false;
    if (minSalary && (j.salaryMax === null || j.salaryMax < minSalary)) return false;
    if (f.posted && !postedOk(j, f.posted)) return false;
    if (f.closing) {
      const d = daysLeft(j.deadline);
      if (d === null || d > (f.closing === 'week' ? 7 : 30)) return false;
    }
    if (toks.length) {
      const h = haystack(j);
      if (!toks.every((t) => h.includes(t))) return false;
    }
    return true;
  });
}

function score(j: Job, q: string): number {
  return tokens(q).reduce((s, t) => s + (j.title.toLowerCase().includes(t) ? 5 : 0) + (j.employer.toLowerCase().includes(t) ? 3 : 0) + (j.skills.some((k) => k.toLowerCase().includes(t)) ? 2 : 0) + (j.description.toLowerCase().includes(t) ? 1 : 0), 0);
}

export function sortJobs(jobs: Job[], sort: Sort, q: string): Job[] {
  const t = (j: Job) => new Date(j.published).getTime();
  const a = [...jobs];
  if (sort === 'newest') a.sort((x, y) => t(y) - t(x));
  else if (sort === 'oldest') a.sort((x, y) => t(x) - t(y));
  else if (sort === 'closing') a.sort((x, y) => (daysLeft(x.deadline) ?? 9999) - (daysLeft(y.deadline) ?? 9999));
  else a.sort((x, y) => score(y, q) - score(x, q) || t(y) - t(x));
  return a;
}

export const summarize = (f: Filters) => Object.entries(f).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(', ') || 'no filters';
