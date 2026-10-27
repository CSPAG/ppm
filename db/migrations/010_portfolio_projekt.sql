-- Orte im Rechtemodell (docs/fachmodell.md 2.4, 2.5, 3): Portfolio (AM.02.04) und Projekt (PP.04.04) als Kern der
-- Kette org → portfolio → projekt. Übrige Spalten und Tabellen (Gremien, Organisationseinheit, Handlungsfeld,
-- Phasenmodell, Projektorganisation, Verlauf) ergänzen AP-E0-4 und AP-E0-5 in ihren Bereichen.

CREATE TABLE ppm.portfolio (
  tenant_id  uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id         uuid NOT NULL DEFAULT gen_random_uuid(),
  kategorie  text NOT NULL CHECK (kategorie IN ('A', 'B', 'C')),
  -- transformation, geschaeftsleitung oder Kürzel der Direktion (A-23)
  schluessel text NOT NULL CHECK (schluessel ~ '^[a-z0-9][a-z0-9-]{0,39}$'),
  name       text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  -- Pflichten des Portfolios (Bericht, Gate, Gremium): A und B ja, C nein (A-07, A-08)
  pflichten  boolean NOT NULL,
  version    int NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT app.principal_id(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, id)
);
CREATE UNIQUE INDEX portfolio_schluessel ON ppm.portfolio (tenant_id, schluessel);

CREATE TABLE ppm.projekt (
  tenant_id    uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id           uuid NOT NULL DEFAULT gen_random_uuid(),
  -- «JJJJ-NNN», fortlaufend je Jahr der Anlage (A-47); Schlüssel in Adressen (I-N5)
  nummer       text NOT NULL CHECK (nummer ~ '^[0-9]{4}-[0-9]{3,}$'),
  name         text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  portfolio_id uuid NOT NULL,
  phase        text NOT NULL DEFAULT 'P0' CHECK (phase IN ('P0', 'P1', 'P2', 'P3', 'P4')),
  -- Endzustände sind lesend (UC-015 Schritt 6); Wiederaufnahme aus sistiert per Gremiumsentscheid (A-09)
  lebenszyklus text NOT NULL DEFAULT 'aktiv' CHECK (lebenszyklus IN ('aktiv', 'sistiert', 'abgebrochen', 'abgeschlossen', 'zurueckgezogen')),
  -- sichtbar nur für Projektrollen, UE und Gremium des Portfolios (UX-OF-13, A-34)
  vertraulich  boolean NOT NULL DEFAULT false,
  -- Angaben aus der Idee bzw. der Übernahme (fachmodell.md 1.1: das untere Modul liest das obere nie)
  herkunft     jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(herkunft) = 'object'),
  version      int NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid DEFAULT app.principal_id(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, portfolio_id) REFERENCES ppm.portfolio (tenant_id, id)
);
CREATE UNIQUE INDEX projekt_nummer ON ppm.projekt (tenant_id, nummer);
CREATE INDEX projekt_portfolio ON ppm.projekt (tenant_id, portfolio_id);

-- Version und Änderungszeit setzt die Datenbank (ETag/If-Match über version; updated_at trägt die Version der Kette
-- in src/authz/resources.ts)
CREATE FUNCTION ppm.portfolio_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = ppm, pg_temp AS $$
BEGIN
  NEW.version := OLD.version + 1;
  NEW.updated_at := now();
  NEW.updated_by := app.principal_id();
  NEW.created_at := OLD.created_at;
  NEW.created_by := OLD.created_by;
  RETURN NEW;
END $$;
CREATE TRIGGER portfolio_touch BEFORE UPDATE ON ppm.portfolio FOR EACH ROW EXECUTE FUNCTION ppm.portfolio_touch();
REVOKE ALL ON FUNCTION ppm.portfolio_touch() FROM PUBLIC;

CREATE FUNCTION ppm.projekt_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = ppm, pg_temp AS $$
BEGIN
  NEW.version := OLD.version + 1;
  NEW.updated_at := now();
  NEW.updated_by := app.principal_id();
  NEW.created_at := OLD.created_at;
  NEW.created_by := OLD.created_by;
  RETURN NEW;
