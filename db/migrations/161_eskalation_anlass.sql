-- Anlass der Eskalation (BC PS.03.03; UC-004 A1.2 und A2.2; AP-E2-4): «kritisch» legt das Einreichen eines Berichts
-- «kritisch» mit Entscheidbedarf an (160); «abweichung» startet die PL selbst aus der Warnung «wesentliche Abweichung»
-- im Entwurf (K1 Schritt 2). Nur «kritisch» nimmt das Zurückziehen des Berichts wieder zurück; die von der PL gestartete
-- Eskalation bleibt.

ALTER TABLE ppm.eskalation
  ADD COLUMN anlass text NOT NULL DEFAULT 'kritisch' CHECK (anlass IN ('kritisch', 'abweichung'));
