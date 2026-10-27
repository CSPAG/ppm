/** Modul idee (220_idee, BC DM.01.01, AP-E4-1): Projektideen und Rückfragen. */
import assert from 'node:assert/strict';
import type { Matrix } from './typ.ts';

export const matrix: Matrix = {
  tables: {
    // erfasst von der Person «probe-vertretene» aus matrix/eingang.ts
    idee: async (tx, t) => {
      await tx.query("INSERT INTO ppm.idee (tenant_id, nummer, erfasst_von, titel, stand) SELECT $1, 1, id, 'Probe', 'eingereicht' FROM ppm.principal WHERE tenant_id = $1 AND subject = 'probe-vertretene'", [t]);
      return "titel = 'Probe'";
    },
    idee_rueckfrage: async (tx, t) => {
      await tx.query("INSERT INTO ppm.idee_rueckfrage (tenant_id, idee_id, text) SELECT $1, id, 'Probe' FROM ppm.idee WHERE tenant_id = $1 AND titel = 'Probe'", [t]);
      return "text = 'Probe'";
    },
  },
  policies: [
    // Lesesicht EIGEN (docs/fachmodell.md 3.4): eigene Ideen, als vorgesehener Sponsor, sonst Ideenpool mit idee:read
    "ppm.idee.idee_delete RESTRICTIVE DELETE ppm_app USING (((erfasst_von = app.principal_id()) AND (stand = 'entwurf'::text)) OR ((app.principal_id() IS NULL) AND app.write_all())) CHECK -",
    "ppm.idee.idee_insert RESTRICTIVE INSERT ppm_app USING - CHECK (((erfasst_von = app.principal_id()) AND (stand = 'entwurf'::text) AND app.has_permission('idee:create'::text)) OR ((app.principal_id() IS NULL) AND app.write_all()))",
    "ppm.idee.idee_read RESTRICTIVE SELECT ppm_app USING ((erfasst_von = app.principal_id()) OR ((app.principal_id() IS NULL) AND app.read_all()) OR ((stand <> 'entwurf'::text) AND ((vorgesehener_sponsor = app.principal_id()) OR app.has_permission('idee:read'::text) OR ((portfolio_id IS NOT NULL) AND app.has_permission('idee:read'::text, 'portfolio'::text, portfolio_id))))) CHECK -",
    "ppm.idee.idee_update RESTRICTIVE UPDATE ppm_app USING (((erfasst_von = app.principal_id()) AND (stand = ANY (ARRAY['entwurf'::text, 'in_ergaenzung'::text])) AND app.has_permission('idee:create'::text)) OR app.has_permission('idee:write'::text)) CHECK (((erfasst_von = app.principal_id()) AND (stand = ANY (ARRAY['entwurf'::text, 'in_ergaenzung'::text, 'eingereicht'::text])) AND app.has_permission('idee:create'::text)) OR app.has_permission('idee:write'::text))",
    // Rückfragen über die Idee; stellen mit idee:write, beantworten die Antragstellenden in Ergänzung
    "ppm.idee_rueckfrage.idee_rueckfrage_insert RESTRICTIVE INSERT ppm_app USING - CHECK app.has_permission('idee:write'::text)",
    "ppm.idee_rueckfrage.idee_rueckfrage_read RESTRICTIVE SELECT ppm_app USING (EXISTS ( SELECT 1 FROM ppm.idee i WHERE ((i.tenant_id = idee_rueckfrage.tenant_id) AND (i.id = idee_rueckfrage.idee_id)))) CHECK -",
    "ppm.idee_rueckfrage.idee_rueckfrage_update RESTRICTIVE UPDATE ppm_app USING (app.has_permission('idee:write'::text) OR (EXISTS ( SELECT 1 FROM ppm.idee i WHERE ((i.tenant_id = idee_rueckfrage.tenant_id) AND (i.id = idee_rueckfrage.idee_id) AND (i.erfasst_von = app.principal_id()) AND (i.stand = 'in_ergaenzung'::text))))) CHECK (app.has_permission('idee:write'::text) OR (EXISTS ( SELECT 1 FROM ppm.idee i WHERE ((i.tenant_id = idee_rueckfrage.tenant_id) AND (i.id = idee_rueckfrage.idee_id) AND (i.erfasst_von = app.principal_id()) AND (i.stand = 'in_ergaenzung'::text)))))",
  ],
  tags: ['Ideen'],
  seed: async (api, a, mark) => {
    const s = await api.app.inject({ method: 'POST', url: '/v1/ideen', headers: a, payload: { titel: mark, zielsetzung: mark } });
    assert.equal(s.statusCode, 201, s.body);
    return { idee: s.json().id };
  },
  cases: {
    'GET /v1/ideen': () => ({ method: 'GET', url: '/v1/ideen', kind: 'list' }),
    'GET /v1/ideen/kopf': () => ({ method: 'GET', url: '/v1/ideen/kopf', kind: 'list' }),
    'GET /v1/ideen/auswahl': () => ({ method: 'GET', url: '/v1/ideen/auswahl', kind: 'list' }),
    // Bezüge auf Handlungsfelder anderer Organisationen prüft idee.test.ts (422 wie unbekannt)
    'POST /v1/ideen': () => ({ method: 'POST', url: '/v1/ideen', body: { titel: 'Idee von B' }, kind: 'create' }),
    'GET /v1/ideen/:id': i => ({ method: 'GET', url: `/v1/ideen/${i.idee}`, kind: 'foreign' }),
    'PATCH /v1/ideen/:id': i => ({ method: 'PATCH', url: `/v1/ideen/${i.idee}`, body: { titel: 'gehackt' }, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
    'DELETE /v1/ideen/:id': i => ({ method: 'DELETE', url: `/v1/ideen/${i.idee}`, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
    'POST /v1/ideen/:id/einreichen': i => ({ method: 'POST', url: `/v1/ideen/${i.idee}/einreichen`, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
    'PUT /v1/ideen/:id/rueckfragen/:rueckfrageId': i => ({ method: 'PUT', url: `/v1/ideen/${i.idee}/rueckfragen/${i.idee}`, body: { antwort: 'gehackt' }, kind: 'foreign' }),
  },
  unchanged: async (api, a, mark) => {
    const mine = (await api.app.inject({ method: 'GET', url: '/v1/ideen?eigene=true', headers: a })).json().items;
    assert.deepEqual(mine.map((x: { titel: string; stand: string }) => [x.titel, x.stand]), [[mark, 'entwurf']]);
  },
};
