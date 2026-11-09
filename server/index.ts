import express from 'express';
import { ADAPTERS } from './sources';
import { AUTO_COLLECT, PORT, STALE_MINUTES } from './config';
import { closeDb, getState, jobCount, lastCollected, listJobs, openDb, setEnabled, sourceTotals } from './db';
import { isRunning, runAll } from './collector';
import { lastLogId, log, logSince } from './log';

const ORIGINS = new Set(['http://localhost:5173', 'http://127.0.0.1:5173', 'null']);

export async function startServer(port = PORT) {
  await openDb();
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '10kb' }));
  app.use((req, res, next) => {
    const o = req.headers.origin;
    if (o && ORIGINS.has(o)) { res.setHeader('Access-Control-Allow-Origin', o); res.setHeader('Vary', 'Origin'); }
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
    if (o && !ORIGINS.has(o)) { res.sendStatus(403); return; }
    next();
  });

  app.get('/api/health', (_q, r) => r.json({ ok: true, jobs: jobCount(), running: isRunning(), lastLog: lastLogId(), lastCollected: lastCollected() }));
  app.get('/api/jobs', (_q, r) => r.json({ jobs: listJobs(), lastCollected: lastCollected() }));
  app.get('/api/sources', (_q, r) => {
    const totals = sourceTotals();
    r.json(ADAPTERS.map((a) => {
      const s = getState(a.id);
      return { id: a.id, name: a.name, homepage: a.homepage, kind: a.kind, enabled: !!s.enabled, needsKey: a.needsKey ?? null,
        keyMissing: !!a.needsKey && !process.env[a.needsKey], lastRun: s.last_run, lastOk: s.last_ok, lastFound: s.last_found,
        lastAdded: s.last_added, lastError: s.last_error, total: totals[a.name] ?? 0 };
    }));
  });
  app.post('/api/collect', (req, res) => {
    const only = typeof req.query.source === 'string' ? req.query.source : undefined;
    if (only && !ADAPTERS.some((a) => a.id === only)) { res.status(404).json({ error: 'Unknown source' }); return; }
    if (isRunning()) { res.status(409).json({ error: 'A collection is already running' }); return; }
    void runAll(only);
    res.status(202).json({ started: true });
  });
  app.patch('/api/sources/:id', (req, res) => {
    if (!ADAPTERS.some((a) => a.id === req.params.id) || typeof req.body?.enabled !== 'boolean') { res.sendStatus(400); return; }
    setEnabled(req.params.id, req.body.enabled);
    res.json({ ok: true });
  });
  app.get('/api/log', (req, res) => res.json(logSince(Number(req.query.after) || 0)));

  const server = await new Promise<import('node:http').Server>((resolve) => { const s = app.listen(port, '127.0.0.1', () => resolve(s)); });
  log(`JobRadar backend listening on http://127.0.0.1:${port}`);

  if (AUTO_COLLECT) {
    const stale = ADAPTERS.some((a) => { const r = getState(a.id).last_run; return getState(a.id).enabled && (!r || Date.now() - new Date(r).getTime() > STALE_MINUTES * 60000); });
    if (stale) { log('Some sources are stale, collecting in the background...'); void runAll(); }
  }
  const stop = () => { server.close(); closeDb(); process.exit(0); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
  return { server, stop };
}

if (process.argv[1] && /server[\\/]index\.ts$/.test(process.argv[1])) void startServer();
