export interface LogEntry { id: number; t: string; m: string; level: 'info' | 'warn' | 'error' }
const buf: LogEntry[] = [];
let seq = 0;

export function log(m: string, level: LogEntry['level'] = 'info'): void {
  buf.push({ id: ++seq, t: new Date().toISOString(), m, level });
  if (buf.length > 300) buf.shift();
  if (process.env.JOBRADAR_QUIET !== '1') console.log(`[${level}] ${m}`);
}
export const logSince = (after: number): LogEntry[] => buf.filter((e) => e.id > after);
export const lastLogId = (): number => seq;
