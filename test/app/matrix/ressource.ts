/** Modul ressource (270_ressource, 271_kapazitaet_hr; BC RK.01.01, RK.01.02, RK.02.04, AP-E5-4, AP-E7-2): Kapazitätsangebot je Rolle und Monat, Kapazität laut HR, Auslastung. */
import assert from 'node:assert/strict';
import type { Matrix } from './typ.ts';

export const matrix: Matrix = {
  tables: {
    kapazitaet: async (tx, t) => {
      await tx.query("INSERT INTO ppm.kapazitaet (tenant_id, rolle, monat, fte) VALUES ($1, 'probe', '2026-12', 1)", [t]);
      return "rolle = 'probe'";
    },
    kapazitaet_hr: async (tx, t) => {
      await tx.query("INSERT INTO ppm.kapazitaet_hr (tenant_id, rolle, monat, fte, personen) VALUES ($1, 'probe', '2026-12', 1, 1)", [t]);
      return "rolle = 'probe'";
    },
  },
  policies: [
    // Lesesicht nach Muster ORG (docs/fachmodell.md 3.4)
    "ppm.kapazitaet.kapazitaet_read RESTRICTIVE SELECT ppm_app USING app.has_permission('ressource:read'::text) CHECK -",
    "ppm.kapazitaet.kapazitaet_insert RESTRICTIVE INSERT ppm_app USING - CHECK app.has_permission('ressource:write'::text)",
    "ppm.kapazitaet.kapazitaet_update RESTRICTIVE UPDATE ppm_app USING app.has_permission('ressource:write'::text) CHECK app.has_permission('ressource:write'::text)",
    "ppm.kapazitaet.kapazitaet_delete RESTRICTIVE DELETE ppm_app USING app.has_permission('ressource:write'::text) CHECK -",
    // Kapazität laut HR (RK.01.02): lesen wie das Angebot, schreiben der Lauf der Schnittstelle (volle Sicht)
    "ppm.kapazitaet_hr.kapazitaet_hr_read RESTRICTIVE SELECT ppm_app USING app.has_permission('ressource:read'::text) CHECK -",
    "ppm.kapazitaet_hr.kapazitaet_hr_insert RESTRICTIVE INSERT ppm_app USING - CHECK app.has_permission('ressource:write'::text)",
    "ppm.kapazitaet_hr.kapazitaet_hr_update RESTRICTIVE UPDATE ppm_app USING app.has_permission('ressource:write'::text) CHECK app.has_permission('ressource:write'::text)",
    "ppm.kapazitaet_hr.kapazitaet_hr_delete RESTRICTIVE DELETE ppm_app USING app.has_permission('ressource:write'::text) CHECK -",
  ],
  tags: ['Ressourcen'],
  seed: async (api, a) => {
    // Rolle «pl» wie der Ressourcenbedarf aus matrix/projektdaten.ts (0,5 FTE 2026-11 bis 2027-03)
    const w = await api.app.inject({ method: 'POST', url: '/v1/codetabellen/ressourcenrolle/werte', headers: a, payload: { schluessel: 'pl', label: 'Projektleitung' } });
    assert.equal(w.statusCode, 201, w.body);
    const k = await api.app.inject({ method: 'PUT', url: '/v1/kapazitaet', headers: a, payload: { zellen: [{ rolle: 'pl', monat: '2026-12', fte: 2 }] } });
    assert.equal(k.statusCode, 200, k.body);
    return {};
  },
  cases: {
    'GET /v1/kapazitaet': () => ({ method: 'GET', url: '/v1/kapazitaet?von=2026-11&bis=2027-03', kind: 'list' }),
    // B entfernt eine Zelle, die es bei B nicht gibt: keine Wirkung auf A
    'PUT /v1/kapazitaet': () => ({ method: 'PUT', url: '/v1/kapazitaet', body: { zellen: [{ rolle: 'pl', monat: '2026-12', fte: null }] }, kind: 'create' }),
    'GET /v1/kapazitaet/hr': () => ({ method: 'GET', url: '/v1/kapazitaet/hr?von=2026-11&bis=2027-03', kind: 'list' }),
    'GET /v1/auslastung': () => ({ method: 'GET', url: '/v1/auslastung?von=2026-11&bis=2027-03', kind: 'list' }),
  },
  unchanged: async (api, a) => {
    const k = (await api.app.inject({ method: 'GET', url: '/v1/kapazitaet?von=2026-11&bis=2027-03', headers: a })).json();
    assert.deepEqual(k.zellen, [{ rolle: 'pl', monat: '2026-12', fte: 2, version: 1 }]);
    const l = (await api.app.inject({ method: 'GET', url: '/v1/auslastung?von=2026-12&bis=2026-12', headers: a })).json();
    assert.deepEqual(l.rollen.map((r: { rolle: string; zellen: { bedarf: number; angebot: number }[] }) => [r.rolle, r.zellen[0]!.angebot, r.zellen[0]!.bedarf]), [['pl', 2, 0.5]]);
  },
};
