/** Modul priorisierung, Teil Matrix und Rangfolge (260_rangfolge, BC PP.03.04, PP.02.02, AP-E5-2). */
import assert from 'node:assert/strict';
import { full, tenant } from '../harness.ts';
import type { Matrix } from './typ.ts';

const R = "(app.has_permission('priorisierung:read'::text) OR app.has_permission('priorisierung:read'::text, 'portfolio'::text, portfolio_id))";
const W = "(app.has_permission('priorisierung:write'::text) OR app.has_permission('priorisierung:write'::text, 'portfolio'::text, portfolio_id))";

export const matrix: Matrix = {
  tables: {
    // braucht Portfolio «probe» und Projekt «2026-001» aus matrix/portfolio.ts und matrix/projekt.ts
    rangfolge: async (tx, t) => {
      await tx.query("INSERT INTO ppm.rangfolge (tenant_id, portfolio_id, projekt_id, rang, stand, begruendung) SELECT $1, p.portfolio_id, p.id, 1, 'entwurf', 'Probe' FROM ppm.projekt p WHERE p.nummer = '2026-001'", [t]);
      return "begruendung = 'Probe'";
    },
  },
  policies: [
    // Muster PORTFOLIO (fachmodell.md 3.4)
    `ppm.rangfolge.rangfolge_read RESTRICTIVE SELECT ppm_app USING ${R} CHECK -`,
    `ppm.rangfolge.rangfolge_insert RESTRICTIVE INSERT ppm_app USING - CHECK ${W}`,
    `ppm.rangfolge.rangfolge_update RESTRICTIVE UPDATE ppm_app USING ${W} CHECK ${W}`,
    `ppm.rangfolge.rangfolge_delete RESTRICTIVE DELETE ppm_app USING ${W} CHECK -`,
  ],
  seed: async (api, a, mark) => {
    // Projekt und Portfolio von A aus matrix/projektdaten.ts (Name = Markierung)
    const t = await tenant(api.t.runtime, 'acme');
    const { projekt, portfolio } = await full(api.t.runtime, t, async tx =>
      (await tx.query<{ projekt: string; portfolio: string }>('SELECT id AS projekt, portfolio_id AS portfolio FROM ppm.projekt WHERE name = $1', [mark])).rows[0]!);
    const r = await api.app.inject({ method: 'PUT', url: `/v1/portfolios/${portfolio}/rangfolge`, headers: { ...a, 'if-match': 'W/"0"' }, payload: { projekte: [{ projektId: projekt, begruendung: mark }] } });
    assert.equal(r.statusCode, 200, r.body);
    return { matrixPortfolio: portfolio, matrixProjekt: projekt };
  },
  cases: {
    'GET /v1/portfolios/:id/matrix': i => ({ method: 'GET', url: `/v1/portfolios/${i.matrixPortfolio}/matrix`, kind: 'foreign' }),
    'GET /v1/portfolios/:id/rangfolge': i => ({ method: 'GET', url: `/v1/portfolios/${i.matrixPortfolio}/rangfolge`, kind: 'foreign' }),
    'PUT /v1/portfolios/:id/rangfolge': i => ({ method: 'PUT', url: `/v1/portfolios/${i.matrixPortfolio}/rangfolge`, body: { projekte: [] }, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
  },
  unchanged: async (api, a, mark) => {
    const t = await tenant(api.t.runtime, 'acme');
    const rows = await full(api.t.runtime, t, async tx => (await tx.query<{ x: string }>("SELECT rang || ':' || version AS x FROM ppm.rangfolge WHERE begruendung = $1", [mark])).rows.map(r => r.x));
    assert.deepEqual(rows, ['1:1']);
  },
};
