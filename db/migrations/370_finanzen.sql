-- Finanzen (BC PC.01.02, PC.01.04, PC.01.05; UC-010; docs/fachmodell.md 2.13; AP-E7-4): Ist-Kosten aus dem ERP je
-- Kostenträger und Monat (A-16, K18), Kostenträger je Projekt, Begründungen der Abweichungen (UC-010 Schritt 4) und
-- Übergabe des Jahresbedarfs an den Budgetprozess (A-17, K19). Budget und Prognose führt das Register `kosten` aus
-- `projektdaten`; hier steht nur, was dort fehlt.
-- Setzt nur Tabellen aus 001–069 voraus (Mandant, Projekt).

-- Kostenträger des Projekts im ERP (A-16: ein Kostenträger je Projekt); FI ordnet zu (UC-010 A1.1)
CREATE TABLE ppm.kostentraeger (
  tenant_id  uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  projekt_id uuid NOT NULL,
  nummer     text NOT NULL CHECK (nummer ~ '^[A-Za-z0-9][A-Za-z0-9._/-]{0,39}$'),
  version    int NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT app.principal_id(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, projekt_id),
  UNIQUE (tenant_id, nummer),
  FOREIGN KEY (tenant_id, projekt_id) REFERENCES ppm.projekt (tenant_id, id) ON DELETE CASCADE
);

-- Ist-Kosten je Kostenträger, Monat und Art, wie sie das ERP liefert (UC-010 Schritt 1). Das Projekt ergibt sich beim
-- Lesen über den Kostenträger: Ordnet FI einen Kostenträger später zu, erscheinen die Kosten ohne neuen Lauf (A1.1).
-- Ein Lauf ersetzt die gelieferten Monate eines Kostenträgers (`uebernommen_at` = Zeitpunkt des Laufs).
CREATE TABLE ppm.ist_kosten (
  tenant_id      uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  kostentraeger  text NOT NULL CHECK (kostentraeger ~ '^[A-Za-z0-9][A-Za-z0-9._/-]{0,39}$'),
  monat          text NOT NULL CHECK (monat ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  art            text NOT NULL CHECK (art IN ('capex', 'opex')),
  betrag         numeric(14, 2) NOT NULL,
  uebernommen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, kostentraeger, monat, art)
);

-- Begründung einer Abweichung je Projekt und Periode «JJJJ-MM» (UC-010 Schritt 4; PL oder UE halten sie fest)
CREATE TABLE ppm.abweichung_begruendung (
  tenant_id  uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id         uuid NOT NULL DEFAULT gen_random_uuid(),
  projekt_id uuid NOT NULL,
  periode    text NOT NULL CHECK (periode ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  text       text NOT NULL CHECK (length(btrim(text)) BETWEEN 1 AND 2000),
  version    int NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT app.principal_id(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, projekt_id, periode),
  FOREIGN KEY (tenant_id, projekt_id) REFERENCES ppm.projekt (tenant_id, id) ON DELETE CASCADE
);

-- Übergabe des Jahresbedarfs an den Budgetprozess (A-17): Entwurf mit Korrekturen von FI, danach übergeben mit dem
-- Inhalt, wie er exportiert wurde (unveränderlich)
CREATE TABLE ppm.budgetuebergabe (
  tenant_id      uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  jahr           int NOT NULL CHECK (jahr BETWEEN 2000 AND 2100),
  stand          text NOT NULL DEFAULT 'entwurf' CHECK (stand IN ('entwurf', 'uebergeben')),
  inhalt         jsonb NOT NULL DEFAULT '{}'::jsonb,
  uebergeben_at  timestamptz,
  uebergeben_by  uuid,
  version        int NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid DEFAULT app.principal_id(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  updated_by     uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, jahr),
  CHECK ((stand = 'uebergeben') = (uebergeben_at IS NOT NULL))
);

CREATE FUNCTION ppm.finanzen_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = ppm, pg_temp AS $$
BEGIN
  NEW.version := OLD.version + 1;
  NEW.updated_at := now();
  NEW.updated_by := app.principal_id();
  RETURN NEW;
END $$;
-- Eine übergebene Übergabe bleibt, wie sie exportiert wurde
CREATE FUNCTION ppm.budgetuebergabe_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = ppm, pg_temp AS $$
BEGIN
  IF OLD.stand = 'uebergeben' THEN
    RAISE EXCEPTION 'Übergabe % ist abgeschlossen', OLD.jahr USING ERRCODE = 'check_violation';
  END IF;
  NEW.version := OLD.version + 1;
  NEW.updated_at := now();
  NEW.updated_by := app.principal_id();
  RETURN NEW;
END $$;
CREATE TRIGGER kostentraeger_touch BEFORE UPDATE ON ppm.kostentraeger FOR EACH ROW EXECUTE FUNCTION ppm.finanzen_touch();
CREATE TRIGGER abweichung_begruendung_touch BEFORE UPDATE ON ppm.abweichung_begruendung FOR EACH ROW EXECUTE FUNCTION ppm.finanzen_touch();
CREATE TRIGGER budgetuebergabe_touch BEFORE UPDATE ON ppm.budgetuebergabe FOR EACH ROW EXECUTE FUNCTION ppm.budgetuebergabe_touch();

-- Beträge eines Projekts sehen (Muster BETRAG, fachmodell.md 3.4)
CREATE FUNCTION ppm.betrag_sichtbar(p_projekt_id uuid) RETURNS boolean LANGUAGE sql STABLE SET search_path = ppm, pg_temp AS $$
  SELECT ppm.projekt_sichtbar(p_projekt_id)
    AND (app.has_permission('finanzen:read', 'projekt', p_projekt_id) OR app.has_permission('finanzen:read', 'portfolio', ppm.portfolio_von(p_projekt_id)))
$$;
GRANT EXECUTE ON FUNCTION ppm.betrag_sichtbar(uuid) TO ppm_app;

SELECT app.secure_tenant_tables();

-- Kostenträger: lesen mit Beträgen des Projekts oder als Schnittstelle (Lauf von Hand durch ADM); zuordnen nur FI
CREATE POLICY kostentraeger_read ON ppm.kostentraeger AS RESTRICTIVE FOR SELECT TO ppm_app
  USING (ppm.betrag_sichtbar(projekt_id) OR app.has_permission('finanzen:write'));
CREATE POLICY kostentraeger_insert ON ppm.kostentraeger AS RESTRICTIVE FOR INSERT TO ppm_app WITH CHECK (app.has_permission('finanzen:write'));
CREATE POLICY kostentraeger_update ON ppm.kostentraeger AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('finanzen:write')) WITH CHECK (app.has_permission('finanzen:write'));
CREATE POLICY kostentraeger_delete ON ppm.kostentraeger AS RESTRICTIVE FOR DELETE TO ppm_app USING (app.has_permission('finanzen:write'));

