-- Neubesetzung beim Entziehen des Zugangs (AM.01.01, UC-016 A1; docs/fachmodell.md 2.1, 4.2): Bevor der Baukasten die
-- Mitgliedschaft und alle Tupel der Person entfernt, hält das Modul `eingang` fest, welche Rollen sie an Projekten,
-- Portfolios und anderen Orten hatte. Die Administration sieht diese Rollen und die offenen Aufgaben der Person und
-- besetzt sie neu; ob eine Rolle wieder besetzt ist, ergibt sich aus den Tupeln (nicht gespeichert).
--
-- Lesesicht ADMIN: nur mit `members:admin` (Mitglieder und Rollen verwalten) oder als System.

CREATE TABLE ppm.neubesetzung (
  tenant_id    uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id           uuid NOT NULL DEFAULT gen_random_uuid(),
  person       uuid NOT NULL,
  -- `vorbereitet`: Rollen festgehalten, Entfernen im Baukasten läuft; `entzogen`: Zugang gesperrt
  stand        text NOT NULL DEFAULT 'vorbereitet' CHECK (stand IN ('vorbereitet', 'entzogen')),
  entzogen_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, person) REFERENCES ppm.principal (tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT neubesetzung_entzogen CHECK ((stand = 'entzogen') = (entzogen_at IS NOT NULL))
);
-- höchstens ein laufendes Entziehen je Person (Wiederholung nach einem Fehler nimmt es wieder auf)
CREATE UNIQUE INDEX neubesetzung_vorbereitet ON ppm.neubesetzung (tenant_id, person) WHERE stand = 'vorbereitet';
CREATE INDEX neubesetzung_neu ON ppm.neubesetzung (tenant_id, created_at DESC, id DESC);

-- Rollen der Person an Orten ausser der Organisation, festgehalten vor dem Entfernen
CREATE TABLE ppm.neubesetzung_rolle (
  tenant_id        uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id               uuid NOT NULL DEFAULT gen_random_uuid(),
  neubesetzung_id  uuid NOT NULL,
  ort_typ          text NOT NULL CHECK (ort_typ ~ '^[a-z][a-z_]*$' AND ort_typ <> 'org'),
  ort_id           uuid NOT NULL,
  rolle            text NOT NULL CHECK (rolle ~ '^[a-z][a-z_-]*$'),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, neubesetzung_id) REFERENCES ppm.neubesetzung (tenant_id, id) ON DELETE CASCADE,
  UNIQUE (tenant_id, neubesetzung_id, ort_typ, ort_id, rolle)
);

SELECT app.secure_tenant_tables();

-- Verlauf: Löschen nur mit dem Mandanten
REVOKE DELETE ON ppm.neubesetzung, ppm.neubesetzung_rolle FROM ppm_app;

CREATE POLICY neubesetzung_admin ON ppm.neubesetzung AS RESTRICTIVE FOR ALL TO ppm_app
  USING (app.has_permission('members:admin') OR (app.principal_id() IS NULL AND app.write_all()))
  WITH CHECK (app.has_permission('members:admin') OR (app.principal_id() IS NULL AND app.write_all()));
CREATE POLICY neubesetzung_rolle_admin ON ppm.neubesetzung_rolle AS RESTRICTIVE FOR ALL TO ppm_app
  USING (app.has_permission('members:admin') OR (app.principal_id() IS NULL AND app.write_all()))
  WITH CHECK (app.has_permission('members:admin') OR (app.principal_id() IS NULL AND app.write_all()));
