/**
 * Übernahme aus dem Excel-Dashboard (AP-E0-7; K16, A-14): Prüflauf speichert nichts und meldet Fehler je Zeile;
 * Speichern nur fehlerfrei, dann Projekt mit Phase, Handlungsfeld und Projektleitung, Bericht der Übernahmeperiode mit
 * Status und Trend als Vorperiode des ersten Berichts, nächster Meilenstein im Plan. Synthetische Datei
 * `scripts/uebernahme/beispiel.csv`.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dbTests, postgresSkip } from '@vollholz/iam-testkit';
import { login, testApi, type TestApi } from './api.ts';
import { full } from './harness.ts';

const { after, before, describe, test } = dbTests(await postgresSkip());
const BEISPIEL = readFileSync(new URL('../../scripts/uebernahme/beispiel.csv', import.meta.url), 'utf8');
const KOPF = BEISPIEL.split('\n')[0]!;
const PERIODE = '2026-09';

describe('Übernahme aus dem Excel-Dashboard', () => {
  let api: TestApi;
  let T: string;
  let adm: Record<string, string>, ue: Record<string, string>;
  const pl: Record<string, string> = {};

  const post = (h: Record<string, string>, body: Record<string, unknown>) =>
    api.app.inject({ method: 'POST', url: '/v1/projekte/uebernahme', headers: { ...h, 'content-type': 'application/json' }, payload: JSON.stringify({ portfolio: 'transformation', periode: PERIODE, ...body }) });
  const sql = <R extends Record<string, unknown>>(q: string, args: unknown[] = []) => full(api.t.runtime, T, async tx => (await tx.query<R>(q, args)).rows);

  before(async () => {
    api = await testApi();
    const a = await login(api, 'insel', 'u-adm', 'org-admin');
    T = a.tenantId;
    adm = { authorization: a.authorization };
    ue = { authorization: (await login(api, 'insel', 'u-ue', 'alle-fuehren')).authorization };
    await full(api.t.runtime, T, async tx => {
      await tx.query("INSERT INTO ppm.portfolio (tenant_id, kategorie, schluessel, name, pflichten) VALUES ($1, 'A', 'transformation', 'Transformation', true)", [T]);
      await tx.query("INSERT INTO ppm.handlungsfeld (tenant_id, label) VALUES ($1, 'Beispielfeld Nord')", [T]);
      for (const k of ['alpha', 'beta']) {
        pl[k] = (await tx.query<{ id: string }>(
          "INSERT INTO ppm.principal (tenant_id, kind, subject, display_name, email) VALUES ($1, 'user', $2, $3, $4) RETURNING id",
          [T, `u-${k}`, `PL ${k}`, `pl.${k}@beispiel.test`])).rows[0]!.id;
      }
    });
  });
  after(async () => { await api?.close(); });

  test('Rechte: wer alle Portfolios nur liest, darf nicht übernehmen (statusbericht:write fehlt)', async () => {
    const lesend = { authorization: (await login(api, 'insel', 'u-lesend', 'alle-lesen')).authorization };
    assert.equal((await post(lesend, { csv: BEISPIEL, speichern: false })).statusCode, 403);
  });

  test('Prüflauf meldet Fehler je Zeile und speichert nichts', async () => {
    const csv = [KOPF,
      '11;Unbekanntes Feld;;Fehler Eins;;niemand@beispiel.test;P9;Q1 2027;;;im Plan;→;;',
      '12;;;Fehler Zwei;;;P1;;;;kritisch;↘;;',
      '13;;;;;;P1;;;;wackelig;?;;',
      '14;;;Gut;;PL alpha;P3;1.2.2027;;;im Plan;aufwärts;;',
    ].join('\n');
    const r = await post(adm, { csv, speichern: false });
    assert.equal(r.statusCode, 200, r.body);
    const e = r.json();
    assert.deepEqual([e.gespeichert, e.anzahl], [false, { zeilen: 4, fehlerhaft: 3 }]);
    const fehler = Object.fromEntries(e.zeilen.map((z: { zeile: number; fehler: { spalte: string | null; text: string }[] }) => [z.zeile, z.fehler.map(f => f.spalte)]));
    assert.deepEqual(fehler[2], ['Projektphase', 'Abschluss per']);
    assert.deepEqual(fehler[3], ['Begründung']);
    assert.deepEqual(fehler[4], ['Projektname', 'Status', 'Trend']);
    assert.deepEqual(fehler[5], []);
    assert.match(e.zeilen[3].nummer, /^\d{4}-\d{3}$/);
    // Fehler, die erst beim Ausführen auffallen: Handlungsfeld und Projektleitung unbekannt
    const r2 = await post(adm, { csv: [KOPF, '15;Unbekanntes Feld;;Drei;;niemand@beispiel.test;P1;;;;;;;'].join('\n'), speichern: false });
    assert.deepEqual(r2.json().zeilen[0].fehler.map((f: { spalte: string }) => f.spalte), ['Strategisches Handlungsfeld', 'Projektleitung']);
    assert.deepEqual(await sql('SELECT nummer FROM ppm.projekt'), []);
    // Speichern mit Fehlern: 422 mit demselben Ergebnis, nichts gespeichert
    const s = await post(adm, { csv, speichern: true });
    assert.equal(s.statusCode, 422, s.body);
    assert.equal(s.json().anzahl.fehlerhaft, 3);
    assert.deepEqual(await sql('SELECT nummer FROM ppm.projekt'), []);
  });

  test('Kopfzeile ohne Pflichtspalten', async () => {
    const r = (await post(adm, { csv: 'Index;Status\n01;im Plan', speichern: false })).json();
    assert.deepEqual(r.kopf.map((f: { spalte: string }) => f.spalte), ['Projektname', 'Projektphase']);
    assert.deepEqual(r.zeilen, []);
  });

  test('Speichern: Projekte, Projektleitung, Bericht der Vorperiode, Meilenstein; einmalig (A-14)', async () => {
    const pruef = (await post(adm, { csv: BEISPIEL, speichern: false })).json();
    assert.deepEqual(pruef.zeilen.map((z: { fehler: unknown[] }) => z.fehler), [[], [], []]);
    const r = await post(adm, { csv: BEISPIEL, speichern: true });
    assert.equal(r.statusCode, 200, r.body);
    const e = r.json();
    assert.equal(e.gespeichert, true);
    // Die im Prüflauf gemeldeten Nummern sind die gespeicherten
    assert.deepEqual(e.zeilen.map((z: { nummer: string }) => z.nummer), pruef.zeilen.map((z: { nummer: string }) => z.nummer));

    const p = await sql<{ id: string; nummer: string; name: string; phase: string; hf: string | null; index: string; thema: string }>(
      `SELECT p.id, p.nummer, p.name, p.phase, h.label AS hf, p.herkunft->>'index' AS index, p.herkunft->>'thema' AS thema
         FROM ppm.projekt p LEFT JOIN ppm.handlungsfeld h ON h.id = p.handlungsfeld_id ORDER BY p.nummer`);
    assert.deepEqual(p.map(x => [x.name, x.phase, x.hf, x.index]), [
      ['Beispielprojekt Alpha', 'P1', 'Beispielfeld Nord', '01'], ['Beispielprojekt Beta', 'P2', 'Beispielfeld Nord', '02'], ['Beispielprojekt Gamma', 'P0', null, '03'],
    ]);
    assert.equal(p[1]!.thema, 'Erfundenes Thema B; mit Semikolon');

    // Projektleitung als Rolle am Projekt
    const t = await sql<{ s: string; r: string }>("SELECT subject AS s, relation AS r FROM ppm.authz_tuple WHERE object_type = 'projekt' AND object_id = $1", [p[0]!.id]);
    assert.deepEqual(t, [{ s: `user:${pl.alpha}`, r: 'projekt-fuehren' }]);

    // Bericht der Übernahmeperiode, geprüft; ohne Status keiner
    const b = await sql<{ projekt_id: string; stand: string; status: string; trend: string; abschluss_per: string; naechster_meilenstein: string; begruendung: string }>(
      "SELECT projekt_id, stand, status, trend, to_char(abschluss_per, 'YYYY-MM-DD') AS abschluss_per, naechster_meilenstein, begruendung FROM ppm.statusbericht WHERE periode = $1", [PERIODE]);
    const nach = Object.fromEntries(b.map(x => [x.projekt_id, x]));
    assert.deepEqual([nach[p[0]!.id]?.stand, nach[p[0]!.id]?.status, nach[p[0]!.id]?.trend, nach[p[0]!.id]?.abschluss_per, nach[p[0]!.id]?.naechster_meilenstein],
      ['geprueft', 'im_plan', 'gleichbleibend', '2026-12-31', 'P1 Update: Konzept abnehmen']);
    assert.deepEqual([nach[p[1]!.id]?.status, nach[p[1]!.id]?.trend, nach[p[1]!.id]?.begruendung], ['kritisch', 'aufwaerts', 'Lieferverzug beim Partner (erfunden)']);
    assert.equal(nach[p[2]!.id], undefined);

    // Vorperiode des ersten Berichts (UC-004 Schritt 1): Status der Übernahme, Vorbelegung «Abschluss per»
    const erster = await api.app.inject({ method: 'GET', url: `/v1/projekte/${p[0]!.id}/berichte/2026-10`, headers: adm });
    assert.equal(erster.statusCode, 200, erster.body);
    assert.deepEqual([erster.json().vorperiode?.periode, erster.json().vorperiode?.status, erster.json().vorperiode?.trend], [PERIODE, 'im_plan', 'gleichbleibend']);

    // Nächster Meilenstein mit Termin im Plan der aktuellen Phase
    const m = await sql<{ phase: string; text: string; t: string }>("SELECT phase, text, to_char(termin_aktuell, 'YYYY-MM-DD') AS t FROM ppm.meilenstein WHERE projekt_id = $1", [p[0]!.id]);
    assert.deepEqual(m, [{ phase: 'P1', text: 'P1 Update: Konzept abnehmen', t: '2026-11-30' }]);

    // Einmalig: dieselben Zeilen ein zweites Mal sind Fehler
    const nochmals = (await post(adm, { csv: BEISPIEL, speichern: false })).json();
    assert.deepEqual(nochmals.zeilen.map((z: { fehler: { spalte: string }[] }) => z.fehler.map(f => f.spalte)), [['Index'], ['Index'], ['Index']]);
  });
});
