/** Modul projekt (010_portfolio_projekt; AP-E0-4 ergänzt Projektorganisation, Verlauf und Routen). */
import type { Matrix } from './typ.ts';

export const matrix: Matrix = {
  tables: {
    projekt: async (tx, t) => {
      await tx.query("INSERT INTO ppm.projekt (tenant_id, nummer, name, portfolio_id) SELECT $1, '2026-001', 'Probe', id FROM ppm.portfolio WHERE schluessel = 'probe'", [t]);
      return "nummer = '2026-001'";
    },
  },
  policies: [
    // Lesesicht, Muster PROJEKT (Blatt) mit «vertraulich» (fachmodell.md 3.4, A-34)
    "ppm.projekt.projekt_read RESTRICTIVE SELECT ppm_app USING ((app.read_all() OR (portfolio_id = ANY (app.read_types())) OR app.has_tuple('projekt'::text, id, app.read_relations())) AND ((NOT vertraulich) OR app.has_tuple('projekt'::text, id, app.read_relations()) OR app.has_permission('projekt:vertraulich'::text) OR app.has_permission('projekt:vertraulich'::text, 'portfolio'::text, portfolio_id))) CHECK -",
    "ppm.projekt.projekt_insert RESTRICTIVE INSERT ppm_app USING - CHECK (app.has_permission('projekt:create'::text) OR app.has_permission('projekt:create'::text, 'portfolio'::text, portfolio_id))",
    "ppm.projekt.projekt_update RESTRICTIVE UPDATE ppm_app USING (app.write_all() OR (portfolio_id = ANY (app.write_types())) OR app.has_tuple('projekt'::text, id, app.write_relations())) CHECK (app.write_all() OR (portfolio_id = ANY (app.write_types())) OR app.has_tuple('projekt'::text, id, app.write_relations()))",
    "ppm.projekt.projekt_delete RESTRICTIVE DELETE ppm_app USING (app.write_all() OR (portfolio_id = ANY (app.write_types())) OR app.has_tuple('projekt'::text, id, app.write_relations())) CHECK -",
  ],
};
