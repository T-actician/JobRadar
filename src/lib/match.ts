import { eduRank } from '../constants';
import type { AppRecord, Job, MatchPart, MatchResult, Profile } from '../types';
import { isExpired } from './filters';
import { findSkills, skillCategories } from './skills';

const W = { skills: 40, field: 25, experience: 15, education: 10, location: 10 } as const;

export const hasProfile = (p: Profile): boolean => p.skills.length > 0 || p.categories.length > 0 || p.years !== null || !!p.education || p.counties.length > 0 || p.remoteOk;

const cache = new WeakMap<Job, string[]>();
/** Skills from the built-in list that the job text mentions. */
export function jobSkills(job: Job): string[] {
  let s = cache.get(job);
  if (!s) {
    s = findSkills([job.title, job.requirements.join('\n'), job.responsibilities.join('\n'), job.description, job.skills.join(' ')].join('\n'));
    cache.set(job, s);
  }
  return s;
}

/**
 * Estimates how well a job fits a profile, from 0 to 100. Only parts that can be compared count: if the job does not state
 * its experience or education, that part is left out instead of lowering the score. It is a guide, never an eligibility decision.
 */
export function scoreJob(job: Job, p: Profile): MatchResult | null {
  if (!hasProfile(p)) return null;
  const notes: string[] = [];
  let matched: string[] = [];
  let missing: string[] = [];

  // Skills: how many of the skills the job mentions are on the profile
  let skills: number | null = null;
  const req = jobSkills(job);
  if (p.skills.length && req.length >= 2) {
    const mine = new Set(p.skills);
    matched = req.filter((x) => mine.has(x));
    missing = req.filter((x) => !mine.has(x));
    skills = matched.length / req.length;
  }

  // Field of work: a selected category counts fully, one implied by the skills counts partly
  let field: number | null = null;
  const chosen = new Set(p.categories);
  const implied = new Set(p.skills.flatMap(skillCategories));
  if (chosen.size || implied.size) {
    field = chosen.has(job.category) ? 1 : implied.has(job.category) ? 0.6 : 0;
    notes.push(field === 1 ? `${job.category} is one of your selected fields.` : field > 0 ? `${job.category} fits your skills.` : `${job.category} is outside your selected fields.`);
  }

  // Experience
  let experience: number | null = null;
  if (p.years !== null && job.expMin !== null) {
    if (job.expMin === 0) {
      experience = p.years >= 5 ? 0.6 : 1;
      if (p.years >= 5) notes.push('Entry-level role: you may be over-qualified.');
    } else {
      experience = Math.min(1, p.years / job.expMin);
      notes.push(p.years >= job.expMin ? `Asks for ${job.expMin}+ years; you have ${p.years}.` : `Asks for ${job.expMin}+ years; you have ${p.years}, a gap of ${+(job.expMin - p.years).toFixed(1)}.`);
    }
  }

  // Education
  let education: number | null = null;
  const need = eduRank(job.education);
  const have = eduRank(p.education);
  if (need > 0 && have > 0) {
    education = have >= need ? 1 : have === need - 1 ? 0.4 : 0;
    notes.push(have >= need ? `Education requirement met (${job.education}).` : `Asks for ${job.education}; you listed ${p.education}.`);
  }

  // Location
  let location: number | null = null;
  if (p.counties.length || p.remoteOk) {
    if (job.mode === 'Remote' && p.remoteOk) location = 1;
    else if (job.county && job.county !== 'Not specified') location = p.counties.includes(job.county) ? 1 : 0;
    if (location !== null) notes.push(location === 1 ? (job.mode === 'Remote' ? 'Remote role.' : `Located in ${job.county}, one of your preferred counties.`) : `Located in ${job.county}, outside your preferred counties.`);
  }

  const parts: MatchPart[] = [
    { key: 'skills', label: 'Skills', score: skills, weight: W.skills },
    { key: 'field', label: 'Field of work', score: field, weight: W.field },
    { key: 'experience', label: 'Experience', score: experience, weight: W.experience },
    { key: 'education', label: 'Education', score: education, weight: W.education },
    { key: 'location', label: 'Location', score: location, weight: W.location },
  ];
  const used = parts.filter((x) => x.score !== null);
  const weight = used.reduce((s, x) => s + x.weight, 0);
  if (!weight) return null;
  const score = Math.round((100 * used.reduce((s, x) => s + x.weight * (x.score as number), 0)) / weight);
  return { score, confidence: weight / 100, mode: p.skills.length ? 'cv' : 'preferences', matched, missing, notes, parts };
}

export interface Rec { job: Job; match: MatchResult | null; rank: number; reason: string }
export interface RecContext { saved: string[]; recent: string[]; apps: Record<string, AppRecord> }

/**
 * Jobs worth a look: the profile match, nudged up for fields the person has saved, applied to or opened, and for fresh postings.
 * Jobs already saved or applied to, expired jobs and jobs with scam warnings are left out.
 */
export function recommend(jobs: Job[], p: Profile, ctx: RecContext, limit = 30): Rec[] {
  const byId = new Map(jobs.map((j) => [j.id, j]));
  const aff = new Map<string, number>();
  const bump = (ids: string[], w: number) => ids.forEach((id) => { const c = byId.get(id)?.category; if (c) aff.set(c, (aff.get(c) ?? 0) + w); });
  bump(ctx.saved, 3); bump(Object.keys(ctx.apps), 4); bump(ctx.recent, 1);
  const top = Math.max(0, ...aff.values());
  const skip = new Set([...ctx.saved, ...Object.keys(ctx.apps)]);

  const recs: Rec[] = [];
  for (const job of jobs) {
    if (skip.has(job.id) || isExpired(job) || job.flags.length) continue;
    const match = scoreJob(job, p);
    const boost = top ? (12 * (aff.get(job.category) ?? 0)) / top : 0;
    if ((match?.score ?? 0) < 35 && boost < 6) continue;
    const age = (Date.now() - new Date(job.published).getTime()) / 864e5;
    const fresh = age <= 3 ? 8 : age <= 7 ? 5 : age <= 30 ? 2 : 0;
    const why: string[] = [];
    if (match?.matched.length) why.push(`Matches ${match.matched.length} of your skills (${match.matched.slice(0, 3).join(', ')})`);
    else if (match && match.parts.find((x) => x.key === 'field')?.score === 1) why.push('In a field you selected');
    if (boost >= 6) why.push('Similar to jobs you saved, opened or applied to');
    recs.push({ job, match, rank: (match?.score ?? 0) * 0.8 + boost + fresh, reason: why.join('. ') || 'Recently posted' });
  }
  return recs.sort((a, b) => b.rank - a.rank || b.job.published.localeCompare(a.job.published)).slice(0, limit);
}
