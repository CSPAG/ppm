-- Portfolios und Gremien (BC AM.02.04; UC-017 Schritt 4, A1; docs/fachmodell.md 2.4): Pflichten je Kategorie, Gremien,
-- Gremienweg je Gate und Sitzungstermine. Die Kerntabelle ppm.portfolio entsteht in 010 (AP-E0-1).

-- Pflichten folgen der Kategorie: A und B mit Vertrag, Quality-Check und Monatsbericht (A-07), C freiwillig ohne
-- Pflicht-Gates und Pflicht-Reporting (A-08, UC-017 A1)
ALTER TABLE ppm.portfolio ADD CONSTRAINT portfolio_pflichten CHECK (pflichten = (kategorie <> 'C'));
-- Direktion des Portfolios der Kategorie C (A-23): Organisationseinheit aus stammdaten (020)
ALTER TABLE ppm.portfolio ADD COLUMN org_einheit_id uuid;
ALTER TABLE ppm.portfolio ADD CONSTRAINT portfolio_org_einheit_fk FOREIGN KEY (tenant_id, org_einheit_id) REFERENCES ppm.org_einheit (tenant_id, id);
ALTER TABLE ppm.portfolio ADD CONSTRAINT portfolio_org_einheit CHECK (kategorie = 'C' OR org_einheit_id IS NULL);

CREATE TABLE ppm.gremium (
  tenant_id    uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id           uuid NOT NULL DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL,
  -- prat, glpa, sns-vr oder Kürzel der Direktion; Schlüssel in Adressen (/gremien/<kuerzel>)
  kuerzel      text NOT NULL CHECK (kuerzel ~ '^[a-z0-9][a-z0-9-]{0,39}$'),
  name         text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  -- entscheidend: Mitglieder mit Rolle gremium am Portfolio (A-45); extern: ohne Benutzer, die UE erfasst Vorlage und
  -- Entscheid (SNS-VR, UX-E8, A-02)
  art          text NOT NULL CHECK (art IN ('entscheidend', 'extern')),
  -- Sitzungsrhythmus als Text (UC-017 Schritt 4, z. B. «monatlich»); die Termine stehen in ppm.sitzungstermin
  rhythmus     text NOT NULL DEFAULT '' CHECK (length(rhythmus) <= 200),
  version      int NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid DEFAULT app.principal_id(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, portfolio_id) REFERENCES ppm.portfolio (tenant_id, id)
);
CREATE UNIQUE INDEX gremium_kuerzel ON ppm.gremium (tenant_id, kuerzel);
CREATE UNIQUE INDEX gremium_portfolio_id ON ppm.gremium (tenant_id, portfolio_id, id);
-- je Portfolio genau ein entscheidendes Gremium (A-45)
CREATE UNIQUE INDEX gremium_entscheidend ON ppm.gremium (tenant_id, portfolio_id) WHERE art = 'entscheidend';

-- Gremienweg je Gate (PS.02.02, Q8 Kap. 5.1): entscheidendes Gremium, in P0 und P1 bis zur Freigabe von P2 zusätzlich
-- der SNS-VR. Gates mit den Codes des Phasenmodells (fachmodell.md 2.3), gültig für jede Version.
CREATE TABLE ppm.gremienweg (
  tenant_id              uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id                     uuid NOT NULL DEFAULT gen_random_uuid(),
  portfolio_id           uuid NOT NULL,
  gate_code              text NOT NULL CHECK (gate_code IN ('EINTRITT_P0', 'P0_P1', 'P1_P2', 'P2_P3', 'P3_P4', 'EXIT_P4')),
  gremium_id             uuid NOT NULL,
  zusaetzlich_gremium_id uuid,
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, portfolio_id, gate_code),
  CHECK (zusaetzlich_gremium_id IS DISTINCT FROM gremium_id),
  FOREIGN KEY (tenant_id, portfolio_id) REFERENCES ppm.portfolio (tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, portfolio_id, gremium_id) REFERENCES ppm.gremium (tenant_id, portfolio_id, id),
  FOREIGN KEY (tenant_id, portfolio_id, zusaetzlich_gremium_id) REFERENCES ppm.gremium (tenant_id, portfolio_id, id)
);

