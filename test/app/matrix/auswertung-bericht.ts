/** Modul auswertung, Risikolage und Portfoliobericht (150_portfoliobericht; BC PC.02.02, PC.04.02, AP-E2-3). */
import assert from 'node:assert/strict';
import type { Matrix } from './typ.ts';

export const matrix: Matrix = {
  tables: {
    // braucht Portfolio und Periode aus matrix/portfolio.ts bzw. matrix/statusbericht.ts
    portfoliobericht: async (tx, t) => {
      await tx.query("INSERT INTO ppm.portfoliobericht (tenant_id, portfolio_id, periode, inhalt, kommentar) SELECT $1, id, '2026-01', '{}', 'Probe' FROM ppm.portfolio ORDER BY id LIMIT 1", [t]);
      return "kommentar = 'Probe'";
    },
  },
  policies: [
    // Muster PORTFOLIO: erzeugen und ergänzen mit auswertung:write, lesen bereitgestellt mit auswertung:read (Organisation oder Portfolio)
    "ppm.portfoliobericht.portfoliobericht_read RESTRICTIVE SELECT ppm_app USING (app.has_permission('auswertung:write'::text) OR ((stand = 'bereitgestellt'::text) AND (app.has_permission('auswertung:read'::text) OR app.has_permission('auswertung:read'::text, 'portfolio'::text, portfolio_id)))) CHECK -",
    "ppm.portfoliobericht.portfoliobericht_insert RESTRICTIVE INSERT ppm_app USING - CHECK app.has_permission('auswertung:write'::text)",
    "ppm.portfoliobericht.portfoliobericht_update RESTRICTIVE UPDATE ppm_app USING app.has_permission('auswertung:write'::text) CHECK app.has_permission('auswertung:write'::text)",
  ],
  tags: ['Risikolage', 'Portfoliobericht'],
  // Bericht von A aus einer abgeschlossenen Periode ohne Berichte (Portfolio aus matrix/portfolio.ts)
  seed: async (api, a) => {
    const zu = await api.app.inject({ method: 'POST', url: '/v1/perioden/2025-02/abschliessen', headers: a });
    assert.equal(zu.statusCode, 200, zu.body);
    const r = await api.app.inject({ method: 'POST', url: '/v1/portfolioberichte', headers: a, payload: { portfolio: 'geheim-a', periode: '2025-02' } });
    assert.equal(r.statusCode, 201, r.body);
    return { portfoliobericht: r.json().id };
  },
  cases: {
    'GET /v1/dashboard/risiken': () => ({ method: 'GET', url: '/v1/dashboard/risiken', kind: 'list' }),
    'GET /v1/portfolioberichte': () => ({ method: 'GET', url: '/v1/portfolioberichte', kind: 'list' }),
    // Portfolio von A ist für B unbekannt (404)
    'POST /v1/portfolioberichte': () => ({ method: 'POST', url: '/v1/portfolioberichte', body: { portfolio: 'geheim-a', periode: '2025-02' }, kind: 'foreign' }),
    'GET /v1/portfolioberichte/:id': i => ({ method: 'GET', url: `/v1/portfolioberichte/${i.portfoliobericht}`, kind: 'foreign' }),
    'PATCH /v1/portfolioberichte/:id': i => ({ method: 'PATCH', url: `/v1/portfolioberichte/${i.portfoliobericht}`, body: { kommentar: 'gehackt' }, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
    'POST /v1/portfolioberichte/:id/bereitstellen': i => ({ method: 'POST', url: `/v1/portfolioberichte/${i.portfoliobericht}/bereitstellen`, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
    'GET /v1/portfolioberichte/:id/dokument': i => ({ method: 'GET', url: `/v1/portfolioberichte/${i.portfoliobericht}/dokument?format=pdf`, kind: 'foreign' }),
  },
};
