-- Abschluss, Sistierung, Abbruch und Lessons Learned (docs/fachmodell.md 2.13; AP-E7-1): PS.04.01–03, PC.03.02,
-- PC.03.04; UC-015. Setzt 010 (Projekt, Hilfsfunktionen) und 130/140 (Sitzung, Traktandum) voraus.

-- Abschlussbericht je Projekt (UC-015 Schritte 1–6, A1, A2): am Exit-Gate P4 (`abschluss`) oder nach dem Entscheid zu
-- Sistierung (`sistierung`) bzw. Abbruch (`abbruch`). Höchstens ein offener Bericht je Projekt; ein sistiertes und
-- wieder aufgenommenes Projekt kann mehrere abgeschlossene Berichte haben.
CREATE TABLE ppm.abschlussbericht (
  tenant_id      uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id             uuid NOT NULL DEFAULT gen_random_uuid(),
  projekt_id     uuid NOT NULL,
  art            text NOT NULL CHECK (art IN ('abschluss', 'sistierung', 'abbruch')),
  stand          text NOT NULL DEFAULT 'entwurf' CHECK (stand IN ('entwurf', 'eingereicht', 'traktandiert', 'abgenommen', 'nacharbeit')),
  -- Stand des Vorhabens bei Sistierung oder Abbruch (UC-015 A1.1)
  projektstand   text NOT NULL DEFAULT '' CHECK (length(projektstand) <= 10000),
  -- Zielerreichung mit erreichten Werten je KPI (UC-015 Schritt 2): [{"kpiId": "…", "wert": "62 %", "bemerkung": "…"}]
  zielerreichung text NOT NULL DEFAULT '' CHECK (length(zielerreichung) <= 10000),
  kpi_werte      jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(kpi_werte) = 'array' AND length(kpi_werte::text) <= 100000),
  -- Business Case Abschluss P4 mit Kosten und Nutzen (UC-015 Schritt 2, PC.03.04)
  business_case  text NOT NULL DEFAULT '' CHECK (length(business_case) <= 10000),
  -- Übergabe an Betrieb und Linie, offene Punkte mit Verantwortlichen (UC-015 Schritt 4):
  -- [{"text": "…", "verantwortlich": "…", "termin": "2027-03-31"}]
  uebergabe      text NOT NULL DEFAULT '' CHECK (length(uebergabe) <= 10000),
  offene_punkte  jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(offene_punkte) = 'array' AND length(offene_punkte::text) <= 100000),
  -- Beurteilung der Nutzenrealisierung durch Sponsor und UE (UC-015 Schritt 3, PC.03.02)
  nutzen_sp      text NOT NULL DEFAULT '' CHECK (length(nutzen_sp) <= 5000),
  nutzen_sp_at   timestamptz,
  nutzen_sp_by   uuid,
  nutzen_ue      text NOT NULL DEFAULT '' CHECK (length(nutzen_ue) <= 5000),
  nutzen_ue_at   timestamptz,
  nutzen_ue_by   uuid,
  -- Exit-Gate: Traktandum der Art `abschluss` (UC-015 Schritt 5) und Abnahme (Schritt 6)
  traktandum_id  uuid,
  eingereicht_at timestamptz,
  eingereicht_by uuid,
  abgenommen_at  timestamptz,
  version        int NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid DEFAULT app.principal_id(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  updated_by     uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, projekt_id) REFERENCES ppm.projekt (tenant_id, id) ON DELETE CASCADE,
  CHECK (stand IN ('entwurf', 'nacharbeit') OR eingereicht_at IS NOT NULL),
  CHECK (stand <> 'abgenommen' OR abgenommen_at IS NOT NULL),
  CHECK (art = 'abschluss' OR stand IN ('entwurf', 'eingereicht'))
);
-- Offen: in Arbeit oder beim Gremium (ohne Gremium bleibt der Abschlussbericht «eingereicht», bis die UE einplant)
CREATE UNIQUE INDEX abschlussbericht_offen ON ppm.abschlussbericht (tenant_id, projekt_id)
  WHERE stand IN ('entwurf', 'nacharbeit', 'traktandiert') OR (art = 'abschluss' AND stand = 'eingereicht');
