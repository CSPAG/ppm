-- Rangfolge der Projekte je Portfolio (BC PP.02.02, UC-008 Schritt 1 «bisherige Rangfolge», Schritt 8; docs/fachmodell.md
-- 2.12; AP-E5-2). Die UE bereitet die Rangfolge als Entwurf vor (je Projekt mit Begründung, PP.02.02 «begründete
-- Rangfolge»); entschieden setzt sie erst der Entscheid des Gremiums (AP-E5-5). Der Entwurf wird als ganze Liste ersetzt;
-- `version` ist die Fassung der Liste (If-Match).
-- Setzt nur Tabellen aus 001–069 voraus (Mandant, Portfolio, Projekt).

CREATE TABLE ppm.rangfolge (
  tenant_id    uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id           uuid NOT NULL DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL,
  projekt_id   uuid NOT NULL,
  rang         int NOT NULL CHECK (rang >= 1),
  stand        text NOT NULL CHECK (stand IN ('entwurf', 'entschieden')),
  begruendung  text NOT NULL DEFAULT '' CHECK (length(begruendung) <= 1000),
  version      int NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid DEFAULT app.principal_id(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, portfolio_id, stand, projekt_id),
  UNIQUE (tenant_id, portfolio_id, stand, rang),
  FOREIGN KEY (tenant_id, portfolio_id) REFERENCES ppm.portfolio (tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, projekt_id) REFERENCES ppm.projekt (tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX rangfolge_portfolio ON ppm.rangfolge (tenant_id, portfolio_id, stand, rang);

SELECT app.secure_tenant_tables();

-- Lesesicht nach Muster PORTFOLIO (fachmodell.md 3.4): priorisierung:read bzw. :write an der Organisation oder am Portfolio
CREATE POLICY rangfolge_read ON ppm.rangfolge AS RESTRICTIVE FOR SELECT TO ppm_app
  USING (app.has_permission('priorisierung:read') OR app.has_permission('priorisierung:read', 'portfolio', portfolio_id));
CREATE POLICY rangfolge_insert ON ppm.rangfolge AS RESTRICTIVE FOR INSERT TO ppm_app
  WITH CHECK (app.has_permission('priorisierung:write') OR app.has_permission('priorisierung:write', 'portfolio', portfolio_id));
CREATE POLICY rangfolge_update ON ppm.rangfolge AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('priorisierung:write') OR app.has_permission('priorisierung:write', 'portfolio', portfolio_id))
  WITH CHECK (app.has_permission('priorisierung:write') OR app.has_permission('priorisierung:write', 'portfolio', portfolio_id));
CREATE POLICY rangfolge_delete ON ppm.rangfolge AS RESTRICTIVE FOR DELETE TO ppm_app
  USING (app.has_permission('priorisierung:write') OR app.has_permission('priorisierung:write', 'portfolio', portfolio_id));
