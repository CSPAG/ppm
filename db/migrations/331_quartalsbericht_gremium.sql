-- Quartalsreporting für das entscheidende Gremium (A-67; UC-012 Schritt 4 «PRAT verabschiedet»; AP-E6-4, ausgeführt von
-- AP-E7-5 im Auftrag der Master-Session): Beim Traktandieren hält das Modul das Portfolio des PRAT fest, an dem das
-- Traktandum liegt (Portfolio der Kategorie A, wie A-56/A-61). Ab «traktandiert» lesen Personen mit sitzung:read an genau
-- diesem Portfolio den Bericht; vorher und für andere Gremien bleibt er unsichtbar. Berichte, die vor dieser Migration
-- traktandiert wurden, haben kein Portfolio und bleiben dem Gremium verborgen.

ALTER TABLE ppm.quartalsbericht
  ADD COLUMN gremium_portfolio_id uuid,
  ADD FOREIGN KEY (tenant_id, gremium_portfolio_id) REFERENCES ppm.portfolio (tenant_id, id) ON DELETE SET NULL (gremium_portfolio_id);

DROP POLICY quartalsbericht_read ON ppm.quartalsbericht;
CREATE POLICY quartalsbericht_read ON ppm.quartalsbericht AS RESTRICTIVE FOR SELECT TO ppm_app
  USING (app.has_permission('ziel:read') OR app.has_permission('quartalsbericht:write')
         OR (stand <> 'in_arbeit' AND gremium_portfolio_id IS NOT NULL AND app.has_permission('sitzung:read', 'portfolio', gremium_portfolio_id)));
