import express from 'express';
import { ADAPTERS } from './sources';
import { PORT, SCHEDULER } from './config';
import { closeDb, getState, jobCount, kvAll, kvSet, lastCollected, lastNotificationId, listJobs, listNotifications, markAllRead, markDelivered, openDb, setEnabled, sourceTotals, unreadCount } from './db';
import { startScheduler, stopScheduler } from './scheduler';
import { isRunning, runAll } from './collector';
import { lastLogId, log, logSince } from './log';

const ORIGINS = new Set(['http://localhost:5173', 'http://127.0.0.1:5173', 'null']);

export async function startServer(port = PORT) {
  await openDb();
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '400kb' }));
  app.use((req, res, next) => {
    const o = req.headers.origin;
    if (o && ORIGINS.has(o)) { res.setHeader('Access-Control-Allow-Origin', o); res.setHeader('Vary', 'Origin'); }
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
    if (o && !ORIGINS.has(o)) { res.sendStatus(403); return; }
    next();
  });

  app.get('/api/health', (_q, r) => r.json({ ok: true, jobs: jobCount(), running: isRunning(), lastLog: lastLogId(), lastCollected: lastCollected(), notifSeq: lastNotificationId(), unread: unreadCount() }));
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
  // The user's own data (saved jobs, applications, searches, preferences) lives here so alerts work while the window is closed.
  const KEYS = new Set(['saved', 'recent', 'apps', 'searches', 'prefs', 'theme']);
  app.get('/api/state', (_q, r) => r.json(Object.fromEntries(Object.entries(kvAll()).filter(([k]) => KEYS.has(k)))));
  app.put('/api/state/:key', (req, res) => {
    if (!KEYS.has(req.params.key) || req.body?.value === undefined) { res.sendStatus(400); return; }
    kvSet(req.params.key, req.body.value);
    res.json({ ok: true });
  });
  app.get('/api/notifications', (req, res) => res.json(listNotifications({ undelivered: req.query.undelivered === '1', limit: 50 })));
  app.post('/api/notifications/delivered', (req, res) => {
    const ids: unknown = req.body?.ids;
    if (!Array.isArray(ids) || !ids.every((n) => Number.isInteger(n))) { res.sendStatus(400); return; }
    markDelivered(ids as number[]);
    res.json({ ok: true });
  });
  app.post('/api/notifications/read', (_q, r) => { markAllRead(); r.json({ ok: true }); });
  app.get('/api/log', (req, res) => res.json(logSince(Number(req.query.after) || 0)));

  const server = await new Promise<import('node:http').Server>((resolve) => { const s = app.listen(port, '127.0.0.1', () => resolve(s)); });
  log(`JobRadar backend listening on http://127.0.0.1:${port}`);

  if (SCHEDULER) startScheduler();
  const stop = () => { stopScheduler(); server.close(); closeDb(); process.exit(0); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
  return { server, stop };
}

if (process.argv[1] && /server[\\/]index\.ts$/.test(process.argv[1])) void startServer();
