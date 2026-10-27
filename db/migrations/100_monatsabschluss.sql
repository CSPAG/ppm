-- Monatsabschluss (BC PS.01.02–04, UC-005; Kernablauf K1; docs/fachmodell.md 2.8, 3.4; AP-E1-2): Rückfrage der
-- Unternehmensentwicklung zum Statusbericht (UC-005 A2), Einforderung fehlender Berichte (A1) und Stand der Periode bei
-- Abschluss je Projekt mit «nicht gemeldet» (A3, A-11). Setzt nur Tabellen aus 010 und 090 voraus.

-- Rückfrage (UC-005 A2): Die UE gibt den Bericht mit einer Frage an die Projektleitung zurück; beantwortet ist sie mit
-- dem erneuten Einreichen (A2.2). Das Projekt steht mit, damit die Policy ohne Umweg prüft; es folgt aus dem Bericht.
CREATE TABLE ppm.rueckfrage (
  tenant_id        uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id               uuid NOT NULL DEFAULT gen_random_uuid(),
  statusbericht_id uuid NOT NULL,
  projekt_id       uuid NOT NULL,
  text             text NOT NULL CHECK (length(btrim(text)) BETWEEN 1 AND 2000),
  antwort          text CHECK (length(antwort) <= 4000),
  gestellt_by      uuid DEFAULT app.principal_id(),
  gestellt_at      timestamptz NOT NULL DEFAULT now(),
  beantwortet_at   timestamptz,
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, statusbericht_id) REFERENCES ppm.statusbericht (tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, projekt_id) REFERENCES ppm.projekt (tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX rueckfrage_bericht ON ppm.rueckfrage (tenant_id, statusbericht_id, gestellt_at);
-- Höchstens eine offene Rückfrage je Bericht (der Bericht ist zurückgegeben, bis er erneut eingereicht ist)
CREATE UNIQUE INDEX rueckfrage_offen ON ppm.rueckfrage (tenant_id, statusbericht_id) WHERE beantwortet_at IS NULL;

-- Projekt aus dem Bericht; Bericht, Text und Zeitpunkt der Frage bleiben fest
CREATE FUNCTION ppm.rueckfrage_set() RETURNS trigger LANGUAGE plpgsql SET search_path = ppm, pg_temp AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.projekt_id := (SELECT b.projekt_id FROM ppm.statusbericht b WHERE b.tenant_id = NEW.tenant_id AND b.id = NEW.statusbericht_id);
  ELSE
    NEW.statusbericht_id := OLD.statusbericht_id;
    NEW.projekt_id := OLD.projekt_id;
    NEW.text := OLD.text;
    NEW.gestellt_by := OLD.gestellt_by;
    NEW.gestellt_at := OLD.gestellt_at;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER rueckfrage_set BEFORE INSERT OR UPDATE ON ppm.rueckfrage FOR EACH ROW EXECUTE FUNCTION ppm.rueckfrage_set();
REVOKE ALL ON FUNCTION ppm.rueckfrage_set() FROM PUBLIC;

-- Einforderung eines ausstehenden Berichts (UC-005 A1, PS.01.03): letzte Einforderung je Projekt und Periode («eingefordert
-- am Mo 27.10.», K1); die Erinnerung selbst ist eine Aufgabe im Eingang.
CREATE TABLE ppm.einforderung (
  tenant_id        uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  periode          text NOT NULL,
  projekt_id       uuid NOT NULL,
  anzahl           int NOT NULL DEFAULT 1 CHECK (anzahl >= 1),
  eingefordert_at  timestamptz NOT NULL DEFAULT now(),
  eingefordert_by  uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, periode, projekt_id),
  FOREIGN KEY (tenant_id, periode) REFERENCES ppm.periode (tenant_id, periode),
  FOREIGN KEY (tenant_id, projekt_id) REFERENCES ppm.projekt (tenant_id, id) ON DELETE CASCADE
);

