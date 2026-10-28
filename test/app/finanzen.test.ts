/**
 * Finanzen (AP-E7-4; BC PC.01.02, PC.01.04, PC.01.05; UC-010): Rechnungen ohne Datenbank (Abweichung mit Toleranz A-10,
 * Jahresbedarf zeitanteilig A-17, Lieferung des ERP), Ist-Kosten über die Schnittstelle «ERP · Ist-Kosten» mit einem
 * lokalen HTTP-Server als ERP (A-16), Kostenträger je Projekt (A1.1), Übersicht und Abweichungen, Begründung durch die
 * PL mit Aufgabe «Abweichung klären», Jahresbedarf mit Korrektur durch FI und Übergabe an den Budgetprozess, Rechte.
 */
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { after, before, describe, test } from 'node:test';
import { abweichungenPruefen } from '../../src/modules/finanzen/aufgaben.ts';
import { buchungenLesen } from '../../src/modules/finanzen/erp.ts';
import { abweichung, anteilImJahr, jahresbedarf, periode, phasenZeitraeume, summen } from '../../src/modules/finanzen/rechnen.ts';
import * as store from '../../src/modules/finanzen/store.ts';
import { grant, login, testApi, type TestApi } from './api.ts';
import { full, skipDb, tenant } from './harness.ts';

describe('Rechnungen der Finanzen (ohne Datenbank)', () => {
  const pos = (phase: string, art: 'capex' | 'opex', budgetBaseline: number | null, prognose: number | null) => ({ phase, art, budgetBaseline, prognose });
  test('Summen und Abweichung mit Toleranz (A-10)', () => {
    const s = summen([pos('P1', 'capex', 100000, 120000), pos('P2', 'opex', 50000, null)]);
    assert.deepEqual(s, { budget: 150000, prognose: 170000 });
    assert.deepEqual(abweichung(s, 10), { betrag: 20000, prozent: 13.3, wesentlich: true });
    assert.deepEqual(abweichung(s, 15), { betrag: 20000, prozent: 13.3, wesentlich: false });
    assert.deepEqual(abweichung(s, null), { betrag: 20000, prozent: 13.3, wesentlich: false }, 'ohne Toleranz nie wesentlich');
    assert.deepEqual(abweichung(summen([pos('P1', 'opex', null, 500)]), 10), { betrag: null, prozent: null, wesentlich: false });
  });
  test('Phasenzeiträume und Jahresbedarf zeitanteilig (A-17)', () => {
    const ms = [
      { phase: 'P1', terminBaseline: '2026-06-30', terminAktuell: null },
      { phase: 'P2', terminBaseline: '2027-03-31', terminAktuell: '2027-06-30' },
    ];
    assert.deepEqual([...phasenZeitraeume(ms)], [['P1', { von: '2026-06-30', bis: '2026-06-30' }], ['P2', { von: '2026-07-01', bis: '2027-06-30' }]]);
    assert.equal(anteilImJahr({ von: '2026-07-01', bis: '2027-06-30' }, 2027), 181 / 365);
    const j = jahresbedarf([pos('P1', 'capex', 100000, 120000), pos('P2', 'opex', 50000, null), pos('P3', 'opex', 9000, null)], ms, 2027);
    assert.deepEqual(j, { bedarf: { capex: 0, opex: 24794.52 }, ohneTermine: ['P3'] });
    assert.match(periode(new Date('2026-10-31T23:30:00Z')), /^2026-11$/, 'Periode in Zürich');
  });
  test('Lieferung des ERP prüfen und zusammenfassen', () => {
    assert.deepEqual(buchungenLesen(JSON.stringify({ buchungen: [
      { kostentraeger: 'KT-1', monat: '2026-09', art: 'capex', betrag: 30000 }, { kostentraeger: 'KT-1', monat: '2026-09', art: 'capex', betrag: '5000.5' },
      { kostentraeger: 'KT-1', monat: '2026-10', art: 'opex', betrag: -200 },
    ] })), [
      { kostentraeger: 'KT-1', monat: '2026-09', art: 'capex', betrag: 35000.5 }, { kostentraeger: 'KT-1', monat: '2026-10', art: 'opex', betrag: -200 },
    ]);
    for (const [body, fehler] of [['x', /JSON/], ['{}', /Liste/], ['[{"kostentraeger":"KT 1","monat":"2026-09","art":"capex","betrag":1}]', /Buchung 1: Kostenträger/],
      ['[{"kostentraeger":"KT","monat":"2026-13","art":"capex","betrag":1}]', /Monat/], ['[{"kostentraeger":"KT","monat":"2026-01","art":"x","betrag":1}]', /Art/],
      ['[{"kostentraeger":"KT","monat":"2026-01","art":"opex"}]', /Betrag/]] as const) {
      assert.throws(() => buchungenLesen(body), fehler);
    }
  });
});

