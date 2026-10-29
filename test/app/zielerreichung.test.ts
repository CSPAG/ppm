/**
 * Zielerreichung je Quartal (BC ZM.03.01; UC-012 Schritte 1–2; Kernablauf K6 Schritt 10; AP-E6-3): Tabelle mit
 * strategischen Zielen und Jahreszielen des Jahres, Stand mit Kommentar, Datum und Person, letzter Stand aus dem
 * Vorquartal, Fortschritt, ETag/If-Match, Rechte, Audit und Ereignis.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { dbTests, postgresSkip } from '@vollholz/iam-testkit';
import { full } from './harness.ts';
import { login, testApi, type TestApi } from './api.ts';

const { after, before, describe, test } = dbTests(await postgresSkip());

interface Ziel { typ: string; id: string; nummer: string; eintrag: { id: string; stand: string; beurteilung: string; version: number; erfasstVon: { name: string | null } | null } | null; letzter: { quartal: string; stand: string } | null }

describe('Zielerreichung', () => {
  let api: TestApi;
  let gl: Record<string, string>, leser: Record<string, string>, ue: Record<string, string>;
  let tenantId: string;
  let ziel31 = '', jz2026 = '', jz2027 = '';

  before(async () => {
    api = await testApi();
    const e = await login(api, 'demo', 'u-gl-ze', 'alle-fuehren');
    tenantId = e.tenantId;
    gl = { authorization: e.authorization };
    leser = { authorization: (await login(api, 'demo', 'u-leser-ze', 'mitglied')).authorization };
    ue = { authorization: (await login(api, 'demo', 'u-ue-ze', 'alle-fuehren')).authorization };
    const feld = (await call('POST', '/v1/handlungsfelder', gl, { label: 'Qualität', position: 3 })).json().id;
    ziel31 = (await call('POST', '/v1/strategische-ziele', gl, { handlungsfeldId: feld, nummer: '3.1', text: 'Qualität sichern', metrik: 'Zufriedenheit', zielwert: '≥ 80 %' })).json().id;
    for (const jahr of [2026, 2027]) await call('POST', `/v1/ziele/${jahr}`, gl, {});
    jz2026 = (await call('POST', '/v1/jahresziele', gl, { jahr: 2026, strategischesZielId: ziel31, text: 'Befragung einführen', metrik: 'Rücklauf', zielwert: '40 %' })).json().id;
    jz2027 = (await call('POST', '/v1/jahresziele', gl, { jahr: 2027, strategischesZielId: ziel31, text: 'Befragung ausbauen' })).json().id;
  });
  after(async () => { await api?.close(); });

  const call = (method: string, url: string, headers: Record<string, string>, payload?: unknown) =>
    api.app.inject({ method: method as 'GET', url, headers: { ...headers, ...(payload !== undefined ? { 'content-type': 'application/json' } : {}) }, ...(payload !== undefined ? { payload: JSON.stringify(payload) } : {}) });
  const ziele = async (quartal: string, h = gl) => {
    const r = await call('GET', `/v1/zielerreichung/${quartal}`, h);
    assert.equal(r.statusCode, 200, r.body);
    return r.json() as { jahr: number; ziele: Ziel[]; fortschritt: { nachgefuehrt: number; gesamt: number }; can: { write: boolean } };
  };

  test('Tabelle je Ziel: strategisches Ziel, darunter die Jahresziele des Jahres (K6 Schritt 10)', async () => {
    const q = await ziele('2026-Q3');
    assert.equal(q.jahr, 2026);
    assert.deepEqual(q.ziele.map(z => [z.typ, z.nummer]), [['strategisch', '3.1'], ['jahresziel', '3.1.1']]);
    assert.deepEqual(q.fortschritt, { nachgefuehrt: 0, gesamt: 2 });
    assert.equal(q.can.write, true);
    assert.deepEqual((await ziele('2027-Q1')).ziele.map(z => z.nummer), ['3.1', '3.1.1'], 'Jahresziele des Jahres 2027');
    assert.equal((await call('GET', '/v1/zielerreichung/2026-Q5', gl)).statusCode, 422);
  });

  test('Stand erfassen mit Kommentar, Datum und Person; Fortschritt; letzter Stand im Folgequartal (UC-012 Schritt 2)', async () => {
    const a = await call('POST', '/v1/zielerreichung/2026-Q2', gl, { zielTyp: 'strategisch', zielId: ziel31, stand: ' 72 % ', beurteilung: 'auf Kurs' });
    assert.equal(a.statusCode, 201, a.body);
    assert.deepEqual([a.json().stand, a.json().beurteilung, a.json().quartal, a.headers.etag], ['72 %', 'auf Kurs', '2026-Q2', 'W/"1"']);
    assert.ok(a.json().erfasstAt);
    assert.equal((await call('POST', '/v1/zielerreichung/2026-Q2', gl, { zielTyp: 'strategisch', zielId: ziel31, stand: 'x' })).statusCode, 409, 'schon erfasst');

    const b = await call('POST', '/v1/zielerreichung/2026-Q3', ue, { zielTyp: 'jahresziel', zielId: jz2026, stand: '35 %' });
    assert.equal(b.statusCode, 201, b.body);
    const q3 = await ziele('2026-Q3', leser);
    assert.deepEqual(q3.fortschritt, { nachgefuehrt: 1, gesamt: 2 });
    assert.equal(q3.can.write, false);
    const s = q3.ziele.find(z => z.typ === 'strategisch')!;
    assert.deepEqual([s.eintrag, s.letzter?.quartal, s.letzter?.stand], [null, '2026-Q2', '72 %'], 'erscheint mit dem Stand von Q2');
    const j = q3.ziele.find(z => z.typ === 'jahresziel')!;
    assert.deepEqual([j.eintrag?.stand, j.letzter], ['35 %', null]);
    assert.ok(j.eintrag?.erfasstVon, 'mit Person');

    // Jahresziel 2027 nicht im Quartal 2026; unbekanntes Ziel 404
    assert.equal((await call('POST', '/v1/zielerreichung/2026-Q3', gl, { zielTyp: 'jahresziel', zielId: jz2027, stand: 'x' })).statusCode, 422);
    assert.equal((await call('POST', '/v1/zielerreichung/2026-Q3', gl, { zielTyp: 'jahresziel', zielId: randomUUID(), stand: 'x' })).statusCode, 404);
    assert.equal((await call('POST', '/v1/zielerreichung/2026-Q3', gl, { zielTyp: 'strategisch', zielId: jz2026, stand: 'x' })).statusCode, 404, 'Typ passt nicht');
    assert.equal((await call('POST', '/v1/zielerreichung/2026-Q3', gl, { zielTyp: 'strategisch', zielId: ziel31, stand: '   ' })).statusCode, 422, 'Stand leer');
  });

  test('ändern mit If-Match (412), Person und Version neu; entfernen', async () => {
    const e = (await ziele('2026-Q3')).ziele.find(z => z.typ === 'jahresziel')!.eintrag!;
    assert.equal((await call('PATCH', `/v1/zielerreichung/2026-Q3/${e.id}`, gl, { stand: '36 %' })).statusCode, 428);
    assert.equal((await call('PATCH', `/v1/zielerreichung/2026-Q3/${e.id}`, { ...gl, 'if-match': 'W/"9"' }, { stand: '36 %' })).statusCode, 412);
    assert.equal((await call('PATCH', `/v1/zielerreichung/2026-Q2/${e.id}`, { ...gl, 'if-match': 'W/"1"' }, { stand: '36 %' })).statusCode, 404, 'anderes Quartal');
    const p = await call('PATCH', `/v1/zielerreichung/2026-Q3/${e.id}`, { ...gl, 'if-match': 'W/"1"' }, { stand: '36 %', beurteilung: 'leicht unter Plan' });
    assert.equal(p.statusCode, 200, p.body);
    assert.deepEqual([p.json().stand, p.json().beurteilung, p.json().version, p.headers.etag], ['36 %', 'leicht unter Plan', 2, 'W/"2"']);
    assert.equal((await call('PATCH', `/v1/zielerreichung/2026-Q3/${e.id}`, { ...ue, 'if-match': 'W/"2"' }, {})).statusCode, 422, 'leere Änderung');

    assert.equal((await call('DELETE', `/v1/zielerreichung/2026-Q3/${e.id}`, { ...gl, 'if-match': 'W/"1"' })).statusCode, 412);
    assert.equal((await call('DELETE', `/v1/zielerreichung/2026-Q3/${e.id}`, { ...gl, 'if-match': 'W/"2"' })).statusCode, 204);
    assert.deepEqual((await ziele('2026-Q3')).fortschritt, { nachgefuehrt: 0, gesamt: 2 });
  });

  test('Rechte: Lesende sehen, erfassen nicht; ohne Recht 403', async () => {
    const nobody = { authorization: (await login(api, 'demo', 'u-nobody-ze', null)).authorization };
    assert.equal((await call('GET', '/v1/zielerreichung/2026-Q3', nobody)).statusCode, 403);
    assert.equal((await call('POST', '/v1/zielerreichung/2026-Q3', leser, { zielTyp: 'strategisch', zielId: ziel31, stand: 'x' })).statusCode, 403);
  });

  test('Jahresziel gelöscht: seine Zielerreichung mit', async () => {
    const jz = (await call('POST', '/v1/jahresziele', gl, { jahr: 2026, strategischesZielId: ziel31, text: 'Wegwerf' })).json();
    const e = (await call('POST', '/v1/zielerreichung/2026-Q4', gl, { zielTyp: 'jahresziel', zielId: jz.id, stand: '1' })).json();
    assert.equal((await call('DELETE', `/v1/jahresziele/${jz.id}`, { ...gl, 'if-match': 'W/"1"' })).statusCode, 204);
    const n = await full(api.t.runtime, tenantId, async tx => (await tx.query('SELECT 1 FROM ppm.zielerreichung WHERE id = $1', [e.id])).rowCount);
    assert.equal(n, 0);
  });

  test('Audit und Ereignis in derselben Transaktion', async () => {
    const r = await call('POST', '/v1/zielerreichung/2026-Q4', { ...gl, 'x-request-id': 'req-ze' }, { zielTyp: 'strategisch', zielId: ziel31, stand: '75 %' });
    assert.equal(r.statusCode, 201, r.body);
    const id = r.json().id;
    const rows = await full(api.t.runtime, tenantId, async tx => ({
      audit: (await tx.query('SELECT action, correlation_id FROM ppm.audit_log WHERE resource_id = $1', [id])).rows,
      events: (await tx.query('SELECT type, subject FROM ppm.outbox_event WHERE subject = $1', [`zielerreichung/${id}`])).rows,
    }));
    assert.deepEqual(rows.audit, [{ action: 'zielerreichung.created', correlation_id: 'req-ze' }]);
    assert.deepEqual(rows.events, [{ type: 'zielerreichung.created', subject: `zielerreichung/${id}` }]);
  });
});