-- Ist-Kosten: lesen über das zugeordnete Projekt (BETRAG) oder mit finanzen:read an der Organisation (auch ohne
-- Zuordnung, A1); schreiben FI oder die Schnittstelle (Lauf von Hand durch ADM, geplant mit voller Sicht)
CREATE POLICY ist_kosten_read ON ppm.ist_kosten AS RESTRICTIVE FOR SELECT TO ppm_app
  USING (app.has_permission('finanzen:read') OR app.has_permission('schnittstelle:admin') OR EXISTS (
    SELECT 1 FROM ppm.kostentraeger k WHERE k.nummer = ist_kosten.kostentraeger AND ppm.betrag_sichtbar(k.projekt_id)));
CREATE POLICY ist_kosten_insert ON ppm.ist_kosten AS RESTRICTIVE FOR INSERT TO ppm_app
  WITH CHECK (app.has_permission('finanzen:write') OR app.has_permission('schnittstelle:admin'));
CREATE POLICY ist_kosten_update ON ppm.ist_kosten AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('finanzen:write') OR app.has_permission('schnittstelle:admin'))
  WITH CHECK (app.has_permission('finanzen:write') OR app.has_permission('schnittstelle:admin'));
CREATE POLICY ist_kosten_delete ON ppm.ist_kosten AS RESTRICTIVE FOR DELETE TO ppm_app
  USING (app.has_permission('finanzen:write') OR app.has_permission('schnittstelle:admin'));

-- Begründung: lesen mit Beträgen (BETRAG); festhalten PL (projekt:write am Projekt) oder FI (Muster KIND, 3.4)
CREATE POLICY abweichung_begruendung_read ON ppm.abweichung_begruendung AS RESTRICTIVE FOR SELECT TO ppm_app
  USING (ppm.betrag_sichtbar(projekt_id));
CREATE POLICY abweichung_begruendung_insert ON ppm.abweichung_begruendung AS RESTRICTIVE FOR INSERT TO ppm_app
  WITH CHECK (ppm.betrag_sichtbar(projekt_id) AND (app.has_permission('projekt:write', 'projekt', projekt_id) OR app.has_permission('finanzen:write')));
CREATE POLICY abweichung_begruendung_update ON ppm.abweichung_begruendung AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('projekt:write', 'projekt', projekt_id) OR app.has_permission('finanzen:write'))
  WITH CHECK (app.has_permission('projekt:write', 'projekt', projekt_id) OR app.has_permission('finanzen:write'));
CREATE POLICY abweichung_begruendung_delete ON ppm.abweichung_begruendung AS RESTRICTIVE FOR DELETE TO ppm_app
  USING (app.has_permission('projekt:write', 'projekt', projekt_id) OR app.has_permission('finanzen:write'));

-- Budgetübergabe: Beträge aller Projekte, daher finanzen:read an der Organisation (FI, GL, UE) bzw. die Schnittstelle
-- (ausgehende Lieferung); vorbereiten und übergeben FI (finanzen:write)
CREATE POLICY budgetuebergabe_read ON ppm.budgetuebergabe AS RESTRICTIVE FOR SELECT TO ppm_app
  USING (app.has_permission('finanzen:read') OR app.has_permission('schnittstelle:admin'));
CREATE POLICY budgetuebergabe_insert ON ppm.budgetuebergabe AS RESTRICTIVE FOR INSERT TO ppm_app WITH CHECK (app.has_permission('finanzen:write'));
CREATE POLICY budgetuebergabe_update ON ppm.budgetuebergabe AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('finanzen:write')) WITH CHECK (app.has_permission('finanzen:write'));
CREATE POLICY budgetuebergabe_delete ON ppm.budgetuebergabe AS RESTRICTIVE FOR DELETE TO ppm_app USING (app.has_permission('finanzen:write'));
