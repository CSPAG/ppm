-- Jahresrückblick für das entscheidende Gremium (A-67; UC-013 Schritt 4 «Der PRAT wertet aus»; AP-E7-5): Ab
-- «traktandiert» lesen auch Personen mit sitzung:read am Portfolio des PRAT (Portfolio der Kategorie A, wie A-56/A-61)
-- den Rückblick mit dem Stand bei Traktandierung; vorher und für andere Gremien bleibt er unsichtbar.

DROP POLICY jahresrueckblick_read ON ppm.jahresrueckblick;
CREATE POLICY jahresrueckblick_read ON ppm.jahresrueckblick AS RESTRICTIVE FOR SELECT TO ppm_app
  USING (app.has_permission('ziel:read') OR app.has_permission('quartalsbericht:write')
         OR (stand <> 'in_arbeit' AND EXISTS (
           SELECT 1 FROM ppm.portfolio p WHERE p.kategorie = 'A' AND app.has_permission('sitzung:read', 'portfolio', p.id))));
