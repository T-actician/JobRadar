import { AlertTriangle, Bookmark, X } from 'lucide-react';
import { useEffect } from 'react';
import { daysLeft } from '../lib/filters';
import { deadlineText, expText, fmtDate, openExternal, salaryText, timeAgo, locText } from '../lib/format';
import type { Job, MatchResult } from '../types';
import { applyNow, matchTone } from './JobCard';
import { Badge, Btn, Field } from './ui';

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mt-5"><h3 className="mb-2 text-[11px] font-bold uppercase tracking-[0.25em] text-cyan">{title}</h3>{children}</section>
);
const Bullets = ({ items }: { items: string[] }) =>
  items.length ? <ul className="list-inside list-disc space-y-1 text-xs text-ink">{items.map((i) => <li key={i}>{i}</li>)}</ul> : <p className="text-xs text-dim">Not specified</p>;

interface Props { job: Job; saved: boolean; tracked: boolean; onClose: () => void; onSave: () => void; onTrack: () => void; log: (m: string) => void; match: MatchResult | null; onProfile: () => void }

export function JobDetail({ job, saved, tracked, onClose, onSave, onTrack, log, match, onProfile }: Props) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  const left = daysLeft(job.deadline);

  return (
    <div className="fixed inset-0 z-20 flex justify-end bg-black/60" onClick={onClose}>
      <aside role="dialog" aria-label={job.title} onClick={(e) => e.stopPropagation()} className="h-full w-[600px] max-w-full overflow-y-auto border-l border-cyan bg-bg p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-cyan">{job.title}</h2>
            <p className="mt-1 text-sm text-val">{job.employer}</p>
          </div>
          <button aria-label="Close" onClick={onClose} className="p-1 text-dim hover:text-cyan"><X size={18} /></button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Btn onClick={() => applyNow(job, log)}>Apply Now</Btn>
          <Btn variant="ghost" onClick={onSave}><Bookmark size={12} className="mr-1 inline" fill={saved ? 'currentColor' : 'none'} />{saved ? 'Saved' : 'Save'}</Btn>
          <Btn variant="ghost" onClick={onTrack}>{tracked ? 'View in My Applications' : 'Track Application'}</Btn>
        </div>
        <p className="mt-2 text-[11px] text-dim">Apply Now opens the original page in your browser. JobRadar does not submit applications.</p>

        {job.flags.length > 0 && (
          <div role="alert" className="mt-4 border border-warn/70 bg-warn/10 p-3 text-xs text-warn">
            <div className="mb-1 flex items-center gap-2 font-bold uppercase tracking-widest"><AlertTriangle size={14} /> Possible scam</div>
            <ul className="list-inside list-disc">{job.flags.map((f) => <li key={f}>{f}</li>)}</ul>
            <p className="mt-2 text-ink">Never pay to apply. Check the employer independently before sharing personal details.</p>
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-4 border border-line/40 bg-panel/70 p-4 md:grid-cols-3">
          <Field label="Location" value={locText(job)} />
          <Field label="Work mode" value={job.mode} />
          <Field label="Type" value={job.type} />
          <Field label={job.levelInferred ? 'Level (inferred)' : 'Level'} value={job.level} />
          <Field label="Experience" value={expText(job)} />
          <Field label="Education" value={job.education ?? 'Not specified'} />
          <Field label="Salary" value={salaryText(job)} />
          <Field label="Deadline" value={deadlineText(job, left)} />
          <Field label="Category" value={job.category} />
        </div>

        <Section title="Your match">
          {match ? (
            <div className="border border-line/40 bg-panel/70 p-4 text-xs">
              <div className="flex items-baseline gap-3"><span className="text-2xl font-bold text-val">{match.score}%</span><Badge tone={matchTone(match.score)}>{match.confidence < 0.5 ? 'Limited information' : 'Estimated match'}</Badge></div>
              <ul className="mt-3 space-y-1">
                {match.parts.map((p) => <li key={p.key} className="flex justify-between"><span className="text-ink">{p.label}</span><span className="text-val">{p.score === null ? 'Not enough information' : `${Math.round(p.score * 100)}%`}</span></li>)}
              </ul>
              {match.matched.length > 0 && <><div className="mt-3 text-[11px] uppercase tracking-widest text-dim">Skills you have</div><div className="mt-1 flex flex-wrap gap-2">{match.matched.map((s) => <Badge key={s} tone="ok">{s}</Badge>)}</div></>}
              {match.missing.length > 0 && <><div className="mt-3 text-[11px] uppercase tracking-widest text-dim">Mentioned in the advert, not on your profile</div><div className="mt-1 flex flex-wrap gap-2">{match.missing.map((s) => <Badge key={s}>{s}</Badge>)}</div><p className="mt-1 text-[11px] text-dim">If you do have these, add them in My Profile so they count.</p></>}
              {match.notes.length > 0 && <ul className="mt-3 list-inside list-disc space-y-1 text-ink">{match.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
              <p className="mt-3 text-[11px] text-dim">An estimate from your profile and this advert only. It does not say whether you qualify or will be shortlisted.</p>
            </div>
          ) : (
            <div className="border border-line/40 bg-panel/70 p-4 text-xs text-ink">
              No match shown. Add your CV or preferences in My Profile, or this advert has too little detail to compare.
              <div className="mt-2"><Btn variant="ghost" onClick={onProfile}>Open My Profile</Btn></div>
            </div>
          )}
        </Section>

        <Section title="Description"><p className="text-xs leading-relaxed text-ink">{job.description || 'Not specified'}</p></Section>
        <Section title="Responsibilities"><Bullets items={job.responsibilities} /></Section>
        <Section title="Requirements"><Bullets items={job.requirements} /></Section>
        <Section title="Skills">
          {job.skills.length ? <div className="flex flex-wrap gap-2">{job.skills.map((s) => <Badge key={s} tone="cyan">{s}</Badge>)}</div> : <p className="text-xs text-dim">Not specified</p>}
        </Section>

        <Section title="Source and verification">
          <div className="grid grid-cols-2 gap-4 border border-line/40 bg-panel/70 p-4">
            <Field label="Source" value={job.source} />
            <Field label="Vacancy verification" value={job.lastVerified ? `Verified ${timeAgo(job.lastVerified)}` : 'Not verified'} />
            <Field label="Original publication" value={fmtDate(job.published)} />
            <Field label="Collected by JobRadar" value={fmtDate(job.collected)} />
          </div>
          <p className="mt-2 text-[11px] text-dim">A listing on a well-known site is not proof the vacancy is still open. Confirm on the original page.</p>
          <button onClick={() => openExternal(job.sourceUrl)} className="mt-2 text-xs text-cyan underline hover:text-orange">Open source site</button>
        </Section>
      </aside>
    </div>
  );
}
