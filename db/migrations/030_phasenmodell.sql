-- Phasenmodell mit Gates (BC AM.02.03, UC-017 Schritte 3 und 5; docs/fachmodell.md 2.3): Phasen Pre-P0 bis P4, Gates
-- mit Leitfragen je Wertestrom, Standard-Lieferergebnisse und -Meilensteine je Phase, Pflichtangaben des Projektvertrags
-- (K13, A-12), Kapitel mit Wirkung auf Scope, Budget und Ressourcen (UC-007 A1), Fristen (A-27) und Toleranzen (A-10).
--
-- Versioniert: Die UE bearbeitet einen Entwurf, ADM setzt ihn in Kraft; danach ist die Version unveränderlich und die
-- vorherige abgelöst. Eine neue Version gilt für ein Projekt ab seinem nächsten Gate (A-13, K15).
--
-- Phasen und Gates haben feste Codes (das System kennt ihr Verhalten); die Kinder verweisen über (Version, Code) auf
-- sie, damit eine Version als Ganzes kopiert werden kann.

CREATE TABLE ppm.phasenmodell (
  tenant_id    uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id           uuid NOT NULL DEFAULT gen_random_uuid(),
  nummer       int NOT NULL CHECK (nummer >= 1),
  stand        text NOT NULL DEFAULT 'entwurf' CHECK (stand IN ('entwurf', 'in_kraft', 'abgeloest')),
  beschreibung text NOT NULL DEFAULT '' CHECK (length(beschreibung) <= 2000),
  in_kraft_ab  timestamptz,
  in_kraft_by  uuid,
  version      int NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid DEFAULT app.principal_id(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, id),
  CHECK ((stand = 'entwurf') = (in_kraft_ab IS NULL))
);
CREATE UNIQUE INDEX phasenmodell_nummer ON ppm.phasenmodell (tenant_id, nummer);
-- Höchstens eine Version in Kraft (UC-017 Schritt 5) und höchstens ein Entwurf je Organisation
CREATE UNIQUE INDEX phasenmodell_in_kraft ON ppm.phasenmodell (tenant_id) WHERE stand = 'in_kraft';
CREATE UNIQUE INDEX phasenmodell_entwurf ON ppm.phasenmodell (tenant_id) WHERE stand = 'entwurf';

CREATE TABLE ppm.phase (
  tenant_id       uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id              uuid NOT NULL DEFAULT gen_random_uuid(),
  phasenmodell_id uuid NOT NULL,
  code            text NOT NULL CHECK (code IN ('PRE_P0', 'P0', 'P1', 'P2', 'P3', 'P4')),
  name            text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  position        int NOT NULL CHECK (position BETWEEN 0 AND 99),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, phasenmodell_id, code),
  FOREIGN KEY (tenant_id, phasenmodell_id) REFERENCES ppm.phasenmodell (tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE ppm.gate (
  tenant_id       uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id              uuid NOT NULL DEFAULT gen_random_uuid(),
  phasenmodell_id uuid NOT NULL,
  code            text NOT NULL CHECK (code IN ('EINTRITT_P0', 'P0_P1', 'P1_P2', 'P2_P3', 'P3_P4', 'EXIT_P4')),
  name            text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  von_phase       text NOT NULL,
  nach_phase      text,
  position        int NOT NULL CHECK (position BETWEEN 0 AND 99),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, phasenmodell_id, code),
  FOREIGN KEY (tenant_id, phasenmodell_id) REFERENCES ppm.phasenmodell (tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, phasenmodell_id, von_phase) REFERENCES ppm.phase (tenant_id, phasenmodell_id, code) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, phasenmodell_id, nach_phase) REFERENCES ppm.phase (tenant_id, phasenmodell_id, code) ON DELETE CASCADE
);

-- Je Gate Leitfragen entlang der Werteströme (Codewert der Codetabelle `wertestrom`, Q6 F6, Q8 Abb. 6)
CREATE TABLE ppm.leitfrage (
  tenant_id       uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id              uuid NOT NULL DEFAULT gen_random_uuid(),
  phasenmodell_id uuid NOT NULL,
  gate_code       text NOT NULL,
  wertestrom      text NOT NULL CHECK (wertestrom ~ '^[a-z][a-z0-9_]{0,39}$'),
  position        int NOT NULL CHECK (position BETWEEN 0 AND 999),
  text            text NOT NULL CHECK (length(btrim(text)) BETWEEN 1 AND 1000),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, phasenmodell_id, gate_code) REFERENCES ppm.gate (tenant_id, phasenmodell_id, code) ON DELETE CASCADE
);
CREATE INDEX leitfrage_gate ON ppm.leitfrage (tenant_id, phasenmodell_id, gate_code, position);

