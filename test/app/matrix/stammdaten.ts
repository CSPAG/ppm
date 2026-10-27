/** Modul stammdaten (020_stammdaten, BC AM.02.01, AM.02.02; Muster ORG): Organisationseinheiten, Codewerte, Feiertage. */
import assert from 'node:assert/strict';
import type { TestApi } from '../api.ts';
import type { Matrix } from './typ.ts';

const post = async (api: TestApi, a: Record<string, string>, url: string, payload: object): Promise<string> => {
  const r = await api.app.inject({ method: 'POST', url, headers: a, payload });
  assert.equal(r.statusCode, 201, r.body);
  return r.json().id;
};

export const matrix: Matrix = {
  tables: {
    org_einheit: async (tx, t) => { await tx.query("INSERT INTO ppm.org_einheit (tenant_id, kuerzel, name) VALUES ($1, 'PROBE', 'Probe')", [t]); return "kuerzel = 'PROBE'"; },
    codewert: async (tx, t) => { await tx.query("INSERT INTO ppm.codewert (tenant_id, codetabelle, schluessel, label) VALUES ($1, 'trend', 'probe', 'Probe')", [t]); return "schluessel = 'probe'"; },
    feiertag: async (tx, t) => { await tx.query("INSERT INTO ppm.feiertag (tenant_id, datum, label) VALUES ($1, '2026-08-01', 'Probe')", [t]); return "label = 'Probe'"; },
  },
  policies: [
    // Lesesicht: Recht an der Organisation; Codewerte ohne Löschen (UC-017 Schritt 2)
    "ppm.org_einheit.org_einheit_read RESTRICTIVE SELECT ppm_app USING app.has_permission('stammdaten:read'::text) CHECK -",
    "ppm.org_einheit.org_einheit_insert RESTRICTIVE INSERT ppm_app USING - CHECK app.has_permission('stammdaten:write'::text)",
    "ppm.org_einheit.org_einheit_update RESTRICTIVE UPDATE ppm_app USING app.has_permission('stammdaten:write'::text) CHECK app.has_permission('stammdaten:write'::text)",
    "ppm.org_einheit.org_einheit_delete RESTRICTIVE DELETE ppm_app USING app.has_permission('stammdaten:write'::text) CHECK -",
    "ppm.codewert.codewert_read RESTRICTIVE SELECT ppm_app USING app.has_permission('stammdaten:read'::text) CHECK -",
    "ppm.codewert.codewert_insert RESTRICTIVE INSERT ppm_app USING - CHECK app.has_permission('stammdaten:write'::text)",
    "ppm.codewert.codewert_update RESTRICTIVE UPDATE ppm_app USING app.has_permission('stammdaten:write'::text) CHECK app.has_permission('stammdaten:write'::text)",
    "ppm.feiertag.feiertag_read RESTRICTIVE SELECT ppm_app USING app.has_permission('stammdaten:read'::text) CHECK -",
    "ppm.feiertag.feiertag_insert RESTRICTIVE INSERT ppm_app USING - CHECK app.has_permission('stammdaten:write'::text)",
    "ppm.feiertag.feiertag_update RESTRICTIVE UPDATE ppm_app USING app.has_permission('stammdaten:write'::text) CHECK app.has_permission('stammdaten:write'::text)",
    "ppm.feiertag.feiertag_delete RESTRICTIVE DELETE ppm_app USING app.has_permission('stammdaten:write'::text) CHECK -",
  ],
  tags: ['Stammdaten'],
  seed: async (api, a, mark) => ({
    org: await post(api, a, '/v1/org-einheiten', { kuerzel: 'GEHEIM', name: mark }),
    codewert: await post(api, a, '/v1/codetabellen/trend/werte', { schluessel: 'geheim', label: mark }),
    feiertag: await post(api, a, '/v1/feiertage', { datum: '2026-12-25', label: mark }),
  }),
  cases: {
    'GET /v1/org-einheiten': () => ({ method: 'GET', url: '/v1/org-einheiten', kind: 'list' }),
    'POST /v1/org-einheiten': () => ({ method: 'POST', url: '/v1/org-einheiten', body: { kuerzel: 'B1', name: 'Einheit B' }, kind: 'create' }),
    'GET /v1/org-einheiten/:id': i => ({ method: 'GET', url: `/v1/org-einheiten/${i.org}`, kind: 'foreign' }),
    'PATCH /v1/org-einheiten/:id': i => ({ method: 'PATCH', url: `/v1/org-einheiten/${i.org}`, body: { name: 'gehackt' }, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
    'DELETE /v1/org-einheiten/:id': i => ({ method: 'DELETE', url: `/v1/org-einheiten/${i.org}`, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
    'GET /v1/codetabellen': () => ({ method: 'GET', url: '/v1/codetabellen', kind: 'list' }),
    'POST /v1/codetabellen/vorgabe': () => ({ method: 'POST', url: '/v1/codetabellen/vorgabe', kind: 'create' }),
    'GET /v1/codetabellen/:schluessel/werte': () => ({ method: 'GET', url: '/v1/codetabellen/trend/werte', kind: 'list' }),
    'POST /v1/codetabellen/:schluessel/werte': () => ({ method: 'POST', url: '/v1/codetabellen/trend/werte', body: { schluessel: 'b_wert', label: 'Wert B' }, kind: 'create' }),
    'GET /v1/codetabellen/:schluessel/werte/:id': i => ({ method: 'GET', url: `/v1/codetabellen/trend/werte/${i.codewert}`, kind: 'foreign' }),
    'PATCH /v1/codetabellen/:schluessel/werte/:id': i => ({ method: 'PATCH', url: `/v1/codetabellen/trend/werte/${i.codewert}`, body: { label: 'gehackt' }, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
    'POST /v1/codetabellen/:schluessel/werte/:id/deaktivieren': i => ({ method: 'POST', url: `/v1/codetabellen/trend/werte/${i.codewert}/deaktivieren`, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
    'POST /v1/codetabellen/:schluessel/werte/:id/aktivieren': i => ({ method: 'POST', url: `/v1/codetabellen/trend/werte/${i.codewert}/aktivieren`, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
    'GET /v1/feiertage': () => ({ method: 'GET', url: '/v1/feiertage', kind: 'list' }),
    'POST /v1/feiertage': () => ({ method: 'POST', url: '/v1/feiertage', body: { datum: '2026-08-01', label: 'Bundesfeier B' }, kind: 'create' }),
    'GET /v1/feiertage/:id': i => ({ method: 'GET', url: `/v1/feiertage/${i.feiertag}`, kind: 'foreign' }),
    'PATCH /v1/feiertage/:id': i => ({ method: 'PATCH', url: `/v1/feiertage/${i.feiertag}`, body: { label: 'gehackt' }, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
    'DELETE /v1/feiertage/:id': i => ({ method: 'DELETE', url: `/v1/feiertage/${i.feiertag}`, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
  },
  unchanged: async (api, a, mark) => {
    const get = async (url: string) => (await api.app.inject({ method: 'GET', url, headers: a })).json().items as { version: number; name?: string; label?: string; aktiv?: boolean }[];
    assert.deepEqual((await get('/v1/org-einheiten')).map(x => [x.name, x.version]), [[mark, 1]]);
    assert.deepEqual((await get('/v1/codetabellen/trend/werte')).map(x => [x.label, x.aktiv, x.version]), [[mark, true, 1]]);
    assert.deepEqual((await get('/v1/feiertage')).map(x => [x.label, x.version]), [[mark, 1]]);
  },
};
