/**
 * Profil outbox, Modul «webhooks»: Verwaltung nur mit webhook:admin, Geheimnis nur einmal und verschlüsselt,
 * Zustellung nach Standard Webhooks (Signatur), Wiederholung bei Fehlern, SSRF-Schutz, feste Gesamtfrist und
 * Grössengrenze bei tröpfchenweise bzw. zu grossen Antworten, Rotation der Schlüssel.
 */
import assert from 'node:assert/strict';
import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, test } from 'node:test';
import { fullTx } from '../../src/platform/authz/view.ts';
import { open } from '../../src/platform/core/crypto.ts';
import { checkUrl, isBlockedAddress, safeFetch, SsrfError } from '../../src/platform/core/ssrf.ts';
import { OUTBOX_CONSUMERS, ROTATIONS } from '../../src/platform/modules/index.ts';
import { JOBS } from '../../src/platform/modules/jobs.ts';
import { newSecret, verify } from '../../src/platform/modules/webhooks/index.ts';
import { rotateKeys } from '../../src/platform/ops/rotation.ts';
import { dispatchOutbox } from '../../src/platform/worker/outbox.ts';
import { Worker, type Log } from '../../src/platform/worker/queue.ts';
import { fullView } from '@vollholz/iam';
import { model } from '../../src/platform/authz/model.ts';
import { createTestDb, skipDb, type TestDatabase } from './harness.ts';
import { json, member, testApi, type TestApi } from './api.ts';

const skip = await skipDb();
const log: Log = { info: () => undefined, warn: () => undefined, error: () => undefined };