-- Geplante Sitzungstermine je Gremium (UC-006 Vorbedingung); die Sitzung entsteht daraus (AP-E2-1)
CREATE TABLE ppm.sitzungstermin (
  tenant_id    uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id           uuid NOT NULL DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL,
  gremium_id   uuid NOT NULL,
  datum        date NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, gremium_id, datum),
  FOREIGN KEY (tenant_id, portfolio_id, gremium_id) REFERENCES ppm.gremium (tenant_id, portfolio_id, id) ON DELETE CASCADE
);

-- Portfolio eines Gremiums ist fest (Gremienweg und Termine hängen am Paar Portfolio/Gremium)
CREATE FUNCTION ppm.gremium_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = ppm, pg_temp AS $$
BEGIN
  NEW.version := OLD.version + 1;
  NEW.updated_at := now();
  NEW.updated_by := app.principal_id();
  NEW.created_at := OLD.created_at;
  NEW.created_by := OLD.created_by;
  NEW.portfolio_id := OLD.portfolio_id;
  RETURN NEW;
END $$;
CREATE TRIGGER gremium_touch BEFORE UPDATE ON ppm.gremium FOR EACH ROW EXECUTE FUNCTION ppm.gremium_touch();
REVOKE ALL ON FUNCTION ppm.gremium_touch() FROM PUBLIC;

SELECT app.secure_tenant_tables();

-- Lesesicht, Muster PORTFOLIO (fachmodell.md 3.4): Lesen mit portfolio:read, Schreiben mit portfolio:admin
CREATE POLICY gremium_read ON ppm.gremium AS RESTRICTIVE FOR SELECT TO ppm_app
  USING (app.has_permission('portfolio:read') OR app.has_permission('portfolio:read', 'portfolio', portfolio_id));
CREATE POLICY gremium_insert ON ppm.gremium AS RESTRICTIVE FOR INSERT TO ppm_app WITH CHECK (app.has_permission('portfolio:admin'));
CREATE POLICY gremium_update ON ppm.gremium AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('portfolio:admin')) WITH CHECK (app.has_permission('portfolio:admin'));
CREATE POLICY gremium_delete ON ppm.gremium AS RESTRICTIVE FOR DELETE TO ppm_app USING (app.has_permission('portfolio:admin'));

CREATE POLICY gremienweg_read ON ppm.gremienweg AS RESTRICTIVE FOR SELECT TO ppm_app
  USING (app.has_permission('portfolio:read') OR app.has_permission('portfolio:read', 'portfolio', portfolio_id));
CREATE POLICY gremienweg_insert ON ppm.gremienweg AS RESTRICTIVE FOR INSERT TO ppm_app WITH CHECK (app.has_permission('portfolio:admin'));
CREATE POLICY gremienweg_update ON ppm.gremienweg AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('portfolio:admin')) WITH CHECK (app.has_permission('portfolio:admin'));
CREATE POLICY gremienweg_delete ON ppm.gremienweg AS RESTRICTIVE FOR DELETE TO ppm_app USING (app.has_permission('portfolio:admin'));

CREATE POLICY sitzungstermin_read ON ppm.sitzungstermin AS RESTRICTIVE FOR SELECT TO ppm_app
  USING (app.has_permission('portfolio:read') OR app.has_permission('portfolio:read', 'portfolio', portfolio_id));
CREATE POLICY sitzungstermin_insert ON ppm.sitzungstermin AS RESTRICTIVE FOR INSERT TO ppm_app WITH CHECK (app.has_permission('portfolio:admin'));
CREATE POLICY sitzungstermin_delete ON ppm.sitzungstermin AS RESTRICTIVE FOR DELETE TO ppm_app USING (app.has_permission('portfolio:admin'));
