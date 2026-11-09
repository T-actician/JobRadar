import { useEffect, useMemo, useRef, useState } from 'react';
import { FilterPanel } from './components/FilterPanel';
import { CardCtx, JobList } from './components/JobCard';
import { JobDetail } from './components/JobDetail';
import { NAV, Sidebar } from './components/Sidebar';
import { Terminal, useLog } from './components/Terminal';
import { Badge, Btn, INPUT, Select } from './components/ui';
import { ENGINEERING, TECH } from './constants';
import { SAMPLE_JOBS } from './data/sampleJobs';
import { applyFilters, daysLeft, emptyFilters, isExpired, postedOk, sortJobs } from './lib/filters';
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
const SOURCES = [...new Set(SAMPLE_JOBS.map((j) => j.source))].sort();

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

  useEffect(() => { document.documentElement.classList.toggle('light', theme === 'light'); }, [theme]);
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    log('System online.');
    log(`Loaded ${SAMPLE_JOBS.length} sample listings (Phase 1, live sources arrive in Phase 2).`);
  }, [log]);
  useEffect(() => setLimit(PAGE), [view, filters, sort]);

  const isList = LIST_VIEWS.includes(view);
  const base = useMemo(() => SAMPLE_JOBS.filter(BASE[view] ?? (() => true)), [view]);
  const results = useMemo(() => sortJobs(applyFilters(base, filters), sort, filters.q), [base, filters, sort]);
  const byIds = (ids: string[]) => ids.map((id) => SAMPLE_JOBS.find((j) => j.id === id)).filter((j): j is Job => !!j);

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
  const live = SAMPLE_JOBS.filter((j) => !isExpired(j));
  const stats = [
    { label: 'Total opportunities', value: live.length, onClick: () => go('all') },
    { label: 'Posted today', value: live.filter((j) => postedOk(j, 'today')).length, onClick: () => go('all', { posted: 'today' }) },
    { label: 'Internships', value: live.filter((j) => j.type === 'Internship').length, onClick: () => go('internships') },
    { label: 'Industrial attachments', value: live.filter((j) => j.type === 'Industrial Attachment').length, onClick: () => go('attachments') },
    { label: 'Graduate programmes', value: live.filter((j) => BASE.graduate!(j)).length, onClick: () => go('graduate') },
    { label: 'Saved jobs', value: saved.length, onClick: () => go('saved') },
  ];
  const lastCollected = SAMPLE_JOBS.reduce((m, j) => (j.collected > m ? j.collected : m), SAMPLE_JOBS[0].collected);
  const title = NAV.find((n) => n.id === view)!.label;
  const noMatch = { title: 'No jobs match these filters', hint: 'Remove a filter or widen the posted date to see more listings.', action: <Btn variant="ghost" onClick={() => setFilters(emptyFilters)}>Clear filters</Btn> };

  let content: React.ReactNode;
  if (view === 'dashboard') {
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
    content = <Applications apps={apps} jobs={SAMPLE_JOBS} onChange={updateApp} onRemove={removeApp} onOpen={openJob} />;
  } else if (view === 'alerts') {
    content = <Alerts searches={searches} onRun={runSearch} onDelete={(id) => setSearches(searches.filter((s) => s.id !== id))} />;
  } else {
    content = <SettingsView theme={theme} setTheme={setTheme} />;
  }

  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <header className="flex items-center justify-between gap-4 border border-line/40 bg-panel/70 px-5 py-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-[0.3em] text-cyan">JOBRADAR</h1>
          <Badge>Sample data</Badge>
        </div>
        <form className="flex gap-3" onSubmit={(e) => { e.preventDefault(); submitSearch(); }}>
          <input aria-label="Search jobs" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} placeholder="Search title, employer, skill" className={`${INPUT} w-80 py-2 text-sm`} />
          <Btn type="submit">Search</Btn>
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
            <FilterPanel filters={filters} setFilters={setFilters} sources={SOURCES} searches={searches}
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
