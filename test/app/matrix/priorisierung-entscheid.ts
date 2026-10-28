/** Modul priorisierung, Teil Entscheid (290_priorisierungsentscheid, UC-008 Schritte 7–8, A2, AP-E5-5). */
import type { Matrix } from './typ.ts';

const WP = "(app.has_permission('priorisierung:write'::text) OR app.has_permission('priorisierung:write'::text, 'portfolio'::text, ppm.szenario_portfolio(szenario_id)))";

export const matrix: Matrix = {
  tables: {
    // braucht Szenario «Probe» aus matrix/priorisierung-szenario.ts und Projekt «2026-001»
    szenario_folge: async (tx, t) => {
      await tx.query("INSERT INTO ppm.szenario_folge (tenant_id, szenario_id, projekt_id, folge, begruendung) SELECT $1, s.id, p.id, 'zurueckstellen', 'Probe' FROM ppm.szenario s, ppm.projekt p WHERE s.name = 'Probe' AND p.nummer = '2026-001'", [t]);
      return "begruendung = 'Probe'";
    },
  },
  policies: [
    // wie die Positionen: über das Portfolio des Szenarios (Muster PORTFOLIO)
    'ppm.szenario_folge.szenario_folge_read RESTRICTIVE SELECT ppm_app USING (ppm.szenario_portfolio(szenario_id) IS NOT NULL) CHECK -',
    `ppm.szenario_folge.szenario_folge_insert RESTRICTIVE INSERT ppm_app USING - CHECK ${WP}`,
    `ppm.szenario_folge.szenario_folge_update RESTRICTIVE UPDATE ppm_app USING ${WP} CHECK ${WP}`,
    `ppm.szenario_folge.szenario_folge_delete RESTRICTIVE DELETE ppm_app USING ${WP} CHECK -`,
  ],
  // Szenario von A aus matrix/priorisierung-szenario.ts (`szenario`); unverändert prüft jene Datei
  cases: {
    'GET /v1/szenarien/:id/entscheid': i => ({ method: 'GET', url: `/v1/szenarien/${i.szenario}/entscheid`, kind: 'foreign' }),
    'PUT /v1/szenarien/:id/folgen': i => ({ method: 'PUT', url: `/v1/szenarien/${i.szenario}/folgen`, body: { folgen: [] }, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
    'POST /v1/szenarien/:id/traktandieren': i => ({ method: 'POST', url: `/v1/szenarien/${i.szenario}/traktandieren`, headers: { 'if-match': 'W/"1"' }, kind: 'foreign' }),
  },
};
