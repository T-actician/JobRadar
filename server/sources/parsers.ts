import type { RawJob } from '../normalize';

/** BrighterMonday listing card, as text lines: title, employer, "Posted ...", summary, place / work type / salary, "Apply".
 *  Works whether place, type and salary share one line or sit on separate lines. */
const BM_TYPE = /\b(full time|part time|contract & temporary|internship & volunteer)\b/i;
export function brightermondayCard(lines: string[], title: string): Partial<RawJob> {
  const L = lines.map((l) => l.replace(/^•\s*/, '').trim()).filter((l) => l.length > 2 || /^\d+$/.test(l));
  const key = title.slice(0, 18).toLowerCase();
  const ti = L.findIndex((l) => l.toLowerCase().includes(key));
  const after = ti >= 0 ? L.slice(ti + 1) : L;
  const out: Partial<RawJob> = {};

  const posted = after.findIndex((l) => /^(posted|new \(posted)/i.test(l));
  const between = after.slice(0, posted >= 0 ? posted : 0).filter((l) => !/^(apply|confidential|verified|featured|popular)$/i.test(l) && l.length < 80);
  if (between[0]) out.employer = between[0];

  let idx = -1;
  for (let i = after.length - 1; i >= 0; i--) if (BM_TYPE.test(after[i])) { idx = i; break; }
  if (idx >= 0) {
    const m = after[idx].match(/^(.*?)\s*\b(Full Time|Part Time|Contract & Temporary|Internship & Volunteer)\b\s*(.*)$/i)!;
    out.typeText = m[2];
    const place = m[1] || (idx > 0 && !/^posted|^new \(/i.test(after[idx - 1]) && after[idx - 1].length < 40 ? after[idx - 1] : '');
    if (place) out.location = place;
    const sal = [m[3], after[idx + 1] ?? ''].find((x) => /ksh|kes/i.test(x));
    if (sal) out.salaryText = sal;
  }
  return out;
}

const SECTOR = '(?:NGO|Government|Govt|Bank|Banking|Hospital|University|College|School|Telecom|Health|Healthcare|Education|Engineering|ICT|Finance|Logistics|Sales|Marketing|Hotel|Hospitality|Security|Construction|Manufacturing|Agriculture|Insurance|Consultancy|Internship|Attachment|Graduate)';
/** Corporate Staffing titles end in "Job <Employer>", but some give a place instead ("Accountant Job Nairobi, Kenya"). */
export function corporateStaffingTitle(t: string): { title: string; employer?: string } {
  const r = careerPointTitle(t);
  // what follows "Job" is sometimes a place or a pay figure, e.g. "Job Nairobi, Kenya" or "Job (450-500K)"
  const notEmployer = /^(nairobi|kenya|mombasa|kisumu|nakuru|eldoret|thika|remote)\b/i.test(r.employer ?? '') || /^\(?\s*(ksh?s?\.?\s*)?\d[\d,.\s\-–kKmM]*\)?$/.test(r.employer ?? '');
  // with no real employer, keep the role as written ("Accountant - Manufacturing"), minus the "Job ..." tail and a trailing NGO/Government tag
  return r.employer && notEmployer ? { title: t.replace(/\s+Jobs?\b.*$/i, '').replace(/\s+(NGO|Government|Govt)$/i, '').trim() } : r;
}

/** Career Point Kenya titles look like "YDN Director NGO Job CFK Africa". */
export function careerPointTitle(t: string): { title: string; employer?: string } {
  const m = t.match(new RegExp(`^(.+?)\\s+(?:${SECTOR}\\s+)?Jobs?\\s+(?:at\\s+)?(.{2,80})$`, 'i'));
  return m ? { title: m[1].trim(), employer: m[2].trim() } : { title: t };
}
