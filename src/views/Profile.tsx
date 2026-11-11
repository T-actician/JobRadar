import { useRef, useState } from 'react';
import { Badge, Btn, INPUT, Panel, Select, opts } from '../components/ui';
import { CATEGORIES, COUNTIES, DEFAULT_PROFILE, EDUCATION } from '../constants';
import { api } from '../lib/api';
import { timeAgo } from '../lib/format';
import { extractProfile } from '../lib/profile';
import { SKILL_NAMES } from '../lib/skills';
import type { Profile } from '../types';

async function toBase64(f: File): Promise<string> {
  const bytes = new Uint8Array(await f.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

const Chip = ({ label, on = true, onClick, title }: { label: string; on?: boolean; onClick: () => void; title?: string }) => (
  <button type="button" title={title} onClick={onClick} className={`border px-2 py-1 text-[11px] transition focus:outline-none focus-visible:ring-1 focus-visible:ring-orange ${on ? 'border-cyan bg-cyan/10 text-cyan' : 'border-line/50 text-dim hover:text-cyan'}`}>{label}</button>
);
const Label = ({ children }: { children: React.ReactNode }) => <div className="mb-1 text-[11px] uppercase tracking-widest text-dim">{children}</div>;

interface Props { profile: Profile; setProfile: (p: Profile) => void; log: (m: string) => void }

export function ProfileView({ profile, setProfile, log }: Props) {
  const [paste, setPaste] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [added, setAdded] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const set = (p: Partial<Profile>) => setProfile({ ...profile, ...p });

  const analyse = (text: string, name: string) => {
    const x = extractProfile(text);
    setProfile({ ...profile, hasCv: true, cvName: name, cvText: text, cvAnalysedAt: new Date().toISOString(), ...x, categories: profile.categories.length ? profile.categories : x.categories });
    setAdded(`Found ${x.skills.length} skill${x.skills.length === 1 ? '' : 's'}${x.education ? `, ${x.education}` : ''}${x.years !== null ? `, ${x.years} years of experience (${x.yearsSource})` : ''}. Please check the details below.`);
    log(`CV analysed: ${x.skills.length} skills found`);
  };
  const onFile = async (f: File) => {
    setBusy(true); setError(''); setAdded(null);
    try {
      if (f.size > 5_000_000) throw new Error('That file is larger than 5 MB.');
      analyse(await api.parseCv(f.name, await toBase64(f)), f.name);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); if (file.current) file.current.value = ''; }
  };
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <div className="space-y-4">
      <Panel title="Your CV">
        <p className="mb-3 text-[11px] text-dim">Upload a PDF, DOCX or TXT file, or paste the text. JobRadar reads it on this computer, keeps only the text in its local database, and never sends it anywhere. It uses your CV to estimate how well each job fits you.</p>
        <input ref={file} type="file" accept=".pdf,.docx,.txt,.md" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }} />
        <div className="flex flex-wrap items-center gap-3">
          <Btn disabled={busy} onClick={() => file.current?.click()}>{busy ? 'Reading...' : profile.hasCv ? 'Replace CV file' : 'Choose CV file'}</Btn>
          {profile.hasCv && <span className="text-xs text-ink">{profile.cvName || 'Pasted text'}{profile.cvAnalysedAt ? ` · analysed ${timeAgo(profile.cvAnalysedAt)}` : ''}</span>}
          {profile.hasCv && <Btn variant="danger" onClick={() => { setProfile({ ...DEFAULT_PROFILE, counties: profile.counties, remoteOk: profile.remoteOk }); setAdded(null); log('CV and detected details removed'); }}>Remove CV and details</Btn>}
        </div>
        {error && <p role="alert" className="mt-3 text-xs text-warn">{error}</p>}
        {added && <p className="mt-3 text-xs text-ok">{added}</p>}
        <label className="mt-4 block text-[11px] uppercase tracking-widest text-dim">Or paste your CV text
          <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={5} className={`${INPUT} mt-1 resize-y normal-case tracking-normal`} placeholder="Paste the text of your CV here" />
        </label>
        <Btn variant="ghost" className="mt-2" disabled={paste.trim().length < 40} onClick={() => { analyse(paste.trim(), ''); setPaste(''); }}>Analyse pasted text</Btn>
      </Panel>

      <Panel title="Details used for matching">
        <p className="mb-3 text-[11px] text-dim">Found automatically from your CV, so please correct anything wrong. Skills come from a built-in list, so only listed skills can be matched. Anything left empty is simply not compared.</p>
        <div className="grid grid-cols-2 gap-4">
          <Select label="Highest education" value={profile.education} onChange={(v) => set({ education: v })} options={opts(EDUCATION)} />
          <label className="block text-[11px] uppercase tracking-widest text-dim">Years of experience
            <input type="number" min={0} max={50} step={0.5} value={profile.years ?? ''} onChange={(e) => set({ years: e.target.value === '' ? null : Math.max(0, Math.min(50, Number(e.target.value))), yearsSource: e.target.value === '' ? '' : 'you' })} className={`${INPUT} mt-1`} placeholder="Not specified" />
            {profile.yearsSource && <span className="mt-1 block text-[10px] normal-case tracking-normal text-dim">{{ stated: 'Stated on your CV', estimated: 'Estimated from the dates on your CV', you: 'Entered by you', '': '' }[profile.yearsSource]}</span>}
          </label>
        </div>

        <div className="mt-4"><Label>Your skills</Label>
          <div className="flex flex-wrap gap-2">
            {profile.skills.map((s) => <Chip key={s} label={`${s}  ✕`} onClick={() => set({ skills: profile.skills.filter((x) => x !== s) })} title="Remove" />)}
            {profile.skills.length === 0 && <span className="text-xs text-dim">None yet. Upload a CV or add skills below.</span>}
          </div>
          <select aria-label="Add a skill" value="" onChange={(e) => e.target.value && set({ skills: [...profile.skills, e.target.value] })} className={`${INPUT} mt-2 w-64`}>
            <option value="">Add a skill...</option>
            {SKILL_NAMES.filter((s) => !profile.skills.includes(s)).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="mt-4"><Label>Fields you want to work in</Label>
          <div className="flex flex-wrap gap-2">{CATEGORIES.filter((c) => c !== 'Other').map((c) => <Chip key={c} label={c} on={profile.categories.includes(c)} onClick={() => set({ categories: toggle(profile.categories, c) })} />)}</div>
        </div>

        <div className="mt-4"><Label>Preferred counties</Label>
          <div className="flex flex-wrap items-center gap-2">
            {profile.counties.map((c) => <Chip key={c} label={`${c}  ✕`} onClick={() => set({ counties: profile.counties.filter((x) => x !== c) })} title="Remove" />)}
            <select aria-label="Add a county" value="" onChange={(e) => e.target.value && set({ counties: [...profile.counties, e.target.value] })} className={`${INPUT} w-44`}>
              <option value="">Add a county...</option>
              {COUNTIES.filter((c) => !profile.counties.includes(c)).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <Chip label={profile.remoteOk ? 'Remote jobs: included' : 'Remote jobs: not included'} on={profile.remoteOk} onClick={() => set({ remoteOk: !profile.remoteOk })} />
          </div>
        </div>
        <div className="mt-4 flex gap-2"><Badge tone="dim">Saved automatically</Badge></div>
      </Panel>
    </div>
  );
}
