-- Portfoliobericht der Periode (BC PC.04.02, UC-014 Schritt 3; Kernablauf K3 Schritt 4; docs/fachmodell.md 2.9, 3.2;
-- AP-E2-3): Die UE erzeugt den Bericht je Portfolio aus dem abgeschlossenen Dashboard der Periode und der Risikolage
-- (Stand bei Erzeugung in `inhalt`), ergänzt ihren Kommentar und stellt ihn dem Gremium bereit. Bereitgestellt ist der
-- Bericht fest und Unterlage des Traktandums «Bericht der Programmleitung» (Art `portfoliobericht`).
-- Setzt nur Tabellen aus 001–109 voraus (Mandant, Portfolio, Periode).

CREATE TABLE ppm.portfoliobericht (
  tenant_id         uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id                uuid NOT NULL DEFAULT gen_random_uuid(),
  portfolio_id      uuid NOT NULL,
  periode           text NOT NULL,
  stand             text NOT NULL DEFAULT 'entwurf' CHECK (stand IN ('entwurf', 'bereitgestellt')),
  -- Dashboard (Zeilen, Funnel) und Risikolage bei Erzeugung; die Oberfläche und das Dokument lesen nur diesen Stand
  inhalt            jsonb NOT NULL CHECK (jsonb_typeof(inhalt) = 'object'),
  erzeugt_at        timestamptz NOT NULL DEFAULT now(),
  -- Kommentar der UE («Bericht der Programmleitung», K3 Schritt 4)
  kommentar         text NOT NULL DEFAULT '' CHECK (length(kommentar) <= 8000),
  bereitgestellt_at timestamptz,
  bereitgestellt_by uuid,
  version           int NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at        timestamptz NOT NULL DEFAULT now(),
  created_by        uuid DEFAULT app.principal_id(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  updated_by        uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, portfolio_id, periode),
  FOREIGN KEY (tenant_id, portfolio_id) REFERENCES ppm.portfolio (tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, periode) REFERENCES ppm.periode (tenant_id, periode),
  CHECK ((stand = 'bereitgestellt') = (bereitgestellt_at IS NOT NULL))
);
CREATE INDEX portfoliobericht_periode ON ppm.portfoliobericht (tenant_id, portfolio_id, periode DESC);

-- Bereitgestellt ist der Bericht fest: Portfolio, Periode, Inhalt und Kommentar ändern sich nicht mehr
CREATE FUNCTION ppm.portfoliobericht_set() RETURNS trigger LANGUAGE plpgsql SET search_path = ppm, pg_temp AS $$
BEGIN
  NEW.portfolio_id := OLD.portfolio_id;
  NEW.periode := OLD.periode;
  IF OLD.stand = 'bereitgestellt' THEN
    RAISE EXCEPTION 'Portfoliobericht ist bereitgestellt' USING ERRCODE = 'check_violation';
  END IF;
  NEW.updated_at := now();
  NEW.updated_by := app.principal_id();
  RETURN NEW;
END $$;
CREATE TRIGGER portfoliobericht_set BEFORE UPDATE ON ppm.portfoliobericht FOR EACH ROW EXECUTE FUNCTION ppm.portfoliobericht_set();
REVOKE ALL ON FUNCTION ppm.portfoliobericht_set() FROM PUBLIC;

SELECT app.secure_tenant_tables();
-- Der Bericht bleibt nachvollziehbar
REVOKE DELETE ON ppm.portfoliobericht FROM ppm_app;

-- Lesesicht nach Muster PORTFOLIO (fachmodell.md 3.4): erzeugen und ergänzen mit auswertung:write (Organisation, UE);
-- lesen mit auswertung:write oder, sobald bereitgestellt, mit auswertung:read an der Organisation oder am Portfolio
CREATE POLICY portfoliobericht_read ON ppm.portfoliobericht AS RESTRICTIVE FOR SELECT TO ppm_app
  USING (app.has_permission('auswertung:write') OR (stand = 'bereitgestellt'
         AND (app.has_permission('auswertung:read') OR app.has_permission('auswertung:read', 'portfolio', portfolio_id))));
CREATE POLICY portfoliobericht_insert ON ppm.portfoliobericht AS RESTRICTIVE FOR INSERT TO ppm_app
  WITH CHECK (app.has_permission('auswertung:write'));
CREATE POLICY portfoliobericht_update ON ppm.portfoliobericht AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('auswertung:write')) WITH CHECK (app.has_permission('auswertung:write'));
