-- Projekt (docs/fachmodell.md 2.5; AP-E0-4): Ergänzung der Kerntabelle aus 010 um Federführung, Handlungsfeld und
-- Phasenmodell, Projektorganisation (PP.04.04, UC-002 Schritt 2) und Verlauf von Phase und Lebenszyklus.

-- Federführende Organisationseinheit (stammdaten, AM.02.01), Handlungsfeld (ZM.01.01) und Version des Phasenmodells, nach
-- der das Projekt läuft (nachgeführt beim Gate-Entscheid, A-13)
ALTER TABLE ppm.projekt
  ADD COLUMN org_einheit_id   uuid,
  ADD COLUMN handlungsfeld_id uuid,
  ADD COLUMN phasenmodell_id  uuid,
  ADD FOREIGN KEY (tenant_id, org_einheit_id) REFERENCES ppm.org_einheit (tenant_id, id) ON DELETE SET NULL (org_einheit_id),
  ADD FOREIGN KEY (tenant_id, handlungsfeld_id) REFERENCES ppm.handlungsfeld (tenant_id, id) ON DELETE SET NULL (handlungsfeld_id);
CREATE INDEX projekt_handlungsfeld ON ppm.projekt (tenant_id, handlungsfeld_id) WHERE handlungsfeld_id IS NOT NULL;

-- Projektorganisation (PP.04.04, Q7 Kap. 8): Sponsor, Projektleitung, CTL, Kernteam mit AKV und die Sponsoren-Koalition
-- als Liste (A-04). Die Rollen sp, pl, ctl, kt setzt das Modul zusätzlich als Tupel am Projekt (fachmodell.md 3.3).
CREATE TABLE ppm.projekt_person (
  tenant_id  uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id         uuid NOT NULL DEFAULT gen_random_uuid(),
  projekt_id uuid NOT NULL,
  person_id  uuid NOT NULL,
  funktion   text NOT NULL CHECK (funktion IN ('sp', 'pl', 'ctl', 'kt', 'koalition')),
  -- Aufgaben, Kompetenzen, Verantwortung (Q7 Kap. 8)
  akv        text NOT NULL DEFAULT '' CHECK (length(akv) <= 2000),
  position   int NOT NULL DEFAULT 0 CHECK (position BETWEEN 0 AND 999),
  -- Stand der ganzen Projektorganisation (ETag): beim Ersetzen erhalten alle Zeilen den nächsten Stand
  stand      int NOT NULL DEFAULT 1 CHECK (stand >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, projekt_id) REFERENCES ppm.projekt (tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, person_id) REFERENCES ppm.principal (tenant_id, id),
  UNIQUE (tenant_id, projekt_id, funktion, person_id)
);
-- Sponsor, Projektleitung und CTL je genau eine Person (eine Unterschrift je Funktion, A-04)
CREATE UNIQUE INDEX projekt_person_einzeln ON ppm.projekt_person (tenant_id, projekt_id, funktion) WHERE funktion IN ('sp', 'pl', 'ctl');
CREATE INDEX projekt_person_person ON ppm.projekt_person (tenant_id, person_id);

-- Verlauf: nur anhängen (Phase und Lebenszyklus nachvollziehbar)
CREATE TABLE ppm.projekt_version (
  tenant_id        uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  projekt_id       uuid NOT NULL,
  version          int NOT NULL,
  action           text NOT NULL CHECK (action IN ('created', 'updated', 'deleted')),
  nummer           text NOT NULL,
  name             text NOT NULL,
  portfolio_id     uuid NOT NULL,
  org_einheit_id   uuid,
  handlungsfeld_id uuid,
  phase            text NOT NULL,
  phasenmodell_id  uuid,
  lebenszyklus     text NOT NULL,
  vertraulich      boolean NOT NULL,
  changed_at       timestamptz NOT NULL DEFAULT now(),
  changed_by       uuid,
  PRIMARY KEY (tenant_id, projekt_id, version)
);

CREATE FUNCTION ppm.projekt_history() RETURNS trigger LANGUAGE plpgsql SET search_path = ppm, pg_temp AS $$
DECLARE r ppm.projekt;
BEGIN
  r := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  INSERT INTO ppm.projekt_version (tenant_id, projekt_id, version, action, nummer, name, portfolio_id, org_einheit_id, handlungsfeld_id,
                                   phase, phasenmodell_id, lebenszyklus, vertraulich, changed_by)
  VALUES (r.tenant_id, r.id, CASE WHEN TG_OP = 'DELETE' THEN r.version + 1 ELSE r.version END,
          CASE TG_OP WHEN 'INSERT' THEN 'created' WHEN 'UPDATE' THEN 'updated' ELSE 'deleted' END,
          r.nummer, r.name, r.portfolio_id, r.org_einheit_id, r.handlungsfeld_id, r.phase, r.phasenmodell_id, r.lebenszyklus,
          r.vertraulich, app.principal_id());
  RETURN NULL;
END $$;
CREATE TRIGGER projekt_history AFTER INSERT OR UPDATE OR DELETE ON ppm.projekt FOR EACH ROW EXECUTE FUNCTION ppm.projekt_history();
REVOKE ALL ON FUNCTION ppm.projekt_history() FROM PUBLIC;

-- Bestehende Projekte (Übernahme vor dieser Migration) erhalten ihren Anfangsstand im Verlauf
INSERT INTO ppm.projekt_version (tenant_id, projekt_id, version, action, nummer, name, portfolio_id, phase, lebenszyklus, vertraulich, changed_at, changed_by)
  SELECT tenant_id, id, version, 'created', nummer, name, portfolio_id, phase, lebenszyklus, vertraulich, updated_at, updated_by FROM ppm.projekt;

SELECT app.secure_tenant_tables();
REVOKE UPDATE, DELETE ON ppm.projekt_version FROM ppm_app;
-- Die Projektorganisation wird nur ersetzt (Zeilen löschen und anlegen), nie geändert
REVOKE UPDATE ON ppm.projekt_person FROM ppm_app;

-- Lesesicht (fachmodell.md 3.4): Muster KIND für die Projektorganisation (Lesen, wer das Projekt sieht; Schreiben mit
-- projekt:organisation an der Organisation oder als Rolle am Projekt), Muster STAND für den Verlauf
CREATE POLICY projekt_person_read ON ppm.projekt_person AS RESTRICTIVE FOR SELECT TO ppm_app USING (ppm.projekt_sichtbar(projekt_id));
CREATE POLICY projekt_person_insert ON ppm.projekt_person AS RESTRICTIVE FOR INSERT TO ppm_app
  WITH CHECK (app.has_permission('projekt:organisation', 'projekt', projekt_id));
CREATE POLICY projekt_person_delete ON ppm.projekt_person AS RESTRICTIVE FOR DELETE TO ppm_app
  USING (app.has_permission('projekt:organisation', 'projekt', projekt_id));
CREATE POLICY projekt_version_read ON ppm.projekt_version AS RESTRICTIVE FOR SELECT TO ppm_app USING (ppm.projekt_sichtbar(projekt_id));
