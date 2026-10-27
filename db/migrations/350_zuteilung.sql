-- Zuteilung von Personen zum Ressourcenbedarf (BC RK.02.02, RK.02.03; UC-009 Schritte 3–4, A1, A2; docs/fachmodell.md
-- 2.12; AP-E7-2): je Bedarf, Person und Monat ein Anteil in FTE. Ungedeckter Bedarf (UC-009 A2) als Meldung der Lücke.
-- Setzt 010 (Projekt), 060 (Ressourcenbedarf) und die Personen des Baukastens voraus.

CREATE TABLE ppm.zuteilung (
  tenant_id           uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id                  uuid NOT NULL DEFAULT gen_random_uuid(),
  ressourcenbedarf_id uuid NOT NULL,
  -- Projekt des Bedarfs (für die Lesesicht der Projektleitung); setzt das Modul beim Anlegen aus dem Bedarf
  projekt_id          uuid NOT NULL,
  person_id           uuid NOT NULL,
  monat               text NOT NULL CHECK (monat ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  -- Anteil einer Person in einem Monat: höchstens eine volle Stelle je Zuteilung
  fte                 numeric(4, 2) NOT NULL CHECK (fte > 0 AND fte <= 1),
  version             int NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid DEFAULT app.principal_id(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  updated_by          uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, ressourcenbedarf_id) REFERENCES ppm.ressourcenbedarf (tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, projekt_id) REFERENCES ppm.projekt (tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, person_id) REFERENCES ppm.principal (tenant_id, id),
  UNIQUE (tenant_id, ressourcenbedarf_id, person_id, monat)
);
CREATE INDEX zuteilung_person ON ppm.zuteilung (tenant_id, person_id, monat);
CREATE INDEX zuteilung_monat ON ppm.zuteilung (tenant_id, monat);

-- Lücke: Bedarf nicht deckbar, von RM gemeldet (UC-009 A2.1); höchstens eine je Bedarf
CREATE TABLE ppm.zuteilung_luecke (
  tenant_id           uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id                  uuid NOT NULL DEFAULT gen_random_uuid(),
  ressourcenbedarf_id uuid NOT NULL,
  projekt_id          uuid NOT NULL,
  text                text NOT NULL DEFAULT '' CHECK (length(text) <= 1000),
  gemeldet_at         timestamptz NOT NULL DEFAULT now(),
  gemeldet_by         uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, ressourcenbedarf_id) REFERENCES ppm.ressourcenbedarf (tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, projekt_id) REFERENCES ppm.projekt (tenant_id, id) ON DELETE CASCADE,
  UNIQUE (tenant_id, ressourcenbedarf_id)
);

CREATE FUNCTION ppm.zuteilung_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = ppm, pg_temp AS $$
BEGIN
  NEW.version := OLD.version + 1;
  NEW.updated_at := now();
  NEW.updated_by := app.principal_id();
  NEW.created_at := OLD.created_at;
  NEW.created_by := OLD.created_by;
  RETURN NEW;
END $$;
CREATE TRIGGER zuteilung_touch BEFORE UPDATE ON ppm.zuteilung FOR EACH ROW EXECUTE FUNCTION ppm.zuteilung_touch();
REVOKE ALL ON FUNCTION ppm.zuteilung_touch() FROM PUBLIC;

SELECT app.secure_tenant_tables();
-- Eine Meldung wird ersetzt (löschen und neu), nie geändert
REVOKE UPDATE ON ppm.zuteilung_luecke FROM ppm_app;

-- Lesesicht (fachmodell.md 3.4, darstellung.md «Zuteilung und Auslastung einzelner Personen»): RM und UE
-- (ressource:read), die Person selbst und die Projektleitung des Projekts (projekt:write am Projekt); übrige sehen nur
-- Summen je Rolle (Auslastung). Schreiben nur mit ressource:write (RM).
CREATE POLICY zuteilung_read ON ppm.zuteilung AS RESTRICTIVE FOR SELECT TO ppm_app USING (
  app.has_permission('ressource:read') OR person_id = app.principal_id() OR app.has_permission('projekt:write', 'projekt', projekt_id));
CREATE POLICY zuteilung_insert ON ppm.zuteilung AS RESTRICTIVE FOR INSERT TO ppm_app WITH CHECK (app.has_permission('ressource:write'));
CREATE POLICY zuteilung_update ON ppm.zuteilung AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('ressource:write')) WITH CHECK (app.has_permission('ressource:write'));
CREATE POLICY zuteilung_delete ON ppm.zuteilung AS RESTRICTIVE FOR DELETE TO ppm_app USING (app.has_permission('ressource:write'));

-- Lücke: sichtbar, wer das Projekt sieht (Dashboard und Priorisierung, UC-009 A2.1), gemeldet von RM
CREATE POLICY zuteilung_luecke_read ON ppm.zuteilung_luecke AS RESTRICTIVE FOR SELECT TO ppm_app USING (ppm.projekt_sichtbar(projekt_id));
CREATE POLICY zuteilung_luecke_insert ON ppm.zuteilung_luecke AS RESTRICTIVE FOR INSERT TO ppm_app WITH CHECK (app.has_permission('ressource:write'));
CREATE POLICY zuteilung_luecke_delete ON ppm.zuteilung_luecke AS RESTRICTIVE FOR DELETE TO ppm_app USING (app.has_permission('ressource:write'));

-- «gedeckt» am Ressourcenbedarf führt das Modul ressource nach (fachmodell.md 2.6, RK.02.04): Ändern auch mit
-- ressource:write; alle anderen Felder ändert nur die Route des Registers (projekt:write)
ALTER POLICY ressourcenbedarf_update ON ppm.ressourcenbedarf
  USING (app.has_permission('projekt:write', 'projekt', projekt_id) OR app.has_permission('ressource:write'))
  WITH CHECK (app.has_permission('projekt:write', 'projekt', projekt_id) OR app.has_permission('ressource:write'));
