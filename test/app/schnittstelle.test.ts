/**
 * Schnittstellen und Änderungsprotokoll (AP-E7-3; BC AM.03.02, AM.03.03; UC-018 Schritte 3–5, A1). Ein lokaler
 * HTTP-Server spielt das Umsystem (private Adressen nur in Tests, WEBHOOK_ALLOW_PRIVATE). Geprüft: Rechte (ADM richtet
 * ein, UE und ADM sehen das Protokoll), Testlauf beim Einrichten, Lauf von Hand mit und ohne Verarbeitung, Fehler als
 * Aufgabe im Eingang und erledigt nach erfolgreichem Lauf, ausgehende Lieferung, geplante Läufe nach Rhythmus,
 * Änderungsprotokoll mit altem und neuem Wert und Filtern.
 */
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { dbTests, postgresSkip } from '@vollholz/iam-testkit';
import { verarbeitungSetzen } from '../../src/modules/schnittstelle/index.ts';
import { faelligeAusfuehren } from '../../src/modules/schnittstelle/lauf.ts';
import { login, testApi, type TestApi } from './api.ts';
import { full, tenant } from './harness.ts';

const { after, before, describe, test } = dbTests(await postgresSkip());

describe('Schnittstellen und Änderungsprotokoll (AP-E7-3)', () => {
  let api: TestApi;
  let T: string;
  let server: Server;
  let basis = '';
  /** Antwort des Umsystems je Pfad; empfangene Lieferungen. */
  const antwort: Record<string, { status: number; body: string }> = {};
  const empfangen: { pfad: string; methode: string; body: string }[] = [];
  const h: Record<string, Record<string, string>> = {};

  const call = (who: string, method: string, url: string, payload?: unknown, headers: Record<string, string> = {}) =>
    api.app.inject({ method: method as 'GET', url, headers: { ...h[who], ...headers }, ...(payload !== undefined ? { payload: payload as Record<string, unknown> } : {}) });
  const aufgaben = () => full(api.t.runtime, T, async tx =>
    (await tx.query<{ bezug_id: string; stand: string; titel: string; link: string }>("SELECT bezug_id, stand, titel, link FROM ppm.aufgabe WHERE art = 'schnittstelle.fehler' ORDER BY created_at")).rows);

  before(async () => {
    server = createServer((req, res) => {
      let body = '';
      req.on('data', c => { body += c; });
      req.on('end', () => {
        if (req.method === 'POST') empfangen.push({ pfad: req.url ?? '', methode: req.method, body });
        const a = antwort[req.url ?? ''] ?? { status: 200, body: '[]' };
        res.writeHead(a.status, { 'content-type': 'application/json' }).end(a.body);
      });
    });
    await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
    basis = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    api = await testApi();
    // Die Module finanzen (Ist-Kosten, Jahresbedarf, AP-E7-4) und ressource (Personal, AP-E7-2) registrieren ihre
    // Verarbeitung; hier zuerst ohne
    verarbeitungSetzen('ist_kosten', null);
    verarbeitungSetzen('jahresbedarf', null);
    verarbeitungSetzen('personal', null);
    T = await tenant(api.t.runtime, 'acme');
    for (const [sub, rolle] of [['adm', 'org-admin'], ['ue', 'ue'], ['gl', 'gl']] as const) {
      h[sub] = { authorization: (await login(api, 'acme', sub, rolle)).authorization };
    }
  });
  after(async () => {
    verarbeitungSetzen('ist_kosten', null);
    verarbeitungSetzen('jahresbedarf', null);
    verarbeitungSetzen('personal', null);
    await api?.close();
    await new Promise(r => server.close(r));
  });

  let erp = '';

  test('nur ADM richtet Schnittstellen ein; UE und GL nicht (schnittstelle:admin)', async () => {
    for (const who of ['ue', 'gl']) {
      assert.equal((await call(who, 'GET', '/v1/schnittstellen')).statusCode, 403, who);
      assert.equal((await call(who, 'POST', '/v1/schnittstellen', { umsystem: 'erp', daten: 'ist_kosten', rhythmus: 'monatlich', adresse: `${basis}/ist` })).statusCode, 403, who);
    }
    const r = await call('adm', 'GET', '/v1/schnittstellen');
    assert.equal(r.statusCode, 200);
    assert.deepEqual(r.json().katalog.map((k: { umsystem: string; daten: string; richtung: string; verfuegbar: boolean }) => [k.umsystem, k.daten, k.richtung, k.verfuegbar]),
      [['erp', 'ist_kosten', 'eingehend', false], ['hr', 'personal', 'eingehend', false], ['budget', 'jahresbedarf', 'ausgehend', false]]);
  });

  test('Einrichten (UC-018 Schritt 3): speichert und führt einen Testlauf aus; Katalog und Doppel geprüft', async () => {
    const r = await call('adm', 'POST', '/v1/schnittstellen', { umsystem: 'erp', daten: 'ist_kosten', rhythmus: 'monatlich', adresse: `${basis}/ist` });
    assert.equal(r.statusCode, 201, r.body);
    const e = r.json();
    erp = e.schnittstelle.id;
    assert.equal(e.schnittstelle.richtung, 'eingehend');
    assert.equal(e.schnittstelle.name, 'ERP · Ist-Kosten je Kostenträger und Monat');
    assert.deepEqual([e.testlauf.art, e.testlauf.stand, e.testlauf.umfang, e.testlauf.fehler], ['test', 'erfolgreich', 0, null]);
    assert.ok(e.testlauf.gestartetVon);
    assert.equal(e.schnittstelle.letzterLauf.id, e.testlauf.id);

    assert.equal((await call('adm', 'POST', '/v1/schnittstellen', { umsystem: 'erp', daten: 'ist_kosten', rhythmus: 'manuell', adresse: `${basis}/x` })).statusCode, 409);
    assert.equal((await call('adm', 'POST', '/v1/schnittstellen', { umsystem: 'erp', daten: 'personal', rhythmus: 'manuell', adresse: `${basis}/x` })).statusCode, 422);
    assert.equal((await call('adm', 'POST', '/v1/schnittstellen', { umsystem: 'erp', daten: 'ist_kosten', rhythmus: 'stündlich', adresse: `${basis}/x` })).statusCode, 422);
  });

  test('Lauf ohne Verarbeitung schlägt fehl und meldet den Fehler im Eingang (UC-018 Schritt 4, fachmodell 4.2)', async () => {
    const r = await call('adm', 'POST', `/v1/schnittstellen/${erp}/starten`);
    assert.equal(r.statusCode, 201, r.body);
    assert.equal(r.json().stand, 'fehlgeschlagen');
    assert.match(r.json().fehler, /Ist-Kosten je Kostenträger und Monat» ist noch nicht verfügbar/);
    const a = await aufgaben();
    assert.deepEqual(a.map(x => [x.bezug_id, x.stand, x.link]), [[erp, 'offen', `/administration/schnittstellen?o=${erp}`]]);
    assert.match(a[0]!.titel, /Schnittstelle «ERP · Ist-Kosten je Kostenträger und Monat» prüfen/);
  });

  test('erneut starten mit Verarbeitung (A1.1): Umfang protokolliert, Aufgabe erledigt; Fehler des Umsystems', async () => {
    verarbeitungSetzen('ist_kosten', { uebernehmen: async (_tx, body) => (JSON.parse(body) as unknown[]).length });
    antwort['/ist'] = { status: 200, body: '[{"a":1},{"a":2},{"a":3}]' };
    const ok = await call('adm', 'POST', `/v1/schnittstellen/${erp}/starten`);
    assert.deepEqual([ok.json().art, ok.json().stand, ok.json().umfang], ['manuell', 'erfolgreich', 3]);
    assert.deepEqual((await aufgaben()).map(x => x.stand), ['erledigt']);
    assert.equal((await call('adm', 'GET', '/v1/schnittstellen')).json().katalog[0].verfuegbar, true);

    antwort['/ist'] = { status: 503, body: 'down' };
    const f = await call('adm', 'POST', `/v1/schnittstellen/${erp}/starten`);
    assert.deepEqual([f.json().stand, f.json().fehler], ['fehlgeschlagen', 'Das Umsystem antwortet mit Status 503.']);
    antwort['/ist'] = { status: 200, body: 'kein json' };
    const p = await call('adm', 'POST', `/v1/schnittstellen/${erp}/starten`);
    assert.match(p.json().fehler, /^Antwort des Umsystems nicht verarbeitbar/);
    assert.deepEqual((await aufgaben()).map(x => x.stand), ['erledigt', 'offen']);

    // Laufprotokoll: neueste zuerst, mit Cursor
    const s1 = (await call('adm', 'GET', `/v1/schnittstellen/${erp}/laeufe?limit=2`)).json();
    assert.equal(s1.items.length, 2);
    const s2 = (await call('adm', 'GET', `/v1/schnittstellen/${erp}/laeufe?limit=10&cursor=${encodeURIComponent(s1.nextCursor)}`)).json();
    assert.deepEqual([...s1.items, ...s2.items].map((l: { art: string; stand: string }) => `${l.art}:${l.stand}`),
      ['manuell:fehlgeschlagen', 'manuell:fehlgeschlagen', 'manuell:erfolgreich', 'manuell:fehlgeschlagen', 'test:erfolgreich']);
    antwort['/ist'] = { status: 200, body: '[]' };
  });

  test('ausgehend: liefert den Inhalt als JSON an das Umsystem (Budgetprozess, A-17)', async () => {
    verarbeitungSetzen('jahresbedarf', { liefern: async () => ({ inhalt: { jahr: 2027, positionen: [1, 2] }, umfang: 2 }) });
    const r = await call('adm', 'POST', '/v1/schnittstellen', { umsystem: 'budget', daten: 'jahresbedarf', rhythmus: 'manuell', adresse: `${basis}/budget` });
    assert.equal(r.json().testlauf.stand, 'erfolgreich');
    const l = await call('adm', 'POST', `/v1/schnittstellen/${r.json().schnittstelle.id}/starten`);
    assert.deepEqual([l.json().stand, l.json().umfang], ['erfolgreich', 2]);
    assert.deepEqual(empfangen.map(e => [e.pfad, JSON.parse(e.body)]), [['/budget', { jahr: 2027, positionen: [1, 2] }]]);
  });

  test('ändern mit If-Match; deaktiviert kein Lauf, neue Adresse mit Testlauf; Änderungsprotokoll mit altem und neuem Wert (Schritt 5)', async () => {
    const g = await call('adm', 'GET', `/v1/schnittstellen/${erp}`);
    const v = g.headers.etag as string;
    assert.equal((await call('adm', 'PATCH', `/v1/schnittstellen/${erp}`, { aktiv: false })).statusCode, 428);
    const d = await call('adm', 'PATCH', `/v1/schnittstellen/${erp}`, { aktiv: false, rhythmus: 'taeglich' }, { 'if-match': v });
    assert.equal(d.statusCode, 200, d.body);
    assert.equal(d.json().testlauf, null);
    assert.equal((await call('adm', 'PATCH', `/v1/schnittstellen/${erp}`, { aktiv: true }, { 'if-match': v })).statusCode, 412);
    assert.equal((await call('adm', 'POST', `/v1/schnittstellen/${erp}/starten`)).statusCode, 409);
    const n = await call('adm', 'PATCH', `/v1/schnittstellen/${erp}`, { aktiv: true, adresse: `${basis}/ist2` }, { 'if-match': `W/"${d.json().schnittstelle.version}"` });
    assert.equal(n.json().testlauf.stand, 'erfolgreich');
    // Aufgabe nach erfolgreichem Testlauf erledigt
    assert.deepEqual((await aufgaben()).map(x => x.stand), ['erledigt', 'erledigt']);

    for (const who of ['gl']) assert.equal((await call(who, 'GET', '/v1/aenderungsprotokoll')).statusCode, 403);
    const p = await call('ue', 'GET', `/v1/aenderungsprotokoll?objekt=schnittstelle&objektId=${erp}`);
    assert.equal(p.statusCode, 200, p.body);
    const items = p.json().items as { aktion: string; art: string; person: { name: string | null } | null; aenderungen: { feld: string; vorher: unknown; nachher: unknown }[] }[];
    assert.deepEqual(items.map(i => i.aktion), ['schnittstelle.updated', 'schnittstelle.updated', 'schnittstelle.created']);
    assert.deepEqual(items[1]!.aenderungen, [{ feld: 'aktiv', vorher: true, nachher: false }, { feld: 'rhythmus', vorher: 'monatlich', nachher: 'taeglich' }]);
    assert.deepEqual(items[0]!.aenderungen.map(a => a.feld), ['adresse', 'aktiv']);
    assert.equal(items[2]!.art, 'angelegt');
    assert.ok(items[2]!.aenderungen.some(a => a.feld === 'umsystem' && a.vorher === null && a.nachher === 'erp'));
    assert.ok(items[0]!.person);

    // Zeitraum: gestern nichts, heute alles; Seiten mit Cursor; Objekttypen für den Filter
    const heute = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Zurich' }).format(new Date());
    const gestern = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Zurich' }).format(new Date(Date.now() - 86_400_000));
    assert.equal((await call('ue', 'GET', `/v1/aenderungsprotokoll?objekt=schnittstelle&bis=${gestern}`)).json().items.length, 0);
    assert.equal((await call('ue', 'GET', `/v1/aenderungsprotokoll?objekt=schnittstelle&von=${heute}&bis=${heute}`)).json().items.length, 4);
    assert.equal((await call('ue', 'GET', `/v1/aenderungsprotokoll?von=${heute}&bis=${gestern}`)).statusCode, 422);
    const s1 = (await call('adm', 'GET', '/v1/aenderungsprotokoll?objekt=schnittstelle&limit=3')).json();
    const s2 = (await call('adm', 'GET', `/v1/aenderungsprotokoll?objekt=schnittstelle&limit=3&cursor=${encodeURIComponent(s1.nextCursor)}`)).json();
    assert.deepEqual([s1.items.length, s2.items.length, s2.nextCursor], [3, 1, null]);
    assert.equal((await call('adm', 'GET', `/v1/aenderungsprotokoll?objekt=projekt&cursor=${encodeURIComponent(s1.nextCursor)}`)).statusCode, 422);
    assert.ok((await call('ue', 'GET', '/v1/aenderungsprotokoll/objekte')).json().items.includes('schnittstelle'));

    // Export (UI-50, Seitentyp Bericht): alle Einträge zum Filter, eine Zeile je geändertes Feld
    const x = await call('ue', 'GET', `/v1/aenderungsprotokoll?objekt=schnittstelle&objektId=${erp}&format=csv`);
    assert.equal(x.statusCode, 200, x.body);
    assert.match(x.headers['content-type'] as string, /^text\/csv/);
    assert.match(x.headers['content-disposition'] as string, /filename="aenderungsprotokoll\.csv"/);
    const zeilen = x.body.replace(/^﻿/, '').trim().split('\r\n');
    assert.equal(zeilen[0], 'Zeitpunkt;Quelle;Person;Objekt;Kennung;Art;Aktion;Feld;Vorher;Nachher');
    assert.ok(zeilen.some(z => z.endsWith(`;schnittstelle;${erp};geändert;schnittstelle.updated;rhythmus;monatlich;taeglich`)), zeilen.join('\n'));
    assert.equal((await call('gl', 'GET', '/v1/aenderungsprotokoll?format=csv')).statusCode, 403);
  });

  test('geplante Läufe nach Rhythmus: einmal je Tag, der Testlauf zählt nicht, ein Lauf von Hand schon', async () => {
    // ERP (täglich) lief heute schon von Hand; HR (täglich) hat nur den Testlauf
    const hr = (await call('adm', 'POST', '/v1/schnittstellen', { umsystem: 'hr', daten: 'personal', rhythmus: 'taeglich', adresse: `${basis}/hr` })).json().schnittstelle.id as string;
    const o = { timeoutMs: 5000, allowPrivate: true };
    const n1 = await faelligeAusfuehren(api.t.runtime, T, o);
    assert.deepEqual([n1.gelaufen, n1.fehlgeschlagen], [1, 1]);
    assert.equal((await faelligeAusfuehren(api.t.runtime, T, o)).gelaufen, 0);
    const l = (await call('adm', 'GET', `/v1/schnittstellen/${hr}/laeufe?limit=1`)).json().items[0];
    assert.deepEqual([l.art, l.stand, l.gestartetVon], ['geplant', 'fehlgeschlagen', null]);
    assert.deepEqual((await aufgaben()).filter(a => a.bezug_id === hr).map(a => a.stand), ['offen']);
    // Lauf ohne Rückmeldung (Absturz) nach einer Stunde abgebrochen
    await full(api.t.runtime, T, tx => tx.query("INSERT INTO ppm.schnittstelle_lauf (tenant_id, schnittstelle_id, art, start) VALUES ($1, $2, 'manuell', now() - interval '2 hours')", [T, erp]));
    assert.equal((await faelligeAusfuehren(api.t.runtime, T, o)).abgebrochen, 1);
    const h = (await call('adm', 'GET', `/v1/schnittstellen/${erp}/laeufe?limit=10`)).json().items.find((x: { start: string }) => Date.parse(x.start) < Date.now() - 3_600_000);
    assert.deepEqual([h.stand, h.fehler], ['fehlgeschlagen', 'Lauf abgebrochen: keine Rückmeldung innert einer Stunde.']);
  });
});
