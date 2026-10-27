/** Modul portfolio (010_portfolio_projekt, 050_portfolio_gremien; BC AM.02.04). */
import assert from 'node:assert/strict';
import type { Matrix } from './typ.ts';

/** Lesen mit portfolio:read (an org oder am Portfolio), Schreiben mit portfolio:admin (Muster PORTFOLIO, fachmodell.md 3.4). */
const portfolioPolicies = (t: string, ops: readonly ('insert' | 'update' | 'delete')[]) => [
  `ppm.${t}.${t}_read RESTRICTIVE SELECT ppm_app USING (app.has_permission('portfolio:read'::text) OR app.has_permission('portfolio:read'::text, 'portfolio'::text, ${t === 'portfolio' ? 'id' : 'portfolio_id'})) CHECK -`,
  ...ops.map(op => ({
    insert: `ppm.${t}.${t}_insert RESTRICTIVE INSERT ppm_app USING - CHECK app.has_permission('portfolio:admin'::text)`,
    update: `ppm.${t}.${t}_update RESTRICTIVE UPDATE ppm_app USING app.has_permission('portfolio:admin'::text) CHECK app.has_permission('portfolio:admin'::text)`,
    delete: `ppm.${t}.${t}_delete RESTRICTIVE DELETE ppm_app USING app.has_permission('portfolio:admin'::text) CHECK -`,
  })[op]),
];

