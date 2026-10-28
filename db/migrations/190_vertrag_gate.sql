-- Gate-Modus und Gate-Entscheid des Projektvertrags (docs/fachmodell.md 2.10; AP-E3-3): PS.02.01, PS.02.02, PS.02.05,
-- PC.03.02; UC-003, UC-002 Schritt 11. Setzt 010 (Projekt, Hilfsfunktionen), 030 (Phasenmodell mit Leitfragen) und
-- 170 (Versionen und Kapitel) voraus.

-- Gate-Antrag je Vertragsversion für das Gate in ihre Zielphase (UC-003 Schritt 1): Leitfragen der Version des
-- Phasenmodells, die ab diesem Gate gilt (A-13), Traktandum im Gremium (UC-003 Schritt 8) und der Entscheid mit dem
-- Stand davor, damit eine Korrektur in der Sitzung (A-30) die Folge zurücknehmen kann.
CREATE TABLE ppm.gate_antrag (
  tenant_id              uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id                     uuid NOT NULL DEFAULT gen_random_uuid(),
  projekt_id             uuid NOT NULL,
  version_id             uuid NOT NULL,
  gate_code              text NOT NULL CHECK (gate_code IN ('P0_P1', 'P1_P2', 'P2_P3', 'P3_P4')),
  phasenmodell_id        uuid,
  stand                  text NOT NULL DEFAULT 'in_arbeit' CHECK (stand IN ('in_arbeit', 'traktandiert', 'entschieden')),
  traktandum_id          uuid,
  sitzung_id             uuid,
  -- Entscheid des Gremiums (Ergebnis der Art `gate`) und der Stand vor seiner Folge
  ergebnis               text CHECK (ergebnis IN ('freigegeben', 'mit_auflagen', 'zurueckgestellt', 'abgelehnt')),
  begruendung            text NOT NULL DEFAULT '' CHECK (length(begruendung) <= 5000),
  entschieden_at         timestamptz,
  vorher_baseline_id     uuid,
  vorher_phase           text CHECK (vorher_phase IN ('P0', 'P1', 'P2', 'P3', 'P4')),
  vorher_phasenmodell_id uuid,
  version                int NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at             timestamptz NOT NULL DEFAULT now(),
  created_by             uuid DEFAULT app.principal_id(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  updated_by             uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, version_id),
  UNIQUE (tenant_id, id, projekt_id),
  FOREIGN KEY (tenant_id, version_id, projekt_id) REFERENCES ppm.vertrag_version (tenant_id, id, projekt_id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, phasenmodell_id) REFERENCES ppm.phasenmodell (tenant_id, id),
  CHECK (stand <> 'entschieden' OR (ergebnis IS NOT NULL AND entschieden_at IS NOT NULL))
);
CREATE INDEX gate_antrag_projekt ON ppm.gate_antrag (tenant_id, projekt_id, stand);

-- Antwort je Leitfrage des Gates (UC-003 Schritt 4): Text; «trifft nicht zu» mit Begründung im Text (K2 «Regeln»)
CREATE TABLE ppm.leitfrage_antwort (
  tenant_id      uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id             uuid NOT NULL DEFAULT gen_random_uuid(),
  projekt_id     uuid NOT NULL,
  gate_antrag_id uuid NOT NULL,
  leitfrage_id   uuid NOT NULL,
  antwort        text NOT NULL CHECK (length(btrim(antwort)) BETWEEN 1 AND 5000),
  zutreffend     boolean NOT NULL DEFAULT true,
  version        int NOT NULL DEFAULT 1 CHECK (version >= 1),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  updated_by     uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, gate_antrag_id, leitfrage_id),
  FOREIGN KEY (tenant_id, gate_antrag_id, projekt_id) REFERENCES ppm.gate_antrag (tenant_id, id, projekt_id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, leitfrage_id) REFERENCES ppm.leitfrage (tenant_id, id)
);

-- Nutzenprüfung am Gate ab P3 (UC-003 A2, PC.03.02): erreichte Werte je KPI und Beurteilung durch PL und SP
CREATE TABLE ppm.nutzenpruefung (
  tenant_id   uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id          uuid NOT NULL DEFAULT gen_random_uuid(),
  projekt_id  uuid NOT NULL,
  version_id  uuid NOT NULL,
  beurteilung text NOT NULL DEFAULT '' CHECK (length(beurteilung) <= 5000),
  -- [{"kpiId": "…", "wert": "62 %", "bemerkung": "…"}]
  werte       jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(werte) = 'array'),
  version     int NOT NULL DEFAULT 1 CHECK (version >= 1),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, version_id),
  FOREIGN KEY (tenant_id, version_id, projekt_id) REFERENCES ppm.vertrag_version (tenant_id, id, projekt_id) ON DELETE CASCADE
);

