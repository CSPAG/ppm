-- Kapazität aus dem HR-System je Rolle und Monat (BC RK.01.02, UC-009 Schritt 1; AP-E7-2): die Schnittstelle «HR-System ›
-- Personal- und Abwesenheitsdaten» (A-54) liefert Personen mit Rolle, Pensum und Abwesenheit je Monat; übernommen wird
-- nur die Summe je Rolle und Monat (Pensum minus Abwesenheit, Anzahl Personen), keine Personendaten. Das Angebot, das die
-- RM festlegt (270 `kapazitaet`, UC-009 Schritt 2), hat Vorrang; ohne Erfassung gilt dieser Wert (Annahme AP-E7-2).
-- Ein Lauf ersetzt die gelieferten Monate (`uebernommen_at` = Zeitpunkt des Laufs).
CREATE TABLE ppm.kapazitaet_hr (
  tenant_id      uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  rolle          text NOT NULL CHECK (rolle ~ '^[A-Za-z0-9_]{1,40}$'),
  monat          text NOT NULL CHECK (monat ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  fte            numeric(8, 2) NOT NULL CHECK (fte >= 0 AND fte <= 100000),
  abwesend       numeric(8, 2) NOT NULL DEFAULT 0 CHECK (abwesend >= 0 AND abwesend <= 100000),
  personen       int NOT NULL CHECK (personen >= 0),
  uebernommen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, rolle, monat)
);
CREATE INDEX kapazitaet_hr_monat ON ppm.kapazitaet_hr (tenant_id, monat, rolle);

SELECT app.secure_tenant_tables();

-- Lesesicht nach Muster ORG wie `kapazitaet` (270); schreiben nur der Lauf der Schnittstelle (volle Sicht) bzw. wer das
-- Angebot pflegt
CREATE POLICY kapazitaet_hr_read ON ppm.kapazitaet_hr AS RESTRICTIVE FOR SELECT TO ppm_app USING (app.has_permission('ressource:read'));
CREATE POLICY kapazitaet_hr_insert ON ppm.kapazitaet_hr AS RESTRICTIVE FOR INSERT TO ppm_app WITH CHECK (app.has_permission('ressource:write'));
CREATE POLICY kapazitaet_hr_update ON ppm.kapazitaet_hr AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('ressource:write')) WITH CHECK (app.has_permission('ressource:write'));
CREATE POLICY kapazitaet_hr_delete ON ppm.kapazitaet_hr AS RESTRICTIVE FOR DELETE TO ppm_app USING (app.has_permission('ressource:write'));
