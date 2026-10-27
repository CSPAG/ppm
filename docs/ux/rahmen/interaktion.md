# Interaktionsregeln

Verbindlich für jede Oberfläche. Ein Kernablauf weicht nur mit Begründung ab und nennt die Regel (z. B. «abweichend von
I-F3»). Nummern dienen als Verweis in Abläufen und Reviews.

## 1 Navigation und Informationsarchitektur

- **I-N1 Arbeitsflächen nach Aufgaben.** Die Hauptnavigation gliedert nach dem, was Personen tun («Planen»,
  «Erfassen», «Entscheiden»), nicht nach Datenobjekten oder Modulen. Höchstens 7 Arbeitsflächen je Rolle sichtbar.
- **I-N2 Sichtbarkeit nach Recht.** Eine Arbeitsfläche ohne Recht erscheint nicht. Innerhalb einer Fläche werden
  Bereiche ohne Recht ausgeblendet, nicht deaktiviert.
- **I-N3 Desktop: Leiste links, mobil: Leiste unten.** Unten höchstens 4 Ziele plus «Mehr». Die Startseite ist immer
  das erste Ziel.
- **I-N4 Befehlspalette (Strg+K / ⌘K).** Enthält alle Arbeitsflächen, die häufigsten Aktionen («Antrag stellen»)
  und die Suche nach Objekten (Personen, Pläne …), gefiltert nach Recht.
- **I-N5 Adressen sprechend und stabil.** `/<arbeitsflaeche>/<bereich>`, Objekt über `?o=<id>` (Schublade) oder
  `/<bereich>/<id>` (eigene Seite); Filter, Zeitraum und Ansicht als Suchparameter (Grundsatz G8).
- **I-N6 Tiefe höchstens 3.** Arbeitsfläche › Bereich › Objekt. Was tiefer läge, wird Teil des Objekts (Reiter,
  Abschnitte).
- **I-N7 Rückweg.** «Zurück» des Browsers schliesst zuerst Schublade oder Dialog, dann die Seite. Keine eigene
  Zurück-Logik, die davon abweicht.

## 2 Seitentypen

Jede Ansicht ist genau einer dieser Typen. Neue Typen nur mit Begründung im Projekt.

| Typ | Wofür | Aufbau |
|---|---|---|
| **Startseite** | Einstieg je Rolle | Kopf mit dem Wichtigsten jetzt (Status, nächster Termin), darunter «Zu tun» (handlungsrelevante Punkte mit Direktaktion), dann Überblick. Keine reinen Kennzahlen ohne Handlung. |
| **Liste + Schublade** | Verwalten von Objekten | Suche, Filter, Liste; Objekt öffnet in der Schublade rechts (mobil Vollbild) mit Ansehen, Bearbeiten, Verlauf. Standard für alle Stamm- und Einstellungsdaten. |
| **Arbeitsfläche** | dichte, lange Arbeit (Editor, Raster, Kalender) | volle Breite, Werkzeugleiste oben, Seitenpanel für Details und Prüfbericht; automatisches Speichern; Rückgängig/Wiederholen. Primär Desktop; mobil reduzierte Ansicht. |
| **Posteingang** | Entscheiden über Anfragen | Liste mit allen Entscheidungsinformationen in der Zeile, Einzel- und Sammelentscheid, Tastaturbedienung; Detail in Schublade nur bei Bedarf. |
| **Assistent** | seltene, mehrstufige Vorgänge mit Folgen (Abschluss, Import) | 2–5 Schritte mit Fortschritt, jederzeit zurück, Zusammenfassung der Wirkung vor dem letzten Schritt. |
| **Bericht** | Auswerten | Filter oben, Kennzahl mit Trend, Diagramm, Tabelle; jede Zahl führt zu ihren Einzelwerten; Export. |

## 3 Listen und Tabellen

- **I-L1** Suche und die wichtigsten Filter sichtbar; weitere Filter hinter «Filter». Aktive Filter als entfernbare
  Chips, «Alle Filter zurücksetzen».
