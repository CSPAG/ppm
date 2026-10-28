/** Modul ziel, Quartalsreporting an den VR (330_quartalsbericht, BC ZM.03.02, AP-E6-4). */
import assert from 'node:assert/strict';
import type { Matrix } from './typ.ts';

const Q = '2026-Q3';

export const matrix: Matrix = {
  tags: ['Quartalsreporting'],
  tables: {
    quartalsbericht: async (tx, t) => {
      await tx.query("INSERT INTO ppm.quartalsbericht (tenant_id, quartal, inhalt, rueckmeldung_prat) VALUES ($1, '2026-Q2', '{}', 'Probe')", [t]);
      return "rueckmeldung_prat = 'Probe'";
    },
    quartalsbericht_auftrag: async (tx, t) => {
      await tx.query(
        `INSERT INTO ppm.quartalsbericht_auftrag (tenant_id, quartalsbericht_id, text, verantwortlich)
         SELECT $1, q.id, 'Probe', (SELECT id FROM ppm.principal WHERE tenant_id = $1 AND kind = 'user' LIMIT 1) FROM ppm.quartalsbericht q WHERE q.tenant_id = $1 AND q.quartal = '2026-Q2'`, [t]);
      return "text = 'Probe'";
    },
    // zum Entscheid «Probe» aus matrix/sitzung-entscheid.ts
    vr_weiterleitung: async (tx, t) => {
      await tx.query("INSERT INTO ppm.vr_weiterleitung (tenant_id, entscheid_id, weitergeleitet_am, bemerkung) SELECT $1, id, '2026-09-30', 'Probe' FROM ppm.entscheid WHERE tenant_id = $1 AND begruendung = 'Probe'", [t]);
      return "bemerkung = 'Probe'";
    },
  },
  policies: [
    // Muster ORG: lesen mit ziel:read, ab «traktandiert» auch das Gremium am Portfolio des Traktandums (A-67, 331), schreiben mit
    // quartalsbericht:write; Aufträge auch für die verantwortliche Person
    "ppm.quartalsbericht.quartalsbericht_delete RESTRICTIVE DELETE ppm_app USING ((stand = 'in_arbeit'::text) AND app.has_permission('quartalsbericht:write'::text)) CHECK -",
    "ppm.quartalsbericht.quartalsbericht_insert RESTRICTIVE INSERT ppm_app USING - CHECK app.has_permission('quartalsbericht:write'::text)",
    "ppm.quartalsbericht.quartalsbericht_read RESTRICTIVE SELECT ppm_app USING (app.has_permission('ziel:read'::text) OR app.has_permission('quartalsbericht:write'::text) OR ((stand <> 'in_arbeit'::text) AND (gremium_portfolio_id IS NOT NULL) AND app.has_permission('sitzung:read'::text, 'portfolio'::text, gremium_portfolio_id))) CHECK -",
    "ppm.quartalsbericht.quartalsbericht_update RESTRICTIVE UPDATE ppm_app USING app.has_permission('quartalsbericht:write'::text) CHECK app.has_permission('quartalsbericht:write'::text)",
    "ppm.quartalsbericht_auftrag.quartalsbericht_auftrag_delete RESTRICTIVE DELETE ppm_app USING ((erledigt_at IS NULL) AND app.has_permission('quartalsbericht:write'::text)) CHECK -",
    "ppm.quartalsbericht_auftrag.quartalsbericht_auftrag_insert RESTRICTIVE INSERT ppm_app USING - CHECK app.has_permission('quartalsbericht:write'::text)",
    "ppm.quartalsbericht_auftrag.quartalsbericht_auftrag_read RESTRICTIVE SELECT ppm_app USING ((verantwortlich = app.principal_id()) OR (EXISTS ( SELECT 1 FROM ppm.quartalsbericht q WHERE ((q.tenant_id = quartalsbericht_auftrag.tenant_id) AND (q.id = quartalsbericht_auftrag.quartalsbericht_id))))) CHECK -",
    "ppm.quartalsbericht_auftrag.quartalsbericht_auftrag_update RESTRICTIVE UPDATE ppm_app USING ((verantwortlich = app.principal_id()) OR app.has_permission('quartalsbericht:write'::text)) CHECK ((verantwortlich = app.principal_id()) OR app.has_permission('quartalsbericht:write'::text))",
    "ppm.vr_weiterleitung.vr_weiterleitung_delete RESTRICTIVE DELETE ppm_app USING app.has_permission('quartalsbericht:write'::text) CHECK -",
    "ppm.vr_weiterleitung.vr_weiterleitung_insert RESTRICTIVE INSERT ppm_app USING - CHECK app.has_permission('quartalsbericht:write'::text)",
    "ppm.vr_weiterleitung.vr_weiterleitung_read RESTRICTIVE SELECT ppm_app USING (app.has_permission('ziel:read'::text) OR app.has_permission('quartalsbericht:write'::text)) CHECK -",
  ],
  seed: async (api, a, mark) => {
    const r = await api.app.inject({ method: 'POST', url: `/v1/quartalsberichte/${Q}/erzeugen`, headers: a });
    assert.equal(r.statusCode, 201, r.body);
    const k = await api.app.inject({ method: 'PATCH', url: `/v1/quartalsberichte/${Q}`, headers: { ...a, 'if-match': r.headers.etag as string }, payload: { kommentare: { gesamtstatus: mark } } });
    assert.equal(k.statusCode, 200, k.body);
    return { quartalsbericht: r.json().id };
  },
  cases: {
    // Quartal ist kein Geheimnis: B sieht nur seine eigenen Berichte
    'GET /v1/quartalsberichte': () => ({ method: 'GET', url: '/v1/quartalsberichte', kind: 'list' }),
    'GET /v1/quartalsberichte/:quartal': () => ({ method: 'GET', url: `/v1/quartalsberichte/${Q}`, kind: 'foreign' }),
    'POST /v1/quartalsberichte/:quartal/erzeugen': () => ({ method: 'POST', url: `/v1/quartalsberichte/${Q}/erzeugen`, kind: 'create' }),
    'PATCH /v1/quartalsberichte/:quartal': () => ({ method: 'PATCH', url: `/v1/quartalsberichte/2026-Q1`, body: { kommentare: { gesamtstatus: 'gehackt' } }, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
    'POST /v1/quartalsberichte/:quartal/traktandieren': () => ({ method: 'POST', url: `/v1/quartalsberichte/2026-Q1/traktandieren`, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
    'GET /v1/quartalsberichte/:quartal/dokument': () => ({ method: 'GET', url: `/v1/quartalsberichte/2026-Q1/dokument`, kind: 'foreign' }),
    'PUT /v1/quartalsberichte/:quartal/vr-rueckmeldung': () => ({ method: 'PUT', url: `/v1/quartalsberichte/2026-Q1/vr-rueckmeldung`, body: { vrRueckmeldung: 'gehackt' }, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
    'POST /v1/quartalsberichte/:quartal/auftraege': i => ({ method: 'POST', url: `/v1/quartalsberichte/2026-Q1/auftraege`, body: { text: 'gehackt', verantwortlich: i.quartalsbericht }, kind: 'foreign' }),
    'POST /v1/vr-auftraege/:id/erledigen': i => ({ method: 'POST', url: `/v1/vr-auftraege/${i.quartalsbericht}/erledigen`, kind: 'foreign' }),
    'GET /v1/vr-weiterleitungen': () => ({ method: 'GET', url: `/v1/vr-weiterleitungen?quartal=${Q}`, kind: 'list' }),
    'POST /v1/vr-weiterleitungen': i => ({ method: 'POST', url: '/v1/vr-weiterleitungen', body: { entscheidId: i.quartalsbericht }, kind: 'foreign' }),
    'DELETE /v1/vr-weiterleitungen/:id': i => ({ method: 'DELETE', url: `/v1/vr-weiterleitungen/${i.quartalsbericht}`, kind: 'foreign' }),
  },
  unchanged: async (api, a, mark) => {
    const b = (await api.app.inject({ method: 'GET', url: `/v1/quartalsberichte/${Q}`, headers: a })).json();
    assert.deepEqual([b.stand, b.kommentare.gesamtstatus, b.version], ['in_arbeit', mark, 2]);
  },
};
