-- Jahresrückblick für das entscheidende Gremium (A-67; UC-013 Schritt 4 «Der PRAT wertet aus»; AP-E7-5): Beim
-- Traktandieren hält das Modul das Portfolio des PRAT fest, an dem das Traktandum liegt (Portfolio der Kategorie A, wie
-- A-56/A-61). Ab «traktandiert» lesen Personen mit sitzung:read an genau diesem Portfolio den Rückblick mit dem Stand
-- bei Traktandierung; vorher und für andere Gremien bleibt er unsichtbar.

ALTER TABLE ppm.jahresrueckblick
  ADD COLUMN gremium_portfolio_id uuid,
  ADD FOREIGN KEY (tenant_id, gremium_portfolio_id) REFERENCES ppm.portfolio (tenant_id, id) ON DELETE SET NULL (gremium_portfolio_id);

DROP POLICY jahresrueckblick_read ON ppm.jahresrueckblick;
CREATE POLICY jahresrueckblick_read ON ppm.jahresrueckblick AS RESTRICTIVE FOR SELECT TO ppm_app
  USING (app.has_permission('ziel:read') OR app.has_permission('quartalsbericht:write')
         OR (stand <> 'in_arbeit' AND gremium_portfolio_id IS NOT NULL AND app.has_permission('sitzung:read', 'portfolio', gremium_portfolio_id)));
