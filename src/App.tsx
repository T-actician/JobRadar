import { useEffect, useMemo, useRef, useState } from 'react';
import { FilterPanel } from './components/FilterPanel';
import { CardCtx, JobList } from './components/JobCard';
import { JobDetail } from './components/JobDetail';
import { NAV, Sidebar } from './components/Sidebar';
import { Terminal, useLog } from './components/Terminal';
import { Badge, Btn, Empty, INPUT, Panel, Select } from './components/ui';
import { ENGINEERING, TECH } from './constants';
import { applyFilters, daysLeft, emptyFilters, isExpired, postedOk, sortJobs } from './lib/filters';
import { useBackend } from './lib/useBackend';
import { useLocalStorage } from './lib/useLocalStorage';
import type { AppRecord, Filters, Job, SavedSearch, Sort, View } from './types';
import { Applications } from './views/Applications';
import { Dashboard } from './views/Dashboard';
import { Alerts, SettingsView } from './views/Misc';

const PAGE = 15;
const LIST_VIEWS: View[] = ['all', 'engineering', 'technology', 'internships', 'attachments', 'graduate'];
const BASE: Partial<Record<View, (j: Job) => boolean>> = {
  engineering: (j) => ENGINEERING.includes(j.category),
  technology: (j) => TECH.includes(j.category),
  internships: (j) => j.type === 'Internship',
  attachments: (j) => j.type === 'Industrial Attachment',
  graduate: (j) => j.type === 'Graduate Trainee' || j.level === 'Graduate',
};
const SORTS: [string, string][] = [['newest', 'Newest first'], ['oldest', 'Oldest first'], ['closing', 'Closing soon'], ['relevance', 'Relevance']];

