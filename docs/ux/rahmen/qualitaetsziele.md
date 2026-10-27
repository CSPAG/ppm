# Qualitätsziele

Nicht-funktionale UX-Anforderungen mit **Standardwerten**. Ein Projekt übernimmt sie oder setzt in `docs/ux/README.md`
strengere bzw. begründet abweichende Werte. Jede Zeile ist prüfbar; die Spalte «Prüfung» nennt wie.

## Leistung

Gemessen auf einem mittleren Telefon (4 CPU-Kerne, gedrosselt auf «Fast 4G») und einem Bürorechner, jeweils mit warmem
Cache, am 75. Perzentil.

| Nr. | Ziel | Standardwert | Prüfung |
|---|---|---|---|
| Q-L1 | Startseite nutzbar (Largest Contentful Paint) | ≤ 2,5 s Telefon, ≤ 1,5 s Desktop | Lighthouse/Playwright-Trace in CI |
| Q-L2 | Reaktion auf Eingaben (Interaction to Next Paint) | ≤ 200 ms | Web-Vitals im Betrieb |
| Q-L3 | Sichtbare Reaktion auf Klick, Ziehen, Tippen | ≤ 100 ms (lokal, ohne Server) | Playwright-Messung im Kernablauf |
| Q-L4 | Seitenwechsel innerhalb der App | ≤ 500 ms bis Inhalt, sonst Skelett | Playwright |
| Q-L5 | Lange Listen und Raster | flüssig bei 1000 Zeilen bzw. 50 × 31 Zellen (virtualisiert) | Komponententest mit Messung |
| Q-L6 | Start-Bundle | ≤ 250 kB komprimiert; Arbeitsflächen werden bei Bedarf nachgeladen | Build-Bericht in CI |

## Barrierefreiheit

| Nr. | Ziel | Standardwert | Prüfung |
|---|---|---|---|
| Q-B1 | Konformität | WCAG 2.2 AA | axe in jedem E2E-Test ohne Befund, hell und dunkel |
| Q-B2 | Tastatur | jeder Ablauf vollständig, sichtbarer Fokus, logische Reihenfolge, Fokus in Dialogen gefangen und zurückgegeben | E2E-Test je Kernablauf nur mit Tastatur |
| Q-B3 | Bildschirmleser | Zustandswechsel werden angesagt (`aria-live`), Raster und Tabellen haben Kopfzellen und Beschriftung | Stichprobe mit NVDA/VoiceOver je Etappe |
| Q-B4 | Zielgrösse | ≥ 44 × 44 px für Hauptaktionen auf Touch, sonst ≥ 24 × 24 px | Komponententest der Bausteine |
| Q-B5 | Farbe | Information nie nur über Farbe (zusätzlich Symbol, Text oder Muster); Kontrast Text ≥ 4,5 : 1, Bedienelemente ≥ 3 : 1 | axe, Review |
| Q-B6 | Vergrösserung | 200 % Zoom ohne Verlust, Umbruch statt horizontales Scrollen bis 320 px CSS-Breite (ausser Raster) | E2E bei 320 px |
| Q-B7 | Bewegung | `prefers-reduced-motion` schaltet Animationen ab; nichts blinkt | Review |

## Geräte und Umgebung

| Nr. | Ziel | Standardwert | Prüfung |
|---|---|---|---|
| Q-G1 | Breiten | 360 px bis 2560 px; Kernabläufe mobiler Rollen ab 360 px vollständig | E2E bei 360, 768, 1440 px |
| Q-G2 | Eingabe | Touch, Maus, Tastatur, Stift; keine Funktion nur über Hover | Review |
| Q-G3 | Netz | Abläufe, die das Projekt als offline-fähig bezeichnet, funktionieren ohne Netz und gleichen danach ab; alle anderen zeigen den Offline-Zustand und verlieren keine Eingaben | E2E mit abgeschaltetem Netz |
| Q-G4 | Sitzungsablauf | Eingaben bleiben bei Ablauf der Sitzung erhalten und werden nach der Anmeldung angeboten | E2E |
| Q-G5 | Farbschema | hell, dunkel, wie System; gleichwertig gestaltet | axe in beiden Schemas |
| Q-G6 | Installierbar | Web-App-Manifest und Symbole, falls mobile Rollen die App täglich nutzen | Lighthouse |

## Sprache und Texte

| Nr. | Ziel | Standardwert | Prüfung |
|---|---|---|---|
| Q-S1 | Zentrale Texte | alle sichtbaren Texte an einer Stelle, je Sprache übersetzbar; keine Texte im Code der Features | Lint/Test |
| Q-S2 | Formate | Datum, Zeit, Zahl, Währung nach Sprache und Region der Person | Komponententest |
| Q-S3 | Textlänge | Layout hält 40 % längere Texte aus (Übersetzung) | Pseudo-Übersetzung im Test |
| Q-S4 | Anrede und Rechtschreibung | je Projekt festgelegt und automatisch geprüft | Prüfskript |
| Q-S5 | Fehlermeldungen | sagen was, warum und was jetzt; keine Codes ohne Erklärung; technische Referenz klein darunter | Review |

## Wirkung

| Nr. | Ziel | Standardwert | Prüfung |
|---|---|---|---|
| Q-W1 | Aufgabenerfolg ohne Hilfe | ≥ 90 % je Kernablauf | Test mit 5 Personen je Etappe ([pruefung.md](pruefung.md)) |
| Q-W2 | Zufriedenheit | System Usability Scale ≥ 75 | Fragebogen nach dem Test, später jährlich |
| Q-W3 | Zielgrössen der Kernabläufe | wie im Ablauf festgelegt | Abnahme der Etappe |
