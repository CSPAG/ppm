-- 470 Vertraulich heisst «nur wer eingetragen ist», auch am Portfolio (AP-E9-1; Master Entscheid 22, A-76; ux/zugriff.md)
--
-- Ein Projekt ist vertraulich, wenn es selbst oder sein Portfolio vertraulich ist. Dann lesen es nur Tupel am Projekt oder
-- am Portfolio (direkt oder über eine Gruppe) und wer alle Portfolios führt (`app.write_all()`); «alle Portfolios lesen»
-- und Auflisten reichen nicht mehr. Ein vertrauliches Portfolio sieht nur, wer daran oder an einem seiner Projekte ein
-- Tupel hat, und wer alle Portfolios führt; Ideen mit Zuordnung zu ihm fallen für alle anderen weg.
--
-- Die Lesesicht von `projekt` liest `portfolio` nicht (sonst Rekursion mit `portfolio_read`): das Projekt führt
-- `portfolio_vertraulich` mit, gepflegt durch Trigger beim Anlegen, Verschieben und Umstellen des Portfolios.

ALTER TABLE ppm.portfolio ADD COLUMN vertraulich boolean NOT NULL DEFAULT false;
ALTER TABLE ppm.projekt ADD COLUMN portfolio_vertraulich boolean NOT NULL DEFAULT false;

-- Beim Anlegen und Verschieben übernimmt das Projekt die Stufe seines Portfolios; ein Portfolio, das die Person nicht
-- sieht, gilt als vertraulich (sonst fiele die Regel beim Anlegen ohne Sicht auf das Portfolio weg)
CREATE FUNCTION ppm.projekt_portfolio_vertraulich() RETURNS trigger LANGUAGE plpgsql SET search_path = ppm, pg_temp AS $$
BEGIN
  NEW.portfolio_vertraulich := coalesce(
    (SELECT pf.vertraulich FROM ppm.portfolio pf WHERE pf.tenant_id = NEW.tenant_id AND pf.id = NEW.portfolio_id), true);
  RETURN NEW;
END $$;
CREATE TRIGGER projekt_portfolio_vertraulich BEFORE INSERT OR UPDATE OF portfolio_id ON ppm.projekt
  FOR EACH ROW EXECUTE FUNCTION ppm.projekt_portfolio_vertraulich();
REVOKE ALL ON FUNCTION ppm.projekt_portfolio_vertraulich() FROM PUBLIC;

-- Umstellen des Portfolios trägt die Stufe in seine Projekte (Rechte der Person: wer das Portfolio führt, schreibt sie)
CREATE FUNCTION ppm.portfolio_vertraulich_weitergeben() RETURNS trigger LANGUAGE plpgsql SET search_path = ppm, pg_temp AS $$
BEGIN
  UPDATE ppm.projekt SET portfolio_vertraulich = NEW.vertraulich
    WHERE tenant_id = NEW.tenant_id AND portfolio_id = NEW.id AND portfolio_vertraulich IS DISTINCT FROM NEW.vertraulich;
  RETURN NULL;
END $$;
CREATE TRIGGER portfolio_vertraulich_weitergeben AFTER UPDATE OF vertraulich ON ppm.portfolio
  FOR EACH ROW WHEN (OLD.vertraulich IS DISTINCT FROM NEW.vertraulich) EXECUTE FUNCTION ppm.portfolio_vertraulich_weitergeben();
REVOKE ALL ON FUNCTION ppm.portfolio_vertraulich_weitergeben() FROM PUBLIC;

-- Die mitgeführte Stufe allein ist keine neue Version des Projekts (wie die Markierung nach Abschluss, 463)
CREATE OR REPLACE FUNCTION ppm.projekt_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = ppm, pg_temp AS $$
BEGIN
  IF to_jsonb(NEW) - ARRAY['geaendert_nach_abschluss_at', 'portfolio_vertraulich'] = to_jsonb(OLD) - ARRAY['geaendert_nach_abschluss_at', 'portfolio_vertraulich'] THEN
    RETURN NEW;
  END IF;
  NEW.version := OLD.version + 1;
  NEW.updated_at := now();
  NEW.updated_by := app.principal_id();
  NEW.created_at := OLD.created_at;
  NEW.created_by := OLD.created_by;
  RETURN NEW;
END $$;

