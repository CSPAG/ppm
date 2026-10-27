-- Quality-Check und Unterschriften des Projektvertrags (docs/fachmodell.md 2.10; AP-E3-2): DM.02.05, DM.02.06;
-- UC-002 Schritte 9–10, A5; UC-003 Schritte 7–8, A4, A5. Setzt 010 (Projekt, Hilfsfunktionen) und 170 (Versionen) voraus.

-- Quality-Check der UE: bestätigt (weiter zur Unterzeichnung) oder Rückmeldung an die PL mit Kommentar je Kapitel.
-- Jede Bestätigung eröffnet einen Durchgang der Unterschriften; eine Verweigerung beendet ihn (UC-003 A5).
CREATE TABLE ppm.quality_check (
  tenant_id   uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id          uuid NOT NULL DEFAULT gen_random_uuid(),
  projekt_id  uuid NOT NULL,
  version_id  uuid NOT NULL,
  ergebnis    text NOT NULL CHECK (ergebnis IN ('bestaetigt', 'rueckmeldung')),
  -- Kommentar je Kapitel 1–13 (K2 Schritt 7): {"7": "Meilensteine P2 fehlen"}
  kommentare  jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(kommentare) = 'object'),
  at          timestamptz NOT NULL DEFAULT now(),
  by_person   uuid NOT NULL,
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, id, version_id),
  FOREIGN KEY (tenant_id, version_id, projekt_id) REFERENCES ppm.vertrag_version (tenant_id, id, projekt_id) ON DELETE CASCADE,
  CHECK (ergebnis = 'bestaetigt' OR kommentare <> '{}')
);
CREATE INDEX quality_check_version ON ppm.quality_check (tenant_id, version_id, at);

-- Unterschrift je Funktion (SP, PL, CTL) im Durchgang eines bestätigten Quality-Checks: protokollierter Klick der Person
-- (A-31), in Vertretung mit Vermerk (UC-016 Schritt 4); verweigert nur mit Begründung (UC-003 A5)
CREATE TABLE ppm.unterschrift (
  tenant_id         uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE,
  id                uuid NOT NULL DEFAULT gen_random_uuid(),
  projekt_id        uuid NOT NULL,
  version_id        uuid NOT NULL,
  quality_check_id  uuid NOT NULL,
  funktion          text NOT NULL CHECK (funktion IN ('sp', 'pl', 'ctl')),
  person_id         uuid NOT NULL,
  in_vertretung_von uuid,
  ergebnis          text NOT NULL CHECK (ergebnis IN ('unterzeichnet', 'verweigert')),
  begruendung       text NOT NULL DEFAULT '' CHECK (length(begruendung) <= 2000),
  at                timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id),
  -- je Durchgang und Funktion höchstens eine Unterschrift
  UNIQUE (tenant_id, quality_check_id, funktion),
  FOREIGN KEY (tenant_id, quality_check_id, version_id) REFERENCES ppm.quality_check (tenant_id, id, version_id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, version_id, projekt_id) REFERENCES ppm.vertrag_version (tenant_id, id, projekt_id) ON DELETE CASCADE,
  CHECK (ergebnis = 'unterzeichnet' OR length(btrim(begruendung)) > 0),
  CHECK (in_vertretung_von IS DISTINCT FROM person_id)
);

SELECT app.secure_tenant_tables();
-- Protokoll: nur anhängen (Unterschriften und Checks werden nie geändert oder gelöscht)
REVOKE UPDATE, DELETE ON ppm.quality_check, ppm.unterschrift FROM ppm_app;

-- Lesesicht (fachmodell.md 3.4), Muster KIND: lesen, wer das Projekt sieht; schreiben mit dem Recht der Handlung
CREATE POLICY quality_check_read ON ppm.quality_check AS RESTRICTIVE FOR SELECT TO ppm_app USING (ppm.projekt_sichtbar(projekt_id));
CREATE POLICY quality_check_insert ON ppm.quality_check AS RESTRICTIVE FOR INSERT TO ppm_app WITH CHECK (app.has_permission('vertrag:review'));

CREATE POLICY unterschrift_read ON ppm.unterschrift AS RESTRICTIVE FOR SELECT TO ppm_app USING (ppm.projekt_sichtbar(projekt_id));
CREATE POLICY unterschrift_insert ON ppm.unterschrift AS RESTRICTIVE FOR INSERT TO ppm_app
  WITH CHECK (app.has_permission('vertrag:sign', 'projekt', projekt_id));
