/** Modul priorisierung (250_priorisierung, BC PP.01.02, PP.01.03, PP.02.01, AP-E5-1): Bewertungsmodell, Budgetrahmen, Bewertung. */
import assert from 'node:assert/strict';
import { full, tenant } from '../harness.ts';
import type { Matrix } from './typ.ts';

const W = "app.has_permission('priorisierung:write'::text)";
const WP = "(app.has_permission('priorisierung:write'::text) OR app.has_permission('priorisierung:write'::text, 'portfolio'::text, portfolio_id))";
const ENTWURF = 'ppm.bewertungsmodell_entwurf(bewertungsmodell_id)';

export const matrix: Matrix = {
  tables: {
    // als Entwurf: Kriterien und Budgetrahmen lassen sich nur im Entwurf anlegen (Lesesicht)
    bewertungsmodell: async (tx, t) => {
      await tx.query("INSERT INTO ppm.bewertungsmodell (tenant_id, nummer, beschreibung) VALUES ($1, 1, 'Probe')", [t]);
      return "beschreibung = 'Probe'";
    },
    kriterium: async (tx, t) => {
      await tx.query("INSERT INTO ppm.kriterium (tenant_id, bewertungsmodell_id, schluessel, text, position) SELECT $1, id, 'probe', 'Probe', 0 FROM ppm.bewertungsmodell WHERE beschreibung = 'Probe'", [t]);
      return "text = 'Probe'";
    },
    budgetrahmen: async (tx, t) => {
      await tx.query("INSERT INTO ppm.budgetrahmen (tenant_id, bewertungsmodell_id, portfolio_id, kategorie, betrag) SELECT $1, m.id, p.id, p.kategorie, 1000 FROM ppm.bewertungsmodell m, ppm.portfolio p WHERE m.beschreibung = 'Probe' AND p.schluessel = 'probe'", [t]);
      return 'betrag = 1000';
    },
    // braucht das Projekt «2026-001» aus matrix/projekt.ts
    bewertung: async (tx, t) => {
      await tx.query("INSERT INTO ppm.bewertung (tenant_id, projekt_id, bewertungsmodell_id, kriterium, einschaetzung, kommentar) SELECT $1, p.id, m.id, 'probe', 'hoch', 'Probe' FROM ppm.projekt p, ppm.bewertungsmodell m WHERE p.nummer = '2026-001' AND m.beschreibung = 'Probe'", [t]);
      return "kommentar = 'Probe'";
    },
  },
  policies: [
    // Muster ORG; Änderungen nur im Entwurf; lesen auch mit Recht an einem Portfolio (Gremium)
    "ppm.bewertungsmodell.bewertungsmodell_read RESTRICTIVE SELECT ppm_app USING ppm.priorisierung_lesbar() CHECK -",
    `ppm.bewertungsmodell.bewertungsmodell_insert RESTRICTIVE INSERT ppm_app USING - CHECK (${W} AND (stand = 'entwurf'::text))`,
    `ppm.bewertungsmodell.bewertungsmodell_update RESTRICTIVE UPDATE ppm_app USING (${W} AND (stand = 'entwurf'::text)) CHECK ${W}`,
    `ppm.bewertungsmodell.bewertungsmodell_delete RESTRICTIVE DELETE ppm_app USING (${W} AND (stand = 'entwurf'::text)) CHECK -`,
    "ppm.kriterium.kriterium_read RESTRICTIVE SELECT ppm_app USING ppm.priorisierung_lesbar() CHECK -",
    `ppm.kriterium.kriterium_insert RESTRICTIVE INSERT ppm_app USING - CHECK (${W} AND ${ENTWURF})`,
    `ppm.kriterium.kriterium_update RESTRICTIVE UPDATE ppm_app USING (${W} AND ${ENTWURF}) CHECK (${W} AND ${ENTWURF})`,
    `ppm.kriterium.kriterium_delete RESTRICTIVE DELETE ppm_app USING (${W} AND ${ENTWURF}) CHECK -`,
    // Muster PORTFOLIO
    "ppm.budgetrahmen.budgetrahmen_read RESTRICTIVE SELECT ppm_app USING (app.has_permission('priorisierung:read'::text) OR app.has_permission('priorisierung:read'::text, 'portfolio'::text, portfolio_id)) CHECK -",
    `ppm.budgetrahmen.budgetrahmen_insert RESTRICTIVE INSERT ppm_app USING - CHECK (${WP} AND ${ENTWURF})`,
    `ppm.budgetrahmen.budgetrahmen_update RESTRICTIVE UPDATE ppm_app USING (${WP} AND ${ENTWURF}) CHECK (${WP} AND ${ENTWURF})`,
    `ppm.budgetrahmen.budgetrahmen_delete RESTRICTIVE DELETE ppm_app USING (${WP} AND ${ENTWURF}) CHECK -`,
    // Muster KIND
    'ppm.bewertung.bewertung_read RESTRICTIVE SELECT ppm_app USING ppm.projekt_sichtbar(projekt_id) CHECK -',
    "ppm.bewertung.bewertung_insert RESTRICTIVE INSERT ppm_app USING - CHECK app.has_permission('priorisierung:write'::text, 'projekt'::text, projekt_id)",
    "ppm.bewertung.bewertung_update RESTRICTIVE UPDATE ppm_app USING app.has_permission('priorisierung:write'::text, 'projekt'::text, projekt_id) CHECK app.has_permission('priorisierung:write'::text, 'projekt'::text, projekt_id)",
    "ppm.bewertung.bewertung_delete RESTRICTIVE DELETE ppm_app USING app.has_permission('priorisierung:write'::text, 'projekt'::text, projekt_id) CHECK -",
  ],
  tags: ['Priorisierung'],
  seed: async (api, a, mark) => {
    const call = async (method: string, url: string, payload?: unknown, headers: Record<string, string> = {}) => {
      const r = await api.app.inject({ method: method as 'GET', url, headers: { ...a, ...headers }, ...(payload !== undefined ? { payload: payload as Record<string, unknown> } : {}) });
      assert.ok(r.statusCode < 300, `${method} ${url}: ${r.statusCode} ${r.body}`);
      return r;
    };
    // Projekt und Portfolio von A aus matrix/projektdaten.ts (Name = Markierung)
    const t = await tenant(api.t.runtime, 'acme');
    const { projekt, portfolio } = await full(api.t.runtime, t, async tx =>
      (await tx.query<{ projekt: string; portfolio: string }>('SELECT id AS projekt, portfolio_id AS portfolio FROM ppm.projekt WHERE name = $1', [mark])).rows[0]!);
    const m = (await call('POST', '/v1/bewertungsmodelle', { beschreibung: mark })).json();
    await call('PATCH', `/v1/bewertungsmodelle/${m.id}`, { budgetrahmen: [{ portfolioId: portfolio, betrag: 5000000 }] }, { 'if-match': 'W/"1"' });
    await call('POST', `/v1/bewertungsmodelle/${m.id}/in-kraft-setzen`, { beschluss: mark }, { 'if-match': 'W/"2"' });
    await call('PUT', `/v1/portfolios/${portfolio}/bewertungen`, { zellen: [{ projektId: projekt, kriterium: 'strategiebeitrag', einschaetzung: 'hoch', kommentar: mark }] });
    return { bewertungsmodell: m.id, bewertungPortfolio: portfolio };
  },
  cases: {
    'GET /v1/bewertungsmodelle': () => ({ method: 'GET', url: '/v1/bewertungsmodelle', kind: 'list' }),
    // B hat kein Modell in Kraft: 404 wie eine unbekannte Organisation
    'GET /v1/bewertungsmodelle/aktuell': () => ({ method: 'GET', url: '/v1/bewertungsmodelle/aktuell', kind: 'foreign' }),
    'POST /v1/bewertungsmodelle': () => ({ method: 'POST', url: '/v1/bewertungsmodelle', body: { beschreibung: 'Modell B' }, kind: 'create' }),
    'GET /v1/bewertungsmodelle/:id': i => ({ method: 'GET', url: `/v1/bewertungsmodelle/${i.bewertungsmodell}`, kind: 'foreign' }),
    'PATCH /v1/bewertungsmodelle/:id': i => ({ method: 'PATCH', url: `/v1/bewertungsmodelle/${i.bewertungsmodell}`, body: { beschreibung: 'gehackt' }, headers: { 'if-match': 'W/"3"' }, kind: 'foreign' }),
    'DELETE /v1/bewertungsmodelle/:id': i => ({ method: 'DELETE', url: `/v1/bewertungsmodelle/${i.bewertungsmodell}`, headers: { 'if-match': 'W/"3"' }, kind: 'foreign' }),
    'POST /v1/bewertungsmodelle/:id/in-kraft-setzen': i => ({ method: 'POST', url: `/v1/bewertungsmodelle/${i.bewertungsmodell}/in-kraft-setzen`, body: { beschluss: 'gehackt' }, headers: { 'if-match': 'W/"3"' }, kind: 'foreign' }),
    'GET /v1/portfolios/:id/bewertungen': i => ({ method: 'GET', url: `/v1/portfolios/${i.bewertungPortfolio}/bewertungen`, kind: 'foreign' }),
    'PUT /v1/portfolios/:id/bewertungen': i => ({ method: 'PUT', url: `/v1/portfolios/${i.bewertungPortfolio}/bewertungen`, body: { zellen: [{ projektId: i.bewertungPortfolio, kriterium: 'strategiebeitrag', einschaetzung: 'tief' }] }, kind: 'foreign' }),
  },
  unchanged: async (api, a, mark) => {
    const l = (await api.app.inject({ method: 'GET', url: '/v1/bewertungsmodelle', headers: a })).json();
    assert.deepEqual(l.items.map((m: { beschreibung: string; stand: string; version: number }) => [m.beschreibung, m.stand, m.version]), [[mark, 'in_kraft', 3]]);
    const t = await tenant(api.t.runtime, 'acme');
    const b = await full(api.t.runtime, t, async tx => (await tx.query<{ x: string }>("SELECT einschaetzung || ':' || version AS x FROM ppm.bewertung WHERE kommentar = $1", [mark])).rows.map(r => r.x));
    assert.deepEqual(b, ['hoch:1']);
  },
};
