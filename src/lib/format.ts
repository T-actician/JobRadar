import type { Job } from '../types';

export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });

export function timeAgo(iso: string): string {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 60) return `${m || 1} min ago`;
  if (m < 1440) return `${Math.floor(m / 60)} h ago`;
  return `${Math.floor(m / 1440)} d ago`;
}

export const salaryText = (j: Job): string =>
  j.salaryMin === null && j.salaryMax === null
    ? 'Not specified'
    : `KES ${(j.salaryMin ?? j.salaryMax)!.toLocaleString()}${j.salaryMin !== null && j.salaryMax !== null ? ` – ${j.salaryMax.toLocaleString()}` : ''} / month`;

export const expText = (j: Job): string => (j.expMin === null ? 'Not specified' : j.expMin === 0 ? 'No experience' : `${j.expMin}+ years`);

export const deadlineText = (j: Job, left: number | null): string =>
  j.deadline === null ? 'Not specified' : `${fmtDate(j.deadline)} (${left === 0 ? 'today' : `${left}d left`})`;

export const openExternal = (url: string) => {
  if (window.jobradar) void window.jobradar.openExternal(url);
  else window.open(url, '_blank', 'noopener');
};
