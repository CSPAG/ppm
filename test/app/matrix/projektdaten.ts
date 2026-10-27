/** Modul projektdaten (060_projektdaten; AP-E0-6): Register je Projekt und Portfoliorisiken. */
import assert from 'node:assert/strict';
import { full, tenant } from '../harness.ts';
import type { Matrix } from './typ.ts';

/** Projekt «Probe» (2026-001) aus matrix/projekt.ts. */
const PROBE = "(SELECT id FROM ppm.projekt WHERE nummer = '2026-001')";

const kind = (tabelle: string, schreiben = 'projekt:write') => [
  `ppm.${tabelle}.${tabelle}_read RESTRICTIVE SELECT ppm_app USING ppm.projekt_sichtbar(projekt_id) CHECK -`,
  `ppm.${tabelle}.${tabelle}_insert RESTRICTIVE INSERT ppm_app USING - CHECK app.has_permission('${schreiben}'::text, 'projekt'::text, projekt_id)`,
  `ppm.${tabelle}.${tabelle}_update RESTRICTIVE UPDATE ppm_app USING app.has_permission('${schreiben}'::text, 'projekt'::text, projekt_id) CHECK app.has_permission('${schreiben}'::text, 'projekt'::text, projekt_id)`,
  `ppm.${tabelle}.${tabelle}_delete RESTRICTIVE DELETE ppm_app USING app.has_permission('${schreiben}'::text, 'projekt'::text, projekt_id) CHECK -`,
];
const BETRAG = "(app.has_permission('finanzen:read'::text, 'projekt'::text, projekt_id) OR app.has_permission('finanzen:read'::text, 'portfolio'::text, ppm.portfolio_von(projekt_id)))";
const RISIKO_SCHREIBEN = "CASE WHEN (projekt_id IS NOT NULL) THEN app.has_permission('projekt:write'::text, 'projekt'::text, projekt_id) ELSE app.has_permission('projekt:write'::text) END";

