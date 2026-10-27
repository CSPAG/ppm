/** Modul vertrag (170_vertrag; AP-E3-1): Versionen und Kapitel des Projektvertrags. */
import assert from 'node:assert/strict';
import { full, tenant } from '../harness.ts';
import type { Matrix } from './typ.ts';

/** Projekt «Probe» (2026-001) aus matrix/projekt.ts. */
const PROBE = "(SELECT id FROM ppm.projekt WHERE nummer = '2026-001')";

const ueberEltern = (tabelle: string) => [
  `ppm.${tabelle}.${tabelle}_read RESTRICTIVE SELECT ppm_app USING ppm.projekt_sichtbar(projekt_id) CHECK -`,
  `ppm.${tabelle}.${tabelle}_insert RESTRICTIVE INSERT ppm_app USING - CHECK app.has_permission('vertrag:write'::text, 'projekt'::text, projekt_id)`,
  `ppm.${tabelle}.${tabelle}_update RESTRICTIVE UPDATE ppm_app USING app.has_permission('vertrag:write'::text, 'projekt'::text, projekt_id) CHECK app.has_permission('vertrag:write'::text, 'projekt'::text, projekt_id)`,
];

export const matrix: Matrix = {
  tables: {
    vertrag_version: async (tx, t) => {
      await tx.query(`INSERT INTO ppm.vertrag_version (tenant_id, projekt_id, nummer, anlass, zielphase, begruendung) VALUES ($1, ${PROBE}, '0.1', 'initial', 'P1', 'Probe')`, [t]);
      return "begruendung = 'Probe'";
    },
    vertrag_kapitel: async (tx, t) => {
      await tx.query(`INSERT INTO ppm.vertrag_kapitel (tenant_id, projekt_id, version_id, kapitel, inhalt)
        SELECT $1, projekt_id, id, 1, '{"ausgangslage": "Probe"}' FROM ppm.vertrag_version WHERE begruendung = 'Probe'`, [t]);
      return "inhalt->>'ausgangslage' = 'Probe'";
    },
  },
  policies: [
    // Muster ÜBER ELTERN mit dem Projekt (fachmodell.md 3.4); Versionen werden nie gelöscht
    ...ueberEltern('vertrag_version'), ...ueberEltern('vertrag_kapitel'),
  ],
  tags: ['Projektvertrag'],
  seed: async (api, a, mark) => {
    const t = await tenant(api.t.runtime, 'acme');
    const projekt = await full(api.t.runtime, t, async tx => {
      const pf = (await tx.query<{ id: string }>(
        "INSERT INTO ppm.portfolio (tenant_id, kategorie, schluessel, name, pflichten) VALUES ($1, 'A', 'vertrag', 'Vertrag', true) RETURNING id", [t])).rows[0]!.id;
      return (await tx.query<{ id: string }>(
        "INSERT INTO ppm.projekt (tenant_id, nummer, name, portfolio_id, herkunft) VALUES ($1, '2026-902', $2, $3, jsonb_build_object('ausgangslage', $2::text)) RETURNING id", [t, mark, pf])).rows[0]!.id;
    });
    const r = await api.app.inject({ method: 'POST', url: `/v1/projekte/${projekt}/vertrag/entwuerfe`, headers: a, payload: { anlass: 'initial' } });
    assert.equal(r.statusCode, 201, r.body);
    return { vertragProjekt: projekt, vertragVersion: r.json().version.id as string };
  },
  cases: (() => {
    const f = (method: string, url: (i: Record<string, string>) => string, o: { body?: unknown; ifMatch?: boolean } = {}) =>
      (i: Record<string, string>) => ({ method, url: url(i), body: o.body, ...(o.ifMatch ? { headers: { 'if-match': 'W/"1"' } } : {}), kind: 'foreign' as const });
    const v = (i: Record<string, string>) => `/v1/vertragsversionen/${i.vertragVersion}`;
    return {
      'GET /v1/projekte/:id/vertrag': f('GET', i => `/v1/projekte/${i.vertragProjekt}/vertrag`),
      'POST /v1/projekte/:id/vertrag/entwuerfe': f('POST', i => `/v1/projekte/${i.vertragProjekt}/vertrag/entwuerfe`, { body: { anlass: 'initial' } }),
      'GET /v1/projekte/:id/vertrag/ziele': f('GET', i => `/v1/projekte/${i.vertragProjekt}/vertrag/ziele`),
      'GET /v1/vertragsversionen/:id': f('GET', v),
      'GET /v1/vertragsversionen/:id/kapitel/:nr': f('GET', i => `${v(i)}/kapitel/1`),
      'PUT /v1/vertragsversionen/:id/kapitel/:nr': f('PUT', i => `${v(i)}/kapitel/4`, { body: { inhalt: { loesungsansatz: 'gehackt', annahmen: '' } }, ifMatch: true }),
      'GET /v1/vertragsversionen/:id/pflichtangaben': f('GET', i => `${v(i)}/pflichtangaben`),
      'POST /v1/vertragsversionen/:id/einreichen': f('POST', i => `${v(i)}/einreichen`, { ifMatch: true }),
    };
  })(),
  unchanged: async (api, _a, mark) => {
    const t = await tenant(api.t.runtime, 'acme');
    const stand = await full(api.t.runtime, t, async tx => (await tx.query<{ x: string }>(
      `SELECT v.nummer || ':' || v.stand || ':' || v.version || ':' || (SELECT string_agg(k.version::text, ',' ORDER BY k.kapitel) FROM ppm.vertrag_kapitel k WHERE k.version_id = v.id) AS x
         FROM ppm.vertrag_version v JOIN ppm.projekt p ON p.id = v.projekt_id WHERE p.name = $1`, [mark])).rows.map(r => r.x));
    assert.deepEqual(stand, [`0.1:in_arbeit:1:${Array(13).fill('1').join(',')}`]);
  },
};
