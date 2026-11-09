import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function Panel({ title, right, children, className = '' }: { title?: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`relative border border-line/40 bg-panel/70 ${className}`}>
      <i className="pointer-events-none absolute -left-px -top-px h-3 w-3 border-l-2 border-t-2 border-cyan" />
      <i className="pointer-events-none absolute -bottom-px -right-px h-3 w-3 border-b-2 border-r-2 border-cyan" />
      {title && (
        <header className="flex items-center justify-between px-4 pt-3">
          <h2 className="text-xs font-bold uppercase tracking-[0.25em] text-cyan">{title}</h2>
          {right}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

const VARIANTS = {
  solid: 'bg-cyan text-bg hover:brightness-110',
  ghost: 'border border-cyan/60 text-cyan hover:bg-cyan/10',
  danger: 'border border-warn/60 text-warn hover:bg-warn/10',
};
export function Btn({ variant = 'solid', className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof VARIANTS }) {
  return <button {...p} className={`px-3 py-1.5 text-xs font-bold uppercase tracking-widest transition focus:outline-none focus-visible:ring-1 focus-visible:ring-orange ${VARIANTS[variant]} ${className}`} />;
}

export const INPUT = 'block w-full border border-line/50 bg-bg px-2 py-1.5 text-xs text-orange placeholder:text-dim focus:border-cyan focus:outline-none';

export function Select({ label, value, onChange, options, any = true }: { label: string; value: string; onChange: (v: string) => void; options: readonly (readonly [string, string])[]; any?: boolean }) {
  return (
    <label className="block text-[11px] uppercase tracking-widest text-dim">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className={`${INPUT} mt-1 normal-case tracking-normal`}>
        {any && <option value="">Any</option>}
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}
export const opts = (a: readonly string[]) => a.map((x) => [x, x] as const);

export const Field = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0">
    <div className="text-[10px] uppercase tracking-widest text-dim">{label}</div>
    <div className="truncate text-xs text-orange">{value}</div>
  </div>
);

export const Badge = ({ children, tone = 'orange' }: { children: ReactNode; tone?: 'orange' | 'cyan' | 'warn' | 'ok' | 'dim' }) => {
  const t = { orange: 'border-orange text-orange', cyan: 'border-cyan text-cyan', warn: 'border-warn text-warn', ok: 'border-ok text-ok', dim: 'border-dim text-dim' }[tone];
  return <span className={`border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${t}`}>{children}</span>;
};

export const Empty = ({ title, hint, action }: { title: string; hint: string; action?: ReactNode }) => (
  <Panel><div className="py-8 text-center"><p className="text-sm text-cyan">{title}</p><p className="mx-auto mt-2 max-w-md text-xs text-dim">{hint}</p>{action && <div className="mt-4">{action}</div>}</div></Panel>
);
