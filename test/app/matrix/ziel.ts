/** Modul ziel (080_strategisches_ziel, BC ZM.01.02, AP-E0-9): strategische Ziele je Handlungsfeld. */
import assert from 'node:assert/strict';
import type { Matrix } from './typ.ts';

export const matrix: Matrix = {
  tables: {
    // braucht das Handlungsfeld «Probe» aus matrix/handlungsfeld.ts
    strategisches_ziel: async (tx, t) => {
      await tx.query("INSERT INTO ppm.strategisches_ziel (tenant_id, handlungsfeld_id, nummer, text) SELECT $1, id, '1.1', 'Probe' FROM ppm.handlungsfeld WHERE tenant_id = $1 AND label = 'Probe'", [t]);
      return "text = 'Probe'";
    },
    strategisches_ziel_version: async () => "text = 'Probe'",   // entsteht per Trigger mit dem Ziel
  },
  policies: [
    // Lesesicht nach Muster ORG, Verlauf nach Muster STAND (docs/fachmodell.md 3.4)
    "ppm.strategisches_ziel.strategisches_ziel_read RESTRICTIVE SELECT ppm_app USING app.has_permission('ziel:read'::text) CHECK -",
    "ppm.strategisches_ziel.strategisches_ziel_insert RESTRICTIVE INSERT ppm_app USING - CHECK app.has_permission('ziel:write'::text)",
    "ppm.strategisches_ziel.strategisches_ziel_update RESTRICTIVE UPDATE ppm_app USING app.has_permission('ziel:write'::text) CHECK app.has_permission('ziel:write'::text)",
    "ppm.strategisches_ziel.strategisches_ziel_delete RESTRICTIVE DELETE ppm_app USING app.has_permission('ziel:write'::text) CHECK -",
    "ppm.strategisches_ziel_version.strategisches_ziel_version_read RESTRICTIVE SELECT ppm_app USING app.has_permission('ziel:read'::text) CHECK -",
  ],
  tags: ['Ziele'],
  seed: async (api, a, mark) => {
    // Handlungsfeld von A aus matrix/handlungsfeld.ts (läuft vorher), damit dessen Prüfung «unverändert» stimmt
    const felder = (await api.app.inject({ method: 'GET', url: `/v1/handlungsfelder?q=${encodeURIComponent(mark)}`, headers: a })).json().items as { id: string }[];
    assert.equal(felder.length, 1);
    const z = await api.app.inject({ method: 'POST', url: '/v1/strategische-ziele', headers: a, payload: { handlungsfeldId: felder[0]!.id, nummer: '1.1', text: mark } });
    assert.equal(z.statusCode, 201, z.body);
    return { strategischesZiel: z.json().id };
  },
  cases: {
    'GET /v1/strategische-ziele': () => ({ method: 'GET', url: '/v1/strategische-ziele', kind: 'list' }),
    // Anlegen unter dem Handlungsfeld von A: für B unbekannt (zusammengesetzter Fremdschlüssel) → 404 wie eine unbekannte ID
    'POST /v1/strategische-ziele': i => ({ method: 'POST', url: '/v1/strategische-ziele', body: { handlungsfeldId: i.handlungsfeld, nummer: '9.9', text: 'GEHEIM-A' }, kind: 'foreign' }),
    'GET /v1/strategische-ziele/:id': i => ({ method: 'GET', url: `/v1/strategische-ziele/${i.strategischesZiel}`, kind: 'foreign' }),
    'PATCH /v1/strategische-ziele/:id': i => ({ method: 'PATCH', url: `/v1/strategische-ziele/${i.strategischesZiel}`, body: { text: 'gehackt' }, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
    'DELETE /v1/strategische-ziele/:id': i => ({ method: 'DELETE', url: `/v1/strategische-ziele/${i.strategischesZiel}`, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
    'GET /v1/strategische-ziele/:id/history': i => ({ method: 'GET', url: `/v1/strategische-ziele/${i.strategischesZiel}/history`, kind: 'foreign' }),
  },
  unchanged: async (api, a, mark) => {
    const mine = (await api.app.inject({ method: 'GET', url: '/v1/strategische-ziele', headers: a })).json().items;
    assert.deepEqual(mine.map((x: { text: string; version: number }) => [x.text, x.version]), [[mark, 1]]);
  },
};
