/** Modul projekt (010_portfolio_projekt, 040_projekt; BC PP.04.04): Projekt, Projektorganisation, Verlauf und Routen. */
import assert from 'node:assert/strict';
import { full, tenant } from '../harness.ts';
import type { Matrix } from './typ.ts';

/** Portfolio von B für den Fall «Anlegen» (nicht unter den IDs von A, sonst gälte es als fremde ID in Listen). */
let portfolioB = '';

export const matrix: Matrix = {
  tables: {
    projekt: async (tx, t) => {
      await tx.query("INSERT INTO ppm.projekt (tenant_id, nummer, name, portfolio_id) SELECT $1, '2026-001', 'Probe', id FROM ppm.portfolio WHERE schluessel = 'probe'", [t]);
      return "nummer = '2026-001'";
    },
    projekt_version: async () => "nummer = '2026-001'",   // entsteht per Trigger mit dem Projekt
    projekt_person: async (tx, t) => {
      await tx.query(
        `WITH p AS (INSERT INTO ppm.principal (tenant_id, kind, subject, display_name) VALUES ($1, 'user', 'probe-pl', 'Probe') RETURNING id)
         INSERT INTO ppm.projekt_person (tenant_id, projekt_id, person_id, funktion, akv)
         SELECT $1, x.id, p.id, 'pl', 'Probe' FROM ppm.projekt x, p WHERE x.nummer = '2026-001'`, [t]);
      return "akv = 'Probe'";
    },
  },
  policies: [
    // Lesesicht, Muster PROJEKT (Blatt) mit «vertraulich» (fachmodell.md 3.4, A-34)
    "ppm.projekt.projekt_read RESTRICTIVE SELECT ppm_app USING ((app.read_all() OR (portfolio_id = ANY (app.read_types())) OR app.has_tuple('projekt'::text, id, app.read_relations())) AND ((NOT vertraulich) OR app.has_tuple('projekt'::text, id, app.read_relations()) OR app.has_permission('projekt:vertraulich'::text) OR app.has_permission('projekt:vertraulich'::text, 'portfolio'::text, portfolio_id))) CHECK -",
    "ppm.projekt.projekt_insert RESTRICTIVE INSERT ppm_app USING - CHECK (app.has_permission('projekt:create'::text) OR app.has_permission('projekt:create'::text, 'portfolio'::text, portfolio_id))",
    "ppm.projekt.projekt_update RESTRICTIVE UPDATE ppm_app USING (app.write_all() OR (portfolio_id = ANY (app.write_types())) OR app.has_tuple('projekt'::text, id, app.write_relations())) CHECK (app.write_all() OR (portfolio_id = ANY (app.write_types())) OR app.has_tuple('projekt'::text, id, app.write_relations()))",
    "ppm.projekt.projekt_delete RESTRICTIVE DELETE ppm_app USING (app.write_all() OR (portfolio_id = ANY (app.write_types())) OR app.has_tuple('projekt'::text, id, app.write_relations())) CHECK -",
    // Projektorganisation, Muster KIND: lesen wer das Projekt sieht, schreiben mit projekt:organisation (org oder Rolle am Projekt)
    'ppm.projekt_person.projekt_person_read RESTRICTIVE SELECT ppm_app USING ppm.projekt_sichtbar(projekt_id) CHECK -',
    "ppm.projekt_person.projekt_person_insert RESTRICTIVE INSERT ppm_app USING - CHECK app.has_permission('projekt:organisation'::text, 'projekt'::text, projekt_id)",
    "ppm.projekt_person.projekt_person_delete RESTRICTIVE DELETE ppm_app USING app.has_permission('projekt:organisation'::text, 'projekt'::text, projekt_id) CHECK -",
    // Verlauf, Muster STAND
    'ppm.projekt_version.projekt_version_read RESTRICTIVE SELECT ppm_app USING ppm.projekt_sichtbar(projekt_id) CHECK -',
  ],
  tags: ['Projekte'],
  seed: async (api, a, mark) => {
    // Portfolios entstehen bis AP-E0-5 direkt in der Datenbank
    const portfolio = async (org: string) => {
      const t = await tenant(api.t.runtime, org);
      return full(api.t.runtime, t, async tx => (await tx.query<{ id: string }>(
        "INSERT INTO ppm.portfolio (tenant_id, kategorie, schluessel, name, pflichten) VALUES ($1, 'A', 'transformation', 'Transformation', true) RETURNING id", [t])).rows[0]!.id);
    };
    const pa = await portfolio('acme');
    portfolioB = await portfolio('globex');
    const s = await api.app.inject({ method: 'POST', url: '/v1/projekte', headers: a, payload: { name: mark, portfolioId: pa } });
    assert.equal(s.statusCode, 201, s.body);
    const id = s.json().id as string;
    const t = await tenant(api.t.runtime, 'acme');
    const ich = await full(api.t.runtime, t, async tx => (await tx.query<{ id: string }>("SELECT id FROM ppm.principal WHERE subject = 'u-a'")).rows[0]!.id);
    const o = await api.app.inject({ method: 'PUT', url: `/v1/projekte/${id}/organisation`, headers: { ...a, 'if-match': 'W/"0"' }, payload: { mitglieder: [{ personId: ich, funktion: 'pl', akv: mark }] } });
    assert.equal(o.statusCode, 200, o.body);
    return { projekt: id, portfolio: pa };
  },
  cases: {
    'GET /v1/projekte': () => ({ method: 'GET', url: '/v1/projekte', kind: 'list' }),
    'GET /v1/projekte/kopf': () => ({ method: 'GET', url: '/v1/projekte/kopf', kind: 'list' }),
    'POST /v1/projekte': () => ({ method: 'POST', url: '/v1/projekte', body: { name: 'Projekt B', portfolioId: portfolioB }, kind: 'create' }),
    'GET /v1/projekte/:id': i => ({ method: 'GET', url: `/v1/projekte/${i.projekt}`, kind: 'foreign' }),
    'PATCH /v1/projekte/:id': i => ({ method: 'PATCH', url: `/v1/projekte/${i.projekt}`, body: { name: 'gehackt' }, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
    'GET /v1/projekte/:id/organisation': i => ({ method: 'GET', url: `/v1/projekte/${i.projekt}/organisation`, kind: 'foreign' }),
    'PUT /v1/projekte/:id/organisation': i => ({ method: 'PUT', url: `/v1/projekte/${i.projekt}/organisation`, body: { mitglieder: [] }, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
  },
  unchanged: async (api, a, mark) => {
    const mine = (await api.app.inject({ method: 'GET', url: '/v1/projekte', headers: a })).json().items;
    assert.deepEqual(mine.map((x: { name: string; version: number }) => [x.name, x.version]), [[mark, 1]]);
    const o = (await api.app.inject({ method: 'GET', url: `/v1/projekte/${mine[0].id}/organisation`, headers: a })).json();
    assert.deepEqual([o.version, o.mitglieder.map((m: { akv: string }) => m.akv)], [1, [mark]]);
  },
};