-- Lesen trotz «vertraulich»: Tupel am Projekt oder am Portfolio, oder alle Portfolios führen
CREATE FUNCTION ppm.vertraulich_lesbar(p_projekt_id uuid, p_portfolio_id uuid) RETURNS boolean LANGUAGE sql STABLE
  SET search_path = ppm, pg_temp AS $$
  SELECT app.write_all() OR app.has_tuple('projekt', p_projekt_id, app.read_relations())
      OR app.has_tuple('portfolio', p_portfolio_id, app.relations_of('projekt:read'))
$$;
REVOKE ALL ON FUNCTION ppm.vertraulich_lesbar(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ppm.vertraulich_lesbar(uuid, uuid) TO ppm_app;

-- Muster PROJEKT (fachmodell.md 3.4): Auflisten nur nicht vertraulich; vertraulich nur für Eingetragene
DROP POLICY projekt_read ON ppm.projekt;
CREATE POLICY projekt_read ON ppm.projekt AS RESTRICTIVE FOR SELECT TO ppm_app USING (
  ((app.has_permission('projekt:list') AND NOT (vertraulich OR portfolio_vertraulich)) OR ppm.projekt_lesbar(id, portfolio_id))
  AND (NOT (vertraulich OR portfolio_vertraulich) OR ppm.vertraulich_lesbar(id, portfolio_id)));

-- Muster PORTFOLIO: vertraulich nur mit Tupel am Portfolio oder an einem seiner (sichtbaren) Projekte
DROP POLICY portfolio_read ON ppm.portfolio;
CREATE POLICY portfolio_read ON ppm.portfolio AS RESTRICTIVE FOR SELECT TO ppm_app USING (
  (app.has_permission('portfolio:read') OR app.has_permission('portfolio:read', 'portfolio', id))
  AND (NOT vertraulich OR app.write_all() OR app.has_tuple('portfolio', id, app.relations_of('projekt:read'))
       OR EXISTS (SELECT 1 FROM ppm.projekt p WHERE p.tenant_id = portfolio.tenant_id AND p.portfolio_id = portfolio.id)));

-- «vertraulich» setzt auch, wer das Portfolio führt (`projekt:write` am Portfolio); alles Übrige bleibt `portfolio:admin`
DROP POLICY portfolio_update ON ppm.portfolio;
CREATE POLICY portfolio_update ON ppm.portfolio AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('portfolio:admin') OR app.has_permission('projekt:write', 'portfolio', id))
  WITH CHECK (app.has_permission('portfolio:admin') OR app.has_permission('projekt:write', 'portfolio', id));

CREATE FUNCTION ppm.portfolio_nur_vertraulich() RETURNS trigger LANGUAGE plpgsql SET search_path = ppm, pg_temp AS $$
BEGIN
  IF app.principal_id() IS NOT NULL AND NOT app.has_permission('portfolio:admin')
     AND to_jsonb(NEW) - ARRAY['vertraulich', 'version', 'updated_at', 'updated_by']
         IS DISTINCT FROM to_jsonb(OLD) - ARRAY['vertraulich', 'version', 'updated_at', 'updated_by'] THEN
    RAISE EXCEPTION 'Ohne portfolio:admin lässt sich am Portfolio nur «vertraulich» ändern.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER portfolio_nur_vertraulich BEFORE UPDATE ON ppm.portfolio FOR EACH ROW EXECUTE FUNCTION ppm.portfolio_nur_vertraulich();
REVOKE ALL ON FUNCTION ppm.portfolio_nur_vertraulich() FROM PUBLIC;

-- Ideen: mit Zuordnung zu einem Portfolio nur, wenn die Person das Portfolio sieht (eigene und vorgesehene Sponsoren immer)
DROP POLICY idee_read ON ppm.idee;
CREATE POLICY idee_read ON ppm.idee AS RESTRICTIVE FOR SELECT TO ppm_app USING (
  erfasst_von = app.principal_id() OR (app.principal_id() IS NULL AND app.read_all())
  OR (stand <> 'entwurf' AND (vorgesehener_sponsor = app.principal_id()
      OR ((app.has_permission('idee:read') OR app.has_permission('idee:list')
           OR (portfolio_id IS NOT NULL AND app.has_permission('idee:read', 'portfolio', portfolio_id)))
          AND (portfolio_id IS NULL OR EXISTS (SELECT 1 FROM ppm.portfolio pf WHERE pf.tenant_id = idee.tenant_id AND pf.id = idee.portfolio_id))))));