-- Stand (ETag) und Änderung je Zeile nachführen
CREATE FUNCTION ppm.vertrag_gate_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = ppm, pg_temp AS $$
BEGIN
  NEW.version := OLD.version + 1;
  NEW.updated_at := now();
  NEW.updated_by := app.principal_id();
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION ppm.vertrag_gate_touch() FROM PUBLIC;
CREATE TRIGGER gate_antrag_touch BEFORE UPDATE ON ppm.gate_antrag FOR EACH ROW EXECUTE FUNCTION ppm.vertrag_gate_touch();
CREATE TRIGGER leitfrage_antwort_touch BEFORE UPDATE ON ppm.leitfrage_antwort FOR EACH ROW EXECUTE FUNCTION ppm.vertrag_gate_touch();
CREATE TRIGGER nutzenpruefung_touch BEFORE UPDATE ON ppm.nutzenpruefung FOR EACH ROW EXECUTE FUNCTION ppm.vertrag_gate_touch();

SELECT app.secure_tenant_tables();
REVOKE DELETE ON ppm.gate_antrag, ppm.nutzenpruefung FROM ppm_app;

-- Folge des Gate-Entscheids (Traktandenart `gate`, fachmodell.md 2.9) in der Transaktion des Entscheids: Die UE erfasst
-- ihn mit `sitzung:write`, hat aber kein `vertrag:write`. Wie `app.sitzung_intern` (130) setzt nur der Server
-- `app.vertrag_intern` für die Dauer der Folge (Baseline, Stand); die Lesesicht bleibt unverändert.
DROP POLICY vertrag_version_update ON ppm.vertrag_version;
CREATE POLICY vertrag_version_update ON ppm.vertrag_version AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('vertrag:write', 'projekt', projekt_id) OR current_setting('app.vertrag_intern', true) = 'on')
  WITH CHECK (app.has_permission('vertrag:write', 'projekt', projekt_id) OR current_setting('app.vertrag_intern', true) = 'on');
DROP POLICY vertrag_kapitel_update ON ppm.vertrag_kapitel;
CREATE POLICY vertrag_kapitel_update ON ppm.vertrag_kapitel AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('vertrag:write', 'projekt', projekt_id) OR current_setting('app.vertrag_intern', true) = 'on')
  WITH CHECK (app.has_permission('vertrag:write', 'projekt', projekt_id) OR current_setting('app.vertrag_intern', true) = 'on');

-- Lesesicht (fachmodell.md 3.4), Muster ÜBER ELTERN mit dem Projekt: lesen, wer das Projekt sieht; schreiben mit
-- vertrag:write am Projekt (PL), der Entscheid über `app.vertrag_intern`, die Nutzenprüfung auch mit vertrag:decide (SP)
CREATE POLICY gate_antrag_read ON ppm.gate_antrag AS RESTRICTIVE FOR SELECT TO ppm_app USING (ppm.projekt_sichtbar(projekt_id));
CREATE POLICY gate_antrag_insert ON ppm.gate_antrag AS RESTRICTIVE FOR INSERT TO ppm_app
  WITH CHECK (app.has_permission('vertrag:write', 'projekt', projekt_id) OR current_setting('app.vertrag_intern', true) = 'on');
CREATE POLICY gate_antrag_update ON ppm.gate_antrag AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('vertrag:write', 'projekt', projekt_id) OR current_setting('app.vertrag_intern', true) = 'on')
  WITH CHECK (app.has_permission('vertrag:write', 'projekt', projekt_id) OR current_setting('app.vertrag_intern', true) = 'on');

CREATE POLICY leitfrage_antwort_read ON ppm.leitfrage_antwort AS RESTRICTIVE FOR SELECT TO ppm_app USING (ppm.projekt_sichtbar(projekt_id));
CREATE POLICY leitfrage_antwort_insert ON ppm.leitfrage_antwort AS RESTRICTIVE FOR INSERT TO ppm_app
  WITH CHECK (app.has_permission('vertrag:write', 'projekt', projekt_id));
CREATE POLICY leitfrage_antwort_update ON ppm.leitfrage_antwort AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('vertrag:write', 'projekt', projekt_id)) WITH CHECK (app.has_permission('vertrag:write', 'projekt', projekt_id));
CREATE POLICY leitfrage_antwort_delete ON ppm.leitfrage_antwort AS RESTRICTIVE FOR DELETE TO ppm_app
  USING (app.has_permission('vertrag:write', 'projekt', projekt_id));

CREATE POLICY nutzenpruefung_read ON ppm.nutzenpruefung AS RESTRICTIVE FOR SELECT TO ppm_app USING (ppm.projekt_sichtbar(projekt_id));
CREATE POLICY nutzenpruefung_insert ON ppm.nutzenpruefung AS RESTRICTIVE FOR INSERT TO ppm_app
  WITH CHECK (app.has_permission('vertrag:write', 'projekt', projekt_id) OR app.has_permission('vertrag:decide', 'projekt', projekt_id));
CREATE POLICY nutzenpruefung_update ON ppm.nutzenpruefung AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('vertrag:write', 'projekt', projekt_id) OR app.has_permission('vertrag:decide', 'projekt', projekt_id))
  WITH CHECK (app.has_permission('vertrag:write', 'projekt', projekt_id) OR app.has_permission('vertrag:decide', 'projekt', projekt_id));
