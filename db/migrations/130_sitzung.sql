-- Sitzungen vorbereiten (BC PP.04.01, PP.04.05; UC-006 Schritte 1–5, A1, A2; Kernablauf K3; docs/fachmodell.md 2.9):
-- Sitzung je Gremium und Termin, Traktanden (auch Vorschläge ohne Sitzung), Einladungen und Unterlagen beim Versand.
-- Entscheide, Auflagen und Protokoll ergänzt AP-E2-2 (140–149).

CREATE TABLE ppm.sitzung (
  tenant_id          uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id                 uuid NOT NULL DEFAULT gen_random_uuid(),
  -- Portfolio des Gremiums (Ort im Rechtemodell, A-45); fest mit dem Gremium
  portfolio_id       uuid NOT NULL,
  gremium_id         uuid NOT NULL,
  -- Schlüssel in Adressen (/gremien/<kuerzel>/sitzungen/<datum>, I-N5); entsteht aus einem Sitzungstermin
  datum              date NOT NULL,
  beginn             time,
  -- Sitzungsdauer für «2 h 50 von 3 h» (K3 Schritt 1); ohne Angabe keine Summe gegen die Dauer
  dauer_min          int CHECK (dauer_min BETWEEN 15 AND 720),
  ort                text NOT NULL DEFAULT '' CHECK (length(ort) <= 200),
  -- laufend, geschlossen, protokoll_versendet setzt AP-E2-2
  stand              text NOT NULL DEFAULT 'geplant'
                     CHECK (stand IN ('geplant', 'in_vorbereitung', 'versendet', 'laufend', 'geschlossen', 'protokoll_versendet')),
  -- Versandprotokoll (UC-006 Schritt 5, K3-1): Zeitpunkt, Person und Arbeitstage vor der Sitzung
  versendet_at       timestamptz,
  versendet_by       uuid,
  versand_vorlauf    int,
  geschlossen_at     timestamptz,
  protokoll_versendet_at timestamptz,
  version            int NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at         timestamptz NOT NULL DEFAULT now(),
  created_by         uuid DEFAULT app.principal_id(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  updated_by         uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, gremium_id, datum),
  CHECK (stand IN ('geplant', 'in_vorbereitung') OR versendet_at IS NOT NULL),
  FOREIGN KEY (tenant_id, portfolio_id, gremium_id) REFERENCES ppm.gremium (tenant_id, portfolio_id, id)
);
CREATE INDEX sitzung_portfolio ON ppm.sitzung (tenant_id, portfolio_id, datum);

