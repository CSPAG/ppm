-- Kapazitätsangebot je Rolle und Monat (BC RK.01.01 Grundfunktion, UC-009 Schritt 2; docs/fachmodell.md 2.12). Pool =
-- Rolle (A-20, Klärung K22): Die Rolle ist ein Codewert der Codetabelle `ressourcenrolle`; das Angebot ist die für
-- Vorhaben verfügbare Kapazität in FTE. Personal- und Abwesenheitsdaten aus dem HR-System (RK.01.02) folgen mit AP-E7-2.
-- Setzt nur Tabellen aus 001–069 voraus (Mandant); die Auslastung rechnet das Modul aus dem Ressourcenbedarf (060).

CREATE TABLE ppm.kapazitaet (
  tenant_id  uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id         uuid NOT NULL DEFAULT gen_random_uuid(),
  rolle      text NOT NULL CHECK (rolle ~ '^[A-Za-z0-9_]{1,40}$'),
  monat      text NOT NULL CHECK (monat ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  fte        numeric(6, 2) NOT NULL CHECK (fte >= 0 AND fte <= 1000),
  version    int NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT app.principal_id(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, rolle, monat)
);
CREATE INDEX kapazitaet_monat ON ppm.kapazitaet (tenant_id, monat, rolle);

-- Version und Änderungszeit setzt die Datenbank (If-Match je Zelle prüft die API über version)
CREATE FUNCTION ppm.kapazitaet_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = ppm, pg_temp AS $$
BEGIN
  NEW.version := OLD.version + 1;
  NEW.updated_at := now();
  NEW.updated_by := app.principal_id();
  NEW.created_at := OLD.created_at;
  NEW.created_by := OLD.created_by;
  RETURN NEW;
END $$;
CREATE TRIGGER kapazitaet_touch BEFORE UPDATE ON ppm.kapazitaet FOR EACH ROW EXECUTE FUNCTION ppm.kapazitaet_touch();
REVOKE ALL ON FUNCTION ppm.kapazitaet_touch() FROM PUBLIC;

SELECT app.secure_tenant_tables();

-- Lesesicht nach Muster ORG (docs/fachmodell.md 3.4): Recht an der Organisation
CREATE POLICY kapazitaet_read ON ppm.kapazitaet AS RESTRICTIVE FOR SELECT TO ppm_app USING (app.has_permission('ressource:read'));
CREATE POLICY kapazitaet_insert ON ppm.kapazitaet AS RESTRICTIVE FOR INSERT TO ppm_app WITH CHECK (app.has_permission('ressource:write'));
CREATE POLICY kapazitaet_update ON ppm.kapazitaet AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('ressource:write')) WITH CHECK (app.has_permission('ressource:write'));
CREATE POLICY kapazitaet_delete ON ppm.kapazitaet AS RESTRICTIVE FOR DELETE TO ppm_app USING (app.has_permission('ressource:write'));
