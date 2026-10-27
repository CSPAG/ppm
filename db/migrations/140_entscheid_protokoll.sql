-- Sitzung durchführen (BC PP.04.02, PS.02.02; UC-006 Schritte 6–9, A1, A3, A4; Kernablauf K3; docs/fachmodell.md 2.9):
-- Entscheid je Traktandum mit Verlauf (korrigierbar bis zum Schliessen, A-30), Auflagen als Aufgaben (A3) und Protokoll.

-- Entscheid je Traktandum (höchstens einer). `ergebnis` ist ein Schlüssel aus den Ergebnissen der Traktandenart (Registry,
-- K3 Schritt 8); bei «via SNS-VR» (A1) ist der Entscheid des Gremiums eine Stellungnahme und der SNS-VR entscheidet
-- nachträglich (`sns_*`, erfasst von der UE, A-02).
CREATE TABLE ppm.entscheid (
  tenant_id       uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id              uuid NOT NULL DEFAULT gen_random_uuid(),
  traktandum_id   uuid NOT NULL,
  sitzung_id      uuid NOT NULL,
  ergebnis        text NOT NULL CHECK (ergebnis ~ '^[a-z_]{1,40}$'),
  begruendung     text NOT NULL CHECK (length(btrim(begruendung)) BETWEEN 1 AND 4000),
  -- Stellungnahme des Gremiums für den SNS-VR (UC-006 A1); Folge erst mit dem Entscheid des SNS-VR
  stellungnahme   boolean NOT NULL DEFAULT false,
  -- an den VR weiterleiten: Geschäft für das nächste Quartalsreporting markiert (UC-006 A4, UC-012)
  an_vr           boolean NOT NULL DEFAULT false,
  sns_ergebnis    text CHECK (sns_ergebnis ~ '^[a-z_]{1,40}$'),
  sns_begruendung text CHECK (length(sns_begruendung) <= 4000),
  sns_erfasst_at  timestamptz,
  sns_erfasst_by  uuid,
  erfasst_at      timestamptz NOT NULL DEFAULT now(),
  erfasst_by      uuid DEFAULT app.principal_id(),
  version         int NOT NULL DEFAULT 1 CHECK (version >= 1),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, traktandum_id),
  CHECK (sns_ergebnis IS NULL OR stellungnahme),
  FOREIGN KEY (tenant_id, traktandum_id) REFERENCES ppm.traktandum (tenant_id, id),
  FOREIGN KEY (tenant_id, sitzung_id) REFERENCES ppm.sitzung (tenant_id, id)
);
CREATE INDEX entscheid_sitzung ON ppm.entscheid (tenant_id, sitzung_id);

-- Verlauf (A-30): jede Erfassung und Korrektur, nur anhängen
CREATE TABLE ppm.entscheid_version (
  tenant_id     uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  entscheid_id  uuid NOT NULL,
  version       int NOT NULL,
  ergebnis      text NOT NULL,
  begruendung   text NOT NULL,
  stellungnahme boolean NOT NULL,
  an_vr         boolean NOT NULL,
  sns_ergebnis  text,
  sns_begruendung text,
  changed_at    timestamptz NOT NULL DEFAULT now(),
  changed_by    uuid,
  PRIMARY KEY (tenant_id, entscheid_id, version),
  FOREIGN KEY (tenant_id, entscheid_id) REFERENCES ppm.entscheid (tenant_id, id)
);

CREATE FUNCTION ppm.entscheid_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = ppm, pg_temp AS $$
BEGIN
  NEW.version := OLD.version + 1;
  NEW.traktandum_id := OLD.traktandum_id;
  NEW.sitzung_id := OLD.sitzung_id;
  RETURN NEW;
END $$;
CREATE TRIGGER entscheid_touch BEFORE UPDATE ON ppm.entscheid FOR EACH ROW EXECUTE FUNCTION ppm.entscheid_touch();
REVOKE ALL ON FUNCTION ppm.entscheid_touch() FROM PUBLIC;

CREATE FUNCTION ppm.entscheid_history() RETURNS trigger LANGUAGE plpgsql SET search_path = ppm, pg_temp AS $$
BEGIN
  INSERT INTO ppm.entscheid_version (tenant_id, entscheid_id, version, ergebnis, begruendung, stellungnahme, an_vr, sns_ergebnis, sns_begruendung, changed_by)
  VALUES (NEW.tenant_id, NEW.id, NEW.version, NEW.ergebnis, NEW.begruendung, NEW.stellungnahme, NEW.an_vr, NEW.sns_ergebnis, NEW.sns_begruendung, app.principal_id());
  RETURN NULL;
END $$;
CREATE TRIGGER entscheid_history AFTER INSERT OR UPDATE ON ppm.entscheid FOR EACH ROW EXECUTE FUNCTION ppm.entscheid_history();
REVOKE ALL ON FUNCTION ppm.entscheid_history() FROM PUBLIC;

