/**
 * Bewertungsmodell und Bewertung (AP-E5-1; BC PP.01.02, PP.01.03, PP.02.01; UC-008 Schritte 1–2, A1): Entwurf aus der
 * Vorgabe bzw. Kopie des Modells in Kraft, ändern mit ETag, Prüfbericht, in Kraft setzen mit Entscheid, unveränderlich in
 * Kraft; Bewertung hoch/mittel/tief ohne Score (A-01) mit Version je Zelle, frühere Bewertungen nach dem damaligen Modell
 * (G11), Budgetrahmen optional (A-18), Rechte und Lesesicht.
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { dbTests, postgresSkip } from '@vollholz/iam-testkit';
import { grant, login, testApi, type TestApi } from './api.ts';
import { full, tenant } from './harness.ts';
import { schluesselAus } from '../../src/modules/priorisierung/vorgabe.ts';

describe('Schlüssel eines Kriteriums', () => {
  test('aus dem Text', () => {
    assert.equal(schluesselAus('Komplexität und Abhängigkeiten'), 'komplexitaet_und_abhaengigkeiten');
    assert.equal(schluesselAus('  Kommunikations- und Change-Aufwand '), 'kommunikations_und_change_aufwand');
    assert.equal(schluesselAus('!!!'), 'kriterium');
  });
});

// Tests mit Datenbank: ohne Konfiguration einzeln übersprungen, konfiguriert und nicht erreichbar scheitert der Lauf
const db = dbTests(await postgresSkip());

db.describe('Priorisierung: Bewertungsmodell und Bewertung', () => {
  let api: TestApi;
  let T: string;
  let pf: string, pfB: string;
  const projekt: Record<'x' | 'y' | 'z' | 'alt' | 'geheim', string> = { x: '', y: '', z: '', alt: '', geheim: '' };
  const h: Record<string, Record<string, string>> = {};

  async function person(sub: string, rolle: string, ort: { type: 'org' } | { type: 'portfolio'; id: string } = { type: 'org' }) {
    const l = await login(api, 'acme', sub, null);
    await grant(api, T, `user:${l.principalId}`, rolle, ort);
    return { authorization: l.authorization };
  }
  const call = (who: string, method: string, url: string, payload?: unknown, headers: Record<string, string> = {}) =>
    api.app.inject({ method: method as 'GET', url, headers: { ...h[who], ...headers }, ...(payload !== undefined ? { payload: payload as Record<string, unknown> } : {}) });

  db.before(async () => {
    api = await testApi();
    T = await tenant(api.t.runtime, 'acme');
    await full(api.t.runtime, T, async tx => {
      pf = (await tx.query<{ id: string }>("INSERT INTO ppm.portfolio (tenant_id, kategorie, schluessel, name, pflichten) VALUES ($1, 'A', 'transformation', 'Transformation', true) RETURNING id", [T])).rows[0]!.id;
      pfB = (await tx.query<{ id: string }>("INSERT INTO ppm.portfolio (tenant_id, kategorie, schluessel, name, pflichten) VALUES ($1, 'B', 'geschaeftsleitung', 'Geschäftsleitung', true) RETURNING id", [T])).rows[0]!.id;
      const neu = (nr: string, p: string, o: { lz?: string; vertraulich?: boolean } = {}) => tx.query<{ id: string }>(
        'INSERT INTO ppm.projekt (tenant_id, nummer, name, portfolio_id, phase, lebenszyklus, vertraulich) VALUES ($1, $2, $2, $3, $4, $5, $6) RETURNING id',
        [T, nr, p, 'P1', o.lz ?? 'aktiv', o.vertraulich ?? false]).then(r => r.rows[0]!.id);
      projekt.x = await neu('2026-001', pf);
      projekt.y = await neu('2026-002', pf);
      projekt.alt = await neu('2026-003', pf, { lz: 'abgeschlossen' });
      projekt.geheim = await neu('2026-004', pf, { vertraulich: true });
      projekt.z = await neu('2026-010', pfB);
    });
    h.ue = await person('ue', 'alle-fuehren');
    h.gl = await person('gl', 'mitglied');
    h.rm = await person('rm', 'mitglied');
    h.gremium = await person('gremium', 'gremium', { type: 'portfolio', id: pf });
  });
  db.after(async () => { await api?.close(); });

  let m1 = '';

  db.test('Bewerten ohne Modell in Kraft: 409; Raster zeigt die aktiven Projekte ohne Modell', async () => {
    const r = await call('ue', 'GET', `/v1/portfolios/${pf}/bewertungen`);
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(r.json().modell, null);
    // UE sieht vertrauliche Projekte (projekt:* enthält projekt:vertraulich)
    assert.deepEqual(r.json().projekte.map((p: { nummer: string }) => p.nummer), ['2026-001', '2026-002', '2026-004']);
    assert.deepEqual(r.json().can, { write: false });
    const p = await call('ue', 'PUT', `/v1/portfolios/${pf}/bewertungen`, { zellen: [{ projektId: projekt.x, kriterium: 'strategiebeitrag', einschaetzung: 'hoch' }] });
    assert.equal(p.statusCode, 409);
    assert.equal((await call('ue', 'GET', '/v1/bewertungsmodelle/aktuell')).statusCode, 404);
  });

  db.test('Entwurf aus der Vorgabe (UC-008 Schritt 2), ändern mit ETag, Prüfbericht, in Kraft setzen mit Entscheid (A1)', async () => {
    const c = await call('ue', 'POST', '/v1/bewertungsmodelle', { beschreibung: 'Priorisierung 2027' });
    assert.equal(c.statusCode, 201, c.body);
    const m = c.json();
    m1 = m.id;
    assert.deepEqual([m.nummer, m.stand, m.aktuell, m.can.write], [1, 'entwurf', false, true]);
    assert.deepEqual(m.kriterien.map((k: { text: string }) => k.text), ['Strategiebeitrag', 'Transformationsrelevanz', 'Betroffene Bereiche', 'Komplexität und Abhängigkeiten', 'Finanzierungsbedarf', 'Ressourcenverfügbarkeit', 'Kommunikations- und Change-Aufwand']);
    assert.ok(m.pruefung.some((x: { stufe: string; pfad: string }) => x.stufe === 'hinweis' && x.pfad === '/budgetrahmen'), 'ohne Budgetrahmen ein Hinweis (A-18)');
    assert.equal(m.pruefung.filter((x: { pfad: string }) => x.pfad.endsWith('/dimension')).length, 7, 'Zuordnung zur Matrix offen (A-39)');
    assert.equal((await call('ue', 'POST', '/v1/bewertungsmodelle', {})).statusCode, 409, 'höchstens ein Entwurf');

    // Kriterien ersetzen (Schlüssel bleibt bzw. wird gebildet), Budgetrahmen je Portfolio
    const kriterien = [
      { schluessel: 'strategiebeitrag', text: 'Strategiebeitrag', dimension: 'nutzen' },
      { text: 'Komplexität und Abhängigkeiten', dimension: 'risiko' },
      { schluessel: 'finanzierungsbedarf', text: 'Finanzierungsbedarf', dimension: null },
    ];
    assert.equal((await call('ue', 'PATCH', `/v1/bewertungsmodelle/${m1}`, { kriterien })).statusCode, 428);
    assert.equal((await call('ue', 'PATCH', `/v1/bewertungsmodelle/${m1}`, { kriterien }, { 'if-match': 'W/"9"' })).statusCode, 412);
    const doppelt = await call('ue', 'PATCH', `/v1/bewertungsmodelle/${m1}`, { kriterien: [...kriterien, { schluessel: 'strategiebeitrag', text: 'Nochmals' }] }, { 'if-match': 'W/"1"' });
    assert.equal(doppelt.statusCode, 422);
    assert.equal((await call('ue', 'PATCH', `/v1/bewertungsmodelle/${m1}`, { budgetrahmen: [{ portfolioId: pf, betrag: 1 }, { portfolioId: pf, betrag: 2 }] }, { 'if-match': 'W/"1"' })).statusCode, 422);
    assert.equal((await call('ue', 'PATCH', `/v1/bewertungsmodelle/${m1}`, { budgetrahmen: [{ portfolioId: '00000000-0000-4000-8000-000000000099', betrag: 1 }] }, { 'if-match': 'W/"1"' })).statusCode, 422);
    const p = await call('ue', 'PATCH', `/v1/bewertungsmodelle/${m1}`, { kriterien, budgetrahmen: [{ portfolioId: pf, betrag: 12000000 }] }, { 'if-match': 'W/"1"' });
    assert.equal(p.statusCode, 200, p.body);
    assert.equal(p.headers.etag, 'W/"2"');
    assert.deepEqual(p.json().kriterien.map((k: { schluessel: string; dimension: string | null; position: number }) => [k.schluessel, k.dimension, k.position]),
      [['strategiebeitrag', 'nutzen', 0], ['komplexitaet_und_abhaengigkeiten', 'risiko', 1], ['finanzierungsbedarf', null, 2]]);
    assert.deepEqual(p.json().budgetrahmen, [{ portfolioId: pf, kategorie: 'A', betrag: 12000000 }]);
    assert.deepEqual(p.json().pruefung.map((x: { pfad: string }) => x.pfad), ['/kriterien/2/dimension']);

    // ohne Kriterien: Sperre beim In-Kraft-Setzen
    const leer = await call('ue', 'PATCH', `/v1/bewertungsmodelle/${m1}`, { kriterien: [] }, { 'if-match': 'W/"2"' });
    assert.equal(leer.json().pruefung[0].stufe, 'sperre');
    assert.equal((await call('ue', 'POST', `/v1/bewertungsmodelle/${m1}/in-kraft-setzen`, { beschluss: 'PRAT 12.11.2026' }, { 'if-match': 'W/"3"' })).statusCode, 422);
    await call('ue', 'PATCH', `/v1/bewertungsmodelle/${m1}`, { kriterien }, { 'if-match': 'W/"3"' });

    assert.equal((await call('ue', 'POST', `/v1/bewertungsmodelle/${m1}/in-kraft-setzen`, { beschluss: '  ' }, { 'if-match': 'W/"4"' })).statusCode, 422);
    const k = await call('ue', 'POST', `/v1/bewertungsmodelle/${m1}/in-kraft-setzen`, { beschluss: ' PRAT 12.11.2026, Traktandum 4 ' }, { 'if-match': 'W/"4"' });
    assert.equal(k.statusCode, 200, k.body);
    assert.deepEqual([k.json().stand, k.json().aktuell, k.json().beschluss, k.json().can.write], ['in_kraft', true, 'PRAT 12.11.2026, Traktandum 4', false]);
    assert.ok(k.json().inKraftAt && k.json().inKraftBy);

    // in Kraft: unveränderlich (409), nicht verwerfbar
    assert.equal((await call('ue', 'PATCH', `/v1/bewertungsmodelle/${m1}`, { beschreibung: 'neu' }, { 'if-match': 'W/"5"' })).statusCode, 409);
    assert.equal((await call('ue', 'DELETE', `/v1/bewertungsmodelle/${m1}`, undefined, { 'if-match': 'W/"5"' })).statusCode, 409);
    // auch direkt in der Datenbank nicht (Lesesicht: Ändern nur im Entwurf; dahinter der Trigger)
    assert.equal((await full(api.t.runtime, T, tx => tx.query('UPDATE ppm.bewertungsmodell SET beschreibung = $2 WHERE id = $1', [m1, 'x']))).rowCount, 0);

    const audit = await full(api.t.runtime, T, async tx => (await tx.query<{ action: string }>("SELECT action FROM ppm.audit_log WHERE resource_id = $1 ORDER BY seq", [m1])).rows.map(r => r.action));
    assert.deepEqual(audit, ['bewertungsmodell.created', 'bewertungsmodell.updated', 'bewertungsmodell.updated', 'bewertungsmodell.updated', 'bewertungsmodell.activated']);
  });

  db.test('Bewerten (PP.02.01): Raster mit Version je Zelle, Fortschritt, nur aktive Projekte und Kriterien des Modells', async () => {
    const put = (zellen: unknown[]) => call('ue', 'PUT', `/v1/portfolios/${pf}/bewertungen`, { zellen });
    const r = await put([
      { projektId: projekt.x, kriterium: 'strategiebeitrag', einschaetzung: 'hoch', kommentar: ' Kernvorhaben ' },
      { projektId: projekt.x, kriterium: 'komplexitaet_und_abhaengigkeiten', einschaetzung: 'mittel' },
      { projektId: projekt.x, kriterium: 'finanzierungsbedarf', einschaetzung: 'tief' },
      { projektId: projekt.y, kriterium: 'strategiebeitrag', einschaetzung: 'mittel' },
    ]);
    assert.equal(r.statusCode, 200, r.body);
    assert.deepEqual(r.json().zellen[0], { projektId: projekt.x, kriterium: 'strategiebeitrag', einschaetzung: 'hoch', kommentar: 'Kernvorhaben', version: 1 });

    const g = (await call('ue', 'GET', `/v1/portfolios/${pf}/bewertungen`)).json();
    assert.equal(g.modell.nummer, 1);
    assert.deepEqual(g.modell.kriterien.map((k: { schluessel: string }) => k.schluessel), ['strategiebeitrag', 'komplexitaet_und_abhaengigkeiten', 'finanzierungsbedarf']);
    assert.deepEqual(g.projekte.map((p: { nummer: string; bewertet: number }) => [p.nummer, p.bewertet]), [['2026-001', 3], ['2026-002', 1], ['2026-004', 0]]);
    assert.deepEqual(g.fortschritt, { bewertet: 1, gesamt: 3 });
    assert.deepEqual(g.can, { write: true });

    // vorhandene Zelle ohne bzw. mit alter Version: 412, nichts gespeichert (alles oder nichts)
    const ohne = await put([{ projektId: projekt.y, kriterium: 'finanzierungsbedarf', einschaetzung: 'hoch' }, { projektId: projekt.x, kriterium: 'strategiebeitrag', einschaetzung: 'tief' }]);
    assert.equal(ohne.statusCode, 412);
    assert.equal((await call('ue', 'GET', `/v1/portfolios/${pf}/bewertungen`)).json().bewertungen.length, 4);
    const neu = await put([{ projektId: projekt.x, kriterium: 'strategiebeitrag', einschaetzung: 'tief', version: 1 }, { projektId: projekt.y, kriterium: 'strategiebeitrag', einschaetzung: null, version: 1 }]);
    assert.equal(neu.statusCode, 200, neu.body);
    assert.deepEqual(neu.json().zellen, [
      { projektId: projekt.x, kriterium: 'strategiebeitrag', einschaetzung: 'tief', kommentar: 'Kernvorhaben', version: 2 },
      { projektId: projekt.y, kriterium: 'strategiebeitrag', einschaetzung: null, kommentar: '', version: null },
    ]);

    // abgeschlossenes Projekt, Projekt eines anderen Portfolios, unbekanntes Kriterium, falsche Einschätzung, doppelt
    for (const zellen of [[{ projektId: projekt.alt, kriterium: 'strategiebeitrag', einschaetzung: 'hoch' }], [{ projektId: projekt.z, kriterium: 'strategiebeitrag', einschaetzung: 'hoch' }],
      [{ projektId: projekt.x, kriterium: 'transformationsrelevanz', einschaetzung: 'hoch' }], [{ projektId: projekt.x, kriterium: 'finanzierungsbedarf', einschaetzung: 'sehr hoch' }],
      [{ projektId: projekt.y, kriterium: 'finanzierungsbedarf', einschaetzung: 'hoch' }, { projektId: projekt.y, kriterium: 'finanzierungsbedarf', einschaetzung: 'tief' }]]) {
      assert.equal((await put(zellen)).statusCode, 422, JSON.stringify(zellen));
    }
    const audit = await full(api.t.runtime, T, async tx => (await tx.query<{ action: string }>("SELECT action FROM ppm.audit_log WHERE action LIKE 'bewertung.%' ORDER BY seq")).rows.map(r => r.action));
    assert.deepEqual(audit, ['bewertung.created', 'bewertung.created', 'bewertung.created', 'bewertung.created', 'bewertung.updated', 'bewertung.deleted']);
  });

  db.test('Rechte: UE pflegt; Gremium liest Raster und Budgetrahmen seines Portfolios; GL und RM sehen die Priorisierung nicht', async () => {
    const gr = await call('gremium', 'GET', `/v1/portfolios/${pf}/bewertungen`);
    assert.equal(gr.statusCode, 200, gr.body);
    assert.deepEqual(gr.json().can, { write: false });
    assert.equal(gr.json().bewertungen.length, 3);
    assert.equal((await call('gremium', 'GET', `/v1/portfolios/${pfB}/bewertungen`)).statusCode, 403, 'anderes Portfolio');
    assert.equal((await call('gremium', 'PUT', `/v1/portfolios/${pf}/bewertungen`, { zellen: [{ projektId: projekt.x, kriterium: 'finanzierungsbedarf', einschaetzung: 'hoch', version: 1 }] })).statusCode, 403);
    for (const who of ['gl', 'rm']) {
      assert.equal((await call(who, 'GET', `/v1/portfolios/${pf}/bewertungen`)).statusCode, 403, who);
      assert.equal((await call(who, 'GET', '/v1/bewertungsmodelle')).statusCode, 403, who);
      assert.equal((await call(who, 'POST', '/v1/bewertungsmodelle', {})).statusCode, 403, who);
    }
    assert.equal((await call('ue', 'GET', '/v1/portfolios/00000000-0000-4000-8000-000000000099/bewertungen')).statusCode, 404);
  });

  db.test('Neues Modell (A1): Entwurf kopiert das Modell in Kraft; frühere Bewertungen bleiben nach dem damaligen Modell lesbar (G11)', async () => {
    const c = await call('ue', 'POST', '/v1/bewertungsmodelle', {});
    assert.equal(c.statusCode, 201, c.body);
    const m2 = c.json();
    assert.equal(m2.nummer, 2);
    assert.equal(m2.beschreibung, 'Priorisierung 2027');
    assert.deepEqual(m2.kriterien.map((k: { schluessel: string }) => k.schluessel), ['strategiebeitrag', 'komplexitaet_und_abhaengigkeiten', 'finanzierungsbedarf']);
    assert.deepEqual(m2.budgetrahmen, [{ portfolioId: pf, kategorie: 'A', betrag: 12000000 }]);
    // Bewertet wird weiter nach Modell 1, bis Modell 2 in Kraft ist
    assert.equal((await call('ue', 'GET', `/v1/portfolios/${pf}/bewertungen`)).json().modell.nummer, 1);
    await call('ue', 'PATCH', `/v1/bewertungsmodelle/${m2.id}`, { kriterien: [{ schluessel: 'strategiebeitrag', text: 'Strategiebeitrag', dimension: 'nutzen' }, { text: 'Dringlichkeit', dimension: 'nutzen' }] }, { 'if-match': 'W/"1"' });
    assert.equal((await call('ue', 'POST', `/v1/bewertungsmodelle/${m2.id}/in-kraft-setzen`, { beschluss: 'PRAT 3.12.2026' }, { 'if-match': 'W/"2"' })).statusCode, 200);

    const neu = (await call('ue', 'GET', `/v1/portfolios/${pf}/bewertungen`)).json();
    assert.deepEqual([neu.modell.nummer, neu.bewertungen.length, neu.fortschritt], [2, 0, { bewertet: 0, gesamt: 3 }]);
    const alt = (await call('ue', 'GET', `/v1/portfolios/${pf}/bewertungen?modell=${m1}`)).json();
    assert.deepEqual([alt.modell.nummer, alt.modell.aktuell, alt.bewertungen.length, alt.can.write], [1, false, 3, false]);
    const liste = (await call('ue', 'GET', '/v1/bewertungsmodelle')).json();
    assert.deepEqual(liste.items.map((m: { nummer: number; stand: string; aktuell: boolean }) => [m.nummer, m.stand, m.aktuell]), [[2, 'in_kraft', true], [1, 'in_kraft', false]]);
    assert.equal(liste.can.create, true);

    // Entwurf verwerfen
    const e = (await call('ue', 'POST', '/v1/bewertungsmodelle', {})).json();
    assert.equal((await call('ue', 'DELETE', `/v1/bewertungsmodelle/${e.id}`, undefined, { 'if-match': 'W/"9"' })).statusCode, 412);
    assert.equal((await call('ue', 'DELETE', `/v1/bewertungsmodelle/${e.id}`, undefined, { 'if-match': 'W/"1"' })).statusCode, 204);
    assert.equal((await call('ue', 'GET', `/v1/bewertungsmodelle/${e.id}`)).statusCode, 404);
  });
});
