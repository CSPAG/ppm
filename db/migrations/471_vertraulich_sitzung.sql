-- 471 Sitzungen und Traktanden nach «vertraulich heisst nur wer eingetragen ist» (AP-E9-1; Master Entscheid 22, A-76)
--
-- Bisher sah ein vertrauliches Traktandum, wer `projekt:vertraulich` an der Organisation oder am Portfolio hat (A-34),
-- also auch «alle Portfolios lesen». Nach A-76 reicht das bei vertraulichen Objekten nicht mehr:
-- - Sitzungen, Traktanden und Einladungen eines Gremiums sieht mit `sitzung:read` nur, wer auch dessen Portfolio sieht
--   (`portfolio_read`, bei einem vertraulichen Portfolio nur Eingetragene); Eingeladene sehen ihr Traktandum weiter.
-- - Ein vertrauliches Traktandum lesen Mitglieder nur, wenn sie das Projekt trotz «vertraulich» lesen
--   (`ppm.vertraulich_lesbar`, 470); `sitzung:write` sieht wie bisher alles.
-- Protokoll, Unterlagen und Entscheide folgen über ihre Policies (`EXISTS` auf Sitzung bzw. Traktandum).

-- Portfolio in der Lesesicht der Person (Rechte der aufrufenden Rolle, kein SECURITY DEFINER)
CREATE FUNCTION ppm.portfolio_sichtbar(p_portfolio_id uuid) RETURNS boolean LANGUAGE sql STABLE
  SET search_path = ppm, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM ppm.portfolio pf WHERE pf.id = p_portfolio_id)
$$;
REVOKE ALL ON FUNCTION ppm.portfolio_sichtbar(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ppm.portfolio_sichtbar(uuid) TO ppm_app;

DROP POLICY sitzung_read ON ppm.sitzung;
CREATE POLICY sitzung_read ON ppm.sitzung AS RESTRICTIVE FOR SELECT TO ppm_app USING (
  ((ppm.gremium_recht('sitzung:read', portfolio_id) OR ppm.gremium_recht('sitzung:write', portfolio_id)) AND ppm.portfolio_sichtbar(portfolio_id))
  OR EXISTS (SELECT 1 FROM ppm.einladung e WHERE e.sitzung_id = sitzung.id AND e.person_id = app.principal_id() AND e.versendet_at IS NOT NULL));

DROP POLICY traktandum_read ON ppm.traktandum;
CREATE POLICY traktandum_read ON ppm.traktandum AS RESTRICTIVE FOR SELECT TO ppm_app USING (
  current_setting('app.sitzung_intern', true) = 'on'
  OR ppm.gremium_recht('sitzung:write', portfolio_id)
  OR (versendet_at IS NOT NULL AND ppm.gremium_recht('sitzung:read', portfolio_id) AND ppm.portfolio_sichtbar(portfolio_id)
      AND (NOT vertraulich OR ppm.vertraulich_lesbar(projekt_id, portfolio_id)))
  OR (versendet_at IS NOT NULL AND EXISTS (SELECT 1 FROM ppm.einladung e WHERE e.traktandum_id = traktandum.id AND e.person_id = app.principal_id())));

DROP POLICY einladung_read ON ppm.einladung;
CREATE POLICY einladung_read ON ppm.einladung AS RESTRICTIVE FOR SELECT TO ppm_app USING (
  ppm.gremium_recht('sitzung:write', portfolio_id)
  OR (versendet_at IS NOT NULL AND (person_id = app.principal_id()
      OR (ppm.gremium_recht('sitzung:read', portfolio_id) AND ppm.portfolio_sichtbar(portfolio_id)))));

-- Traktanden übernehmen «vertraulich» vom Projekt samt der Stufe seines Portfolios (Geschäft in einem anderen Gremium);
-- bestehende nachführen
UPDATE ppm.traktandum t SET vertraulich = true
  FROM ppm.projekt p
 WHERE p.tenant_id = t.tenant_id AND p.id = t.projekt_id AND p.portfolio_vertraulich AND NOT t.vertraulich;