END $$;
CREATE TRIGGER projekt_touch BEFORE UPDATE ON ppm.projekt FOR EACH ROW EXECUTE FUNCTION ppm.projekt_touch();
REVOKE ALL ON FUNCTION ppm.projekt_touch() FROM PUBLIC;

SELECT app.secure_tenant_tables();

-- Lesesicht (identity-kit 7.6, fachmodell.md 3.4)
-- Muster PORTFOLIO: Recht an der Organisation oder Rolle an genau diesem Portfolio
CREATE POLICY portfolio_read ON ppm.portfolio AS RESTRICTIVE FOR SELECT TO ppm_app
  USING (app.has_permission('portfolio:read') OR app.has_permission('portfolio:read', 'portfolio', id));
CREATE POLICY portfolio_insert ON ppm.portfolio AS RESTRICTIVE FOR INSERT TO ppm_app WITH CHECK (app.has_permission('portfolio:admin'));
CREATE POLICY portfolio_update ON ppm.portfolio AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('portfolio:admin')) WITH CHECK (app.has_permission('portfolio:admin'));
CREATE POLICY portfolio_delete ON ppm.portfolio AS RESTRICTIVE FOR DELETE TO ppm_app USING (app.has_permission('portfolio:admin'));

-- Muster PROJEKT (Blatt): Lesen über Rolle an org, am Portfolio oder am Projekt; vertrauliche Projekte zusätzlich nur
-- mit Projektrolle oder projekt:vertraulich (an org oder am Portfolio, A-34)
CREATE POLICY projekt_read ON ppm.projekt AS RESTRICTIVE FOR SELECT TO ppm_app USING (
  (app.read_all() OR portfolio_id = ANY (app.read_types()) OR app.has_tuple('projekt', id, app.read_relations()))
  AND (NOT vertraulich OR app.has_tuple('projekt', id, app.read_relations())
       OR app.has_permission('projekt:vertraulich') OR app.has_permission('projekt:vertraulich', 'portfolio', portfolio_id)));
CREATE POLICY projekt_insert ON ppm.projekt AS RESTRICTIVE FOR INSERT TO ppm_app
  WITH CHECK (app.has_permission('projekt:create') OR app.has_permission('projekt:create', 'portfolio', portfolio_id));
CREATE POLICY projekt_update ON ppm.projekt AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.write_all() OR portfolio_id = ANY (app.write_types()) OR app.has_tuple('projekt', id, app.write_relations()))
  WITH CHECK (app.write_all() OR portfolio_id = ANY (app.write_types()) OR app.has_tuple('projekt', id, app.write_relations()));
CREATE POLICY projekt_delete ON ppm.projekt AS RESTRICTIVE FOR DELETE TO ppm_app
  USING (app.write_all() OR portfolio_id = ANY (app.write_types()) OR app.has_tuple('projekt', id, app.write_relations()));

-- Hilfsfunktionen der Lesesicht für die Tabellen unter dem Projekt (Muster KIND, BETRAG): Rechte der aufrufenden
-- Rolle, die Policy von ppm.projekt wirkt mit (kein SECURITY DEFINER)
CREATE FUNCTION ppm.projekt_sichtbar(p_projekt_id uuid) RETURNS boolean LANGUAGE sql STABLE SET search_path = ppm, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM ppm.projekt WHERE id = p_projekt_id)
$$;
CREATE FUNCTION ppm.portfolio_von(p_projekt_id uuid) RETURNS uuid LANGUAGE sql STABLE SET search_path = ppm, pg_temp AS $$
  SELECT portfolio_id FROM ppm.projekt WHERE id = p_projekt_id
$$;
REVOKE ALL ON FUNCTION ppm.projekt_sichtbar(uuid), ppm.portfolio_von(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ppm.projekt_sichtbar(uuid), ppm.portfolio_von(uuid) TO ppm_app;
