-- Priorisierungsentscheid (UC-008 Schritte 7–8, A2; Kernablauf K5 Schritte 7–8; docs/fachmodell.md 2.12; AP-E5-5):
-- Der Antrag (Szenario «beantragt», AP-E5-3) kommt als Traktandum der Art `priorisierung` ins Gremium. Mit dem Entscheid
-- werden Rang und Start des Szenarios Ist-Stand (Rangfolge «entschieden»), das Szenario «entschieden». Für jedes laufende
-- Projekt unter der Wasserlinie beantragt die UE einen Folgeentscheid (A2: zurückstellen, sistieren, abbrechen), der mit
-- dem Entscheid gilt; Sistieren und Abbrechen leiten UC-015 ein.

-- Start als Teil des Ist-Stands (K5 Schritt 8: «Rang und Start … werden Ist-Stand»); NULL = wie geplant
ALTER TABLE ppm.rangfolge ADD COLUMN start_monat text CHECK (start_monat ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

ALTER TABLE ppm.szenario ADD COLUMN entschieden_at timestamptz;

-- Folgeentscheid je laufendem Projekt unter der Wasserlinie (UC-008 A2), beantragt mit dem Szenario
CREATE TABLE ppm.szenario_folge (
  tenant_id    uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  szenario_id  uuid NOT NULL,
  projekt_id   uuid NOT NULL,
  folge        text NOT NULL CHECK (folge IN ('zurueckstellen', 'sistieren', 'abbrechen')),
  begruendung  text NOT NULL DEFAULT '' CHECK (length(begruendung) <= 1000),
  PRIMARY KEY (tenant_id, szenario_id, projekt_id),
  FOREIGN KEY (tenant_id, szenario_id) REFERENCES ppm.szenario (tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, projekt_id) REFERENCES ppm.projekt (tenant_id, id) ON DELETE CASCADE
);

SELECT app.secure_tenant_tables();

-- Lesesicht wie die Positionen (Portfolio des Szenarios, Muster PORTFOLIO, fachmodell.md 3.4)
CREATE POLICY szenario_folge_read ON ppm.szenario_folge AS RESTRICTIVE FOR SELECT TO ppm_app
  USING (ppm.szenario_portfolio(szenario_id) IS NOT NULL);
CREATE POLICY szenario_folge_insert ON ppm.szenario_folge AS RESTRICTIVE FOR INSERT TO ppm_app
  WITH CHECK (app.has_permission('priorisierung:write') OR app.has_permission('priorisierung:write', 'portfolio', ppm.szenario_portfolio(szenario_id)));
CREATE POLICY szenario_folge_update ON ppm.szenario_folge AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('priorisierung:write') OR app.has_permission('priorisierung:write', 'portfolio', ppm.szenario_portfolio(szenario_id)))
  WITH CHECK (app.has_permission('priorisierung:write') OR app.has_permission('priorisierung:write', 'portfolio', ppm.szenario_portfolio(szenario_id)));
CREATE POLICY szenario_folge_delete ON ppm.szenario_folge AS RESTRICTIVE FOR DELETE TO ppm_app
  USING (app.has_permission('priorisierung:write') OR app.has_permission('priorisierung:write', 'portfolio', ppm.szenario_portfolio(szenario_id)));
