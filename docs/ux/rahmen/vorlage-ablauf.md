# Vorlage: Kernablauf

Eine Datei je Kernablauf: `docs/ux/ablaeufe/K<n>-<kurzname>.md`. Abschnitte, die nichts Besonderes enthalten, bleiben
mit «wie Rahmen» stehen, damit man sieht, dass sie bedacht wurden. Was die Interaktionsregeln
([interaktion.md](interaktion.md)) schon regeln, wird nicht wiederholt.

```markdown
# K<n> <Titel>

| | |
|---|---|
| **Rollen** | primär …, beteiligt … |
| **Gerät** | Telefon / Desktop / beides (primär …) |
| **Use Cases** | UC-… (Schritte …), UC-… |
| **Oberflächen** | UI-… aus dem UI-Katalog |
| **Arbeitsfläche** | wo der Ablauf in der Informationsarchitektur liegt, Adresse |
| **Etappe** | E<n> im Fahrplan |

## Job-Story
Wenn ‹Situation›, will ich ‹Motivation›, damit ‹Ergebnis›.
(eine je Rolle, höchstens drei)

## Zielgrössen
| Nr. | Grösse | Zielwert | Messung |
(messbar: Schritte, Sekunden, Fehlerquote, Anteil ohne Hilfe)

## Einstieg
Woher die Person kommt: Startseite, Benachrichtigung, Befehlspalette, Direktlink, anderer Ablauf.

## Ablauf
Hauptweg aus Sicht der Person, nummeriert. Je Schritt: was sie sieht, was sie tut, was zurückkommt.
Nebenwege kurz mit Bezug auf den Alternativablauf des Use Cases (A1 …).

## Zustände
Nur Besonderheiten gegenüber dem Zustandskatalog (Z1–Z10).
| Zustand | Gestaltung |

## Regeln und Rückmeldungen
Welche Fachregeln wann (vorher/dabei/danach), Stufe (Hinweis/Warnung/Sperre), Ausweg.

## Texte
Schlüsseltexte wörtlich (Hauptaktion, Bestätigung, wichtigste Meldungen). Endgültig in der zentralen Textdatei.

## Barrierefreiheit und Tastatur
Besonderheiten (Raster, Ziehen, Live-Ansagen), Ersatz für Gesten und Ziehen.

## Abnahmekriterien
Prüfbare Sätze, je einer als automatischer Test, wo möglich.
- [ ] …

## Entscheide und offene Fragen
- Entscheid: … (Begründung)
- Offen: … (wer klärt)
```

## Hinweise zum Ausfüllen

- **Job-Story statt Persona.** Die Situation zählt, nicht ein erfundener Lebenslauf. Die Rollen kommen aus dem
  Akteurskatalog der Use Cases.
- **Zielgrössen ehrlich wählen.** Lieber drei harte Werte als zehn weiche. Jeder Wert wird bei der Abnahme gemessen
  ([pruefung.md](pruefung.md)).
- **Ablauf ≠ Use Case.** Nicht die Systemschritte nacherzählen, sondern beschreiben, was die Person wahrnimmt. Ein
  Schritt des Use Case kann in der Oberfläche verschwinden (automatisch) oder sich aufteilen.
- **Abnahmekriterien sind Tests.** Formulierung so, dass ein E2E-Test sie prüfen kann («Nach ‹Kommen› zeigt die
  Startseite innert 1 s ‹Anwesend seit 06:58›»).