-- Traktandum (fachmodell.md 2.9): Vorschlag ohne Sitzung (`sitzung_id` NULL, von anderen Modulen über
-- `traktandum.vorschlagen`), aufgenommen in eine Sitzung (`traktandiert`), auf die nächste Sitzung verschoben (UC-006
-- A2) oder entschieden (AP-E2-2). Art aus der Registry (2.9), Bezug als Text (UUID, Periode, Quartal …).
CREATE TABLE ppm.traktandum (
  tenant_id     uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id            uuid NOT NULL DEFAULT gen_random_uuid(),
  portfolio_id  uuid NOT NULL,
  gremium_id    uuid NOT NULL,
  sitzung_id    uuid,
  art           text NOT NULL CHECK (art IN ('portfoliobericht', 'gate', 'aenderung', 'meilenstein', 'eskalation', 'idee',
                                             'priorisierung', 'quartalsreporting', 'abschluss', 'jahresrueckblick')),
  bezug_typ     text NOT NULL CHECK (bezug_typ ~ '^[a-z_]{1,40}$'),
  bezug_id      text NOT NULL CHECK (length(bezug_id) BETWEEN 1 AND 100),
  projekt_id    uuid,
  titel         text NOT NULL CHECK (length(btrim(titel)) BETWEEN 1 AND 300),
  -- Antrag in einem Satz (K3 Schritt 6: «Freigabe Phase P2 und Projektvertrag Version 2.0»)
  antrag        text NOT NULL DEFAULT '' CHECK (length(antrag) <= 1000),
  position      int CHECK (position BETWEEN 1 AND 999),
  -- Zeitbedarf in Minuten (Gate-Review 35, UC-006 Schritt 2); ohne Angabe offen
  dauer_min     int CHECK (dauer_min BETWEEN 1 AND 480),
  stand         text NOT NULL DEFAULT 'vorgeschlagen' CHECK (stand IN ('vorgeschlagen', 'traktandiert', 'verschoben', 'entschieden')),
  -- Geschäft eines Projekts in P0/P1 bis zur Freigabe von P2: Entscheid des Gremiums ist Stellungnahme (UC-006 A1)
  via_sns       boolean NOT NULL DEFAULT false,
  -- vom Projekt übernommen (A-34, UX-OF-13)
  vertraulich   boolean NOT NULL DEFAULT false,
  -- Sitzung, von der das Traktandum verschoben wurde (A2): PL und SP werden mit deren Versand informiert
  verschoben_von uuid,
  -- Versand der Sitzung (für die Lesesicht der Mitglieder und Eingeladenen, ohne Abfrage der Sitzung)
  versendet_at  timestamptz,
  version       int NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid DEFAULT app.principal_id(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, id),
  CHECK (stand <> 'traktandiert' OR position IS NOT NULL),
  CHECK (sitzung_id IS NOT NULL OR stand = 'vorgeschlagen'),
  FOREIGN KEY (tenant_id, portfolio_id, gremium_id) REFERENCES ppm.gremium (tenant_id, portfolio_id, id),
  FOREIGN KEY (tenant_id, sitzung_id) REFERENCES ppm.sitzung (tenant_id, id),
  FOREIGN KEY (tenant_id, verschoben_von) REFERENCES ppm.sitzung (tenant_id, id),
  FOREIGN KEY (tenant_id, projekt_id) REFERENCES ppm.projekt (tenant_id, id)
);
CREATE INDEX traktandum_sitzung ON ppm.traktandum (tenant_id, sitzung_id, position);
CREATE INDEX traktandum_vorschlag ON ppm.traktandum (tenant_id, gremium_id) WHERE sitzung_id IS NULL;
CREATE INDEX traktandum_projekt ON ppm.traktandum (tenant_id, projekt_id) WHERE projekt_id IS NOT NULL;
-- je Geschäft höchstens ein offenes Traktandum (Vorschlagen ist idempotent)
CREATE UNIQUE INDEX traktandum_offen ON ppm.traktandum (tenant_id, art, bezug_typ, bezug_id) WHERE stand <> 'entschieden';

-- Einladung je Geschäft (PL, CTL, SP, UC-006 Schritt 2); versandt mit den Unterlagen (I-B3). Portfolio, Sitzung und
-- Versand sind vom Traktandum übernommen, damit die Lesesicht ohne Abfrage des Traktandums auskommt.
CREATE TABLE ppm.einladung (
  tenant_id     uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id            uuid NOT NULL DEFAULT gen_random_uuid(),
  traktandum_id uuid NOT NULL,
  sitzung_id    uuid NOT NULL,
  portfolio_id  uuid NOT NULL,
  person_id     uuid NOT NULL,
  -- Funktion im Projekt (sp, pl, ctl) oder weitere Person
  funktion      text NOT NULL CHECK (funktion IN ('sp', 'pl', 'ctl', 'weitere')),
  versendet_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, traktandum_id, person_id),
  FOREIGN KEY (tenant_id, traktandum_id) REFERENCES ppm.traktandum (tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, sitzung_id) REFERENCES ppm.sitzung (tenant_id, id),
  FOREIGN KEY (tenant_id, person_id) REFERENCES ppm.principal (tenant_id, id)
);
CREATE INDEX einladung_person ON ppm.einladung (tenant_id, person_id);
CREATE INDEX einladung_sitzung ON ppm.einladung (tenant_id, sitzung_id);