export default function App() {
  const [theme, setTheme] = useLocalStorage<'dark' | 'light'>('jr.theme', 'dark');
  const [saved, setSaved] = useLocalStorage<string[]>('jr.saved', []);
  const [recent, setRecent] = useLocalStorage<string[]>('jr.recent', []);
  const [apps, setApps] = useLocalStorage<Record<string, AppRecord>>('jr.apps', {});
  const [searches, setSearches] = useLocalStorage<SavedSearch[]>('jr.searches', []);
  const [view, setView] = useState<View>('dashboard');
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [sort, setSort] = useState<Sort>('newest');
  const [limit, setLimit] = useState(PAGE);
  const [open, setOpen] = useState<Job | null>(null);
  const { lines, log } = useLog();
  const booted = useRef(false);
  const { status, jobs, sources: srcStates, lastCollected: lastCol, running, error, reload, collect, toggle: toggleSource } = useBackend(log);
  const sourceNames = useMemo(() => [...new Set(jobs.map((j) => j.source))].sort(), [jobs]);

  useEffect(() => { document.documentElement.classList.toggle('light', theme === 'light'); }, [theme]);
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    log('System online.');
    log('Connecting to the JobRadar backend...');
  }, [log]);
  useEffect(() => setLimit(PAGE), [view, filters, sort]);

  const isList = LIST_VIEWS.includes(view);
  const base = useMemo(() => jobs.filter(BASE[view] ?? (() => true)), [jobs, view]);
  const results = useMemo(() => sortJobs(applyFilters(base, filters), sort, filters.q), [base, filters, sort]);
  const byIds = (ids: string[]) => ids.map((id) => jobs.find((j) => j.id === id)).filter((j): j is Job => !!j);

  const toggle = (j: Job) => {
    const on = saved.includes(j.id);
    setSaved(on ? saved.filter((x) => x !== j.id) : [...saved, j.id]);
    log(`${on ? 'Removed from' : 'Saved to'} saved jobs: ${j.title}`);
  };
  const openJob = (j: Job) => {
    setOpen(j);
    setRecent([j.id, ...recent.filter((x) => x !== j.id)].slice(0, 30));
    log(`Opened: ${j.title} at ${j.employer}`);
  };
  const track = (j: Job) => {
    if (!apps[j.id]) {
      setApps({ ...apps, [j.id]: { status: 'Interested', date: '', contact: '', notes: '' } });
      log(`Tracking application: ${j.title}`);
    }
    setOpen(null);
    setView('applications');
  };
  const updateApp = (id: string, p: Partial<AppRecord>) => setApps({ ...apps, [id]: { ...apps[id], ...p } });
  const removeApp = (id: string) => { const next = { ...apps }; delete next[id]; setApps(next); };
  const runSearch = (s: SavedSearch) => { setFilters(s.filters); setView('all'); log(`Ran saved search: ${s.name}`); };
  const go = (v: View, f: Partial<Filters> = {}) => { setFilters({ ...emptyFilters, ...f }); setView(v); };
  const submitSearch = () => { if (!isList) setView('all'); log(`Search: "${filters.q}"`); };

  const ctx: CardCtx = { saved, open: openJob, toggle, log };
  const live = useMemo(() => jobs.filter((j) => !isExpired(j)), [jobs]);
  const stats = [
    { label: 'Total opportunities', value: live.length, onClick: () => go('all') },
    { label: 'Posted today', value: live.filter((j) => postedOk(j, 'today')).length, onClick: () => go('all', { posted: 'today' }) },
    { label: 'Internships', value: live.filter((j) => j.type === 'Internship').length, onClick: () => go('internships') },
    { label: 'Industrial attachments', value: live.filter((j) => j.type === 'Industrial Attachment').length, onClick: () => go('attachments') },
    { label: 'Graduate programmes', value: live.filter((j) => BASE.graduate!(j)).length, onClick: () => go('graduate') },
    { label: 'Saved jobs', value: saved.length, onClick: () => go('saved') },
  ];
  const lastCollected = lastCol ?? '';
  const title = NAV.find((n) => n.id === view)!.label;
  const noMatch = { title: 'No jobs match these filters', hint: 'Remove a filter or widen the posted date to see more listings.', action: <Btn variant="ghost" onClick={() => setFilters(emptyFilters)}>Clear filters</Btn> };

  let content: React.ReactNode;
  if (view !== 'settings' && status === 'loading') {
    content = <Panel title="Connecting"><p className="text-xs text-ink">Loading jobs from the local backend...</p></Panel>;
  } else if (view !== 'settings' && status === 'error') {
    content = <Empty title="Backend not reachable" hint={`${error}. JobRadar needs its local backend. Start everything with: npm run dev`} action={<Btn variant="ghost" onClick={() => void reload()}>Retry</Btn>} />;
  } else if (view !== 'settings' && jobs.length === 0) {
    content = <Empty title={running ? 'Collecting jobs...' : 'No jobs collected yet'} hint={running ? 'The first collection takes a minute or two. Progress shows in the terminal below.' : 'Run a collection to fetch live jobs from your sources.'} action={!running && <Btn onClick={() => void collect()}>Collect now</Btn>} />;
  } else if (view === 'dashboard') {
    content = <Dashboard stats={stats} counties={live.map((j) => j.county)} latest={sortJobs(live, 'newest', '').slice(0, 5)} closing={sortJobs(live.filter((j) => (daysLeft(j.deadline) ?? 99) <= 14), 'closing', '').slice(0, 6)} lastCollected={lastCollected} ctx={ctx} onAll={() => go('all')} />;
  } else if (isList) {
    content = (
      <>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs text-dim"><span className="text-orange">{results.length}</span> results</span>
          <div className="w-44"><Select label="Sort" any={false} value={sort} onChange={(v) => setSort(v as Sort)} options={SORTS} /></div>
        </div>
        <JobList jobs={results.slice(0, limit)} ctx={ctx} empty={noMatch} />
        {results.length > limit && <div className="mt-4 text-center"><Btn variant="ghost" onClick={() => setLimit(limit + PAGE)}>Load more</Btn></div>}
      </>
    );
  } else if (view === 'saved') {
    content = <JobList jobs={byIds(saved)} ctx={ctx} empty={{ title: 'No saved jobs', hint: 'Use the bookmark on any job to keep it here.' }} />;
  } else if (view === 'recent') {
    content = <JobList jobs={byIds(recent)} ctx={ctx} empty={{ title: 'Nothing viewed yet', hint: 'Jobs you open will appear here.' }} />;
  } else if (view === 'applications') {
    content = <Applications apps={apps} jobs={jobs} onChange={updateApp} onRemove={removeApp} onOpen={openJob} />;
  } else if (view === 'alerts') {
    content = <Alerts searches={searches} onRun={runSearch} onDelete={(id) => setSearches(searches.filter((s) => s.id !== id))} />;
  } else {
    content = <SettingsView theme={theme} setTheme={setTheme} sources={srcStates} running={running} onCollect={(id) => void collect(id)} onToggle={(id, on) => void toggleSource(id, on)} />;
  }

  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <header className="flex items-center justify-between gap-4 border border-line/40 bg-panel/70 px-5 py-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-[0.3em] text-cyan">JOBRADAR</h1>
          <Badge tone={status === 'ready' ? (running ? 'cyan' : 'ok') : 'warn'}>{status !== 'ready' ? 'Offline' : running ? 'Collecting' : 'Live data'}</Badge>
        </div>
        <form className="flex gap-3" onSubmit={(e) => { e.preventDefault(); submitSearch(); }}>
          <input aria-label="Search jobs" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} placeholder="Search title, employer, skill" className={`${INPUT} w-80 py-2 text-sm`} />
          <Btn type="submit">Search</Btn>
          <Btn type="button" variant="ghost" disabled={running || status !== 'ready'} onClick={() => void collect()}>{running ? 'Collecting...' : 'Refresh'}</Btn>
        </form>
      </header>

      <div className="flex min-h-0 flex-1 gap-3">
        <Sidebar view={view} onView={(v) => setView(v)} counts={{ saved: saved.length, applications: Object.keys(apps).length }} />
        <main className="min-w-0 flex-1 overflow-y-auto pr-1">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-cyan">{title}</h2>
          {content}
        </main>
        {isList && (
          <aside className="w-72 shrink-0 overflow-y-auto">
            <FilterPanel filters={filters} setFilters={setFilters} sources={sourceNames} searches={searches}
              onSave={(name) => { setSearches([...searches, { id: String(Date.now()), name, filters }]); log(`Saved search: ${name}`); }}
              onApply={runSearch} onDelete={(id) => setSearches(searches.filter((s) => s.id !== id))} />
          </aside>
        )}
      </div>

      <div className="h-[9.5rem] shrink-0"><Terminal lines={lines} /></div>

      {open && <JobDetail job={open} saved={saved.includes(open.id)} tracked={!!apps[open.id]} onClose={() => setOpen(null)} onSave={() => toggle(open)} onTrack={() => track(open)} log={log} />}
    </div>
  );
}
