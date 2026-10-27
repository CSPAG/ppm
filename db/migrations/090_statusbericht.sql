-- Monatlicher Statusbericht (BC PS.01.01, UC-004; Kernablauf K1; docs/fachmodell.md 2.8, 2.14): Periode des
-- Monatszyklus und Statusbericht je Projekt und Periode mit Bearbeitungsstand. Prüfung, Rückfrage, Monatsabschluss
-- und Dashboard-Stand ergänzt AP-E1-2 (100–109), Eskalation AP-E2-4 (160–169).

-- Periode 'YYYY-MM' (I-N5). Entsteht offen mit dem ersten Bericht der Periode; abschliessen nur mit periode:close
-- (UC-005 Schritt 5, AP-E1-2); danach gesperrt (Z9).
CREATE TABLE ppm.periode (
  tenant_id         uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  periode           text NOT NULL CHECK (periode ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  stand             text NOT NULL DEFAULT 'offen' CHECK (stand IN ('offen', 'abgeschlossen')),
  abgeschlossen_at  timestamptz,
  abgeschlossen_by  uuid,
  version           int NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at        timestamptz NOT NULL DEFAULT now(),
  created_by        uuid DEFAULT app.principal_id(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  updated_by        uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, periode),
  CHECK ((stand = 'abgeschlossen') = (abgeschlossen_at IS NOT NULL))
);

CREATE TABLE ppm.statusbericht (
  tenant_id             uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id                    uuid NOT NULL DEFAULT gen_random_uuid(),
  projekt_id            uuid NOT NULL,
  periode               text NOT NULL,
  -- monatlich (Berichtsaufgabe) oder ausserordentlich (Meldung ausserhalb des Rhythmus, UC-004 Ausgangslage, K1 Einstieg)
  anlass                text NOT NULL DEFAULT 'monatlich' CHECK (anlass IN ('monatlich', 'ausserordentlich')),
  -- Bearbeitungsstand: feste Zustände des Ablaufs (K1); geprüft und zurückgegeben setzt die Prüfung (AP-E1-2)
  stand                 text NOT NULL DEFAULT 'entwurf' CHECK (stand IN ('entwurf', 'eingereicht', 'zurueckgegeben', 'geprueft')),
  -- Codewerte (Projektstatus, Trend); «kritisch» hat Folgen (Begründung, Massnahme, UC-004 A2), daher fest
  status                text CHECK (status IN ('im_plan', 'kritisch')),
  trend                 text CHECK (trend ~ '^[a-z0-9_]{1,40}$'),
  -- Phase des Projekts beim Speichern (UC-004 Schritt 1)
  phase                 text NOT NULL CHECK (phase IN ('P0', 'P1', 'P2', 'P3', 'P4')),
  abschluss_per         date,
  naechster_meilenstein text NOT NULL DEFAULT '' CHECK (length(naechster_meilenstein) <= 500),
  -- je Dimension (inhalt, termin, ressourcen, budget) {stufe, kommentar}; Skala keine/gering/wesentlich (A-38, UX-OF-17)
  abweichung            jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(abweichung) = 'object'),
  abhaengigkeiten       text NOT NULL DEFAULT '' CHECK (length(abhaengigkeiten) <= 4000),
  entscheide            text NOT NULL DEFAULT '' CHECK (length(entscheide) <= 4000),
  begruendung           text NOT NULL DEFAULT '' CHECK (length(begruendung) <= 4000),
  massnahme             text NOT NULL DEFAULT '' CHECK (length(massnahme) <= 4000),
  entscheid_noetig      boolean NOT NULL DEFAULT false,
  eingereicht_at        timestamptz,
  eingereicht_by        uuid,
  geprueft_at           timestamptz,
  geprueft_by           uuid,
  version               int NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at            timestamptz NOT NULL DEFAULT now(),
  created_by            uuid DEFAULT app.principal_id(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  updated_by            uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, projekt_id) REFERENCES ppm.projekt (tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, periode) REFERENCES ppm.periode (tenant_id, periode),
  -- Eingereicht, zurückgegeben und geprüft sind eingereichte Berichte (Zeitpunkt der Meldung)
  CHECK ((stand = 'entwurf') = (eingereicht_at IS NULL)),
  -- Kritisch nur mit Begründung und Massnahme (UC-004 A2), sobald eingereicht
  CHECK (stand = 'entwurf' OR status IS DISTINCT FROM 'kritisch' OR (btrim(begruendung) <> '' AND btrim(massnahme) <> ''))
);
-- Ein Bericht je Projekt und Periode (docs/fachmodell.md 2.8)
CREATE UNIQUE INDEX statusbericht_periode ON ppm.statusbericht (tenant_id, projekt_id, periode);
CREATE INDEX statusbericht_periode_stand ON ppm.statusbericht (tenant_id, periode, stand);

