-- Eskalation (BC PS.03.03; UC-004 A2.2, UC-006 Schritt 7; docs/fachmodell.md 2.8): Ein eingereichter Statusbericht
-- «kritisch» mit Entscheidbedarf legt eine Eskalation an; sie geht als Traktandum der Art `eskalation` an das
-- entscheidende Gremium des Portfolios. Der Entscheid des Gremiums schliesst sie (erledigt mit Massnahme) oder stellt sie
-- zurück (Vorschlag der Folgesitzung). Die Meilensteinabnahme (PS.02.03) braucht keine Tabelle: sie steht im Register
-- `meilenstein` (060_projektdaten).

CREATE TABLE ppm.eskalation (
  tenant_id        uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id               uuid NOT NULL DEFAULT gen_random_uuid(),
  projekt_id       uuid NOT NULL,
  statusbericht_id uuid NOT NULL,
  -- Begründung und Massnahme aus dem Bericht «kritisch» (UC-004 A2.1), festgehalten beim Einreichen
  grund            text NOT NULL CHECK (length(btrim(grund)) BETWEEN 1 AND 4000),
  massnahme        text NOT NULL DEFAULT '' CHECK (length(massnahme) <= 4000),
  -- offen: eingereicht, noch nicht entschieden; traktandiert: vom Gremium zurückgestellt, für die Folgesitzung
  -- vorgeschlagen; erledigt: Entscheid «Erledigt mit Massnahme» (K3 Schritt 8)
  stand            text NOT NULL DEFAULT 'offen' CHECK (stand IN ('offen', 'traktandiert', 'erledigt')),
  ergebnis         text CHECK (ergebnis IN ('erledigt', 'zurueckgestellt')),
  entscheid_begruendung text NOT NULL DEFAULT '' CHECK (length(entscheid_begruendung) <= 4000),
  entschieden_at   timestamptz,
  version          int NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at       timestamptz NOT NULL DEFAULT now(),
  created_by       uuid DEFAULT app.principal_id(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  updated_by       uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, id),
  -- je Bericht höchstens eine Eskalation
  UNIQUE (tenant_id, statusbericht_id),
  CHECK ((stand = 'erledigt') = (ergebnis IS NOT DISTINCT FROM 'erledigt')),
  FOREIGN KEY (tenant_id, projekt_id) REFERENCES ppm.projekt (tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, statusbericht_id) REFERENCES ppm.statusbericht (tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX eskalation_projekt ON ppm.eskalation (tenant_id, projekt_id, created_at);

CREATE FUNCTION ppm.eskalation_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = ppm, pg_temp AS $$
BEGIN
  NEW.version := OLD.version + 1;
  NEW.updated_at := now();
  NEW.updated_by := app.principal_id();
  NEW.created_at := OLD.created_at;
  NEW.created_by := OLD.created_by;
  NEW.projekt_id := OLD.projekt_id;
  NEW.statusbericht_id := OLD.statusbericht_id;
  RETURN NEW;
END $$;
CREATE TRIGGER eskalation_touch BEFORE UPDATE ON ppm.eskalation FOR EACH ROW EXECUTE FUNCTION ppm.eskalation_touch();
REVOKE ALL ON FUNCTION ppm.eskalation_touch() FROM PUBLIC;

SELECT app.secure_tenant_tables();

-- Lesesicht, Muster KIND (fachmodell.md 3.4): lesen, wer das Projekt sieht. Anlegen und Zurücknehmen (Zurückziehen des
-- Berichts) mit statusbericht:write am Projekt; den Entscheid führt nach, wer im Gremium Entscheide erfasst
-- (sitzung:write an der Organisation oder am Portfolio, UC-006 Schritt 7).
CREATE POLICY eskalation_read ON ppm.eskalation AS RESTRICTIVE FOR SELECT TO ppm_app USING (ppm.projekt_sichtbar(projekt_id));
CREATE POLICY eskalation_insert ON ppm.eskalation AS RESTRICTIVE FOR INSERT TO ppm_app
  WITH CHECK (app.has_permission('statusbericht:write', 'projekt', projekt_id));
CREATE POLICY eskalation_update ON ppm.eskalation AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('sitzung:write') OR app.has_permission('sitzung:write', 'portfolio', ppm.portfolio_von(projekt_id)))
  WITH CHECK (app.has_permission('sitzung:write') OR app.has_permission('sitzung:write', 'portfolio', ppm.portfolio_von(projekt_id)));
CREATE POLICY eskalation_delete ON ppm.eskalation AS RESTRICTIVE FOR DELETE TO ppm_app
  USING (stand = 'offen' AND app.has_permission('statusbericht:write', 'projekt', projekt_id));
