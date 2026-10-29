/**
 * Ereignisse und Webhooks (Profil outbox): Ereignis in der Transaktion, Verteilung an Abonnements desselben Mandanten,
 * Zustellung als CloudEvent mit Signatur nach Standard Webhooks, erneute Versuche, SSRF-Schutz.
 */
import assert from 'node:assert/strict';
import { createServer, type IncomingMessage } from 'node:http';
import { dbTests, postgresSkip } from '@vollholz/iam-testkit';
import { createMailer, isPublicAddress, outboxTask, resolveTarget, safeRequest } from '@vollholz/platform';
import { app } from '../../src/app.ts';
import { verify } from '../../src/modules/webhooks/index.ts';
import { platform } from '../../src/platform.ts';

const CONSUMERS = app.modules.flatMap(m => m.consumers ?? []);
const TASKS = app.modules.flatMap(m => m.tasks ?? []);
import { login, testApi, type TestApi } from './api.ts';

const { after, before, describe, test } = dbTests(await postgresSkip());
const quiet = { info() {}, warn() {}, error() {} };

test('SSRF: private und reservierte Adressen gesperrt', async () => {
  for (const a of ['127.0.0.1', '10.1.2.3', '169.254.169.254', '192.168.1.1', '::1', 'fe80::1', '100.64.0.1', '0.0.0.0']) assert.equal(isPublicAddress(a), false, a);
  assert.equal(isPublicAddress('8.8.8.8'), true);
  assert.equal(isPublicAddress('2001:4860:4860::8888'), true);
  assert.equal(isPublicAddress('::ffff:127.0.0.1'), false);
  assert.equal(isPublicAddress('::ffff:8.8.8.8'), true);
  await assert.rejects(resolveTarget('http://127.0.0.1/x'), /nicht öffentliche/);
  await assert.rejects(resolveTarget('http://[::1]/x'), /nicht öffentliche/);
  await assert.rejects(resolveTarget('file:///etc/passwd'), /Nur http/);
  await assert.rejects(resolveTarget('http://a:b@example.ch/'), /Zugangsdaten/);
  assert.equal((await resolveTarget('http://127.0.0.1/x', { allowPrivate: true })).address, '127.0.0.1');
});

