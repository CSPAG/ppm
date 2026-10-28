-- Prüfung der Projektideen (docs/fachmodell.md 2.11; AP-E4-2): Leitfragen zum Eintritt P0 (DM.01.02, UC-001 Schritt 4)
-- und Kriterienraster mit Vorschlag der Kategorie (PP.02.04, UC-001 Schritt 5; die UE entscheidet, Q8 Kap. 6, G11).
-- Kategorie, Portfolio, führende Idee und Begründung der Zurückweisung stehen schon in `idee` (220).

-- Vorschlag des Rasters und Begründung der UE, wenn ihre Wahl vom Vorschlag abweicht (K4 Regel «Kategorie widerspricht
-- dem Raster», Hinweis mit optionaler Begründung)
ALTER TABLE ppm.idee
  ADD COLUMN kategorie_vorschlag   text CHECK (kategorie_vorschlag IN ('A', 'B', 'C')),
  ADD COLUMN kategorie_begruendung text NOT NULL DEFAULT '' CHECK (length(kategorie_begruendung) <= 2000);
CREATE INDEX idee_bereiche ON ppm.idee USING gin (org_einheit_ids);

-- Antworten auf die Leitfragen zum Eintritt P0: Frage und Wertestrom als Abschrift aus der Version des Phasenmodells in
-- Kraft (die Version kann sich ändern, die Antwort bleibt nachvollziehbar); je Idee und Position eine Antwort
CREATE TABLE ppm.idee_leitfrage (
  tenant_id       uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  idee_id         uuid NOT NULL,
  position        int NOT NULL CHECK (position BETWEEN 0 AND 999),
  phasenmodell_id uuid,
  wertestrom      text NOT NULL CHECK (wertestrom ~ '^[a-z][a-z0-9_]{0,39}$'),
  frage           text NOT NULL CHECK (length(btrim(frage)) BETWEEN 1 AND 1000),
  antwort         text NOT NULL DEFAULT '' CHECK (length(antwort) <= 4000),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, idee_id, position),
  FOREIGN KEY (tenant_id, idee_id) REFERENCES ppm.idee (tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, phasenmodell_id) REFERENCES ppm.phasenmodell (tenant_id, id) ON DELETE SET NULL (phasenmodell_id)
);

-- Kriterienraster (K4 Prüfen 8): je Kriterium «hoch / mittel / tief»
CREATE TABLE ppm.idee_raster (
  tenant_id     uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  idee_id       uuid NOT NULL,
  kriterium     text NOT NULL CHECK (kriterium IN ('relevanz', 'direktionen', 'abhaengigkeiten', 'priorisierung', 'change')),
  einschaetzung text NOT NULL CHECK (einschaetzung IN ('hoch', 'mittel', 'tief')),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, idee_id, kriterium),
  FOREIGN KEY (tenant_id, idee_id) REFERENCES ppm.idee (tenant_id, id) ON DELETE CASCADE
);

SELECT app.secure_tenant_tables();

-- Lesesicht ÜBER ELTERN (fachmodell.md 3.4) mit dem Ideenpool: Leitfragen und Raster sehen nur Personen mit `idee:read` an
-- der Organisation oder am Portfolio der Idee, nicht Antragstellende (K4 Z8, darstellung.md sensible Daten); die
-- Leitfragen sieht auch der vorgesehene Sponsor. Schreiben mit `idee:write`.
CREATE POLICY idee_leitfrage_read ON ppm.idee_leitfrage AS RESTRICTIVE FOR SELECT TO ppm_app USING (
  EXISTS (SELECT 1 FROM ppm.idee i WHERE i.tenant_id = idee_leitfrage.tenant_id AND i.id = idee_leitfrage.idee_id
             AND (app.has_permission('idee:read') OR i.vorgesehener_sponsor = app.principal_id()
                  OR (i.portfolio_id IS NOT NULL AND app.has_permission('idee:read', 'portfolio', i.portfolio_id)))));
CREATE POLICY idee_leitfrage_insert ON ppm.idee_leitfrage AS RESTRICTIVE FOR INSERT TO ppm_app WITH CHECK (app.has_permission('idee:write'));
CREATE POLICY idee_leitfrage_update ON ppm.idee_leitfrage AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('idee:write')) WITH CHECK (app.has_permission('idee:write'));
CREATE POLICY idee_leitfrage_delete ON ppm.idee_leitfrage AS RESTRICTIVE FOR DELETE TO ppm_app USING (app.has_permission('idee:write'));

CREATE POLICY idee_raster_read ON ppm.idee_raster AS RESTRICTIVE FOR SELECT TO ppm_app USING (
  EXISTS (SELECT 1 FROM ppm.idee i WHERE i.tenant_id = idee_raster.tenant_id AND i.id = idee_raster.idee_id
             AND (app.has_permission('idee:read')
                  OR (i.portfolio_id IS NOT NULL AND app.has_permission('idee:read', 'portfolio', i.portfolio_id)))));
CREATE POLICY idee_raster_insert ON ppm.idee_raster AS RESTRICTIVE FOR INSERT TO ppm_app WITH CHECK (app.has_permission('idee:write'));
CREATE POLICY idee_raster_update ON ppm.idee_raster AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('idee:write')) WITH CHECK (app.has_permission('idee:write'));
CREATE POLICY idee_raster_delete ON ppm.idee_raster AS RESTRICTIVE FOR DELETE TO ppm_app USING (app.has_permission('idee:write'));
