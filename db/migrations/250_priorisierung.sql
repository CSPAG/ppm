-- Bewertungsmodell mit Kriterien und Budgetrahmen, Bewertung je Projekt und Kriterium (BC PP.01.02, PP.01.03, PP.02.01;
-- UC-008 Schritte 1–2, A1; docs/fachmodell.md 2.12; AP-E5-1).
-- Bewertung ohne Score: je Kriterium hoch/mittel/tief, die Gesamtbeurteilung trifft das Gremium (A-01, Klärung K01/V10).
-- Budgetrahmen je Portfolio (Kategorie A/B/C) optional; ohne Rahmen keine Budget-Wasserlinie (A-18, K20).
-- Ein Modell ist «Entwurf» (änderbar, höchstens einer) oder «in Kraft» (unveränderlich); es gilt das zuletzt in Kraft
-- gesetzte, frühere bleiben mit ihren Bewertungen nachvollziehbar (UC-008 A1.2, G11).
-- Setzt nur Tabellen aus 001–069 voraus (Mandant, Portfolio, Projekt, Hilfsfunktionen der Lesesicht aus 010).

CREATE TABLE ppm.bewertungsmodell (
  tenant_id    uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id           uuid NOT NULL DEFAULT gen_random_uuid(),
  nummer       int NOT NULL CHECK (nummer >= 1),
  stand        text NOT NULL DEFAULT 'entwurf' CHECK (stand IN ('entwurf', 'in_kraft')),
  beschreibung text NOT NULL DEFAULT '' CHECK (length(beschreibung) <= 2000),
  -- Entscheid des Gremiums, mit dem das Modell in Kraft gesetzt wurde (UC-008 A1.2: «Der PRAT gibt frei; UE erfasst den Entscheid»)
  beschluss    text NOT NULL DEFAULT '' CHECK (length(beschluss) <= 500),
  in_kraft_at  timestamptz,
  in_kraft_by  uuid,
  version      int NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid DEFAULT app.principal_id(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, nummer),
  CHECK ((stand = 'entwurf') = (in_kraft_at IS NULL))
);
CREATE UNIQUE INDEX bewertungsmodell_entwurf ON ppm.bewertungsmodell (tenant_id) WHERE stand = 'entwurf';
CREATE INDEX bewertungsmodell_in_kraft ON ppm.bewertungsmodell (tenant_id, in_kraft_at DESC) WHERE stand = 'in_kraft';

-- Kriterien je Modell; `dimension` ordnet das Kriterium fest der Achse Nutzen oder Risiko der Matrix zu (A-39), leer = keine
CREATE TABLE ppm.kriterium (
  tenant_id           uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id                  uuid NOT NULL DEFAULT gen_random_uuid(),
  bewertungsmodell_id uuid NOT NULL,
  schluessel          text NOT NULL CHECK (schluessel ~ '^[a-z0-9_]{1,40}$'),
  text                text NOT NULL CHECK (length(btrim(text)) BETWEEN 1 AND 200),
  beschreibung        text NOT NULL DEFAULT '' CHECK (length(beschreibung) <= 1000),
  dimension           text CHECK (dimension IN ('nutzen', 'risiko')),
  position            int NOT NULL CHECK (position >= 0),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, bewertungsmodell_id, schluessel),
  FOREIGN KEY (tenant_id, bewertungsmodell_id) REFERENCES ppm.bewertungsmodell (tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX kriterium_modell ON ppm.kriterium (tenant_id, bewertungsmodell_id, position);

-- Budgetrahmen je Portfolio und Modell (Kategorie des Portfolios zur Anzeige festgehalten); optional (A-18)
CREATE TABLE ppm.budgetrahmen (
  tenant_id           uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id                  uuid NOT NULL DEFAULT gen_random_uuid(),
  bewertungsmodell_id uuid NOT NULL,
  portfolio_id        uuid NOT NULL,
  kategorie           text NOT NULL CHECK (kategorie IN ('A', 'B', 'C')),
  betrag              numeric(14, 2) NOT NULL CHECK (betrag >= 0),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, bewertungsmodell_id, portfolio_id),
  FOREIGN KEY (tenant_id, bewertungsmodell_id) REFERENCES ppm.bewertungsmodell (tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, portfolio_id) REFERENCES ppm.portfolio (tenant_id, id) ON DELETE CASCADE
);

