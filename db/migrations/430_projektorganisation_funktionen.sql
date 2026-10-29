-- 430 Projektorganisation als Projektergebnis mit freien Funktionen (AP-E8-2; Master Entscheide 16, 17; A-71, A-72)
--
-- Fest sind nur die Funktionen `sp` (Projektauftraggeber:in) und `pl` (Projektleitung), je höchstens eine Person; alle
-- weiteren heissen `weitere` mit freiem Text (`funktion_text`). Die Projektorganisation setzt keine Rollen mehr; der
-- Zugriff wird getrennt vergeben. Bestehende Einträge: CTL, Kernteam und Sponsoren-Koalition werden zu Text, ebenso in
-- Kapitel 8 der Vertragsversionen und in den Einladungen zu Sitzungen. Vorhandene Unterschriften der CTL bleiben im
-- Verlauf; neue gibt es nicht (Unterzeichnende: Projektauftraggeber:in und Projektleitung).

-- Die Migration läuft als Eigentümer; für die Umstellung gilt die Lesesicht nicht, app.secure_tenant_tables() setzt FORCE
-- danach wieder.
ALTER TABLE ppm.projekt_person NO FORCE ROW LEVEL SECURITY;
ALTER TABLE ppm.vertrag_kapitel NO FORCE ROW LEVEL SECURITY;
ALTER TABLE ppm.einladung NO FORCE ROW LEVEL SECURITY;

-- Projektorganisation
ALTER TABLE ppm.projekt_person ADD COLUMN funktion_text text NOT NULL DEFAULT '' CHECK (length(funktion_text) <= 100);
ALTER TABLE ppm.projekt_person DROP CONSTRAINT projekt_person_funktion_check;
-- vor der Umstellung: wer heute CTL und Kernteam ist, hat danach zweimal «weitere» (mit verschiedenem Text)
ALTER TABLE ppm.projekt_person DROP CONSTRAINT projekt_person_tenant_id_projekt_id_funktion_person_id_key;
DROP INDEX ppm.projekt_person_einzeln;
UPDATE ppm.projekt_person SET funktion_text = CASE funktion WHEN 'ctl' THEN 'CTL' WHEN 'kt' THEN 'Kernteam' ELSE 'Sponsoren-Koalition' END,
       funktion = 'weitere'
 WHERE funktion IN ('ctl', 'kt', 'koalition');
ALTER TABLE ppm.projekt_person ADD CONSTRAINT projekt_person_funktion_check CHECK (funktion IN ('sp', 'pl', 'weitere'));
ALTER TABLE ppm.projekt_person ADD CONSTRAINT projekt_person_funktion_text_pflicht
  CHECK ((funktion = 'weitere') = (btrim(funktion_text) <> ''));
CREATE UNIQUE INDEX projekt_person_einzeln ON ppm.projekt_person (tenant_id, projekt_id, funktion) WHERE funktion IN ('sp', 'pl');
-- dieselbe Person mit derselben Funktion nur einmal (bei «weitere» je Text)
CREATE UNIQUE INDEX projekt_person_eindeutig ON ppm.projekt_person (tenant_id, projekt_id, funktion, lower(funktion_text), person_id);

-- Kapitel 8 der Vertragsversionen (Projektorganisation im Projektvertrag)
UPDATE ppm.vertrag_kapitel k SET inhalt = jsonb_set(k.inhalt, '{mitglieder}', (
  SELECT coalesce(jsonb_agg(CASE WHEN m->>'funktion' IN ('ctl', 'kt', 'koalition') THEN
      m || jsonb_build_object('funktion', 'weitere',
                              'funktionText', CASE m->>'funktion' WHEN 'ctl' THEN 'CTL' WHEN 'kt' THEN 'Kernteam' ELSE 'Sponsoren-Koalition' END)
    ELSE m END ORDER BY o), '[]'::jsonb)
  FROM jsonb_array_elements(k.inhalt->'mitglieder') WITH ORDINALITY AS x (m, o)))
 WHERE k.kapitel = 8 AND jsonb_typeof(k.inhalt->'mitglieder') = 'array'
   AND EXISTS (SELECT 1 FROM jsonb_array_elements(k.inhalt->'mitglieder') m WHERE m->>'funktion' IN ('ctl', 'kt', 'koalition'));

-- Einladungen zu Sitzungen
ALTER TABLE ppm.einladung DROP CONSTRAINT einladung_funktion_check;
UPDATE ppm.einladung SET funktion = 'weitere' WHERE funktion = 'ctl';
ALTER TABLE ppm.einladung ADD CONSTRAINT einladung_funktion_check CHECK (funktion IN ('sp', 'pl', 'weitere'));

ALTER TABLE ppm.projekt_person FORCE ROW LEVEL SECURITY;
ALTER TABLE ppm.vertrag_kapitel FORCE ROW LEVEL SECURITY;
ALTER TABLE ppm.einladung FORCE ROW LEVEL SECURITY;
