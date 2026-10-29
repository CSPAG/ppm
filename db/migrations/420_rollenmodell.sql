-- 420 Rollenmodell steuern und führen je Portfolio und Projekt (AP-E8-1; Master Entscheid 18, fachmodell.md 3.3, A-70)
--
-- 1. Rechte am Projekt gelten auch über eine Rolle am Portfolio des Projekts («Portfolio führen»): Die Policies der
--    Projektdetails (Muster KIND, fachmodell.md 3.4) prüfen neu ppm.recht_am_projekt() statt nur das Recht am Projekt.
--    app.has_permission(recht, typ, id) zählt bewusst nur den Ort selbst (identity-kit iam_018); der Elternort ist ein
--    weiterer Aufruf, wie es das Muster BETRAG schon tut.
-- 2. Bestehende Zuweisungen erhalten die neuen Rollenschlüssel (A-70). Die alten Schlüssel stehen bis zur Bereinigung noch
--    im Modell, damit der Abgleich der Bedingungen von authz_tuple vor dieser Migration gelingt.

-- 1 Recht am Projekt oder an seinem Portfolio (Rechte der aufrufenden Rolle, kein SECURITY DEFINER)
CREATE FUNCTION ppm.recht_am_projekt(p_recht text, p_projekt_id uuid) RETURNS boolean LANGUAGE sql STABLE
SET search_path = ppm, pg_temp AS $$
  SELECT app.has_permission(p_recht, 'projekt', p_projekt_id)
      OR app.has_permission(p_recht, 'portfolio', ppm.portfolio_von(p_projekt_id))
$$;
REVOKE ALL ON FUNCTION ppm.recht_am_projekt(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ppm.recht_am_projekt(text, uuid) TO ppm_app;

-- Jede Policy im Schema ppm, die ein Recht genau am Projekt prüft, prüft es danach auch am Portfolio des Projekts.
-- Bleibt ein Aufruf mit anderer Form übrig, bricht die Migration ab, statt still eine Lücke zu lassen.
DO $$
DECLARE
  p record;
  muster CONSTANT text := 'app\.has_permission\(''([a-z:]+)''::text, ''projekt''::text, ([a-z_]+(\.[a-z_]+)?)\)';
  ersatz CONSTANT text := 'ppm.recht_am_projekt(''\1''::text, \2)';
  q text; c text;
BEGIN
  FOR p IN
    SELECT pol.polname, cls.relname, pg_get_expr(pol.polqual, pol.polrelid) AS qual, pg_get_expr(pol.polwithcheck, pol.polrelid) AS chk
      FROM pg_policy pol JOIN pg_class cls ON cls.oid = pol.polrelid JOIN pg_namespace n ON n.oid = cls.relnamespace
     WHERE n.nspname = 'ppm'
       AND (pg_get_expr(pol.polqual, pol.polrelid) LIKE '%''projekt''::text%' OR pg_get_expr(pol.polwithcheck, pol.polrelid) LIKE '%''projekt''::text%')
  LOOP
    q := regexp_replace(p.qual, muster, ersatz, 'g');
    c := regexp_replace(p.chk, muster, ersatz, 'g');
    IF q IS DISTINCT FROM p.qual THEN EXECUTE format('ALTER POLICY %I ON ppm.%I USING (%s)', p.polname, p.relname, q); END IF;
    IF c IS DISTINCT FROM p.chk THEN EXECUTE format('ALTER POLICY %I ON ppm.%I WITH CHECK (%s)', p.polname, p.relname, c); END IF;
  END LOOP;
  IF EXISTS (
    SELECT 1 FROM pg_policy pol JOIN pg_class cls ON cls.oid = pol.polrelid JOIN pg_namespace n ON n.oid = cls.relnamespace
     WHERE n.nspname = 'ppm'
       AND (coalesce(pg_get_expr(pol.polqual, pol.polrelid), '') ~ 'app\.has_permission\([^)]*''projekt''::text'
         OR coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), '') ~ 'app\.has_permission\([^)]*''projekt''::text')
  ) THEN
    RAISE EXCEPTION '420: Policy mit Recht am Projekt in unbekannter Form; ppm.recht_am_projekt() von Hand einsetzen';
  END IF;
END $$;

-- 2 Zuweisungen auf die neuen Rollen (A-70). Die Migration läuft als Eigentümer: Für die Umstellung gilt die
-- Lesesicht nicht für ihn; app.secure_tenant_tables() setzt FORCE danach wieder.
ALTER TABLE ppm.authz_tuple NO FORCE ROW LEVEL SECURITY;
ALTER TABLE ppm.neubesetzung_rolle NO FORCE ROW LEVEL SECURITY;

CREATE TEMP TABLE rolle_neu (alt text PRIMARY KEY, neu text NOT NULL) ON COMMIT DROP;
INSERT INTO rolle_neu (alt, neu) VALUES
  ('ue', 'alle-fuehren'), ('pmo', 'alle-fuehren'), ('fi', 'alle-fuehren'), ('rm', 'alle-fuehren'),
  ('gl', 'alle-lesen'), ('antragsteller', 'mitglied'), ('leser', 'mitglied'),
  ('direktion', 'portfolio-steuern'),
  ('sp', 'projekt-steuern'), ('pl', 'projekt-fuehren'), ('ctl', 'projekt-fuehren'), ('kt', 'projekt-mitlesen');

-- Fallen mehrere Tupel derselben Person am selben Ort auf eine Rolle (z. B. UE und PMO, PL und CTL), bleibt eines:
-- unbefristet vor befristet, sonst das am längsten gültige.
WITH k AS (
  SELECT t.tenant_id, t.id, coalesce(r.neu, t.relation) AS rel, t.subject, t.object_type, t.object_id, t.expires_at
    FROM ppm.authz_tuple t LEFT JOIN rolle_neu r ON r.alt = t.relation
   WHERE r.neu IS NOT NULL OR t.relation IN (SELECT neu FROM rolle_neu)
), rang AS (
  SELECT tenant_id, id, row_number() OVER (PARTITION BY tenant_id, subject, rel, object_type, object_id
                                           ORDER BY (expires_at IS NULL) DESC, expires_at DESC, id) AS n
    FROM k
)
DELETE FROM ppm.authz_tuple t USING rang WHERE t.tenant_id = rang.tenant_id AND t.id = rang.id AND rang.n > 1;

UPDATE ppm.authz_tuple t SET relation = r.neu FROM rolle_neu r WHERE t.relation = r.alt;

-- Offene Neubesetzungen nennen die neue Rolle; fällt sie mit einer schon genannten zusammen, entfällt die alte Zeile
-- (je alte Rolle eine Anweisung, damit eine spätere die Umbenennung einer früheren sieht)
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT alt, neu FROM rolle_neu ORDER BY alt LOOP
    UPDATE ppm.neubesetzung_rolle n SET rolle = r.neu WHERE n.rolle = r.alt
       AND NOT EXISTS (SELECT 1 FROM ppm.neubesetzung_rolle d WHERE d.tenant_id = n.tenant_id AND d.neubesetzung_id = n.neubesetzung_id
                         AND d.ort_typ = n.ort_typ AND d.ort_id IS NOT DISTINCT FROM n.ort_id AND d.rolle = r.neu);
    DELETE FROM ppm.neubesetzung_rolle n WHERE n.rolle = r.alt;
  END LOOP;
END $$;

ALTER TABLE ppm.authz_tuple FORCE ROW LEVEL SECURITY;
ALTER TABLE ppm.neubesetzung_rolle FORCE ROW LEVEL SECURITY;