export const matrix: Matrix = {
  tables: {
    meilenstein: async (tx, t) => {
      await tx.query(`INSERT INTO ppm.meilenstein (tenant_id, projekt_id, phase, art, text) VALUES ($1, ${PROBE}, 'P0', 'meilenstein', 'Probe')`, [t]);
      return "text = 'Probe'";
    },
    kosten: async (tx, t) => {
      await tx.query(`INSERT INTO ppm.kosten (tenant_id, projekt_id, phase, art, text, prognose) VALUES ($1, ${PROBE}, 'P1', 'capex', 'Probe', 1000)`, [t]);
      return "text = 'Probe'";
    },
    risiko: async (tx, t) => {
      await tx.query(`INSERT INTO ppm.risiko (tenant_id, projekt_id, text, wahrscheinlichkeit, auswirkung) VALUES ($1, ${PROBE}, 'Probe', 'hoch', 'mittel')`, [t]);
      await tx.query("INSERT INTO ppm.risiko (tenant_id, portfolio_id, text, wahrscheinlichkeit, auswirkung) SELECT $1, id, 'Probe Portfolio', 'tief', 'hoch' FROM ppm.portfolio WHERE schluessel = 'probe'", [t]);
      return "text LIKE 'Probe%'";
    },
    kpi: async (tx, t) => {
      await tx.query(`INSERT INTO ppm.kpi (tenant_id, projekt_id, art, text) VALUES ($1, ${PROBE}, 'projekt', 'Probe')`, [t]);
      return "text = 'Probe'";
    },
    kpi_wert: async (tx, t) => {
      await tx.query(`INSERT INTO ppm.kpi_wert (tenant_id, projekt_id, kpi_id, periode, wert, kommentar) SELECT $1, projekt_id, id, '2026-10', 1, 'Probe' FROM ppm.kpi WHERE text = 'Probe'`, [t]);
      return "kommentar = 'Probe'";
    },
    stakeholder: async (tx, t) => {
      await tx.query(`INSERT INTO ppm.stakeholder (tenant_id, projekt_id, gruppe) VALUES ($1, ${PROBE}, 'Probe')`, [t]);
      return "gruppe = 'Probe'";
    },
    abhaengigkeit: async (tx, t) => {
      // zweites Projekt als Ziel der Abhängigkeit
      await tx.query("INSERT INTO ppm.projekt (tenant_id, nummer, name, portfolio_id) SELECT $1, '2026-002', 'Probe 2', id FROM ppm.portfolio WHERE schluessel = 'probe'", [t]);
      await tx.query(`INSERT INTO ppm.abhaengigkeit (tenant_id, projekt_id, zu_projekt_id, text) SELECT $1, ${PROBE}, id, 'Probe' FROM ppm.projekt WHERE nummer = '2026-002'`, [t]);
      return "text = 'Probe'";
    },
    ressourcenbedarf: async (tx, t) => {
      await tx.query(`INSERT INTO ppm.ressourcenbedarf (tenant_id, projekt_id, phase, rolle, groesse, bemerkung) VALUES ($1, ${PROBE}, 'P0', 'pl', 'M', 'Probe')`, [t]);
      return "bemerkung = 'Probe'";
    },
    meldung: async (tx, t) => {
      await tx.query(`INSERT INTO ppm.meldung (tenant_id, projekt_id, stelle, text) VALUES ($1, ${PROBE}, 'dti', 'Probe')`, [t]);
      return "text = 'Probe'";
    },
  },
  policies: [
    // Muster KIND (fachmodell.md 3.4); KPI-Werte mit kpi:write
    ...kind('meilenstein'), ...kind('kpi'), ...kind('kpi_wert', 'kpi:write'), ...kind('stakeholder'), ...kind('ressourcenbedarf'),
    // Meldung: nur anhängen
    ...kind('meldung').slice(0, 2),
    // Abhängigkeit: sichtbar bei beiden Projekten
    'ppm.abhaengigkeit.abhaengigkeit_read RESTRICTIVE SELECT ppm_app USING (ppm.projekt_sichtbar(projekt_id) OR ppm.projekt_sichtbar(zu_projekt_id)) CHECK -',
    ...kind('abhaengigkeit').slice(1),
    // Risiko: Projekt nach KIND, Portfolio nach PORTFOLIO
    "ppm.risiko.risiko_read RESTRICTIVE SELECT ppm_app USING CASE WHEN (projekt_id IS NOT NULL) THEN ppm.projekt_sichtbar(projekt_id) ELSE (app.has_permission('projekt:read'::text) OR app.has_permission('projekt:read'::text, 'portfolio'::text, portfolio_id)) END CHECK -",
    `ppm.risiko.risiko_insert RESTRICTIVE INSERT ppm_app USING - CHECK ${RISIKO_SCHREIBEN}`,
    `ppm.risiko.risiko_update RESTRICTIVE UPDATE ppm_app USING ${RISIKO_SCHREIBEN} CHECK ${RISIKO_SCHREIBEN}`,
    `ppm.risiko.risiko_delete RESTRICTIVE DELETE ppm_app USING ${RISIKO_SCHREIBEN} CHECK -`,
    // Muster BETRAG (A-33)
    `ppm.kosten.kosten_read RESTRICTIVE SELECT ppm_app USING (ppm.projekt_sichtbar(projekt_id) AND ${BETRAG}) CHECK -`,
    `ppm.kosten.kosten_insert RESTRICTIVE INSERT ppm_app USING - CHECK (app.has_permission('projekt:write'::text, 'projekt'::text, projekt_id) AND ${BETRAG})`,
    ...kind('kosten').slice(2),
  ],
  tags: ['Projektdaten'],
  seed: async (api, a, mark) => {
    // Projekt von A: das aus matrix/projekt.ts (Routen ab AP-E0-4), sonst direkt in der Datenbank
    const t = await tenant(api.t.runtime, 'acme');
    const projekt = await full(api.t.runtime, t, async tx => {
      const da = (await tx.query<{ id: string }>('SELECT id FROM ppm.projekt WHERE name = $1', [mark])).rows[0];
      if (da) return da.id;
      const pf = (await tx.query<{ id: string }>(
        "INSERT INTO ppm.portfolio (tenant_id, kategorie, schluessel, name, pflichten) VALUES ($1, 'A', 'register', 'Register', true) RETURNING id", [t])).rows[0]!.id;
      return (await tx.query<{ id: string }>(
        "INSERT INTO ppm.projekt (tenant_id, nummer, name, portfolio_id) VALUES ($1, '2026-903', $2, $3) RETURNING id", [t, mark, pf])).rows[0]!.id;
    });
    const portfolio = await full(api.t.runtime, t, async tx => (await tx.query<{ portfolio_id: string }>('SELECT portfolio_id FROM ppm.projekt WHERE id = $1', [projekt])).rows[0]!.portfolio_id);
    const post = async (pfad: string, payload: Record<string, unknown>) => {
      const r = await api.app.inject({ method: 'POST', url: `/v1/${pfad}`, headers: a, payload });
      assert.equal(r.statusCode, 201, `${pfad}: ${r.body}`);
      return r.json().id as string;
    };
    const p = `projekte/${projekt}`;
    const ids = {
      meilenstein: await post(`${p}/meilensteine`, { phase: 'P1', art: 'meilenstein', text: mark }),
      kosten: await post(`${p}/kosten`, { phase: 'P1', art: 'opex', text: mark, prognose: 1000 }),
      risiko: await post(`${p}/risiken`, { text: mark, wahrscheinlichkeit: 'hoch', auswirkung: 'hoch' }),
      kpi: await post(`${p}/kpis`, { art: 'projekt', text: mark }),
      stakeholder: await post(`${p}/stakeholder`, { gruppe: mark }),
      ressourcenbedarf: await post(`${p}/ressourcenbedarf`, { phase: 'P2', rolle: 'pl', fte: 0.5, vonMonat: '2026-11', bisMonat: '2027-03' }),
      portfolioRisiko: await post(`portfolios/${portfolio}/risiken`, { text: mark, wahrscheinlichkeit: 'tief', auswirkung: 'tief' }),
    };
    await post(`${p}/meldungen`, { stelle: 'dti', text: mark });
    // KPI-Werte über die API erst ab P2 (projektdaten.test.ts); hier direkt, damit das Projekt unverändert bleibt
    await full(api.t.runtime, t, tx => tx.query("INSERT INTO ppm.kpi_wert (tenant_id, projekt_id, kpi_id, periode, wert, kommentar) VALUES ($1, $2, $3, '2026-10', 1, $4)", [t, projekt, ids.kpi, mark]));
    return { registerProjekt: projekt, registerPortfolio: portfolio, ...Object.fromEntries(Object.entries(ids).map(([k, v]) => [`register_${k}`, v])) };
  },
  cases: (() => {
    const f = (method: string, url: (i: Record<string, string>) => string, o: { body?: unknown; ifMatch?: boolean } = {}) =>
      (i: Record<string, string>) => ({ method, url: url(i), body: o.body, ...(o.ifMatch ? { headers: { 'if-match': 'W/"1"' } } : {}), kind: 'foreign' as const });
    const p = (i: Record<string, string>) => `/v1/projekte/${i.registerProjekt}`;
    const cases: NonNullable<Matrix['cases']> = {};
    const register: [string, string, unknown, unknown][] = [
      ['meilensteine', 'meilenstein', { phase: 'P1', art: 'meilenstein', text: 'GEHEIM-A' }, { text: 'gehackt' }],
      ['kosten', 'kosten', { phase: 'P1', art: 'opex', text: 'GEHEIM-A' }, { prognose: 1 }],
      ['risiken', 'risiko', { text: 'GEHEIM-A', wahrscheinlichkeit: 'hoch', auswirkung: 'hoch' }, { text: 'gehackt' }],
      ['kpis', 'kpi', { art: 'projekt', text: 'GEHEIM-A' }, { text: 'gehackt' }],
      ['stakeholder', 'stakeholder', { gruppe: 'GEHEIM-A' }, { gruppe: 'gehackt' }],
      ['abhaengigkeiten', 'meilenstein', { zuProjektId: '00000000-0000-4000-8000-000000000000', text: 'GEHEIM-A' }, { text: 'gehackt' }],
      ['ressourcenbedarf', 'ressourcenbedarf', { phase: 'P3', rolle: 'pl', groesse: 'S' }, { groesse: 'L' }],
    ];
    for (const [pfad, id, neu, patch] of register) {
      cases[`GET /v1/projekte/:id/${pfad}`] = f('GET', i => `${p(i)}/${pfad}`);
      cases[`POST /v1/projekte/:id/${pfad}`] = f('POST', i => `${p(i)}/${pfad}`, { body: neu });
      cases[`PATCH /v1/projekte/:id/${pfad}/:eintragId`] = f('PATCH', i => `${p(i)}/${pfad}/${i[`register_${id}`]}`, { body: patch, ifMatch: true });
      cases[`DELETE /v1/projekte/:id/${pfad}/:eintragId`] = f('DELETE', i => `${p(i)}/${pfad}/${i[`register_${id}`]}`, { ifMatch: true });
    }
    cases['GET /v1/projekte/:id/kpis/:kpiId/werte'] = f('GET', i => `${p(i)}/kpis/${i.register_kpi}/werte`);
    cases['PUT /v1/projekte/:id/kpis/:kpiId/werte/:periode'] = f('PUT', i => `${p(i)}/kpis/${i.register_kpi}/werte/2026-10`, { body: { wert: 9 }, ifMatch: true });
    cases['DELETE /v1/projekte/:id/kpis/:kpiId/werte/:periode'] = f('DELETE', i => `${p(i)}/kpis/${i.register_kpi}/werte/2026-10`, { ifMatch: true });
    cases['GET /v1/projekte/:id/meldungen'] = f('GET', i => `${p(i)}/meldungen`);
    cases['POST /v1/projekte/:id/meldungen'] = f('POST', i => `${p(i)}/meldungen`, { body: { stelle: 'dbi', text: 'GEHEIM-A' } });
    const pf = (i: Record<string, string>) => `/v1/portfolios/${i.registerPortfolio}/risiken`;
    cases['GET /v1/portfolios/:id/risiken'] = f('GET', pf);
    cases['POST /v1/portfolios/:id/risiken'] = f('POST', pf, { body: { text: 'GEHEIM-A', wahrscheinlichkeit: 'hoch', auswirkung: 'hoch' } });
    cases['PATCH /v1/portfolios/:id/risiken/:eintragId'] = f('PATCH', i => `${pf(i)}/${i.register_portfolioRisiko}`, { body: { text: 'gehackt' }, ifMatch: true });
    cases['DELETE /v1/portfolios/:id/risiken/:eintragId'] = f('DELETE', i => `${pf(i)}/${i.register_portfolioRisiko}`, { ifMatch: true });
    return cases;
  })(),
  unchanged: async (api, a, mark) => {
    const t = await tenant(api.t.runtime, 'acme');
    const texte = await full(api.t.runtime, t, async tx => (await tx.query<{ x: string }>(
      `SELECT x FROM (SELECT text || ':' || version AS x FROM ppm.meilenstein UNION ALL SELECT text || ':' || version || ':' || prognose FROM ppm.kosten
        UNION ALL SELECT text || ':' || version FROM ppm.risiko UNION ALL SELECT text || ':' || version FROM ppm.kpi
        UNION ALL SELECT gruppe || ':' || version FROM ppm.stakeholder UNION ALL SELECT rolle || ':' || version FROM ppm.ressourcenbedarf
        UNION ALL SELECT kommentar || ':' || version || ':' || wert FROM ppm.kpi_wert UNION ALL SELECT text FROM ppm.meldung) s ORDER BY x`)).rows.map(r => r.x));
    assert.deepEqual(texte, [`${mark}`, ...Array(5).fill(`${mark}:1`), `${mark}:1:1.0000`, `${mark}:1:1000.00`, 'pl:1'].sort());
  },
};