export const matrix: Matrix = {
  tables: {
    portfolio: async (tx, t) => {
      await tx.query("INSERT INTO ppm.portfolio (tenant_id, kategorie, schluessel, name, pflichten) VALUES ($1, 'A', 'probe', 'Probe', true)", [t]);
      return "schluessel = 'probe'";
    },
    gremium: async (tx, t) => {
      await tx.query("INSERT INTO ppm.gremium (tenant_id, portfolio_id, kuerzel, name, art) SELECT $1, id, 'probe', 'Probe', 'entscheidend' FROM ppm.portfolio WHERE schluessel = 'probe'", [t]);
      return "kuerzel = 'probe'";
    },
    gremienweg: async (tx, t) => {
      await tx.query("INSERT INTO ppm.gremienweg (tenant_id, portfolio_id, gate_code, gremium_id) SELECT $1, portfolio_id, 'P0_P1', id FROM ppm.gremium WHERE kuerzel = 'probe'", [t]);
      return "gate_code = 'P0_P1'";
    },
    sitzungstermin: async (tx, t) => {
      await tx.query("INSERT INTO ppm.sitzungstermin (tenant_id, portfolio_id, gremium_id, datum) SELECT $1, portfolio_id, id, '2026-11-18' FROM ppm.gremium WHERE kuerzel = 'probe'", [t]);
      return "datum = '2026-11-18'";
    },
  },
  policies: [
    // Lesesicht, Muster PORTFOLIO (fachmodell.md 3.4)
    ...portfolioPolicies('portfolio', ['insert', 'update', 'delete']),
    ...portfolioPolicies('gremium', ['insert', 'update', 'delete']),
    ...portfolioPolicies('gremienweg', ['insert', 'update', 'delete']),
    ...portfolioPolicies('sitzungstermin', ['insert', 'delete']),
  ],
  tags: ['Portfolios'],
  seed: async (api, a, mark) => {
    const post = async (url: string, payload: unknown) => {
      const r = await api.app.inject({ method: 'POST', url, headers: a, payload: payload as Record<string, unknown> });
      assert.equal(r.statusCode, 201, r.body);
      return r.json();
    };
    const p = await post('/v1/portfolios', { kategorie: 'A', schluessel: 'geheim-a', name: mark });
    const g = await post('/v1/gremien', { portfolioId: p.id, kuerzel: 'geheim-a', name: mark, art: 'entscheidend' });
    await post(`/v1/gremien/${g.id}/termine`, { datum: '2026-12-02' });
    const w = await api.app.inject({ method: 'PUT', url: `/v1/portfolios/${p.id}/gremienweg`, headers: { ...a, 'if-match': 'W/"1"' }, payload: { schritte: [{ gate: 'P0_P1', gremiumId: g.id }] } });
    assert.equal(w.statusCode, 200, w.body);
    return { portfolio: p.id, gremium: g.id };
  },
  cases: {
    'GET /v1/portfolios': () => ({ method: 'GET', url: '/v1/portfolios', kind: 'list' }),
    'POST /v1/portfolios': () => ({ method: 'POST', url: '/v1/portfolios', body: { kategorie: 'B', schluessel: 'probe-b', name: 'Portfolio B' }, kind: 'create' }),
    'GET /v1/portfolios/:id': i => ({ method: 'GET', url: `/v1/portfolios/${i.portfolio}`, kind: 'foreign' }),
    'PATCH /v1/portfolios/:id': i => ({ method: 'PATCH', url: `/v1/portfolios/${i.portfolio}`, body: { name: 'gehackt' }, headers: { 'if-match': 'W/"2"' }, kind: 'foreign' }),
    'DELETE /v1/portfolios/:id': i => ({ method: 'DELETE', url: `/v1/portfolios/${i.portfolio}`, headers: { 'if-match': 'W/"2"' }, kind: 'foreign' }),
    'GET /v1/portfolios/:id/gremienweg': i => ({ method: 'GET', url: `/v1/portfolios/${i.portfolio}/gremienweg`, kind: 'foreign' }),
    'PUT /v1/portfolios/:id/gremienweg': i => ({ method: 'PUT', url: `/v1/portfolios/${i.portfolio}/gremienweg`, body: { schritte: [] }, headers: { 'if-match': 'W/"2"' }, kind: 'foreign' }),
    'GET /v1/gremien': i => ({ method: 'GET', url: `/v1/gremien?portfolio=${i.portfolio}`, kind: 'list' }),
    'POST /v1/gremien': i => ({ method: 'POST', url: '/v1/gremien', body: { portfolioId: i.portfolio, kuerzel: 'gehackt', name: 'gehackt', art: 'extern' }, kind: 'foreign' }),
    'GET /v1/gremien/:id': i => ({ method: 'GET', url: `/v1/gremien/${i.gremium}`, kind: 'foreign' }),
    'PATCH /v1/gremien/:id': i => ({ method: 'PATCH', url: `/v1/gremien/${i.gremium}`, body: { name: 'gehackt' }, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
    'DELETE /v1/gremien/:id': i => ({ method: 'DELETE', url: `/v1/gremien/${i.gremium}`, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
    'GET /v1/gremien/:id/termine': i => ({ method: 'GET', url: `/v1/gremien/${i.gremium}/termine`, kind: 'foreign' }),
    'POST /v1/gremien/:id/termine': i => ({ method: 'POST', url: `/v1/gremien/${i.gremium}/termine`, body: { datum: '2026-12-09' }, kind: 'foreign' }),
    'DELETE /v1/gremien/:id/termine/:datum': i => ({ method: 'DELETE', url: `/v1/gremien/${i.gremium}/termine/2026-12-02`, kind: 'foreign' }),
  },
  unchanged: async (api, a, mark) => {
    const get = async (url: string) => (await api.app.inject({ method: 'GET', url, headers: a })).json();
    // nur das eigene Portfolio (andere Module legen für ihre Daten ebenfalls Portfolios an)
    const p = (await get('/v1/portfolios')).items.filter((x: { schluessel: string }) => x.schluessel === 'geheim-a');
    assert.deepEqual(p.map((x: { name: string; version: number }) => [x.name, x.version]), [[mark, 2]]);
    const g = (await get(`/v1/gremien?portfolio=${p[0].id}`)).items;
    assert.deepEqual(g.map((x: { name: string; version: number }) => [x.name, x.version]), [[mark, 1]]);
    assert.deepEqual((await get(`/v1/gremien/${g[0].id}/termine`)).items.map((t: { datum: string }) => t.datum), ['2026-12-02']);
    assert.deepEqual((await get(`/v1/portfolios/${p[0].id}/gremienweg`)).schritte.map((s: { gate: string }) => s.gate), ['P0_P1']);
  },
};
