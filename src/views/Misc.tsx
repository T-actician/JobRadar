import { Badge, Btn, Empty, Panel } from '../components/ui';
import type { SourceInfo } from '../lib/api';
import { timeAgo } from '../lib/format';
import { summarize } from '../lib/filters';
import type { SavedSearch } from '../types';

export function Alerts({ searches, onRun, onDelete }: { searches: SavedSearch[]; onRun: (s: SavedSearch) => void; onDelete: (id: string) => void }) {
  if (!searches.length) return <Empty title="No alerts yet" hint="Save a search from any job list. Desktop notifications for new matches arrive in Phase 4." />;
  return (
    <Panel title="Saved searches" right={<span className="text-[11px] text-dim">Notifications: Phase 4</span>}>
      <ul className="space-y-3">
        {searches.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-3 border-b border-line/30 pb-3 last:border-0 last:pb-0">
            <div className="min-w-0"><div className="text-xs text-cyan">{s.name}</div><div className="truncate text-[11px] text-dim">{summarize(s.filters)}</div></div>
            <div className="flex gap-2"><Btn variant="ghost" onClick={() => onRun(s)}>Run</Btn><Btn variant="danger" onClick={() => onDelete(s.id)}>Delete</Btn></div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function SettingsView({ theme, setTheme, sources, running, onCollect, onToggle }: {
  theme: 'dark' | 'light'; setTheme: (t: 'dark' | 'light') => void;
  sources: SourceInfo[]; running: boolean; onCollect: (id?: string) => void; onToggle: (id: string, on: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      <Panel title="Appearance">
        <div className="flex gap-2">
          <Btn variant={theme === 'dark' ? 'solid' : 'ghost'} onClick={() => setTheme('dark')}>Dark</Btn>
          <Btn variant={theme === 'light' ? 'solid' : 'ghost'} onClick={() => setTheme('light')}>Light</Btn>
        </div>
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
              <div className="flex gap-2">
                <Btn variant="ghost" disabled={running || !s.enabled} onClick={() => onCollect(s.id)}>Run</Btn>
                <Btn variant={s.enabled ? 'ghost' : 'danger'} onClick={() => onToggle(s.id, !s.enabled)}>{s.enabled ? 'Disable' : 'Enable'}</Btn>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-dim">Apply Now always opens the original page. JobRadar reads public pages politely (honours robots.txt, one request at a time per site) and never submits applications. Automatic refresh intervals arrive in Phase 4.</p>
      </Panel>
    </div>
  );
}