-- Version und Änderungszeit setzt die Datenbank (ETag/If-Match über version)
CREATE FUNCTION ppm.periode_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = ppm, pg_temp AS $$
BEGIN
  NEW.version := OLD.version + 1;
  NEW.updated_at := now();
  NEW.updated_by := app.principal_id();
  NEW.created_at := OLD.created_at;
  NEW.created_by := OLD.created_by;
  RETURN NEW;
END $$;
CREATE TRIGGER periode_touch BEFORE UPDATE ON ppm.periode FOR EACH ROW EXECUTE FUNCTION ppm.periode_touch();
REVOKE ALL ON FUNCTION ppm.periode_touch() FROM PUBLIC;

CREATE FUNCTION ppm.statusbericht_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = ppm, pg_temp AS $$
BEGIN
  NEW.version := OLD.version + 1;
  NEW.updated_at := now();
  NEW.updated_by := app.principal_id();
  NEW.created_at := OLD.created_at;
  NEW.created_by := OLD.created_by;
  NEW.projekt_id := OLD.projekt_id;
  NEW.periode := OLD.periode;
  RETURN NEW;
END $$;
CREATE TRIGGER statusbericht_touch BEFORE UPDATE ON ppm.statusbericht FOR EACH ROW EXECUTE FUNCTION ppm.statusbericht_touch();
REVOKE ALL ON FUNCTION ppm.statusbericht_touch() FROM PUBLIC;

SELECT app.secure_tenant_tables();
-- Perioden und Berichte werden nie gelöscht (Stand der Periode, Nachvollziehbarkeit); mit dem Projekt entfallen sie
REVOKE DELETE ON ppm.periode, ppm.statusbericht FROM ppm_app;

-- Lesesicht (docs/fachmodell.md 3.4)
-- Periode, Muster ORG: Den Stand der Periode (offen, abgeschlossen) sehen alle Personen der Organisation, auch die
-- Projektleitung mit Rolle nur am Projekt; er enthält keine Projektdaten. Offen anlegen darf, wer einen Bericht speichert
-- (die API prüft statusbericht:write), abschliessen nur periode:close.
CREATE POLICY periode_insert ON ppm.periode AS RESTRICTIVE FOR INSERT TO ppm_app WITH CHECK (stand = 'offen');
CREATE POLICY periode_update ON ppm.periode AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('periode:close')) WITH CHECK (app.has_permission('periode:close'));

-- Statusbericht, Muster KIND: lesen, wer das Projekt sieht; schreiben mit statusbericht:write (Organisation oder Rolle am
-- Projekt), prüfen mit statusbericht:review (Organisation oder Portfolio, AP-E1-2)
CREATE POLICY statusbericht_read ON ppm.statusbericht AS RESTRICTIVE FOR SELECT TO ppm_app USING (ppm.projekt_sichtbar(projekt_id));
CREATE POLICY statusbericht_insert ON ppm.statusbericht AS RESTRICTIVE FOR INSERT TO ppm_app
  WITH CHECK (app.has_permission('statusbericht:write', 'projekt', projekt_id));
CREATE POLICY statusbericht_update ON ppm.statusbericht AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('statusbericht:write', 'projekt', projekt_id)
         OR app.has_permission('statusbericht:review', 'portfolio', ppm.portfolio_von(projekt_id)))
  WITH CHECK (app.has_permission('statusbericht:write', 'projekt', projekt_id)
              OR app.has_permission('statusbericht:review', 'portfolio', ppm.portfolio_von(projekt_id)));
