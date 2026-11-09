import { Bookmark } from 'lucide-react';
import { daysLeft, isExpired, isNew } from '../lib/filters';
import { deadlineText, expText, fmtDate, openExternal, locText } from '../lib/format';
import type { Job } from '../types';
import { Badge, Btn, Empty, Field } from './ui';

export interface CardCtx { saved: string[]; open: (j: Job) => void; toggle: (j: Job) => void; log: (m: string) => void }

export function applyNow(j: Job, log: (m: string) => void) {
  openExternal(j.applyUrl);
  log(`Opened application page for "${j.title}" on ${j.source}`);
}

export function JobCard({ job, ctx }: { job: Job; ctx: CardCtx }) {
  const left = daysLeft(job.deadline);
  const saved = ctx.saved.includes(job.id);
  return (
    <article tabIndex={0} role="button" onClick={() => ctx.open(job)} onKeyDown={(e) => e.key === 'Enter' && ctx.open(job)}
      className="relative cursor-pointer border border-line/40 bg-panel/70 p-4 transition hover:border-cyan focus:outline-none focus-visible:border-orange">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-cyan">{job.title}</h3>
            {isNew(job) && <Badge>New</Badge>}
            {job.status === 'updated' && <Badge tone="cyan">Updated</Badge>}
            {isExpired(job) && <Badge tone="dim">Expired</Badge>}
            {job.flags.length > 0 && <Badge tone="warn">Warning</Badge>}
          </div>
          <p className="mt-1 text-xs text-ink">{job.employer}</p>
        </div>
        <button aria-label={saved ? 'Remove from saved' : 'Save job'} onClick={(e) => { e.stopPropagation(); ctx.toggle(job); }}
          className={`p-1 focus:outline-none focus-visible:ring-1 focus-visible:ring-orange ${saved ? 'text-orange' : 'text-dim hover:text-cyan'}`}>
          <Bookmark size={16} fill={saved ? 'currentColor' : 'none'} />
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Field label="Location" value={locText(job)} />
        <Field label="Type" value={job.type} />
        <Field label={job.levelInferred ? 'Level (inferred)' : 'Level'} value={job.level} />
        <Field label="Experience" value={expText(job)} />
      </div>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3 border-t border-line/30 pt-3">
        <div className="grid grid-cols-3 gap-x-6 gap-y-1">
          <Field label="Published" value={fmtDate(job.published)} />
          <Field label="Deadline" value={deadlineText(job, left)} />
          <Field label="Source" value={job.source} />
        </div>
        <Btn onClick={(e) => { e.stopPropagation(); applyNow(job, ctx.log); }}>Apply Now</Btn>
      </div>
    </article>
  );
}

export function JobList({ jobs, ctx, empty }: { jobs: Job[]; ctx: CardCtx; empty: { title: string; hint: string; action?: React.ReactNode } }) {
  if (!jobs.length) return <Empty {...empty} />;
  return <div className="space-y-3">{jobs.map((j) => <JobCard key={j.id} job={j} ctx={ctx} />)}</div>;
}
