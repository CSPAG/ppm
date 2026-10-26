/**
 * Prozess `worker`: Warteschlange (Jobs der Module), Verteilung der Outbox, Aufräumen (Rate-Limit, Replay-Schutz,
 * Aufbewahrung), verwaiste Jobs und Mitgliederabgleich. Dazu der Betriebs-Endpunkt. Ungültige Konfiguration: Exit 78.
 */
import pino from 'pino';
import { fullTx } from '../authz/view.ts';
import { loadOrExit } from '../config/env.ts';
import { REDACT_PATHS } from '../core/redact.ts';
import { createPool } from '../db/pool.ts';
import { OUTBOX_CONSUMERS } from '../modules/index.ts';
import { JOBS, TASKS } from '../modules/jobs.ts';
import { Runtime } from '../ops/runtime.ts';
import { startOpsServer } from '../ops/server.ts';
import { memberSync } from '../worker/member-sync.ts';
import { outboxTask } from '../worker/outbox.ts';
import { orphanTask, Worker } from '../worker/queue.ts';
import { retentionTask, sharedStateTask } from '../worker/retention.ts';

const cfg = loadOrExit(process.env, 'worker');
const log = pino({ level: cfg.log.level, redact: REDACT_PATHS, base: { service: 'worker' } });
const db = createPool(cfg.iam.db.workerUrl, cfg, 'ppm-worker');
const tenantTx = <T>(tenantId: string, fn: (tx: import('../db/pool.ts').Tx) => Promise<T>) => fullTx(db, tenantId, fn);

const worker = new Worker({
  db, log, tenantTx,
  jobs: JOBS(cfg),
  tasks: [outboxTask(db, [...OUTBOX_CONSUMERS], tenantTx), orphanTask(db), retentionTask(db, cfg.worker.retentionMs), sharedStateTask(db), ...TASKS],
  concurrency: cfg.worker.concurrency, tenantLimit: cfg.worker.tenantLimit, pollMs: cfg.worker.pollMs,
});
const sync = memberSync(cfg.iam, db, log);

const runtime = new Runtime({ shutdownDelayMs: cfg.ops.shutdownDelayMs, shutdownTimeoutMs: cfg.ops.shutdownTimeoutMs, log }).install();
const ops = await startOpsServer({
  host: cfg.ops.host, port: cfg.ops.port, metrics: cfg.ops.metrics, ready: () => runtime.ready,
  checks: [{ name: 'datenbank', failure: 'Datenbank nicht erreichbar', run: () => db.query('SELECT 1') }],
});
runtime
  .onShutdown('worker', () => worker.stop())
  .onShutdown('member-sync', async () => { await sync.stop(); })
  .onShutdown('ops', () => new Promise(r => ops.close(() => r(undefined))))
  .onShutdown('db', () => db.end());

worker.start();
sync.start();
log.info({ id: worker.id, concurrency: cfg.worker.concurrency, ops: cfg.ops.port }, 'Worker bereit');
