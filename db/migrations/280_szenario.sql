-- Szenarien mit Reihenfolge und Start (BC PP.03.01–03; UC-008 Schritte 5–6; Kernablauf K5 Schritte 5–6;
-- docs/fachmodell.md 2.12; AP-E5-3). Ein Szenario ist eine Kopie des Ist-Stands eines Portfolios: je Projekt Rang,
-- Startmonat und ob es im Szenario enthalten ist. Der Ist-Stand (Rangfolge, Projekte) ändert sich dadurch nicht; nur der
-- Entscheid des Gremiums übernimmt ein Szenario (AP-E5-5). Die Wasserlinie wird gerechnet, nicht gespeichert.
-- «Als Antrag wählen» (K5 Schritt 6) hält die Entscheidungsvorlage mit den verglichenen Szenarien als Stand fest.
-- Setzt nur Tabellen aus 001–069 voraus (Mandant, Portfolio, Projekt).

CREATE TABLE ppm.szenario (
  tenant_id     uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id            uuid NOT NULL DEFAULT gen_random_uuid(),
  portfolio_id  uuid NOT NULL,
  name          text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 100),
  stand         text NOT NULL DEFAULT 'entwurf' CHECK (stand IN ('entwurf', 'beantragt', 'entschieden', 'verworfen')),
  -- Entscheidungsvorlage bei «Als Antrag wählen»: verglichene Szenarien mit Wasserlinie und Hinweisen als Stand
  vorlage       jsonb CHECK (vorlage IS NULL OR jsonb_typeof(vorlage) = 'object'),
  beantragt_at  timestamptz,
  version       int NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid DEFAULT app.principal_id(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, portfolio_id) REFERENCES ppm.portfolio (tenant_id, id) ON DELETE CASCADE,
  CHECK (stand <> 'beantragt' OR (vorlage IS NOT NULL AND beantragt_at IS NOT NULL))
);
CREATE INDEX szenario_portfolio ON ppm.szenario (tenant_id, portfolio_id, created_at);
-- Höchstens ein Antrag je Portfolio (Annahme AP-E5-3: ein neuer Antrag ersetzt den bisherigen, docs/umsetzungsstand.md)
CREATE UNIQUE INDEX szenario_beantragt ON ppm.szenario (tenant_id, portfolio_id) WHERE stand = 'beantragt';

-- Position je Projekt: Rang (Reihenfolge), Startmonat (NULL = wie geplant), enthalten oder nicht
CREATE TABLE ppm.szenario_position (
  tenant_id    uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  szenario_id  uuid NOT NULL,
  projekt_id   uuid NOT NULL,
  rang         int NOT NULL CHECK (rang >= 1),
  start_monat  text CHECK (start_monat ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  aktiv        boolean NOT NULL DEFAULT true,
  PRIMARY KEY (tenant_id, szenario_id, projekt_id),
  UNIQUE (tenant_id, szenario_id, rang),
  FOREIGN KEY (tenant_id, szenario_id) REFERENCES ppm.szenario (tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, projekt_id) REFERENCES ppm.projekt (tenant_id, id) ON DELETE CASCADE
);

CREATE TRIGGER szenario_touch BEFORE UPDATE ON ppm.szenario FOR EACH ROW EXECUTE FUNCTION ppm.priorisierung_touch();

-- Portfolio eines Szenarios unter der Lesesicht der aufrufenden Rolle (nicht SECURITY DEFINER, fachmodell.md 3.4)
CREATE FUNCTION ppm.szenario_portfolio(szenario uuid) RETURNS uuid LANGUAGE sql STABLE SET search_path = ppm, pg_temp AS $$
  SELECT s.portfolio_id FROM ppm.szenario s WHERE s.id = szenario
$$;
REVOKE ALL ON FUNCTION ppm.szenario_portfolio(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ppm.szenario_portfolio(uuid) TO ppm_app;

SELECT app.secure_tenant_tables();

-- Lesesicht nach Muster PORTFOLIO (fachmodell.md 3.4): priorisierung:read bzw. :write an der Organisation oder am Portfolio
CREATE POLICY szenario_read ON ppm.szenario AS RESTRICTIVE FOR SELECT TO ppm_app
  USING (app.has_permission('priorisierung:read') OR app.has_permission('priorisierung:read', 'portfolio', portfolio_id));
CREATE POLICY szenario_insert ON ppm.szenario AS RESTRICTIVE FOR INSERT TO ppm_app
  WITH CHECK (app.has_permission('priorisierung:write') OR app.has_permission('priorisierung:write', 'portfolio', portfolio_id));
CREATE POLICY szenario_update ON ppm.szenario AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('priorisierung:write') OR app.has_permission('priorisierung:write', 'portfolio', portfolio_id))
  WITH CHECK (app.has_permission('priorisierung:write') OR app.has_permission('priorisierung:write', 'portfolio', portfolio_id));
CREATE POLICY szenario_delete ON ppm.szenario AS RESTRICTIVE FOR DELETE TO ppm_app
  USING (app.has_permission('priorisierung:write') OR app.has_permission('priorisierung:write', 'portfolio', portfolio_id));

-- Positionen über das Portfolio ihres Szenarios (das Szenario selbst ist nur mit Leserecht sichtbar)
CREATE POLICY szenario_position_read ON ppm.szenario_position AS RESTRICTIVE FOR SELECT TO ppm_app
  USING (ppm.szenario_portfolio(szenario_id) IS NOT NULL);
CREATE POLICY szenario_position_insert ON ppm.szenario_position AS RESTRICTIVE FOR INSERT TO ppm_app
  WITH CHECK (app.has_permission('priorisierung:write') OR app.has_permission('priorisierung:write', 'portfolio', ppm.szenario_portfolio(szenario_id)));
CREATE POLICY szenario_position_update ON ppm.szenario_position AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('priorisierung:write') OR app.has_permission('priorisierung:write', 'portfolio', ppm.szenario_portfolio(szenario_id)))
  WITH CHECK (app.has_permission('priorisierung:write') OR app.has_permission('priorisierung:write', 'portfolio', ppm.szenario_portfolio(szenario_id)));
CREATE POLICY szenario_position_delete ON ppm.szenario_position AS RESTRICTIVE FOR DELETE TO ppm_app
  USING (app.has_permission('priorisierung:write') OR app.has_permission('priorisierung:write', 'portfolio', ppm.szenario_portfolio(szenario_id)));
