/**
 * Warteschlange und feste Aufgaben: Job im Kontext seines Mandanten, Backoff, PermanentJobError, Obergrenze je
 * Mandant, gesperrte Mandanten, verwaiste Jobs, Dedupe, feste Aufgaben höchstens einmal gleichzeitig, Outbox.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { fullTx } from '../../src/platform/authz/view.ts';
import { emit, type OutboxConsumer } from '../../src/platform/core/events.ts';
import { dispatchOutbox } from '../../src/platform/worker/outbox.ts';
import { backoffMs, enqueue, orphanTask, PermanentJobError, Worker, type JobDefinition, type Log } from '../../src/platform/worker/queue.ts';
import { retentionTask } from '../../src/platform/worker/retention.ts';
import { createTestDb, skipDb, type TestDatabase } from './harness.ts';
import { tenant } from './api.ts';

const skip = await skipDb();
const log: Log = { info: () => undefined, warn: () => undefined, error: () => undefined };

describe('Worker', { skip }, () => {
  let db: TestDatabase, A: string, B: string;
  const seen: { tenant: string; kind: string; ctx: string | null }[] = [];
  const jobs: JobDefinition[] = [
    { kind: 'test.ok', handle: async (tx, _p, j) => { seen.push({ tenant: j.tenantId, kind: j.kind, ctx: (await tx.query('SELECT app.tenant_id()::text AS t')).rows[0].t }); return { ok: true }; } },
    { kind: 'test.fail', handle: async () => { throw new Error('vorübergehend'); } },
    { kind: 'test.permanent', handle: async () => { throw new PermanentJobError('endgültig'); } },
    { kind: 'test.slow', handle: async () => { await new Promise(r => setTimeout(r, 300)); } },
  ];
  const tenantTx = <T>(id: string, fn: Parameters<typeof fullTx<T>>[2]) => fullTx(db.worker, id, fn);
  const worker = (o: Partial<ConstructorParameters<typeof Worker>[0]> = {}) => new Worker({ db: db.worker, jobs, tasks: [], concurrency: 4, tenantLimit: 2, pollMs: 50, tenantTx, log, ...o });
  const add = (t: string, kind: string, o: Parameters<typeof enqueue>[3] = {}) => fullTx(db.runtime, t, tx => enqueue(tx, kind, { x: 1 }, o));
  const job = async (id: string) => (await db.inspect.query('SELECT status, attempts, run_at, last_error, result FROM ppm.job WHERE id = $1', [id])).rows[0];
  const runOnce = async (w: Worker) => { const c = await w.claim(10); for (const j of c) await (w as unknown as { execute(j: unknown): Promise<void> }).execute(j); return c.length; };

  before(async () => {
    db = await createTestDb();
    A = await tenant(db.runtime, 'demo');
    B = await tenant(db.runtime, 'muster');
  });
  after(async () => { await db?.drop(); });

  test('Job läuft im Kontext seines Mandanten, Ergebnis gespeichert', async () => {
    const id = (await add(A, 'test.ok'))!;
    const w = worker();
    w.start();
    for (let i = 0; i < 50 && (await job(id)).status !== 'done'; i++) await new Promise(r => setTimeout(r, 50));
    await w.stop();
    assert.equal((await job(id)).status, 'done');
    assert.deepEqual((await job(id)).result, { ok: true });
    assert.deepEqual(seen.at(-1), { tenant: A, kind: 'test.ok', ctx: A });
  });

  test('Fehler: Backoff, nach max_attempts failed; PermanentJobError sofort; unbekannte Art', async () => {
    const id = (await add(A, 'test.fail', { maxAttempts: 2 }))!;
    const w = worker();
    assert.equal(await runOnce(w), 1);
    let j = await job(id);
    assert.deepEqual([j.status, j.attempts, j.last_error], ['queued', 1, 'vorübergehend']);
    assert.ok(new Date(j.run_at).getTime() > Date.now() + 5000, 'Backoff');
    await db.inspect.query('UPDATE ppm.job SET run_at = now() WHERE id = $1', [id]);
    await runOnce(w);
    j = await job(id);
    assert.deepEqual([j.status, j.attempts], ['failed', 2]);
    const p = (await add(A, 'test.permanent'))!;
    await runOnce(w);
    assert.equal((await job(p)).status, 'failed');
    const u = (await add(A, 'test.unbekannt'))!;
    await runOnce(w);
    assert.match((await job(u)).last_error, /Unbekannte Job-Art/);
    assert.ok(backoffMs(1) >= 8000 && backoffMs(1) <= 12000 && backoffMs(20) <= 3_600_000 * 1.2);
  });

  test('Dedupe: ein offener Job je Schlüssel', async () => {
    const a = await add(A, 'test.ok', { dedupeKey: 'einmal', runAt: new Date(Date.now() + 60_000) });
    const b = await add(A, 'test.ok', { dedupeKey: 'einmal' });
    assert.ok(a);
    assert.equal(b, null);
  });

  test('Obergrenze je Mandant und gesperrte Mandanten', async () => {
    await db.inspect.query("DELETE FROM ppm.job WHERE status = 'queued'");
    for (let i = 0; i < 5; i++) await add(A, 'test.slow');
    await add(B, 'test.slow');
    const claimed = await worker().claim(10);
    const perTenant = claimed.reduce<Record<string, number>>((m, j) => ({ ...m, [j.tenant_id]: (m[j.tenant_id] ?? 0) + 1 }), {});
    assert.deepEqual(perTenant, { [A]: 2, [B]: 1 }, 'höchstens 2 je Mandant');
    assert.equal((await worker({ id: 'zweiter' }).claim(10)).length, 0, 'auch über Instanzen');
    await db.inspect.query("UPDATE ppm.job SET status = 'done' WHERE status = 'running'");
    await db.inspect.query("UPDATE ppm.tenant SET status = 'suspended' WHERE id = $1", [A]);
    assert.equal((await worker().claim(10)).length, 0, 'gesperrter Mandant: nichts abgeholt');
    await db.inspect.query("UPDATE ppm.tenant SET status = 'active' WHERE id = $1", [A]);
    await db.inspect.query("DELETE FROM ppm.job WHERE status = 'queued'");
  });

  test('verwaiste Jobs werden zurückgesetzt', async () => {
    const id = (await add(A, 'test.ok'))!;
    await db.inspect.query("UPDATE ppm.job SET status = 'running', heartbeat_at = now() - interval '20 minutes', attempts = 1 WHERE id = $1", [id]);
    await orphanTask(db.worker).run({ log });
    assert.deepEqual([(await job(id)).status, (await job(id)).last_error], ['queued', 'verwaist (kein Heartbeat)']);
    await db.inspect.query('DELETE FROM ppm.job WHERE id = $1', [id]);
  });

  test('feste Aufgabe: höchstens einmal gleichzeitig über alle Instanzen', async () => {
    let runs = 0;
    const task = { name: 'test-task', intervalMs: 60_000, run: async () => { runs++; await new Promise(r => setTimeout(r, 200)); } };
    const [a, b] = await Promise.all([worker().runTask(task), worker({ id: 'andere' }).runTask(task)]);
    assert.deepEqual([runs, [a, b].filter(Boolean).length], [1, 1]);
    assert.equal(await worker().runTask(task), true, 'danach wieder frei');
  });

  test('Outbox: Verteilung an Abnehmer im Mandanten, Fehler mit Wiederholung', async () => {
    const got: string[] = [];
    let fail = true;
    const consumers: OutboxConsumer[] = [
      { name: 'alle', types: '*', handle: async (tx, e) => { got.push(`${e.type}@${(await tx.query('SELECT app.tenant_id()::text AS t')).rows[0].t === e.tenantId}`); } },
      { name: 'wählerisch', types: ['test.b'], handle: async () => { if (fail) throw new Error('nicht jetzt'); } },
    ];
    await fullTx(db.runtime, A, tx => emit(tx, { type: 'test.a', subject: null, data: {} }));
    await fullTx(db.runtime, B, tx => emit(tx, { type: 'test.b', subject: null, data: {} }));
    assert.equal(await dispatchOutbox(db.worker, consumers, tenantTx), 1);
    assert.deepEqual(got, ['test.a@true', 'test.b@true']);
    fail = false;
    assert.equal(await dispatchOutbox(db.worker, consumers, tenantTx), 1, 'zweiter Versuch');
    assert.equal(await dispatchOutbox(db.worker, consumers, tenantTx), 0);
    const r = (await db.inspect.query("SELECT type, attempts, dispatched_at IS NOT NULL AS done FROM ppm.outbox_event WHERE type LIKE 'test.%' ORDER BY type")).rows;
    assert.deepEqual(r, [{ type: 'test.a', attempts: 1, done: true }, { type: 'test.b', attempts: 2, done: true }]);
  });

  test('Aufbewahrung löscht Erledigtes', async () => {
    await db.inspect.query("UPDATE ppm.job SET finished_at = now() - interval '30 days' WHERE status IN ('done', 'failed')");
    await retentionTask(db.worker, 14 * 86_400_000).run({ log });
    assert.equal((await db.inspect.query("SELECT count(*)::int AS n FROM ppm.job WHERE status IN ('done', 'failed')")).rows[0].n, 0);
  });
});
