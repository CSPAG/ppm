-- Eingang (BC AM.01.03, UC-016 Schritt 4, UX-E3; docs/fachmodell.md 2.1, 3.4, 4): Aufgaben, Mitteilungen und
-- Stellvertretungen. Aufgaben öffnen und erledigen die Fachmodule über die Schnittstelle des Moduls `eingang` in der
-- Transaktion der auslösenden Änderung; «Zu tun» ist eine gespeicherte Liste, keine Abfrage über alle Module.
--
-- Schreiben in `aufgabe` und `mitteilung` geht nur über das Modul: Es setzt für die Dauer des Aufrufs
-- `app.eingang_intern = 'on'` (wie `app.entra_scan` des Baukastens). Damit schliesst ein Modul auch Aufgaben, die die
-- handelnde Person nicht sieht (z. B. Unterzeichnungen anderer beim Zurückziehen), ohne SECURITY DEFINER.
-- System = volle Sicht ohne Person (Jobs, `fullTx`): `app.principal_id() IS NULL AND app.write_all()`.

-- Aufgaben («Zu tun»): Empfänger ist genau eine Person oder ein Recht an einem Ort (Fachmodell 4.1)
CREATE TABLE ppm.aufgabe (
  tenant_id         uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id                uuid NOT NULL DEFAULT gen_random_uuid(),
  art               text NOT NULL CHECK (art ~ '^[a-z][a-z_]*\.[a-z][a-z_]*$'),
  bezug_typ         text NOT NULL CHECK (bezug_typ ~ '^[a-z][a-z_]*$'),
  bezug_id          text NOT NULL CHECK (length(bezug_id) BETWEEN 1 AND 100),
  empfaenger_person uuid,
  empfaenger_recht  text CHECK (empfaenger_recht ~ '^[a-z][a-z_]*:[a-z][a-z_]*$'),
  ort_typ           text NOT NULL DEFAULT 'org' CHECK (ort_typ IN ('org', 'portfolio', 'projekt')),
  ort_id            uuid,
  titel             text NOT NULL CHECK (length(btrim(titel)) BETWEEN 1 AND 300),
  kontext           text CHECK (length(kontext) <= 200),
  link              text NOT NULL CHECK (link ~ '^/[^/\\]' AND length(link) <= 500),
  frist             date,
  frist_art         text CHECK (frist_art IN ('kalendertage', 'arbeitstage')),
  manuell           boolean NOT NULL DEFAULT false,
  stand             text NOT NULL DEFAULT 'offen' CHECK (stand IN ('offen', 'erledigt', 'entfallen')),
  erledigt_von      uuid,
  erledigt_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, empfaenger_person) REFERENCES ppm.principal (tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT aufgabe_empfaenger CHECK ((empfaenger_person IS NULL) <> (empfaenger_recht IS NULL)),
  CONSTRAINT aufgabe_ort CHECK ((ort_typ = 'org') = (ort_id IS NULL)),
  CONSTRAINT aufgabe_frist CHECK ((frist IS NULL) = (frist_art IS NULL)),
  CONSTRAINT aufgabe_erledigt CHECK ((stand = 'offen') = (erledigt_at IS NULL))
);
-- eindeutig offen je (Art, Bezug, Empfänger): Öffnen ist idempotent (Jobs, wiederholte Übergänge)
CREATE UNIQUE INDEX aufgabe_offen ON ppm.aufgabe
  (tenant_id, art, bezug_typ, bezug_id, coalesce(empfaenger_person::text, empfaenger_recht), ort_typ, coalesce(ort_id::text, ''))
  WHERE stand = 'offen';
CREATE INDEX aufgabe_person ON ppm.aufgabe (tenant_id, empfaenger_person, frist) WHERE stand = 'offen';
CREATE INDEX aufgabe_recht ON ppm.aufgabe (tenant_id, empfaenger_recht, frist) WHERE stand = 'offen' AND empfaenger_recht IS NOT NULL;
CREATE INDEX aufgabe_bezug ON ppm.aufgabe (tenant_id, bezug_typ, bezug_id);

