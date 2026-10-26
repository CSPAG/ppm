-- 002 Beispielmodul «projekt»: zeigt jedes Muster einmal (RLS mit Lesesicht, Klassifizierung, Version für ETag,
-- Verlauf nur anhängen, Invariante über zwei Spalten). Spätere Module kopieren dieses Muster.

CREATE TABLE ppm.projekt (
  tenant_id      uuid NOT NULL REFERENCES ppm.tenant(id) ON DELETE CASCADE,
  id             uuid NOT NULL DEFAULT gen_random_uuid(),
  label          text NOT NULL CHECK (length(btrim(label)) BETWEEN 1 AND 200),
  beschreibung   text NOT NULL DEFAULT '' CHECK (length(beschreibung) <= 10000),
  beginn         date,
  ende           date,
  classification smallint NOT NULL DEFAULT 0 CHECK (classification BETWEEN 0 AND 2),
  version        int NOT NULL DEFAULT 1,
  created_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  updated_by     uuid,
  PRIMARY KEY (tenant_id, id),
  -- Letztes Netz; API und Formular prüfen vorher mit Feldpfad (422)
  CONSTRAINT projekt_zeitraum CHECK ((beginn IS NULL) = (ende IS NULL) AND (ende IS NULL OR ende >= beginn))
);
CREATE INDEX projekt_label ON ppm.projekt (tenant_id, lower(label), id);
CREATE INDEX projekt_updated ON ppm.projekt (tenant_id, updated_at);

-- Verlauf: jede Fassung (nur anhängen)
CREATE TABLE ppm.projekt_version (
  tenant_id  uuid NOT NULL REFERENCES ppm.tenant(id) ON DELETE CASCADE,
  projekt_id uuid NOT NULL,
  version    int NOT NULL,
  action     text NOT NULL CHECK (action IN ('created', 'updated', 'deleted')),
  data       jsonb NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid,
  PRIMARY KEY (tenant_id, projekt_id, version)
);

SELECT app.secure_tenant_tables();

-- Lesesicht (Spezifikation 7.6): Rolle an org (read_all) oder Tupel am Projekt; Klassifizierung bis zur Freigabestufe
CREATE POLICY projekt_read ON ppm.projekt AS RESTRICTIVE FOR SELECT TO ppm_app USING (
  classification <= app.clearance() AND (app.read_all() OR app.has_tuple('projekt', id, app.read_relations())));
CREATE POLICY projekt_insert ON ppm.projekt AS RESTRICTIVE FOR INSERT TO ppm_app WITH CHECK (
  classification <= app.clearance() AND app.write_all());
CREATE POLICY projekt_update ON ppm.projekt AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (classification <= app.clearance() AND (app.write_all() OR app.has_tuple('projekt', id, app.write_relations())))
  WITH CHECK (classification <= app.clearance() AND (app.write_all() OR app.has_tuple('projekt', id, app.write_relations())));
CREATE POLICY projekt_delete ON ppm.projekt AS RESTRICTIVE FOR DELETE TO ppm_app USING (
  classification <= app.clearance() AND (app.read_all_of('projekt:delete') OR app.has_tuple('projekt', id, app.relations_of('projekt:delete'))));

-- Verlauf: lesen wie das Projekt (auch gelöschte: nur mit Recht an org), nur anhängen
CREATE POLICY projekt_version_read ON ppm.projekt_version AS RESTRICTIVE FOR SELECT TO ppm_app USING (
  coalesce((data ->> 'classification')::smallint, 0) <= app.clearance()
  AND (app.read_all() OR app.has_tuple('projekt', projekt_id, app.read_relations())));
CREATE POLICY projekt_version_insert ON ppm.projekt_version AS RESTRICTIVE FOR INSERT TO ppm_app WITH CHECK (true);
REVOKE UPDATE, DELETE ON ppm.projekt_version FROM ppm_app;
