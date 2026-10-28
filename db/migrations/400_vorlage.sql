-- Vorlagen mit Versionen und Feldzuordnung (BC AM.03.01; UC-018 Schritte 1–2; docs/fachmodell.md 2.13; AP-E7-7):
-- je Dokumentart (Projektidee … Quartalsreporting) hochgeladene Word-Vorlagen in fortlaufenden Versionen; die Platzhalter
-- der Datei («Projektname») sind den Datenfeldern der Dokumentausgabe zugeordnet. Höchstens eine Version je Art ist
-- aktiv und wird für künftige Dokumentausgaben verwendet (DM.02.07); ohne aktive Version gilt der Grundbestand.

CREATE TABLE ppm.vorlage (
  tenant_id   uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id          uuid NOT NULL DEFAULT gen_random_uuid(),
  art         text NOT NULL CHECK (art IN ('projektidee', 'vorstudie', 'business_case', 'projektvertrag', 'loesungskonzept',
                'abschlussbericht', 'statusbericht', 'portfoliobericht', 'quartalsreporting')),
  -- fortlaufend je Art (1, 2, 3 …); der Grundbestand ist keine Version
  version     int NOT NULL CHECK (version >= 1),
  stand       text NOT NULL DEFAULT 'entwurf' CHECK (stand IN ('entwurf', 'aktiv', 'abgeloest')),
  dateiname   text NOT NULL CHECK (length(btrim(dateiname)) BETWEEN 1 AND 200),
  -- Word-Datei (.docx), höchstens 5 MB
  datei       bytea NOT NULL CHECK (octet_length(datei) BETWEEN 1 AND 5242880),
  sha256      text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  -- Platzhalter der Datei in der Reihenfolge des Vorkommens, z. B. ["Projektname", "Version"]
  platzhalter jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(platzhalter) = 'array'),
  -- Platzhalter → Datenfeld der Dokumentausgabe (Schlüssel aus dem Feldkatalog der Art) oder null
  zuordnung   jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(zuordnung) = 'object'),
  -- Vorlage nennt «Personendaten» (Kennzeichnung personenbezogener Dokumente, G12); sonst Warnung beim Aktivieren
  personendaten boolean NOT NULL DEFAULT false,
  bemerkung   text NOT NULL DEFAULT '' CHECK (length(bemerkung) <= 1000),
  aktiv_at    timestamptz,
  aktiv_by    uuid,
  rev         int NOT NULL DEFAULT 1 CHECK (rev >= 1),
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid DEFAULT app.principal_id(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid DEFAULT app.principal_id(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, art, version),
  CHECK ((stand = 'entwurf') = (aktiv_at IS NULL))
);
CREATE UNIQUE INDEX vorlage_aktiv ON ppm.vorlage (tenant_id, art) WHERE stand = 'aktiv';

-- Version (ETag/If-Match über rev; `version` ist die fachliche Version) und Änderungszeit setzt die Datenbank
CREATE FUNCTION ppm.vorlage_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = ppm, pg_temp AS $$
BEGIN
  NEW.rev := OLD.rev + 1;
  NEW.updated_at := now();
  NEW.updated_by := app.principal_id();
  NEW.created_at := OLD.created_at;
  NEW.created_by := OLD.created_by;
  RETURN NEW;
END $$;
CREATE TRIGGER vorlage_touch BEFORE UPDATE ON ppm.vorlage FOR EACH ROW EXECUTE FUNCTION ppm.vorlage_touch();
REVOKE ALL ON FUNCTION ppm.vorlage_touch() FROM PUBLIC;

SELECT app.secure_tenant_tables();

-- Muster ORG (docs/fachmodell.md 3.4) mit dem einzigen Recht des Bereichs (vorlage:write, UE). Die Dokumentausgabe liest
-- die aktive Version in voller Sicht (Konfiguration der Organisation, wie das Phasenmodell).
CREATE POLICY vorlage_read ON ppm.vorlage AS RESTRICTIVE FOR SELECT TO ppm_app USING (app.has_permission('vorlage:write'));
CREATE POLICY vorlage_insert ON ppm.vorlage AS RESTRICTIVE FOR INSERT TO ppm_app WITH CHECK (app.has_permission('vorlage:write'));
CREATE POLICY vorlage_update ON ppm.vorlage AS RESTRICTIVE FOR UPDATE TO ppm_app
  USING (app.has_permission('vorlage:write')) WITH CHECK (app.has_permission('vorlage:write'));
CREATE POLICY vorlage_delete ON ppm.vorlage AS RESTRICTIVE FOR DELETE TO ppm_app USING (app.has_permission('vorlage:write'));