-- Bewertung je Projekt, Modell und Kriterium: Einschätzung hoch/mittel/tief mit Kommentar (A-01)
CREATE TABLE ppm.bewertung (
  tenant_id           uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id                  uuid NOT NULL DEFAULT gen_random_uuid(),
  projekt_id          uuid NOT NULL,
  bewertungsmodell_id uuid NOT NULL,
  kriterium           text NOT NULL,
  einschaetzung       text NOT NULL CHECK (einschaetzung IN ('hoch', 'mittel', 'tief')),
  kommentar           text NOT NULL DEFAULT '' CHECK (length(kommentar) <= 1000),
  version             int NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid DEFAULT app.principal_id(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  updated_by          uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, projekt_id, bewertungsmodell_id, kriterium),
  FOREIGN KEY (tenant_id, projekt_id) REFERENCES ppm.projekt (tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, bewertungsmodell_id, kriterium) REFERENCES ppm.kriterium (tenant_id, bewertungsmodell_id, schluessel)
);
CREATE INDEX bewertung_modell ON ppm.bewertung (tenant_id, bewertungsmodell_id, projekt_id);

-- Version und Änderungszeit setzt die Datenbank (ETag/If-Match prüft die API über version)
CREATE FUNCTION ppm.priorisierung_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = ppm, pg_temp AS $$
BEGIN
  NEW.version := OLD.version + 1;
  NEW.updated_at := now();
  NEW.updated_by := app.principal_id();
  NEW.created_at := OLD.created_at;
  NEW.created_by := OLD.created_by;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION ppm.priorisierung_touch() FROM PUBLIC;
CREATE TRIGGER bewertungsmodell_touch BEFORE UPDATE ON ppm.bewertungsmodell FOR EACH ROW EXECUTE FUNCTION ppm.priorisierung_touch();
CREATE TRIGGER bewertung_touch BEFORE UPDATE ON ppm.bewertung FOR EACH ROW EXECUTE FUNCTION ppm.priorisierung_touch();

-- Ein Modell in Kraft ist unveränderlich; löschen lässt die Lesesicht nur Entwürfe (frühere Bewertungen bleiben nachvollziehbar, UC-008 A1.2)
CREATE FUNCTION ppm.bewertungsmodell_fest() RETURNS trigger LANGUAGE plpgsql SET search_path = ppm, pg_temp AS $$
BEGIN
  IF OLD.stand = 'in_kraft' THEN
    RAISE EXCEPTION 'Bewertungsmodell % ist in Kraft und nicht änderbar', OLD.nummer USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION ppm.bewertungsmodell_fest() FROM PUBLIC;
CREATE TRIGGER bewertungsmodell_fest BEFORE UPDATE ON ppm.bewertungsmodell FOR EACH ROW EXECUTE FUNCTION ppm.bewertungsmodell_fest();

-- Modell im Entwurf (unter der Lesesicht der aufrufenden Rolle, nicht SECURITY DEFINER, fachmodell.md 3.4)
CREATE FUNCTION ppm.bewertungsmodell_entwurf(modell uuid) RETURNS boolean LANGUAGE sql STABLE SET search_path = ppm, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM ppm.bewertungsmodell m WHERE m.id = modell AND m.stand = 'entwurf')
$$;
REVOKE ALL ON FUNCTION ppm.bewertungsmodell_entwurf(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ppm.bewertungsmodell_entwurf(uuid) TO ppm_app;

-- Lesen des Modells: priorisierung:read an der Organisation oder an einem Portfolio. Abweichung vom Muster ORG: das
-- Gremium (Recht am Portfolio) liest die Bewertung seines Portfolios nach diesem Modell und legt es fest (UC-008 A1.2)
CREATE FUNCTION ppm.priorisierung_lesbar() RETURNS boolean LANGUAGE sql STABLE SET search_path = ppm, pg_temp AS $$
  SELECT app.has_permission('priorisierung:read')
      OR EXISTS (SELECT 1 FROM ppm.portfolio p WHERE app.has_permission('priorisierung:read', 'portfolio', p.id))
$$;
REVOKE ALL ON FUNCTION ppm.priorisierung_lesbar() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ppm.priorisierung_lesbar() TO ppm_app;

SELECT app.secure_tenant_tables();

-- Lesesicht (fachmodell.md 3.4). Muster ORG: Modell und Kriterien pflegen mit priorisierung:write, Kriterien nur im
-- Entwurf; lesen mit priorisierung:read an der Organisation oder einem Portfolio (siehe oben)
CREATE POLICY bewertungsmodell_read ON ppm.bewertungsmodell AS RESTRICTIVE FOR SELECT TO ppm_app USING (ppm.priorisierung_lesbar());
CREATE POLICY bewertungsmodell_insert ON ppm.bewertungsmodell AS RESTRICTIVE FOR INSERT TO ppm_app WITH CHECK (app.has_permission('priorisierung:write') AND stand = 'entwurf');
CREATE POLICY bewertungsmodell_update ON ppm.bewertungsmodell AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('priorisierung:write') AND stand = 'entwurf') WITH CHECK (app.has_permission('priorisierung:write'));
CREATE POLICY bewertungsmodell_delete ON ppm.bewertungsmodell AS RESTRICTIVE FOR DELETE TO ppm_app USING (app.has_permission('priorisierung:write') AND stand = 'entwurf');

