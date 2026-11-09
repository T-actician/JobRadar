import { Btn, Empty, Panel } from '../components/ui';
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

export function SettingsView({ theme, setTheme }: { theme: 'dark' | 'light'; setTheme: (t: 'dark' | 'light') => void }) {
  return (
    <div className="space-y-4">
      <Panel title="Appearance">
        <div className="flex gap-2">
          <Btn variant={theme === 'dark' ? 'solid' : 'ghost'} onClick={() => setTheme('dark')}>Dark</Btn>
          <Btn variant={theme === 'light' ? 'solid' : 'ghost'} onClick={() => setTheme('light')}>Light</Btn>
        </div>
      </Panel>
      <Panel title="Data">
        <p className="text-xs text-ink">JobRadar is showing sample listings. Live sources, refresh intervals and per-source toggles arrive in Phase 2.</p>
      </Panel>
    </div>
  );
}
