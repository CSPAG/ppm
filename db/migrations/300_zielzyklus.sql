-- Zielzyklus (BC ZM.02.01, ZM.02.03, ZM.02.04, PP.02.05; UC-011 Schritte 1–5; Kernablauf K6; docs/fachmodell.md 2.7):
-- Zieljahr mit Bearbeitungsstand, Jahresziele je strategischem Ziel mit Metrik und Zielwert, Hauptaktivitäten mit
-- verantwortlicher Person, Zuordnung der Projekte zu strategischem Ziel und Jahresziel. Freigabe (zur_freigabe,
-- in_kraft) setzt AP-E6-2 (Bereich 310–319); ab «zur Freigabe» sind die Jahresziele gesperrt (UC-011 Schritt 6).

CREATE TABLE ppm.zieljahr (
  tenant_id      uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id             uuid NOT NULL DEFAULT gen_random_uuid(),
  -- Schlüssel in der Oberfläche (I-N5): /ziele/2027
  jahr           int NOT NULL CHECK (jahr BETWEEN 2000 AND 2100),
  -- Jahresziele werden gemeinsam vorgelegt und freigegeben (UX-E8, UC-011 Schritte 6–7)
  stand          text NOT NULL DEFAULT 'in_arbeit' CHECK (stand IN ('in_arbeit', 'zur_freigabe', 'in_kraft')),
  -- geplante Vorlage an den VR (K6 Einstieg: «Vorlage an den VR bis ‹Datum›»), Frist der Aufgabe
  vorlage_bis    date,
  freigabe_at    timestamptz,
  freigabe_text  text NOT NULL DEFAULT '' CHECK (length(freigabe_text) <= 4000),
  version        int NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid DEFAULT app.principal_id(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  updated_by     uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, jahr)
);

CREATE TABLE ppm.jahresziel (
  tenant_id             uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id                    uuid NOT NULL DEFAULT gen_random_uuid(),
  jahr                  int NOT NULL,
  strategisches_ziel_id uuid NOT NULL,
  -- «2.1.3»: Nummer des strategischen Ziels und laufende Nummer (K6 Regeln), eindeutig im Jahr
  nummer                text NOT NULL CHECK (nummer ~ '^[0-9]{1,3}(\.[0-9]{1,3}){0,4}$'),
  nummer_sort           int[] GENERATED ALWAYS AS (string_to_array(nummer, '.')::int[]) STORED,
  text                  text NOT NULL CHECK (length(btrim(text)) BETWEEN 1 AND 1000),
  -- je Ziel eine Metrik mit Zielwert (ZM.02.04, UC-011 Schritt 5); leer = fehlt (Prüfbericht, Sperre beim Vorlegen)
  metrik                text NOT NULL DEFAULT '' CHECK (length(metrik) <= 500),
  zielwert              text NOT NULL DEFAULT '' CHECK (length(zielwert) <= 200),
  version               int NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at            timestamptz NOT NULL DEFAULT now(),
  created_by            uuid DEFAULT app.principal_id(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  updated_by            uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, id),
  -- für die Zuordnung der Projekte: Jahresziel und strategisches Ziel passen zusammen
  UNIQUE (tenant_id, id, strategisches_ziel_id),
  FOREIGN KEY (tenant_id, jahr) REFERENCES ppm.zieljahr (tenant_id, jahr),
  -- strategisches Ziel mit Jahreszielen lässt sich nicht löschen
  FOREIGN KEY (tenant_id, strategisches_ziel_id) REFERENCES ppm.strategisches_ziel (tenant_id, id)
);
CREATE UNIQUE INDEX jahresziel_nummer ON ppm.jahresziel (tenant_id, jahr, nummer);
CREATE INDEX jahresziel_list ON ppm.jahresziel (tenant_id, jahr, nummer_sort, id);
CREATE INDEX jahresziel_strategisch ON ppm.jahresziel (tenant_id, strategisches_ziel_id);

