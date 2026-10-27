-- Register je Projekt (docs/fachmodell.md 2.6; AP-E0-6): Meilensteine, Lieferergebnisse und Kommunikationsmassnahmen
-- (PS.02.04, PS.05.02, PS.05.03), Kosten je Phase (PC.01.01, PC.01.03), Risiken des Projekts und des Portfolios (PC.02.04,
-- PC.02.01, PC.02.03), KPIs mit Werten (PC.03.01, PC.03.03), Stakeholder (PS.05.01), Abhängigkeiten (PP.02.03),
-- Ressourcenbedarf (RK.02.01, RK.02.05; A-20) und Meldungen an ICT bzw. Infrastruktur (RK.02.06; A-22).
--
-- «Aufdatiert»: Die Register enthalten den aktuellen Stand. Die Baseline-Spalten (`termin_baseline`, `budget_baseline`)
-- schreibt das Modul vertrag beim Gate- oder Änderungsentscheid (bzw. die Übernahme), nie die Routen dieses Moduls.
-- Setzt nur Tabellen aus 010 voraus (ppm.projekt, ppm.portfolio, Hilfsfunktionen der Lesesicht).

-- Version und Änderungszeit setzt die Datenbank (ETag/If-Match über version); gemeinsam für alle Register
CREATE FUNCTION ppm.projektdaten_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = ppm, pg_temp AS $$
BEGIN
  NEW.version := OLD.version + 1;
  NEW.updated_at := now();
  NEW.updated_by := app.principal_id();
  NEW.created_at := OLD.created_at;
  NEW.created_by := OLD.created_by;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION ppm.projektdaten_touch() FROM PUBLIC;

-- Meilensteinplan (PS.02.04, Q7 Kap. 7.1): Lieferergebnisse und Meilensteine je Phase mit Termin, Baseline und
-- aufdatiert; Kommunikationsmassnahmen (Q7 Kap. 11.2: Massnahme, Adressat, Ziel) werden wie ein Meilenstein als
-- erledigt gemeldet (PS.05.03). `abnahme = 'gremium'`: Abnahme durch das Gremium (PS.02.03, Modul sitzung).
CREATE TABLE ppm.meilenstein (
  tenant_id       uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id              uuid NOT NULL DEFAULT gen_random_uuid(),
  projekt_id      uuid NOT NULL,
  phase           text NOT NULL CHECK (phase IN ('P0', 'P1', 'P2', 'P3', 'P4')),
  art             text NOT NULL CHECK (art IN ('meilenstein', 'lieferergebnis', 'kommunikation')),
  text            text NOT NULL CHECK (length(btrim(text)) BETWEEN 1 AND 500),
  adressat        text NOT NULL DEFAULT '' CHECK (length(adressat) <= 200),
  ziel            text NOT NULL DEFAULT '' CHECK (length(ziel) <= 500),
  termin_baseline date,
  termin_aktuell  date,
  erreicht_am     date,
  abnahme         text NOT NULL DEFAULT 'keine' CHECK (abnahme IN ('keine', 'gremium')),
  abgenommen_am   date,
  version         int NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid DEFAULT app.principal_id(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, projekt_id) REFERENCES ppm.projekt (tenant_id, id) ON DELETE CASCADE,
  CHECK (abgenommen_am IS NULL OR abnahme = 'gremium')
);
CREATE INDEX meilenstein_projekt ON ppm.meilenstein (tenant_id, projekt_id, phase);

