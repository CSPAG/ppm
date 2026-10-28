-- Schnittstellen zu Umsystemen mit Laufprotokoll (BC AM.03.02; UC-018 Schritte 3–4, A1; docs/fachmodell.md 2.13;
-- AP-E7-3): je Umsystem und Daten eine Konfiguration (Richtung, Rhythmus, Adresse) und je Lauf Zeitpunkt, Umfang und
-- Fehler. Das Änderungsprotokoll (AM.03.03) liest das Audit des Baukastens (`ppm.audit_log`) und braucht keine Tabelle.

CREATE TABLE ppm.schnittstelle (
  tenant_id  uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id         uuid NOT NULL DEFAULT gen_random_uuid(),
  -- Umsystem und Daten aus dem Katalog des Moduls (Master §3 «Umsysteme»: ERP, HR-System, Budgetprozess)
  umsystem   text NOT NULL CHECK (umsystem ~ '^[a-z][a-z0-9_]{0,39}$'),
  daten      text NOT NULL CHECK (daten ~ '^[a-z][a-z0-9_]{0,39}$'),
  richtung   text NOT NULL CHECK (richtung IN ('eingehend', 'ausgehend')),
  rhythmus   text NOT NULL CHECK (rhythmus IN ('manuell', 'taeglich', 'woechentlich', 'monatlich')),
  -- Adresse des Umsystems (HTTPS; Abruf nur über safeRequest mit SSRF-Schutz)
  adresse    text NOT NULL CHECK (adresse ~ '^https?://' AND length(adresse) <= 2000),
  aktiv      boolean NOT NULL DEFAULT true,
  version    int NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT app.principal_id(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, umsystem, daten)
);

-- Lauf: Testlauf beim Einrichten, geplant nach Rhythmus, von Hand gestartet (auch erneut nach Fehler, UC-018 A1.1)
CREATE TABLE ppm.schnittstelle_lauf (
  tenant_id        uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id               uuid NOT NULL DEFAULT gen_random_uuid(),
  schnittstelle_id uuid NOT NULL,
  art              text NOT NULL CHECK (art IN ('test', 'geplant', 'manuell')),
  stand            text NOT NULL DEFAULT 'laeuft' CHECK (stand IN ('laeuft', 'erfolgreich', 'fehlgeschlagen')),
  start            timestamptz NOT NULL DEFAULT now(),
  ende             timestamptz,
  -- Anzahl übertragener Datensätze
  umfang           int CHECK (umfang >= 0),
  fehler           text CHECK (length(fehler) <= 1000),
  gestartet_by     uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, schnittstelle_id) REFERENCES ppm.schnittstelle (tenant_id, id) ON DELETE CASCADE,
  CHECK ((stand = 'laeuft') = (ende IS NULL)),
  CHECK (stand <> 'fehlgeschlagen' OR fehler IS NOT NULL)
);
CREATE INDEX schnittstelle_lauf_start ON ppm.schnittstelle_lauf (tenant_id, schnittstelle_id, start DESC);
-- Höchstens ein laufender Lauf je Schnittstelle
CREATE UNIQUE INDEX schnittstelle_lauf_laeuft ON ppm.schnittstelle_lauf (tenant_id, schnittstelle_id) WHERE stand = 'laeuft';

CREATE FUNCTION ppm.schnittstelle_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = ppm, pg_temp AS $$
BEGIN
  NEW.version := OLD.version + 1;
  NEW.updated_at := now();
  NEW.updated_by := app.principal_id();
  NEW.created_at := OLD.created_at;
  NEW.created_by := OLD.created_by;
  RETURN NEW;
END $$;
CREATE TRIGGER schnittstelle_touch BEFORE UPDATE ON ppm.schnittstelle FOR EACH ROW EXECUTE FUNCTION ppm.schnittstelle_touch();
REVOKE ALL ON FUNCTION ppm.schnittstelle_touch() FROM PUBLIC;

SELECT app.secure_tenant_tables();
-- Konfiguration wird deaktiviert statt gelöscht (UC-017 Schritt 2 sinngemäss); Läufe sind Protokoll: nur abschliessen
REVOKE DELETE ON ppm.schnittstelle, ppm.schnittstelle_lauf FROM ppm_app;

-- Lesesicht nach Muster ORG (fachmodell.md 3.4): nur ADM mit schnittstelle:admin (3.2, scope: false)
CREATE POLICY schnittstelle_read ON ppm.schnittstelle AS RESTRICTIVE FOR SELECT TO ppm_app USING (app.has_permission('schnittstelle:admin'));
CREATE POLICY schnittstelle_insert ON ppm.schnittstelle AS RESTRICTIVE FOR INSERT TO ppm_app WITH CHECK (app.has_permission('schnittstelle:admin'));
CREATE POLICY schnittstelle_update ON ppm.schnittstelle AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('schnittstelle:admin')) WITH CHECK (app.has_permission('schnittstelle:admin'));
CREATE POLICY schnittstelle_lauf_read ON ppm.schnittstelle_lauf AS RESTRICTIVE FOR SELECT TO ppm_app USING (app.has_permission('schnittstelle:admin'));
CREATE POLICY schnittstelle_lauf_insert ON ppm.schnittstelle_lauf AS RESTRICTIVE FOR INSERT TO ppm_app WITH CHECK (app.has_permission('schnittstelle:admin'));
CREATE POLICY schnittstelle_lauf_update ON ppm.schnittstelle_lauf AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('schnittstelle:admin')) WITH CHECK (app.has_permission('schnittstelle:admin'));
