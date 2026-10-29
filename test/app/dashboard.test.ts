/**
 * Dashboard der Periode (BC PC.04.01, UC-014 Schritt 1; AP-E1-3): offene Periode live («gemeldet», «ausstehend», Badge
 * «Eskalation»), abgeschlossene aus dem Stand bei Abschluss («nicht gemeldet» mit Werten der Vorperiode, A-11), Funnel
 * nach Phase, Sichtbarkeit je Rolle (UE alle, Gremium und Direktion nur ihr Portfolio, Projektrollen nicht, A-33/UX-OF-12),
 * 1000 Zeilen (Q-L5).
 */
import assert from 'node:assert/strict';
import { dbTests, postgresSkip } from '@vollholz/iam-testkit';
import { full } from './harness.ts';
import { grant, login, testApi, type TestApi } from './api.ts';

const { after, before, describe, test } = dbTests(await postgresSkip());

const heute = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' });
const PERIODE = heute.slice(0, 7);
const VORPERIODE = (() => { const [j, m] = PERIODE.split('-').map(Number) as [number, number]; return m === 1 ? `${j - 1}-12` : `${j}-${String(m - 1).padStart(2, '0')}`; })();

interface Zeile { nummer: string; status: string | null; statusVorperiode: string | null; meldung: string; merkmale: string[]; phase: string; portfolio: string; projektleitung: string | null; naechsterMeilenstein: { termin: string | null; text: string } | null; werteAus: string | null }
interface Antwort { periode: string; periodeStand: string; portfolios: { schluessel: string }[]; items: Zeile[]; funnel: { phase: string; anzahl: number; kritisch: number; imPlan: number; nichtGemeldet: number }[] }

