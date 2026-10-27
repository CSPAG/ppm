/**
 * Stammdaten (BC AM.02.01, AM.02.02; UC-017 Schritte 1–2): Organisationseinheiten mit Hierarchie, Codetabellen mit
 * Vorgabe und Deaktivieren statt Löschen, Feiertage und Arbeitstage (A-43); Rechte, ETag, Audit.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { full, skipDb } from './harness.ts';
import { login, testApi, type TestApi } from './api.ts';
import { arbeitstageZwischen, CODETABELLEN, istArbeitstag, plusArbeitstage, plusArbeitstageDb } from '../../src/modules/stammdaten/index.ts';

const skip = await skipDb();

describe('Arbeitstage (A-43)', () => {
  const ft = new Set(['2026-12-25', '2026-12-26', '2027-01-01']);
  test('Montag bis Freitag ohne Feiertage', () => {
    assert.equal(istArbeitstag('2026-10-26', ft), true, 'Montag');
    assert.equal(istArbeitstag('2026-10-31', ft), false, 'Samstag');
    assert.equal(istArbeitstag('2026-11-01', ft), false, 'Sonntag');
    assert.equal(istArbeitstag('2026-12-25', ft), false, 'Feiertag am Freitag');
  });
  test('vorwärts und rückwärts, Ausgangstag zählt nicht', () => {
    assert.equal(plusArbeitstage('2026-10-27', 0, ft), '2026-10-27');
    assert.equal(plusArbeitstage('2026-10-30', 1, ft), '2026-11-02', 'Freitag + 1 = Montag');
    // Versand 5 Arbeitstage vor einer Sitzung am Mittwoch 12.11.2026 → Mittwoch 5.11.
    assert.equal(plusArbeitstage('2026-11-12', -5, ft), '2026-11-05');
    // über Weihnachten: Do 24.12. + 2 → Mo 28.12. (25., 26. Feiertag, 27. Sonntag), + 3 → Di 29.12.
    assert.equal(plusArbeitstage('2026-12-24', 1, ft), '2026-12-28');
    assert.equal(plusArbeitstage('2026-12-24', 2, ft), '2026-12-29');
    assert.equal(plusArbeitstage('2027-01-04', -1, ft), '2026-12-31');
    assert.equal(arbeitstageZwischen('2026-12-24', '2026-12-29', ft), 2);
    assert.equal(arbeitstageZwischen('2026-12-29', '2026-12-24', ft), -2);
    assert.throws(() => plusArbeitstage('2026-10-27', 1.5, ft), RangeError);
  });
});

describe('Stammdaten', { skip }, () => {
  let api: TestApi;
  let adm: Record<string, string>, leser: Record<string, string>, nobody: Record<string, string>;
  let tenantId: string;

  before(async () => {
    api = await testApi();
    const a = await login(api, 'demo', 'u-adm', 'org-admin');
    tenantId = a.tenantId;
    adm = { authorization: a.authorization };
    leser = { authorization: (await login(api, 'demo', 'u-leser', 'leser')).authorization };
    nobody = { authorization: (await login(api, 'demo', 'u-nobody', null)).authorization };
  });
  after(async () => { await api?.close(); });

  const call = (method: string, url: string, headers: Record<string, string>, payload?: unknown) =>
    api.app.inject({ method: method as 'GET', url, headers: { ...headers, ...(payload !== undefined ? { 'content-type': 'application/json' } : {}) }, ...(payload !== undefined ? { payload: JSON.stringify(payload) } : {}) });

  test('Organisationseinheiten: Hierarchie, Kürzel eindeutig, kein Kreis, löschen nur ohne Untereinheiten', async () => {
    const dir = await call('POST', '/v1/org-einheiten', adm, { kuerzel: 'DTI', name: ' Direktion Technologie und Innovation ', art: 'direktion' });
    assert.equal(dir.statusCode, 201, dir.body);
    const d = dir.json();
    assert.deepEqual([d.kuerzel, d.name, d.art, d.parentId, d.aktiv, d.version], ['DTI', 'Direktion Technologie und Innovation', 'direktion', null, true, 1]);
    assert.deepEqual(d.can, { write: true, delete: true });
    assert.equal(dir.headers.location, `/v1/org-einheiten/${d.id}`);

    const ber = await call('POST', '/v1/org-einheiten', adm, { kuerzel: 'DTI-ICT', name: 'ICT', parentId: d.id });
    assert.equal(ber.statusCode, 201, ber.body);
    const b = ber.json();
    assert.deepEqual([b.art, b.parentId], ['bereich', d.id]);

    assert.equal((await call('POST', '/v1/org-einheiten', adm, { kuerzel: 'dti', name: 'Doppelt' })).statusCode, 409, 'Kürzel ohne Gross/klein eindeutig');
    assert.equal((await call('POST', '/v1/org-einheiten', adm, { kuerzel: 'X', name: 'Ohne Eltern', parentId: '00000000-0000-4000-8000-000000000000' })).statusCode, 422);
    assert.equal((await call('POST', '/v1/org-einheiten', adm, { kuerzel: 'mit leer', name: 'x' })).statusCode, 422);

    // Direktion unter ihren eigenen Bereich: Kreis
    const cyc = await call('PATCH', `/v1/org-einheiten/${d.id}`, { ...adm, 'if-match': 'W/"1"' }, { parentId: b.id });
    assert.equal(cyc.statusCode, 422, cyc.body);
    assert.equal((await call('PATCH', `/v1/org-einheiten/${d.id}`, { ...adm, 'if-match': 'W/"1"' }, { parentId: d.id })).statusCode, 422);

    // Elternteil hat Untereinheit: nicht löschbar (can.delete false, 409)
    const g = (await call('GET', `/v1/org-einheiten/${d.id}`, adm)).json();
    assert.deepEqual(g.can, { write: true, delete: false });
    assert.equal((await call('DELETE', `/v1/org-einheiten/${d.id}`, { ...adm, 'if-match': 'W/"1"' })).statusCode, 409);

    // deaktivieren statt löschen
    const off = await call('PATCH', `/v1/org-einheiten/${b.id}`, { ...adm, 'if-match': 'W/"1"' }, { aktiv: false });
    assert.equal(off.statusCode, 200, off.body);
    assert.deepEqual([off.json().aktiv, off.json().version], [false, 2]);
    assert.equal((await call('PATCH', `/v1/org-einheiten/${b.id}`, { ...adm, 'if-match': 'W/"1"' }, { name: 'alt' })).statusCode, 412);

    const aktiv = (await call('GET', '/v1/org-einheiten?aktiv=true', leser)).json();
    assert.deepEqual(aktiv.items.map((x: { kuerzel: string }) => x.kuerzel), ['DTI']);
    assert.deepEqual(aktiv.can, { write: false });
    const suche = (await call('GET', '/v1/org-einheiten?q=ict', leser)).json();
    assert.deepEqual(suche.items.map((x: { kuerzel: string }) => x.kuerzel), ['DTI-ICT']);

    assert.equal((await call('DELETE', `/v1/org-einheiten/${b.id}`, { ...adm, 'if-match': 'W/"2"' })).statusCode, 204);
    assert.equal((await call('GET', `/v1/org-einheiten/${d.id}`, adm)).json().can.delete, true);
  });

  test('Organisationseinheiten: Liste mit Cursor', async () => {
    for (const k of ['P1', 'P3', 'P2']) assert.equal((await call('POST', '/v1/org-einheiten', adm, { kuerzel: k, name: `Einheit ${k}`, art: 'direktion' })).statusCode, 201);
    const first = (await call('GET', '/v1/org-einheiten?q=Einheit&limit=2', leser)).json();
    assert.deepEqual(first.items.map((x: { kuerzel: string }) => x.kuerzel), ['P1', 'P2']);
    const second = (await call('GET', `/v1/org-einheiten?q=Einheit&limit=2&cursor=${first.nextCursor}`, leser)).json();
    assert.deepEqual(second.items.map((x: { kuerzel: string }) => x.kuerzel), ['P3']);
    assert.equal(second.nextCursor, null);
    assert.equal((await call('GET', `/v1/org-einheiten?q=x&cursor=${first.nextCursor}`, leser)).statusCode, 422, 'Cursor einer anderen Suche');
  });

  test('Codetabellen: Vorgabe laden (mehrfach), ändern, deaktivieren statt löschen', async () => {
    const leer = (await call('GET', '/v1/codetabellen', leser)).json();
    assert.deepEqual(leer.items.map((t: { schluessel: string }) => t.schluessel), CODETABELLEN.map(t => t.schluessel));
    assert.ok(leer.items.every((t: { anzahl: number }) => t.anzahl === 0));
    assert.equal(leer.can.write, false);

    assert.equal((await call('POST', '/v1/codetabellen/vorgabe', leser)).statusCode, 403);
    const v = await call('POST', '/v1/codetabellen/vorgabe', adm);
    assert.equal(v.statusCode, 200, v.body);
    const total = CODETABELLEN.reduce((n, t) => n + t.vorgabe.length, 0);
    assert.equal(v.json().angelegt, total);

    const status = (await call('GET', '/v1/codetabellen/projektstatus/werte', leser)).json();
    assert.deepEqual(status.items.map((x: { schluessel: string; label: string }) => [x.schluessel, x.label]), [['im_plan', 'Im Plan'], ['kritisch', 'Kritisch']]);
    const trend = (await call('GET', '/v1/codetabellen/trend/werte', leser)).json();
    assert.deepEqual(trend.items.map((x: { schluessel: string }) => x.schluessel), ['aufwaerts', 'gleichbleibend', 'abwaerts']);

    // ändern: Text und Reihenfolge, Schlüssel fest
    const m = (await call('GET', '/v1/codetabellen/groesse/werte', adm)).json().items.find((x: { schluessel: string }) => x.schluessel === 'M');
    const p = await call('PATCH', `/v1/codetabellen/groesse/werte/${m.id}`, { ...adm, 'if-match': 'W/"1"' }, { label: 'Mittel', position: 5 });
    assert.equal(p.statusCode, 200, p.body);
    assert.deepEqual([p.json().label, p.json().position, p.json().version], ['Mittel', 5, 2]);
    assert.equal((await call('PATCH', `/v1/codetabellen/groesse/werte/${m.id}`, { ...adm, 'if-match': 'W/"2"' }, { schluessel: 'X' })).statusCode, 422, 'Schlüssel nicht änderbar');
    assert.equal((await call('PATCH', `/v1/codetabellen/trend/werte/${m.id}`, { ...adm, 'if-match': 'W/"2"' }, { label: 'falsche Tabelle' })).statusCode, 404);

    // deaktivieren und wieder aktivieren; kein Löschen
    const off = await call('POST', `/v1/codetabellen/groesse/werte/${m.id}/deaktivieren`, { ...adm, 'if-match': 'W/"2"' });
    assert.equal(off.statusCode, 200, off.body);
    assert.equal(off.json().aktiv, false);
    assert.deepEqual((await call('GET', '/v1/codetabellen/groesse/werte?aktiv=true', leser)).json().items.map((x: { schluessel: string }) => x.schluessel), ['S', 'L']);
    assert.equal((await call('DELETE', `/v1/codetabellen/groesse/werte/${m.id}`, adm)).statusCode, 404, 'keine Route zum Löschen');

    // Vorgabe erneut: legt nichts an, ändert nichts (auch nicht den deaktivierten Wert)
    assert.equal((await call('POST', '/v1/codetabellen/vorgabe', adm)).json().angelegt, 0);
    const again = (await call('GET', `/v1/codetabellen/groesse/werte/${m.id}`, adm)).json();
    assert.deepEqual([again.label, again.aktiv], ['Mittel', false]);
    assert.equal((await call('POST', `/v1/codetabellen/groesse/werte/${m.id}/aktivieren`, { ...adm, 'if-match': 'W/"3"' })).json().aktiv, true);

    const tabellen = (await call('GET', '/v1/codetabellen', adm)).json();
    assert.deepEqual(tabellen.items.find((t: { schluessel: string }) => t.schluessel === 'groesse'), { schluessel: 'groesse', label: 'Grösse', beschreibung: CODETABELLEN.find(t => t.schluessel === 'groesse')!.beschreibung, anzahl: 3, anzahlAktiv: 3 });
  });

  test('Codewerte: anlegen mit festem Schlüssel, eindeutig je Tabelle, unbekannte Tabelle 422', async () => {
    const c = await call('POST', '/v1/codetabellen/ressourcenrolle/werte', adm, { schluessel: 'architektur', label: 'Architektur', position: 60 });
    assert.equal(c.statusCode, 201, c.body);
    assert.deepEqual([c.json().codetabelle, c.json().schluessel, c.json().aktiv], ['ressourcenrolle', 'architektur', true]);
    assert.equal((await call('POST', '/v1/codetabellen/ressourcenrolle/werte', adm, { schluessel: 'architektur', label: 'Doppelt' })).statusCode, 409);
    assert.equal((await call('POST', '/v1/codetabellen/trend/werte', adm, { schluessel: 'architektur', label: 'Andere Tabelle' })).statusCode, 201);
    assert.equal((await call('POST', '/v1/codetabellen/farbe/werte', adm, { schluessel: 'rot', label: 'Rot' })).statusCode, 422);
    assert.equal((await call('POST', '/v1/codetabellen/trend/werte', adm, { schluessel: 'mit-strich', label: 'x' })).statusCode, 422);
    assert.equal((await call('POST', '/v1/codetabellen/trend/werte', leser, { schluessel: 'leser', label: 'x' })).statusCode, 403);
  });

  test('Feiertage: anlegen, je Datum einer, Filter Jahr; Arbeitstage aus der Datenbank', async () => {
    for (const [datum, label] of [['2026-12-25', 'Weihnachten'], ['2026-12-26', 'Stephanstag'], ['2027-01-01', 'Neujahr']]) {
      const r = await call('POST', '/v1/feiertage', adm, { datum, label });
      assert.equal(r.statusCode, 201, r.body);
      assert.equal(r.json().datum, datum);
    }
    assert.equal((await call('POST', '/v1/feiertage', adm, { datum: '2026-12-25', label: 'doppelt' })).statusCode, 409);
    assert.equal((await call('POST', '/v1/feiertage', adm, { datum: '25.12.2026', label: 'Format' })).statusCode, 422);
    const y = (await call('GET', '/v1/feiertage?jahr=2026', leser)).json();
    assert.deepEqual(y.items.map((x: { datum: string }) => x.datum), ['2026-12-25', '2026-12-26']);
    const neujahr = (await call('GET', '/v1/feiertage?jahr=2027', adm)).json().items[0];
    const p = await call('PATCH', `/v1/feiertage/${neujahr.id}`, { ...adm, 'if-match': 'W/"1"' }, { label: 'Neujahrstag' });
    assert.deepEqual([p.statusCode, p.json().label, p.json().version], [200, 'Neujahrstag', 2]);

    const ergebnis = await full(api.t.runtime, tenantId, async tx => [await plusArbeitstageDb(tx, '2026-12-24', 2), await plusArbeitstageDb(tx, '2027-01-04', -3), await plusArbeitstageDb(tx, '2026-12-01', 40)]);
    assert.deepEqual(ergebnis, ['2026-12-29', '2026-12-29', '2027-01-28']);

    assert.equal((await call('DELETE', `/v1/feiertage/${neujahr.id}`, { ...adm, 'if-match': 'W/"2"' })).statusCode, 204);
    assert.equal((await call('GET', `/v1/feiertage/${neujahr.id}`, adm)).statusCode, 404);
  });

  test('Rechte: ohne Rolle nichts, Leser:in liest nur', async () => {
    assert.equal((await call('GET', '/v1/org-einheiten', nobody)).statusCode, 403);
    assert.equal((await call('GET', '/v1/codetabellen', nobody)).statusCode, 403);
    assert.equal((await call('GET', '/v1/feiertage', nobody)).statusCode, 403);
    assert.equal((await call('GET', '/v1/feiertage', {})).statusCode, 401);
    assert.equal((await call('POST', '/v1/org-einheiten', leser, { kuerzel: 'L', name: 'Leser' })).statusCode, 403);
    assert.equal((await call('POST', '/v1/feiertage', leser, { datum: '2026-08-01', label: 'Bundesfeier' })).statusCode, 403);
  });

  test('Audit und Ereignis in derselben Transaktion', async () => {
    const c = await call('POST', '/v1/feiertage', { ...adm, 'x-request-id': 'req-ft' }, { datum: '2026-08-01', label: 'Bundesfeier' });
    assert.equal(c.statusCode, 201);
    const id = c.json().id;
    const rows = await full(api.t.runtime, tenantId, async tx => ({
      audit: (await tx.query('SELECT action, correlation_id FROM ppm.audit_log WHERE resource_id = $1', [id])).rows,
      events: (await tx.query('SELECT type FROM ppm.outbox_event WHERE subject = $1', [`feiertag/${id}`])).rows,
    }));
    assert.deepEqual(rows.audit, [{ action: 'feiertag.created', correlation_id: 'req-ft' }]);
    assert.deepEqual(rows.events, [{ type: 'feiertag.created' }]);
  });
});
