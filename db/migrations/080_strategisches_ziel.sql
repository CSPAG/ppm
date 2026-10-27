-- Strategische Ziele je Handlungsfeld (BC ZM.01.02, UC-011 Schritt 2; docs/fachmodell.md 2.7): Mehrjahresziele als
-- Stammdaten der Organisation mit Version und Verlauf (Muster 001_handlungsfeld). Strategische Ziele sind die Ziele 2030
-- ohne Zwischenstufe (Annahme A-15, Klärung K17): Horizont mit Vorgabe 2030.
-- Nummer wie «2.1» (Ziffern mit Punkten), eindeutig in der Organisation; sortiert wird nach den Zahlen der Nummer.

CREATE TABLE ppm.strategisches_ziel (
  tenant_id        uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id               uuid NOT NULL DEFAULT gen_random_uuid(),
  handlungsfeld_id uuid NOT NULL,
  nummer           text NOT NULL CHECK (nummer ~ '^[0-9]{1,3}(\.[0-9]{1,3}){0,3}$'),
  nummer_sort      int[] GENERATED ALWAYS AS (string_to_array(nummer, '.')::int[]) STORED,
  text             text NOT NULL CHECK (length(btrim(text)) BETWEEN 1 AND 1000),
  horizont         int NOT NULL DEFAULT 2030 CHECK (horizont BETWEEN 2000 AND 2100),
  metrik           text NOT NULL DEFAULT '' CHECK (length(metrik) <= 500),
  zielwert         text NOT NULL DEFAULT '' CHECK (length(zielwert) <= 200),
  version          int NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at       timestamptz NOT NULL DEFAULT now(),
  created_by       uuid DEFAULT app.principal_id(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  updated_by       uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, id),
  -- Handlungsfeld mit Zielen lässt sich nicht löschen (409)
  FOREIGN KEY (tenant_id, handlungsfeld_id) REFERENCES ppm.handlungsfeld (tenant_id, id)
);
CREATE UNIQUE INDEX strategisches_ziel_nummer ON ppm.strategisches_ziel (tenant_id, nummer);
CREATE INDEX strategisches_ziel_list ON ppm.strategisches_ziel (tenant_id, nummer_sort, id);
CREATE INDEX strategisches_ziel_handlungsfeld ON ppm.strategisches_ziel (tenant_id, handlungsfeld_id, nummer_sort, id);

-- Verlauf: nur anhängen (Trigger schreibt, die Laufzeit darf lesen und einfügen, nie ändern oder löschen)
CREATE TABLE ppm.strategisches_ziel_version (
  tenant_id             uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  strategisches_ziel_id uuid NOT NULL,
  version               int NOT NULL,
  action                text NOT NULL CHECK (action IN ('created', 'updated', 'deleted')),
  handlungsfeld_id      uuid NOT NULL,
  nummer                text NOT NULL,
  text                  text NOT NULL,
  horizont              int NOT NULL,
  metrik                text NOT NULL,
  zielwert              text NOT NULL,
  changed_at            timestamptz NOT NULL DEFAULT now(),
  changed_by            uuid,
  PRIMARY KEY (tenant_id, strategisches_ziel_id, version)
);

CREATE FUNCTION ppm.strategisches_ziel_history() RETURNS trigger LANGUAGE plpgsql SET search_path = ppm, pg_temp AS $$
DECLARE r ppm.strategisches_ziel;
BEGIN
  r := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  INSERT INTO ppm.strategisches_ziel_version (tenant_id, strategisches_ziel_id, version, action, handlungsfeld_id, nummer, text, horizont, metrik, zielwert, changed_by)
  VALUES (r.tenant_id, r.id, CASE WHEN TG_OP = 'DELETE' THEN r.version + 1 ELSE r.version END,
          CASE TG_OP WHEN 'INSERT' THEN 'created' WHEN 'UPDATE' THEN 'updated' ELSE 'deleted' END,
          r.handlungsfeld_id, r.nummer, r.text, r.horizont, r.metrik, r.zielwert, app.principal_id());
  RETURN NULL;
END $$;
CREATE TRIGGER strategisches_ziel_history AFTER INSERT OR UPDATE OR DELETE ON ppm.strategisches_ziel
  FOR EACH ROW EXECUTE FUNCTION ppm.strategisches_ziel_history();
REVOKE ALL ON FUNCTION ppm.strategisches_ziel_history() FROM PUBLIC;

-- Version und Änderungszeit setzt die Datenbank (ETag/If-Match prüft die API über version)
CREATE FUNCTION ppm.strategisches_ziel_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = ppm, pg_temp AS $$
BEGIN
  NEW.version := OLD.version + 1;
  NEW.updated_at := now();
  NEW.updated_by := app.principal_id();
  NEW.created_at := OLD.created_at;
  NEW.created_by := OLD.created_by;
  RETURN NEW;
END $$;
CREATE TRIGGER strategisches_ziel_touch BEFORE UPDATE ON ppm.strategisches_ziel FOR EACH ROW EXECUTE FUNCTION ppm.strategisches_ziel_touch();
REVOKE ALL ON FUNCTION ppm.strategisches_ziel_touch() FROM PUBLIC;

SELECT app.secure_tenant_tables();
REVOKE UPDATE, DELETE ON ppm.strategisches_ziel_version FROM ppm_app;

-- Lesesicht nach Muster ORG (docs/fachmodell.md 3.4): Recht an der Organisation; Verlauf nach Muster STAND
CREATE POLICY strategisches_ziel_read ON ppm.strategisches_ziel AS RESTRICTIVE FOR SELECT TO ppm_app USING (app.has_permission('ziel:read'));
CREATE POLICY strategisches_ziel_insert ON ppm.strategisches_ziel AS RESTRICTIVE FOR INSERT TO ppm_app WITH CHECK (app.has_permission('ziel:write'));
CREATE POLICY strategisches_ziel_update ON ppm.strategisches_ziel AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('ziel:write')) WITH CHECK (app.has_permission('ziel:write'));
CREATE POLICY strategisches_ziel_delete ON ppm.strategisches_ziel AS RESTRICTIVE FOR DELETE TO ppm_app USING (app.has_permission('ziel:write'));

CREATE POLICY strategisches_ziel_version_read ON ppm.strategisches_ziel_version AS RESTRICTIVE FOR SELECT TO ppm_app USING (app.has_permission('ziel:read'));
