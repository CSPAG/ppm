-- Quartalsreporting an den VR (BC ZM.03.02, PC.04.02; UC-012 Schritte 3–6, A1; UC-006 A4; Kernablauf K6 Schritte 11–14;
-- docs/fachmodell.md 2.7; AP-E6-4): Bericht je Quartal aus Zielerreichung, Portfolioberichten und den an den VR
-- weitergeleiteten Geschäften, Kommentare der UE, Rückmeldungen und Aufträge des VR. Ausserordentliche Weiterleitungen
-- an den VR ausserhalb des Quartalsreportings erfasst die UE (A-03).

CREATE TABLE ppm.quartalsbericht (
  tenant_id         uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id                uuid NOT NULL DEFAULT gen_random_uuid(),
  -- «2026-Q3» (2.14 Perioden und Fristen)
  quartal           text NOT NULL CHECK (quartal ~ '^[0-9]{4}-Q[1-4]$'),
  stand             text NOT NULL DEFAULT 'in_arbeit' CHECK (stand IN ('in_arbeit', 'traktandiert', 'verabschiedet')),
  -- Stand bei Erzeugung (Zielerreichung, Portfolioberichte, Weiterleitungen); Oberfläche und Dokument lesen nur ihn
  inhalt            jsonb NOT NULL CHECK (jsonb_typeof(inhalt) = 'object'),
  erzeugt_at        timestamptz NOT NULL DEFAULT now(),
  -- Kommentare der UE je Abschnitt (UC-012 Schritt 4)
  kommentare        jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(kommentare) = 'object' AND length(kommentare::text) <= 40000),
  -- Rückmeldungen des PRAT bei «Anpassungen verlangt» (A1.1)
  rueckmeldung_prat text NOT NULL DEFAULT '' CHECK (length(rueckmeldung_prat) <= 4000),
  traktandiert_at   timestamptz,
  verabschiedet_at  timestamptz,
  -- Rückmeldung des VR (UC-012 Schritt 6)
  vr_rueckmeldung   text NOT NULL DEFAULT '' CHECK (length(vr_rueckmeldung) <= 8000),
  vr_rueckmeldung_at timestamptz,
  version           int NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at        timestamptz NOT NULL DEFAULT now(),
  created_by        uuid DEFAULT app.principal_id(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  updated_by        uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, quartal),
  CHECK (stand <> 'verabschiedet' OR verabschiedet_at IS NOT NULL)
);

-- Aufträge des VR mit Verantwortlichen und Termin; jeder Auftrag ist eine Aufgabe im Eingang der Person
CREATE TABLE ppm.quartalsbericht_auftrag (
  tenant_id          uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id                 uuid NOT NULL DEFAULT gen_random_uuid(),
  quartalsbericht_id uuid NOT NULL,
  text               text NOT NULL CHECK (length(btrim(text)) BETWEEN 1 AND 2000),
  verantwortlich     uuid NOT NULL,
  termin             date,
  erledigt_at        timestamptz,
  erledigt_by        uuid,
  created_at         timestamptz NOT NULL DEFAULT now(),
  created_by         uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, quartalsbericht_id) REFERENCES ppm.quartalsbericht (tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, verantwortlich) REFERENCES ppm.principal (tenant_id, id)
);
CREATE INDEX quartalsbericht_auftrag_bericht ON ppm.quartalsbericht_auftrag (tenant_id, quartalsbericht_id);

-- Ausserordentliche Weiterleitung eines Geschäfts an den VR ausserhalb des Quartalsreportings (A-03, K03): je Entscheid
-- höchstens eine; das Quartalsreporting nennt sie mit Datum
CREATE TABLE ppm.vr_weiterleitung (
  tenant_id       uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  entscheid_id    uuid NOT NULL,
  weitergeleitet_am date NOT NULL,
  bemerkung       text NOT NULL DEFAULT '' CHECK (length(bemerkung) <= 2000),
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, entscheid_id),
  FOREIGN KEY (tenant_id, entscheid_id) REFERENCES ppm.entscheid (tenant_id, id) ON DELETE CASCADE
);

