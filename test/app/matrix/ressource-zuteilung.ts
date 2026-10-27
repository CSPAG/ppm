/** Modul ressource, Zuteilung (350_zuteilung, BC RK.02.02, RK.02.03, AP-E7-2): Zuteilungen, Lücken, Bedarfsliste. */
import assert from 'node:assert/strict';
import { full, tenant } from '../harness.ts';
import type { Matrix } from './typ.ts';

/** Bedarf «Probe» aus matrix/projektdaten.ts und Person «probe-pl» aus matrix/projekt.ts. */
const BEDARF = "(SELECT id FROM ppm.ressourcenbedarf WHERE bemerkung = 'Probe')";
const PROJEKT = "(SELECT projekt_id FROM ppm.ressourcenbedarf WHERE bemerkung = 'Probe')";

export const matrix: Matrix = {
  tables: {
    zuteilung: async (tx, t) => {
      await tx.query(
        `INSERT INTO ppm.zuteilung (tenant_id, ressourcenbedarf_id, projekt_id, person_id, monat, fte)
         SELECT $1, ${BEDARF}, ${PROJEKT}, id, '2026-12', 0.25 FROM ppm.principal WHERE subject = 'probe-pl'`, [t]);
      return "monat = '2026-12' AND fte = 0.25";
    },
    zuteilung_luecke: async (tx, t) => {
      await tx.query(`INSERT INTO ppm.zuteilung_luecke (tenant_id, ressourcenbedarf_id, projekt_id, text) VALUES ($1, ${BEDARF}, ${PROJEKT}, 'Probe')`, [t]);
      return "text = 'Probe'";
    },
  },
  policies: [
    // Lesesicht: RM und UE, die Person selbst, die Projektleitung (darstellung.md); schreiben ressource:write
    "ppm.zuteilung.zuteilung_read RESTRICTIVE SELECT ppm_app USING (app.has_permission('ressource:read'::text) OR (person_id = app.principal_id()) OR app.has_permission('projekt:write'::text, 'projekt'::text, projekt_id)) CHECK -",
    "ppm.zuteilung.zuteilung_insert RESTRICTIVE INSERT ppm_app USING - CHECK app.has_permission('ressource:write'::text)",
    "ppm.zuteilung.zuteilung_update RESTRICTIVE UPDATE ppm_app USING app.has_permission('ressource:write'::text) CHECK app.has_permission('ressource:write'::text)",
    "ppm.zuteilung.zuteilung_delete RESTRICTIVE DELETE ppm_app USING app.has_permission('ressource:write'::text) CHECK -",
    'ppm.zuteilung_luecke.zuteilung_luecke_read RESTRICTIVE SELECT ppm_app USING ppm.projekt_sichtbar(projekt_id) CHECK -',
    "ppm.zuteilung_luecke.zuteilung_luecke_insert RESTRICTIVE INSERT ppm_app USING - CHECK app.has_permission('ressource:write'::text)",
    "ppm.zuteilung_luecke.zuteilung_luecke_delete RESTRICTIVE DELETE ppm_app USING app.has_permission('ressource:write'::text) CHECK -",
  ],
  seed: async (api, a, mark) => {
    // Bedarf von A aus matrix/projektdaten.ts (0,5 FTE Rolle «pl» 2026-11 bis 2027-03) ganz an die Person von A zuteilen:
    // gedeckt, damit keine Sammelaufgabe «Bedarf decken» im Eingang von A entsteht (matrix/eingang.ts)
    const b = (await api.app.inject({ method: 'GET', url: '/v1/bedarfe', headers: a })).json().items as { id: string; projekt: { name: string } }[];
    const bedarf = b.find(x => x.projekt.name === mark)!;
    assert.ok(bedarf, 'Bedarf von A');
    const t = await tenant(api.t.runtime, 'acme');
    const ich = await full(api.t.runtime, t, async tx => (await tx.query<{ id: string }>("SELECT id FROM ppm.principal WHERE subject = 'u-a'")).rows[0]!.id);
    const z = await api.app.inject({ method: 'POST', url: `/v1/bedarfe/${bedarf.id}/zuteilungen`, headers: a, payload: { personId: ich, fte: 0.5 } });
    assert.equal(z.statusCode, 201, z.body);
    return { zuteilungBedarf: bedarf.id, zuteilung: z.json().zuteilungen[0].id };
  },
  cases: {
    'GET /v1/bedarfe': () => ({ method: 'GET', url: '/v1/bedarfe', kind: 'list' }),
    'GET /v1/bedarfe/:id': i => ({ method: 'GET', url: `/v1/bedarfe/${i.zuteilungBedarf}`, kind: 'foreign' }),
    'GET /v1/bedarfe/:id/personen': i => ({ method: 'GET', url: `/v1/bedarfe/${i.zuteilungBedarf}/personen`, kind: 'foreign' }),
    'POST /v1/bedarfe/:id/zuteilungen': i => ({ method: 'POST', url: `/v1/bedarfe/${i.zuteilungBedarf}/zuteilungen`, body: { personId: i.zuteilungBedarf, fte: 0.5 }, kind: 'foreign' }),
    'PUT /v1/bedarfe/:id/luecke': i => ({ method: 'PUT', url: `/v1/bedarfe/${i.zuteilungBedarf}/luecke`, body: { text: 'GEHEIM-A' }, kind: 'foreign' }),
    'DELETE /v1/bedarfe/:id/luecke': i => ({ method: 'DELETE', url: `/v1/bedarfe/${i.zuteilungBedarf}/luecke`, kind: 'foreign' }),
    'PATCH /v1/zuteilungen/:id': i => ({ method: 'PATCH', url: `/v1/zuteilungen/${i.zuteilung}`, body: { fte: 1 }, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
    'DELETE /v1/zuteilungen/:id': i => ({ method: 'DELETE', url: `/v1/zuteilungen/${i.zuteilung}`, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
    'GET /v1/zuteilungen/konflikte': () => ({ method: 'GET', url: '/v1/zuteilungen/konflikte?von=2026-11&bis=2027-03', kind: 'list' }),
    'GET /v1/zuteilungen': () => ({ method: 'GET', url: '/v1/zuteilungen?person=ich', kind: 'list' }),
  },
  unchanged: async (api, a) => {
    const z = (await api.app.inject({ method: 'GET', url: '/v1/zuteilungen?person=ich', headers: a })).json().items;
    assert.deepEqual(z.map((x: { monat: string; fte: number; version: number }) => [x.monat, x.fte, x.version]), ['2026-11', '2026-12', '2027-01', '2027-02', '2027-03'].map(m => [m, 0.5, 1]));
  },
};
