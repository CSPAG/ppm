/**
 * Phasenmodell (BC AM.02.03, UC-017 Schritte 3 und 5): Entwurf aus der Vorgabe des PM-Handbuchs bzw. der Version in
 * Kraft, Ändern mit ETag, Prüfbericht, in Kraft setzen (ADM), Unveränderlichkeit, Ablösung, Verwerfen, Rechte.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { full, skipDb } from './harness.ts';
import { login, testApi, type TestApi } from './api.ts';

const skip = await skipDb();

type H = Record<string, string>;

describe('Phasenmodell', { skip }, () => {
  let api: TestApi;
  let ue: H, adm: H, leser: H, niemand: H;
  let tenantId: string;

  before(async () => {
    api = await testApi();
    const a = await login(api, 'demo', 'pm-adm', 'org-admin');
    tenantId = a.tenantId;
    adm = { authorization: a.authorization };
    ue = { authorization: (await login(api, 'demo', 'pm-ue', 'ue')).authorization };
    leser = { authorization: (await login(api, 'demo', 'pm-leser', 'leser')).authorization };
    niemand = { authorization: (await login(api, 'demo', 'pm-niemand', null)).authorization };
  });
  after(async () => { await api?.close(); });

  const call = (method: string, url: string, headers: H, payload?: unknown) =>
    api.app.inject({ method: method as 'GET', url, headers: { ...headers, ...(payload !== undefined ? { 'content-type': 'application/json' } : {}) }, ...(payload !== undefined ? { payload: JSON.stringify(payload) } : {}) });

  let entwurf: { id: string; etag: string };

  test('ohne Version in Kraft: aktuell 404, Liste leer; ohne Recht 403', async () => {
    assert.equal((await call('GET', '/v1/phasenmodelle/aktuell', leser)).statusCode, 404);
    const l = await call('GET', '/v1/phasenmodelle', leser);
    assert.equal(l.statusCode, 200, l.body);
    assert.deepEqual(l.json(), { items: [], nextCursor: null, can: { create: false } });
    assert.equal((await call('GET', '/v1/phasenmodelle', niemand)).statusCode, 403);
    assert.equal((await call('POST', '/v1/phasenmodelle', leser, {})).statusCode, 403);
    const nurAktuell = await call('POST', '/v1/phasenmodelle', ue, { quelle: 'aktuell' });
    assert.equal(nurAktuell.statusCode, 422, 'ohne Version in Kraft nur aus der Vorgabe');
  });

  test('Entwurf aus der Vorgabe des PM-Handbuchs', async () => {
    const c = await call('POST', '/v1/phasenmodelle', ue, { beschreibung: ' Erstes Phasenmodell nach PM-Handbuch 0.92 ' });
    assert.equal(c.statusCode, 201, c.body);
    const m = c.json();
    entwurf = { id: m.id, etag: c.headers.etag as string };
    assert.deepEqual([m.nummer, m.stand, m.version, m.beschreibung, m.inKraftAb], [1, 'entwurf', 1, 'Erstes Phasenmodell nach PM-Handbuch 0.92', null]);
    assert.equal(c.headers.location, `/v1/phasenmodelle/${m.id}`);
    assert.deepEqual(m.can, { write: true, activate: false });
    assert.deepEqual(m.phasen.map((p: { code: string; name: string }) => `${p.code} ${p.name}`), [
      'PRE_P0 Ideen', 'P0 Initialisierung', 'P1 Konzept & Planung', 'P2 Implementierung', 'P3 Stabilisierung & Monitoring', 'P4 Abschluss',
    ]);
    assert.deepEqual(m.gates.map((g: { code: string; vonPhase: string; nachPhase: string | null }) => [g.code, g.vonPhase, g.nachPhase]), [
      ['EINTRITT_P0', 'PRE_P0', 'P0'], ['P0_P1', 'P0', 'P1'], ['P1_P2', 'P1', 'P2'], ['P2_P3', 'P2', 'P3'], ['P3_P4', 'P3', 'P4'], ['EXIT_P4', 'P4', null],
    ]);
    // Je Gate fünf Leitfragen entlang der Werteströme (Q6 F6)
    for (const g of m.gates) assert.deepEqual(g.leitfragen.map((l: { wertestrom: string }) => l.wertestrom), ['nutzen', 'projekt', 'klinik', 'ict', 'infrastruktur'], g.code);
    assert.equal(m.gates[2].leitfragen[0].text, 'Stimmt das Kosten/Nutzen-Verhältnis?');
    const p1 = m.phasen.find((p: { code: string }) => p.code === 'P1');
    assert.ok(p1.ergebnisse.some((e: { art: string; text: string }) => e.art === 'lieferergebnis' && e.text === 'Lösungskonzept'));
    // A-12: Personal in FTE und Kosten ab Gate P1–P2
    assert.deepEqual(m.gates[2].pflichtangaben.map((x: { kapitel: number; feld: string }) => `${x.kapitel}.${x.feld}`), ['9.personal', '9.kosten']);
    assert.deepEqual(m.gates[1].pflichtangaben, []);
    assert.deepEqual(m.fristen, [
      { schluessel: 'bericht_aufgabe', wert: 18, einheit: 'tag_im_monat' }, { schluessel: 'bericht_stichtag', wert: 25, einheit: 'tag_im_monat' },
      { schluessel: 'gate_vorbereiten', wert: 30, einheit: 'arbeitstage' }, { schluessel: 'sitzung_vorbereiten', wert: 15, einheit: 'arbeitstage' },
      { schluessel: 'versand', wert: 5, einheit: 'arbeitstage' }, { schluessel: 'protokoll', wert: 3, einheit: 'arbeitstage' },
    ]);
    assert.deepEqual(m.toleranzen.map((t: { wert: number | null }) => t.wert), [null, null, null]);
    assert.deepEqual(m.kapitelWirkung, [{ kapitel: 5, dimension: 'scope' }, { kapitel: 9, dimension: 'budget' }, { kapitel: 9, dimension: 'ressourcen' }]);
    // Prüfbericht: nur Hinweise zu den Toleranzen ohne Wert (A-10)
    assert.deepEqual(m.pruefung.map((p: { stufe: string; regel: string }) => `${p.stufe}:${p.regel}`), ['hinweis:toleranz_ohne_wert', 'hinweis:toleranz_ohne_wert', 'hinweis:toleranz_ohne_wert']);

    const zweiter = await call('POST', '/v1/phasenmodelle', ue, {});
    assert.equal(zweiter.statusCode, 409, 'höchstens ein Entwurf');
    assert.equal(zweiter.json().entwurf, m.id);
  });

  test('Entwurf ändern: If-Match, Listen ersetzen, Prüfung, ungültige Eingaben', async () => {
    const url = `/v1/phasenmodelle/${entwurf.id}`;
    assert.equal((await call('PATCH', url, ue, { beschreibung: 'x' })).statusCode, 428);
    assert.equal((await call('PATCH', url, { ...leser, 'if-match': entwurf.etag }, { beschreibung: 'x' })).statusCode, 403);
    const p = await call('PATCH', url, { ...ue, 'if-match': entwurf.etag }, {
      gates: [{ code: 'P0_P1', name: ' Gate P0–P1 (Konzept) ', leitfragen: [{ wertestrom: 'nutzen', text: 'Ist der Nutzen belegt?' }] }],
      phasen: [{ code: 'P2', ergebnisse: [] }],
      fristen: [{ schluessel: 'versand', wert: 7, einheit: 'arbeitstage' }],
      toleranzen: [{ dimension: 'kosten', wert: 10, einheit: 'prozent' }],
    });
    assert.equal(p.statusCode, 200, p.body);
    const m = p.json();
    assert.equal(m.version, 2);
    assert.equal(p.headers.etag, 'W/"2"');
    const g = m.gates.find((x: { code: string }) => x.code === 'P0_P1');
    assert.deepEqual([g.name, g.leitfragen.length, g.pflichtangaben.length], ['Gate P0–P1 (Konzept)', 1, 0]);
    assert.equal(m.gates.find((x: { code: string }) => x.code === 'P1_P2').leitfragen.length, 5, 'andere Gates bleiben');
    assert.equal(m.fristen.find((f: { schluessel: string }) => f.schluessel === 'versand').wert, 7);
    assert.deepEqual(m.toleranzen.map((t: { wert: number | null }) => t.wert), [null, 10, null]);
    const regeln = m.pruefung.map((x: { regel: string; ort: { code: string | null } }) => `${x.regel}@${x.ort.code}`);
    assert.ok(regeln.includes('leitfragen_je_wertestrom@P0_P1'));
    assert.ok(regeln.includes('standard_ergebnisse@P2'));
    assert.match(m.pruefung.find((x: { regel: string }) => x.regel === 'leitfragen_je_wertestrom').text, /keine Leitfrage für Projektmanagement, .*Integration Infrastruktur \(DBI\)/);
    entwurf.etag = p.headers.etag as string;

    const stale = await call('PATCH', url, { ...ue, 'if-match': 'W/"1"' }, { beschreibung: 'alt' });
    assert.equal(stale.statusCode, 412);
    assert.equal(stale.json().currentVersion, 2);

    for (const [body, pfad] of [
      [{ fristen: [{ schluessel: 'versand', wert: 5, einheit: 'tag_im_monat' }] }, '/fristen/0/einheit'],
      [{ fristen: [{ schluessel: 'bericht_stichtag', wert: 25, einheit: 'arbeitstage' }] }, '/fristen/0/einheit'],
      [{ phasen: [{ code: 'P1', name: 'A' }, { code: 'P1', name: 'B' }] }, '/phasen/1/code'],
    ] as const) {
      const r = await call('PATCH', url, { ...ue, 'if-match': entwurf.etag }, body);
      assert.equal(r.statusCode, 422, r.body);
      assert.ok(JSON.stringify(r.json()).includes(pfad), r.body);
    }
    for (const body of [{ gates: [{ code: 'P5_P6', name: 'x' }] }, { farbe: 'rot' }, {}, { fristen: [{ schluessel: 'versand', wert: 400, einheit: 'arbeitstage' }] }]) {
      assert.equal((await call('PATCH', url, { ...ue, 'if-match': entwurf.etag }, body)).statusCode, 422, JSON.stringify(body));
    }
  });

  test('In Kraft setzen nur mit Recht (ADM); danach unveränderlich', async () => {
    const url = `/v1/phasenmodelle/${entwurf.id}`;
    assert.equal((await call('POST', `${url}/in-kraft-setzen`, { ...ue, 'if-match': entwurf.etag })).statusCode, 403);
    assert.equal((await call('POST', `${url}/in-kraft-setzen`, adm)).statusCode, 428);
    assert.equal((await call('POST', `${url}/in-kraft-setzen`, { ...adm, 'if-match': 'W/"1"' })).statusCode, 412);
    const k = await call('POST', `${url}/in-kraft-setzen`, { ...adm, 'if-match': entwurf.etag });
    assert.equal(k.statusCode, 200, k.body);
    assert.equal(k.json().stand, 'in_kraft');
    assert.ok(k.json().inKraftAb);
    assert.deepEqual(k.json().can, { write: false, activate: false });

    const a = await call('GET', '/v1/phasenmodelle/aktuell', leser);
    assert.equal(a.statusCode, 200);
    assert.deepEqual([a.json().id, a.json().nummer], [entwurf.id, 1]);
    assert.equal((await call('POST', `${url}/in-kraft-setzen`, { ...adm, 'if-match': k.headers.etag as string })).statusCode, 409);
    assert.equal((await call('PATCH', url, { ...ue, 'if-match': k.headers.etag as string }, { beschreibung: 'nachträglich' })).statusCode, 409);
    assert.equal((await call('DELETE', url, { ...ue, 'if-match': k.headers.etag as string })).statusCode, 409);

    // Auch an der Datenbank vorbei (volle Sicht) bleibt die Version in Kraft unverändert (Lesesicht, Trigger)
    await full(api.t.runtime, tenantId, async tx => {
      assert.equal((await tx.query("UPDATE ppm.leitfrage SET text = 'manipuliert' WHERE phasenmodell_id = $1", [entwurf.id])).rowCount, 0);
      assert.equal((await tx.query('DELETE FROM ppm.frist WHERE phasenmodell_id = $1', [entwurf.id])).rowCount, 0);
      await tx.query('SAVEPOINT s');
      await assert.rejects(tx.query("UPDATE ppm.phasenmodell SET beschreibung = 'manipuliert' WHERE id = $1", [entwurf.id]), /nicht änderbar/);
      await tx.query('ROLLBACK TO SAVEPOINT s');
      await assert.rejects(tx.query("INSERT INTO ppm.leitfrage (tenant_id, phasenmodell_id, gate_code, wertestrom, position, text) VALUES ($1, $2, 'P0_P1', 'ict', 9, 'neu')", [tenantId, entwurf.id]), /row-level security/);
    });
  });

  test('neue Version aus der Version in Kraft, Ablösung, Liste mit Cursor', async () => {
    const c = await call('POST', '/v1/phasenmodelle', { ...ue, 'idempotency-key': 'pm-2' }, { beschreibung: 'Toleranzen festgelegt' });
    assert.equal(c.statusCode, 201, c.body);
    const m = c.json();
    assert.equal(m.nummer, 2);
    // Kopie der Version 1 mit ihren Änderungen
    assert.equal(m.gates.find((x: { code: string }) => x.code === 'P0_P1').name, 'Gate P0–P1 (Konzept)');
    assert.equal(m.fristen.find((f: { schluessel: string }) => f.schluessel === 'versand').wert, 7);
    const k = await call('POST', `/v1/phasenmodelle/${m.id}/in-kraft-setzen`, { ...adm, 'if-match': c.headers.etag as string });
    assert.equal(k.statusCode, 200, k.body);

    const alt = (await call('GET', `/v1/phasenmodelle/${entwurf.id}`, leser)).json();
    assert.equal(alt.stand, 'abgeloest');
    assert.equal((await call('GET', '/v1/phasenmodelle/aktuell', leser)).json().nummer, 2);

    const s1 = (await call('GET', '/v1/phasenmodelle?limit=1', ue)).json();
    assert.deepEqual([s1.items.map((x: { nummer: number }) => x.nummer), s1.can], [[2], { create: true }]);
    assert.ok(s1.nextCursor);
    const s2 = (await call('GET', `/v1/phasenmodelle?limit=1&cursor=${s1.nextCursor}`, ue)).json();
    assert.deepEqual([s2.items.map((x: { nummer: number; stand: string }) => `${x.nummer}:${x.stand}`), s2.nextCursor], [['1:abgeloest'], null]);
  });

  test('Entwurf verwerfen und Vorgabe neu laden', async () => {
    const c = await call('POST', '/v1/phasenmodelle', ue, { quelle: 'vorgabe' });
    assert.equal(c.statusCode, 201, c.body);
    const m = c.json();
    assert.equal(m.fristen.find((f: { schluessel: string }) => f.schluessel === 'versand').wert, 5, 'Vorgabe statt Kopie');
    const url = `/v1/phasenmodelle/${m.id}`;
    assert.equal((await call('DELETE', url, { ...ue, 'if-match': 'W/"9"' })).statusCode, 412);
    assert.equal((await call('DELETE', url, { ...ue, 'if-match': c.headers.etag as string })).statusCode, 204);
    assert.equal((await call('GET', url, ue)).statusCode, 404);
    assert.equal((await call('GET', '/v1/phasenmodelle/aktuell', ue)).json().nummer, 2, 'Version in Kraft bleibt');
  });

  test('Audit: jede Änderung protokolliert', async () => {
    const rows = await full(api.t.runtime, tenantId, async tx => (await tx.query<{ action: string }>(
      "SELECT action FROM ppm.audit_log WHERE resource_type = 'phasenmodell' ORDER BY id")).rows.map(r => r.action));
    assert.deepEqual(rows, ['phasenmodell.created', 'phasenmodell.updated', 'phasenmodell.activated', 'phasenmodell.created', 'phasenmodell.activated', 'phasenmodell.created', 'phasenmodell.deleted']);
  });
});