-- Version und Zeitpunkt der Änderung setzt die Datenbank (ETag/If-Match über version)
CREATE FUNCTION ppm.quartalsbericht_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = ppm, pg_temp AS $$
BEGIN
  NEW.version := OLD.version + 1;
  NEW.updated_at := now();
  NEW.updated_by := app.principal_id();
  NEW.created_at := OLD.created_at;
  NEW.created_by := OLD.created_by;
  RETURN NEW;
END $$;
CREATE TRIGGER quartalsbericht_touch BEFORE UPDATE ON ppm.quartalsbericht FOR EACH ROW EXECUTE FUNCTION ppm.quartalsbericht_touch();
REVOKE ALL ON FUNCTION ppm.quartalsbericht_touch() FROM PUBLIC;

SELECT app.secure_tenant_tables();

-- Lesesicht nach Muster ORG (docs/fachmodell.md 3.4): lesen mit ziel:read, schreiben mit quartalsbericht:write (UE)
CREATE POLICY quartalsbericht_read ON ppm.quartalsbericht AS RESTRICTIVE FOR SELECT TO ppm_app
  USING (app.has_permission('ziel:read') OR app.has_permission('quartalsbericht:write'));
CREATE POLICY quartalsbericht_insert ON ppm.quartalsbericht AS RESTRICTIVE FOR INSERT TO ppm_app
  WITH CHECK (app.has_permission('quartalsbericht:write'));
CREATE POLICY quartalsbericht_update ON ppm.quartalsbericht AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('quartalsbericht:write')) WITH CHECK (app.has_permission('quartalsbericht:write'));
CREATE POLICY quartalsbericht_delete ON ppm.quartalsbericht AS RESTRICTIVE FOR DELETE TO ppm_app
  USING (stand = 'in_arbeit' AND app.has_permission('quartalsbericht:write'));

-- Aufträge: sichtbar mit dem Bericht oder für die verantwortliche Person; erledigen die Person oder die UE
CREATE POLICY quartalsbericht_auftrag_read ON ppm.quartalsbericht_auftrag AS RESTRICTIVE FOR SELECT TO ppm_app
  USING (verantwortlich = app.principal_id() OR EXISTS (
    SELECT 1 FROM ppm.quartalsbericht q WHERE q.tenant_id = quartalsbericht_auftrag.tenant_id AND q.id = quartalsbericht_auftrag.quartalsbericht_id));
CREATE POLICY quartalsbericht_auftrag_insert ON ppm.quartalsbericht_auftrag AS RESTRICTIVE FOR INSERT TO ppm_app
  WITH CHECK (app.has_permission('quartalsbericht:write'));
CREATE POLICY quartalsbericht_auftrag_update ON ppm.quartalsbericht_auftrag AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (verantwortlich = app.principal_id() OR app.has_permission('quartalsbericht:write'))
  WITH CHECK (verantwortlich = app.principal_id() OR app.has_permission('quartalsbericht:write'));
CREATE POLICY quartalsbericht_auftrag_delete ON ppm.quartalsbericht_auftrag AS RESTRICTIVE FOR DELETE TO ppm_app
  USING (erledigt_at IS NULL AND app.has_permission('quartalsbericht:write'));

-- Weiterleitungen: lesen mit ziel:read wie der Bericht, erfassen die UE
CREATE POLICY vr_weiterleitung_read ON ppm.vr_weiterleitung AS RESTRICTIVE FOR SELECT TO ppm_app
  USING (app.has_permission('ziel:read') OR app.has_permission('quartalsbericht:write'));
CREATE POLICY vr_weiterleitung_insert ON ppm.vr_weiterleitung AS RESTRICTIVE FOR INSERT TO ppm_app
  WITH CHECK (app.has_permission('quartalsbericht:write'));
CREATE POLICY vr_weiterleitung_delete ON ppm.vr_weiterleitung AS RESTRICTIVE FOR DELETE TO ppm_app
  USING (app.has_permission('quartalsbericht:write'));

-- Eine Weiterleitung wird nicht geändert, nur erfasst oder entfernt
REVOKE UPDATE ON ppm.vr_weiterleitung FROM ppm_app;