-- Kosten je Phase (PC.01.01, Q7 Kap. 9.1): Position, Lieferant, Verweis auf Offerte, CAPEX/OPEX; Prognose aufdatiert
-- (PC.01.03); Ist-Kosten führt das Modul finanzen nach (A-16). Beträge in CHF inkl. MwSt.
CREATE TABLE ppm.kosten (
  tenant_id       uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id              uuid NOT NULL DEFAULT gen_random_uuid(),
  projekt_id      uuid NOT NULL,
  phase           text NOT NULL CHECK (phase IN ('P0', 'P1', 'P2', 'P3', 'P4')),
  art             text NOT NULL CHECK (art IN ('capex', 'opex')),
  text            text NOT NULL CHECK (length(btrim(text)) BETWEEN 1 AND 500),
  lieferant       text NOT NULL DEFAULT '' CHECK (length(lieferant) <= 200),
  offerte         text NOT NULL DEFAULT '' CHECK (length(offerte) <= 200),
  budget_baseline numeric(14, 2) CHECK (budget_baseline >= 0),
  prognose        numeric(14, 2) CHECK (prognose >= 0),
  ist             numeric(14, 2) CHECK (ist >= 0),
  version         int NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid DEFAULT app.principal_id(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, projekt_id) REFERENCES ppm.projekt (tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX kosten_projekt ON ppm.kosten (tenant_id, projekt_id, phase);

-- Risiken (Q7 Kap. 10): Projektrisiko (PC.02.04) oder Portfoliorisiko (PC.02.01), genau eines; Eintrittswahrscheinlichkeit
-- und Auswirkung hoch/mittel/tief, Massnahme mit Stand (PC.02.03)
CREATE TABLE ppm.risiko (
  tenant_id          uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id                 uuid NOT NULL DEFAULT gen_random_uuid(),
  projekt_id         uuid,
  portfolio_id       uuid,
  text               text NOT NULL CHECK (length(btrim(text)) BETWEEN 1 AND 1000),
  wahrscheinlichkeit text NOT NULL CHECK (wahrscheinlichkeit IN ('hoch', 'mittel', 'tief')),
  auswirkung         text NOT NULL CHECK (auswirkung IN ('hoch', 'mittel', 'tief')),
  massnahme          text NOT NULL DEFAULT '' CHECK (length(massnahme) <= 1000),
  massnahme_stand    text NOT NULL DEFAULT 'offen' CHECK (massnahme_stand IN ('offen', 'umgesetzt')),
  verantwortlich     text NOT NULL DEFAULT '' CHECK (length(verantwortlich) <= 200),
  version            int NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at         timestamptz NOT NULL DEFAULT now(),
  created_by         uuid DEFAULT app.principal_id(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  updated_by         uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, projekt_id) REFERENCES ppm.projekt (tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, portfolio_id) REFERENCES ppm.portfolio (tenant_id, id) ON DELETE CASCADE,
  CHECK (num_nonnulls(projekt_id, portfolio_id) = 1)
);
CREATE INDEX risiko_projekt ON ppm.risiko (tenant_id, projekt_id) WHERE projekt_id IS NOT NULL;
CREATE INDEX risiko_portfolio ON ppm.risiko (tenant_id, portfolio_id) WHERE portfolio_id IS NOT NULL;

-- KPIs (PC.03.01): klinisch, nicht-klinisch oder Projekt-KPI mit Einheit und Zielwert
CREATE TABLE ppm.kpi (
  tenant_id  uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id         uuid NOT NULL DEFAULT gen_random_uuid(),
  projekt_id uuid NOT NULL,
  art        text NOT NULL CHECK (art IN ('klinisch', 'nicht_klinisch', 'projekt')),
  text       text NOT NULL CHECK (length(btrim(text)) BETWEEN 1 AND 500),
  einheit    text NOT NULL DEFAULT '' CHECK (length(einheit) <= 50),
  zielwert   text NOT NULL DEFAULT '' CHECK (length(zielwert) <= 200),
  version    int NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT app.principal_id(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, id, projekt_id),
  FOREIGN KEY (tenant_id, projekt_id) REFERENCES ppm.projekt (tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX kpi_projekt ON ppm.kpi (tenant_id, projekt_id);

-- Werte der KPIs je Periode «YYYY-MM» (PC.03.03, ab P2); das Projekt steht mit, damit die Policy ohne Umweg prüft
CREATE TABLE ppm.kpi_wert (
  tenant_id  uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id         uuid NOT NULL DEFAULT gen_random_uuid(),
  projekt_id uuid NOT NULL,
  kpi_id     uuid NOT NULL,
  periode    text NOT NULL CHECK (periode ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  wert       numeric(18, 4) NOT NULL,
  kommentar  text NOT NULL DEFAULT '' CHECK (length(kommentar) <= 1000),
  version    int NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT app.principal_id(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, kpi_id, periode),
  FOREIGN KEY (tenant_id, kpi_id, projekt_id) REFERENCES ppm.kpi (tenant_id, id, projekt_id) ON DELETE CASCADE
);

-- Stakeholder (PS.05.01, Q7 Kap. 11.1): Gruppe, Interesse, Einfluss auf den Projekterfolg, geplante Massnahmen
CREATE TABLE ppm.stakeholder (
  tenant_id  uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id         uuid NOT NULL DEFAULT gen_random_uuid(),
  projekt_id uuid NOT NULL,
  gruppe     text NOT NULL CHECK (length(btrim(gruppe)) BETWEEN 1 AND 200),
  interesse  text NOT NULL DEFAULT '' CHECK (length(interesse) <= 1000),
  einfluss   text NOT NULL DEFAULT '' CHECK (length(einfluss) <= 1000),
  massnahmen text NOT NULL DEFAULT '' CHECK (length(massnahmen) <= 2000),
  version    int NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT app.principal_id(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, projekt_id) REFERENCES ppm.projekt (tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX stakeholder_projekt ON ppm.stakeholder (tenant_id, projekt_id);

-- Abhängigkeiten zu anderen Projekten (PP.02.03, Q7 Kap. 6) mit Ansprechperson; sichtbar bei beiden Projekten
-- (UC-002 Schritt 5), gepflegt beim erfassenden Projekt
CREATE TABLE ppm.abhaengigkeit (
  tenant_id      uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id             uuid NOT NULL DEFAULT gen_random_uuid(),
  projekt_id     uuid NOT NULL,
  zu_projekt_id  uuid NOT NULL,
  text           text NOT NULL CHECK (length(btrim(text)) BETWEEN 1 AND 1000),
  ansprechperson text NOT NULL DEFAULT '' CHECK (length(ansprechperson) <= 200),
  version        int NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid DEFAULT app.principal_id(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  updated_by     uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, projekt_id) REFERENCES ppm.projekt (tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, zu_projekt_id) REFERENCES ppm.projekt (tenant_id, id) ON DELETE CASCADE,
  UNIQUE (tenant_id, projekt_id, zu_projekt_id),
  CHECK (projekt_id <> zu_projekt_id)
);
CREATE INDEX abhaengigkeit_zu ON ppm.abhaengigkeit (tenant_id, zu_projekt_id);

-- Ressourcenbedarf je Rolle (Codewert `ressourcenrolle`) und Phase (A-20: Pool = Rolle): bis Gate P1–P2 als Grösse
-- S/M/L (RK.02.01), danach FTE × Monate (RK.02.05, UC-003 A1). `gedeckt` führt das Modul ressource nach (RK.02.04).
CREATE TABLE ppm.ressourcenbedarf (
  tenant_id  uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id         uuid NOT NULL DEFAULT gen_random_uuid(),
  projekt_id uuid NOT NULL,
  phase      text NOT NULL CHECK (phase IN ('P0', 'P1', 'P2', 'P3', 'P4')),
  rolle      text NOT NULL CHECK (rolle ~ '^[A-Za-z0-9_]{1,40}$'),
  groesse    text CHECK (groesse IN ('S', 'M', 'L')),
  fte        numeric(6, 2) CHECK (fte > 0 AND fte <= 1000),
  von_monat  text CHECK (von_monat ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  bis_monat  text CHECK (bis_monat ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  bemerkung  text NOT NULL DEFAULT '' CHECK (length(bemerkung) <= 1000),
  gedeckt    boolean NOT NULL DEFAULT false,
  version    int NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT app.principal_id(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, projekt_id) REFERENCES ppm.projekt (tenant_id, id) ON DELETE CASCADE,
  UNIQUE (tenant_id, projekt_id, phase, rolle),
  -- Grösse oder FTE mit Zeitraum (von ≤ bis), nie beides
  CHECK ((groesse IS NOT NULL AND fte IS NULL AND von_monat IS NULL AND bis_monat IS NULL)
      OR (groesse IS NULL AND fte IS NOT NULL AND von_monat IS NOT NULL AND bis_monat IS NOT NULL AND von_monat <= bis_monat))
);
CREATE INDEX ressourcenbedarf_monat ON ppm.ressourcenbedarf (tenant_id, von_monat, bis_monat) WHERE fte IS NOT NULL;

-- Meldung des ICT- bzw. Infrastrukturbedarfs (RK.02.06, UC-002 A2) an die zuständige Stelle; keine Schnittstelle
-- (A-22, K24 offen). Nur anhängen: eine Meldung ist ein Vorgang, keine Angabe, die sich ändert.
CREATE TABLE ppm.meldung (
  tenant_id   uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id          uuid NOT NULL DEFAULT gen_random_uuid(),
  projekt_id  uuid NOT NULL,
  stelle      text NOT NULL CHECK (stelle IN ('dti', 'dbi')),
  text        text NOT NULL CHECK (length(btrim(text)) BETWEEN 1 AND 2000),
  gemeldet_at timestamptz NOT NULL DEFAULT now(),
  gemeldet_by uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, projekt_id) REFERENCES ppm.projekt (tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX meldung_projekt ON ppm.meldung (tenant_id, projekt_id, gemeldet_at);

CREATE TRIGGER meilenstein_touch BEFORE UPDATE ON ppm.meilenstein FOR EACH ROW EXECUTE FUNCTION ppm.projektdaten_touch();
CREATE TRIGGER kosten_touch BEFORE UPDATE ON ppm.kosten FOR EACH ROW EXECUTE FUNCTION ppm.projektdaten_touch();
CREATE TRIGGER risiko_touch BEFORE UPDATE ON ppm.risiko FOR EACH ROW EXECUTE FUNCTION ppm.projektdaten_touch();
CREATE TRIGGER kpi_touch BEFORE UPDATE ON ppm.kpi FOR EACH ROW EXECUTE FUNCTION ppm.projektdaten_touch();
CREATE TRIGGER kpi_wert_touch BEFORE UPDATE ON ppm.kpi_wert FOR EACH ROW EXECUTE FUNCTION ppm.projektdaten_touch();
CREATE TRIGGER stakeholder_touch BEFORE UPDATE ON ppm.stakeholder FOR EACH ROW EXECUTE FUNCTION ppm.projektdaten_touch();
CREATE TRIGGER abhaengigkeit_touch BEFORE UPDATE ON ppm.abhaengigkeit FOR EACH ROW EXECUTE FUNCTION ppm.projektdaten_touch();
CREATE TRIGGER ressourcenbedarf_touch BEFORE UPDATE ON ppm.ressourcenbedarf FOR EACH ROW EXECUTE FUNCTION ppm.projektdaten_touch();

SELECT app.secure_tenant_tables();
REVOKE UPDATE, DELETE ON ppm.meldung FROM ppm_app;

-- Lesesicht (fachmodell.md 3.4). Muster KIND: lesen, wer das Projekt sieht; schreiben mit projekt:write am Projekt
-- (Rolle an der Organisation oder am Projekt)
CREATE POLICY meilenstein_read ON ppm.meilenstein AS RESTRICTIVE FOR SELECT TO ppm_app USING (ppm.projekt_sichtbar(projekt_id));
CREATE POLICY meilenstein_insert ON ppm.meilenstein AS RESTRICTIVE FOR INSERT TO ppm_app WITH CHECK (app.has_permission('projekt:write', 'projekt', projekt_id));
CREATE POLICY meilenstein_update ON ppm.meilenstein AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('projekt:write', 'projekt', projekt_id)) WITH CHECK (app.has_permission('projekt:write', 'projekt', projekt_id));
CREATE POLICY meilenstein_delete ON ppm.meilenstein AS RESTRICTIVE FOR DELETE TO ppm_app USING (app.has_permission('projekt:write', 'projekt', projekt_id));

CREATE POLICY kpi_read ON ppm.kpi AS RESTRICTIVE FOR SELECT TO ppm_app USING (ppm.projekt_sichtbar(projekt_id));
CREATE POLICY kpi_insert ON ppm.kpi AS RESTRICTIVE FOR INSERT TO ppm_app WITH CHECK (app.has_permission('projekt:write', 'projekt', projekt_id));
CREATE POLICY kpi_update ON ppm.kpi AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('projekt:write', 'projekt', projekt_id)) WITH CHECK (app.has_permission('projekt:write', 'projekt', projekt_id));
CREATE POLICY kpi_delete ON ppm.kpi AS RESTRICTIVE FOR DELETE TO ppm_app USING (app.has_permission('projekt:write', 'projekt', projekt_id));

-- KPI-Werte erfassen PL und CTL (kpi:write, PC.03.03)
CREATE POLICY kpi_wert_read ON ppm.kpi_wert AS RESTRICTIVE FOR SELECT TO ppm_app USING (ppm.projekt_sichtbar(projekt_id));
CREATE POLICY kpi_wert_insert ON ppm.kpi_wert AS RESTRICTIVE FOR INSERT TO ppm_app WITH CHECK (app.has_permission('kpi:write', 'projekt', projekt_id));
CREATE POLICY kpi_wert_update ON ppm.kpi_wert AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('kpi:write', 'projekt', projekt_id)) WITH CHECK (app.has_permission('kpi:write', 'projekt', projekt_id));
CREATE POLICY kpi_wert_delete ON ppm.kpi_wert AS RESTRICTIVE FOR DELETE TO ppm_app USING (app.has_permission('kpi:write', 'projekt', projekt_id));

CREATE POLICY stakeholder_read ON ppm.stakeholder AS RESTRICTIVE FOR SELECT TO ppm_app USING (ppm.projekt_sichtbar(projekt_id));
CREATE POLICY stakeholder_insert ON ppm.stakeholder AS RESTRICTIVE FOR INSERT TO ppm_app WITH CHECK (app.has_permission('projekt:write', 'projekt', projekt_id));
CREATE POLICY stakeholder_update ON ppm.stakeholder AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('projekt:write', 'projekt', projekt_id)) WITH CHECK (app.has_permission('projekt:write', 'projekt', projekt_id));
CREATE POLICY stakeholder_delete ON ppm.stakeholder AS RESTRICTIVE FOR DELETE TO ppm_app USING (app.has_permission('projekt:write', 'projekt', projekt_id));

CREATE POLICY ressourcenbedarf_read ON ppm.ressourcenbedarf AS RESTRICTIVE FOR SELECT TO ppm_app USING (ppm.projekt_sichtbar(projekt_id));
CREATE POLICY ressourcenbedarf_insert ON ppm.ressourcenbedarf AS RESTRICTIVE FOR INSERT TO ppm_app WITH CHECK (app.has_permission('projekt:write', 'projekt', projekt_id));
CREATE POLICY ressourcenbedarf_update ON ppm.ressourcenbedarf AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('projekt:write', 'projekt', projekt_id)) WITH CHECK (app.has_permission('projekt:write', 'projekt', projekt_id));
CREATE POLICY ressourcenbedarf_delete ON ppm.ressourcenbedarf AS RESTRICTIVE FOR DELETE TO ppm_app USING (app.has_permission('projekt:write', 'projekt', projekt_id));

CREATE POLICY meldung_read ON ppm.meldung AS RESTRICTIVE FOR SELECT TO ppm_app USING (ppm.projekt_sichtbar(projekt_id));
CREATE POLICY meldung_insert ON ppm.meldung AS RESTRICTIVE FOR INSERT TO ppm_app WITH CHECK (app.has_permission('projekt:write', 'projekt', projekt_id));

-- Abhängigkeit: sichtbar bei beiden Projekten (Abnahme AP-E0-6), gepflegt beim erfassenden
CREATE POLICY abhaengigkeit_read ON ppm.abhaengigkeit AS RESTRICTIVE FOR SELECT TO ppm_app
  USING (ppm.projekt_sichtbar(projekt_id) OR ppm.projekt_sichtbar(zu_projekt_id));
CREATE POLICY abhaengigkeit_insert ON ppm.abhaengigkeit AS RESTRICTIVE FOR INSERT TO ppm_app WITH CHECK (app.has_permission('projekt:write', 'projekt', projekt_id));
CREATE POLICY abhaengigkeit_update ON ppm.abhaengigkeit AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('projekt:write', 'projekt', projekt_id)) WITH CHECK (app.has_permission('projekt:write', 'projekt', projekt_id));
CREATE POLICY abhaengigkeit_delete ON ppm.abhaengigkeit AS RESTRICTIVE FOR DELETE TO ppm_app USING (app.has_permission('projekt:write', 'projekt', projekt_id));

-- Risiko: Projektrisiko nach Muster KIND, Portfoliorisiko nach Muster PORTFOLIO (lesen mit projekt:read an der
-- Organisation oder am Portfolio, pflegen mit projekt:write an der Organisation, PC.02.01: UE)
CREATE POLICY risiko_read ON ppm.risiko AS RESTRICTIVE FOR SELECT TO ppm_app USING (CASE WHEN projekt_id IS NOT NULL
  THEN ppm.projekt_sichtbar(projekt_id) ELSE app.has_permission('projekt:read') OR app.has_permission('projekt:read', 'portfolio', portfolio_id) END);
CREATE POLICY risiko_insert ON ppm.risiko AS RESTRICTIVE FOR INSERT TO ppm_app WITH CHECK (CASE WHEN projekt_id IS NOT NULL
  THEN app.has_permission('projekt:write', 'projekt', projekt_id) ELSE app.has_permission('projekt:write') END);
CREATE POLICY risiko_update ON ppm.risiko AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (CASE WHEN projekt_id IS NOT NULL THEN app.has_permission('projekt:write', 'projekt', projekt_id) ELSE app.has_permission('projekt:write') END)
  WITH CHECK (CASE WHEN projekt_id IS NOT NULL THEN app.has_permission('projekt:write', 'projekt', projekt_id) ELSE app.has_permission('projekt:write') END);
CREATE POLICY risiko_delete ON ppm.risiko AS RESTRICTIVE FOR DELETE TO ppm_app
  USING (CASE WHEN projekt_id IS NOT NULL THEN app.has_permission('projekt:write', 'projekt', projekt_id) ELSE app.has_permission('projekt:write') END);

-- Muster BETRAG (UX-OF-12, A-33): Beträge nur mit finanzen:read am Projekt oder am Portfolio; pflegen mit projekt:write
-- am Projekt, und nur wer die Beträge auch sieht
CREATE POLICY kosten_read ON ppm.kosten AS RESTRICTIVE FOR SELECT TO ppm_app USING (ppm.projekt_sichtbar(projekt_id)
  AND (app.has_permission('finanzen:read', 'projekt', projekt_id) OR app.has_permission('finanzen:read', 'portfolio', ppm.portfolio_von(projekt_id))));
CREATE POLICY kosten_insert ON ppm.kosten AS RESTRICTIVE FOR INSERT TO ppm_app WITH CHECK (app.has_permission('projekt:write', 'projekt', projekt_id)
  AND (app.has_permission('finanzen:read', 'projekt', projekt_id) OR app.has_permission('finanzen:read', 'portfolio', ppm.portfolio_von(projekt_id))));
CREATE POLICY kosten_update ON ppm.kosten AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('projekt:write', 'projekt', projekt_id)) WITH CHECK (app.has_permission('projekt:write', 'projekt', projekt_id));
CREATE POLICY kosten_delete ON ppm.kosten AS RESTRICTIVE FOR DELETE TO ppm_app USING (app.has_permission('projekt:write', 'projekt', projekt_id));
