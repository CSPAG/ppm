-- Jahresrückblick (BC ZM.03.03, PS.04.03; UC-013; docs/fachmodell.md 2.13, 3.4; AP-E7-5): Die UE stellt die
-- Jahresauswertung zusammen (Zielerreichung, abgeschlossene, abgebrochene und laufende Vorhaben, Lessons Learned),
-- traktandiert sie im PRAT (Art `jahresrueckblick`, Stand bei Traktandierung in `inhalt`) und erfasst Erkenntnisse und
-- Massnahmen für den nächsten Zyklus (UC-013 Schritt 4). Ein Jahresrückblick je Jahr.
-- Setzt nur Tabellen aus 001–009 voraus (Mandant).

CREATE TABLE ppm.jahresrueckblick (
  tenant_id       uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id              uuid NOT NULL DEFAULT gen_random_uuid(),
  jahr            int NOT NULL CHECK (jahr BETWEEN 2000 AND 2100),
  -- in_arbeit: UE stellt zusammen; traktandiert: im PRAT vorgeschlagen bzw. traktandiert; ausgewertet: «Verabschiedet»
  stand           text NOT NULL DEFAULT 'in_arbeit' CHECK (stand IN ('in_arbeit', 'traktandiert', 'ausgewertet')),
  -- Jahresauswertung bei Traktandierung (Unterlage des PRAT); leer, solange die Auswertung live ist
  inhalt          jsonb CHECK (inhalt IS NULL OR jsonb_typeof(inhalt) = 'object'),
  erkenntnisse    text NOT NULL DEFAULT '' CHECK (length(erkenntnisse) <= 8000),
  massnahmen      text NOT NULL DEFAULT '' CHECK (length(massnahmen) <= 8000),
  -- Rückmeldung des PRAT bei «Anpassungen verlangt»
  rueckmeldung    text NOT NULL DEFAULT '' CHECK (length(rueckmeldung) <= 4000),
  traktandiert_at timestamptz,
  ausgewertet_at  timestamptz,
  version         int NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid DEFAULT app.principal_id(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, jahr),
  CHECK ((stand = 'in_arbeit') OR (inhalt IS NOT NULL AND traktandiert_at IS NOT NULL))
);

-- Version und Bearbeitung setzt die Datenbank; das Jahr bleibt fest
CREATE FUNCTION ppm.jahresrueckblick_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = ppm, pg_temp AS $$
BEGIN
  NEW.jahr := OLD.jahr;
  NEW.version := OLD.version + 1;
  NEW.updated_at := now();
  NEW.updated_by := app.principal_id();
  NEW.created_at := OLD.created_at;
  NEW.created_by := OLD.created_by;
  RETURN NEW;
END $$;
CREATE TRIGGER jahresrueckblick_touch BEFORE UPDATE ON ppm.jahresrueckblick FOR EACH ROW EXECUTE FUNCTION ppm.jahresrueckblick_touch();
REVOKE ALL ON FUNCTION ppm.jahresrueckblick_touch() FROM PUBLIC;

SELECT app.secure_tenant_tables();
-- Der Jahresrückblick bleibt nachvollziehbar
REVOKE DELETE ON ppm.jahresrueckblick FROM ppm_app;

-- Lesesicht nach Muster ORG (fachmodell.md 3.4): lesen mit ziel:read (Gremium, GL, UE; Zielzyklus des Folgejahres,
-- UC-011), zusammenstellen und erfassen mit quartalsbericht:write (UE, Reporting zur Zielerreichung; Annahme, 3.2
-- nennt kein eigenes Recht)
CREATE POLICY jahresrueckblick_read ON ppm.jahresrueckblick AS RESTRICTIVE FOR SELECT TO ppm_app
  USING (app.has_permission('ziel:read') OR app.has_permission('quartalsbericht:write'));
CREATE POLICY jahresrueckblick_insert ON ppm.jahresrueckblick AS RESTRICTIVE FOR INSERT TO ppm_app
  WITH CHECK (app.has_permission('quartalsbericht:write'));
CREATE POLICY jahresrueckblick_update ON ppm.jahresrueckblick AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('quartalsbericht:write')) WITH CHECK (app.has_permission('quartalsbericht:write'));
