/** Modul portfolio (010_portfolio_projekt; AP-E0-5 ergänzt Gremien, Gremienweg, Termine und Routen). */
import type { Matrix } from './typ.ts';

export const matrix: Matrix = {
  tables: {
    portfolio: async (tx, t) => {
      await tx.query("INSERT INTO ppm.portfolio (tenant_id, kategorie, schluessel, name, pflichten) VALUES ($1, 'A', 'probe', 'Probe', true)", [t]);
      return "schluessel = 'probe'";
    },
  },
  policies: [
    // Lesesicht, Muster PORTFOLIO (fachmodell.md 3.4)
    "ppm.portfolio.portfolio_read RESTRICTIVE SELECT ppm_app USING (app.has_permission('portfolio:read'::text) OR app.has_permission('portfolio:read'::text, 'portfolio'::text, id)) CHECK -",
    "ppm.portfolio.portfolio_insert RESTRICTIVE INSERT ppm_app USING - CHECK app.has_permission('portfolio:admin'::text)",
    "ppm.portfolio.portfolio_update RESTRICTIVE UPDATE ppm_app USING app.has_permission('portfolio:admin'::text) CHECK app.has_permission('portfolio:admin'::text)",
    "ppm.portfolio.portfolio_delete RESTRICTIVE DELETE ppm_app USING app.has_permission('portfolio:admin'::text) CHECK -",
  ],
};
