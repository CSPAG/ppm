-- Zielerreichung je Quartal (BC ZM.03.01; UC-012 Schritte 1–2; Kernablauf K6 Schritt 10; docs/fachmodell.md 2.7):
-- Stand je Ziel anhand der Metrik, mit Kommentar (Beurteilung), Datum und Person; ein Eintrag je Ziel und Quartal.
-- Ziele sind strategische Ziele und Jahresziele (`ziel_typ`); der Fremdschlüssel läuft über die abgeleiteten Spalten.

CREATE TABLE ppm.zielerreichung (
  tenant_id             uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id                    uuid NOT NULL DEFAULT gen_random_uuid(),
  ziel_typ              text NOT NULL CHECK (ziel_typ IN ('strategisch', 'jahresziel')),
  ziel_id               uuid NOT NULL,
  strategisches_ziel_id uuid GENERATED ALWAYS AS (CASE WHEN ziel_typ = 'strategisch' THEN ziel_id END) STORED,
  jahresziel_id         uuid GENERATED ALWAYS AS (CASE WHEN ziel_typ = 'jahresziel' THEN ziel_id END) STORED,
  -- «2026-Q3» (2.14 Perioden und Fristen)
  quartal               text NOT NULL CHECK (quartal ~ '^[0-9]{4}-Q[1-4]$'),
  -- neuer Stand der Metrik (K6 Schritt 10), z. B. «−1,4 %»
  stand                 text NOT NULL CHECK (length(btrim(stand)) BETWEEN 1 AND 200),
  -- Kommentar und Beurteilung durch GL bzw. UE (UC-012 Akteure); Skala nicht festgelegt, darum Text
  beurteilung           text NOT NULL DEFAULT '' CHECK (length(beurteilung) <= 2000),
  erfasst_at            timestamptz NOT NULL DEFAULT now(),
  erfasst_by            uuid DEFAULT app.principal_id(),
  version               int NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at            timestamptz NOT NULL DEFAULT now(),
  created_by            uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, ziel_typ, ziel_id, quartal),
  -- Ziel gelöscht: seine Zielerreichung mit (der Verlauf bleibt im Audit)
  FOREIGN KEY (tenant_id, strategisches_ziel_id) REFERENCES ppm.strategisches_ziel (tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, jahresziel_id) REFERENCES ppm.jahresziel (tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX zielerreichung_quartal ON ppm.zielerreichung (tenant_id, quartal);
CREATE INDEX zielerreichung_strategisch ON ppm.zielerreichung (tenant_id, strategisches_ziel_id) WHERE strategisches_ziel_id IS NOT NULL;
CREATE INDEX zielerreichung_jahresziel ON ppm.zielerreichung (tenant_id, jahresziel_id) WHERE jahresziel_id IS NOT NULL;

-- Version, Zeitpunkt und Person des Stands setzt die Datenbank (ETag/If-Match über version)
CREATE FUNCTION ppm.zielerreichung_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = ppm, pg_temp AS $$
BEGIN
  NEW.version := OLD.version + 1;
  NEW.erfasst_at := now();
  NEW.erfasst_by := app.principal_id();
  NEW.created_at := OLD.created_at;
  NEW.created_by := OLD.created_by;
  RETURN NEW;
END $$;
CREATE TRIGGER zielerreichung_touch BEFORE UPDATE ON ppm.zielerreichung FOR EACH ROW EXECUTE FUNCTION ppm.zielerreichung_touch();
REVOKE ALL ON FUNCTION ppm.zielerreichung_touch() FROM PUBLIC;

SELECT app.secure_tenant_tables();

-- Lesesicht nach Muster ORG (docs/fachmodell.md 3.4): lesen mit ziel:read, erfassen mit zielerreichung:write (GL, UE)
CREATE POLICY zielerreichung_read ON ppm.zielerreichung AS RESTRICTIVE FOR SELECT TO ppm_app USING (app.has_permission('ziel:read'));
CREATE POLICY zielerreichung_insert ON ppm.zielerreichung AS RESTRICTIVE FOR INSERT TO ppm_app WITH CHECK (app.has_permission('zielerreichung:write'));
CREATE POLICY zielerreichung_update ON ppm.zielerreichung AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('zielerreichung:write')) WITH CHECK (app.has_permission('zielerreichung:write'));
CREATE POLICY zielerreichung_delete ON ppm.zielerreichung AS RESTRICTIVE FOR DELETE TO ppm_app USING (app.has_permission('zielerreichung:write'));
