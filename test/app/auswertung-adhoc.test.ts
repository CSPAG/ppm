/**
 * Ad-hoc-Auswertungen (BC PC.04.03; UC-014 A2.1; AP-E7-6): Filter, Kennzahlen aus den vorhandenen Modulen, Gruppierung
 * mit Summe und Einzelwerten, Export als CSV; Recht `auswertung:write` (UE, FI), Beträge nur mit `finanzen:read`,
 * vertrauliche Projekte nur mit `projekt:vertraulich` (Lesesicht).
 */
import assert from 'node:assert/strict';
import { dbTests, postgresSkip } from '@vollholz/iam-testkit';
import { full } from './harness.ts';
import { grant, login, testApi, type TestApi } from './api.ts';
import { csvFeld } from '../../src/modules/auswertung/adhoc.ts';

const { after, before, describe, test } = dbTests(await postgresSkip());

const PERIODE = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' }).slice(0, 7);
const VORPERIODE = (() => { const [j, m] = PERIODE.split('-').map(Number) as [number, number]; return m === 1 ? `${j - 1}-12` : `${j}-${String(m - 1).padStart(2, '0')}`; })();

interface Gruppe { schluessel: string; label: string; werte: Record<string, number> }
interface Antwort {
  periode: string; gruppierung: string; kennzahlen: { schluessel: string; einheit: string }[]; gruppen: Gruppe[]; summe: Record<string, number>;
  einzelwerte: { nummer: string; status: string | null; gruppe: string; werte: Record<string, number> }[];
  optionen: { portfolios: { schluessel: string }[]; handlungsfelder: { id: string; label: string }[]; finanzen: boolean };
}

