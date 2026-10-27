-- Freigabe der Jahresziele und Portfolio-Roadmap (BC ZM.02.02, PP.04.03; UC-011 Schritte 6–8, A2; Kernablauf K6;
-- docs/fachmodell.md 2.7): Zeitpunkt der Vorlage an den VR am Zieljahr (Banner «liegen dem VR zur Freigabe vor seit
-- ‹Datum›», K6 Z9) und die publizierte Roadmap je Jahr als Stand bei Publikation.

ALTER TABLE ppm.zieljahr ADD COLUMN vorgelegt_at timestamptz;

CREATE TABLE ppm.roadmap (
  tenant_id      uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id             uuid NOT NULL DEFAULT gen_random_uuid(),
  jahr           int NOT NULL CHECK (jahr BETWEEN 2000 AND 2100),
  -- Stand bei Publikation: Handlungsfelder › strategische Ziele › Jahresziele › Hauptaktivitäten und Projekte
  inhalt         jsonb NOT NULL CHECK (jsonb_typeof(inhalt) = 'object'),
  publiziert_at  timestamptz NOT NULL DEFAULT now(),
  publiziert_by  uuid DEFAULT app.principal_id(),
  version        int NOT NULL DEFAULT 1 CHECK (version >= 1),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, jahr),
  -- nur für ein Jahr mit Zielzyklus (Publikation setzt freigegebene Jahresziele voraus, UC-011 Schritt 8)
  FOREIGN KEY (tenant_id, jahr) REFERENCES ppm.zieljahr (tenant_id, jahr)
);

-- Erneutes Publizieren ersetzt den Stand; Version und Zeitpunkt setzt die Datenbank
CREATE FUNCTION ppm.roadmap_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = ppm, pg_temp AS $$
BEGIN
  NEW.version := OLD.version + 1;
  NEW.publiziert_at := now();
  NEW.publiziert_by := app.principal_id();
  RETURN NEW;
END $$;
CREATE TRIGGER roadmap_touch BEFORE UPDATE ON ppm.roadmap FOR EACH ROW EXECUTE FUNCTION ppm.roadmap_touch();
REVOKE ALL ON FUNCTION ppm.roadmap_touch() FROM PUBLIC;

SELECT app.secure_tenant_tables();

-- Muster ORG (docs/fachmodell.md 3.4): Lesen nach Publikation für alle angemeldeten Personen (tenant:read, A-35,
-- UX-OF-14); es gibt nur publizierte Zeilen. Publizieren mit ziel:freigabe (UE).
CREATE POLICY roadmap_read ON ppm.roadmap AS RESTRICTIVE FOR SELECT TO ppm_app USING (app.has_permission('tenant:read'));
CREATE POLICY roadmap_insert ON ppm.roadmap AS RESTRICTIVE FOR INSERT TO ppm_app WITH CHECK (app.has_permission('ziel:freigabe'));
CREATE POLICY roadmap_update ON ppm.roadmap AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('ziel:freigabe')) WITH CHECK (app.has_permission('ziel:freigabe'));
CREATE POLICY roadmap_delete ON ppm.roadmap AS RESTRICTIVE FOR DELETE TO ppm_app USING (app.has_permission('ziel:freigabe'));
