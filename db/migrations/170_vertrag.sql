-- Projektvertrag (docs/fachmodell.md 2.10; AP-E3-1): Versionen mit Anlass, Zielphase, Bearbeitungsstand und Baseline
-- (DM.02.01–03, PS.02.05) und die Kapitel 1–13 der Vorlage (Q7) als Daten je Version. Quality-Check, Unterschriften,
-- Gate-Antrag, Leitfragen, Nutzenprüfung und Beilagen-Dateien folgen in den Paketen AP-E3-2 bis AP-E3-5 (180–219).
-- Setzt nur Tabellen aus 010 voraus (ppm.projekt, Hilfsfunktionen der Lesesicht).

-- Version des Vertrags: «0.1» für den ersten Entwurf (UC-002 Schritt 1), danach fortgeschrieben (UC-003, UC-007).
-- Höchstens ein Entwurf je Projekt (UX-E5, A-29), höchstens eine Baseline (die abgenommene, verbindliche Version).
CREATE TABLE ppm.vertrag_version (
  tenant_id        uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id               uuid NOT NULL DEFAULT gen_random_uuid(),
  projekt_id       uuid NOT NULL,
  nummer           text NOT NULL CHECK (nummer ~ '^[0-9]{1,3}\.[0-9]{1,3}$'),
  anlass           text NOT NULL CHECK (anlass IN ('initial', 'gate', 'aenderung')),
  zielphase        text NOT NULL CHECK (zielphase IN ('P0', 'P1', 'P2', 'P3', 'P4')),
  stand            text NOT NULL DEFAULT 'in_arbeit' CHECK (stand IN (
                     'in_arbeit', 'in_pruefung', 'zur_unterzeichnung', 'unterzeichnet', 'traktandiert', 'abgenommen', 'abgelehnt',
                     'verworfen', 'zurueckgezogen')),
  baseline         boolean NOT NULL DEFAULT false,
  baseline_at      timestamptz,
  basis_version_id uuid,
  hauptaenderungen jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(hauptaenderungen) = 'object'),
  andere           text NOT NULL DEFAULT '' CHECK (length(andere) <= 5000),
  begruendung      text NOT NULL DEFAULT '' CHECK (length(begruendung) <= 5000),
  eingereicht_at   timestamptz,
  eingereicht_by   uuid,
  version          int NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at       timestamptz NOT NULL DEFAULT now(),
  created_by       uuid DEFAULT app.principal_id(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  updated_by       uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, id, projekt_id),
  UNIQUE (tenant_id, projekt_id, nummer),
  FOREIGN KEY (tenant_id, projekt_id) REFERENCES ppm.projekt (tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, basis_version_id, projekt_id) REFERENCES ppm.vertrag_version (tenant_id, id, projekt_id),
  CHECK (NOT baseline OR (stand = 'abgenommen' AND baseline_at IS NOT NULL))
);
-- Entwurf = jede Version, die noch nicht entschieden ist
CREATE UNIQUE INDEX vertrag_version_entwurf ON ppm.vertrag_version (tenant_id, projekt_id)
  WHERE stand IN ('in_arbeit', 'in_pruefung', 'zur_unterzeichnung', 'unterzeichnet', 'traktandiert');
CREATE UNIQUE INDEX vertrag_version_baseline ON ppm.vertrag_version (tenant_id, projekt_id) WHERE baseline;

-- Kapitel 1–13 einer Version (Q7): Inhalt nach dem Schema des Kapitels (Modul vertrag, `kapitel.ts`), Listen wie
-- Meilensteine, Kosten und Risiken als Teil des Kapitels; `geaendert` gegenüber der Basisversion (K2 Schritt 2).
-- Das Projekt steht mit, damit die Policy ohne Umweg prüft.
CREATE TABLE ppm.vertrag_kapitel (
  tenant_id  uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  projekt_id uuid NOT NULL,
  version_id uuid NOT NULL,
  kapitel    int NOT NULL CHECK (kapitel BETWEEN 1 AND 13),
  inhalt     jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(inhalt) = 'object'),
  geaendert  boolean NOT NULL DEFAULT false,
  version    int NOT NULL DEFAULT 1 CHECK (version >= 1),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, version_id, kapitel),
  FOREIGN KEY (tenant_id, version_id, projekt_id) REFERENCES ppm.vertrag_version (tenant_id, id, projekt_id) ON DELETE CASCADE
);

-- Version und Änderungszeit setzt die Datenbank (ETag/If-Match über version)
CREATE FUNCTION ppm.vertrag_version_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = ppm, pg_temp AS $$
BEGIN
  NEW.version := OLD.version + 1;
  NEW.updated_at := now();
  NEW.updated_by := app.principal_id();
  NEW.created_at := OLD.created_at;
  NEW.created_by := OLD.created_by;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION ppm.vertrag_version_touch() FROM PUBLIC;
CREATE TRIGGER vertrag_version_touch BEFORE UPDATE ON ppm.vertrag_version FOR EACH ROW EXECUTE FUNCTION ppm.vertrag_version_touch();

CREATE FUNCTION ppm.vertrag_kapitel_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = ppm, pg_temp AS $$
BEGIN
  NEW.version := OLD.version + 1;
  NEW.updated_at := now();
  NEW.updated_by := app.principal_id();
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION ppm.vertrag_kapitel_touch() FROM PUBLIC;
CREATE TRIGGER vertrag_kapitel_touch BEFORE UPDATE ON ppm.vertrag_kapitel FOR EACH ROW EXECUTE FUNCTION ppm.vertrag_kapitel_touch();

SELECT app.secure_tenant_tables();
-- Versionen sind die Geschichte des Vertrags: nie löschen (verworfen und zurückgezogen sind Bearbeitungsstände)
REVOKE DELETE ON ppm.vertrag_version, ppm.vertrag_kapitel FROM ppm_app;

-- Lesesicht (fachmodell.md 3.4), Muster ÜBER ELTERN mit dem Projekt als Eltern: lesen, wer das Projekt sieht;
-- schreiben mit vertrag:write am Projekt (Rolle an der Organisation oder am Projekt)
CREATE POLICY vertrag_version_read ON ppm.vertrag_version AS RESTRICTIVE FOR SELECT TO ppm_app USING (ppm.projekt_sichtbar(projekt_id));
CREATE POLICY vertrag_version_insert ON ppm.vertrag_version AS RESTRICTIVE FOR INSERT TO ppm_app
  WITH CHECK (app.has_permission('vertrag:write', 'projekt', projekt_id));
CREATE POLICY vertrag_version_update ON ppm.vertrag_version AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('vertrag:write', 'projekt', projekt_id)) WITH CHECK (app.has_permission('vertrag:write', 'projekt', projekt_id));

CREATE POLICY vertrag_kapitel_read ON ppm.vertrag_kapitel AS RESTRICTIVE FOR SELECT TO ppm_app USING (ppm.projekt_sichtbar(projekt_id));
CREATE POLICY vertrag_kapitel_insert ON ppm.vertrag_kapitel AS RESTRICTIVE FOR INSERT TO ppm_app
  WITH CHECK (app.has_permission('vertrag:write', 'projekt', projekt_id));
CREATE POLICY vertrag_kapitel_update ON ppm.vertrag_kapitel AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('vertrag:write', 'projekt', projekt_id)) WITH CHECK (app.has_permission('vertrag:write', 'projekt', projekt_id));