-- Mitteilungen: Information ohne Handlung an eine Person; E-Mail folgt mit einem Netz-Adapter (A-44)
CREATE TABLE ppm.mitteilung (
  tenant_id         uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id                uuid NOT NULL DEFAULT gen_random_uuid(),
  empfaenger_person uuid NOT NULL,
  bezug_typ         text NOT NULL CHECK (bezug_typ ~ '^[a-z][a-z_]*$'),
  bezug_id          text NOT NULL CHECK (length(bezug_id) BETWEEN 1 AND 100),
  text              text NOT NULL CHECK (length(btrim(text)) BETWEEN 1 AND 1000),
  link              text CHECK (link ~ '^/[^/\\]' AND length(link) <= 500),
  gelesen_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, empfaenger_person) REFERENCES ppm.principal (tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX mitteilung_person ON ppm.mitteilung (tenant_id, empfaenger_person, created_at DESC, id DESC);

-- Stellvertretungen (Fachmodell 4.3): befristet von–bis (Tage in Europe/Zurich, beide eingeschlossen); `tupel` sind die
-- befristeten Tupel, die das Modul der Vertretung mit den Projekt- und Portfoliorollen der vertretenen Person gesetzt hat
CREATE TABLE ppm.stellvertretung (
  tenant_id         uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id                uuid NOT NULL DEFAULT gen_random_uuid(),
  vertretene_person uuid NOT NULL,
  vertreter_person  uuid NOT NULL,
  von               date NOT NULL,
  bis               date NOT NULL,
  unterschriften    boolean NOT NULL DEFAULT false,
  tupel             uuid[] NOT NULL DEFAULT '{}',
  aktiviert_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  created_by        uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, vertretene_person) REFERENCES ppm.principal (tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, vertreter_person) REFERENCES ppm.principal (tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT stellvertretung_selbst CHECK (vertretene_person <> vertreter_person),
  CONSTRAINT stellvertretung_zeitraum CHECK (von <= bis)
);
CREATE INDEX stellvertretung_vertretene ON ppm.stellvertretung (tenant_id, vertretene_person, bis);
CREATE INDEX stellvertretung_vertreter ON ppm.stellvertretung (tenant_id, vertreter_person, bis);

CREATE FUNCTION ppm.aufgabe_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = ppm, pg_temp AS $$
BEGIN
  NEW.updated_at := now();
  NEW.created_at := OLD.created_at;
  RETURN NEW;
END $$;
CREATE TRIGGER aufgabe_touch BEFORE UPDATE ON ppm.aufgabe FOR EACH ROW EXECUTE FUNCTION ppm.aufgabe_touch();
REVOKE ALL ON FUNCTION ppm.aufgabe_touch() FROM PUBLIC;

SELECT app.secure_tenant_tables();
-- Aufgaben und Mitteilungen bleiben als Verlauf; Löschen nur mit dem Mandanten
REVOKE DELETE ON ppm.aufgabe, ppm.mitteilung FROM ppm_app;

-- Lesesicht AUFGABE (Fachmodell 3.4): eigene Aufgaben, Aufgaben an ein Recht am Ort, Aufgaben der heute vertretenen
-- Person; Schreiben nur über das Modul
CREATE POLICY aufgabe_read ON ppm.aufgabe AS RESTRICTIVE FOR SELECT TO ppm_app USING (
  current_setting('app.eingang_intern', true) = 'on'
  OR (app.principal_id() IS NULL AND app.write_all())
  OR empfaenger_person = app.principal_id()
  OR (empfaenger_recht IS NOT NULL AND CASE ort_typ WHEN 'org' THEN app.has_permission(empfaenger_recht)
                                                     ELSE app.has_permission(empfaenger_recht, ort_typ, ort_id) END)
  OR EXISTS (SELECT 1 FROM ppm.stellvertretung s
              WHERE s.tenant_id = aufgabe.tenant_id AND s.vertretene_person = aufgabe.empfaenger_person
                AND s.vertreter_person = app.principal_id()
                AND (now() AT TIME ZONE 'Europe/Zurich')::date BETWEEN s.von AND s.bis));
CREATE POLICY aufgabe_insert ON ppm.aufgabe AS RESTRICTIVE FOR INSERT TO ppm_app
  WITH CHECK (current_setting('app.eingang_intern', true) = 'on');
CREATE POLICY aufgabe_update ON ppm.aufgabe AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (current_setting('app.eingang_intern', true) = 'on') WITH CHECK (current_setting('app.eingang_intern', true) = 'on');

-- Lesesicht EIGEN: Mitteilungen nur für die Empfängerin; «gelesen» setzt nur sie; Senden über das Modul
CREATE POLICY mitteilung_read ON ppm.mitteilung AS RESTRICTIVE FOR SELECT TO ppm_app USING (
  empfaenger_person = app.principal_id() OR current_setting('app.eingang_intern', true) = 'on'
  OR (app.principal_id() IS NULL AND app.write_all()));
CREATE POLICY mitteilung_insert ON ppm.mitteilung AS RESTRICTIVE FOR INSERT TO ppm_app
  WITH CHECK (current_setting('app.eingang_intern', true) = 'on');
CREATE POLICY mitteilung_update ON ppm.mitteilung AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (empfaenger_person = app.principal_id()) WITH CHECK (empfaenger_person = app.principal_id());

-- Lesesicht EIGEN: Stellvertretungen sehen vertretene Person und Vertretung; erfassen und beenden nur die vertretene
-- Person (UC-016 Schritt 4) oder das System (Aktivieren eines künftigen Zeitraums durch den Job)
CREATE POLICY stellvertretung_read ON ppm.stellvertretung AS RESTRICTIVE FOR SELECT TO ppm_app USING (
  vertretene_person = app.principal_id() OR vertreter_person = app.principal_id()
  OR (app.principal_id() IS NULL AND app.write_all()));
CREATE POLICY stellvertretung_insert ON ppm.stellvertretung AS RESTRICTIVE FOR INSERT TO ppm_app
  WITH CHECK (vertretene_person = app.principal_id() OR (app.principal_id() IS NULL AND app.write_all()));
CREATE POLICY stellvertretung_update ON ppm.stellvertretung AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (vertretene_person = app.principal_id() OR (app.principal_id() IS NULL AND app.write_all()))
  WITH CHECK (vertretene_person = app.principal_id() OR (app.principal_id() IS NULL AND app.write_all()));
CREATE POLICY stellvertretung_delete ON ppm.stellvertretung AS RESTRICTIVE FOR DELETE TO ppm_app
  USING (vertretene_person = app.principal_id() OR (app.principal_id() IS NULL AND app.write_all()));