-- Unterlagen beim Versand (UC-006 Schritt 5): Stand je Traktandum aus der Art (Gate Review Packet aus dem Vertrag,
-- Portfoliobericht …), festgehalten mit dem Versand
CREATE TABLE ppm.unterlage (
  tenant_id     uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id            uuid NOT NULL DEFAULT gen_random_uuid(),
  traktandum_id uuid NOT NULL,
  art           text NOT NULL CHECK (art IN ('packet', 'bericht', 'beilage')),
  titel         text NOT NULL CHECK (length(btrim(titel)) BETWEEN 1 AND 300),
  stand_ok      boolean NOT NULL,
  hinweis       text NOT NULL DEFAULT '' CHECK (length(hinweis) <= 300),
  inhalt        jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, traktandum_id) REFERENCES ppm.traktandum (tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX unterlage_traktandum ON ppm.unterlage (tenant_id, traktandum_id);

-- Version und Änderungszeit setzt die Datenbank (ETag/If-Match über version); Portfolio und Gremium sind fest
CREATE FUNCTION ppm.sitzung_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = ppm, pg_temp AS $$
BEGIN
  NEW.version := OLD.version + 1;
  NEW.updated_at := now();
  NEW.updated_by := app.principal_id();
  NEW.created_at := OLD.created_at;
  NEW.created_by := OLD.created_by;
  NEW.portfolio_id := OLD.portfolio_id;
  NEW.gremium_id := OLD.gremium_id;
  NEW.datum := OLD.datum;
  RETURN NEW;
END $$;
CREATE TRIGGER sitzung_touch BEFORE UPDATE ON ppm.sitzung FOR EACH ROW EXECUTE FUNCTION ppm.sitzung_touch();
REVOKE ALL ON FUNCTION ppm.sitzung_touch() FROM PUBLIC;

-- Traktandum: Portfolio, Gremium, Art und Bezug sind fest (das Geschäft wandert nur zwischen Sitzungen)
CREATE FUNCTION ppm.traktandum_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = ppm, pg_temp AS $$
BEGIN
  NEW.version := OLD.version + 1;
  NEW.updated_at := now();
  NEW.updated_by := app.principal_id();
  NEW.created_at := OLD.created_at;
  NEW.created_by := OLD.created_by;
  NEW.portfolio_id := OLD.portfolio_id;
  NEW.gremium_id := OLD.gremium_id;
  NEW.art := OLD.art;
  NEW.bezug_typ := OLD.bezug_typ;
  NEW.bezug_id := OLD.bezug_id;
  RETURN NEW;
END $$;
CREATE TRIGGER traktandum_touch BEFORE UPDATE ON ppm.traktandum FOR EACH ROW EXECUTE FUNCTION ppm.traktandum_touch();
REVOKE ALL ON FUNCTION ppm.traktandum_touch() FROM PUBLIC;

-- Hilfsfunktion der Lesesicht: Recht an der Organisation oder Rolle am Portfolio (Muster PORTFOLIO); Rechte der
-- aufrufenden Rolle, kein SECURITY DEFINER
CREATE FUNCTION ppm.gremium_recht(p_permission text, p_portfolio_id uuid) RETURNS boolean LANGUAGE sql STABLE
SET search_path = pg_catalog, pg_temp AS $$
  SELECT app.has_permission(p_permission) OR app.has_permission(p_permission, 'portfolio', p_portfolio_id)
$$;
REVOKE ALL ON FUNCTION ppm.gremium_recht(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ppm.gremium_recht(text, uuid) TO ppm_app;

SELECT app.secure_tenant_tables();
-- Unterlagen sind der festgehaltene Stand beim Versand: nur anlegen
REVOKE UPDATE ON ppm.unterlage FROM ppm_app;

-- Lesesicht (fachmodell.md 3.4): Muster PORTFOLIO mit sitzung:read/sitzung:write. Traktanden und Unterlagen vor dem
-- Versand nur mit sitzung:write; Mitglieder (sitzung:read) ab Versand, vertrauliche Geschäfte nur mit
-- projekt:vertraulich (A-34); Eingeladene ab Versand nur ihr Traktandum (Policy über die Einladung).
CREATE POLICY sitzung_read ON ppm.sitzung AS RESTRICTIVE FOR SELECT TO ppm_app USING (
  ppm.gremium_recht('sitzung:read', portfolio_id) OR ppm.gremium_recht('sitzung:write', portfolio_id)
  OR EXISTS (SELECT 1 FROM ppm.einladung e WHERE e.sitzung_id = sitzung.id AND e.person_id = app.principal_id() AND e.versendet_at IS NOT NULL));
CREATE POLICY sitzung_insert ON ppm.sitzung AS RESTRICTIVE FOR INSERT TO ppm_app WITH CHECK (ppm.gremium_recht('sitzung:write', portfolio_id));
CREATE POLICY sitzung_update ON ppm.sitzung AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (ppm.gremium_recht('sitzung:write', portfolio_id)) WITH CHECK (ppm.gremium_recht('sitzung:write', portfolio_id));
CREATE POLICY sitzung_delete ON ppm.sitzung AS RESTRICTIVE FOR DELETE TO ppm_app USING (ppm.gremium_recht('sitzung:write', portfolio_id));

-- Vorschläge anderer Module (Eskalation durch die PL, Änderungsantrag …) entstehen in deren Transaktion über
-- `traktandum.vorschlagen` mit `app.sitzung_intern = 'on'` (wie app.eingang_intern), nur als Vorschlag ohne Sitzung
CREATE POLICY traktandum_read ON ppm.traktandum AS RESTRICTIVE FOR SELECT TO ppm_app USING (
  current_setting('app.sitzung_intern', true) = 'on'
  OR ppm.gremium_recht('sitzung:write', portfolio_id)
  OR (versendet_at IS NOT NULL AND ppm.gremium_recht('sitzung:read', portfolio_id)
      AND (NOT vertraulich OR ppm.gremium_recht('projekt:vertraulich', portfolio_id)))
  OR (versendet_at IS NOT NULL AND EXISTS (SELECT 1 FROM ppm.einladung e WHERE e.traktandum_id = traktandum.id AND e.person_id = app.principal_id())));
CREATE POLICY traktandum_insert ON ppm.traktandum AS RESTRICTIVE FOR INSERT TO ppm_app WITH CHECK (
  ppm.gremium_recht('sitzung:write', portfolio_id)
  OR (current_setting('app.sitzung_intern', true) = 'on' AND sitzung_id IS NULL AND stand = 'vorgeschlagen'));
CREATE POLICY traktandum_update ON ppm.traktandum AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (ppm.gremium_recht('sitzung:write', portfolio_id) OR (current_setting('app.sitzung_intern', true) = 'on' AND sitzung_id IS NULL))
  WITH CHECK (ppm.gremium_recht('sitzung:write', portfolio_id) OR (current_setting('app.sitzung_intern', true) = 'on' AND sitzung_id IS NULL AND stand = 'vorgeschlagen'));
CREATE POLICY traktandum_delete ON ppm.traktandum AS RESTRICTIVE FOR DELETE TO ppm_app USING (ppm.gremium_recht('sitzung:write', portfolio_id));

CREATE POLICY einladung_read ON ppm.einladung AS RESTRICTIVE FOR SELECT TO ppm_app USING (
  ppm.gremium_recht('sitzung:write', portfolio_id)
  OR (versendet_at IS NOT NULL AND (person_id = app.principal_id() OR ppm.gremium_recht('sitzung:read', portfolio_id))));
CREATE POLICY einladung_insert ON ppm.einladung AS RESTRICTIVE FOR INSERT TO ppm_app WITH CHECK (ppm.gremium_recht('sitzung:write', portfolio_id));
-- Ändern nur beim Versand (versendet_at)
CREATE POLICY einladung_update ON ppm.einladung AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (ppm.gremium_recht('sitzung:write', portfolio_id)) WITH CHECK (ppm.gremium_recht('sitzung:write', portfolio_id));
CREATE POLICY einladung_delete ON ppm.einladung AS RESTRICTIVE FOR DELETE TO ppm_app USING (ppm.gremium_recht('sitzung:write', portfolio_id));

-- Muster ÜBER ELTERN: sichtbar mit dem Traktandum, anlegen mit sitzung:write am Portfolio des Traktandums
CREATE POLICY unterlage_read ON ppm.unterlage AS RESTRICTIVE FOR SELECT TO ppm_app
  USING (EXISTS (SELECT 1 FROM ppm.traktandum t WHERE t.id = unterlage.traktandum_id));
CREATE POLICY unterlage_insert ON ppm.unterlage AS RESTRICTIVE FOR INSERT TO ppm_app WITH CHECK (
  EXISTS (SELECT 1 FROM ppm.traktandum t WHERE t.id = unterlage.traktandum_id AND ppm.gremium_recht('sitzung:write', t.portfolio_id)));
CREATE POLICY unterlage_delete ON ppm.unterlage AS RESTRICTIVE FOR DELETE TO ppm_app USING (
  EXISTS (SELECT 1 FROM ppm.traktandum t WHERE t.id = unterlage.traktandum_id AND ppm.gremium_recht('sitzung:write', t.portfolio_id)));