test('Zustellung: feste Frist auch bei tröpfchenweiser Antwort, Grössengrenze beendet das Lesen', async () => {
  const { createServer: srv } = await import('node:http');
  // Antwortet alle 50 ms mit einem Byte und endet nie: das Leerlauf-Zeitlimit allein griffe nie
  const slow = srv((_req, res) => { res.writeHead(200); const t = setInterval(() => res.write('x'), 50); res.on('close', () => clearInterval(t)); });
  await new Promise<void>(r => slow.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${(slow.address() as { port: number }).port}/`;
  try {
    const started = Date.now();
    await assert.rejects(safeRequest(url, { timeoutMs: 400, allowPrivate: true }), /Zeitlimit 400 ms/);
    assert.ok(Date.now() - started < 2000, 'Frist eingehalten');
    const r = await safeRequest(url, { timeoutMs: 5000, allowPrivate: true, maxBytes: 3 });
    assert.deepEqual([r.status, r.body], [200, 'xxx']);
  } finally { slow.closeAllConnections(); slow.close(); }
});

describe('Webhooks', () => {
  let api: TestApi;
  let admin: Record<string, string>, other: Record<string, string>;
  const received: { headers: IncomingMessage['headers']; body: string }[] = [];
  let failNext = 0;
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => { received.push({ headers: req.headers, body }); res.writeHead(failNext-- > 0 ? 503 : 204).end(); });
  });
  let url = '';

  before(async () => {
    api = await testApi();
    admin = { authorization: (await login(api, 'demo', 'w-admin', 'org-admin')).authorization };
    other = { authorization: (await login(api, 'andere', 'w-other', 'org-admin')).authorization };
    await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
    url = `http://127.0.0.1:${(server.address() as { port: number }).port}/hook`;
  });
  after(async () => { server.close(); await api?.close(); });

  const ctx = () => ({ db: api.t.worker, cfg: api.cfg, log: quiet, platform: platform.context, admin: null, mailer: createMailer(api.cfg, quiet) });
  const deliver = async () => { await outboxTask(CONSUMERS).run(ctx()); for (const t of TASKS) await t.run(ctx()); };

  test('nur org-admin verwaltet Webhooks; Geheimnis nur beim Anlegen', async () => {
    const editor = { authorization: (await login(api, 'demo', 'w-editor', 'alle-lesen')).authorization };
    assert.equal((await api.app.inject({ method: 'GET', url: '/v1/webhooks', headers: editor })).statusCode, 403);
    const c = await api.app.inject({ method: 'POST', url: '/v1/webhooks', headers: admin, payload: { url, eventTypes: ['handlungsfeld.created'] } });
    assert.equal(c.statusCode, 201, c.body);
    assert.match(c.json().secret, /^whsec_/);
    const l = await api.app.inject({ method: 'GET', url: '/v1/webhooks', headers: admin });
    assert.ok(!l.body.includes('whsec_'));
    // Verschlüsselt gespeichert
    const raw = (await api.t.inspect.query('SELECT secret_enc FROM ppm.webhook_subscription')).rows[0].secret_enc as string;
    assert.match(raw, /^v1\.t1\./);
    (globalThis as { secret?: string }).secret = c.json().secret;
  });

  test('Zustellung: CloudEvent, signiert, nur an Abonnements desselben Mandanten, Wiederholung nach Fehler', async () => {
    const secret = (globalThis as { secret?: string }).secret!;
    await api.app.inject({ method: 'POST', url: '/v1/handlungsfelder', headers: other, payload: { label: 'Fremd' } });
    failNext = 1;
    const s = await api.app.inject({ method: 'POST', url: '/v1/handlungsfelder', headers: admin, payload: { label: 'Patientenorientierung' } });
    assert.equal(s.statusCode, 201);
    await deliver();
    assert.equal(received.length, 1, 'erster Versuch (503)');
    await api.t.worker.query("UPDATE ppm.webhook_delivery SET next_attempt_at = now() WHERE status = 'pending'");
    await deliver();
    assert.equal(received.length, 2);
    const last = received[1]!;
    const event = JSON.parse(last.body);
    assert.equal(event.specversion, '1.0');
    assert.equal(event.type, 'ch.ppm.handlungsfeld.created');
    assert.equal(event.source, 'http://api.test/organisationen/demo');
    assert.equal(event.data.label, 'Patientenorientierung');
    assert.equal(last.headers['content-type'], 'application/cloudevents+json');
    assert.ok(verify(secret, last.headers as Record<string, string>, last.body), 'Signatur nach Standard Webhooks');
    assert.ok(!received.some(r => r.body.includes('Fremd')), 'Ereignisse anderer Organisationen nie');
    const d = (await api.t.inspect.query("SELECT status, attempts, last_status FROM ppm.webhook_delivery")).rows;
    assert.deepEqual(d, [{ status: 'delivered', attempts: 2, last_status: 204 }]);
  });

  test('Zustellung überlebt die Aufbewahrung der Outbox (002_webhooks)', async () => {
    failNext = 1;
    const before = received.length;
    assert.equal((await api.app.inject({ method: 'POST', url: '/v1/handlungsfelder', headers: admin, payload: { label: 'Wirtschaftlichkeit' } })).statusCode, 201);
    await deliver();
    assert.equal(received.length, before + 1, 'erster Versuch scheitert (503)');
    // Aufbewahrung entfernt das verteilte Ereignis, bevor der nächste Versuch fällig ist
    const removed = await api.t.worker.query("DELETE FROM ppm.outbox_event WHERE dispatched_at IS NOT NULL");
    assert.ok((removed.rowCount ?? 0) >= 1);
    await api.t.worker.query("UPDATE ppm.webhook_delivery SET next_attempt_at = now() WHERE status = 'pending'");
    await deliver();
    assert.equal(received.length, before + 2, 'Wiederholung ohne Outbox-Ereignis');
    assert.equal(JSON.parse(received.at(-1)!.body).data.label, 'Wirtschaftlichkeit');
  });

  test('Aufbewahrung: abgeschlossene Zustellungen nach OUTBOX_RETENTION gelöscht, offene bleiben', async () => {
    const task = TASKS.find(t => t.name === 'webhooks.retention')!;
    await api.t.worker.query("UPDATE ppm.webhook_delivery SET delivered_at = now() - interval '30 days' WHERE status = 'delivered'");
    await api.t.worker.query("INSERT INTO ppm.webhook_delivery (tenant_id, subscription_id, event_id, event_type, event_data, event_created_at, next_attempt_at) SELECT tenant_id, subscription_id, gen_random_uuid(), event_type, event_data, event_created_at, now() - interval '30 days' FROM ppm.webhook_delivery LIMIT 1");
    await task.run(ctx());
    const rows = (await api.t.inspect.query('SELECT status FROM ppm.webhook_delivery')).rows;
    assert.deepEqual(rows, [{ status: 'pending' }], 'nur die offene Zustellung bleibt');
  });
});
