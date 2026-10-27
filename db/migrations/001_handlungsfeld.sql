-- Strategische Handlungsfelder (BC ZM.01.01, Q9 S. 9–11): oberste Ordnung für Ziele und Vorhaben, je Handlungsfeld
-- Leitsatz und Stossrichtungen. Stammdaten der Organisation mit Version und Verlauf; Muster für alle Module.
-- Warteschlange, Idempotenz und Outbox legt platform_001_core.sql an (vor dieser Migration).

CREATE TABLE ppm.handlungsfeld (
  tenant_id       uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id              uuid NOT NULL DEFAULT gen_random_uuid(),
  label           text NOT NULL CHECK (length(btrim(label)) BETWEEN 1 AND 200),
  leitsatz        text NOT NULL DEFAULT '' CHECK (length(leitsatz) <= 2000),
  stossrichtungen text[] NOT NULL DEFAULT '{}' CHECK (cardinality(stossrichtungen) <= 20),
  position        int NOT NULL DEFAULT 0 CHECK (position BETWEEN 0 AND 999),
  version         int NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid DEFAULT app.principal_id(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, id)
);
CREATE UNIQUE INDEX handlungsfeld_label ON ppm.handlungsfeld (tenant_id, lower(label));
CREATE INDEX handlungsfeld_list ON ppm.handlungsfeld (tenant_id, position, label, id);

-- Verlauf: nur anhängen (Trigger schreibt, die Laufzeit darf lesen und einfügen, nie ändern oder löschen)
CREATE TABLE ppm.handlungsfeld_version (
  tenant_id        uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  handlungsfeld_id uuid NOT NULL,
  version          int NOT NULL,
  action           text NOT NULL CHECK (action IN ('created', 'updated', 'deleted')),
  label            text NOT NULL,
  leitsatz         text NOT NULL,
  stossrichtungen  text[] NOT NULL,
  position         int NOT NULL,
  changed_at       timestamptz NOT NULL DEFAULT now(),
  changed_by       uuid,
  PRIMARY KEY (tenant_id, handlungsfeld_id, version)
);

CREATE FUNCTION ppm.handlungsfeld_history() RETURNS trigger LANGUAGE plpgsql SET search_path = ppm, pg_temp AS $$
DECLARE r ppm.handlungsfeld;
BEGIN
  r := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  INSERT INTO ppm.handlungsfeld_version (tenant_id, handlungsfeld_id, version, action, label, leitsatz, stossrichtungen, position, changed_by)
  VALUES (r.tenant_id, r.id, CASE WHEN TG_OP = 'DELETE' THEN r.version + 1 ELSE r.version END,
          CASE TG_OP WHEN 'INSERT' THEN 'created' WHEN 'UPDATE' THEN 'updated' ELSE 'deleted' END,
          r.label, r.leitsatz, r.stossrichtungen, r.position, app.principal_id());
  RETURN NULL;
END $$;
CREATE TRIGGER handlungsfeld_history AFTER INSERT OR UPDATE OR DELETE ON ppm.handlungsfeld
  FOR EACH ROW EXECUTE FUNCTION ppm.handlungsfeld_history();
REVOKE ALL ON FUNCTION ppm.handlungsfeld_history() FROM PUBLIC;

-- Version und Änderungszeit setzt die Datenbank (ETag/If-Match prüft die API über version)
CREATE FUNCTION ppm.handlungsfeld_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = ppm, pg_temp AS $$
BEGIN
  NEW.version := OLD.version + 1;
  NEW.updated_at := now();
  NEW.updated_by := app.principal_id();
  NEW.created_at := OLD.created_at;
  NEW.created_by := OLD.created_by;
  RETURN NEW;
END $$;
CREATE TRIGGER handlungsfeld_touch BEFORE UPDATE ON ppm.handlungsfeld FOR EACH ROW EXECUTE FUNCTION ppm.handlungsfeld_touch();
REVOKE ALL ON FUNCTION ppm.handlungsfeld_touch() FROM PUBLIC;

SELECT app.secure_tenant_tables();
REVOKE UPDATE, DELETE ON ppm.handlungsfeld_version FROM ppm_app;

-- Lesesicht (identity-kit 7.6): Recht an der Organisation (Rolle ∩ Scope, app.has_permission aus iam_018);
-- Handlungsfelder sind kein Typ im Modell und haben keine Freigaben je Objekt
CREATE POLICY handlungsfeld_read ON ppm.handlungsfeld AS RESTRICTIVE FOR SELECT TO ppm_app USING (app.has_permission('handlungsfeld:read'));
CREATE POLICY handlungsfeld_insert ON ppm.handlungsfeld AS RESTRICTIVE FOR INSERT TO ppm_app WITH CHECK (app.has_permission('handlungsfeld:write'));
CREATE POLICY handlungsfeld_update ON ppm.handlungsfeld AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('handlungsfeld:write')) WITH CHECK (app.has_permission('handlungsfeld:write'));
CREATE POLICY handlungsfeld_delete ON ppm.handlungsfeld AS RESTRICTIVE FOR DELETE TO ppm_app USING (app.has_permission('handlungsfeld:delete'));

CREATE POLICY handlungsfeld_version_read ON ppm.handlungsfeld_version AS RESTRICTIVE FOR SELECT TO ppm_app USING (app.has_permission('handlungsfeld:read'));
