-- Freigabe der Initialisierung (docs/fachmodell.md 2.11; AP-E4-3; UC-001 Schritte 6–7, A4, A5; Kernablauf K4 Schritte
-- 9–10): Sponsor und Projektleitung, die mit dem Entscheid erfasst werden (A-05: das Gremium benennt den Sponsor, der
-- Sponsor die Projektleitung; die UE erfasst beide), und der Zeitpunkt der Freigabe. Das entstandene Projekt steht schon
-- in `idee.projekt_id` (220); Traktandum und Entscheid gehören dem Modul `sitzung`, die Aufgabe `idee.freigeben` an die
-- Direktion (Kategorie C) dem Eingang.
ALTER TABLE ppm.idee
  ADD COLUMN sponsor         uuid,
  ADD COLUMN projektleitung  uuid,
  ADD COLUMN freigegeben_at  timestamptz,
  ADD CONSTRAINT idee_sponsor_fk FOREIGN KEY (tenant_id, sponsor) REFERENCES ppm.principal (tenant_id, id) ON DELETE SET NULL (sponsor),
  ADD CONSTRAINT idee_projektleitung_fk FOREIGN KEY (tenant_id, projektleitung) REFERENCES ppm.principal (tenant_id, id) ON DELETE SET NULL (projektleitung),
  ADD CONSTRAINT idee_freigabe CHECK (stand <> 'freigegeben' OR freigegeben_at IS NOT NULL);
