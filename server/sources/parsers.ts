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
/** Career Point Kenya titles look like "YDN Director NGO Job CFK Africa". */
export function careerPointTitle(t: string): { title: string; employer?: string } {
  const m = t.match(new RegExp(`^(.+?)\\s+(?:${SECTOR}\\s+)?Jobs?\\s+(?:at\\s+)?(.{2,80})$`, 'i'));
  return m ? { title: m[1].trim(), employer: m[2].trim() } : { title: t };
}