const skip = await skipDb();

describe('Finanzen (API)', { skip }, () => {
  let api: TestApi;
  let T: string;
  let pf: string;
  let server: Server;
  let basis = '';
  const p = { a: '', b: '', c: '' };
  const h: Record<string, Record<string, string>> = {};
  let erpAntwort = '[]';
  const empfangen: unknown[] = [];

  const call = (who: string, method: string, url: string, payload?: unknown, headers: Record<string, string> = {}) =>
    api.app.inject({ method: method as 'GET', url, headers: { ...h[who], ...headers }, ...(payload !== undefined ? { payload: payload as Record<string, unknown> } : {}) });
  const aufgaben = (art: string) => full(api.t.runtime, T, async tx =>
    (await tx.query<{ bezug_id: string; stand: string; titel: string; link: string }>('SELECT bezug_id, stand, titel, link FROM ppm.aufgabe WHERE art = $1 ORDER BY created_at', [art])).rows);

  before(async () => {
    server = createServer((req, res) => {
      let body = '';
      req.on('data', c => { body += c; });
      req.on('end', () => {
        if (req.method === 'POST') empfangen.push(JSON.parse(body));
        res.writeHead(200, { 'content-type': 'application/json' }).end(req.url === '/ist' ? erpAntwort : '{}');
      });
    });
    await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
    basis = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    api = await testApi();
    T = await tenant(api.t.runtime, 'acme');
    for (const [sub, rolle] of [['adm', 'org-admin'], ['fi', 'fi'], ['ue', 'ue'], ['gl', 'gl'], ['leser', 'leser']] as const) {
      h[sub] = { authorization: (await login(api, 'acme', sub, rolle)).authorization };
    }
    await full(api.t.runtime, T, async tx => {
      pf = (await tx.query<{ id: string }>("INSERT INTO ppm.portfolio (tenant_id, kategorie, schluessel, name, pflichten) VALUES ($1, 'A', 'transformation', 'Transformation', true) RETURNING id", [T])).rows[0]!.id;
      const neu = (nr: string) => tx.query<{ id: string }>("INSERT INTO ppm.projekt (tenant_id, nummer, name, portfolio_id, phase) VALUES ($1, $2, $2, $3, 'P1') RETURNING id", [T, nr, pf]).then(r => r.rows[0]!.id);
      p.a = await neu('2026-001');
      p.b = await neu('2026-002');
      await tx.query(`INSERT INTO ppm.kosten (tenant_id, projekt_id, phase, art, text, budget_baseline, prognose) VALUES
        ($1, $2, 'P1', 'capex', 'Server', 100000, 120000), ($1, $2, 'P2', 'opex', 'Betrieb', 50000, NULL), ($1, $3, 'P1', 'opex', 'Beratung', 10000, 10500)`, [T, p.a, p.b]);
      await tx.query(`INSERT INTO ppm.meilenstein (tenant_id, projekt_id, phase, art, text, termin_baseline, termin_aktuell) VALUES
        ($1, $2, 'P1', 'meilenstein', 'Konzept', '2026-06-30', NULL), ($1, $2, 'P2', 'meilenstein', 'Einführung', '2027-03-31', '2027-06-30')`, [T, p.a]);
    });
    const pl = await login(api, 'acme', 'pl', null);
    await grant(api, T, `user:${pl.principalId}`, 'pl', { type: 'projekt', id: p.a });
    h.pl = { authorization: pl.authorization };
    const gremium = await login(api, 'acme', 'gremium', null);
    await grant(api, T, `user:${gremium.principalId}`, 'gremium', { type: 'portfolio', id: pf });
    h.gremium = { authorization: gremium.authorization };
    // Toleranz «Kosten» 10 % im Phasenmodell in Kraft (A-10)
    const m = await call('ue', 'POST', '/v1/phasenmodelle', {});
    assert.equal(m.statusCode, 201, m.body);
    const e = await call('ue', 'PATCH', `/v1/phasenmodelle/${m.json().id}`, { toleranzen: [{ dimension: 'kosten', wert: 10, einheit: 'prozent' }] }, { 'if-match': m.headers.etag as string });
    assert.equal(e.statusCode, 200, e.body);
    const k = await call('adm', 'POST', `/v1/phasenmodelle/${m.json().id}/in-kraft-setzen`, undefined, { 'if-match': e.headers.etag as string });
    assert.equal(k.statusCode, 200, k.body);
  });
  after(async () => {
    await api?.close();
    await new Promise(r => server.close(r));
  });

  test('Ist-Kosten über die Schnittstelle ERP (A-16); Kostenträger zuordnen (A1.1); Übersicht mit Toleranz (UC-010 Schritt 2)', async () => {
    erpAntwort = JSON.stringify([
      { kostentraeger: 'KT-1', monat: '2026-09', art: 'capex', betrag: 30000 }, { kostentraeger: 'KT-1', monat: '2026-09', art: 'capex', betrag: 5000 },
      { kostentraeger: 'KT-1', monat: '2026-10', art: 'opex', betrag: 1200 }, { kostentraeger: 'KT-9', monat: '2026-10', art: 'opex', betrag: 99 },
    ]);
    const s = await call('adm', 'POST', '/v1/schnittstellen', { umsystem: 'erp', daten: 'ist_kosten', rhythmus: 'monatlich', adresse: `${basis}/ist` });
    assert.equal(s.statusCode, 201, s.body);
    const l = await call('adm', 'POST', `/v1/schnittstellen/${s.json().schnittstelle.id}/starten`);
    assert.deepEqual([l.json().stand, l.json().umfang, l.json().fehler], ['erfolgreich', 3, null]);

    const vorher = (await call('fi', 'GET', `/v1/finanzen?portfolio=${pf}`)).json();
    assert.deepEqual(vorher.projekte.map((x: { nummer: string; ist: number | null; kostentraeger: string | null }) => [x.nummer, x.ist, x.kostentraeger]), [['2026-001', null, null], ['2026-002', null, null]]);
    assert.deepEqual(vorher.ohneProjekt.map((x: { kostentraeger: string }) => x.kostentraeger), ['KT-1', 'KT-9']);

    assert.equal((await call('ue', 'PUT', `/v1/projekte/${p.a}/kostentraeger`, { nummer: 'KT-1' })).statusCode, 403, 'nur FI');
    const kt = await call('fi', 'PUT', `/v1/projekte/${p.a}/kostentraeger`, { nummer: 'KT-1' });
    assert.equal(kt.statusCode, 200, kt.body);
    assert.deepEqual([kt.json().ist, kt.json().istJeArt, kt.json().istBis], [36200, { capex: 35000, opex: 1200 }, '2026-10']);
    assert.equal((await call('fi', 'PUT', `/v1/projekte/${p.b}/kostentraeger`, { nummer: 'KT-1' })).statusCode, 409);
    assert.equal((await call('fi', 'PUT', `/v1/projekte/${p.b}/kostentraeger`, { nummer: 'KT 2' })).statusCode, 422);
    // null entfernt den Kostenträger (Nullable aus der Plattform, ohne Typumwandlung)
    const ohneKt = await call('fi', 'PUT', `/v1/projekte/${p.b}/kostentraeger`, { nummer: null });
    assert.equal(ohneKt.statusCode, 200, ohneKt.body);
    assert.equal(ohneKt.json().kostentraeger, null);

    const u = (await call('fi', 'GET', `/v1/finanzen?portfolio=${pf}`)).json();
    const a = u.projekte[0];
    assert.deepEqual([a.budget, a.prognose, a.toleranzProzent, a.abweichung], [150000, 170000, 10, { betrag: 20000, prozent: 13.3, wesentlich: true }]);
    assert.deepEqual(a.phasen, [{ phase: 'P1', art: 'capex', budget: 100000, prognose: 120000 }, { phase: 'P2', art: 'opex', budget: 50000, prognose: 50000 }]);
    assert.deepEqual(a.verlauf, [{ monat: '2026-09', capex: 35000, opex: 0 }, { monat: '2026-10', capex: 0, opex: 1200 }]);
    assert.deepEqual(u.projekte[1].abweichung, { betrag: 500, prozent: 5, wesentlich: false });
    assert.deepEqual(u.summe, { budget: 160000, prognose: 180500, ist: 36200, abweichung: 20500 });
    assert.deepEqual([u.istStand, u.ohneProjekt.map((x: { kostentraeger: string }) => x.kostentraeger), u.can.write], ['2026-10', ['KT-9'], true]);

    // Erneuter Lauf ersetzt die gelieferten Monate (wiederholbar)
    erpAntwort = JSON.stringify([{ kostentraeger: 'KT-1', monat: '2026-10', art: 'opex', betrag: 1500 }]);
    await call('adm', 'POST', `/v1/schnittstellen/${s.json().schnittstelle.id}/starten`);
    const neu = (await call('fi', 'GET', `/v1/finanzen?portfolio=${pf}`)).json().projekte[0];
    assert.deepEqual([neu.ist, neu.istJeArt], [36500, { capex: 35000, opex: 1500 }]);
  });

  test('Abweichungen (Schritt 3), Aufgabe «Abweichung klären» und Begründung durch die PL (Schritt 4)', async () => {
    const ab = (await call('ue', 'GET', `/v1/finanzen/abweichungen?portfolio=${pf}`)).json();
    assert.deepEqual(ab.projekte.map((x: { nummer: string }) => x.nummer), ['2026-001', '2026-002'], 'wesentliche zuerst');
    assert.deepEqual([ab.can.write, ab.ohneProjekt], [false, []], 'UE sieht, pflegt aber nicht');

    await full(api.t.runtime, T, async tx => abweichungenPruefen(tx, await store.projekte(tx)));
    const offen = await aufgaben('abweichung.klaeren');
    assert.deepEqual(offen.map(x => [x.bezug_id, x.stand, x.link]), [[p.a, 'offen', '/portfolio/finanzen/abweichungen?o=2026-001']]);
    assert.match(offen[0]!.titel, /Prognose 20.000 CHF über Budget/);

    const per = periode();
    const url = `/v1/projekte/${p.a}/abweichungsbegruendungen`;
    const plR = await call('pl', 'GET', '/v1/finanzen');
    assert.equal(plR.statusCode, 200, plR.body);
    const plSicht = plR.json();
    assert.deepEqual([plSicht.projekte.map((x: { nummer: string }) => x.nummer), plSicht.can.write], [['2026-001'], false], 'PL sieht nur ihr Projekt (das Portfolio selbst nicht)');
    assert.equal((await call('pl', 'GET', `/v1/finanzen?portfolio=${pf}`)).statusCode, 404);
    assert.deepEqual((await call('pl', 'GET', url)).json(), { items: [], can: { write: true } });
    assert.equal((await call('pl', 'PUT', `${url}/${per}`, { text: 'x' })).statusCode, 428);
    assert.equal((await call('pl', 'PUT', `/v1/projekte/${p.a}/abweichungsbegruendungen/2099-01`, { text: 'x' }, { 'if-match': 'W/"0"' })).statusCode, 422);
    assert.equal((await call('gl', 'PUT', `${url}/${per}`, { text: 'x' }, { 'if-match': 'W/"0"' })).statusCode, 403, 'GL sieht Beträge, begründet nicht (PL, UE mit projekt:write, FI)');
    const b = await call('pl', 'PUT', `${url}/${per}`, { text: ' Lieferant teurer als offeriert ' }, { 'if-match': 'W/"0"' });
    assert.equal(b.statusCode, 200, b.body);
    assert.deepEqual([b.json().text, b.json().version, b.headers.etag], ['Lieferant teurer als offeriert', 1, 'W/"1"']);
    assert.equal((await call('pl', 'PUT', `${url}/${per}`, { text: 'y' }, { 'if-match': 'W/"0"' })).statusCode, 412);
    const fiB = await call('fi', 'PUT', `${url}/${per}`, { text: 'Lieferant teurer; Änderungsantrag folgt' }, { 'if-match': 'W/"1"' });
    assert.equal(fiB.json().version, 2, fiB.body);
    assert.deepEqual((await aufgaben('abweichung.klaeren')).map(x => x.stand), ['erledigt']);
    assert.equal((await call('fi', 'GET', `/v1/finanzen?portfolio=${pf}`)).json().projekte[0].begruendung.text, 'Lieferant teurer; Änderungsantrag folgt');
    const audit = await full(api.t.runtime, T, async tx => (await tx.query<{ action: string }>("SELECT action FROM ppm.audit_log WHERE action LIKE 'abweichung.%' OR action = 'kostentraeger.assigned' ORDER BY seq")).rows.map(r => r.action));
    assert.deepEqual(audit, ['kostentraeger.assigned', 'kostentraeger.assigned', 'abweichung.justified', 'abweichung.justification_changed']);
  });

  test('Jahresbedarf mit Korrektur durch FI (A-17), Übergabe an den Budgetprozess (Schritte 5–6)', async () => {
    // Vertrauliches Projekt: GL und FI sehen es nicht; es zählt als Summe ohne Namen (OPEX 2027 ganz im Jahr)
    await full(api.t.runtime, T, async tx => {
      p.c = (await tx.query<{ id: string }>("INSERT INTO ppm.projekt (tenant_id, nummer, name, portfolio_id, phase, vertraulich) VALUES ($1, '2026-003', 'Reorganisation', $2, 'P1', true) RETURNING id", [T, pf])).rows[0]!.id;
      await tx.query("INSERT INTO ppm.kosten (tenant_id, projekt_id, phase, art, text, budget_baseline, prognose) VALUES ($1, $2, 'P2', 'opex', 'Umzug', 40000, 50000)", [T, p.c]);
      await tx.query(`INSERT INTO ppm.meilenstein (tenant_id, projekt_id, phase, art, text, termin_baseline) VALUES
        ($1, $2, 'P1', 'meilenstein', 'Plan', '2026-12-31'), ($1, $2, 'P2', 'meilenstein', 'Umzug', '2027-12-31')`, [T, p.c]);
    });
    const g = await call('gl', 'GET', '/v1/budgetuebergaben/2027');
    assert.equal(g.statusCode, 200, g.body);
    const j = g.json();
    assert.deepEqual([j.stand, j.version, j.can.write, g.headers.etag], ['neu', 0, false, 'W/"0"']);
    assert.deepEqual(j.positionen.map((x: { nummer: string; berechnet: unknown; ohneTermine: string[] }) => [x.nummer, x.berechnet, x.ohneTermine]),
      [['2026-001', { capex: 0, opex: 24794.52 }, []], ['2026-002', { capex: 0, opex: 0 }, ['P1']]]);
    assert.deepEqual([j.vertraulich, j.summe], [{ anzahl: 1, capex: 0, opex: 50000 }, { capex: 0, opex: 74794.52 }]);
    assert.ok(!g.body.includes('Reorganisation') && !g.body.includes(p.c), 'ohne Namen und Kennung');
    assert.equal((await call('gl', 'PUT', '/v1/budgetuebergaben/2027', { korrekturen: [] })).statusCode, 403, 'übergeben FI');
    assert.equal((await call('fi', 'PUT', '/v1/budgetuebergaben/2027', { korrekturen: [{ projektId: p.a, capex: 1, opex: null }, { projektId: p.a, capex: 2, opex: null }] })).statusCode, 422);
    const k = await call('fi', 'PUT', '/v1/budgetuebergaben/2027', { korrekturen: [{ projektId: p.b, capex: 0, opex: 8000, bemerkung: 'Termine folgen' }, { projektId: p.a, capex: null, opex: null }] });
    assert.equal(k.statusCode, 200, k.body);
    assert.deepEqual([k.json().stand, k.json().version, k.json().summe], ['entwurf', 1, { capex: 0, opex: 82794.52 }]);
    // 0 bleibt 0, null bleibt null, > 0 bleibt (Nullable ohne Typumwandlung zwischen null und 0)
    assert.deepEqual(k.json().positionen[1].korrektur, { capex: 0, opex: 8000, bemerkung: 'Termine folgen' });
    assert.equal((await call('fi', 'PUT', '/v1/budgetuebergaben/2027', { korrekturen: [] })).statusCode, 428, 'danach mit If-Match');
    assert.deepEqual((await aufgaben('budget.uebergeben')).map(x => [x.bezug_id, x.stand, x.link]), [['2027', 'offen', '/portfolio/finanzen/budgetprozess?jahr=2027']]);

    assert.equal((await call('fi', 'POST', '/v1/budgetuebergaben/2027/export', undefined, { 'if-match': 'W/"0"' })).statusCode, 412);
    const x = await call('fi', 'POST', '/v1/budgetuebergaben/2027/export', undefined, { 'if-match': 'W/"1"' });
    assert.equal(x.statusCode, 200, x.body);
    assert.deepEqual([x.json().stand, x.json().summe, x.json().can.write], ['uebergeben', { capex: 0, opex: 82794.52 }, false]);
    assert.ok(x.json().uebergebenAt);
    assert.equal((await call('fi', 'PUT', '/v1/budgetuebergaben/2027', { korrekturen: [] }, { 'if-match': 'W/"2"' })).statusCode, 409);
    assert.deepEqual((await aufgaben('budget.uebergeben')).map(a => a.stand), ['erledigt']);
    // Prognose ändert sich danach: die Übergabe bleibt wie exportiert
    await full(api.t.runtime, T, tx => tx.query("UPDATE ppm.kosten SET prognose = 90000 WHERE text = 'Betrieb'"));
    assert.deepEqual((await call('ue', 'GET', '/v1/budgetuebergaben/2027')).json().summe, { capex: 0, opex: 82794.52 });

    // Ausgehende Schnittstelle «Budgetprozess · Jahresbedarf» liefert den übergebenen Inhalt
    const s = await call('adm', 'POST', '/v1/schnittstellen', { umsystem: 'budget', daten: 'jahresbedarf', rhythmus: 'manuell', adresse: `${basis}/budget` });
    const l = await call('adm', 'POST', `/v1/schnittstellen/${s.json().schnittstelle.id}/starten`);
    assert.deepEqual([l.json().stand, l.json().umfang], ['erfolgreich', 2]);
    const geliefert = empfangen.at(-1) as { jahr: number; summe: unknown; positionen: unknown[] };
    assert.deepEqual([geliefert.jahr, geliefert.summe, geliefert.positionen.length], [2027, { capex: 0, opex: 82794.52 }, 2]);
  });

  test('Aufgabe «Abweichung klären»: keine für vertrauliche Projekte; entfällt, wenn das Projekt nicht mehr aktiv ist', async () => {
    const pruefen = () => full(api.t.runtime, T, async tx => abweichungenPruefen(tx, await store.projekte(tx, { alle: true })));
    await full(api.t.runtime, T, tx => tx.query("UPDATE ppm.kosten SET prognose = 20000 WHERE text = 'Beratung'"));
    await pruefen();
    const stand = async () => (await aufgaben('abweichung.klaeren')).map(x => [x.bezug_id, x.stand]);
    assert.deepEqual(await stand(), [[p.a, 'erledigt'], [p.b, 'offen']], 'das vertrauliche Projekt (wesentlich) ohne Aufgabe');
    await full(api.t.runtime, T, tx => tx.query("UPDATE ppm.projekt SET lebenszyklus = 'abgeschlossen' WHERE id = $1", [p.b]));
    await pruefen();
    assert.deepEqual(await stand(), [[p.a, 'erledigt'], [p.b, 'entfallen']]);
  });

  test('Rechte: Beträge nur mit finanzen:read (A-33); Gremium am Portfolio liest; Leser nicht', async () => {
    assert.equal((await call('leser', 'GET', `/v1/finanzen?portfolio=${pf}`)).statusCode, 403);
    assert.equal((await call('leser', 'GET', '/v1/budgetuebergaben/2027')).statusCode, 403);
    const g = await call('gremium', 'GET', `/v1/finanzen?portfolio=${pf}`);
    assert.deepEqual([g.statusCode, g.json().projekte.map((x: { nummer: string }) => x.nummer), g.json().can.write], [200, ['2026-001', '2026-003'], false], 'aktive, vertrauliche mit projekt:vertraulich');
    assert.equal((await call('gremium', 'GET', '/v1/finanzen')).json().projekte.length, 2, 'ohne Portfolio: alle aktiven Projekte mit sichtbaren Beträgen');
    assert.equal((await call('gremium', 'GET', '/v1/budgetuebergaben/2027')).statusCode, 403);
    assert.equal((await call('fi', 'GET', '/v1/finanzen?portfolio=00000000-0000-4000-8000-000000000099')).statusCode, 404);
  });

  test('Toleranz aus dem Projektvertrag (A-10): die Baseline übersteuert den Standard; die PL sieht sie ohne phasenmodell:read', async () => {
    const tol = async (who: string) => (await call(who, 'GET', '/v1/finanzen')).json().projekte
      .filter((x: { id: string }) => x.id === p.a).map((x: { toleranzProzent: number | null; abweichung: { wesentlich: boolean } }) => [x.toleranzProzent, x.abweichung.wesentlich]);
    assert.deepEqual(await tol('pl'), [[10, true]], 'Standard des Phasenmodells, auch ohne phasenmodell:read');
    // Prognose inzwischen 40 % über Budget; Baseline mit Toleranz «Kosten» 50 % in Kap. 7 (wie nach dem Gate-Entscheid)
    await full(api.t.runtime, T, async tx => {
      const v = (await tx.query<{ id: string }>(
        "INSERT INTO ppm.vertrag_version (tenant_id, projekt_id, nummer, anlass, zielphase, begruendung, stand, baseline, baseline_at) VALUES ($1, $2, '1.0', 'initial', 'P1', '', 'abgenommen', true, now()) RETURNING id",
        [T, p.a])).rows[0]!.id;
      await tx.query("INSERT INTO ppm.vertrag_kapitel (tenant_id, projekt_id, version_id, kapitel, inhalt) VALUES ($1, $2, $3, 7, $4)",
        [T, p.a, v, JSON.stringify({ toleranzen: [{ dimension: 'kosten', wert: 50, einheit: 'prozent' }] })]);
    });
    assert.deepEqual(await tol('fi'), [[50, false]]);
    assert.deepEqual(await tol('pl'), [[50, false]]);
  });
});