- **I-L2** Ganze Zeile ist anklickbar und öffnet das Objekt; Aktionen in der Zeile nur für die häufigste Handlung.
- **I-L3** Nachladen mit «Mehr laden» oder endlos mit Cursor; keine Seitenzahlen für veränderliche Daten.
- **I-L4** Sammelaktionen: Auswahl per Kontrollkästchen, Leiste mit Anzahl und Aktionen erscheint; Ergebnis je Objekt
  zusammengefasst («18 genehmigt, 2 übersprungen: …»).
- **I-L5** Sortierung sichtbar und in der Adresse; Standardsortierung ist die für die Aufgabe nützlichste (meist
  «dringend zuerst»), nicht die Erfassungsreihenfolge.
- **I-L6** Mobil wird eine Tabelle zur Kartenliste mit den 3 wichtigsten Feldern.

## 4 Formulare

- **I-F1** Beschriftung über dem Feld, nie nur Platzhalter. Optionale Felder markieren («optional»), nicht die
  Pflichtfelder.
- **I-F2** Gute Vorbelegung: das Wahrscheinlichste ist vorausgefüllt (heutiges Datum, eigene Einheit, letzte Wahl).
- **I-F3** Prüfung beim Verlassen eines Feldes und live bei abgeleiteten Werten (z. B. Dauer, Summe, Restbetrag). Meldung
  direkt am Feld. Beim Absenden mit Fehlern: Fokus aufs erste fehlerhafte Feld, Zusammenfassung oben bei mehr als 3.
- **I-F4** Absenden ist nie ohne Erklärung deaktiviert. Lieber aktiv lassen und beim Absenden erklären, was fehlt.
- **I-F5** Wirkung sichtbar vor dem Absenden: was sich ändert (Stand danach, betroffene Personen, Kosten).
- **I-F6** Kurze Formulare (≤ 7 Felder) in der Schublade, längere als Seite mit Abschnitten. Kein Formular im Dialog
  ausser 1–2 Felder (Begründung, Name).
- **I-F7** Eingaben gehen nie verloren: ungespeicherte Änderungen beim Verlassen ansprechen; Entwürfe bei Fehlern,
  Abbruch der Verbindung und Sitzungsablauf lokal behalten.
- **I-F8** Datum und Zeit: Eingabe per Tastatur im lokalen Format **und** per Auswahl; Zeitraum als ein Baustein; Zeit
  über Mitternacht ist ein normaler Fall, kein Fehler.

## 5 Rückmeldung

| Art | Wann | Regeln |
|---|---|---|
| **Inline** | Ergebnis einer Prüfung, Fehler zu einem Feld oder Objekt | dort, wo das Problem ist; bleibt, bis es gelöst ist |
| **Toast** | Erfolg einer Aktion | kurz, unten; mit «Rückgängig», wenn möglich; nie für Fehler, nie die einzige Stelle einer wichtigen Information |
| **Banner** | Zustand des Systems oder der Ansicht (offline, Lesemodus, Periode abgeschlossen, Vertretung aktiv) | oben in der Ansicht, bleibt, solange der Zustand gilt |
| **Dialog** | Entscheid mit Folgen, der nicht rückgängig zu machen ist | Titel als Frage, Wirkung konkret, Schaltflächen mit Verben («Entwurf veröffentlichen» / «Weiter bearbeiten») |

- **I-R1 Stufen bei folgenreichen Aktionen:**
  1. umkehrbar → sofort ausführen, Toast mit «Rückgängig»;
  2. unumkehrbar, wirkt nur auf mich → Dialog mit dem konkreten Objekt («‹Vorlage A› löschen?»);
  3. wirkt auf andere (veröffentlichen, versenden, genehmigen in Menge) → Vorschau der Wirkung («12 Personen werden
     benachrichtigt, 3 Änderungen sind kurzfristig») und ein bewusster Klick.
