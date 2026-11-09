import type { RawJob } from '../normalize';

/** BrighterMonday listing card, as text lines: title, employer, "Posted ...", summary, "<place> <work type> <salary>", "Apply". */
export function brightermondayCard(lines: string[], title: string): Partial<RawJob> {
  const L = lines.map((l) => l.replace(/^•\s*/, '').trim()).filter((l) => l.length > 2);
  const key = title.slice(0, 18).toLowerCase();
  const ti = L.findIndex((l) => l.toLowerCase().includes(key));
  const after = ti >= 0 ? L.slice(ti + 1) : L;
  const out: Partial<RawJob> = {};

  const posted = after.findIndex((l) => /^(posted|new \(posted)/i.test(l));
  const between = after.slice(0, posted >= 0 ? posted : 0).filter((l) => !/^apply$/i.test(l));
  if (between.length === 1 && !/^confidential$/i.test(between[0])) out.employer = between[0];

  const meta = [...after].reverse().find((l) => /\b(full time|part time|contract & temporary|internship & volunteer)\b/i.test(l));
  const m = meta?.match(/^(.*?)\s*\b(Full Time|Part Time|Contract & Temporary|Internship & Volunteer)\b\s*(.*)$/i);
  if (m) {
    if (m[1]) out.location = m[1];
    out.typeText = m[2];
    if (/ksh|kes/i.test(m[3])) out.salaryText = m[3];
  }
  return out;
}

const SECTOR = '(?:NGO|Government|Govt|Bank|Banking|Hospital|University|College|School|Telecom|Health|Healthcare|Education|Engineering|ICT|Finance|Logistics|Sales|Marketing|Hotel|Hospitality|Security|Construction|Manufacturing|Agriculture|Insurance|Consultancy|Internship|Attachment|Graduate)';
/** Career Point Kenya titles look like "YDN Director NGO Job CFK Africa". */
export function careerPointTitle(t: string): { title: string; employer?: string } {
  const m = t.match(new RegExp(`^(.+?)\\s+(?:${SECTOR}\\s+)?Jobs?\\s+(?:at\\s+)?(.{2,80})$`, 'i'));
  return m ? { title: m[1].trim(), employer: m[2].trim() } : { title: t };
}
