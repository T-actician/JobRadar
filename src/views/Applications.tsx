import { APP_STATUSES } from '../constants';
import { Btn, Empty, INPUT, Panel, Select, opts } from '../components/ui';
import type { AppRecord, Job } from '../types';

interface Props { apps: Record<string, AppRecord>; jobs: Job[]; onChange: (id: string, p: Partial<AppRecord>) => void; onRemove: (id: string) => void; onOpen: (j: Job) => void }

export function Applications({ apps, jobs, onChange, onRemove, onOpen }: Props) {
  const rows = Object.keys(apps).map((id) => ({ id, job: jobs.find((j) => j.id === id), rec: apps[id] })).filter((r) => r.job);
  if (!rows.length) return <Empty title="No applications tracked yet" hint="Open a job and choose Track Application to record its status, dates, contacts and notes here." />;
  return (
    <div className="space-y-3">
      {rows.map(({ id, job, rec }) => (
        <Panel key={id}>
          <div className="flex items-start justify-between gap-3">
            <button onClick={() => onOpen(job!)} className="text-left"><div className="text-sm font-bold text-cyan hover:text-orange">{job!.title}</div><div className="text-xs text-ink">{job!.employer}</div></button>
            <Btn variant="danger" onClick={() => onRemove(id)}>Remove</Btn>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <Select label="Status" any={false} value={rec.status} onChange={(v) => onChange(id, { status: v as AppRecord['status'] })} options={opts(APP_STATUSES)} />
            <label className="block text-[11px] uppercase tracking-widest text-dim">Date applied<input type="date" value={rec.date} onChange={(e) => onChange(id, { date: e.target.value })} className={`${INPUT} mt-1`} /></label>
            <label className="block text-[11px] uppercase tracking-widest text-dim">Contact<input value={rec.contact} onChange={(e) => onChange(id, { contact: e.target.value })} placeholder="Name, email or phone" className={`${INPUT} mt-1`} /></label>
          </div>
          <label className="mt-3 block text-[11px] uppercase tracking-widest text-dim">Notes<textarea value={rec.notes} onChange={(e) => onChange(id, { notes: e.target.value })} rows={2} className={`${INPUT} mt-1 resize-y`} /></label>
        </Panel>
      ))}
    </div>
  );
}