CREATE INDEX abschlussbericht_projekt ON ppm.abschlussbericht (tenant_id, projekt_id, created_at);

-- Folge eines Entscheids zu Abschluss, Sistierung, Abbruch oder Wiederaufnahme (Traktandenart `abschluss`, Gate
-- «Gestoppt»; fachmodell.md 2.9) mit dem Stand davor, damit eine Korrektur in der Sitzung (A-30) sie zurücknehmen kann.
-- Quelle: das Traktandum bzw. die Vertragsversion des Gate-Entscheids.
CREATE TABLE ppm.abschluss_entscheid (
  tenant_id           uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id                  uuid NOT NULL DEFAULT gen_random_uuid(),
  projekt_id          uuid NOT NULL,
  quelle              text NOT NULL CHECK (quelle IN ('traktandum', 'gate')),
  quelle_id           uuid NOT NULL,
  -- Lage beim ersten Entscheid: Exit-Gate mit Abschlussbericht, aktives oder sistiertes Projekt
  kontext             text NOT NULL CHECK (kontext IN ('exit', 'aktiv', 'sistiert')),
  ergebnis            text NOT NULL CHECK (ergebnis IN ('abgeschlossen', 'nacharbeiten', 'sistiert', 'abgebrochen', 'weiterfuehren')),
  vorher_lebenszyklus text NOT NULL CHECK (vorher_lebenszyklus IN ('aktiv', 'sistiert')),
  bericht_id          uuid,
  -- Art des Berichts vor der Folge, wenn sie einen offenen Bericht umgewidmet hat (null = Bericht neu angelegt)
  bericht_art_vorher  text CHECK (bericht_art_vorher IN ('abschluss', 'sistierung', 'abbruch')),
  entschieden_at      timestamptz NOT NULL DEFAULT now(),
  version             int NOT NULL DEFAULT 1 CHECK (version >= 1),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  updated_by          uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, quelle, quelle_id),
  FOREIGN KEY (tenant_id, projekt_id) REFERENCES ppm.projekt (tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, bericht_id) REFERENCES ppm.abschlussbericht (tenant_id, id) ON DELETE SET NULL (bericht_id)
);
CREATE INDEX abschluss_entscheid_projekt ON ppm.abschluss_entscheid (tenant_id, projekt_id);