- **I-R2 Optimistisch** für Aktionen mit geringem Risiko (Markieren, Umordnen, Entwurf ändern): sofort anzeigen,
  im Fehlerfall zurücksetzen und erklären. **Bestätigt** für rechtlich oder finanziell Relevantes (Buchung, Genehmigung,
  Abschluss): erst nach Antwort des Servers als erledigt zeigen, bis dahin Zwischenstand («wird gespeichert»).
- **I-R3 Automatisches Speichern** in Arbeitsflächen und langen Formularen, mit Anzeige «Gespeichert vor 5 s».

## 6 Zustände

Jede Ansicht und jeder Baustein, der Daten zeigt, gestaltet alle zutreffenden Zustände. Ein Ablauf führt in seiner
Zustandstabelle nur die Besonderheiten auf.

| Nr. | Zustand | Gestaltung |
|---|---|---|
| Z1 | **Laden** | Skelett in der Form des Inhalts, erst nach 300 ms; nie ein Spinner über der ganzen Seite; Kopf und Navigation bleiben bedienbar |
| Z2 | **Leer, erstes Mal** | erklärt in einem Satz, wozu die Ansicht dient, und bietet die erste Aktion an |
| Z3 | **Leer durch Filter** | «Nichts passt zu deiner Suche» mit «Filter zurücksetzen» |
| Z4 | **Teilweise** | was da ist, wird gezeigt; was fehlt, ist benannt («Salden werden berechnet …») |
| Z5 | **Fehler** | Titel und Erklärung aus der Fehlerantwort (z. B. problem+json), Referenz klein, «Erneut versuchen»; der Rest der Seite bleibt nutzbar |
| Z6 | **Offline** | Banner; was lokal geht, geht weiter; Ausstehendes ist gekennzeichnet und wird nachgereicht |
| Z7 | **Konflikt** | jemand anderes hat geändert (z. B. HTTP 412): beide Stände sichtbar oder «Neu laden, deine Änderungen bleiben erhalten» |
| Z8 | **Nur lesen** | wer ansehen, aber nicht ändern darf: keine Bearbeiten-Elemente, Hinweis wer ändern darf |
| Z9 | **Gesperrt** | Objekt ist abgeschlossen oder veröffentlicht: Banner mit Grund und dem Weg, es zu ändern (z. B. Korrekturantrag) |
| Z10 | **Nicht gefunden / kein Zugriff** | gleiche Meldung für beides, damit die Existenz nicht verraten wird; Weg zurück |

## 7 Regeln und Prüfungen

Für Domänen mit Fachregeln (Recht, Verträge, Budgets).

- **I-P1 Drei Stufen:** *Hinweis* (blau, Information, keine Handlung nötig), *Warnung* (gelb, zulässig mit
  Begründung bzw. bewusster Bestätigung), *Sperre* (rot, unzulässig; Aktion wird nicht ausgeführt). Immer Symbol + Text,
  nie nur Farbe.
- **I-P2 Inhalt jeder Meldung:** Regel in Klartext, Ist-Wert und Grenze, betroffene Person/Zeit, Ausweg oder Vorschlag.
  Beispiel-Struktur: «‹Regel›: ‹Ist› statt mindestens ‹Grenze› (‹wer, wann›). ‹Vorschlag›.» Quelle der Regel (Gesetz,
  Vertrag) auf Wunsch einblendbar.
- **I-P3 Zeitpunkt:** *vorher* (Wahlmöglichkeiten gekennzeichnet, z. B. beim Ziehen), *dabei* (beim Ablegen,
  Absenden), *danach* (Sammelbericht vor dem Veröffentlichen/Abschliessen). Dieselbe Regel liefert an allen drei Stellen
  denselben Text.
- **I-P4 Ort:** am betroffenen Objekt und gesammelt in einem Prüfbericht mit Sprung zum Objekt.
- **I-P5 Übersteuern:** Warnungen mit Begründung; Sperren nur mit eigenem Recht und Pflichtbegründung, protokolliert.
- **I-P6 Die Oberfläche prüft vorab, der Server entscheidet.** Lokale Prüfung für die Geschwindigkeit, verbindlich
  ist das Ergebnis des Servers; weicht es ab, gewinnt der Server und die Oberfläche zeigt dessen Meldung.

