/**
 * Modul statusbericht, Eskalation (160_eskalation, 161; BC PS.03.03, AP-E2-4). Traktandum über sitzung; eigene Route nur
 * «aus der Warnung eskalieren» (UC-004 A1.2) am Bericht aus matrix/statusbericht.ts.
 */
import type { Matrix } from './typ.ts';

const periode = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' }).slice(0, 7);

export const matrix: Matrix = {
  tables: {
    // braucht den Statusbericht «Probe» aus matrix/statusbericht.ts
    eskalation: async (tx, t) => {
      await tx.query("INSERT INTO ppm.eskalation (tenant_id, projekt_id, statusbericht_id, grund) SELECT $1, projekt_id, id, 'Probe' FROM ppm.statusbericht WHERE entscheide = 'Probe'", [t]);
      return "grund = 'Probe'";
    },
  },
  cases: {
    'POST /v1/projekte/:id/berichte/:periode/eskalation': i => ({ method: 'POST', url: `/v1/projekte/${i.berichtProjekt}/berichte/${periode()}/eskalation`, body: { grund: 'gehackt' }, kind: 'foreign' }),
  },
  policies: [
    // Muster KIND: lesen wer das Projekt sieht; anlegen und (solange offen) löschen mit statusbericht:write am Projekt;
    // Entscheid nachführen mit sitzung:write an der Organisation oder am Portfolio (UC-006 Schritt 7)
    'ppm.eskalation.eskalation_read RESTRICTIVE SELECT ppm_app USING ppm.projekt_sichtbar(projekt_id) CHECK -',
    "ppm.eskalation.eskalation_insert RESTRICTIVE INSERT ppm_app USING - CHECK app.has_permission('statusbericht:write'::text, 'projekt'::text, projekt_id)",
    "ppm.eskalation.eskalation_update RESTRICTIVE UPDATE ppm_app USING (app.has_permission('sitzung:write'::text) OR app.has_permission('sitzung:write'::text, 'portfolio'::text, ppm.portfolio_von(projekt_id))) CHECK (app.has_permission('sitzung:write'::text) OR app.has_permission('sitzung:write'::text, 'portfolio'::text, ppm.portfolio_von(projekt_id)))",
    "ppm.eskalation.eskalation_delete RESTRICTIVE DELETE ppm_app USING ((stand = 'offen'::text) AND app.has_permission('statusbericht:write'::text, 'projekt'::text, projekt_id)) CHECK -",
  ],
};
