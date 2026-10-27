-- Projektideen (docs/fachmodell.md 2.11; AP-E4-1): Idee nach Vorlage mit Stand (DM.01.01; UC-001 Schritte 1–2) und
-- Rückfragen der UE mit Antworten der Antragstellenden (UC-001 A2). Leitfragen und Kriterienraster (AP-E4-2) sowie die
-- Freigabe der Initialisierung (AP-E4-3) ergänzen eigene Tabellen bzw. Spalten in ihren Migrationen.

CREATE TABLE ppm.idee (
  tenant_id             uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id                    uuid NOT NULL DEFAULT gen_random_uuid(),
  -- laufend je Organisation (Schlüssel der Oberfläche, fachmodell.md 2: Idee `nummer`)
  nummer                int NOT NULL CHECK (nummer >= 1),
  erfasst_von           uuid NOT NULL DEFAULT app.principal_id(),
  vorgesehener_sponsor  uuid,
  stand                 text NOT NULL DEFAULT 'entwurf' CHECK (stand IN (
    'entwurf', 'eingereicht', 'in_pruefung', 'in_ergaenzung', 'traktandiert', 'freigegeben', 'zurueckgestellt',
    'zurueckgewiesen', 'zusammengefuehrt')),
  -- Felder nach Vorlage (UC-001 Schritt 1, K4 Assistent); Pflicht erst beim Einreichen (UC-001 Schritt 2)
  titel                 text NOT NULL DEFAULT '' CHECK (length(titel) <= 200),
  ausgangslage          text NOT NULL DEFAULT '' CHECK (length(ausgangslage) <= 4000),
  zielsetzung           text NOT NULL DEFAULT '' CHECK (length(zielsetzung) <= 4000),
  handlungsfeld_id      uuid,
  strategisches_ziel_id uuid,
  -- betroffene Bereiche (Organisationseinheiten, Mehrfachauswahl); geprüft beim Speichern, ohne Fremdschlüssel (Feld)
  org_einheit_ids       uuid[] NOT NULL DEFAULT '{}' CHECK (cardinality(org_einheit_ids) <= 50),
  -- erste Einschätzung «hoch / mittel / tief» mit einem Satz Begründung (K4 Schritt 3, Skala Vorschlag K01)
  nutzen                text CHECK (nutzen IN ('hoch', 'mittel', 'tief')),
  nutzen_text           text NOT NULL DEFAULT '' CHECK (length(nutzen_text) <= 1000),
  aufwand               text CHECK (aufwand IN ('hoch', 'mittel', 'tief')),
  aufwand_text          text NOT NULL DEFAULT '' CHECK (length(aufwand_text) <= 1000),
  relevanz              text CHECK (relevanz IN ('hoch', 'mittel', 'tief')),
  relevanz_text         text NOT NULL DEFAULT '' CHECK (length(relevanz_text) <= 1000),
  -- Schlüssel aus stammdaten.codewert (Codetabelle `idee_herkunft`)
  herkunft              text CHECK (length(herkunft) <= 100),
  -- Qualifizierung und Abschluss (AP-E4-2, AP-E4-3)
  kategorie             text CHECK (length(kategorie) <= 100),
  portfolio_id          uuid,
  fuehrende_idee_id     uuid,
  begruendung           text NOT NULL DEFAULT '' CHECK (length(begruendung) <= 4000),
  projekt_id            uuid,
  eingereicht_at        timestamptz,
  -- letztes Ereignis für «in Prüfung seit Fr 3.10.» (K4 Stand verfolgen)
  stand_at              timestamptz NOT NULL DEFAULT now(),
  version               int NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at            timestamptz NOT NULL DEFAULT now(),
  created_by            uuid DEFAULT app.principal_id(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  updated_by            uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, nummer),
  FOREIGN KEY (tenant_id, erfasst_von) REFERENCES ppm.principal (tenant_id, id),
  FOREIGN KEY (tenant_id, vorgesehener_sponsor) REFERENCES ppm.principal (tenant_id, id) ON DELETE SET NULL (vorgesehener_sponsor),
  FOREIGN KEY (tenant_id, handlungsfeld_id) REFERENCES ppm.handlungsfeld (tenant_id, id) ON DELETE SET NULL (handlungsfeld_id),
  FOREIGN KEY (tenant_id, strategisches_ziel_id) REFERENCES ppm.strategisches_ziel (tenant_id, id) ON DELETE SET NULL (strategisches_ziel_id),
  FOREIGN KEY (tenant_id, portfolio_id) REFERENCES ppm.portfolio (tenant_id, id) ON DELETE SET NULL (portfolio_id),
  FOREIGN KEY (tenant_id, fuehrende_idee_id) REFERENCES ppm.idee (tenant_id, id) ON DELETE SET NULL (fuehrende_idee_id),
  FOREIGN KEY (tenant_id, projekt_id) REFERENCES ppm.projekt (tenant_id, id) ON DELETE SET NULL (projekt_id)
);
CREATE INDEX idee_erfasst_von ON ppm.idee (tenant_id, erfasst_von, nummer DESC);
CREATE INDEX idee_stand ON ppm.idee (tenant_id, stand, stand_at);
CREATE INDEX idee_handlungsfeld ON ppm.idee (tenant_id, handlungsfeld_id) WHERE handlungsfeld_id IS NOT NULL;

