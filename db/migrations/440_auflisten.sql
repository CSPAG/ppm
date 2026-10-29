-- 440 Projekte auflisten und eingereichte Ideen lesen für alle Mitglieder (AP-E8-3; Master Entscheid 14; A-73)
--
-- Projekte: Mit `projekt:list` ist die Zeile eines nicht vertraulichen Projekts sichtbar (Kopfdaten). Die Details hängen
-- an ppm.projekt_sichtbar(); die Funktion prüft neu das Leserecht ausdrücklich, damit das Auflisten keine Details
-- freigibt (fachmodell.md 3.4). Projektauftraggeber:in und Projektleitung gehören zu den Kopfdaten: ihre Zeilen der
-- Projektorganisation sind mit der Projektzeile sichtbar.
-- Ideen: Mit `idee:list` sind eingereichte Ideen (nicht Entwürfe) sichtbar; Rückfragen nur für die Person, die die Idee
-- erfasst hat, und mit `idee:read` (eigene Bedingung statt über die Sichtbarkeit der Idee).

-- Leserecht am Projekt ohne Auflisten (Muster PROJEKT, erster Teil); die Bedingung «vertraulich» prüft die Policy
CREATE FUNCTION ppm.projekt_lesbar(p_id uuid, p_portfolio_id uuid) RETURNS boolean LANGUAGE sql STABLE
  SET search_path = ppm, pg_temp AS $$
  SELECT app.read_all() OR p_portfolio_id = ANY (app.read_types()) OR app.has_tuple('projekt', p_id, app.read_relations())
$$;
REVOKE ALL ON FUNCTION ppm.projekt_lesbar(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ppm.projekt_lesbar(uuid, uuid) TO ppm_app;

DROP POLICY projekt_read ON ppm.projekt;
CREATE POLICY projekt_read ON ppm.projekt AS RESTRICTIVE FOR SELECT TO ppm_app USING (
  ((app.has_permission('projekt:list') AND NOT vertraulich) OR ppm.projekt_lesbar(id, portfolio_id))
  AND (NOT vertraulich OR app.has_tuple('projekt', id, app.read_relations())
       OR app.has_permission('projekt:vertraulich') OR app.has_permission('projekt:vertraulich', 'portfolio', portfolio_id)));

-- Sichtbar für die Details (Muster KIND, BETRAG, STAND): Zeile sichtbar (Policy oben, mit «vertraulich») und lesbar
CREATE OR REPLACE FUNCTION ppm.projekt_sichtbar(p_projekt_id uuid) RETURNS boolean LANGUAGE sql STABLE
  SET search_path = ppm, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM ppm.projekt p WHERE p.id = p_projekt_id AND ppm.projekt_lesbar(p.id, p.portfolio_id))
$$;

-- Kopfdaten: Projektauftraggeber:in und Projektleitung mit der Projektzeile
DROP POLICY projekt_person_read ON ppm.projekt_person;
CREATE POLICY projekt_person_read ON ppm.projekt_person AS RESTRICTIVE FOR SELECT TO ppm_app USING (
  ppm.projekt_sichtbar(projekt_id)
  OR (funktion IN ('sp', 'pl') AND EXISTS (SELECT 1 FROM ppm.projekt p WHERE p.tenant_id = projekt_person.tenant_id AND p.id = projekt_person.projekt_id)));

-- Ideen: eingereichte für alle mit `idee:list`
DROP POLICY idee_read ON ppm.idee;
CREATE POLICY idee_read ON ppm.idee AS RESTRICTIVE FOR SELECT TO ppm_app USING (
  erfasst_von = app.principal_id() OR (app.principal_id() IS NULL AND app.read_all())
  OR (stand <> 'entwurf' AND (vorgesehener_sponsor = app.principal_id() OR app.has_permission('idee:read') OR app.has_permission('idee:list')
                              OR (portfolio_id IS NOT NULL AND app.has_permission('idee:read', 'portfolio', portfolio_id)))));

-- Rückfragen: eigene Bedingung (A-73), nicht über die Sichtbarkeit der Idee
DROP POLICY idee_rueckfrage_read ON ppm.idee_rueckfrage;
CREATE POLICY idee_rueckfrage_read ON ppm.idee_rueckfrage AS RESTRICTIVE FOR SELECT TO ppm_app USING (
  EXISTS (SELECT 1 FROM ppm.idee i WHERE i.tenant_id = idee_rueckfrage.tenant_id AND i.id = idee_rueckfrage.idee_id
             AND (i.erfasst_von = app.principal_id() OR (app.principal_id() IS NULL AND app.read_all())
                  OR app.has_permission('idee:read')
                  OR (i.portfolio_id IS NOT NULL AND app.has_permission('idee:read', 'portfolio', i.portfolio_id)))));
