/**
 * Vorlagen mit Versionen und Feldzuordnung (AP-E7-7; BC AM.03.01; UC-018 Schritte 1–2): Liste aller Dokumentarten,
 * Word-Vorlage hochladen (Platzhalter über mehrere Läufe), Vorschlag der Zuordnung, Prüfung (Sperre, Warnung G12),
 * aktiv setzen und ablösen, Word-Ausgabe des Projektvertrags mit der aktiven Vorlage (DM.02.07), Arten ohne
 * Datenquelle, ungültige Dateien, Rechte, Audit.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { entpacken } from '../../src/modules/vorlage/zip.ts';
import { wordVorlage } from './fixtures/word.ts';
import { grant, login, testApi, type TestApi } from './api.ts';
import { full, skipDb, tenant } from './harness.ts';

const skip = await skipDb();

type H = Record<string, string>;

const b64 = (b: Buffer) => b.toString('base64');
const dokumentText = (docx: Buffer) => entpacken(docx).find(e => e.name === 'word/document.xml')!.daten.toString('utf8');

describe('Vorlagen', { skip }, () => {
  let api: TestApi;
  let T: string;
  let projekt = '', version = '';
  const h: Record<string, H> = {};

  const call = (who: string, method: string, url: string, payload?: unknown, headers: H = {}) =>
    api.app.inject({ method: method as 'GET', url, headers: { ...h[who], ...headers }, ...(payload !== undefined ? { payload: payload as Record<string, unknown> } : {}) });

  before(async () => {
    api = await testApi();
    T = await tenant(api.t.runtime, 'acme');
    await full(api.t.runtime, T, async tx => {
      const pf = (await tx.query<{ id: string }>("INSERT INTO ppm.portfolio (tenant_id, kategorie, schluessel, name, pflichten) VALUES ($1, 'A', 'vl', 'VL', true) RETURNING id", [T])).rows[0]!.id;
      projekt = (await tx.query<{ id: string }>("INSERT INTO ppm.projekt (tenant_id, nummer, name, portfolio_id) VALUES ($1, '2026-031', 'Digitale Aufnahme', $2) RETURNING id", [T, pf])).rows[0]!.id;
    });
    for (const [sub, rolle, ort] of [['ue', 'ue', { type: 'org' }], ['pl', 'pl', { type: 'projekt', id: projekt }]] as const) {
      const l = await login(api, 'acme', `vl-${sub}`, null);
      await grant(api, T, `user:${l.principalId}`, rolle, ort as { type: 'org' });
      h[sub] = { authorization: l.authorization };
    }
    const c = await call('pl', 'POST', `/v1/projekte/${projekt}/vertrag/entwuerfe`, { anlass: 'initial' });
    assert.equal(c.statusCode, 201, c.body);
    version = c.json().version.id;
    const g = await call('pl', 'GET', `/v1/vertragsversionen/${version}/kapitel/1`);
    const inhalt = { ...g.json().inhalt, ausgangslage: 'Papier & Doppelerfassung\nzweite Zeile' };
    assert.equal((await call('pl', 'PUT', `/v1/vertragsversionen/${version}/kapitel/1`, { inhalt }, { 'if-match': g.headers.etag as string })).statusCode, 200);
  });
  after(async () => { await api?.close(); });

  test('Liste: alle neun Dokumentarten, Grundbestand und Datenquelle (UC-018 Schritt 1)', async () => {
    const r = await call('ue', 'GET', '/v1/vorlagen');
    assert.equal(r.statusCode, 200, r.body);
    const items = r.json().items as { art: string; grundbestand: unknown; datenquelle: boolean; aktiv: number | null }[];
    assert.deepEqual(items.map(i => i.art), ['projektidee', 'vorstudie', 'business_case', 'projektvertrag', 'loesungskonzept', 'abschlussbericht', 'statusbericht', 'portfoliobericht', 'quartalsreporting']);
    const pv = items.find(i => i.art === 'projektvertrag')!;
    assert.deepEqual([pv.datenquelle, pv.aktiv, !!pv.grundbestand], [true, null, true]);
    assert.equal(items.find(i => i.art === 'vorstudie')!.datenquelle, false, 'nur als Zuordnungsziel vorbereitet');
    assert.equal((await call('pl', 'GET', '/v1/vorlagen')).statusCode, 403);
  });

  let v1Rev = '';

  test('hochladen: Platzhalter über Läufe, Vorschlag nach Bezeichnung, Prüfung sperrt (UC-018 Schritt 2)', async () => {
    const datei = wordVorlage([['Projektvertrag «Projekt', 'name»'], ['Version «Version» · «Ausgang', 'slage»'], ['«Unbekannt»']]);
    const r = await call('ue', 'POST', '/v1/vorlagen/projektvertrag/versionen', { dateiname: 'Vertrag.docx', inhalt: b64(datei), bemerkung: 'Neues Logo' });
    assert.equal(r.statusCode, 201, r.body);
    const v = r.json();
    assert.deepEqual([v.version, v.stand, v.platzhalter], [1, 'entwurf', ['Projektname', 'Version', 'Ausgangslage', 'Unbekannt']]);
    assert.deepEqual(v.zuordnung, { Projektname: 'projekt.name', Version: 'version.nummer', Ausgangslage: 'kap1.ausgangslage', Unbekannt: null });
    assert.equal(r.headers.location, '/v1/vorlagen/projektvertrag/versionen/1');
    assert.equal(v.pruefung.aktivierbar, false);
    assert.deepEqual(v.pruefung.meldungen.map((m: { regel: string; stufe: string }) => `${m.stufe}:${m.regel}`), ['sperre:zuordnung', 'warnung:personendaten']);
    assert.match(v.pruefung.meldungen[0].text, /1 von 4 Platzhaltern ohne Datenfeld \(«Unbekannt»\)/);
    assert.deepEqual(v.can, { zuordnen: true, aktivieren: false, entfernen: true });
    v1Rev = r.headers.etag as string;

    // aktiv setzen mit Sperre: 409 mit Prüfung
    const a = await call('ue', 'POST', '/v1/vorlagen/projektvertrag/versionen/1/aktivieren', undefined, { 'if-match': v1Rev });
    assert.equal(a.statusCode, 409, a.body);
    assert.equal(a.json().reason, 'pruefung');

    // Zuordnung ergänzen: unbekanntes Feld sperrt, fremder Platzhalter 422, falsches If-Match 412
    const fremd = await call('ue', 'PATCH', '/v1/vorlagen/projektvertrag/versionen/1', { zuordnung: { Gibtsnicht: 'projekt.name' } }, { 'if-match': v1Rev });
    assert.equal(fremd.statusCode, 422, fremd.body);
    assert.equal((await call('ue', 'PATCH', '/v1/vorlagen/projektvertrag/versionen/1', { bemerkung: 'x' }, { 'if-match': 'W/"9"' })).statusCode, 412);
    const falsch = await call('ue', 'PATCH', '/v1/vorlagen/projektvertrag/versionen/1', { zuordnung: { ...v.zuordnung, Unbekannt: 'gibt.es.nicht' } }, { 'if-match': v1Rev });
    assert.equal(falsch.statusCode, 200, falsch.body);
    assert.ok(falsch.json().pruefung.meldungen.some((m: { regel: string }) => m.regel === 'feld'));
    const ok = await call('ue', 'PATCH', '/v1/vorlagen/projektvertrag/versionen/1', { zuordnung: { ...v.zuordnung, Unbekannt: 'kap1.problemstellung' } }, { 'if-match': falsch.headers.etag as string });
    assert.equal(ok.statusCode, 200, ok.body);
    assert.deepEqual([ok.json().pruefung.aktivierbar, ok.json().can.aktivieren], [true, true]);
    v1Rev = ok.headers.etag as string;
  });

  test('aktiv setzen: Word-Ausgabe des Vertrags mit der eigenen Vorlage, PDF weiter im Grundbestand (DM.02.07)', async () => {
    const a = await call('ue', 'POST', '/v1/vorlagen/projektvertrag/versionen/1/aktivieren', undefined, { 'if-match': v1Rev });
    assert.equal(a.statusCode, 200, a.body);
    assert.deepEqual([a.json().stand, a.json().can], ['aktiv', { zuordnen: false, aktivieren: false, entfernen: false }]);
    assert.equal((await call('ue', 'PATCH', '/v1/vorlagen/projektvertrag/versionen/1', { bemerkung: 'x' }, { 'if-match': a.headers.etag as string })).statusCode, 409, 'aktiv: unveränderlich');
    assert.equal((await call('ue', 'GET', '/v1/vorlagen')).json().items.find((i: { art: string }) => i.art === 'projektvertrag').aktiv, 1);

    // die PL liest die Vorlage nicht, erhält aber das Dokument in ihrer Gestaltung
    const d = await call('pl', 'GET', `/v1/vertragsversionen/${version}/dokument?format=docx`);
    assert.equal(d.statusCode, 200, d.body);
    const xml = dokumentText(d.rawPayload);
    assert.match(xml, /Projektvertrag Digitale Aufnahme/);
    assert.match(xml, /Version 0\.1 · Papier &amp; Doppelerfassung<\/w:t><w:br\/><w:t xml:space="preserve">zweite Zeile/);
    assert.doesNotMatch(xml, /«/);
    assert.match((await call('pl', 'GET', `/v1/vertragsversionen/${version}/dokument?format=pdf`)).rawPayload.subarray(0, 8).toString('latin1'), /%PDF/);
  });

  test('neue Version übernimmt die Zuordnung, löst beim Aktivieren die alte ab; Entwurf löschen', async () => {
    const datei = wordVorlage([['«Projektname» – «Version»']], 'Intern · enthält Personendaten');
    const r = await call('ue', 'POST', '/v1/vorlagen/projektvertrag/versionen', { dateiname: 'Vertrag v2.docx', inhalt: b64(datei) });
    assert.equal(r.statusCode, 201, r.body);
    assert.deepEqual([r.json().version, r.json().personendaten, r.json().pruefung.meldungen], [2, true, []]);
    const a = await call('ue', 'POST', '/v1/vorlagen/projektvertrag/versionen/2/aktivieren', undefined, { 'if-match': r.headers.etag as string });
    assert.equal(a.statusCode, 200, a.body);
    const liste = (await call('ue', 'GET', '/v1/vorlagen/projektvertrag')).json();
    assert.deepEqual(liste.versionen.map((v: { version: number; stand: string }) => `${v.version}:${v.stand}`), ['2:aktiv', '1:abgeloest']);
    assert.ok(liste.felder.some((f: { schluessel: string }) => f.schluessel === 'kap10.risiken'));

    const e = await call('ue', 'POST', '/v1/vorlagen/projektvertrag/versionen', { dateiname: 'Entwurf.docx', inhalt: b64(datei) });
    assert.equal((await call('ue', 'DELETE', '/v1/vorlagen/projektvertrag/versionen/3', undefined, { 'if-match': e.headers.etag as string })).statusCode, 204);
    assert.equal((await call('ue', 'DELETE', '/v1/vorlagen/projektvertrag/versionen/2', undefined, { 'if-match': a.headers.etag as string })).statusCode, 409, 'aktiv nicht löschbar');
    const dl = await call('ue', 'GET', '/v1/vorlagen/projektvertrag/versionen/2/datei');
    assert.equal(dl.statusCode, 200);
    assert.ok(dl.rawPayload.equals(datei));
  });

  test('Art ohne Datenquelle bleibt Entwurf; ungültige Dateien 422', async () => {
    const r = await call('ue', 'POST', '/v1/vorlagen/vorstudie/versionen', { dateiname: 'Vorstudie.docx', inhalt: b64(wordVorlage([['«Titel»']])) });
    assert.equal(r.statusCode, 201, r.body);
    assert.equal(r.json().pruefung.meldungen[0].regel, 'datenquelle');
    assert.equal((await call('ue', 'POST', '/v1/vorlagen/vorstudie/versionen/1/aktivieren', undefined, { 'if-match': r.headers.etag as string })).statusCode, 409);

    for (const inhalt of [Buffer.from('kein zip'), wordVorlage([]).subarray(0, 40)]) {
      const x = await call('ue', 'POST', '/v1/vorlagen/vorstudie/versionen', { dateiname: 'Kaputt.docx', inhalt: b64(inhalt) });
      assert.equal(x.statusCode, 422, x.body);
    }
    assert.equal((await call('ue', 'POST', '/v1/vorlagen/vorstudie/versionen', { dateiname: 'Text.txt', inhalt: b64(Buffer.from('x')) })).statusCode, 422);
    assert.equal((await call('ue', 'GET', '/v1/vorlagen/gibtsnicht')).statusCode, 422);
    assert.equal((await call('pl', 'POST', '/v1/vorlagen/vorstudie/versionen', { dateiname: 'X.docx', inhalt: b64(wordVorlage([['x']])) })).statusCode, 403);
  });

  test('Audit und Ereignis', async () => {
    const rows = await full(api.t.runtime, T, async tx => (await tx.query<{ action: string }>(
      "SELECT action FROM ppm.audit_log WHERE resource_type = 'vorlage' ORDER BY id")).rows.map(r => r.action));
    assert.deepEqual([...new Set(rows)].sort(), ['vorlage.activated', 'vorlage.created', 'vorlage.deleted', 'vorlage.updated']);
  });
});
