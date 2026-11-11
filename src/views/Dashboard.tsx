import { CardCtx, JobCard } from '../components/JobCard';
import { Globe } from '../components/Globe';
import { Btn, Panel } from '../components/ui';
import { daysLeft } from '../lib/filters';
import { timeAgo } from '../lib/format';
import type { Rec } from '../lib/match';
import { matchTone } from '../components/JobCard';
import { Badge } from '../components/ui';
import type { Job } from '../types';

export interface Stat { label: string; value: number; onClick: () => void }

export function Dashboard({ stats, counties, latest, closing, lastCollected, ctx, onAll, mine, hasProfile, onProfile, onRecommended }: { stats: Stat[]; counties: string[]; latest: Job[]; closing: Job[]; lastCollected: string; ctx: CardCtx; onAll: () => void; mine: Rec[]; hasProfile: boolean; onProfile: () => void; onRecommended: () => void }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[23rem_1fr] gap-4">
        <Panel title="Radar">
          <Globe counties={counties} />
          <p className="mt-2 text-center text-[11px] text-dim">Last collection: <span className="text-orange">{lastCollected ? timeAgo(lastCollected) : 'never'}</span></p>
        </Panel>
        <div className="grid grid-cols-3 gap-4">
          {stats.map((s) => (
            <button key={s.label} onClick={s.onClick} className="relative border border-line/40 bg-panel/70 p-4 text-left transition hover:border-cyan focus:outline-none focus-visible:border-orange">
              <div className="text-[11px] uppercase tracking-widest text-dim">{s.label}</div>
              <div className="mt-2 text-3xl font-bold text-orange">{s.value}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_20rem] gap-4">
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-[0.25em] text-cyan">Latest opportunities</h2>
            <button onClick={onAll} className="text-[11px] uppercase tracking-widest text-orange hover:text-cyan">View all</button>
          </div>
          <div className="space-y-3">{latest.map((j) => <JobCard key={j.id} job={j} ctx={ctx} />)}</div>
        </section>
        <div className="space-y-4">
        <Panel title="My opportunities" className="h-fit" right={mine.length > 0 ? <button onClick={onRecommended} className="text-[11px] uppercase tracking-widest text-orange hover:text-cyan">See all</button> : undefined}>
          {mine.length === 0 && <p className="text-xs text-dim">{hasProfile ? 'No strong matches right now. New ones appear as jobs are collected.' : 'Add your CV or preferences to see jobs picked for you.'}</p>}
          {mine.length === 0 && !hasProfile && <div className="mt-3"><Btn variant="ghost" onClick={onProfile}>Set up My Profile</Btn></div>}
          <ul className="space-y-3">
            {mine.map(({ job, match }) => (
              <li key={job.id}>
                <button onClick={() => ctx.open(job)} className="w-full text-left">
                  <div className="text-xs text-cyan hover:text-orange">{job.title}</div>
                  <div className="flex items-center justify-between gap-2 text-[11px] text-dim"><span className="truncate">{job.employer}</span>{match && <Badge tone={matchTone(match.score)}>{match.score}%</Badge>}</div>
                </button>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Closing soon" className="h-fit">
          {closing.length === 0 && <p className="text-xs text-dim">No deadlines in the next 14 days.</p>}
          <ul className="space-y-3">
            {closing.map((j) => {
              const d = daysLeft(j.deadline);
              return (
                <li key={j.id}>
                  <button onClick={() => ctx.open(j)} className="w-full text-left">
                    <div className="text-xs text-cyan hover:text-orange">{j.title}</div>
                    <div className="flex justify-between text-[11px] text-dim"><span className="truncate">{j.employer}</span><span className="shrink-0 text-orange">{d === 0 ? 'today' : `${d}d left`}</span></div>
                  </button>
                </li>
              );
            })}
          </ul>
        </Panel>
        </div>
      </div>
    </div>
  );
}