CREATE POLICY kriterium_read ON ppm.kriterium AS RESTRICTIVE FOR SELECT TO ppm_app USING (ppm.priorisierung_lesbar());
CREATE POLICY kriterium_insert ON ppm.kriterium AS RESTRICTIVE FOR INSERT TO ppm_app
  WITH CHECK (app.has_permission('priorisierung:write') AND ppm.bewertungsmodell_entwurf(bewertungsmodell_id));
CREATE POLICY kriterium_update ON ppm.kriterium AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('priorisierung:write') AND ppm.bewertungsmodell_entwurf(bewertungsmodell_id))
  WITH CHECK (app.has_permission('priorisierung:write') AND ppm.bewertungsmodell_entwurf(bewertungsmodell_id));
CREATE POLICY kriterium_delete ON ppm.kriterium AS RESTRICTIVE FOR DELETE TO ppm_app
  USING (app.has_permission('priorisierung:write') AND ppm.bewertungsmodell_entwurf(bewertungsmodell_id));

-- Muster PORTFOLIO: Budgetrahmen lesen mit priorisierung:read an der Organisation oder am Portfolio; pflegen nur im Entwurf
CREATE POLICY budgetrahmen_read ON ppm.budgetrahmen AS RESTRICTIVE FOR SELECT TO ppm_app
  USING (app.has_permission('priorisierung:read') OR app.has_permission('priorisierung:read', 'portfolio', portfolio_id));
CREATE POLICY budgetrahmen_insert ON ppm.budgetrahmen AS RESTRICTIVE FOR INSERT TO ppm_app
  WITH CHECK ((app.has_permission('priorisierung:write') OR app.has_permission('priorisierung:write', 'portfolio', portfolio_id)) AND ppm.bewertungsmodell_entwurf(bewertungsmodell_id));
CREATE POLICY budgetrahmen_update ON ppm.budgetrahmen AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING ((app.has_permission('priorisierung:write') OR app.has_permission('priorisierung:write', 'portfolio', portfolio_id)) AND ppm.bewertungsmodell_entwurf(bewertungsmodell_id))
  WITH CHECK ((app.has_permission('priorisierung:write') OR app.has_permission('priorisierung:write', 'portfolio', portfolio_id)) AND ppm.bewertungsmodell_entwurf(bewertungsmodell_id));
CREATE POLICY budgetrahmen_delete ON ppm.budgetrahmen AS RESTRICTIVE FOR DELETE TO ppm_app
  USING ((app.has_permission('priorisierung:write') OR app.has_permission('priorisierung:write', 'portfolio', portfolio_id)) AND ppm.bewertungsmodell_entwurf(bewertungsmodell_id));

-- Muster KIND: Bewertung lesen, wer das Projekt sieht; schreiben mit priorisierung:write (A-01)
CREATE POLICY bewertung_read ON ppm.bewertung AS RESTRICTIVE FOR SELECT TO ppm_app USING (ppm.projekt_sichtbar(projekt_id));
CREATE POLICY bewertung_insert ON ppm.bewertung AS RESTRICTIVE FOR INSERT TO ppm_app WITH CHECK (app.has_permission('priorisierung:write', 'projekt', projekt_id));
CREATE POLICY bewertung_update ON ppm.bewertung AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('priorisierung:write', 'projekt', projekt_id)) WITH CHECK (app.has_permission('priorisierung:write', 'projekt', projekt_id));
CREATE POLICY bewertung_delete ON ppm.bewertung AS RESTRICTIVE FOR DELETE TO ppm_app USING (app.has_permission('priorisierung:write', 'projekt', projekt_id));