describe('Dashboard der Periode', () => {
  let api: TestApi;
  let T = '';
  let ue: Record<string, string>, gremium: Record<string, string>, direktion: Record<string, string>, pl: Record<string, string>;
  const p: Record<string, string> = {};
  let pfA = '', pfC = '';

  before(async () => {
    api = await testApi();
    const u = await login(api, 'demo', 'u-ue', 'alle-fuehren');
    T = u.tenantId;
    ue = { authorization: u.authorization };
    const l = await login(api, 'demo', 'u-pl', null);
    await full(api.t.runtime, T, async tx => {
      pfA = (await tx.query<{ id: string }>("INSERT INTO ppm.portfolio (tenant_id, kategorie, schluessel, name, pflichten) VALUES ($1, 'A', 'transformation', 'Transformation', true) RETURNING id", [T])).rows[0]!.id;
      pfC = (await tx.query<{ id: string }>("INSERT INTO ppm.portfolio (tenant_id, kategorie, schluessel, name, pflichten) VALUES ($1, 'C', 'dir-med', 'Direktion Medizin', false) RETURNING id", [T])).rows[0]!.id;
      for (const [nr, pf, phase] of [['2026-001', pfA, 'P1'], ['2026-002', pfA, 'P2'], ['2026-003', pfA, 'P4'], ['2026-004', pfC, 'P1']] as const) {
        p[nr] = (await tx.query<{ id: string }>('INSERT INTO ppm.projekt (tenant_id, nummer, name, portfolio_id, phase) VALUES ($1, $2, $3, $4, $5) RETURNING id', [T, nr, `Projekt ${nr}`, pf, phase])).rows[0]!.id;
      }
      await tx.query("INSERT INTO ppm.projekt_person (tenant_id, projekt_id, person_id, funktion) VALUES ($1, $2, $3, 'pl')", [T, p['2026-001'], l.principalId]);
      await tx.query("INSERT INTO ppm.periode (tenant_id, periode) VALUES ($1, $2), ($1, $3)", [T, VORPERIODE, PERIODE]);
      // Vorperiode: 2026-002 kritisch, 2026-001 im Plan (geprüft)
      const bericht = (nr: string, periode: string, stand: string, status: string, noetig = false) => tx.query(
        `INSERT INTO ppm.statusbericht (tenant_id, projekt_id, periode, stand, status, trend, phase, naechster_meilenstein, begruendung, massnahme, entscheid_noetig, eingereicht_at)
         VALUES ($1, $2, $3, $4, $5, 'gleichbleibend', 'P1', 'Konzept fertig', 'Grund', 'Massnahme', $6, now())`, [T, p[nr], periode, stand, status, noetig]);
      await bericht('2026-001', VORPERIODE, 'geprueft', 'im_plan');
      await bericht('2026-002', VORPERIODE, 'geprueft', 'kritisch');
      // Laufende Periode: 2026-001 kritisch mit Entscheidbedarf (Eskalation); 2026-002 fehlt
      await bericht('2026-001', PERIODE, 'eingereicht', 'kritisch', true);
      // Badge «Eskalation» aus der Tabelle eskalation (AP-E2-4), nicht aus «Entscheid nötig» allein
      await tx.query(`INSERT INTO ppm.eskalation (tenant_id, projekt_id, statusbericht_id, grund)
        SELECT $1, projekt_id, id, 'Lieferverzug' FROM ppm.statusbericht WHERE projekt_id = $2 AND periode = $3`, [T, p['2026-001'], PERIODE]);
      await tx.query("INSERT INTO ppm.meilenstein (tenant_id, projekt_id, phase, art, text, termin_baseline) VALUES ($1, $2, 'P1', 'meilenstein', 'Pilot', '2027-03-31')", [T, p['2026-001']]);
    });
    pl = { authorization: l.authorization };
    await grant(api, T, `user:${l.principalId}`, 'projekt-fuehren', { type: 'projekt', id: p['2026-001']! });
    const g = await login(api, 'demo', 'u-gremium', null);
    await grant(api, T, `user:${g.principalId}`, 'gremium', { type: 'portfolio', id: pfA });
    gremium = { authorization: g.authorization };
    const d = await login(api, 'demo', 'u-dir', null);
    await grant(api, T, `user:${d.principalId}`, 'portfolio-steuern', { type: 'portfolio', id: pfC });
    direktion = { authorization: d.authorization };
  });
  after(async () => { await api?.close(); });

  const get = async (h: Record<string, string>, q = '') => {
    const r = await api.app.inject({ method: 'GET', url: `/v1/dashboard${q}`, headers: h });
    return r;
  };
  const dashboard = async (h: Record<string, string>, q = '') => {
    const r = await get(h, q);
    assert.equal(r.statusCode, 200, r.body);
    return r.json() as Antwort;
  };

  test('Offene Periode live: gemeldet, ausstehend, ohne Pflicht, Eskalation; kritische zuerst', async () => {
    const d = await dashboard(ue, `?periode=${PERIODE}`);
    assert.equal(d.periodeStand, 'offen');
    assert.deepEqual(d.items.map(i => [i.nummer, i.status, i.meldung]), [
      ['2026-001', 'kritisch', 'gemeldet'],
      ['2026-002', 'kritisch', 'ausstehend'],
      ['2026-003', null, 'ohne_pflicht'],
      ['2026-004', null, 'ohne_pflicht'],
    ]);
    const z1 = d.items[0]!;
    assert.deepEqual([z1.merkmale, z1.statusVorperiode, z1.projektleitung !== null, z1.naechsterMeilenstein], [['eskalation'], 'im_plan', true, { termin: '2027-03-31', text: 'Pilot' }]);
    assert.deepEqual([d.items[1]!.werteAus, d.items[1]!.merkmale], [VORPERIODE, []]);
    assert.deepEqual(d.funnel.map(f => [f.phase, f.anzahl, f.kritisch, f.nichtGemeldet]), [['P0', 0, 0, 0], ['P1', 2, 1, 0], ['P2', 1, 1, 1], ['P3', 0, 0, 0], ['P4', 1, 0, 0]]);
    // Portfolio über seinen Schlüssel (I-N5)
    assert.deepEqual((await dashboard(ue, `?periode=${PERIODE}&portfolio=dir-med`)).items.map(i => i.nummer), ['2026-004']);
    assert.equal((await get(ue, '?portfolio=gibtsnicht')).statusCode, 404);

    // Export (Seitentyp Bericht): die Projekte wie die Liste, nach Phase und Auswahl (dieselben Bedingungen wie die Zahlen)
    const x = await get(ue, `?periode=${PERIODE}&format=csv`);
    assert.equal(x.statusCode, 200, x.body);
    assert.match(x.headers['content-disposition'] as string, new RegExp(`filename="dashboard-${PERIODE}\\.csv"`));
    const zeilen = x.body.replace(/^﻿/, '').trim().split('\r\n');
    assert.ok(zeilen[0]!.startsWith('Nummer;Projekt;Portfolio;Handlungsfeld;Projektleitung;Phase;'));
    assert.deepEqual(zeilen.slice(1).map(z => z.split(';')[0]), ['2026-001', '2026-002', '2026-003', '2026-004']);
    const kritischP1 = (await get(ue, `?periode=${PERIODE}&format=csv&phase=P1&auswahl=kritisch`)).body.replace(/^﻿/, '').trim().split('\r\n');
    assert.deepEqual(kritischP1.slice(1).map(z => z.split(';')[0]), ['2026-001']);
    const offen = (await get(ue, `?periode=${PERIODE}&format=csv&auswahl=offen`)).body.replace(/^﻿/, '').trim().split('\r\n');
    assert.deepEqual(offen.slice(1).map(z => z.split(';')[0]), ['2026-002']);
    assert.equal((await get(ue, `?periode=${PERIODE}&phase=P1`)).statusCode, 422, '`phase` nur für den Export');
    assert.equal((await get(gremium, `?periode=${PERIODE}&format=csv&portfolio=dir-med`)).statusCode, 404);
  });

  test('Sichtbarkeit je Rolle: Gremium und Direktion nur ihr Portfolio, Projektleitung kein Dashboard', async () => {
    const g = await dashboard(gremium, `?periode=${PERIODE}`);
    assert.deepEqual(g.portfolios.map(x => x.schluessel), ['transformation']);
    assert.deepEqual(g.items.map(i => i.nummer), ['2026-001', '2026-002', '2026-003']);
    assert.equal((await get(gremium, '?portfolio=dir-med')).statusCode, 404, 'fremdes Portfolio wie unbekannt');
    const d = await dashboard(direktion, `?periode=${PERIODE}`);
    assert.deepEqual(d.items.map(i => i.nummer), ['2026-004']);
    assert.equal((await get(pl)).statusCode, 403, 'Projektrollen ohne auswertung:read (UX-OF-12, A-33)');
  });

  test('Abgeschlossene Periode aus dem Stand bei Abschluss: «nicht gemeldet» mit Werten der Vorperiode (A-11)', async () => {
    // Bericht von 2026-001 prüfen und die Periode über den Monatsabschluss schliessen (AP-E1-2)
    await full(api.t.runtime, T, tx => tx.query("UPDATE ppm.statusbericht SET stand = 'geprueft', geprueft_at = now() WHERE projekt_id = $1 AND periode = $2", [p['2026-001'], PERIODE]));
    const s = await api.app.inject({ method: 'POST', url: `/v1/perioden/${PERIODE}/abschliessen`, headers: ue });
    assert.equal(s.statusCode, 200, s.body);
    const d = await dashboard(ue);
    assert.deepEqual([d.periode, d.periodeStand], [PERIODE, 'abgeschlossen'], 'ohne Angabe die letzte abgeschlossene Periode');
    const ng = d.items.find(i => i.nummer === '2026-002')!;
    assert.deepEqual([ng.meldung, ng.status, ng.werteAus], ['nicht_gemeldet', 'kritisch', VORPERIODE]);
    assert.deepEqual(d.items.find(i => i.nummer === '2026-001')!.merkmale, ['eskalation']);
  });

  test('Q-L5: 1000 Zeilen in einer Antwort', async () => {
    await full(api.t.runtime, T, tx => tx.query(
      "INSERT INTO ppm.projekt (tenant_id, nummer, name, portfolio_id, phase) SELECT $1, '2025-' || lpad(n::text, 4, '0'), 'Vorhaben ' || n, $2, 'P2' FROM generate_series(1, 1000) n", [T, pfA]));
    const start = performance.now();
    const d = await dashboard(ue, `?periode=${VORPERIODE.slice(0, 4)}-01`);
    const ms = performance.now() - start;
    assert.ok(d.items.length >= 1000, String(d.items.length));
    assert.ok(ms < 3000, `${Math.round(ms)} ms`);
  });

  test('Badge «Eskalation» nur, solange die Eskalation nicht erledigt ist (AP-E2-4)', async () => {
    await full(api.t.runtime, T, tx => tx.query("UPDATE ppm.eskalation SET stand = 'erledigt', ergebnis = 'erledigt' WHERE projekt_id = $1", [p['2026-001']]));
    for (const q of [`?periode=${PERIODE}`, '']) {
      const d = await dashboard(ue, q);
      assert.deepEqual(d.items.find(i => i.nummer === '2026-001')?.merkmale ?? [], [], q);
    }
  });
});
