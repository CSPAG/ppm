-- Quartalsreporting für das entscheidende Gremium (A-67; UC-012 Schritt 4 «PRAT verabschiedet»; AP-E6-4, ausgeführt von
-- AP-E7-5 im Auftrag der Master-Session): Ab «traktandiert» lesen auch Personen mit sitzung:read am Portfolio des PRAT
-- (Portfolio der Kategorie A, wie A-56/A-61) den Bericht; vorher und für andere Gremien bleibt er unsichtbar.

DROP POLICY quartalsbericht_read ON ppm.quartalsbericht;
CREATE POLICY quartalsbericht_read ON ppm.quartalsbericht AS RESTRICTIVE FOR SELECT TO ppm_app
  USING (app.has_permission('ziel:read') OR app.has_permission('quartalsbericht:write')
         OR (stand <> 'in_arbeit' AND EXISTS (
           SELECT 1 FROM ppm.portfolio p WHERE p.kategorie = 'A' AND app.has_permission('sitzung:read', 'portfolio', p.id))));
