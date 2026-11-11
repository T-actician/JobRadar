import { EDUCATION } from '../constants';
import type { Profile } from '../types';
import { findSkills, skillCategories } from './skills';

const EDU_PATTERNS: [string, RegExp][] = [
  ['PhD', /\b(ph\.?d|doctorate|doctor of philosophy)\b/i],
  ["Master's degree", /\b(master'?s?|m\.?sc|mba|m\.?eng|mphil)\b/i],
  ["Bachelor's degree", /\b(bachelor'?s?|b\.?sc|b\.?eng|b\.?com|b\.?ed|bba|b\.?tech)\b/i],
  ['Diploma', /\b(diploma|higher national|hnd)\b/i],
  ['Certificate', /\bcertificate\b/i],
];
/** Highest level found, or '' when nothing is stated. */
export function detectEducation(text: string): string {
  return EDU_PATTERNS.find(([, rx]) => rx.test(text))?.[0] ?? '';
}

const STATED = /(\d{1,2})\s*\+?\s*(?:years?|yrs?)(?:'s)?\s+(?:of\s+)?(?:[\w&/-]+\s+){0,4}?experience/gi;
const MON = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?';
const RANGE = new RegExp(`(?:${MON}\\s+|\\d{1,2}/)?((?:19|20)\\d{2})\\s*(?:-|–|—|to|until)\\s*(?:${MON}\\s+|\\d{1,2}/)?((?:19|20)\\d{2}|present|current|date|now|ongoing)`, 'gi');
const STUDY = /\b(diploma|degree|bachelor|master|ph\.?d|university|college|school|certificate|kcse|kcpe|campus|institute)\b/i;
const WORK = /\b(engineer|officer|manager|assistant|intern|attach|developer|analyst|technician|supervisor|consultant|coordinator|accountant|teacher|nurse|clerk|executive|director|administrator|specialist|associate)\b/i;

/** "stated" when the CV says "N years of experience"; otherwise "estimated" from work date ranges. Never guessed when neither exists. */
export function detectYears(text: string, nowYear = new Date().getFullYear()): { years: number | null; source: Profile['yearsSource'] } {
  let stated = 0;
  for (const m of text.matchAll(STATED)) stated = Math.max(stated, Number(m[1]));
  if (stated > 0 && stated <= 40) return { years: stated, source: 'stated' };

  const spans: [number, number][] = [];
  for (const line of text.split('\n')) {
    if (STUDY.test(line) && !WORK.test(line)) continue;
    for (const m of line.matchAll(RANGE)) {
      const start = Number(m[1]);
      const end = /^\d/.test(m[2]) ? Number(m[2]) : nowYear;
      if (end >= start && end <= nowYear && start >= 1970) spans.push([start, Math.max(end, start + 0.5)]);
    }
  }
  if (!spans.length) return { years: null, source: '' };
  spans.sort((a, b) => a[0] - b[0]);
  let total = 0;
  let [s, e] = spans[0];
  for (const [a, b] of spans.slice(1)) { if (a <= e) e = Math.max(e, b); else { total += e - s; [s, e] = [a, b]; } }
  total += e - s;
  return { years: Math.min(40, Math.round(total * 2) / 2), source: 'estimated' };
}

/** Fields of work suggested by the skills found (up to 3). The user can change them. */
export function detectCategories(skills: string[]): string[] {
  const n = new Map<string, number>();
  for (const s of skills) for (const c of skillCategories(s)) n.set(c, (n.get(c) ?? 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c]) => c);
}

export function extractProfile(text: string, nowYear?: number): Pick<Profile, 'skills' | 'education' | 'years' | 'yearsSource' | 'categories'> {
  const skills = findSkills(text);
  const { years, source } = detectYears(text, nowYear);
  const edu = detectEducation(text);
  return { skills, education: EDUCATION.includes(edu) ? edu : '', years, yearsSource: source, categories: detectCategories(skills) };
}