CREATE TABLE ppm.hauptaktivitaet (
  tenant_id      uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id             uuid NOT NULL DEFAULT gen_random_uuid(),
  jahresziel_id  uuid NOT NULL,
  text           text NOT NULL CHECK (length(btrim(text)) BETWEEN 1 AND 1000),
  -- verantwortliche Person (ZM.02.03, UC-011 Schritt 4); geprüft gegen ppm.principal beim Speichern
  verantwortlich uuid,
  position       int NOT NULL DEFAULT 0,
  version        int NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid DEFAULT app.principal_id(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  updated_by     uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, id),
  -- Teil des Jahresziels: wird mit ihm gelöscht
  FOREIGN KEY (tenant_id, jahresziel_id) REFERENCES ppm.jahresziel (tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX hauptaktivitaet_jahresziel ON ppm.hauptaktivitaet (tenant_id, jahresziel_id, position, id);

-- Zuordnung Projekt ↔ Ziel (PP.02.05): aus dem Zielzyklus (UC-011 Schritt 4) und später aus Vertrag Kap. 2 (AP-E3-1)
CREATE TABLE ppm.ziel_projekt (
  tenant_id             uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id                    uuid NOT NULL DEFAULT gen_random_uuid(),
  projekt_id            uuid NOT NULL,
  strategisches_ziel_id uuid NOT NULL,
  jahresziel_id         uuid,
  created_at            timestamptz NOT NULL DEFAULT now(),
  created_by            uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, projekt_id) REFERENCES ppm.projekt (tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, strategisches_ziel_id) REFERENCES ppm.strategisches_ziel (tenant_id, id) ON DELETE CASCADE,
  -- Jahresziel gelöscht: die Zuordnung zum strategischen Ziel bleibt
  FOREIGN KEY (tenant_id, jahresziel_id, strategisches_ziel_id) REFERENCES ppm.jahresziel (tenant_id, id, strategisches_ziel_id)
    ON DELETE SET NULL (jahresziel_id)
);
CREATE UNIQUE INDEX ziel_projekt_eindeutig ON ppm.ziel_projekt (tenant_id, projekt_id, strategisches_ziel_id, coalesce(jahresziel_id, '00000000-0000-0000-0000-000000000000'));
CREATE INDEX ziel_projekt_ziel ON ppm.ziel_projekt (tenant_id, strategisches_ziel_id);
CREATE INDEX ziel_projekt_jahresziel ON ppm.ziel_projekt (tenant_id, jahresziel_id) WHERE jahresziel_id IS NOT NULL;

-- Version und Änderungszeit setzt die Datenbank (ETag/If-Match über version)
CREATE FUNCTION ppm.zielzyklus_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = ppm, pg_temp AS $$
BEGIN
  NEW.version := OLD.version + 1;
  NEW.updated_at := now();
  NEW.updated_by := app.principal_id();
  NEW.created_at := OLD.created_at;
  NEW.created_by := OLD.created_by;
  RETURN NEW;
END $$;
CREATE TRIGGER zieljahr_touch BEFORE UPDATE ON ppm.zieljahr FOR EACH ROW EXECUTE FUNCTION ppm.zielzyklus_touch();
CREATE TRIGGER jahresziel_touch BEFORE UPDATE ON ppm.jahresziel FOR EACH ROW EXECUTE FUNCTION ppm.zielzyklus_touch();
CREATE TRIGGER hauptaktivitaet_touch BEFORE UPDATE ON ppm.hauptaktivitaet FOR EACH ROW EXECUTE FUNCTION ppm.zielzyklus_touch();
REVOKE ALL ON FUNCTION ppm.zielzyklus_touch() FROM PUBLIC;

SELECT app.secure_tenant_tables();

-- Lesesicht nach Muster ORG (docs/fachmodell.md 3.4): zieljahr, jahresziel, hauptaktivitaet
CREATE POLICY zieljahr_read ON ppm.zieljahr AS RESTRICTIVE FOR SELECT TO ppm_app USING (app.has_permission('ziel:read'));
-- Freigabe erfassen (UE, AP-E6-2) ändert den Stand mit ziel:freigabe
CREATE POLICY zieljahr_insert ON ppm.zieljahr AS RESTRICTIVE FOR INSERT TO ppm_app WITH CHECK (app.has_permission('ziel:write'));
CREATE POLICY zieljahr_update ON ppm.zieljahr AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('ziel:write') OR app.has_permission('ziel:freigabe'))
  WITH CHECK (app.has_permission('ziel:write') OR app.has_permission('ziel:freigabe'));
CREATE POLICY zieljahr_delete ON ppm.zieljahr AS RESTRICTIVE FOR DELETE TO ppm_app USING (app.has_permission('ziel:write'));

CREATE POLICY jahresziel_read ON ppm.jahresziel AS RESTRICTIVE FOR SELECT TO ppm_app USING (app.has_permission('ziel:read'));
CREATE POLICY jahresziel_insert ON ppm.jahresziel AS RESTRICTIVE FOR INSERT TO ppm_app WITH CHECK (app.has_permission('ziel:write'));
CREATE POLICY jahresziel_update ON ppm.jahresziel AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('ziel:write')) WITH CHECK (app.has_permission('ziel:write'));
CREATE POLICY jahresziel_delete ON ppm.jahresziel AS RESTRICTIVE FOR DELETE TO ppm_app USING (app.has_permission('ziel:write'));

CREATE POLICY hauptaktivitaet_read ON ppm.hauptaktivitaet AS RESTRICTIVE FOR SELECT TO ppm_app USING (app.has_permission('ziel:read'));
CREATE POLICY hauptaktivitaet_insert ON ppm.hauptaktivitaet AS RESTRICTIVE FOR INSERT TO ppm_app WITH CHECK (app.has_permission('ziel:write'));
CREATE POLICY hauptaktivitaet_update ON ppm.hauptaktivitaet AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('ziel:write')) WITH CHECK (app.has_permission('ziel:write'));
CREATE POLICY hauptaktivitaet_delete ON ppm.hauptaktivitaet AS RESTRICTIVE FOR DELETE TO ppm_app USING (app.has_permission('ziel:write'));

-- Muster KIND: sichtbar mit dem Projekt; schreiben mit ziel:write (an der Organisation oder am Projekt)
CREATE POLICY ziel_projekt_read ON ppm.ziel_projekt AS RESTRICTIVE FOR SELECT TO ppm_app USING (ppm.projekt_sichtbar(projekt_id));
CREATE POLICY ziel_projekt_insert ON ppm.ziel_projekt AS RESTRICTIVE FOR INSERT TO ppm_app
  WITH CHECK (app.has_permission('ziel:write', 'projekt', projekt_id));
CREATE POLICY ziel_projekt_update ON ppm.ziel_projekt AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('ziel:write', 'projekt', projekt_id)) WITH CHECK (app.has_permission('ziel:write', 'projekt', projekt_id));
CREATE POLICY ziel_projekt_delete ON ppm.ziel_projekt AS RESTRICTIVE FOR DELETE TO ppm_app
  USING (app.has_permission('ziel:write', 'projekt', projekt_id));
