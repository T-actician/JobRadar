import { useEffect, useState } from 'react';
import { Badge, Btn, Empty, Panel, Select } from '../components/ui';
import { INTERVALS } from '../constants';
import type { SourceInfo } from '../lib/api';
import { summarize } from '../lib/filters';
import { openExternal, timeAgo } from '../lib/format';
import type { AppNotification, Prefs, SavedSearch } from '../types';

const KIND_TONE = { match: 'cyan', deadline: 'orange', digest: 'cyan', source: 'warn' } as const;
const FREQ: [string, string][] = [['instant', 'Instantly'], ['daily', 'Daily digest']];

interface AlertsProps {
  searches: SavedSearch[]; onChange: (s: SavedSearch[]) => void; onRun: (s: SavedSearch) => void;
  notes: AppNotification[]; onOpenJob: (id: string) => void; onMarkRead: () => void;
}

export function Alerts({ searches, onChange, onRun, notes, onOpenJob, onMarkRead }: AlertsProps) {
  const update = (id: string, p: Partial<SavedSearch>) => onChange(searches.map((s) => (s.id === id ? { ...s, ...p } : s)));
  const unread = notes.filter((n) => !n.read).length;
  return (
    <div className="space-y-4">
      {searches.length === 0 ? (
        <Empty title="No alerts yet" hint="Set filters on any job list and save the search. Turn Notify on here to be told when new matching jobs appear." />
      ) : (
        <Panel title="Alerts">
          <ul className="space-y-3">
            {searches.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line/30 pb-3 last:border-0 last:pb-0">
                <div className="min-w-0">
                  <div className="text-xs text-cyan">{s.name}</div>
                  <div className="truncate text-[11px] text-dim">{summarize(s.filters)}</div>
                </div>
                <div className="flex items-end gap-2">
                  {s.notify && <div className="w-36"><Select label="Notify" any={false} value={s.frequency ?? 'instant'} onChange={(v) => update(s.id, { frequency: v as 'instant' | 'daily' })} options={FREQ} /></div>}
                  <Btn variant={s.notify ? 'solid' : 'ghost'} onClick={() => update(s.id, { notify: !s.notify })}>{s.notify ? 'Notify: On' : 'Notify: Off'}</Btn>
                  <Btn variant="ghost" onClick={() => onRun(s)}>Run</Btn>
                  <Btn variant="danger" onClick={() => onChange(searches.filter((x) => x.id !== s.id))}>Delete</Btn>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      <Panel title="Notifications" right={unread > 0 ? <Btn variant="ghost" onClick={onMarkRead}>Mark all read ({unread})</Btn> : undefined}>
        {notes.length === 0 && <p className="text-xs text-dim">Nothing yet. Matches, deadline reminders and source warnings appear here and as desktop notifications.</p>}
        <ul className="space-y-3">
          {notes.map((n) => (
            <li key={n.id} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs"><Badge tone={KIND_TONE[n.kind]}>{n.kind}</Badge><span className={n.read ? 'text-ink' : 'font-bold text-cyan'}>{n.title}</span></div>
                <div className="mt-1 text-[11px] text-dim">{n.body} · {timeAgo(n.createdAt)}</div>
              </div>
              {n.jobId && <Btn variant="ghost" onClick={() => onOpenJob(n.jobId!)}>Open</Btn>}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

const hours: [string, string][] = Array.from({ length: 24 }, (_, h) => [String(h), `${String(h).padStart(2, '0')}:00`]);
const MANUAL = [
  { name: 'UN Jobs Kenya', url: 'https://unjobs.org/duty_stations/kenya', why: 'Blocks automated access, so JobRadar cannot read it.' },
  { name: 'Fuzu Kenya', url: 'https://www.fuzu.com/kenya/job', why: 'No public feed; its job list only loads inside a browser.' },
  { name: 'LinkedIn Jobs', url: 'https://www.linkedin.com/jobs/', why: 'Does not permit automated collection.' },
  { name: 'PSC Kenya', url: 'https://www.psckjobs.go.ke/', why: 'Adverts and applications are handled in its login portal.' },
];

interface SettingsProps {
  theme: 'dark' | 'light'; setTheme: (t: 'dark' | 'light') => void; prefs: Prefs; setPrefs: (p: Prefs) => void;
  sources: SourceInfo[]; running: boolean; onCollect: (id?: string) => void; onToggle: (id: string, on: boolean) => void;
}

export function SettingsView({ theme, setTheme, prefs, setPrefs, sources, running, onCollect, onToggle }: SettingsProps) {
  const desktop = window.jobradar?.desktop === true;
  const [login, setLogin] = useState<boolean | null>(null);
  useEffect(() => { if (desktop) void window.jobradar!.getLoginItem().then(setLogin); }, [desktop]);
  const setInterval_ = (id: string, v: string) => setPrefs({ ...prefs, intervals: { ...prefs.intervals, ...(v ? { [id]: Number(v) } : {}) } });
  const clearInterval_ = (id: string) => { const next = { ...prefs.intervals }; delete next[id]; setPrefs({ ...prefs, intervals: next }); };

  return (
    <div className="space-y-4">
      <Panel title="Appearance">
        <div className="flex gap-2">
          <Btn variant={theme === 'dark' ? 'solid' : 'ghost'} onClick={() => setTheme('dark')}>Dark</Btn>
          <Btn variant={theme === 'light' ? 'solid' : 'ghost'} onClick={() => setTheme('light')}>Light</Btn>
        </div>
      </Panel>

      <Panel title="Notifications and background">
        <div className="grid grid-cols-2 gap-4">
          <div><div className="mb-1 text-[11px] uppercase tracking-widest text-dim">Desktop notifications</div><Btn variant={prefs.notify ? 'solid' : 'ghost'} onClick={() => setPrefs({ ...prefs, notify: !prefs.notify })}>{prefs.notify ? 'On' : 'Off'}</Btn></div>
          <div><div className="mb-1 text-[11px] uppercase tracking-widest text-dim">Deadline reminders</div><Btn variant={prefs.deadlines ? 'solid' : 'ghost'} onClick={() => setPrefs({ ...prefs, deadlines: !prefs.deadlines })}>{prefs.deadlines ? 'On' : 'Off'}</Btn></div>
          <Select label="Daily digest time" any={false} value={String(prefs.digestHour)} onChange={(v) => setPrefs({ ...prefs, digestHour: Number(v) })} options={hours} />
          <Select label="Collect from sources" any={false} value={String(prefs.defaultInterval)} onChange={(v) => setPrefs({ ...prefs, defaultInterval: Number(v) })} options={INTERVALS} />
          {desktop && (
            <div><div className="mb-1 text-[11px] uppercase tracking-widest text-dim">Start with Windows</div>
              <Btn variant={login ? 'solid' : 'ghost'} disabled={login === null} onClick={() => void window.jobradar!.setLoginItem(!login).then(setLogin)}>{login ? 'On' : 'Off'}</Btn></div>
          )}
        </div>
        <p className="mt-3 text-[11px] text-dim">
          Closing the window keeps JobRadar running in the system tray, so jobs keep being collected and alerts keep firing. To stop everything, right-click the tray icon and choose Quit.
          Reminders cover saved jobs and applications still marked Interested, Saved or Preparing. Notifications are always listed in Job Alerts, even when desktop pop-ups are off.
        </p>
      </Panel>

      <Panel title="Sources" right={<Btn variant="ghost" disabled={running} onClick={() => onCollect()}>{running ? 'Collecting...' : 'Collect all now'}</Btn>}>
        {sources.length === 0 && <p className="text-xs text-dim">Backend not connected. Start it with npm run dev.</p>}
        <ul className="space-y-3">
          {sources.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line/30 pb-3 last:border-0 last:pb-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs text-cyan">
                  {s.name}
                  {s.keyMissing ? <Badge tone="warn">API key needed</Badge> : s.lastError ? <Badge tone="warn">Error</Badge> : s.lastOk ? <Badge tone="ok">OK</Badge> : <Badge tone="dim">Not run yet</Badge>}
                </div>
                <div className="text-[11px] text-dim">
                  {s.total} jobs stored{s.lastRun ? ` · last run ${timeAgo(s.lastRun)}` : ''}{s.lastAdded !== null ? ` · ${s.lastAdded} new` : ''}
                </div>
                {s.keyMissing && <div className="text-[11px] text-orange">Set {s.needsKey} in the .env file, then restart.</div>}
                {s.lastError && !s.keyMissing && <div className="text-[11px] text-warn">{s.lastError}</div>}
              </div>
              <div className="flex items-end gap-2">
                <div className="w-40"><Select label="Refresh" any={false} value={String(prefs.intervals[s.id] ?? prefs.defaultInterval)} onChange={(v) => (Number(v) === prefs.defaultInterval ? clearInterval_(s.id) : setInterval_(s.id, v))} options={INTERVALS} /></div>
                <Btn variant="ghost" disabled={running || !s.enabled} onClick={() => onCollect(s.id)}>Run</Btn>
                <Btn variant={s.enabled ? 'ghost' : 'danger'} onClick={() => onToggle(s.id, !s.enabled)}>{s.enabled ? 'Disable' : 'Enable'}</Btn>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-dim">Apply Now always opens the original page. JobRadar reads public pages politely (honours robots.txt, spaces out requests, never refreshes a source more than every 15 minutes) and never submits applications. A source that fails is retried after 5, 15 and 30 minutes, and you are warned if it keeps failing.</p>
      </Panel>

      <Panel title="Check these sites yourself">
        <ul className="space-y-3">
          {MANUAL.map((m) => (
            <li key={m.name} className="flex items-center justify-between gap-3">
              <div><div className="text-xs text-cyan">{m.name}</div><div className="text-[11px] text-dim">{m.why}</div></div>
              <Btn variant="ghost" onClick={() => openExternal(m.url)}>Open</Btn>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