-- Auflage (UC-006 A3): Text, Termin, verantwortliche Person; wird beim Schliessen der Sitzung Aufgabe im Eingang
-- (`auflage.erfuellen`, fachmodell.md 4.2), die Person meldet sie erledigt
CREATE TABLE ppm.auflage (
  tenant_id     uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id            uuid NOT NULL DEFAULT gen_random_uuid(),
  entscheid_id  uuid NOT NULL,
  position      int NOT NULL CHECK (position BETWEEN 1 AND 99),
  text          text NOT NULL CHECK (length(btrim(text)) BETWEEN 1 AND 1000),
  verantwortlich uuid NOT NULL,
  termin        date NOT NULL,
  stand         text NOT NULL DEFAULT 'offen' CHECK (stand IN ('offen', 'erfuellt')),
  erfuellt_at   timestamptz,
  erfuellt_by   uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, entscheid_id, position),
  CHECK ((stand = 'erfuellt') = (erfuellt_at IS NOT NULL)),
  FOREIGN KEY (tenant_id, entscheid_id) REFERENCES ppm.entscheid (tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, verantwortlich) REFERENCES ppm.principal (tenant_id, id)
);
CREATE INDEX auflage_verantwortlich ON ppm.auflage (tenant_id, verantwortlich) WHERE stand = 'offen';

-- Protokoll je Sitzung (UC-006 Schritte 8–9): beim Schliessen aus Traktanden und Entscheiden erzeugt, von der UE
-- bereinigt (Anwesende, Notizen, Bemerkungen) und versendet
CREATE TABLE ppm.protokoll (
  tenant_id     uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id            uuid NOT NULL DEFAULT gen_random_uuid(),
  sitzung_id    uuid NOT NULL,
  inhalt        jsonb NOT NULL,
  stand         text NOT NULL DEFAULT 'entwurf' CHECK (stand IN ('entwurf', 'versendet')),
  versendet_at  timestamptz,
  versendet_by  uuid,
  version       int NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid DEFAULT app.principal_id(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, sitzung_id),
  CHECK ((stand = 'versendet') = (versendet_at IS NOT NULL)),
  FOREIGN KEY (tenant_id, sitzung_id) REFERENCES ppm.sitzung (tenant_id, id)
);

CREATE FUNCTION ppm.protokoll_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = ppm, pg_temp AS $$
BEGIN
  NEW.version := OLD.version + 1;
  NEW.updated_at := now();
  NEW.updated_by := app.principal_id();
  NEW.created_at := OLD.created_at;
  NEW.created_by := OLD.created_by;
  NEW.sitzung_id := OLD.sitzung_id;
  RETURN NEW;
END $$;
CREATE TRIGGER protokoll_touch BEFORE UPDATE ON ppm.protokoll FOR EACH ROW EXECUTE FUNCTION ppm.protokoll_touch();
REVOKE ALL ON FUNCTION ppm.protokoll_touch() FROM PUBLIC;

SELECT app.secure_tenant_tables();
REVOKE UPDATE, DELETE ON ppm.entscheid_version FROM ppm_app;

-- Lesesicht (fachmodell.md 3.4), Muster ÜBER ELTERN: Entscheid sichtbar mit dem Traktandum (Mitglieder ab Versand,
-- vertrauliche nur mit projekt:vertraulich, Eingeladene ihr Traktandum); schreiben mit sitzung:write am Portfolio
CREATE POLICY entscheid_read ON ppm.entscheid AS RESTRICTIVE FOR SELECT TO ppm_app
  USING (EXISTS (SELECT 1 FROM ppm.traktandum t WHERE t.id = entscheid.traktandum_id));
CREATE POLICY entscheid_insert ON ppm.entscheid AS RESTRICTIVE FOR INSERT TO ppm_app WITH CHECK (
  EXISTS (SELECT 1 FROM ppm.traktandum t WHERE t.id = entscheid.traktandum_id AND ppm.gremium_recht('sitzung:write', t.portfolio_id)));
