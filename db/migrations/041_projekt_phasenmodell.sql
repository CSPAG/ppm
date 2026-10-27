-- Projekt → Version des Phasenmodells (docs/fachmodell.md 2.3, 2.5; A-13): Fremdschlüssel, sobald die Tabelle aus 030
-- (AP-E0-3) besteht. Eine Version, nach der Projekte laufen, bleibt erhalten (kein Löschen, solange referenziert).
ALTER TABLE ppm.projekt
  ADD FOREIGN KEY (tenant_id, phasenmodell_id) REFERENCES ppm.phasenmodell (tenant_id, id);
CREATE INDEX projekt_phasenmodell ON ppm.projekt (tenant_id, phasenmodell_id) WHERE phasenmodell_id IS NOT NULL;