-- Standard-Lieferergebnisse und -Meilensteine je Phase: Vorschlag beim Planen (UC-002 Schritt 6, Q8 Kap. 7, Anhang 1)
CREATE TABLE ppm.standard_ergebnis (
  tenant_id       uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id              uuid NOT NULL DEFAULT gen_random_uuid(),
  phasenmodell_id uuid NOT NULL,
  phase_code      text NOT NULL,
  art             text NOT NULL CHECK (art IN ('lieferergebnis', 'meilenstein')),
  position        int NOT NULL CHECK (position BETWEEN 0 AND 999),
  text            text NOT NULL CHECK (length(btrim(text)) BETWEEN 1 AND 500),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, phasenmodell_id, phase_code) REFERENCES ppm.phase (tenant_id, phasenmodell_id, code) ON DELETE CASCADE
);
CREATE INDEX standard_ergebnis_phase ON ppm.standard_ergebnis (tenant_id, phasenmodell_id, phase_code, position);

-- Pflichtangaben des Projektvertrags je Phase oder Gate (K13 offen, A-12): Kapitel 1–13 der Vorlage (Q7), Feld nach dem
-- Schema des Kapitels (Modul vertrag)
CREATE TABLE ppm.pflichtangabe (
  tenant_id       uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id              uuid NOT NULL DEFAULT gen_random_uuid(),
  phasenmodell_id uuid NOT NULL,
  phase_code      text,
  gate_code       text,
  kapitel         int NOT NULL CHECK (kapitel BETWEEN 1 AND 13),
  feld            text NOT NULL CHECK (feld ~ '^[a-z][a-z0-9_]{0,59}$'),
  position        int NOT NULL CHECK (position BETWEEN 0 AND 999),
  text            text NOT NULL CHECK (length(btrim(text)) BETWEEN 1 AND 500),
  PRIMARY KEY (tenant_id, id),
  CHECK ((phase_code IS NULL) <> (gate_code IS NULL)),
  FOREIGN KEY (tenant_id, phasenmodell_id, phase_code) REFERENCES ppm.phase (tenant_id, phasenmodell_id, code) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, phasenmodell_id, gate_code) REFERENCES ppm.gate (tenant_id, phasenmodell_id, code) ON DELETE CASCADE
);
CREATE INDEX pflichtangabe_modell ON ppm.pflichtangabe (tenant_id, phasenmodell_id, position);

-- Kapitel des Vertrags mit Wirkung auf Scope, Budget oder Ressourcen: Änderung an den PRAT (UC-007 A1)
CREATE TABLE ppm.kapitel_wirkung (
  tenant_id       uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id              uuid NOT NULL DEFAULT gen_random_uuid(),
  phasenmodell_id uuid NOT NULL,
  kapitel         int NOT NULL CHECK (kapitel BETWEEN 1 AND 13),
  dimension       text NOT NULL CHECK (dimension IN ('scope', 'budget', 'ressourcen')),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, phasenmodell_id, kapitel, dimension),
  FOREIGN KEY (tenant_id, phasenmodell_id) REFERENCES ppm.phasenmodell (tenant_id, id) ON DELETE CASCADE
);

-- Fristen der Zyklen (docs/fachmodell.md 2.14, A-26, A-27, Q8 Kap. 8.1, 8.4); nie als Konstante im Code
CREATE TABLE ppm.frist (
  tenant_id       uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id              uuid NOT NULL DEFAULT gen_random_uuid(),
  phasenmodell_id uuid NOT NULL,
  schluessel      text NOT NULL CHECK (schluessel IN ('bericht_aufgabe', 'bericht_stichtag', 'gate_vorbereiten', 'sitzung_vorbereiten', 'versand', 'protokoll')),
  wert            int NOT NULL CHECK (wert BETWEEN 0 AND 365),
  einheit         text NOT NULL CHECK (einheit IN ('tag_im_monat', 'arbeitstage', 'kalendertage')),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, phasenmodell_id, schluessel),
  FOREIGN KEY (tenant_id, phasenmodell_id) REFERENCES ppm.phasenmodell (tenant_id, id) ON DELETE CASCADE,
  CHECK (einheit <> 'tag_im_monat' OR wert BETWEEN 1 AND 31)
);

-- Standardtoleranzen; der Vertrag kann sie je Projekt übersteuern, ohne Wert keine Warnung «wesentlich» (A-10, K11)
CREATE TABLE ppm.toleranz (
  tenant_id       uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id              uuid NOT NULL DEFAULT gen_random_uuid(),
  phasenmodell_id uuid NOT NULL,
  dimension       text NOT NULL CHECK (dimension IN ('termin', 'kosten', 'umfang')),
  wert            numeric(12, 2) CHECK (wert >= 0),
  einheit         text NOT NULL CHECK (einheit IN ('prozent', 'kalendertage', 'arbeitstage')),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, phasenmodell_id, dimension),
  FOREIGN KEY (tenant_id, phasenmodell_id) REFERENCES ppm.phasenmodell (tenant_id, id) ON DELETE CASCADE
);

