/** Modul priorisierung, Teil Szenarien (280_szenario, BC PP.03.01–03, AP-E5-3). */
import assert from 'node:assert/strict';
import { full, tenant } from '../harness.ts';
import type { Matrix } from './typ.ts';

const R = "(app.has_permission('priorisierung:read'::text) OR app.has_permission('priorisierung:read'::text, 'portfolio'::text, portfolio_id))";
const W = "(app.has_permission('priorisierung:write'::text) OR app.has_permission('priorisierung:write'::text, 'portfolio'::text, portfolio_id))";
const WP = "(app.has_permission('priorisierung:write'::text) OR app.has_permission('priorisierung:write'::text, 'portfolio'::text, ppm.szenario_portfolio(szenario_id)))";

export const matrix: Matrix = {
  tables: {
    // braucht Portfolio «probe» und Projekt «2026-001» aus matrix/portfolio.ts und matrix/projekt.ts
    szenario: async (tx, t) => {
      await tx.query("INSERT INTO ppm.szenario (tenant_id, portfolio_id, name) SELECT $1, id, 'Probe' FROM ppm.portfolio WHERE schluessel = 'probe'", [t]);
      return "name = 'Probe'";
    },
    szenario_position: async (tx, t) => {
      await tx.query("INSERT INTO ppm.szenario_position (tenant_id, szenario_id, projekt_id, rang) SELECT $1, s.id, p.id, 7 FROM ppm.szenario s, ppm.projekt p WHERE s.name = 'Probe' AND p.nummer = '2026-001'", [t]);
      return 'rang = 7';
    },
  },
  policies: [
    // Muster PORTFOLIO (fachmodell.md 3.4); Positionen über das Portfolio ihres Szenarios
    `ppm.szenario.szenario_read RESTRICTIVE SELECT ppm_app USING ${R} CHECK -`,
    `ppm.szenario.szenario_insert RESTRICTIVE INSERT ppm_app USING - CHECK ${W}`,
    `ppm.szenario.szenario_update RESTRICTIVE UPDATE ppm_app USING ${W} CHECK ${W}`,
    `ppm.szenario.szenario_delete RESTRICTIVE DELETE ppm_app USING ${W} CHECK -`,
    'ppm.szenario_position.szenario_position_read RESTRICTIVE SELECT ppm_app USING (ppm.szenario_portfolio(szenario_id) IS NOT NULL) CHECK -',
    `ppm.szenario_position.szenario_position_insert RESTRICTIVE INSERT ppm_app USING - CHECK ${WP}`,
    `ppm.szenario_position.szenario_position_update RESTRICTIVE UPDATE ppm_app USING ${WP} CHECK ${WP}`,
    `ppm.szenario_position.szenario_position_delete RESTRICTIVE DELETE ppm_app USING ${WP} CHECK -`,
  ],
  seed: async (api, a, mark) => {
    // Portfolio von A aus matrix/projektdaten.ts (Projektname = Markierung)
    const t = await tenant(api.t.runtime, 'acme');
    const portfolio = await full(api.t.runtime, t, async tx =>
      (await tx.query<{ id: string }>('SELECT portfolio_id AS id FROM ppm.projekt WHERE name = $1', [mark])).rows[0]!.id);
    const r = await api.app.inject({ method: 'POST', url: `/v1/portfolios/${portfolio}/szenarien`, headers: a, payload: { name: mark } });
    assert.equal(r.statusCode, 201, r.body);
    return { szenarioPortfolio: portfolio, szenario: r.json().id as string };
  },
  cases: {
    'GET /v1/portfolios/:id/szenarien': i => ({ method: 'GET', url: `/v1/portfolios/${i.szenarioPortfolio}/szenarien`, kind: 'foreign' }),
    'POST /v1/portfolios/:id/szenarien': i => ({ method: 'POST', url: `/v1/portfolios/${i.szenarioPortfolio}/szenarien`, body: { name: 'Fremd' }, kind: 'foreign' }),
    'GET /v1/szenarien/vergleich': i => ({ method: 'GET', url: `/v1/szenarien/vergleich?ids=${i.szenario}`, kind: 'foreign' }),
    'GET /v1/szenarien/:id': i => ({ method: 'GET', url: `/v1/szenarien/${i.szenario}`, kind: 'foreign' }),
    'PATCH /v1/szenarien/:id': i => ({ method: 'PATCH', url: `/v1/szenarien/${i.szenario}`, body: { name: 'Fremd' }, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
    'PUT /v1/szenarien/:id/positionen': i => ({ method: 'PUT', url: `/v1/szenarien/${i.szenario}/positionen`, body: { positionen: [] }, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
    'POST /v1/szenarien/:id/verwerfen': i => ({ method: 'POST', url: `/v1/szenarien/${i.szenario}/verwerfen`, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
    'POST /v1/szenarien/:id/beantragen': i => ({ method: 'POST', url: `/v1/szenarien/${i.szenario}/beantragen`, body: {}, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
  },
  unchanged: async (api, _a, mark) => {
    const t = await tenant(api.t.runtime, 'acme');
    const rows = await full(api.t.runtime, t, async tx => (await tx.query<{ x: string }>("SELECT name || ':' || stand || ':' || version AS x FROM ppm.szenario WHERE name = $1", [mark])).rows.map(r => r.x));
    assert.deepEqual(rows, [`${mark}:entwurf:1`]);
  },
};
