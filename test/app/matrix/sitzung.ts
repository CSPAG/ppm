/** Modul sitzung (130_sitzung; BC PP.04.01, PP.04.05): Sitzung, Traktandum, Einladung, Unterlage und Routen. */
import assert from 'node:assert/strict';
import type { Matrix } from './typ.ts';

export const matrix: Matrix = {
  tables: {
    sitzung: async (tx, t) => {
      await tx.query("INSERT INTO ppm.sitzung (tenant_id, portfolio_id, gremium_id, datum) SELECT $1, portfolio_id, id, '2026-11-18' FROM ppm.gremium WHERE kuerzel = 'probe'", [t]);
      return "datum = '2026-11-18'";
    },
    traktandum: async (tx, t) => {
      await tx.query(
        `INSERT INTO ppm.traktandum (tenant_id, portfolio_id, gremium_id, sitzung_id, art, bezug_typ, bezug_id, projekt_id, titel, stand, position)
         SELECT $1, s.portfolio_id, s.gremium_id, s.id, 'gate', 'projekt', p.id::text, p.id, 'Probe', 'traktandiert', 1
           FROM ppm.sitzung s, ppm.projekt p WHERE s.datum = '2026-11-18' AND p.nummer = '2026-001'`, [t]);
      return "titel = 'Probe'";
    },
    einladung: async (tx, t) => {
      await tx.query(
        `INSERT INTO ppm.einladung (tenant_id, traktandum_id, sitzung_id, portfolio_id, person_id, funktion)
         SELECT $1, x.id, x.sitzung_id, x.portfolio_id, p.id, 'pl' FROM ppm.traktandum x, ppm.principal p WHERE x.titel = 'Probe' AND p.subject = 'probe-pl'`, [t]);
      return "funktion = 'pl'";
    },
    unterlage: async (tx, t) => {
      await tx.query("INSERT INTO ppm.unterlage (tenant_id, traktandum_id, art, titel, stand_ok) SELECT $1, id, 'packet', 'Probe', true FROM ppm.traktandum WHERE titel = 'Probe'", [t]);
      return "titel = 'Probe'";
    },
  },
  policies: [
    // Sitzung, Muster PORTFOLIO (fachmodell.md 3.4); Eingeladene ab Versand
    "ppm.sitzung.sitzung_delete RESTRICTIVE DELETE ppm_app USING ppm.gremium_recht('sitzung:write'::text, portfolio_id) CHECK -",
    "ppm.sitzung.sitzung_insert RESTRICTIVE INSERT ppm_app USING - CHECK ppm.gremium_recht('sitzung:write'::text, portfolio_id)",
    "ppm.sitzung.sitzung_read RESTRICTIVE SELECT ppm_app USING (ppm.gremium_recht('sitzung:read'::text, portfolio_id) OR ppm.gremium_recht('sitzung:write'::text, portfolio_id) OR (EXISTS ( SELECT 1 FROM ppm.einladung e WHERE ((e.sitzung_id = sitzung.id) AND (e.person_id = app.principal_id()) AND (e.versendet_at IS NOT NULL))))) CHECK -",
    "ppm.sitzung.sitzung_update RESTRICTIVE UPDATE ppm_app USING ppm.gremium_recht('sitzung:write'::text, portfolio_id) CHECK ppm.gremium_recht('sitzung:write'::text, portfolio_id)",
    // Traktandum: vor dem Versand nur sitzung:write, Mitglieder ab Versand (vertrauliche nur mit projekt:vertraulich), Eingeladene ihr Traktandum; Vorschläge anderer Module über app.sitzung_intern
    "ppm.traktandum.traktandum_delete RESTRICTIVE DELETE ppm_app USING (ppm.gremium_recht('sitzung:write'::text, portfolio_id) OR ((current_setting('app.sitzung_intern'::text, true) = 'on'::text) AND (sitzung_id IS NULL))) CHECK -",
    "ppm.traktandum.traktandum_insert RESTRICTIVE INSERT ppm_app USING - CHECK (ppm.gremium_recht('sitzung:write'::text, portfolio_id) OR ((current_setting('app.sitzung_intern'::text, true) = 'on'::text) AND (sitzung_id IS NULL) AND (stand = 'vorgeschlagen'::text)))",
    "ppm.traktandum.traktandum_read RESTRICTIVE SELECT ppm_app USING ((current_setting('app.sitzung_intern'::text, true) = 'on'::text) OR ppm.gremium_recht('sitzung:write'::text, portfolio_id) OR ((versendet_at IS NOT NULL) AND ppm.gremium_recht('sitzung:read'::text, portfolio_id) AND ((NOT vertraulich) OR ppm.gremium_recht('projekt:vertraulich'::text, portfolio_id))) OR ((versendet_at IS NOT NULL) AND (EXISTS ( SELECT 1 FROM ppm.einladung e WHERE ((e.traktandum_id = traktandum.id) AND (e.person_id = app.principal_id())))))) CHECK -",
    "ppm.traktandum.traktandum_update RESTRICTIVE UPDATE ppm_app USING (ppm.gremium_recht('sitzung:write'::text, portfolio_id) OR ((current_setting('app.sitzung_intern'::text, true) = 'on'::text) AND (sitzung_id IS NULL))) CHECK (ppm.gremium_recht('sitzung:write'::text, portfolio_id) OR ((current_setting('app.sitzung_intern'::text, true) = 'on'::text) AND (sitzung_id IS NULL) AND (stand = 'vorgeschlagen'::text)))",
    // Einladung: die eingeladene Person und Mitglieder ab Versand
    "ppm.einladung.einladung_delete RESTRICTIVE DELETE ppm_app USING ppm.gremium_recht('sitzung:write'::text, portfolio_id) CHECK -",
    "ppm.einladung.einladung_insert RESTRICTIVE INSERT ppm_app USING - CHECK ppm.gremium_recht('sitzung:write'::text, portfolio_id)",
    "ppm.einladung.einladung_update RESTRICTIVE UPDATE ppm_app USING ppm.gremium_recht('sitzung:write'::text, portfolio_id) CHECK ppm.gremium_recht('sitzung:write'::text, portfolio_id)",
    "ppm.einladung.einladung_read RESTRICTIVE SELECT ppm_app USING (ppm.gremium_recht('sitzung:write'::text, portfolio_id) OR ((versendet_at IS NOT NULL) AND ((person_id = app.principal_id()) OR ppm.gremium_recht('sitzung:read'::text, portfolio_id)))) CHECK -",
    // Unterlage, Muster ÜBER ELTERN
    "ppm.unterlage.unterlage_delete RESTRICTIVE DELETE ppm_app USING (EXISTS ( SELECT 1 FROM ppm.traktandum t WHERE ((t.id = unterlage.traktandum_id) AND ppm.gremium_recht('sitzung:write'::text, t.portfolio_id)))) CHECK -",
    "ppm.unterlage.unterlage_insert RESTRICTIVE INSERT ppm_app USING - CHECK (EXISTS ( SELECT 1 FROM ppm.traktandum t WHERE ((t.id = unterlage.traktandum_id) AND ppm.gremium_recht('sitzung:write'::text, t.portfolio_id))))",
    'ppm.unterlage.unterlage_read RESTRICTIVE SELECT ppm_app USING (EXISTS ( SELECT 1 FROM ppm.traktandum t WHERE (t.id = unterlage.traktandum_id))) CHECK -',
  ],
  tags: ['Sitzungen'],
  seed: async (api, a, mark) => {
    const inject = async (method: string, url: string, payload?: unknown, headers: Record<string, string> = {}) => {
      const r = await api.app.inject({ method: method as 'GET', url, headers: { ...a, ...headers }, ...(payload ? { payload: payload as Record<string, unknown> } : {}) });
      assert.ok(r.statusCode < 300, `${method} ${url}: ${r.statusCode} ${r.body}`);
      return r.json();
    };
    // eigenes Portfolio mit Gremium (Kürzel ohne Markierung: es steht in Adressen und damit in Fehlermeldungen)
    const p = await inject('POST', '/v1/portfolios', { kategorie: 'B', schluessel: 'sitzung-a', name: mark });
    const g = await inject('POST', '/v1/gremien', { portfolioId: p.id, kuerzel: 'gremium-a', name: mark, art: 'entscheidend' });
    for (const datum of ['2026-12-02', '2027-01-13']) await inject('POST', `/v1/gremien/${g.id}/termine`, { datum });
    const s = await inject('POST', '/v1/gremien/gremium-a/sitzungen', { datum: '2026-12-02' });
    const mit = await inject('POST', `/v1/sitzungen/${s.id}/traktanden`, { art: 'eskalation', titel: mark, antrag: mark });
    return { sitzung: s.id, traktandum: mit.traktanden.find((t: { art: string }) => t.art === 'eskalation').id };
  },
  cases: {
    'GET /v1/gremien/:kuerzel/sitzungen': () => ({ method: 'GET', url: '/v1/gremien/gremium-a/sitzungen', kind: 'foreign' }),
    'POST /v1/gremien/:kuerzel/sitzungen': () => ({ method: 'POST', url: '/v1/gremien/gremium-a/sitzungen', body: { datum: '2027-01-13' }, kind: 'foreign' }),
    'GET /v1/gremien/:kuerzel/sitzungen/:datum': () => ({ method: 'GET', url: '/v1/gremien/gremium-a/sitzungen/2026-12-02', kind: 'foreign' }),
    'GET /v1/sitzungen/kopf': () => ({ method: 'GET', url: '/v1/sitzungen/kopf', kind: 'list' }),
    'GET /v1/sitzungen': () => ({ method: 'GET', url: '/v1/sitzungen?q=probe', kind: 'list' }),
    // Kopfkarte «Meine Projekte»: fremde Projekte ergeben nichts (Liste ohne IDs von A)
    'GET /v1/traktanden/naechste': i => ({ method: 'GET', url: `/v1/traktanden/naechste?projektId=${i.berichtProjekt}`, kind: 'list' }),
    'GET /v1/sitzungen/:id': i => ({ method: 'GET', url: `/v1/sitzungen/${i.sitzung}`, kind: 'foreign' }),
    'PATCH /v1/sitzungen/:id': i => ({ method: 'PATCH', url: `/v1/sitzungen/${i.sitzung}`, body: { ort: 'gehackt' }, headers: { 'if-match': 'W/"2"' }, kind: 'foreign' }),
    'GET /v1/sitzungen/:id/vorschlaege': i => ({ method: 'GET', url: `/v1/sitzungen/${i.sitzung}/vorschlaege`, kind: 'foreign' }),
    'POST /v1/sitzungen/:id/traktanden': i => ({ method: 'POST', url: `/v1/sitzungen/${i.sitzung}/traktanden`, body: { art: 'eskalation', titel: 'gehackt' }, kind: 'foreign' }),
    'PUT /v1/sitzungen/:id/traktanden': i => ({ method: 'PUT', url: `/v1/sitzungen/${i.sitzung}/traktanden`, body: { reihenfolge: [i.traktandum] }, headers: { 'if-match': 'W/"2"' }, kind: 'foreign' }),
    'GET /v1/sitzungen/:id/versand': i => ({ method: 'GET', url: `/v1/sitzungen/${i.sitzung}/versand`, kind: 'foreign' }),
    'POST /v1/sitzungen/:id/versenden': i => ({ method: 'POST', url: `/v1/sitzungen/${i.sitzung}/versenden`, headers: { 'if-match': 'W/"2"' }, kind: 'foreign' }),
    'GET /v1/traktanden/:id': i => ({ method: 'GET', url: `/v1/traktanden/${i.traktandum}`, kind: 'foreign' }),
    'PATCH /v1/traktanden/:id': i => ({ method: 'PATCH', url: `/v1/traktanden/${i.traktandum}`, body: { titel: 'gehackt' }, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
    'POST /v1/traktanden/:id/entfernen': i => ({ method: 'POST', url: `/v1/traktanden/${i.traktandum}/entfernen`, kind: 'foreign' }),
    'POST /v1/traktanden/:id/verschieben': i => ({ method: 'POST', url: `/v1/traktanden/${i.traktandum}/verschieben`, kind: 'foreign' }),
    'PUT /v1/traktanden/:id/einladungen': i => ({ method: 'PUT', url: `/v1/traktanden/${i.traktandum}/einladungen`, body: { einladungen: [] }, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
  },
  unchanged: async (api, a, mark) => {
    const s = (await api.app.inject({ method: 'GET', url: '/v1/gremien/gremium-a/sitzungen/2026-12-02', headers: a })).json();
    assert.deepEqual([s.stand, s.ort, s.traktanden.map((t: { titel: string; stand: string }) => [t.titel, t.stand])], ['in_vorbereitung', '', [['Bericht der Programmleitung', 'traktandiert'], [mark, 'traktandiert']]]);
  },
};
