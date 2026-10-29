-- 461 Versionen statt Sperre an der Sitzung (AP-E8-5; UC-006, K3; Master G2, A-75, UX-E13)
--
-- Nach dem Versand bleiben Traktandenliste, Traktanden, Einladungen und Unterlagen änderbar, bis die Sitzung beginnt.
-- Sitzung und Traktandum tragen dann «geändert nach Versand» (Zeitpunkt der letzten Änderung); der Verlauf kommt aus dem
-- Audit. Unterlagen werden nicht geändert, sondern als neue Fassung ersetzt (Löschen und Einfügen, UPDATE bleibt entzogen).
ALTER TABLE ppm.sitzung ADD COLUMN geaendert_nach_versand_at timestamptz;
ALTER TABLE ppm.traktandum ADD COLUMN geaendert_nach_versand_at timestamptz;
