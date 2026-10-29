# K1 Statusbericht erstellen und prüfen

| | |
|---|---|
| **Rollen** | primär PL (erstellt), UE mit PMO (prüft, schliesst die Periode ab); beteiligt AG (Projektauftraggeber:in; wird bei «Kritisch» informiert) |
| **Gerät** | Desktop; PL auch Laptop unterwegs, AG liest die Meldung «Kritisch» auf dem Telefon |
| **Use Cases** | [UC-004](../../anhang/use-cases.md#uc-004-monatlich-berichten) (alle Schritte, A1–A3), [UC-005](../../anhang/use-cases.md#uc-005-statusberichte-prüfen-und-nachverfolgen) (alle Schritte, A1–A3) |
| **Oberflächen** | UI-01 Eingang, UI-13 Statusbericht, UI-15 Berichte der Periode, UI-16 Terminabweichungen, UI-17 Dashboard |
| **Arbeitsraum** | Projekte › Projekt › Bericht `/projekte/<nr>/bericht?periode=2026-10`; Portfolio › Monatsabschluss `/portfolio/monatsabschluss?periode=2026-10` |
| **Etappe** | E1 |

## Job-Story

- **PL:** Wenn der Stichtag naht, will ich nur nachführen, was sich seit dem letzten Bericht verändert hat, damit der
  Bericht in wenigen Minuten steht und ich keine Excel-Zeile mehr pflege.
- **UE:** Wenn die Berichte eintreffen, will ich sofort sehen, welche auffällig sind und welche fehlen, damit das Dashboard
  bis Monatsende konsolidiert ist und die Gremien ab dem 1. damit arbeiten.
- **AG:** Wenn eines meiner Projekte kritisch wird, will ich es sofort mit Grund und Massnahme erfahren, damit ich vor der
  PRAT-Sitzung handeln kann.

## Zielgrössen

| Nr. | Grösse | Zielwert | Messung |
|---|---|---|---|
| K1-1 | Statusbericht ohne wesentliche Änderung erstellen und einreichen (PPM-1) | ≤ 5 Min., ≤ 15 Interaktionen ab Aufgabe im Eingang | Aufgabentest mit 5 PL, realistische Projektdaten |
| K1-2 | Anteil Berichte, die bis zum Stichtag 25. eingereicht sind | ≥ 90 % (Vorschlag; heutiger Wert unbekannt) | Betrieb, je Periode |
| K1-3 | Prüfung eines unauffälligen Berichts durch die UE | ≤ 1 Min. je Bericht, ohne das Detail zu öffnen | Aufgabentest |
| K1-4 | Auffälligkeiten erkannt (Status geändert, Termin verschoben, Prognose über Budget) | UE findet in einer Periode mit 30 Berichten alle 5 eingebauten Auffälligkeiten ohne Hilfe | Aufgabentest |
| K1-5 | Periode bis Monatsende abgeschlossen, ohne Nacharbeit ausserhalb des Systems (PPM-3) | 100 % der Perioden; 0 Excel-Dateien | Betrieb, Abschlussdatum je Periode |

## Einstieg

- **Eingang (PL):** Aufgabe «Statusbericht Oktober erstellen · fällig Sa 25.10.» erscheint am 18. (Vorschlag,
  [UX-OF-4](../fahrplan.md#offene-fragen)), mit Benachrichtigung. Sie öffnet den Bericht direkt.
- **Projektakte:** «Statusbericht erstellen» in der Projektübersicht, jederzeit, auch für eine Meldung ausserhalb des
  Rhythmus (UC-004 Ausgangslage). Der Bericht trägt dann den Anlass «ausserordentlich».
- **Befehlspalette:** «Statusbericht erstellen» mit Projektwahl; bei nur einem Projekt vorausgewählt (I-F2).
- **Eingang (UE):** eine Sammelaufgabe je Periode «Statusberichte Oktober prüfen · 8 neu» statt einer Aufgabe je Bericht
  (I-B3); sie öffnet den Monatsabschluss gefiltert auf «eingereicht».

## Ablauf

**Erstellen (PL, Seitentyp Arbeitsfläche, automatisches Speichern I-R3):**

1. **Kopf** mit Projekt, Periode, Phase, «Abschluss per», nächstem Meilenstein und den Werten der Vorperiode
   (UC-004 Schritt 1): «September: Im Plan · gleichbleibend». Darunter die Abschnitte in fester Reihenfolge,
   je mit Kurzfassung und «Ändern»: Meilensteine, Kosten, Risiken, Kommunikation, KPIs, Beurteilung. Alles ist mit dem Stand
   der Vorperiode vorausgefüllt (I-F2); Status und Trend nicht (siehe Entscheide). Rechts das Seitenpanel «Bereit zum
   Einreichen» mit den noch fehlenden Angaben (I-P4).
2. **Meilensteine** (Schritt 2): Liste der überfälligen und der Meilensteine der nächsten drei Monate. Je Zeile
   «Erreicht» (Datum vorbelegt mit heute) oder ein neuer Termin. Die Abweichung zur Baseline erscheint sofort an der
   Zeile: «+3 Wochen gegenüber Baseline». Ist sie wesentlich, erscheint die Warnung aus A1 (siehe Regeln) mit **Änderung
   beantragen** und **Eskalieren**; beides öffnet sich in neuem Kontext, der Bericht bleibt als Entwurf erhalten und wird
   mit dem Antrag bzw. der Eskalation verknüpft (UC-004 A1). Weiter mit Schritt 3.
3. **Kosten** (Schritt 3): je Phase Budget, Ist-Kosten und Prognose; die Person ändert nur die Prognose. Live darunter:
   «Prognose P2: CHF 1,32 Mio. · 6 % über Budget». Fehlen Ist-Kosten, steht dort «Ist-Kosten noch nicht verfügbar»
   (Z4, K18).
4. **Risiken** (Schritt 4): Liste der Projektrisiken mit Massnahme und deren Stand; «Risiko erfassen» öffnet die
   Schublade (PC.02.04).
5. **Kommunikation** (Schritt 5): die in der Periode fälligen Massnahmen als Liste mit Kontrollkästchen «erledigt».
6. **KPIs** (Schritt 6): nur ab Phase P2 sichtbar; je KPI Zielwert, letzter Ist-Wert und Feld für den neuen Ist-Wert.
7. **Beurteilung** (Schritt 7): **Status** «Im Plan» / «Kritisch» und **Trend** «aufwärts» / «gleichbleibend» /
   «abwärts» als Wahlschalter, daneben der Wert der Vorperiode. Je Dimension Inhalt, Termin, Ressourcen und Budget
   die Beurteilung der Abweichung (Skala offen, [UX-OF-17](../fahrplan.md#offene-fragen); Vorschlag «keine»,
   «gering», «wesentlich» mit Kommentar). Nächster Meilenstein (aus dem Plan vorausgefüllt), Abhängigkeiten (aus dem
   Vertrag, ergänzbar) und anstehende Entscheide.
   **Kritisch** (A2): Es erscheinen die Pflichtfelder «Begründung» und «Massnahme» und das Kontrollkästchen «Entscheid des
   PRAT nötig». Die Wirkung steht darunter (I-F5): «Projektauftraggeber Daniel Keller und die Unternehmensentwicklung werden beim
   Einreichen informiert. Mit ‹Entscheid des PRAT nötig› wird eine Eskalation für die PRAT-Sitzung vom Mi 12.11. angelegt.»
8. **Statusbericht einreichen** (Schritt 8): Fehlt etwas, nennt die Sperre alle fehlenden Angaben mit Sprung zur Stelle.
   Sonst wird der Bericht gespeichert, das Dashboard nachgeführt, und die UE erhält ihn zur Prüfung. Toast «Statusbericht
   Oktober eingereicht. Die Unternehmensentwicklung prüft ihn bis Fr 31.10.» mit **Rückgängig** (10 s). Danach ist der
   Bericht für die PL nur lesbar (Z8), bis die UE ihn prüft oder zurückgibt.

**Frist verpasst (UC-004 A3):** Am 26. wird die Aufgabe im Eingang «überfällig seit Sa 25.10.» und nach oben sortiert; die
PL erhält eine Erinnerung, die UE sieht den Bericht als «ausstehend» (UC-005 Schritt 1). Der Weg ist danach derselbe.

**Prüfen (UE, Seitentyp Posteingang):**

1. **Monatsabschluss** (UC-005 Schritt 1). Kopf: «Oktober 2026 · 23 von 31 eingereicht · 15 geprüft · 8 ausstehend ·
   Stichtag Sa 25.10. · Abschluss bis Fr 31.10.». Je Zeile Projekt, Projektleitung, Stand (eingereicht, geprüft,
   zurückgegeben, ausstehend), Status und Trend mit Veränderung («Im Plan → Kritisch») und die Auffälligkeiten als
   Badges: «Status geändert», «Termin +3 Wochen», «Prognose +6 % über Budget». Standardsortierung: auffällige zuerst, dann
   übrige eingereichte, dann ausstehende (I-L5). Filter: Stand, Portfolio, Auffälligkeit.
2. **Bericht öffnen** (Schritt 2) in der breiten Schublade: Bericht neben Vorperiode und Baseline, Unterschiede markiert,
   Auffälligkeiten oben mit Sprung zur Stelle.
3. **Bericht bestätigen** (Schritt 3) in der Zeile oder in der Schublade → Stand «geprüft», Toast mit **Rückgängig**.
   **Sammelbestätigung** (I-L4): Auswahl → «12 bestätigen»; Berichte mit Auffälligkeit werden nicht mitgenommen und
   gesondert genannt («12 bestätigt, 3 mit Auffälligkeit übersprungen»).
   **Rückfrage** (A2): «Rückfrage stellen» öffnet ein Textfeld in der Zeile (Pflicht). Der Bericht geht mit Stand
   «zurückgegeben» an die PL; sie erhält im Eingang «Rückfrage zum Statusbericht beantworten», der Bericht öffnet sich mit
   der Rückfrage zuoberst und ist wieder bearbeitbar. Nach erneutem Einreichen erscheint er bei der UE wieder als
   «eingereicht» mit dem Vermerk «nach Rückfrage».
   **Bericht fehlt** (A1): In der Zeile «ausstehend» die Aktion **Bericht einfordern**, auch als Sammelaktion
   («8 einfordern»). Die PL erhält eine Erinnerung im Eingang und als Benachrichtigung; die Zeile zeigt «eingefordert
   am Mo 27.10.».
4. **Terminabweichungen** (Schritt 4), Bereich «Termine» des Monatsabschlusses (Seitentyp Bericht): je Projekt Baseline
   und aufdatierte Phasen- und Abschlusstermine als Balken, nach Grösse der Abweichung sortiert; jede Zeile führt zum Projekt.
5. **Periode abschliessen** (Schritt 5): Die Schaltfläche zeigt vorher die Wirkung (I-R1 Stufe 3): «31 Projekte · 29
   geprüft · 2 nicht gemeldet: Für sie werden die Werte von September mit dem Vermerk ‹nicht gemeldet› übernommen (A3).
   Das Dashboard Oktober steht ab Sa 1.11. den Gremien PRAT und GLPA zur Verfügung.» Sind Berichte eingereicht, aber
   nicht geprüft, warnt die Regel; schliesst die UE trotzdem ab, tragen diese Berichte den Vermerk «nicht geprüft» (UX-E12).
   Nach dem Abschluss bleiben Änderungen möglich; sie tragen «geändert nach Abschluss» und erscheinen im Dashboard der
   Periode (UC-005 A4, UX-E13).

## Zustände

| Zustand | Gestaltung |
|---|---|
| Z2 Leer (Monatsabschluss vor dem ersten Bericht) | «Noch keine Statusberichte für Oktober. Die Projektleitungen sind seit Sa 18.10. aufgefordert.» |
| Z4 Teilweise (Bericht) | Ist-Kosten fehlen: Abschnitt Kosten zeigt Budget und Prognose, «Ist-Kosten noch nicht verfügbar» (UC-010 A1) |
| Z8 Eingereicht (Bericht nach Einreichen) | Banner «In Prüfung bei der Unternehmensentwicklung seit Do 23.10.» Ändern bleibt möglich; die Änderung entsteht als Version «geändert nach Einreichen» und erscheint bei der UE (UC-004 A4, UX-E13) |
| Z9 Abgeschlossen (Periode) | Banner «Oktober ist abgeschlossen (Fr 31.10., Sandra Frei). Das Dashboard ist für die Gremien freigegeben.» Spätere Änderungen tragen «geändert nach Abschluss» (UX-E13). Verspätete Berichte: [UX-OF-16](../fahrplan.md#offene-fragen) |
| Zurückgegeben | Bericht der PL mit Banner «Rückfrage der Unternehmensentwicklung» und Text der Rückfrage; bleibt bis zum erneuten Einreichen |
| Vertretung | Erstellt die Stellvertretung der PL den Bericht: Banner «Sie berichten in Vertretung von ‹Name› bis ‹Datum›» (I-Z2); der Bericht ist so vermerkt |
| Phase P4 | keine Berichtsaufgabe (UC-004 Vorbedingung P0–P3); in der Projektübersicht ist «Statusbericht erstellen» nicht vorhanden |

## Regeln und Rückmeldungen

| Regel (Quelle) | Zeitpunkt | Stufe | Text | Ausweg |
|---|---|---|---|---|
| Pflichtangaben des Berichts (UC-004 Schritt 7) | *vorher* im Seitenpanel, *dabei* beim Einreichen | Sperre | «Angaben fehlen: Status, Trend und Beurteilung Budget sind leer. Ergänzen Sie sie, um den Bericht einzureichen.» | Sprung zum ersten fehlenden Feld |
| Wesentliche Abweichung (UC-004 A1, Schwelle offen K11) | *dabei* an der Meilenstein- oder Kostenzeile | Warnung | «Termin: Abschluss P2 neu 15.05.2027 statt 31.03.2027 laut Baseline (+6 Wochen). Wesentliche Abweichungen sind im Projektvertrag nachzuführen. Beantragen Sie eine Änderung oder eskalieren Sie.» | **Änderung beantragen** (K2), **Eskalieren**, oder Bericht trotzdem einreichen |
| Status «Kritisch» (UC-004 A2) | *dabei* bei der Wahl | Sperre bis ausgefüllt | «Kritisch: Begründung und Massnahme fehlen. Projektauftraggeber:in und Unternehmensentwicklung brauchen beides, um handeln zu können.» | Begründung und Massnahme erfassen |
| Frist 25. (UC-004 A3, Q8 Kap. 8.4) | *vorher* im Eingang («in 3 Tagen»), *danach* als überfällig | Hinweis, ab 26. Warnung | «Statusbericht Oktober: überfällig seit Sa 25.10. Die Unternehmensentwicklung konsolidiert bis Fr 31.10.» | Bericht erstellen |
| Bericht nicht plausibel (UC-005 A2) | beim Prüfen | – (Handlung der UE) | Rückfrage im Wortlaut der UE | PL beantwortet oder korrigiert |
| Abschluss mit ungeprüften Berichten (UC-005 Schritt 5; UX-E12) | *dabei* bei «Periode abschliessen» | Warnung | «Abschluss: 3 Berichte sind eingereicht, aber nicht geprüft. Sie tragen danach den Vermerk ‹nicht geprüft›.» | Filter «eingereicht» mit einem Klick, oder trotzdem abschliessen |
| Abschluss mit fehlenden Berichten (UC-005 A3, K12) | *dabei* in der Wirkungsvorschau | Warnung | «Nicht gemeldet: 2 Projekte haben keinen Bericht. Für sie gelten die Werte von September mit Vermerk.» | einfordern oder trotzdem abschliessen |

## Texte

- Schaltflächen: «Statusbericht erstellen», «Statusbericht einreichen», «Änderung beantragen», «Eskalieren», «Bericht
  bestätigen», «Rückfrage stellen», «Bericht einfordern», «Periode abschliessen»
- Wirkung beim Einreichen: «Die Unternehmensentwicklung erhält den Bericht zur Prüfung. Das Dashboard zeigt ihn sofort.»
- Toast: «Statusbericht Oktober eingereicht. Die Unternehmensentwicklung prüft ihn bis Fr 31.10.»
- Rückfrage: Platzhalter «Was ist unklar? Die Projektleitung sieht Ihre Frage zuoberst im Bericht.»
- Leer im Posteingang nach dem Prüfen: «Alle eingereichten Berichte sind geprüft. 2 stehen noch aus.»

## Barrierefreiheit und Tastatur

- Monatsabschluss: ↑/↓ wechselt die Zeile, **B** bestätigt, **R** öffnet die Rückfrage, **E** fordert ein, Leertaste
  wählt aus, Enter öffnet die Schublade; in `?` aufgeführt.
- Status und Trend sind Optionsgruppen mit Text, nicht nur Farbe oder Pfeil (Q-B5); der Trend wird als «Trend abwärts»
  vorgelesen.
- Das Ergebnis jedes Bestätigens und jeder Sammelaktion wird angesagt («12 bestätigt, 3 übersprungen»).
- Terminabweichungen: die Balken haben eine Tabelle mit denselben Werten als Alternative.

## Abnahmekriterien

- [ ] Die Aufgabe im Eingang öffnet den Bericht der Periode mit allen Werten der Vorperiode vorausgefüllt, ausser Status und Trend.
- [ ] Ein Bericht ohne Änderung an Meilensteinen, Kosten und Risiken lässt sich mit höchstens 15 Interaktionen einreichen.
- [ ] Ein neuer Meilensteintermin zeigt innert 200 ms die Abweichung zur Baseline an der Zeile.
- [ ] Bei Status «Kritisch» lässt sich der Bericht ohne Begründung und Massnahme nicht einreichen.
- [ ] «Kritisch» mit «Entscheid des PRAT nötig» legt eine Eskalation an, die in der nächsten PRAT-Sitzung als Traktandenvorschlag erscheint (K3).
- [ ] Nach dem Einreichen zeigt das Dashboard den neuen Status des Projekts, und die UE sieht den Bericht als «eingereicht».
- [ ] Die Sammelbestätigung überspringt Berichte mit Auffälligkeit und nennt sie.
- [ ] Ein zurückgegebener Bericht zeigt der PL die Rückfrage zuoberst und ist wieder bearbeitbar.
- [ ] «Periode abschliessen» warnt, solange ein eingereichter Bericht ungeprüft ist, nennt die Anzahl und schliesst auf Bestätigung trotzdem ab; die Berichte tragen «nicht geprüft».
- [ ] Ein eingereichter Bericht und ein Bericht einer abgeschlossenen Periode lassen sich ändern; die Änderung erscheint als Version mit Vermerk im Verlauf und bei der UE.
- [ ] Nach dem Abschluss tragen fehlende Berichte im Dashboard den Vermerk «nicht gemeldet».
- [ ] Der ganze Ablauf der PL und der UE ist nur mit Tastatur möglich; axe ohne Befund.

## Entscheide und offene Fragen

- Entscheid: Status und Trend werden nicht aus der Vorperiode übernommen, sondern jeden Monat bewusst gewählt; der Wert der
  Vorperiode steht daneben. Begründung: Der Status ist die Kernaussage des Berichts (Q8 Kap. 9); ein unbemerkt übernommenes
  «Im Plan» wäre der folgenreichste Fehler im Ablauf. Alle übrigen Werte sind vorausgefüllt (K1-1).
- Entscheid: Rückgängig 10 s nach dem Einreichen statt Bestätigungsdialog (G6). Präzisiert UC-004 Schritt 8.
- Entscheid: Eine Sammelaufgabe je Periode für die UE statt einer Aufgabe je Bericht (I-B3). Präzisiert UC-005 Ausgangslage.
- Entscheid: Sammelbestätigung nur für Berichte ohne Auffälligkeit. Präzisiert UC-005 Schritt 3; mit der UE bestätigen
  ([UX-OF-7](../fahrplan.md#offene-fragen)).
- Umsetzung (AP-E1-2): «Termine» ist eine Ansicht des Monatsabschlusses (`?ansicht=termine`) statt eines eigenen
  Bereichs (I-N6); die Tastenkürzel des Posteingangs stehen unter der Liste, bis die Shell eine Hilfe `?` hat.
  Auffälligkeiten ohne Schwelle: jede Statusänderung, jede Verschiebung gegenüber Baseline bzw. «Abschluss per» der
  Vorperiode, jede Prognose über Budget. Bestätigen hat «Rückgängig» im Toast, solange die Periode offen ist.
- Offen: Schwelle der wesentlichen Abweichung (K11). Bis zur Klärung warnt das System ab +4 Wochen Termin oder +10 %
  Prognose je Phase (Vorschlag, als Standardwert im Phasenmodell konfigurierbar). Die gültige Toleranz des Projekts
  steht in Kap. 7 der Baseline des Projektvertrags, sonst gilt der Standard (A-10); die PL sieht die Warnung auch ohne
  Recht auf das Phasenmodell.
- Offen: Wann erscheint die Berichtsaufgabe ([UX-OF-4](../fahrplan.md#offene-fragen)); Umgang mit verspäteten Berichten nach dem
  Abschluss ([UX-OF-16](../fahrplan.md#offene-fragen)); Skala der Abweichungsbeurteilung ([UX-OF-17](../fahrplan.md#offene-fragen)).
