/**
 * Modul vorlage (AP-E3-5 Grundbestand; AP-E7-7 Versionen und Feldzuordnung, 400_vorlage, BC AM.03.01): Tabelle
 * `vorlage` (Muster ORG mit `vorlage:write`) und alle Routen. A lädt eine Vorlage «Statusbericht» hoch; B legt in
 * «Projektidee» an, damit Version 1 der Art von A für B unbekannt bleibt.
 */
import assert from 'node:assert/strict';
import { wordVorlage } from '../fixtures/word.ts';
import type { Matrix } from './typ.ts';

const inhalt = (mark: string) => wordVorlage([['Bericht «Projekt', 'name»'], [mark]]).toString('base64');

export const matrix: Matrix = {
  tables: {
    vorlage: async (tx, t) => {
      await tx.query("INSERT INTO ppm.vorlage (tenant_id, art, version, dateiname, datei, sha256) VALUES ($1, 'vorstudie', 1, 'Probe.docx', '\\x01', repeat('a', 64))", [t]);
      return "dateiname = 'Probe.docx'";
    },
  },
  policies: [
    // Muster ORG mit dem einzigen Recht des Bereichs
    "ppm.vorlage.vorlage_read RESTRICTIVE SELECT ppm_app USING app.has_permission('vorlage:write'::text) CHECK -",
    "ppm.vorlage.vorlage_insert RESTRICTIVE INSERT ppm_app USING - CHECK app.has_permission('vorlage:write'::text)",
    "ppm.vorlage.vorlage_update RESTRICTIVE UPDATE ppm_app USING app.has_permission('vorlage:write'::text) CHECK app.has_permission('vorlage:write'::text)",
    "ppm.vorlage.vorlage_delete RESTRICTIVE DELETE ppm_app USING app.has_permission('vorlage:write'::text) CHECK -",
  ],
  tags: ['Vorlagen'],
  seed: async (api, a, mark) => {
    const r = await api.app.inject({ method: 'POST', url: '/v1/vorlagen/statusbericht/versionen', headers: a, payload: { dateiname: 'Statusbericht.docx', inhalt: inhalt(mark), bemerkung: mark } });
    assert.equal(r.statusCode, 201, r.body);
    return { vorlageId: r.json().id as string };
  },
  cases: (() => {
    const v = '/v1/vorlagen/statusbericht/versionen/1';
    const f = (method: string, url: string, o: { body?: unknown; ifMatch?: boolean } = {}) =>
      () => ({ method, url, body: o.body, ...(o.ifMatch ? { headers: { 'if-match': 'W/"1"' } } : {}), kind: 'foreign' as const });
    return {
      'GET /v1/vorlagen': () => ({ method: 'GET', url: '/v1/vorlagen', kind: 'list' }),
      'GET /v1/vorlagen/:art': () => ({ method: 'GET', url: '/v1/vorlagen/statusbericht', kind: 'list' }),
      'POST /v1/vorlagen/:art/versionen': () => ({ method: 'POST', url: '/v1/vorlagen/projektidee/versionen', body: { dateiname: 'Idee.docx', inhalt: inhalt('B') }, kind: 'create' }),
      'GET /v1/vorlagen/:art/versionen/:version': f('GET', v),
      'GET /v1/vorlagen/:art/versionen/:version/datei': f('GET', `${v}/datei`),
      'PATCH /v1/vorlagen/:art/versionen/:version': f('PATCH', v, { body: { bemerkung: 'gehackt' }, ifMatch: true }),
      'POST /v1/vorlagen/:art/versionen/:version/aktivieren': f('POST', `${v}/aktivieren`, { ifMatch: true }),
      'DELETE /v1/vorlagen/:art/versionen/:version': f('DELETE', v, { ifMatch: true }),
    };
  })(),
  unchanged: async (api, a, mark) => {
    const r = (await api.app.inject({ method: 'GET', url: '/v1/vorlagen/statusbericht/versionen/1', headers: a })).json();
    assert.deepEqual([r.stand, r.bemerkung, r.rev], ['entwurf', mark, 1]);
  },
};
