import { useCallback, useEffect, useRef, useState } from 'react';
import { Panel } from './ui';

export interface LogLine { t: string; m: string }

export function useLog() {
  const [lines, setLines] = useState<LogLine[]>([]);
  const log = useCallback((m: string) => setLines((l) => [...l.slice(-49), { t: new Date().toLocaleTimeString(), m }]), []);
  return { lines, log };
}

export function Terminal({ lines }: { lines: LogLine[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.scrollTo({ top: ref.current.scrollHeight }); }, [lines]);
  return (
    <Panel title="Terminal" right={<span className="text-[10px] tracking-widest text-cyan/70">JobRadar</span>} className="h-full">
      <div ref={ref} className="h-[5.5rem] overflow-y-auto text-xs text-term">
        {lines.map((l, i) => <div key={i}>[{l.t}] {l.m}</div>)}
      </div>
    </Panel>
  );
}