-- Rückfragen der UE (UC-001 A2.1) mit Antwort der Antragstellenden (A2.2); `feld` = betroffenes Feld der Idee, damit der
-- Assistent die Rückfrage über dem Feld zeigt (K4 Prüfen 7); ohne Feld über dem ersten Schritt
CREATE TABLE ppm.idee_rueckfrage (
  tenant_id      uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id             uuid NOT NULL DEFAULT gen_random_uuid(),
  idee_id        uuid NOT NULL,
  feld           text CHECK (feld IN ('titel', 'ausgangslage', 'zielsetzung', 'handlungsfeld', 'strategischesZiel', 'bereiche',
                                      'nutzen', 'aufwand', 'relevanz', 'herkunft')),
  text           text NOT NULL CHECK (length(btrim(text)) BETWEEN 1 AND 2000),
  antwort        text CHECK (length(antwort) <= 4000),
  gestellt_von   uuid DEFAULT app.principal_id(),
  gestellt_at    timestamptz NOT NULL DEFAULT now(),
  beantwortet_at timestamptz,
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, idee_id) REFERENCES ppm.idee (tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX idee_rueckfrage_idee ON ppm.idee_rueckfrage (tenant_id, idee_id, gestellt_at);

-- Version und Änderungszeit setzt die Datenbank (ETag/If-Match prüft die API über version)
CREATE FUNCTION ppm.idee_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = ppm, pg_temp AS $$
BEGIN
  NEW.version := OLD.version + 1;
  NEW.updated_at := now();
  NEW.updated_by := app.principal_id();
  NEW.created_at := OLD.created_at;
  NEW.created_by := OLD.created_by;
  NEW.nummer := OLD.nummer;
  NEW.erfasst_von := OLD.erfasst_von;
  IF NEW.stand IS DISTINCT FROM OLD.stand THEN NEW.stand_at := now(); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER idee_touch BEFORE UPDATE ON ppm.idee FOR EACH ROW EXECUTE FUNCTION ppm.idee_touch();
REVOKE ALL ON FUNCTION ppm.idee_touch() FROM PUBLIC;

SELECT app.secure_tenant_tables();
-- Rückfragen bleiben als Verlauf der Idee; Löschen nur mit der Idee
REVOKE DELETE ON ppm.idee_rueckfrage FROM ppm_app;

-- Lesesicht EIGEN (fachmodell.md 3.4): eigene Ideen und die als vorgesehener Sponsor; sonst Ideenpool mit `idee:read` an
-- der Organisation oder am Portfolio der Idee – Entwürfe sieht nur, wer sie erfasst. Volle Sicht (Jobs) sieht alles.
CREATE POLICY idee_read ON ppm.idee AS RESTRICTIVE FOR SELECT TO ppm_app USING (
  erfasst_von = app.principal_id() OR (app.principal_id() IS NULL AND app.read_all())
  OR (stand <> 'entwurf' AND (vorgesehener_sponsor = app.principal_id() OR app.has_permission('idee:read')
                              OR (portfolio_id IS NOT NULL AND app.has_permission('idee:read', 'portfolio', portfolio_id)))));
-- Erfassen: eigene Ideen mit `idee:create` (A-46: alle Mitglieder)
CREATE POLICY idee_insert ON ppm.idee AS RESTRICTIVE FOR INSERT TO ppm_app WITH CHECK (
  (erfasst_von = app.principal_id() AND stand = 'entwurf' AND app.has_permission('idee:create'))
  OR (app.principal_id() IS NULL AND app.write_all()));
-- Ändern: Antragstellende nur im Entwurf und in Ergänzung (danach eingereicht); die UE mit `idee:write` (AP-E4-2)
CREATE POLICY idee_update ON ppm.idee AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING ((erfasst_von = app.principal_id() AND stand IN ('entwurf', 'in_ergaenzung') AND app.has_permission('idee:create'))
         OR app.has_permission('idee:write'))
  WITH CHECK ((erfasst_von = app.principal_id() AND stand IN ('entwurf', 'in_ergaenzung', 'eingereicht') AND app.has_permission('idee:create'))
              OR app.has_permission('idee:write'));
-- Löschen: nur der eigene Entwurf
CREATE POLICY idee_delete ON ppm.idee AS RESTRICTIVE FOR DELETE TO ppm_app
  USING ((erfasst_von = app.principal_id() AND stand = 'entwurf') OR (app.principal_id() IS NULL AND app.write_all()));

-- Rückfragen: sichtbar mit der Idee (deren Lesesicht wirkt mit); stellen nur mit `idee:write` (AP-E4-2); beantworten
-- die Antragstellenden ihrer Idee in Ergänzung
CREATE POLICY idee_rueckfrage_read ON ppm.idee_rueckfrage AS RESTRICTIVE FOR SELECT TO ppm_app USING (
  EXISTS (SELECT 1 FROM ppm.idee i WHERE i.tenant_id = idee_rueckfrage.tenant_id AND i.id = idee_rueckfrage.idee_id));
CREATE POLICY idee_rueckfrage_insert ON ppm.idee_rueckfrage AS RESTRICTIVE FOR INSERT TO ppm_app
  WITH CHECK (app.has_permission('idee:write'));
CREATE POLICY idee_rueckfrage_update ON ppm.idee_rueckfrage AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('idee:write') OR EXISTS (
    SELECT 1 FROM ppm.idee i WHERE i.tenant_id = idee_rueckfrage.tenant_id AND i.id = idee_rueckfrage.idee_id
       AND i.erfasst_von = app.principal_id() AND i.stand = 'in_ergaenzung'))
  WITH CHECK (app.has_permission('idee:write') OR EXISTS (
    SELECT 1 FROM ppm.idee i WHERE i.tenant_id = idee_rueckfrage.tenant_id AND i.id = idee_rueckfrage.idee_id
       AND i.erfasst_von = app.principal_id() AND i.stand = 'in_ergaenzung'));