-- Lessons Learned je Projekt (PS.04.03; UC-015 Schritt 4, A1.1; UC-013 Schritt 1, A1): Jahr der Erfassung für den
-- Jahresrückblick (AP-E7-5); Kategorie als freier Begriff (keine Codetabelle in UC-017, Annahme AP-E7-1)
CREATE TABLE ppm.lessons_learned (
  tenant_id  uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id         uuid NOT NULL DEFAULT gen_random_uuid(),
  projekt_id uuid NOT NULL,
  text       text NOT NULL CHECK (length(btrim(text)) BETWEEN 1 AND 5000),
  kategorie  text NOT NULL DEFAULT '' CHECK (length(kategorie) <= 100),
  jahr       int NOT NULL DEFAULT extract(year FROM now() AT TIME ZONE 'Europe/Zurich')::int CHECK (jahr BETWEEN 2000 AND 2100),
  version    int NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT app.principal_id(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, projekt_id) REFERENCES ppm.projekt (tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX lessons_learned_projekt ON ppm.lessons_learned (tenant_id, projekt_id);
CREATE INDEX lessons_learned_jahr ON ppm.lessons_learned (tenant_id, jahr, created_at);

-- Stand (ETag) und Änderung je Zeile nachführen
CREATE FUNCTION ppm.abschluss_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = ppm, pg_temp AS $$
BEGIN
  NEW.version := OLD.version + 1;
  NEW.updated_at := now();
  NEW.updated_by := app.principal_id();
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION ppm.abschluss_touch() FROM PUBLIC;
CREATE TRIGGER abschlussbericht_touch BEFORE UPDATE ON ppm.abschlussbericht FOR EACH ROW EXECUTE FUNCTION ppm.abschluss_touch();
CREATE TRIGGER abschluss_entscheid_touch BEFORE UPDATE ON ppm.abschluss_entscheid FOR EACH ROW EXECUTE FUNCTION ppm.abschluss_touch();
CREATE TRIGGER lessons_learned_touch BEFORE UPDATE ON ppm.lessons_learned FOR EACH ROW EXECUTE FUNCTION ppm.abschluss_touch();

SELECT app.secure_tenant_tables();

-- Die Folge eines Gremiumsentscheids (Traktandenart `abschluss`, Gate «Gestoppt») läuft in der Transaktion der UE, die
-- den Entscheid erfasst; das Modul setzt dafür `app.abschluss_intern = 'on'` (wie `app.vertrag_intern`, 200).

-- Lesesicht (fachmodell.md 3.4), Muster KIND: lesen, wer das Projekt sieht; schreiben mit projekt:write am Projekt (PL,
-- UE), die Beurteilung der Nutzenrealisierung auch mit vertrag:decide (SP) bzw. vertrag:review (UE)
CREATE POLICY abschlussbericht_read ON ppm.abschlussbericht AS RESTRICTIVE FOR SELECT TO ppm_app USING (ppm.projekt_sichtbar(projekt_id));
CREATE POLICY abschlussbericht_insert ON ppm.abschlussbericht AS RESTRICTIVE FOR INSERT TO ppm_app
  WITH CHECK (app.has_permission('projekt:write', 'projekt', projekt_id) OR current_setting('app.abschluss_intern', true) = 'on');
CREATE POLICY abschlussbericht_update ON ppm.abschlussbericht AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('projekt:write', 'projekt', projekt_id) OR app.has_permission('vertrag:decide', 'projekt', projekt_id)
    OR app.has_permission('vertrag:review') OR current_setting('app.abschluss_intern', true) = 'on')
  WITH CHECK (app.has_permission('projekt:write', 'projekt', projekt_id) OR app.has_permission('vertrag:decide', 'projekt', projekt_id)
    OR app.has_permission('vertrag:review') OR current_setting('app.abschluss_intern', true) = 'on');
-- Löschen nur als Rücknahme einer Sistierung in der Sitzung (unbearbeiteter Entwurf, A-30)
CREATE POLICY abschlussbericht_delete ON ppm.abschlussbericht AS RESTRICTIVE FOR DELETE TO ppm_app
  USING (current_setting('app.abschluss_intern', true) = 'on');

CREATE POLICY abschluss_entscheid_read ON ppm.abschluss_entscheid AS RESTRICTIVE FOR SELECT TO ppm_app USING (ppm.projekt_sichtbar(projekt_id));
CREATE POLICY abschluss_entscheid_insert ON ppm.abschluss_entscheid AS RESTRICTIVE FOR INSERT TO ppm_app
  WITH CHECK (current_setting('app.abschluss_intern', true) = 'on');
CREATE POLICY abschluss_entscheid_update ON ppm.abschluss_entscheid AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (current_setting('app.abschluss_intern', true) = 'on') WITH CHECK (current_setting('app.abschluss_intern', true) = 'on');
REVOKE DELETE ON ppm.abschluss_entscheid FROM ppm_app;

CREATE POLICY lessons_learned_read ON ppm.lessons_learned AS RESTRICTIVE FOR SELECT TO ppm_app USING (ppm.projekt_sichtbar(projekt_id));
CREATE POLICY lessons_learned_insert ON ppm.lessons_learned AS RESTRICTIVE FOR INSERT TO ppm_app
  WITH CHECK (app.has_permission('projekt:write', 'projekt', projekt_id));
CREATE POLICY lessons_learned_update ON ppm.lessons_learned AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('projekt:write', 'projekt', projekt_id)) WITH CHECK (app.has_permission('projekt:write', 'projekt', projekt_id));
CREATE POLICY lessons_learned_delete ON ppm.lessons_learned AS RESTRICTIVE FOR DELETE TO ppm_app
  USING (app.has_permission('projekt:write', 'projekt', projekt_id));
