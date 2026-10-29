-- 462 Versionen statt Sperre an den Jahreszielen (AP-E8-5; UC-011, K6 Z9; Master G2, A-75, UX-E13)
--
-- Ab der Vorlage an den VR bleiben Jahresziele und Hauptaktivitäten änderbar; Zieljahr und Jahresziel tragen dann
-- «geändert nach Vorlage» (Zeitpunkt der letzten Änderung, eine Hauptaktivität markiert ihr Jahresziel). Gelöscht wird
-- nur «in Arbeit». Der Verlauf kommt aus dem Audit.
ALTER TABLE ppm.zieljahr ADD COLUMN geaendert_nach_vorlage_at timestamptz;
ALTER TABLE ppm.jahresziel ADD COLUMN geaendert_nach_vorlage_at timestamptz;
