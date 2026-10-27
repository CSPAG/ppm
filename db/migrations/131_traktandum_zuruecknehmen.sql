-- Vorschlag zurücknehmen (AP-E2-1, Folge aus AP-E2-4): Module nehmen ihren Vorschlag über `traktandum.zuruecknehmen`
-- zurück (z. B. Zurückziehen des Statusberichts innert 10 s, UC-004 A2.2), ohne sitzung:write. Wie beim Anlegen und
-- Nachführen gilt das nur intern und nur für Vorschläge ohne Sitzung; ein aufgenommenes Traktandum nimmt die
-- Unternehmensentwicklung von Hand aus der Liste.
DROP POLICY traktandum_delete ON ppm.traktandum;
CREATE POLICY traktandum_delete ON ppm.traktandum AS RESTRICTIVE FOR DELETE TO ppm_app USING (
  ppm.gremium_recht('sitzung:write', portfolio_id)
  OR (current_setting('app.sitzung_intern', true) = 'on' AND sitzung_id IS NULL));
