/** Modul handlungsfeld (001_handlungsfeld, BC ZM.01.01). */
import assert from 'node:assert/strict';
import type { Matrix } from './typ.ts';

export const matrix: Matrix = {
  tables: {
    handlungsfeld: async (tx, t) => { await tx.query("INSERT INTO ppm.handlungsfeld (tenant_id, label) VALUES ($1, 'Probe')", [t]); return "label = 'Probe'"; },
    handlungsfeld_version: async () => "label = 'Probe'",   // entsteht per Trigger mit dem Handlungsfeld
  },
  policies: [
    // Lesesicht: Recht an der Organisation
    "ppm.handlungsfeld.handlungsfeld_read RESTRICTIVE SELECT ppm_app USING app.has_permission('handlungsfeld:read'::text) CHECK -",
    "ppm.handlungsfeld.handlungsfeld_insert RESTRICTIVE INSERT ppm_app USING - CHECK app.has_permission('handlungsfeld:write'::text)",
    "ppm.handlungsfeld.handlungsfeld_update RESTRICTIVE UPDATE ppm_app USING app.has_permission('handlungsfeld:write'::text) CHECK app.has_permission('handlungsfeld:write'::text)",
    "ppm.handlungsfeld.handlungsfeld_delete RESTRICTIVE DELETE ppm_app USING app.has_permission('handlungsfeld:delete'::text) CHECK -",
    "ppm.handlungsfeld_version.handlungsfeld_version_read RESTRICTIVE SELECT ppm_app USING app.has_permission('handlungsfeld:read'::text) CHECK -",
  ],
  tags: ['Handlungsfelder'],
  seed: async (api, a, mark) => {
    const s = await api.app.inject({ method: 'POST', url: '/v1/handlungsfelder', headers: a, payload: { label: mark } });
    assert.equal(s.statusCode, 201, s.body);
    return { handlungsfeld: s.json().id };
  },
  cases: {
    'GET /v1/handlungsfelder': () => ({ method: 'GET', url: '/v1/handlungsfelder', kind: 'list' }),
    'POST /v1/handlungsfelder': () => ({ method: 'POST', url: '/v1/handlungsfelder', body: { label: 'GEHEIM-A' }, kind: 'create' }),
    'GET /v1/handlungsfelder/:id': i => ({ method: 'GET', url: `/v1/handlungsfelder/${i.handlungsfeld}`, kind: 'foreign' }),
    'PATCH /v1/handlungsfelder/:id': i => ({ method: 'PATCH', url: `/v1/handlungsfelder/${i.handlungsfeld}`, body: { label: 'gehackt' }, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
    'DELETE /v1/handlungsfelder/:id': i => ({ method: 'DELETE', url: `/v1/handlungsfelder/${i.handlungsfeld}`, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
    'GET /v1/handlungsfelder/:id/history': i => ({ method: 'GET', url: `/v1/handlungsfelder/${i.handlungsfeld}/history`, kind: 'foreign' }),
  },
  unchanged: async (api, a, mark) => {
    const mine = (await api.app.inject({ method: 'GET', url: '/v1/handlungsfelder', headers: a })).json().items;
    assert.deepEqual(mine.map((x: { label: string; version: number }) => [x.label, x.version]), [[mark, 1]]);
  },
};
