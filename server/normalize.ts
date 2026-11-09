import { createHash } from 'node:crypto';
import { COUNTIES, SOURCES } from '../src/constants';
import type { Job, JobType, Level, WorkMode } from '../src/types';

export interface RawJob {
  source: string;
  url: string;
  title: string;
  employer?: string;
  description?: string;
  postedAt?: string;
  deadline?: string;
  location?: string;
  salaryText?: string;
  typeText?: string;
  categoryText?: string;
  applyUrl?: string;
  /** true when the original page was fetched and parsed during this run */
  verified?: boolean;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const ymd = (y: number, m: number, d: number): string | undefined => {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
    ? `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : undefined;
};

/** Parses ISO, "15 November 2026", "November 15, 2026" and day-first "15/11/2026". */
export function toDateOnly(s?: string): string | undefined {
  if (!s) return undefined;
  const t = s.trim();
  let m = t.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return ymd(+m[1], +m[2], +m[3]);
  m = t.match(/(\d{1,2})(?:st|nd|rd|th)?[\s\-/]+([A-Za-z]{3,9})\.?,?[\s\-/]+(\d{4})/);
  if (m && MONTHS.includes(m[2].slice(0, 3).toLowerCase())) return ymd(+m[3], MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1, +m[1]);
  m = t.match(/([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/);
  if (m && MONTHS.includes(m[1].slice(0, 3).toLowerCase())) return ymd(+m[3], MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1, +m[2]);
  m = t.match(/(\d{1,2})[/.](\d{1,2})[/.](\d{4})/);
  if (m) return ymd(+m[3], +m[2], +m[1]);
  return undefined;
}

const DEADLINE = /(?:deadline|closing date|closes?(?: on)?|apply (?:on or )?before|date of closing|expires?(?: on)?)\s*(?:of (?:this )?(?:job|application|vacancy))?\s*[:\-–]?\s*([^\n]{4,45})/i;
export const findDeadline = (text: string): string | undefined => {
  const m = text.match(DEADLINE);
  return m ? toDateOnly(m[1]) : undefined;
};

const CATEGORY_RULES: [RegExp, string][] = [
  [/cyber|information security|infosec|soc analyst|penetration test/, 'Cybersecurity'],
  [/data (scientist|analyst|engineer)|machine learning|business intelligence|analytics/, 'Data Science'],
  [/software|developer|programmer|full[- ]?stack|front[- ]?end|back[- ]?end|devops|web developer|mobile (app )?developer/, 'Software Engineering'],
  [/network (engineer|administrator|support|technician|officer)|\bccna\b|\bnoc\b/, 'Networking'],
  [/telecom|\brf\b engineer|fib(re|er) (optic|technician|engineer)|\bgsm\b/, 'Telecommunications'],
  [/\bict\b|information technology|it support|systems? (administrator|analyst)|help ?desk|database administrator|\bit (officer|manager|technician)\b/, 'Information Technology'],
  [/electrical|power systems|substation|electrician|protection engineer/, 'Electrical Engineering'],
  [/electronic|embedded|\bpcb\b|firmware|instrumentation/, 'Electronics Engineering'],
  [/civil engineer|structural|quantity surveyor|land surveyor|geotechnical|hydrolog|roads? engineer/, 'Civil Engineering'],
  [/mechanical|hvac|mechatronic|fitter|welder|plant engineer|automotive|mechanic\b/, 'Mechanical Engineering'],
  [/construction|site (agent|supervisor|engineer)|foreman|clerk of works/, 'Construction'],
  [/accountant|accounts (assistant|clerk|officer|payable|receivable)|audit|bookkeep|payroll|\bcpa\b|finance officer|tax (officer|analyst)/, 'Accounting'],
  [/human resource|\bhr\b|talent acquisition|recruit(er|ment officer)/, 'Human Resources'],
  [/procurement|supply chain officer|purchasing|tender/, 'Procurement'],
  [/logistic|warehouse|freight|supply chain|\bdriver\b|fleet/, 'Logistics'],
  [/marketing|brand (manager|ambassador)|communications? (officer|manager)|social media|content (creator|writer)/, 'Marketing'],
  [/\bsales\b|business development|account manager|relationship manager|merchandis/, 'Sales'],
  [/nurse|clinical|doctor|medical|pharmac|health|laboratory (technologist|technician)|clinician|midwi/, 'Healthcare'],
  [/teacher|lecturer|tutor|school|university|education|trainer|instructor|professor/, 'Education'],
  [/agri|farm|crop|livestock|horticult|agronom/, 'Agriculture'],
  [/hotel|chef|restaurant|hospitality|waiter|barista|front office|housekeeping/, 'Hospitality'],
  [/manufactur|production (supervisor|manager|operator)|factory|quality (control|assurance)|plant operator/, 'Manufacturing'],
  [/research|scientist|biolog|chemist/, 'Science and Research'],
  [/programme (officer|manager|coordinator|assistant)|program (officer|manager)|\bngo\b|humanitarian|monitoring and evaluation|\bm&e\b|unicef|usaid|world vision|red cross/, 'NGOs'],
  [/county government|ministry|commission|public service|state department|parastatal|\bkra\b|\bkpa\b|\bkenha\b|\bkerra\b/, 'Government'],
  [/bank|financial|credit|loan|investment|treasury|risk|insurance|actuar|\bfinance\b/, 'Business and Finance'],
  [/administrat|secretary|receptionist|clerk|office assistant|personal assistant|executive assistant/, 'Administration'],
];
const categorise = (text: string): string => CATEGORY_RULES.find(([re]) => re.test(text))?.[1] ?? 'Other';

const TOWNS: Record<string, string> = {
  'ongata rongai': 'Kajiado', rongai: 'Kajiado', syokimau: 'Machakos', mlolongo: 'Machakos', utawala: 'Nairobi', gigiri: 'Nairobi', runda: 'Nairobi',
  muthaiga: 'Nairobi', kileleshwa: 'Nairobi', 'south c': 'Nairobi', 'south b': 'Nairobi', kasarani: 'Nairobi', roysambu: 'Nairobi', donholm: 'Nairobi',
  eastleigh: 'Nairobi', kawangware: 'Nairobi', githurai: 'Nairobi', dagoretti: 'Nairobi', mtwapa: 'Kilifi', diani: 'Kwale', ukunda: 'Kwale',
  westlands: 'Nairobi', kilimani: 'Nairobi', 'upper hill': 'Nairobi', karen: 'Nairobi', 'industrial area': 'Nairobi', lavington: 'Nairobi',
  parklands: 'Nairobi', embakasi: 'Nairobi', ruaraka: 'Nairobi', langata: 'Nairobi', cbd: 'Nairobi', nyali: 'Mombasa', bamburi: 'Mombasa',
  changamwe: 'Mombasa', eldoret: 'Uasin Gishu', thika: 'Kiambu', ruiru: 'Kiambu', juja: 'Kiambu', kikuyu: 'Kiambu', limuru: 'Kiambu',
  naivasha: 'Nakuru', 'nakuru town': 'Nakuru', kitale: 'Trans Nzoia', malindi: 'Kilifi', 'athi river': 'Machakos', kitengela: 'Kajiado',
  ngong: 'Kajiado', lodwar: 'Turkana', voi: 'Taita-Taveta', nanyuki: 'Laikipia', kapsabet: 'Nandi', konza: 'Machakos', kisumu: 'Kisumu',
};

function findPlace(text: string): { county?: string; town?: string } {
  const t = text.toLowerCase();
  for (const c of COUNTIES) {
    if (new RegExp(`\\b${c.toLowerCase().replace(/['-]/g, '.?')}\\b`).test(t)) return { county: c };
  }
  for (const [town, county] of Object.entries(TOWNS)) {
    if (new RegExp(`\\b${town}\\b`).test(t)) return { county, town: town.replace(/\b\w/g, (x) => x.toUpperCase()) };
  }
  return {};
}

const salaryFrom = (text: string): [number | null, number | null] => {
  if (/(per|a|\/)\s*(hour|day|week)|hourly|daily|weekly/i.test(text)) return [null, null];
  const m = text.match(/(?:kes|ksh?s?\.?|sh\.?|kenya shillings?)\s*([\d,]{4,10})(?:\s*(?:-|–|to)\s*(?:(?:kes|ksh?s?\.?|sh\.?)\s*)?([\d,]{4,10}))?/i);
  if (!m) return [null, null];
  let lo = Number(m[1].replace(/,/g, ''));
  let hi = m[2] ? Number(m[2].replace(/,/g, '')) : lo;
  if (/(per annum|annual|year|p\.a)/i.test(text) || lo > 1_500_000) { lo = Math.round(lo / 12); hi = Math.round(hi / 12); }
  if (hi < lo) [lo, hi] = [hi, lo];
  return lo < 1000 ? [null, null] : [lo, m[2] ? hi : null];
};

const EDU: [RegExp, string][] = [
  [/ph\.?d|doctorate/i, 'PhD'], [/master'?s?\b|\bmsc\b|\bmba\b/i, "Master's degree"],
  [/bachelor|degree|\bbsc\b|\bb\.?sc\b/i, "Bachelor's degree"], [/diploma/i, 'Diploma'], [/certificate|kcse/i, 'Certificate'],
];
const educationFrom = (text: string): string | null => {
  const head = text.slice(0, 4000);
  let best: { i: number; v: string } | null = null;
  for (const [re, v] of EDU) { const i = head.search(re); if (i >= 0 && (!best || i < best.i)) best = { i, v }; }
  return best?.v ?? null;
};

const expFrom = (text: string): number | null => {
  if (/no (prior |previous )?(work )?experience (is )?(required|needed)|without experience/i.test(text)) return 0;
  const m = text.match(/(?:minimum|at least|min\.?)\s*(?:of\s*)?(\d{1,2})\s*\+?\s*years?/i) ?? text.match(/(\d{1,2})\s*\+?\s*(?:-|–|to)?\s*(?:\d{1,2})?\s*\+?\s*years?[^.\n]{0,40}experience/i);
  const n = m ? Number(m[1]) : NaN;
  return Number.isFinite(n) && n <= 30 ? n : null;
};

const typeFrom = (title: string, extra: string): JobType | 'Not specified' => {
  const t = `${title} ${extra}`.toLowerCase();
  if (/attachment|attachee/.test(t)) return 'Industrial Attachment';
  if (/\bintern(ship)?s?\b/.test(t)) return 'Internship';
  if (/graduate (trainee|programme|program)|management trainee|trainee programme/.test(t)) return 'Graduate Trainee';
  if (/apprentice/.test(t)) return 'Apprenticeship';
  if (/part[- ]?time/.test(t)) return 'Part-time';
  if (/freelance/.test(t)) return 'Freelance';
  if (/\btemporary\b|\bcasual\b/.test(t)) return 'Temporary';
  if (/\bcontract\b|fixed[- ]term/.test(t)) return 'Contract';
  if (/full[- _]?time|permanent/.test(t)) return 'Full-time';
  return 'Not specified';
};

function levelFrom(title: string, type: string, exp: number | null): { level: Level | 'Not specified'; inferred: boolean } {
  const t = title.toLowerCase();
  if (type === 'Industrial Attachment') return { level: 'Industrial Attachment', inferred: false };
  if (type === 'Internship') return { level: 'Internship', inferred: false };
  if (type === 'Graduate Trainee' || /\bgraduate\b/.test(t)) return { level: 'Graduate', inferred: false };
  if (/\b(director|chief|\bceo\b|\bcfo\b|\bcto\b|general manager|executive director|managing)\b/.test(t)) return { level: 'Executive', inferred: true };
  if (/\b(junior|jr)\b/.test(t)) return { level: 'Junior', inferred: true };
  if (/\b(manager|head of|head,|team lead|supervisor)\b/.test(t)) return { level: 'Managerial', inferred: true };
  if (/\b(senior|snr|principal|sr\.)\b/.test(t)) return { level: 'Senior', inferred: true };
  if (/\b(trainee|assistant|clerk)\b|entry[- ]level/.test(t)) return { level: 'Entry-level', inferred: true };
  if (/mid[- ]level/.test(t)) return { level: 'Mid-level', inferred: true };
  if (exp !== null) return { level: exp === 0 ? 'Entry-level' : exp <= 2 ? 'Junior' : exp <= 5 ? 'Mid-level' : 'Senior', inferred: true };
  return { level: 'Not specified', inferred: false };
}

const modeFrom = (text: string): WorkMode | 'Not specified' => {
  if (/\bhybrid\b/i.test(text)) return 'Hybrid';
  if (/\bremote\b|work from home|\bwfh\b|telecommute/i.test(text)) return 'Remote';
  if (/on[- ]?site/i.test(text)) return 'On-site';
  return 'Not specified';
};

const HEAD_RESP = /^(key )?(duties|responsibilities|roles?( and responsibilities)?|job (duties|description))\b/i;
const HEAD_REQ = /^(requirements?|qualifications?|minimum (requirements|qualifications)|person specification|key (requirements|competencies|qualifications)|academic (and professional )?qualifications)\b/i;
const HEAD_ANY = /^(how to apply|application (procedure|instructions)|about (us|the company)|benefits|deadline|closing date|apply|salary|skills|competenc|key (duties|responsibilities|requirements|competencies|qualifications)|duties|responsibilities|requirements?|qualifications?)/i;

function section(lines: string[], head: RegExp): string[] {
  const i = lines.findIndex((l) => l.length < 70 && head.test(l.replace(/^[•\-*·\d.)\s]+/, '')));
  if (i < 0) return [];
  const out: string[] = [];
  for (const l of lines.slice(i + 1)) {
    const clean = l.replace(/^[•\-*·\s]+/, '').trim();
    if (!clean) continue;
    if (clean.length < 50 && /[:]$/.test(clean) && HEAD_ANY.test(clean)) break;
    if (clean.length < 40 && HEAD_ANY.test(clean) && !/^[•\-*·]/.test(l)) break;
    out.push(clean.slice(0, 220));
    if (out.length >= 12) break;
  }
  return out;
}

function flagsFrom(text: string): string[] {
  const f: string[] = [];
  if (/registration fee|application fee|processing fee|(pay|send|deposit)\s+(a\s+)?(fee|ksh|kes|money)|training fee|\bm-?pesa\b.{0,40}(pay|send)/i.test(text)) f.push('Asks applicants to pay a fee');
  if (/(contact|apply|reach)\s+(us\s+)?(only\s+)?(on|via|through)\s+whatsapp/i.test(text)) f.push('Application is via WhatsApp only');
  if (/guaranteed (job|income|employment)|earn (up to )?(ksh|kes)\s*[\d,]+\s*(daily|per day|weekly)/i.test(text)) f.push('Makes unrealistic income or job promises');
  return f;
}

const OVERSEAS = /\b(dubai|uae|u\.a\.e|qatar|doha|saudi|riyadh|kuwait|oman|bahrain|abu dhabi)\b/i;
const clean = (s: string) => s.replace(/\s+/g, ' ').replace(/\s+[|–-]\s+(apply now|apply here).*$/i, '').trim();

export function normalizeJob(raw: RawJob, now = new Date()): Job {
  let title = clean(raw.title);
  let employer = raw.employer ? clean(raw.employer) : '';
  if (!employer) {
    const m = title.match(/^(.*\S)\s+(?:at|@)\s+(.{2,80})$/i);
    if (m) { title = m[1]; employer = m[2]; }
  }
  const description = (raw.description ?? '').replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, 8000);
  const lines = description.split('\n').map((l) => l.trim());
  const body = `${description}\n${raw.typeText ?? ''}`;

  const category = categorise(`${title} ${employer}`.toLowerCase()) !== 'Other'
    ? categorise(`${title} ${employer}`.toLowerCase())
    : categorise(`${raw.categoryText ?? ''} ${description.slice(0, 500)}`.toLowerCase());

  const typeLine = description.match(/(?:job type|employment type|type of (?:employment|contract)|terms? of (?:employment|service))\s*[:\-–]\s*([^\n]{3,40})/i)?.[1] ?? '';
  const type = typeFrom(title, `${raw.typeText ?? ''} ${raw.categoryText ?? ''} ${typeLine}`);
  const expMin = expFrom(body);
  const { level, inferred } = levelFrom(title, type, expMin);

  const dutyStation = description.match(/(?:duty station|job location|location|based in)\s*[:\-–]\s*([^\n.]{2,60})/i)?.[1];
  const locText = raw.location || dutyStation || '';
  const place = findPlace(locText) ?? {};
  const placeTitle = place.county ? place : findPlace(title);
  const county = place.county ?? placeTitle.county ?? 'Not specified';
  const firstPart = locText.split(/[,|/]/)[0]?.trim();
  const town = place.town ?? placeTitle.town ?? (firstPart && !/^(kenya|not specified)$/i.test(firstPart) && firstPart.length < 40 ? firstPart : 'Not specified');

  const [salaryMin, salaryMax] = raw.salaryText
    ? salaryFrom(raw.salaryText)
    : salaryFrom(description.match(/(?:salary|remuneration|pay)[^\n.]{0,60}?(?:kes|ksh?s?\.?|sh\.?)\s*[\d,]+(?:\s*(?:-|–|to)\s*(?:kes|ksh?s?\.?|sh\.?)?\s*[\d,]+)?[^\n.]{0,30}/i)?.[0] ?? '');

  const nowIso = now.toISOString();
  let published = nowIso;
  if (raw.postedAt) {
    const d = new Date(raw.postedAt);
    const dateOnly = toDateOnly(raw.postedAt);
    const iso = !Number.isNaN(d.getTime()) ? d.toISOString() : dateOnly ? `${dateOnly}T00:00:00.000Z` : undefined;
    if (iso && new Date(iso).getTime() <= now.getTime() + 36e5) published = iso;
  }

  let deadline = toDateOnly(raw.deadline) ?? findDeadline(`${raw.title}\n${description}`) ?? null;
  if (deadline) {
    const dl = new Date(`${deadline}T00:00:00Z`).getTime();
    if (dl < new Date(published).getTime() - 864e5 * 2 || dl > now.getTime() + 864e5 * 730) deadline = null;
  }

  const home = Object.entries(SOURCES).find(([k]) => k === raw.source)?.[1] ?? new URL(raw.url).origin + '/';
  return {
    id: createHash('sha1').update(`${raw.source}|${raw.url}`).digest('hex').slice(0, 16),
    title, employer: employer || 'Not specified', category,
    type: type as JobType, level: level as Level, levelInferred: inferred, expMin,
    county, town, mode: modeFrom(`${title} ${locText} ${description.slice(0, 600)}`) as WorkMode,
    salaryMin, salaryMax, deadline, published, collected: nowIso,
    lastVerified: raw.verified ? nowIso : null,
    source: raw.source, sourceUrl: home, applyUrl: raw.applyUrl ?? raw.url,
    education: educationFrom(body), description,
    responsibilities: section(lines, HEAD_RESP), requirements: section(lines, HEAD_REQ), skills: [],
    status: 'active', flags: [...flagsFrom(`${title}\n${description}`), ...(OVERSEAS.test(`${title} ${locText}`) ? ['Job is outside Kenya: confirm the agency is NEA-registered before paying or sharing documents'] : [])],
  };
}