CREATE POLICY entscheid_update ON ppm.entscheid AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (EXISTS (SELECT 1 FROM ppm.traktandum t WHERE t.id = entscheid.traktandum_id AND ppm.gremium_recht('sitzung:write', t.portfolio_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM ppm.traktandum t WHERE t.id = entscheid.traktandum_id AND ppm.gremium_recht('sitzung:write', t.portfolio_id)));
CREATE POLICY entscheid_delete ON ppm.entscheid AS RESTRICTIVE FOR DELETE TO ppm_app USING (
  EXISTS (SELECT 1 FROM ppm.traktandum t WHERE t.id = entscheid.traktandum_id AND ppm.gremium_recht('sitzung:write', t.portfolio_id)));

-- Verlauf, Muster STAND: lesen mit dem Entscheid, nur anhängen (der Trigger schreibt)
CREATE POLICY entscheid_version_read ON ppm.entscheid_version AS RESTRICTIVE FOR SELECT TO ppm_app
  USING (EXISTS (SELECT 1 FROM ppm.entscheid e WHERE e.id = entscheid_version.entscheid_id));
CREATE POLICY entscheid_version_insert ON ppm.entscheid_version AS RESTRICTIVE FOR INSERT TO ppm_app
  WITH CHECK (EXISTS (SELECT 1 FROM ppm.entscheid e WHERE e.id = entscheid_version.entscheid_id));

-- Auflage: mit dem Entscheid; die verantwortliche Person und ihre Vertretung (fachmodell.md 4.3) sehen ihre Auflage auch
-- ohne Einladung und melden sie erledigt
CREATE POLICY auflage_read ON ppm.auflage AS RESTRICTIVE FOR SELECT TO ppm_app USING (
  EXISTS (SELECT 1 FROM ppm.entscheid e WHERE e.id = auflage.entscheid_id)
  OR verantwortlich = app.principal_id()
  OR EXISTS (SELECT 1 FROM ppm.stellvertretung s
              WHERE s.tenant_id = auflage.tenant_id AND s.vertretene_person = auflage.verantwortlich AND s.vertreter_person = app.principal_id()
                AND (now() AT TIME ZONE 'Europe/Zurich')::date BETWEEN s.von AND s.bis));
CREATE POLICY auflage_insert ON ppm.auflage AS RESTRICTIVE FOR INSERT TO ppm_app WITH CHECK (
  EXISTS (SELECT 1 FROM ppm.entscheid e JOIN ppm.traktandum t ON t.tenant_id = e.tenant_id AND t.id = e.traktandum_id
           WHERE e.id = auflage.entscheid_id AND ppm.gremium_recht('sitzung:write', t.portfolio_id)));
CREATE POLICY auflage_update ON ppm.auflage AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (
    EXISTS (SELECT 1 FROM ppm.entscheid e JOIN ppm.traktandum t ON t.tenant_id = e.tenant_id AND t.id = e.traktandum_id
             WHERE e.id = auflage.entscheid_id AND ppm.gremium_recht('sitzung:write', t.portfolio_id))
    OR verantwortlich = app.principal_id()
    OR EXISTS (SELECT 1 FROM ppm.stellvertretung s
                WHERE s.tenant_id = auflage.tenant_id AND s.vertretene_person = auflage.verantwortlich AND s.vertreter_person = app.principal_id()
                  AND (now() AT TIME ZONE 'Europe/Zurich')::date BETWEEN s.von AND s.bis))
  WITH CHECK (
    EXISTS (SELECT 1 FROM ppm.entscheid e JOIN ppm.traktandum t ON t.tenant_id = e.tenant_id AND t.id = e.traktandum_id
             WHERE e.id = auflage.entscheid_id AND ppm.gremium_recht('sitzung:write', t.portfolio_id))
    OR verantwortlich = app.principal_id()
    OR EXISTS (SELECT 1 FROM ppm.stellvertretung s
                WHERE s.tenant_id = auflage.tenant_id AND s.vertretene_person = auflage.verantwortlich AND s.vertreter_person = app.principal_id()
                  AND (now() AT TIME ZONE 'Europe/Zurich')::date BETWEEN s.von AND s.bis));
CREATE POLICY auflage_delete ON ppm.auflage AS RESTRICTIVE FOR DELETE TO ppm_app USING (
  EXISTS (SELECT 1 FROM ppm.entscheid e JOIN ppm.traktandum t ON t.tenant_id = e.tenant_id AND t.id = e.traktandum_id
           WHERE e.id = auflage.entscheid_id AND ppm.gremium_recht('sitzung:write', t.portfolio_id)));

-- Protokoll, Muster ÜBER ELTERN (Sitzung): Entwurf nur mit sitzung:write, Mitglieder (sitzung:read) ab Versand
-- (fachmodell.md 3.4, Sichtbarkeit innerhalb von Gremien)
CREATE POLICY protokoll_read ON ppm.protokoll AS RESTRICTIVE FOR SELECT TO ppm_app USING (
  EXISTS (SELECT 1 FROM ppm.sitzung s WHERE s.id = protokoll.sitzung_id
           AND (ppm.gremium_recht('sitzung:write', s.portfolio_id) OR (protokoll.stand = 'versendet' AND ppm.gremium_recht('sitzung:read', s.portfolio_id)))));
CREATE POLICY protokoll_insert ON ppm.protokoll AS RESTRICTIVE FOR INSERT TO ppm_app WITH CHECK (
  EXISTS (SELECT 1 FROM ppm.sitzung s WHERE s.id = protokoll.sitzung_id AND ppm.gremium_recht('sitzung:write', s.portfolio_id)));
CREATE POLICY protokoll_update ON ppm.protokoll AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (EXISTS (SELECT 1 FROM ppm.sitzung s WHERE s.id = protokoll.sitzung_id AND ppm.gremium_recht('sitzung:write', s.portfolio_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM ppm.sitzung s WHERE s.id = protokoll.sitzung_id AND ppm.gremium_recht('sitzung:write', s.portfolio_id)));
CREATE POLICY protokoll_delete ON ppm.protokoll AS RESTRICTIVE FOR DELETE TO ppm_app USING (
  EXISTS (SELECT 1 FROM ppm.sitzung s WHERE s.id = protokoll.sitzung_id AND ppm.gremium_recht('sitzung:write', s.portfolio_id)));