-- Version und Änderungszeit setzt die Datenbank; eine Version in Kraft wird nur noch abgelöst, eine abgelöste nie mehr
-- geändert (UC-017 Schritt 5: nachvollziehbar, welche Version wann galt)
CREATE FUNCTION ppm.phasenmodell_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = ppm, pg_temp AS $$
BEGIN
  IF OLD.stand = 'abgeloest'
     OR (OLD.stand = 'in_kraft' AND (NEW.stand <> 'abgeloest' OR NEW.beschreibung IS DISTINCT FROM OLD.beschreibung OR NEW.in_kraft_ab IS DISTINCT FROM OLD.in_kraft_ab))
     OR (OLD.stand = 'entwurf' AND NEW.stand = 'abgeloest')
     OR NEW.nummer <> OLD.nummer THEN
    RAISE EXCEPTION 'Phasenmodell % (%) ist nicht änderbar', OLD.nummer, OLD.stand USING ERRCODE = 'check_violation';
  END IF;
  NEW.version := OLD.version + 1;
  NEW.updated_at := now();
  NEW.updated_by := app.principal_id();
  NEW.created_at := OLD.created_at;
  NEW.created_by := OLD.created_by;
  RETURN NEW;
END $$;
CREATE TRIGGER phasenmodell_touch BEFORE UPDATE ON ppm.phasenmodell FOR EACH ROW EXECUTE FUNCTION ppm.phasenmodell_touch();
REVOKE ALL ON FUNCTION ppm.phasenmodell_touch() FROM PUBLIC;

SELECT app.secure_tenant_tables();

-- Lesesicht (docs/fachmodell.md 3.4, Muster ORG): lesen mit phasenmodell:read, pflegen mit phasenmodell:write, in Kraft
-- setzen mit phasenmodell:activate. Löschen nur als Entwurf (Entwurf verwerfen).
CREATE POLICY phasenmodell_read ON ppm.phasenmodell AS RESTRICTIVE FOR SELECT TO ppm_app USING (app.has_permission('phasenmodell:read'));
CREATE POLICY phasenmodell_insert ON ppm.phasenmodell AS RESTRICTIVE FOR INSERT TO ppm_app WITH CHECK (app.has_permission('phasenmodell:write') AND stand = 'entwurf');
CREATE POLICY phasenmodell_update ON ppm.phasenmodell AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('phasenmodell:write') OR app.has_permission('phasenmodell:activate'))
  WITH CHECK (app.has_permission('phasenmodell:write') OR app.has_permission('phasenmodell:activate'));
CREATE POLICY phasenmodell_delete ON ppm.phasenmodell AS RESTRICTIVE FOR DELETE TO ppm_app USING (app.has_permission('phasenmodell:write') AND stand = 'entwurf');

-- Kinder: lesen wie das Modell; schreiben nur mit phasenmodell:write und nur im Entwurf (in Kraft = unveränderlich)
DO $$
DECLARE t text;
  entwurf text := 'app.has_permission(''phasenmodell:write'') AND EXISTS (SELECT 1 FROM ppm.phasenmodell m WHERE m.tenant_id = %1$I.tenant_id AND m.id = %1$I.phasenmodell_id AND m.stand = ''entwurf'')';
BEGIN
  FOREACH t IN ARRAY ARRAY['phase', 'gate', 'leitfrage', 'standard_ergebnis', 'pflichtangabe', 'kapitel_wirkung', 'frist', 'toleranz'] LOOP
    EXECUTE format('CREATE POLICY %1$s_read ON ppm.%1$I AS RESTRICTIVE FOR SELECT TO ppm_app USING (app.has_permission(''phasenmodell:read''))', t);
    EXECUTE format('CREATE POLICY %1$s_insert ON ppm.%1$I AS RESTRICTIVE FOR INSERT TO ppm_app WITH CHECK (' || entwurf || ')', t);
    EXECUTE format('CREATE POLICY %1$s_update ON ppm.%1$I AS RESTRICTIVE FOR UPDATE TO ppm_app USING (' || entwurf || ') WITH CHECK (' || entwurf || ')', t);
    EXECUTE format('CREATE POLICY %1$s_delete ON ppm.%1$I AS RESTRICTIVE FOR DELETE TO ppm_app USING (' || entwurf || ')', t);
  END LOOP;
END $$;