describe('Ad-hoc-Auswertungen', () => {
  let api: TestApi;
  let T = '';
  let ue: Record<string, string>, fi: Record<string, string>, gremium: Record<string, string>, gl: Record<string, string>;
  const p: Record<string, string> = {};
  let pfA = '', hf = '';

  const get = (url: string, h: Record<string, string>) => api.app.inject({ method: 'GET', url, headers: h });
  const ok = async (url: string, h: Record<string, string> = ue) => {
    const r = await get(url, h);
    assert.equal(r.statusCode, 200, `${url}: ${r.body}`);
    return r.json() as Antwort;
  };

  before(async () => {
    api = await testApi();
    const u = await login(api, 'demo', 'u-ue', 'ue');
    T = u.tenantId;
    ue = { authorization: u.authorization };
    fi = { authorization: (await login(api, 'demo', 'u-fi', 'fi')).authorization };
    gl = { authorization: (await login(api, 'demo', 'u-gl', 'gl')).authorization };
    await full(api.t.runtime, T, async tx => {
      hf = (await tx.query<{ id: string }>("INSERT INTO ppm.handlungsfeld (tenant_id, label) VALUES ($1, 'Digitalisierung') RETURNING id", [T])).rows[0]!.id;
      pfA = (await tx.query<{ id: string }>("INSERT INTO ppm.portfolio (tenant_id, kategorie, schluessel, name, pflichten) VALUES ($1, 'A', 'transformation', 'Transformation', true) RETURNING id", [T])).rows[0]!.id;
      const pfB = (await tx.query<{ id: string }>("INSERT INTO ppm.portfolio (tenant_id, kategorie, schluessel, name, pflichten) VALUES ($1, 'B', 'betrieb', 'Betrieb', true) RETURNING id", [T])).rows[0]!.id;
      for (const [nr, pf, phase, lz, vertraulich, name] of [
        ['2026-001', pfA, 'P1', 'aktiv', false, 'Labor'], ['2026-002', pfA, 'P2', 'aktiv', false, '=Formel'],
        ['2026-003', pfB, 'P2', 'aktiv', false, 'Netz; Teil "A"'], ['2026-004', pfB, 'P3', 'sistiert', false, 'Pause'],
        ['2026-005', pfA, 'P2', 'aktiv', true, 'Geheim'],
      ] as const) {
        p[nr] = (await tx.query<{ id: string }>('INSERT INTO ppm.projekt (tenant_id, nummer, name, portfolio_id, phase, lebenszyklus, vertraulich, handlungsfeld_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
          [T, nr, name, pf, phase, lz, vertraulich, nr === '2026-001' ? hf : null])).rows[0]!.id;
      }
      // Status: 2026-001 kritisch (Vorperiode im Plan, laufende kritisch mit Eskalation), 2026-002 im Plan, 2026-003 nur Entwurf
      const bericht = async (nr: string, periode: string, stand: string, status: string, noetig = false) => (await tx.query<{ id: string }>(
        `INSERT INTO ppm.statusbericht (tenant_id, projekt_id, periode, stand, status, trend, phase, begruendung, massnahme, entscheid_noetig, eingereicht_at)
         VALUES ($1, $2, $3, $4, $5, 'gleichbleibend', 'P1', 'Grund', 'Massnahme', $6, CASE WHEN $4 = 'entwurf' THEN NULL ELSE now() END) RETURNING id`, [T, p[nr], periode, stand, status, noetig])).rows[0]!.id;
      await tx.query("INSERT INTO ppm.periode (tenant_id, periode) VALUES ($1, $2), ($1, $3)", [T, VORPERIODE, PERIODE]);
      await bericht('2026-001', VORPERIODE, 'geprueft', 'im_plan');
      const b1 = await bericht('2026-001', PERIODE, 'eingereicht', 'kritisch', true);
      await bericht('2026-002', VORPERIODE, 'geprueft', 'im_plan');
      await bericht('2026-003', PERIODE, 'entwurf', 'kritisch');
      await bericht('2026-005', PERIODE, 'eingereicht', 'kritisch');
      await tx.query("INSERT INTO ppm.eskalation (tenant_id, projekt_id, statusbericht_id, grund) VALUES ($1, $2, $3, 'Lieferverzug')", [T, p['2026-001'], b1]);
      for (const [nr, erreicht] of [['2026-001', null], ['2026-001', '2026-01-10'], ['2026-002', null]] as const) {
        await tx.query("INSERT INTO ppm.meilenstein (tenant_id, projekt_id, phase, art, text, termin_baseline, erreicht_am) VALUES ($1, $2, 'P1', 'meilenstein', 'M', '2027-01-31', $3)", [T, p[nr], erreicht]);
      }
      await tx.query("INSERT INTO ppm.risiko (tenant_id, projekt_id, text, wahrscheinlichkeit, auswirkung) VALUES ($1, $2, 'R1', 'hoch', 'hoch'), ($1, $2, 'R2', 'tief', 'mittel')", [T, p['2026-002']]);
      for (const [nr, budget, prognose, ist] of [['2026-001', 100000.5, 120000, 30000], ['2026-001', 50000, 50000, null], ['2026-003', 20000, 25000, 5000.25], ['2026-005', 999999, 999999, 999999]] as const) {
        await tx.query("INSERT INTO ppm.kosten (tenant_id, projekt_id, phase, art, text, budget_baseline, prognose, ist) VALUES ($1, $2, 'P1', 'capex', 'K', $3, $4, $5)", [T, p[nr], budget, prognose, ist]);
      }
    });
    const g = await login(api, 'demo', 'u-gremium', null);
    await grant(api, T, `user:${g.principalId}`, 'gremium', { type: 'portfolio', id: pfA });
    gremium = { authorization: g.authorization };
  });
  after(async () => { await api?.close(); });

  test('Gruppierung nach Portfolio mit allen Kennzahlen, Summe und Einzelwerten (UC-014 A2.1)', async () => {
    const a = await ok('/v1/auswertungen?kennzahlen=projekte,kritisch,eskalationen,meilensteine_offen,risiken,budget,prognose,ist');
    assert.deepEqual([a.periode, a.gruppierung], [PERIODE, 'portfolio']);
    assert.deepEqual(a.kennzahlen.map(k => `${k.schluessel}:${k.einheit}`), ['projekte:anzahl', 'kritisch:anzahl', 'eskalationen:anzahl', 'meilensteine_offen:anzahl', 'risiken:anzahl', 'budget:chf', 'prognose:chf', 'ist:chf']);
    // aktiv (Standard): 2026-004 sistiert fehlt; UE sieht das vertrauliche 2026-005
    assert.deepEqual(a.gruppen.map(g => [g.label, g.werte]), [
      ['Betrieb', { projekte: 1, kritisch: 0, eskalationen: 0, meilensteine_offen: 0, risiken: 0, budget: 20000, prognose: 25000, ist: 5000.25 }],
      ['Transformation', { projekte: 3, kritisch: 2, eskalationen: 1, meilensteine_offen: 2, risiken: 2, budget: 1149999.5, prognose: 1169999, ist: 1029999 }],
    ]);
    assert.deepEqual(a.summe, { projekte: 4, kritisch: 2, eskalationen: 1, meilensteine_offen: 2, risiken: 2, budget: 1169999.5, prognose: 1194999, ist: 1034999.25 });
    assert.deepEqual(a.einzelwerte.map(e => [e.nummer, e.status, e.werte.kritisch]), [['2026-001', 'kritisch', 1], ['2026-002', 'im_plan', 0], ['2026-003', null, 0], ['2026-005', 'kritisch', 1]]);
    assert.ok(a.einzelwerte.every(e => a.gruppen.some(g => g.schluessel === e.gruppe)), 'jede Zahl führt zu ihren Einzelwerten');
    assert.equal(a.optionen.finanzen, true);
    assert.deepEqual(a.optionen.handlungsfelder.map(h => h.label), ['Digitalisierung']);
  });

  test('Filter: Portfolio, Phase, Lebenszyklus, Status, Handlungsfeld, Stichperiode; Gruppierungen in ihrer Ordnung', async () => {
    let a = await ok('/v1/auswertungen?portfolio=transformation&phase=P2&gruppierung=keine');
    assert.deepEqual([a.gruppen.map(g => g.label), a.summe], [['Gesamt'], { projekte: 2, kritisch: 1 }]);
    a = await ok('/v1/auswertungen?lebenszyklus=aktiv,sistiert&gruppierung=lebenszyklus');
    assert.deepEqual(a.gruppen.map(g => [g.label, g.werte.projekte]), [['Aktiv', 4], ['Sistiert', 1]]);
    a = await ok('/v1/auswertungen?status=ohne&gruppierung=status');
    assert.deepEqual(a.einzelwerte.map(e => e.nummer), ['2026-003'], 'ein Entwurf zählt nicht als Bericht');
    a = await ok('/v1/auswertungen?gruppierung=status');
    assert.deepEqual(a.gruppen.map(g => g.schluessel), ['kritisch', 'im_plan', 'ohne']);
    a = await ok('/v1/auswertungen?gruppierung=phase');
    assert.deepEqual(a.gruppen.map(g => [g.schluessel, g.werte.projekte]), [['P1', 1], ['P2', 3]]);
    a = await ok(`/v1/auswertungen?gruppierung=handlungsfeld&handlungsfeld=${hf}`);
    assert.deepEqual(a.gruppen.map(g => g.label), ['Digitalisierung']);
    a = await ok('/v1/auswertungen?gruppierung=handlungsfeld');
    assert.deepEqual(a.gruppen.map(g => [g.label, g.werte.projekte]), [['Digitalisierung', 1], ['Ohne Handlungsfeld', 3]], '«ohne» zuletzt');
    a = await ok(`/v1/auswertungen?periode=${VORPERIODE}&gruppierung=status`);
    assert.deepEqual(a.einzelwerte.map(e => [e.nummer, e.status]), [['2026-001', 'im_plan'], ['2026-002', 'im_plan'], ['2026-003', null], ['2026-005', null]], 'Status bis zur Stichperiode');
    assert.equal((await get('/v1/auswertungen?portfolio=unbekannt', ue)).statusCode, 422);
    assert.equal((await get('/v1/auswertungen?kennzahlen=gewinn', ue)).statusCode, 422);
    assert.equal((await get('/v1/auswertungen?ebene=einzelwerte', ue)).statusCode, 422, '`ebene` nur für den Export');
  });

  test('Rechte: UE und FI erstellen; Gremium und GL nicht; vertrauliche Projekte nur mit Recht (Lesesicht)', async () => {
    const f = await ok('/v1/auswertungen?kennzahlen=projekte,budget', fi);
    assert.deepEqual(f.einzelwerte.map(e => e.nummer), ['2026-001', '2026-002', '2026-003'], 'FI ohne projekt:vertraulich sieht 2026-005 nicht');
    assert.equal(f.summe.budget, 170000.5);
    for (const h of [gremium, gl]) assert.equal((await get('/v1/auswertungen', h)).statusCode, 403);
  });

  test('Export als CSV: Gruppen mit Summe, Einzelwerte, ohne Formeln (Seitentyp Bericht: Export)', async () => {
    const r = await get('/v1/auswertungen?format=csv&kennzahlen=projekte,budget', ue);
    assert.equal(r.statusCode, 200, r.body);
    assert.match(String(r.headers['content-type']), /^text\/csv; charset=utf-8/);
    assert.equal(r.headers['content-disposition'], `attachment; filename="auswertung-${PERIODE}.csv"`);
    assert.equal(r.body, '﻿Portfolio;Projekte;Budget (CHF)\r\nBetrieb;1;20000\r\nTransformation;3;1149999.5\r\nSumme;4;1169999.5\r\n');
    const e = await get('/v1/auswertungen?format=csv&ebene=einzelwerte&portfolio=transformation,betrieb', ue);
    const zeilen = e.body.replace('﻿', '').trim().split('\r\n');
    assert.equal(zeilen[0], 'Nummer;Projekt;Portfolio;Phase;Lebenszyklus;Status;Handlungsfeld;Projekte;Status kritisch');
    assert.equal(zeilen[2], "2026-002;'=Formel;Transformation;P2;Aktiv;Im Plan;;1;0", 'Text mit = am Anfang wird keine Formel');
    assert.equal(zeilen[3], '2026-003;"Netz; Teil ""A""";Betrieb;P2;Aktiv;;;1;0');
  });

  test('CSV-Felder', () => {
    assert.deepEqual([csvFeld(null), csvFeld(1.5), csvFeld('a;b'), csvFeld('+41'), csvFeld('Zeile\nzwei'), csvFeld('@x;y')],
      ['', '1.5', '"a;b"', "'+41", '"Zeile\nzwei"', `"'@x;y"`]);
  });
});
