# Prüfung und Messung

UX wird geprüft wie Code: vor dem Bau, beim Bau (jeder Pull Request) und im Betrieb.

## Vor dem Bau: Ablauf durchspielen

- Je Kernablauf ein **Durchspielen mit 3–5 Personen der Rolle**, bevor die Arbeitsfläche gebaut wird. Mittel nach
  Aufwand: Papier, klickbarer Entwurf oder die frühe Fassung mit Testdaten. Aufgabe aus der Job-Story stellen, nicht die
  Oberfläche erklären, laut denken lassen.
- Ergebnis kurz im Ablauf festhalten (Abschnitt «Entscheide und offene Fragen»): was hat niemand gefunden, wo zögerten
  alle, was wurde geändert.
- Ein Ablauf, den mehr als eine von fünf Personen nicht abschliesst, wird überarbeitet, bevor er gebaut wird.

## Beim Bau: UX-Definition of Done

Jeder Pull Request, der Oberfläche ändert, erfüllt diese Liste. Nicht Zutreffendes wird gestrichen, nicht weggelassen.

- [ ] Ablauf und Zielgrössen des betroffenen Kernablaufs gelesen; Abweichungen im Ablauf nachgeführt
- [ ] Seitentyp gewählt ([interaktion.md](interaktion.md) Abschnitt 2), Adresse nach I-N5
- [ ] Zustände Z1–Z10 bedacht, die zutreffenden gestaltet und getestet
- [ ] Prüfungen nach I-P1–I-P6 (Stufe, Text mit Regel/Wert/Ausweg)
- [ ] Texte zentral, Begriffe aus dem Glossar, Anrede und Rechtschreibung geprüft
- [ ] Tastatur vollständig, Fokus sichtbar, Bildschirmleser-Ansagen bei Zustandswechseln
- [ ] axe ohne Befund hell und dunkel; schmalste Breite der Rolle geprüft
- [ ] Leistungsziele des Ablaufs eingehalten (Messung im Test oder im Pull Request genannt)
- [ ] Abnahmekriterien des Ablaufs, soweit betroffen, als Test vorhanden

## Bei der Abnahme einer Etappe

1. **Zielgrössen messen**, mit echten oder realistischen Daten in Menge (nicht drei Testeinträge).
2. **Aufgabentest** mit 5 Personen je Hauptrolle: Aufgabenerfolg ohne Hilfe (Q-W1), Zeit je Aufgabe, Fehler; danach
   System Usability Scale (Q-W2).
3. **Heuristische Durchsicht** durch eine Person, die nicht mitgebaut hat: Grundsätze G1–G12 als Prüffragen.
4. Ergebnis in `docs/ux/fahrplan.md` bei der Etappe: erreicht / nicht erreicht mit Massnahme.

## Im Betrieb: messen

- **Web-Vitals** (LCP, INP) je Arbeitsfläche, ohne personenbezogene Daten.
- **Ablaufkennzahlen** aus Ereignissen, die ohnehin entstehen (Antrag gestellt → entschieden, Entwurf erstellt →
  veröffentlicht): Durchlaufzeiten, Abbruchquoten, Anteil Korrekturen. Keine Klickverfolgung einzelner Personen.
- **Rückmeldung in der App:** «Feedback» im Kontomenü, mit automatisch angehängter Ansicht (Adresse, nicht Inhalt).
- Jährlich SUS bei einer Stichprobe je Rolle.

## Heuristik bei Unsicherheit

Wenn zwei Lösungen gleich gut scheinen, entscheidet in dieser Reihenfolge:
1. weniger Schritte im häufigsten Fall,
2. weniger Möglichkeiten, einen folgenreichen Fehler zu machen,
3. näher an einem bereits bestehenden Teil der App (Einheitlichkeit),
4. weniger Code.