describe('Webhooks', { skip }, () => {
  let db: TestDatabase, t: TestApi, admin: string, editor: string, receiver: Server, base: string;
  let status = 200;
  const got: { headers: IncomingHttpHeaders; body: string }[] = [];

  before(async () => {
    db = await createTestDb();
    t = await testApi(db.runtime);
    await member(db.runtime, 'demo', 'olga', 'org-admin', 2);
    await member(db.runtime, 'demo', 'emil', 'editor');
    admin = await t.token({ sub: 'olga', org: 'demo' });
    editor = await t.token({ sub: 'emil', org: 'demo' });
    receiver = createServer((req, res) => {
      let body = '';
      req.on('data', c => { body += c; });
      req.on('end', () => {
        if (req.url === '/langsam') { res.writeHead(200); const i = setInterval(() => res.write('.'), 100); res.on('close', () => clearInterval(i)); return; }
        if (req.url === '/gross') { res.writeHead(200); res.end('x'.repeat(200_000)); return; }
        got.push({ headers: req.headers, body }); res.writeHead(status); res.end('ok');
      });
    });
    await new Promise<void>(r => receiver.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${(receiver.address() as AddressInfo).port}`;
  });
  after(async () => { receiver?.closeAllConnections(); receiver?.close(); await t?.close(); await db?.drop(); });

  const worker = () => new Worker({ db: db.worker, jobs: JOBS(t.cfg), tasks: [], concurrency: 2, tenantLimit: 2, pollMs: 50, tenantTx: (id, fn) => fullTx(db.worker, id, fn), log });
  const drain = async () => {
    await dispatchOutbox(db.worker, [...OUTBOX_CONSUMERS], (id, fn) => fullTx(db.worker, id, fn));
    const w = worker();
    for (let i = 0; i < 5; i++) { const c = await w.claim(10); for (const j of c) await (w as unknown as { execute(j: unknown): Promise<void> }).execute(j); if (!c.length) break; }
  };

  test('nur org-admin verwaltet Webhooks; Geheimnis einmal, verschlüsselt gespeichert', async () => {
    assert.equal((await t.req({ method: 'GET', url: '/v1/webhooks', token: editor })).statusCode, 403);
    const r = await t.req({ method: 'POST', url: '/v1/webhooks', token: admin, payload: { url: `${base}/hook`, events: ['projekt.created'] } });
    assert.equal(r.statusCode, 201, r.body);
    const { webhook, secret } = json(r);
    assert.match(secret, /^whsec_/);
    assert.ok(!(await t.req({ method: 'GET', url: `/v1/webhooks/${webhook.id}`, token: admin })).body.includes(secret));
    const row = (await db.inspect.query('SELECT tenant_id, secret_enc FROM ppm.webhook WHERE id = $1', [webhook.id])).rows[0];
    assert.ok(!row.secret_enc.toString('utf8').includes(secret.slice(6)));
    assert.equal(open(t.cfg.iam.encryptionKeys, row.tenant_id, row.secret_enc, `webhook:${webhook.id}`), secret);
    const bad = await t.req({ method: 'POST', url: '/v1/webhooks', token: admin, payload: { url: 'ftp://x.example/hook', events: ['*'] } });
    assert.equal(bad.statusCode, 422);
    (globalThis as { secret?: string }).secret = secret;
  });

  test('Ereignis → signierte Zustellung (Standard Webhooks, CloudEvent); Fehler → neuer Versuch', async () => {
    const secret = (globalThis as { secret?: string }).secret!;
    const p = json(await t.req({ method: 'POST', url: '/v1/projekte', token: admin, payload: { label: 'Webhook-Test' } }));
    await drain();
    assert.equal(got.length, 1);
    const h = got[0]!;
    assert.ok(verify(secret, h.headers as Record<string, string>, h.body), 'Signatur gültig');
    assert.ok(!verify(newSecret(), h.headers as Record<string, string>, h.body), 'anderes Geheimnis');
    assert.ok(!verify(secret, h.headers as Record<string, string>, `${h.body} `), 'veränderter Inhalt');
    const ce = JSON.parse(h.body);
    assert.deepEqual([ce.specversion, ce.type, ce.subject, ce.data.id], ['1.0', 'ch.project-suite.ppm.projekt.created', `projekt/${p.id}`, p.id]);
    assert.equal(h.headers['webhook-id'], ce.id);

    status = 500;
    await t.req({ method: 'POST', url: '/v1/projekte', token: admin, payload: { label: 'Fehlschlag' } });
    await drain();
    const d = (await db.inspect.query("SELECT status, attempts, response_status, last_error FROM ppm.webhook_delivery ORDER BY created_at DESC LIMIT 1")).rows[0];
    assert.deepEqual([d.status, d.attempts, d.response_status], ['pending', 1, 500]);
    const next = (await db.inspect.query("SELECT count(*)::int AS n FROM ppm.job WHERE kind = 'webhook.deliver' AND status = 'queued' AND run_at > now()")).rows[0].n;
    assert.equal(next, 1, 'neuer Versuch mit Backoff geplant');
    status = 200;
    const list = json(await t.req({ method: 'GET', url: `/v1/webhooks/${json(await t.req({ method: 'GET', url: '/v1/webhooks', token: admin })).items[0].id}/deliveries`, token: admin }));
    assert.equal(list.items.length, 2);
  });

  test('SSRF: private, lokale und Link-Local-Adressen gesperrt', async () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.1.1', '169.254.169.254', '::1', 'fd00::1', '::ffff:127.0.0.1', '100.64.0.1']) assert.ok(isBlockedAddress(ip), ip);
    assert.ok(!isBlockedAddress('8.8.8.8'));
    for (const u of ['http://localhost/x', 'http://127.0.0.1/x', 'http://[::1]/x', 'http://169.254.169.254/latest', 'http://user:pw@example.com/', 'file:///etc/passwd', 'http://example.com:22/']) {
      assert.throws(() => checkUrl(u), SsrfError, u);
    }
    await assert.rejects(safeFetch(`${base}/hook`, { timeoutMs: 1000, maxBytes: 1000 }), SsrfError, 'ohne allowPrivate auch nach dem Auflösen');
  });

  test('feste Gesamtfrist bei tröpfchenweiser Antwort, Grössengrenze', async () => {
    const t0 = Date.now();
    await assert.rejects(safeFetch(`${base}/langsam`, { timeoutMs: 400, maxBytes: 1_000_000, allowPrivate: true }), SsrfError);
    assert.ok(Date.now() - t0 < 2000, 'nicht durch Leerlauf-Zeitlimit verlängert');
    const r = await safeFetch(`${base}/gross`, { timeoutMs: 2000, maxBytes: 1000, allowPrivate: true });
    assert.deepEqual([r.truncated, r.body.length <= 1000], [true, true]);
  });

  test('Rotation: Geheimnisse mit neuem Hauptschlüssel neu versiegeln', async () => {
    const old = t.cfg.iam.encryptionKeys;
    const keys = [{ id: 'k2', key: Buffer.alloc(32, 9) }, ...old];
    const before = (await rotateKeys(db.owner, db.runtime, keys, [...ROTATIONS], { dryRun: true, settings: fullView(model) }));
    assert.equal(before.webhooks, 1);
    await rotateKeys(db.owner, db.runtime, keys, [...ROTATIONS], { dryRun: false, settings: fullView(model) });
    const row = (await db.inspect.query('SELECT id, tenant_id, secret_enc FROM ppm.webhook')).rows[0];
    assert.equal(open([keys[0]!], row.tenant_id, row.secret_enc, `webhook:${row.id}`), (globalThis as { secret?: string }).secret);
    assert.equal((await rotateKeys(db.owner, db.runtime, keys, [...ROTATIONS], { dryRun: true, settings: fullView(model) })).webhooks, 0);
  });
});
