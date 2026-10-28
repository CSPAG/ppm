/** Modul idee, Prüfung (230_idee_pruefung, BC DM.01.02–04, PP.02.04, AP-E4-2): Leitfragen, Kriterienraster, Pool und Prüfhandlungen. */
import type { Matrix } from './typ.ts';

export const matrix: Matrix = {
  tables: {
    // zur Idee «Probe» aus matrix/idee.ts
    idee_leitfrage: async (tx, t) => {
      await tx.query("INSERT INTO ppm.idee_leitfrage (tenant_id, idee_id, position, wertestrom, frage, antwort) SELECT $1, id, 0, 'nutzen', 'Probe', 'Probe' FROM ppm.idee WHERE tenant_id = $1 AND titel = 'Probe'", [t]);
      return "frage = 'Probe'";
    },
    idee_raster: async (tx, t) => {
      await tx.query("INSERT INTO ppm.idee_raster (tenant_id, idee_id, kriterium, einschaetzung) SELECT $1, id, 'relevanz', 'hoch' FROM ppm.idee WHERE tenant_id = $1 AND titel = 'Probe'", [t]);
      return "kriterium = 'relevanz'";
    },
  },
  policies: [
    // Lesesicht ÜBER ELTERN mit dem Ideenpool (fachmodell.md 3.4): nicht für Antragstellende (K4 Z8); Schreiben mit idee:write
    "ppm.idee_leitfrage.idee_leitfrage_delete RESTRICTIVE DELETE ppm_app USING app.has_permission('idee:write'::text) CHECK -",
    "ppm.idee_leitfrage.idee_leitfrage_insert RESTRICTIVE INSERT ppm_app USING - CHECK app.has_permission('idee:write'::text)",
    "ppm.idee_leitfrage.idee_leitfrage_read RESTRICTIVE SELECT ppm_app USING (EXISTS ( SELECT 1 FROM ppm.idee i WHERE ((i.tenant_id = idee_leitfrage.tenant_id) AND (i.id = idee_leitfrage.idee_id) AND (app.has_permission('idee:read'::text) OR (i.vorgesehener_sponsor = app.principal_id()) OR ((i.portfolio_id IS NOT NULL) AND app.has_permission('idee:read'::text, 'portfolio'::text, i.portfolio_id)))))) CHECK -",
    "ppm.idee_leitfrage.idee_leitfrage_update RESTRICTIVE UPDATE ppm_app USING app.has_permission('idee:write'::text) CHECK app.has_permission('idee:write'::text)",
    "ppm.idee_raster.idee_raster_delete RESTRICTIVE DELETE ppm_app USING app.has_permission('idee:write'::text) CHECK -",
    "ppm.idee_raster.idee_raster_insert RESTRICTIVE INSERT ppm_app USING - CHECK app.has_permission('idee:write'::text)",
    "ppm.idee_raster.idee_raster_read RESTRICTIVE SELECT ppm_app USING (EXISTS ( SELECT 1 FROM ppm.idee i WHERE ((i.tenant_id = idee_raster.tenant_id) AND (i.id = idee_raster.idee_id) AND (app.has_permission('idee:read'::text) OR ((i.portfolio_id IS NOT NULL) AND app.has_permission('idee:read'::text, 'portfolio'::text, i.portfolio_id)))))) CHECK -",
    "ppm.idee_raster.idee_raster_update RESTRICTIVE UPDATE ppm_app USING app.has_permission('idee:write'::text) CHECK app.has_permission('idee:write'::text)",
  ],
  cases: {
    'GET /v1/ideen/pool': () => ({ method: 'GET', url: '/v1/ideen/pool', kind: 'list' }),
    'GET /v1/ideen/pool/funnel': () => ({ method: 'GET', url: '/v1/ideen/pool/funnel', kind: 'list' }),
    'GET /v1/ideen/:id/aehnliche': i => ({ method: 'GET', url: `/v1/ideen/${i.idee}/aehnliche`, kind: 'foreign' }),
    'GET /v1/ideen/:id/pruefung': i => ({ method: 'GET', url: `/v1/ideen/${i.idee}/pruefung`, kind: 'foreign' }),
    'PUT /v1/ideen/:id/leitfragen': i => ({ method: 'PUT', url: `/v1/ideen/${i.idee}/leitfragen`, body: { antworten: [] }, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
    'PUT /v1/ideen/:id/raster': i => ({ method: 'PUT', url: `/v1/ideen/${i.idee}/raster`, body: { raster: [] }, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
    'POST /v1/ideen/:id/kategorie': i => ({ method: 'POST', url: `/v1/ideen/${i.idee}/kategorie`, body: { kategorie: 'A' }, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
    'POST /v1/ideen/:id/rueckfragen': i => ({ method: 'POST', url: `/v1/ideen/${i.idee}/rueckfragen`, body: { fragen: [{ text: 'gehackt' }] }, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
    'POST /v1/ideen/:id/zurueckweisen': i => ({ method: 'POST', url: `/v1/ideen/${i.idee}/zurueckweisen`, body: { begruendung: 'gehackt' }, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
    'POST /v1/ideen/:id/zusammenfuehren': i => ({ method: 'POST', url: `/v1/ideen/${i.idee}/zusammenfuehren`, body: { fuehrendeIdeeId: '00000000-0000-4000-8000-000000000001' }, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
  },
};
