import { useState } from 'react';
import { CATEGORIES, CLOSING, COUNTIES, EDUCATION, EXP_BUCKETS, JOB_TYPES, LEVELS, MODES, POSTED, SALARY } from '../constants';
import { emptyFilters, summarize } from '../lib/filters';
import type { Filters, SavedSearch } from '../types';
import { Btn, INPUT, Panel, Select, opts } from './ui';

interface Props {
  filters: Filters; setFilters: (f: Filters) => void; sources: string[];
  searches: SavedSearch[]; onSave: (name: string) => void; onApply: (s: SavedSearch) => void; onDelete: (id: string) => void;
}

export function FilterPanel({ filters, setFilters, sources, searches, onSave, onApply, onDelete }: Props) {
  const [name, setName] = useState('');
  const set = (k: keyof Filters) => (v: string) => setFilters({ ...filters, [k]: v });
  const active = Object.values(filters).some(Boolean);
  return (
    <div className="space-y-3">
      <Panel title="Filters" right={<button disabled={!active} onClick={() => setFilters(emptyFilters)} className="text-[11px] uppercase tracking-widest text-orange disabled:text-dim">Clear</button>}>
        <div className="space-y-3">
          <Select label="Category" value={filters.category} onChange={set('category')} options={opts(CATEGORIES)} />
          <Select label="Employment type" value={filters.type} onChange={set('type')} options={opts(JOB_TYPES)} />
          <Select label="Career level" value={filters.level} onChange={set('level')} options={opts(LEVELS)} />
          <Select label="Experience" value={filters.exp} onChange={set('exp')} options={opts(Object.keys(EXP_BUCKETS))} />
          <Select label="County" value={filters.county} onChange={set('county')} options={opts(COUNTIES)} />
          <Select label="Work mode" value={filters.mode} onChange={set('mode')} options={opts(MODES)} />
          <Select label="Education" value={filters.education} onChange={set('education')} options={opts(EDUCATION)} />
          <Select label="Posted" value={filters.posted} onChange={set('posted')} options={POSTED} />
          <Select label="Closing" value={filters.closing} onChange={set('closing')} options={CLOSING} />
          <Select label="Salary" value={filters.salary} onChange={set('salary')} options={SALARY} />
          <Select label="Source" value={filters.source} onChange={set('source')} options={opts(sources)} />
          <label className="block text-[11px] uppercase tracking-widest text-dim">Company
            <input value={filters.company} onChange={(e) => set('company')(e.target.value)} placeholder="Employer name" className={`${INPUT} mt-1`} />
          </label>
        </div>
      </Panel>
      <Panel title="Saved searches">
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim() && active) { onSave(name.trim()); setName(''); } }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name this search" className={INPUT} />
          <Btn type="submit" disabled={!active || !name.trim()} className="disabled:opacity-40">Save</Btn>
        </form>
        {searches.length === 0 && <p className="mt-3 text-[11px] text-dim">Set filters, name them, and reuse them later.</p>}
        <ul className="mt-3 space-y-2">
          {searches.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 text-xs">
              <button onClick={() => onApply(s)} title={summarize(s.filters)} className="truncate text-cyan hover:text-orange">{s.name}</button>
              <button onClick={() => onDelete(s.id)} aria-label={`Delete ${s.name}`} className="text-dim hover:text-warn">✕</button>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
