-- 460 Versionen statt Sperre am Statusbericht (AP-E8-5; UC-004 A4, UC-005 A4; Master G2, A-75, UX-E13)
--
-- Ein eingereichter oder geprüfter Bericht bleibt änderbar, auch nach dem Abschluss der Periode. Die Änderung trägt die
-- Markierung «geändert nach Einreichen» bzw. «geändert nach Abschluss»; der Verlauf kommt aus dem Audit. Nach dem
-- Abschluss führt die Änderung die Zeile des Dashboards nach (sonst unveränderlich): nur in voller Sicht (Folge der
-- Änderung, das Recht prüft die Route).
ALTER TABLE ppm.statusbericht
  ADD COLUMN geaendert_nach text CHECK (geaendert_nach IN ('einreichen', 'abschluss')),
  ADD COLUMN geaendert_nach_at timestamptz,
  ADD CONSTRAINT statusbericht_geaendert_nach CHECK ((geaendert_nach IS NULL) = (geaendert_nach_at IS NULL));

GRANT UPDATE (statusbericht_id, gemeldet, status, trend, phase, abschluss_per, naechster_meilenstein, werte_aus) ON ppm.dashboard_zeile TO ppm_app;
CREATE POLICY dashboard_zeile_update ON ppm.dashboard_zeile AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.write_all()) WITH CHECK (app.write_all());
