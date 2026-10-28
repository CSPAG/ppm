-- Änderungsantrag am Projektvertrag (docs/fachmodell.md 2.10; AP-E3-4; UC-007, PS.03.01, PS.03.02): Entscheid des
-- Sponsors an der Version (freigegeben, abgelehnt mit Begründung oder Antrag an den PRAT, UC-007 Schritt 4, A1, A2).
-- Den Entscheid des PRAT hält das Modul sitzung fest (`entscheid`); die Version trägt dann nur «an_prat».
-- Setzt 170_vertrag voraus.

ALTER TABLE ppm.vertrag_version
  ADD COLUMN entscheid             text CHECK (entscheid IN ('freigegeben', 'abgelehnt', 'an_prat')),
  ADD COLUMN entscheid_begruendung text NOT NULL DEFAULT '' CHECK (length(entscheid_begruendung) <= 5000),
  ADD COLUMN entschieden_at        timestamptz,
  ADD COLUMN entschieden_by        uuid,
  ADD CONSTRAINT vertrag_version_entscheid_check2 CHECK (entscheid IS NULL OR (anlass = 'aenderung' AND entschieden_at IS NOT NULL));

-- Folge eines Gremiumsentscheids (Traktandenart `aenderung`, fachmodell.md 2.9): Die UE erfasst den Entscheid ohne
-- `vertrag:write`; die Folge (Baseline nachführen oder Entwurf ablehnen) setzt das Modul vertrag in der Transaktion des
-- Entscheids mit `app.vertrag_intern = 'on'` (wie `app.sitzung_intern`, 130_sitzung.sql). Lesen bleibt unverändert.
DROP POLICY vertrag_version_update ON ppm.vertrag_version;
CREATE POLICY vertrag_version_update ON ppm.vertrag_version AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('vertrag:write', 'projekt', projekt_id) OR current_setting('app.vertrag_intern', true) = 'on')
  WITH CHECK (app.has_permission('vertrag:write', 'projekt', projekt_id) OR current_setting('app.vertrag_intern', true) = 'on');

DROP POLICY vertrag_kapitel_update ON ppm.vertrag_kapitel;
CREATE POLICY vertrag_kapitel_update ON ppm.vertrag_kapitel AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('vertrag:write', 'projekt', projekt_id) OR current_setting('app.vertrag_intern', true) = 'on')
  WITH CHECK (app.has_permission('vertrag:write', 'projekt', projekt_id) OR current_setting('app.vertrag_intern', true) = 'on');