-- Stand der Periode bei Abschluss je berichtspflichtigem Projekt (Zeile des Dashboards, darstellung.md «mittel»):
-- gemeldet = geprüfter Bericht der Periode; sonst die Werte der Vorperiode mit «nicht gemeldet» (UC-005 A3, A-11, A-37).
-- Nur anhängend (Muster STAND); Grundlage des Dashboards der Periode (AP-E1-3).
CREATE TABLE ppm.dashboard_zeile (
  tenant_id             uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  periode               text NOT NULL,
  projekt_id            uuid NOT NULL,
  statusbericht_id      uuid,
  gemeldet              boolean NOT NULL,
  status                text CHECK (status IN ('im_plan', 'kritisch')),
  trend                 text CHECK (trend ~ '^[a-z0-9_]{1,40}$'),
  phase                 text NOT NULL CHECK (phase IN ('P0', 'P1', 'P2', 'P3', 'P4')),
  abschluss_per         date,
  naechster_meilenstein text NOT NULL DEFAULT '' CHECK (length(naechster_meilenstein) <= 500),
  -- Periode, aus der die Werte stammen (bei «nicht gemeldet» die letzte gemeldete; NULL ohne frühere Werte)
  werte_aus             text,
  status_vorperiode     text CHECK (status_vorperiode IN ('im_plan', 'kritisch')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  created_by            uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, periode, projekt_id),
  FOREIGN KEY (tenant_id, periode) REFERENCES ppm.periode (tenant_id, periode),
  FOREIGN KEY (tenant_id, projekt_id) REFERENCES ppm.projekt (tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, statusbericht_id) REFERENCES ppm.statusbericht (tenant_id, id),
  CHECK (gemeldet = (statusbericht_id IS NOT NULL))
);

SELECT app.secure_tenant_tables();
-- Rückfragen und Einforderungen bleiben nachvollziehbar; der Stand der Periode wird nur angehängt
REVOKE DELETE ON ppm.rueckfrage, ppm.einforderung FROM ppm_app;
REVOKE UPDATE, DELETE ON ppm.dashboard_zeile FROM ppm_app;

-- Lesesicht (docs/fachmodell.md 3.4)
-- Rückfrage, Muster KIND: lesen, wer das Projekt sieht; stellen mit statusbericht:review (Organisation oder Portfolio);
-- beantworten (erneutes Einreichen) mit statusbericht:write am Projekt
CREATE POLICY rueckfrage_read ON ppm.rueckfrage AS RESTRICTIVE FOR SELECT TO ppm_app USING (ppm.projekt_sichtbar(projekt_id));
CREATE POLICY rueckfrage_insert ON ppm.rueckfrage AS RESTRICTIVE FOR INSERT TO ppm_app
  WITH CHECK (app.has_permission('statusbericht:review', 'portfolio', ppm.portfolio_von(projekt_id)));
CREATE POLICY rueckfrage_update ON ppm.rueckfrage AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('statusbericht:write', 'projekt', projekt_id)
         OR app.has_permission('statusbericht:review', 'portfolio', ppm.portfolio_von(projekt_id)))
  WITH CHECK (app.has_permission('statusbericht:write', 'projekt', projekt_id)
              OR app.has_permission('statusbericht:review', 'portfolio', ppm.portfolio_von(projekt_id)));

-- Einforderung, Muster KIND: lesen, wer das Projekt sieht; schreiben mit statusbericht:review
CREATE POLICY einforderung_read ON ppm.einforderung AS RESTRICTIVE FOR SELECT TO ppm_app USING (ppm.projekt_sichtbar(projekt_id));
CREATE POLICY einforderung_insert ON ppm.einforderung AS RESTRICTIVE FOR INSERT TO ppm_app
  WITH CHECK (app.has_permission('statusbericht:review', 'portfolio', ppm.portfolio_von(projekt_id)));
CREATE POLICY einforderung_update ON ppm.einforderung AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('statusbericht:review', 'portfolio', ppm.portfolio_von(projekt_id)))
  WITH CHECK (app.has_permission('statusbericht:review', 'portfolio', ppm.portfolio_von(projekt_id)));

-- Stand der Periode, Muster STAND: lesen wie KIND; anhängen nur beim Abschluss (periode:close)
CREATE POLICY dashboard_zeile_read ON ppm.dashboard_zeile AS RESTRICTIVE FOR SELECT TO ppm_app USING (ppm.projekt_sichtbar(projekt_id));
CREATE POLICY dashboard_zeile_insert ON ppm.dashboard_zeile AS RESTRICTIVE FOR INSERT TO ppm_app
  WITH CHECK (app.has_permission('periode:close'));