## 8 Rechte und Zugriff

- **I-Z1** Ausblenden, was man nicht darf (I-N2). **Deaktivieren** nur, wenn man es grundsätzlich darf, aber gerade
  nicht kann, und dann mit Grund am Element («Erst nach Ablauf der Eingabefrist»).
- **I-Z2** Handeln in Vertretung ist sichtbar (Banner) und wird in Entscheiden vermerkt.
- **I-Z3** Sensible Felder (Gesundheit, Standort) sind gekennzeichnet; wer sie sieht, sieht auch, dass sie sensibel
  sind. Zugriff darauf wird protokolliert.

## 9 Benachrichtigungen

- **I-B1** Nur Handlungsrelevantes oder Wirkung auf mich. Jede Benachrichtigung führt direkt zur Aktion (Link auf das
  Objekt mit geöffneter Entscheidung).
- **I-B2** Eine Zentrale in der App ist die Quelle; Push, E-Mail, SMS sind Zustellwege. Gelesen in einem Kanal = gelesen
  überall.
- **I-B3** Bündeln, was zusammengehört («3 neue Anträge»), Ruhezeiten der Person achten; Pflichtnachrichten (z. B.
  kurzfristige Änderung, die die Person direkt betrifft) sind als solche gekennzeichnet und kommen immer.
- **I-B4** Text: wer, was, bis wann; ohne sensible Inhalte auf dem Sperrbildschirm.

## 10 Zeit, Datum, Zahlen

- **I-T1** Formate nach Region der Person; 24-Stunden-Zeit, wo üblich.
- **I-T2** Nahe Zeitpunkte relativ und absolut («in 2 h · 14:00»), ferne nur absolut. Entscheide und Protokolle immer
  absolut.
- **I-T3** Wochentag bei jedem Datum, das man planend liest («Mo 3.11.»).
- **I-T4** Dauern und Salden mit Vorzeichen und Einheit; eine Darstellung je Projekt (z. B. h:mm), nicht gemischt.

## 11 Tastatur

| Kürzel | Wirkung |
|---|---|
| Strg+K / ⌘K | Befehlspalette |
| / | Suche der aktuellen Liste |
| Esc | Schublade, Dialog, Auswahl schliessen |
| ? | Übersicht der Kürzel der Ansicht |
| Strg+Z / Strg+Umschalt+Z | Rückgängig / Wiederholen in Arbeitsflächen |
| Pfeiltasten, Enter, Leertaste | Bewegen, Öffnen, Auswählen in Listen und Rastern |

Weitere Kürzel nur ansichtsbezogen, in der `?`-Übersicht aufgeführt, ohne Konflikt mit Browser und Bildschirmleser.

## 12 Mobile

- **I-M1** Hauptaktion in der Daumenzone (unteres Drittel), gross (Q-B4).
- **I-M2** Gesten (Wischen) nur als Abkürzung für eine sichtbare Aktion.
- **I-M3** Schublade wird Vollbild mit Zurück; Dialoge werden Blätter von unten.
- **I-M4** Kamera und Datei als gleichwertige Wege für Belege und Dokumente.

## 13 Texte

- **I-X1** Schaltflächen: Verb + Objekt («Auftrag zuweisen»). Abbrechen heisst «Abbrechen», nicht «Nein».
- **I-X2** Fehlermeldung: was ist passiert, warum, was jetzt. Keine Schuldzuweisung, keine Ausrufezeichen.
- **I-X3** Leere Zustände und Hinweise in einem Satz, aktive Formulierung.
- **I-X4** Ein Begriff je Sache, festgelegt im Glossar des Projekts; Synonyme sind Fehler.
- **I-X5** Hilfe im Kontext (kurzer Satz unter dem Feld, «Wie wird das berechnet?») statt Handbuch.
