-- Zuordnung Projekt ↔ Ziel auch aus dem Projektvertrag (PP.02.05; Vertrag Kap. 2 bei der Baseline, AP-E3-1): Schreiben
-- mit ziel:write (Zielzyklus, GL) oder projekt:write am Projekt (Register des Projekts, PL und UE), Muster KIND
-- (docs/fachmodell.md 3.4). Lesen unverändert: sichtbar mit dem Projekt.

DROP POLICY ziel_projekt_insert ON ppm.ziel_projekt;
DROP POLICY ziel_projekt_update ON ppm.ziel_projekt;
DROP POLICY ziel_projekt_delete ON ppm.ziel_projekt;

CREATE POLICY ziel_projekt_insert ON ppm.ziel_projekt AS RESTRICTIVE FOR INSERT TO ppm_app
  WITH CHECK (app.has_permission('ziel:write', 'projekt', projekt_id) OR app.has_permission('projekt:write', 'projekt', projekt_id));
CREATE POLICY ziel_projekt_update ON ppm.ziel_projekt AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('ziel:write', 'projekt', projekt_id) OR app.has_permission('projekt:write', 'projekt', projekt_id))
  WITH CHECK (app.has_permission('ziel:write', 'projekt', projekt_id) OR app.has_permission('projekt:write', 'projekt', projekt_id));
CREATE POLICY ziel_projekt_delete ON ppm.ziel_projekt AS RESTRICTIVE FOR DELETE TO ppm_app
  USING (app.has_permission('ziel:write', 'projekt', projekt_id) OR app.has_permission('projekt:write', 'projekt', projekt_id));
