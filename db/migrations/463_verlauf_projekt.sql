-- 463 Versionen statt Sperre an der Projektakte (AP-E8-5; UC-015 Schritt 6; Master G2, A-75, UX-E13)
--
-- Abgeschlossene und abgebrochene Projekte bleiben änderbar (Projekt, Projektorganisation, Register, KPI-Werte,
-- Meldungen); das Projekt trägt dann «geändert nach Abschluss» (Zeitpunkt der letzten Änderung). Zurückgezogene bleiben
-- lesend. Der Verlauf der Projektakte kommt aus dem Audit.
ALTER TABLE ppm.projekt ADD COLUMN geaendert_nach_abschluss_at timestamptz;

-- Die Markierung allein ist keine neue Version des Projekts: kein Versionssprung (ETag bleibt), kein Eintrag im Verlauf
CREATE OR REPLACE FUNCTION ppm.projekt_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = ppm, pg_temp AS $$
BEGIN
  IF to_jsonb(NEW) - 'geaendert_nach_abschluss_at' = to_jsonb(OLD) - 'geaendert_nach_abschluss_at' THEN
    RETURN NEW;
  END IF;
  NEW.version := OLD.version + 1;
  NEW.updated_at := now();
  NEW.updated_by := app.principal_id();
  NEW.created_at := OLD.created_at;
  NEW.created_by := OLD.created_by;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION ppm.projekt_history() RETURNS trigger LANGUAGE plpgsql SET search_path = ppm, pg_temp AS $$
DECLARE r ppm.projekt;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.version = OLD.version THEN
    RETURN NULL;
  END IF;
  r := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  INSERT INTO ppm.projekt_version (tenant_id, projekt_id, version, action, nummer, name, portfolio_id, org_einheit_id, handlungsfeld_id,
                                   phase, phasenmodell_id, lebenszyklus, vertraulich, changed_by)
  VALUES (r.tenant_id, r.id, CASE WHEN TG_OP = 'DELETE' THEN r.version + 1 ELSE r.version END,
          CASE TG_OP WHEN 'INSERT' THEN 'created' WHEN 'UPDATE' THEN 'updated' ELSE 'deleted' END,
          r.nummer, r.name, r.portfolio_id, r.org_einheit_id, r.handlungsfeld_id, r.phase, r.phasenmodell_id, r.lebenszyklus,
          r.vertraulich, app.principal_id());
  RETURN NULL;
END $$;
