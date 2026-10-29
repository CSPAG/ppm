/** Monatsabschluss im Modul statusbericht (100_monatsabschluss; BC PS.01.02–04, AP-E1-2): Rückfrage, Einforderung, Stand der Periode. */
import type { Matrix } from './typ.ts';

/** Periode der Testfälle: der laufende Monat (spätere Perioden haben noch nicht begonnen). */
const periode = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' }).slice(0, 7);

export const matrix: Matrix = {
  tables: {
    // brauchen Periode und Bericht aus matrix/statusbericht.ts
    rueckfrage: async (tx, t) => {
      await tx.query("INSERT INTO ppm.rueckfrage (tenant_id, statusbericht_id, projekt_id, text) SELECT $1, id, projekt_id, 'Probe' FROM ppm.statusbericht WHERE entscheide = 'Probe'", [t]);
      return "text = 'Probe'";
    },
    einforderung: async (tx, t) => {
      await tx.query("INSERT INTO ppm.einforderung (tenant_id, periode, projekt_id) SELECT $1, '2026-01', id FROM ppm.projekt WHERE nummer = '2026-001'", [t]);
      return "periode = '2026-01'";
    },
    dashboard_zeile: async (tx, t) => {
      await tx.query("INSERT INTO ppm.dashboard_zeile (tenant_id, periode, projekt_id, gemeldet, phase, naechster_meilenstein) SELECT $1, '2026-01', id, false, 'P1', 'Probe' FROM ppm.projekt WHERE nummer = '2026-001'", [t]);
      return "naechster_meilenstein = 'Probe'";
    },
  },
  policies: [
    // Rückfrage, Muster KIND (stellen statusbericht:review am Portfolio, beantworten statusbericht:write am Projekt)
    'ppm.rueckfrage.rueckfrage_read RESTRICTIVE SELECT ppm_app USING ppm.projekt_sichtbar(projekt_id) CHECK -',
    "ppm.rueckfrage.rueckfrage_insert RESTRICTIVE INSERT ppm_app USING - CHECK app.has_permission('statusbericht:review'::text, 'portfolio'::text, ppm.portfolio_von(projekt_id))",
    "ppm.rueckfrage.rueckfrage_update RESTRICTIVE UPDATE ppm_app USING (ppm.recht_am_projekt('statusbericht:write'::text, projekt_id) OR app.has_permission('statusbericht:review'::text, 'portfolio'::text, ppm.portfolio_von(projekt_id))) CHECK (ppm.recht_am_projekt('statusbericht:write'::text, projekt_id) OR app.has_permission('statusbericht:review'::text, 'portfolio'::text, ppm.portfolio_von(projekt_id)))",
    // Einforderung, Muster KIND (statusbericht:review)
    'ppm.einforderung.einforderung_read RESTRICTIVE SELECT ppm_app USING ppm.projekt_sichtbar(projekt_id) CHECK -',
    "ppm.einforderung.einforderung_insert RESTRICTIVE INSERT ppm_app USING - CHECK app.has_permission('statusbericht:review'::text, 'portfolio'::text, ppm.portfolio_von(projekt_id))",
    "ppm.einforderung.einforderung_update RESTRICTIVE UPDATE ppm_app USING app.has_permission('statusbericht:review'::text, 'portfolio'::text, ppm.portfolio_von(projekt_id)) CHECK app.has_permission('statusbericht:review'::text, 'portfolio'::text, ppm.portfolio_von(projekt_id))",
    // Stand der Periode, Muster STAND (anhängen mit periode:close)
    'ppm.dashboard_zeile.dashboard_zeile_read RESTRICTIVE SELECT ppm_app USING ppm.projekt_sichtbar(projekt_id) CHECK -',
    "ppm.dashboard_zeile.dashboard_zeile_insert RESTRICTIVE INSERT ppm_app USING - CHECK app.has_permission('periode:close'::text)",
  ],
  tags: ['Monatsabschluss'],
  // Bericht von A aus matrix/statusbericht.ts (`berichtProjekt`, Entwurf der laufenden Periode)
  cases: {
    'GET /v1/perioden/:periode': () => ({ method: 'GET', url: `/v1/perioden/${periode()}`, kind: 'list' }),
    'POST /v1/perioden/:periode/bestaetigen': i => ({ method: 'POST', url: `/v1/perioden/${periode()}/bestaetigen`, body: { projekte: [i.berichtProjekt] }, kind: 'list' }),
    'POST /v1/perioden/:periode/einfordern': i => ({ method: 'POST', url: `/v1/perioden/${periode()}/einfordern`, body: { projekte: [i.berichtProjekt] }, kind: 'list' }),
    // Vergangene Periode von B ohne Berichte: abschliessen wirkt nur in B
    'POST /v1/perioden/:periode/abschliessen': () => ({ method: 'POST', url: '/v1/perioden/2025-01/abschliessen', kind: 'create' }),
    'GET /v1/perioden/:periode/terminabweichungen': () => ({ method: 'GET', url: `/v1/perioden/${periode()}/terminabweichungen`, kind: 'list' }),
    'GET /v1/statusberichte/kopf': () => ({ method: 'GET', url: '/v1/statusberichte/kopf', kind: 'list' }),
    'POST /v1/projekte/:id/berichte/:periode/pruefen': i => ({ method: 'POST', url: `/v1/projekte/${i.berichtProjekt}/berichte/${periode()}/pruefen`, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
    'POST /v1/projekte/:id/berichte/:periode/pruefung-zuruecknehmen': i => ({ method: 'POST', url: `/v1/projekte/${i.berichtProjekt}/berichte/${periode()}/pruefung-zuruecknehmen`, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
    'GET /v1/projekte/:id/berichte/:periode/rueckfragen': i => ({ method: 'GET', url: `/v1/projekte/${i.berichtProjekt}/berichte/${periode()}/rueckfragen`, kind: 'foreign' }),
    'POST /v1/projekte/:id/berichte/:periode/rueckfragen': i => ({ method: 'POST', url: `/v1/projekte/${i.berichtProjekt}/berichte/${periode()}/rueckfragen`, body: { text: 'gehackt' }, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
  },
};
