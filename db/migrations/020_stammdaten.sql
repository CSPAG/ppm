-- Stammdaten der Organisation (UC-017 Schritte 1–2; docs/fachmodell.md 2.2): Organisationseinheiten mit Direktionen
-- (BC AM.02.01, A-23), Codetabellen mit Auswahlwerten (BC AM.02.02) und Feiertage für die Arbeitstage (A-43).
-- Lesesicht nach Muster ORG (fachmodell.md 3.4): lesen mit stammdaten:read, schreiben mit stammdaten:write.

-- Organisationseinheiten: Hierarchie über parent_id; Kürzel eindeutig ohne Gross/klein (A-23: Bedeutung pflegt ADM)
CREATE TABLE ppm.org_einheit (
  tenant_id  uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id         uuid NOT NULL DEFAULT gen_random_uuid(),
  parent_id  uuid,
  kuerzel    text NOT NULL CHECK (kuerzel ~ '^[[:alnum:]][[:alnum:]._-]{0,19}$'),
  name       text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  art        text NOT NULL DEFAULT 'bereich' CHECK (art IN ('direktion', 'bereich')),
  aktiv      boolean NOT NULL DEFAULT true,
  version    int NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT app.principal_id(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, parent_id) REFERENCES ppm.org_einheit (tenant_id, id),
  CHECK (parent_id IS DISTINCT FROM id)
);
CREATE UNIQUE INDEX org_einheit_kuerzel ON ppm.org_einheit (tenant_id, lower(kuerzel));
CREATE INDEX org_einheit_parent ON ppm.org_einheit (tenant_id, parent_id);

-- Codewerte: die Codetabellen selbst sind fest im Code (fachmodell.md 2.2); Werte werden deaktiviert statt gelöscht
-- (UC-017 Schritt 2), der Schlüssel bleibt fest, weil andere Tabellen ihn speichern
CREATE TABLE ppm.codewert (
  tenant_id   uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id          uuid NOT NULL DEFAULT gen_random_uuid(),
  codetabelle text NOT NULL CHECK (codetabelle IN ('projektstatus', 'trend', 'groesse', 'kategorie', 'abweichung', 'wertestrom', 'risikostufe', 'ressourcenrolle', 'idee_herkunft')),
  schluessel  text NOT NULL CHECK (schluessel ~ '^[A-Za-z0-9_]{1,40}$'),
  label       text NOT NULL CHECK (length(btrim(label)) BETWEEN 1 AND 100),
  position    int NOT NULL DEFAULT 0 CHECK (position BETWEEN 0 AND 999),
  aktiv       boolean NOT NULL DEFAULT true,
  version     int NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid DEFAULT app.principal_id(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, codetabelle, schluessel)
);
CREATE INDEX codewert_list ON ppm.codewert (tenant_id, codetabelle, position, schluessel, id);

-- Feiertage: je Datum höchstens einer; Arbeitstage = Montag bis Freitag ohne diese Tage (A-43)
CREATE TABLE ppm.feiertag (
  tenant_id  uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id         uuid NOT NULL DEFAULT gen_random_uuid(),
  datum      date NOT NULL,
  label      text NOT NULL CHECK (length(btrim(label)) BETWEEN 1 AND 100),
  version    int NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT app.principal_id(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, datum)
);

-- Version und Änderungszeit setzt die Datenbank (ETag/If-Match prüft die API über version); gemeinsam für alle drei
CREATE FUNCTION ppm.stammdaten_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = ppm, pg_temp AS $$
BEGIN
  NEW.version := OLD.version + 1;
  NEW.updated_at := now();
  NEW.updated_by := app.principal_id();
  NEW.created_at := OLD.created_at;
  NEW.created_by := OLD.created_by;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION ppm.stammdaten_touch() FROM PUBLIC;
CREATE TRIGGER org_einheit_touch BEFORE UPDATE ON ppm.org_einheit FOR EACH ROW EXECUTE FUNCTION ppm.stammdaten_touch();
CREATE TRIGGER codewert_touch BEFORE UPDATE ON ppm.codewert FOR EACH ROW EXECUTE FUNCTION ppm.stammdaten_touch();
CREATE TRIGGER feiertag_touch BEFORE UPDATE ON ppm.feiertag FOR EACH ROW EXECUTE FUNCTION ppm.stammdaten_touch();

SELECT app.secure_tenant_tables();
-- Codewerte nie löschen (UC-017 Schritt 2: deaktivieren); Schlüssel und Codetabelle bleiben nach dem Anlegen fest
REVOKE DELETE ON ppm.codewert FROM ppm_app;
REVOKE UPDATE ON ppm.codewert FROM ppm_app;
GRANT UPDATE (label, position, aktiv) ON ppm.codewert TO ppm_app;

-- Lesesicht (Muster ORG, fachmodell.md 3.4)
CREATE POLICY org_einheit_read ON ppm.org_einheit AS RESTRICTIVE FOR SELECT TO ppm_app USING (app.has_permission('stammdaten:read'));
CREATE POLICY org_einheit_insert ON ppm.org_einheit AS RESTRICTIVE FOR INSERT TO ppm_app WITH CHECK (app.has_permission('stammdaten:write'));
CREATE POLICY org_einheit_update ON ppm.org_einheit AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('stammdaten:write')) WITH CHECK (app.has_permission('stammdaten:write'));
CREATE POLICY org_einheit_delete ON ppm.org_einheit AS RESTRICTIVE FOR DELETE TO ppm_app USING (app.has_permission('stammdaten:write'));

CREATE POLICY codewert_read ON ppm.codewert AS RESTRICTIVE FOR SELECT TO ppm_app USING (app.has_permission('stammdaten:read'));
CREATE POLICY codewert_insert ON ppm.codewert AS RESTRICTIVE FOR INSERT TO ppm_app WITH CHECK (app.has_permission('stammdaten:write'));
CREATE POLICY codewert_update ON ppm.codewert AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('stammdaten:write')) WITH CHECK (app.has_permission('stammdaten:write'));

CREATE POLICY feiertag_read ON ppm.feiertag AS RESTRICTIVE FOR SELECT TO ppm_app USING (app.has_permission('stammdaten:read'));
CREATE POLICY feiertag_insert ON ppm.feiertag AS RESTRICTIVE FOR INSERT TO ppm_app WITH CHECK (app.has_permission('stammdaten:write'));
CREATE POLICY feiertag_update ON ppm.feiertag AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('stammdaten:write')) WITH CHECK (app.has_permission('stammdaten:write'));
CREATE POLICY feiertag_delete ON ppm.feiertag AS RESTRICTIVE FOR DELETE TO ppm_app USING (app.has_permission('stammdaten:write'));
