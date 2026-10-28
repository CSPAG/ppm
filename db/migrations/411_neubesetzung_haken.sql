-- Neubesetzung aus den Haken des Baukastens (AP-E7-8, UC-016 A1; iam 4.0 `member.removing`/`member.removed`): Die Haken
-- laufen in der Transaktion des Baukastens mit der Person, die entfernt, aber ohne deren Rechte in der Lesesicht. Wie
-- bei Aufgaben schreibt nur das Modul, solange `app.eingang_intern` gesetzt ist (Migration 070).

DROP POLICY neubesetzung_admin ON ppm.neubesetzung;
DROP POLICY neubesetzung_rolle_admin ON ppm.neubesetzung_rolle;

CREATE POLICY neubesetzung_admin ON ppm.neubesetzung AS RESTRICTIVE FOR ALL TO ppm_app
  USING (app.has_permission('members:admin') OR current_setting('app.eingang_intern', true) = 'on'
         OR (app.principal_id() IS NULL AND app.write_all()))
  WITH CHECK (app.has_permission('members:admin') OR current_setting('app.eingang_intern', true) = 'on'
              OR (app.principal_id() IS NULL AND app.write_all()));
CREATE POLICY neubesetzung_rolle_admin ON ppm.neubesetzung_rolle AS RESTRICTIVE FOR ALL TO ppm_app
  USING (app.has_permission('members:admin') OR current_setting('app.eingang_intern', true) = 'on'
         OR (app.principal_id() IS NULL AND app.write_all()))
  WITH CHECK (app.has_permission('members:admin') OR current_setting('app.eingang_intern', true) = 'on'
              OR (app.principal_id() IS NULL AND app.write_all()));
