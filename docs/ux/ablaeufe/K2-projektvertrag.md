# K2 Projektvertrag fortschreiben und freigeben

| | |
|---|---|
| **Rollen** | primär PL (erarbeitet, reicht ein); beteiligt SP und CTL (stimmen ab, unterzeichnen; SP entscheidet Änderungen), UE (Quality-Check), Gremium (entscheidet in [K3](K3-gremiumssitzung.md)) |
| **Gerät** | PL Desktop; Unterzeichnen und Änderung entscheiden: SP und CTL primär Telefon, auch Desktop; UE Desktop |
| **Use Cases** | [UC-002](../../anhang/use-cases.md#uc-002-projektvertrag-erarbeiten-und-freigeben) (alle Schritte, A1–A6), [UC-003](../../anhang/use-cases.md#uc-003-gate-übergang-durchführen) (alle Schritte, A1–A6), [UC-007](../../anhang/use-cases.md#uc-007-änderung-am-projektvertrag-beantragen-und-entscheiden) (alle Schritte, A1–A2); Entscheid des Gremiums in K3 |
| **Oberflächen** | UI-01 Eingang, UI-07 Projektakte, UI-08 Gate-Modus, UI-09 Änderungsantrag, UI-10 Versionsvergleich, UI-11 Dokumentausgabe, UI-12 Prüfen und Unterzeichnen |
| **Arbeitsraum** | Projekte › Projekt › Vertrag `/projekte/<nr>/vertrag`, Versionen `/projekte/<nr>/versionen` |
| **Etappe** | E3 |

Die drei Use Cases bilden für die Person eine Geschichte: Der Projektvertrag wird als **Entwurf** einer neuen Version
fortgeschrieben, geprüft, unterzeichnet und entschieden. Der Anlass unterscheidet sich: erster Vertrag (Gate P0–P1,
UC-002), nächste Phase (Gate, UC-003) oder Änderung während der Phase (UC-007). Je Projekt gibt es höchstens einen Entwurf
(UX-E5).

## Job-Story

- **PL:** Wenn ein Gate naht, will ich sehen, was für die nächste Phase fehlt und was sich gegenüber der Baseline ändert,
  damit ich die Unterlagen einmal vollständig einreiche und nicht nach der Prüfung nachbessern muss.
- **SP / CTL:** Wenn ich unterzeichnen oder eine Änderung entscheiden soll, will ich die Hauptänderungen und ihre Wirkung
  auf einen Blick sehen, auch auf dem Telefon, damit ich verantwortet entscheide, ohne 30 Seiten zu lesen.
- **UE:** Wenn ein Vertrag zum Quality-Check kommt, will ich die Abweichungen vom PM-Handbuch direkt an der Stelle sehen und
  dort zurückmelden, damit Rückfragen nicht über E-Mail laufen.

## Zielgrössen

| Nr. | Grösse | Zielwert | Messung |
|---|---|---|---|
| K2-1 | Unterzeichnen ab Benachrichtigung auf dem Telefon (PPM-2) | ≤ 60 s, ≤ 3 Interaktionen | Aufgabentest mit SP und CTL auf dem Telefon |
| K2-2 | Anteil Quality-Checks ohne Rückmeldung an die PL | ≥ 70 % (Vorschlag) | Betrieb |
| K2-3 | Durchlaufzeit «zur Prüfung eingereicht» → «vollständig unterzeichnet» | Median ≤ 5 Arbeitstage | Betrieb |
| K2-4 | Fehlende Pflichtangaben auffinden | PL erreicht jede fehlende Angabe mit 1 Klick aus dem Seitenpanel; 100 % im Test | automatischer Test, Aufgabentest |
| K2-5 | Gate Review Packet ohne Dokumente ausserhalb des Systems (PPM-4) | 0 von Hand erstellte Dateien | Aufgabentest, Betrieb |

## Einstieg

- **Eingang (PL):** «Projektvertrag P1 erstellen» nach Freigabe der Initialisierung (UC-002 Ausgangslage; aus [K4](K4-projektidee.md));
  «Gate P1–P2 vorbereiten · PRAT Mi 10.12. · Unterlagen bis Mi 3.12.» rund 30 Arbeitstage vor dem eingeplanten Gate-Review
  (UC-003 Ausgangslage; Zeitpunkt Vorschlag, [UX-OF-5](../fahrplan.md#offene-fragen)).
- **Projektakte:** «Änderung beantragen» (UC-007 Schritt 1).
- **Statusbericht:** «Änderung beantragen» aus der Warnung zur wesentlichen Abweichung ([K1](K1-statusbericht.md), UC-004 A1); der
  Entwurf ist mit dem Bericht verknüpft.
- **Eingang (UE, SP, CTL, PL):** «Quality-Check Projektvertrag ‹Projekt›», «Projektvertrag Version 2.0 unterzeichnen»,
  «Änderung am Projektvertrag entscheiden», je mit Benachrichtigung, die direkt die Ansicht öffnet (I-B1).

## Ablauf

**Entwurf anlegen (PL):**

1. Die Aufgabe öffnet die Projektakte. Gibt es noch keinen Entwurf, zeigt sie die Wirkung und eine Schaltfläche
   (UC-003 Schritt 2, UC-007 Schritt 1): «Entwurf für Phase P2 anlegen: übernimmt Version 1.0 (Baseline seit Mi 12.3.) als
   Entwurf 1.1». Beim ersten Vertrag legt das System den Entwurf 0.1 ohne Rückfrage an und übernimmt Ausgangslage,
   Zielsetzung und Strategiebezug aus der Projektidee (UC-002 Schritt 1). Bei einer Änderung ist zusätzlich die
   **Begründung** Pflicht (UC-007 Schritt 2).

**Erarbeiten (PL, Seitentyp Arbeitsfläche, automatisches Speichern I-R3):**

2. **Aufbau:** links die Kapitel des Projektvertrags (Q7, Kap. 1–13), je mit Markierung «geändert gegenüber Baseline»
   (Punkt) und «Angaben fehlen» (Symbol); Mitte das Kapitel; rechts das Seitenpanel. Im **Gate-Modus** (UC-003 Schritt 1)
   enthält das Seitenpanel: Leitfragen des Gates je Wertestrom mit Fortschritt («18 von 25 beantwortet»), die
   Standard-Lieferergebnisse der Phase mit Stand, die für die nächste Phase zu ergänzenden Kapitel und die fehlenden
   Pflichtangaben (I-P4). Bei einer Änderung zeigt es die Hauptänderungen und den Vergleich zur Baseline.
3. **Kapitel bearbeiten** (UC-002 Schritte 2–7, UC-003 Schritt 3, UC-007 Schritt 2). Die Abweichung zur Baseline steht
   laufend am Feld («CHF 2,40 Mio. statt 2,10 Mio. · +14 %», UC-003 Schritt 3). Besonderheiten:
   - **Projektorganisation** (UC-002 Schritt 2): Personen aus dem Verzeichnis wählen; Wirkung «Erhalten Zugriff auf das
     Projekt: Lea Brunner (CTL), Marc Huber (Kernteam)». Die Sponsoren-Koalition ist eine Liste (K05).
   - **Ziele und Strategiebezug** (Schritt 3): Wahl eines strategischen Ziels und optional eines Jahresziels aus dem
     Zielbaum, nur Ziele in Kraft; Hinweis «Das Projekt erscheint danach im Arbeitsraum Ziele unter Ziel 2.1».
   - **Business Case und KPIs** (Schritt 4): Kosten und Nutzen, KPIs mit Zielwert; die Vorstudie als Beilage (Datei oder
     Kamera, I-M4). Struktur des Business Case offen (K21).
   - **Abhängigkeiten** (Schritt 5): Projekt wählen, Ansprechperson; Hinweis «Erscheint auch bei ‹anderes Projekt›».
   - **Planung** (Schritt 6): Meilensteine und Lieferergebnisse der Phase sind aus dem Phasenmodell vorausgefüllt (I-F2);
     Kosten je Phase getrennt nach CAPEX und OPEX; Personalbedarf. In P0 als Grösse **S / M / L** (A1). Am Gate P1–P2
     verlangt das System Personal in FTE und Monaten je Rolle und Phase sowie Kosten P2–P4 (UC-003 A1) als Raster Rolle ×
     Phase mit Summen; der Bedarf geht nach dem Speichern an Ressourcen- und Finanzplanung.
   - **Risiken, Stakeholder, Kommunikation** (Schritt 7) als Listen mit Schublade.
   - **ICT- und Infrastrukturbedarf** (A2): im Kapitel Ressourcen «ICT-Bedarf melden» bzw. «Infrastrukturbedarf melden»;
     Formular in der Schublade, Wirkung «Die Meldung geht an ICT (DTI)». Danach zeigt das Kapitel «gemeldet am Fr 14.11.»
     (Anbindung offen, K24).
   - **Nutzen ab P3** (UC-003 A2): Das Kapitel zeigt KPIs mit Zielwert und nachgeführten Ist-Werten; PL und SP erfassen
     die erreichten Werte und ihre Beurteilung. Beim Exit-Gate führt «Abschluss vorbereiten» in die Projektakte › Abschluss
     (UC-015).
4. **Leitfragen beantworten** (UC-003 Schritt 4) im Seitenpanel, je Wertestrom aufklappbar, Antwort als Text.
5. **Hauptänderungen prüfen** (UC-003 Schritt 5, UC-007 Schritt 2): Das System erzeugt sie aus dem Versionsvergleich in den
   Rubriken Scope, Zeitplan, Ressourcen/Budget, Annahmen, Key-Risiken; die PL ergänzt «Andere» und kann jede Rubrik
   umformulieren. Der **Versionsvergleich** (UI-10) zeigt je Kapitel alt und neu nebeneinander, Zahlen mit Differenz.

**Einreichen (PL):**

6. **Zur Prüfung einreichen** (UC-002 Schritt 8, UC-003 Schritt 6). Fehlen Pflichtangaben der Phase (A3), sperrt die Regel
   und listet sie mit Sprung zur Stelle. Sonst zeigt die Schaltfläche vorher die Wirkung: «Die Unternehmensentwicklung
   erhält den Quality-Check. Bis zum Ergebnis ist der Entwurf gesperrt.» Stand «in Prüfung» (Z8 für die PL).
   Bei einer **Änderung** heisst die Aktion **Änderung einreichen** und geht direkt an den Sponsor (UC-007 Schritt 3;
   UC-007 kennt keinen Quality-Check).
   **Zurückziehen** (UC-002 A4, nur SP, erster Vertrag bis «traktandiert»): im Kopf des Reiters «Vertrag» «Projekt zurückziehen» → Dialog (unumkehrbar, wirkt auf
   andere): «Projekt ‹Digitale Patientenaufnahme› zurückziehen? Vertrag und Projekt werden als ‹zurückgezogen›
   geschlossen, der Ressourcenbedarf (Grösse M) wird freigegeben, die Unternehmensentwicklung wird informiert.»
   Begründung Pflicht; Schaltflächen «Projekt zurückziehen» / «Abbrechen».

**Quality-Check (UE):**

7. Die Aufgabe öffnet die Projektakte in der Prüfansicht: Inhalte nur lesbar, Kommentar je Kapitel möglich, im Seitenpanel
   die Checkliste des Quality-Checks (Lieferergebnisse vorhanden, Leitfragen beantwortet, Pflichtangaben, Einhaltung
   PM-Handbuch) und die Hauptänderungen.
   - **Quality-Check bestätigen** (UC-002 Schritt 9, UC-003 Schritt 7) → Wirkung «Sponsor, Projektleitung und CTL erhalten
     je eine Unterzeichnungsaufgabe»; das System protokolliert den Check.
   - **Zurück an die Projektleitung** (UC-002 A5, UC-003 A4) mit den Kommentaren als Rückmeldungen; Stand «in Arbeit»;
     die PL sieht die Rückmeldungen am betroffenen Kapitel und im Seitenpanel. Weiter bei Schritt 3.

**Unterzeichnen (SP, PL, CTL; Telefon und Desktop):**

8. Die Benachrichtigung öffnet die **Zusammenfassung** (UC-002 Schritt 10, UC-003 Schritt 8): Projekt, Phase, Anlass,
   Hauptänderungen in fünf Rubriken, Business Case in Kennzahlen, Kosten und Termine je Phase mit Differenz zur Baseline,
   Stand der Unterschriften («2 von 3: ✓ Projektleitung, ✓ CTL, ◷ Sponsor»). Darunter «Ganzen Vertrag ansehen»
   (Projektakte) und «Als PDF ansehen».
   - **Unterzeichnen**: ein bewusster Klick mit Wirkung davor (I-R1 Stufe 3): «Mit Ihrer Unterschrift ist der Vertrag
     vollständig unterzeichnet und wird für die PRAT-Sitzung vom Mi 10.12. traktandiert.» Bestätigt durch den Server
     (I-R2); die Unterschrift wird mit Person und Zeitpunkt protokolliert.
   - **Nicht unterzeichnen** (UC-003 A5): Begründung Pflicht; Stand «in Arbeit», die PL erhält die Begründung im Eingang.
     Weiter bei Schritt 3.
   Sind alle drei Unterschriften da, setzt das System das Traktandum auf die Liste des zuständigen Gremiums (UC-002 Schritt
   10, UC-003 Schritt 8); der Gremienweg folgt der Konfiguration (Kategorie, Phase, SNS-VR). Weiter in
   [K3](K3-gremiumssitzung.md); dort stellt die UE das Gate Review Packet bereit (UC-003 Schritt 9).

**Änderung entscheiden (SP, UC-007):**

9. Die Aufgabe öffnet dieselbe Zusammenfassung mit Begründung und Versionsvergleich. **Änderung freigeben** (Schritt 4)
   zeigt vorher die Wirkung: «Version 1.2 wird Baseline. Planung und Dashboard werden nachgeführt, Projektleitung und
   Unternehmensentwicklung informiert.» **Ablehnen** (A2) mit Begründung (Pflicht): der Entwurf wird verworfen, die
   Baseline bleibt.
   **Wirkung auf Scope, Budget oder Ressourcen** (A1): Betrifft der Entwurf die Kapitel Scope, Kosten oder Personal, ersetzt
   das System «Änderung freigeben» durch **Antrag an den PRAT unterstützen** mit Hinweis (siehe Regeln). Das Traktandum
   entsteht im Gremium (K3); bei Freigabe dort gilt dieselbe Wirkung wie in Schritt 4, bei Ablehnung wie in A2.

**Entscheid des Gremiums und danach:**

10. Den Entscheid erfasst die UE in der Sitzung ([K3](K3-gremiumssitzung.md); UC-002 Schritt 11, UC-003 Schritt 10). In der Projektakte
    erscheint danach das Banner «Version 2.0 ist seit Mi 10.12. Baseline. Projekt in Phase P2 Implementierung.»; PL und
    SP werden informiert.
    - **Auflagen oder zurückgestellt** (UC-002 A6, UC-003 A6): Der Entwurf ist wieder «in Arbeit», die Auflagen stehen mit
      Termin im Seitenpanel und als Aufgaben im Eingang; die Baseline bleibt. Weiter bei Schritt 3.
    - **Abgelehnt oder gestoppt:** weiter in UC-015 (Projektakte › Abschluss).
11. **Als Dokument herunterladen** (UC-002 Schritt 12) in Versionen: jede Version als Dokument im Layout der Vorlage mit
    Versionsnummer, Stand und Unterschriften (Format offen, Vorschlag PDF und Word).

## Zustände

| Zustand | Gestaltung |
|---|---|
| Kein Entwurf | Projektakte zeigt die Baseline (nur lesen) und die Aktionen «Änderung beantragen», bei fälligem Gate «Entwurf für Phase ‹n› anlegen» |
| Entwurf vorhanden, anderer Anlass | «Änderung beantragen» bei laufendem Gate-Entwurf: Hinweis «Es gibt bereits einen Entwurf für Gate P1–P2 (in Arbeit). Nehmen Sie die Änderung dort auf.» mit Link (UX-E5) |
| Z8 In Prüfung / zur Unterzeichnung | Banner «In Prüfung bei der Unternehmensentwicklung seit ‹Datum›» bzw. «Zur Unterzeichnung: 2 von 3»; keine Bearbeiten-Elemente |
| Z9 Traktandiert | Banner «Traktandiert für PRAT Mi 10.12. · Unterlagen versendet Mi 3.12.»; Änderungen nur nach Rückweisung |
| Z7 Konflikt | Zwei Personen bearbeiten dasselbe Kapitel (PL und Stellvertretung): «Kapitel 7 wurde von ‹Name› geändert. Neu laden – Ihre Änderungen bleiben erhalten.» |
| Vertretung | Unterzeichnet die Stellvertretung des SP: Banner «Sie unterzeichnen in Vertretung von ‹Name›» (I-Z2); die Unterschrift trägt den Vermerk (UC-016 Schritt 4); ob Unterschriften vertretbar sind, ist offen ([UX-OF-10](../fahrplan.md#offene-fragen)) |
| Via SNS-VR | Banner «Entscheid gilt erst mit dem SNS-VR» bis zu dessen Entscheid (UC-006 A1) |

## Regeln und Rückmeldungen

| Regel (Quelle) | Zeitpunkt | Stufe | Text | Ausweg |
|---|---|---|---|---|
| Pflichtangaben der Phase (UC-002 A3, UC-003 A3; Pflichtfelder offen K13) | *vorher* Symbol am Kapitel und Liste im Seitenpanel, *dabei* beim Einreichen | Sperre | «Angaben für Phase P2 fehlen: Personal in FTE (Kap. 9.2), Kosten P2–P4 (Kap. 9.1). Ergänzen Sie sie, um einzureichen.» | Sprung zur Angabe |
| Personal in FTE ab Gate P1–P2 (UC-003 A1) | *vorher* im Kapitel Ressourcen | Sperre (als Pflichtangabe) | «Gate P1–P2: Personal in FTE und Monaten je Rolle und Phase statt Grösse M. Die Ressourcenplanung braucht die Werte ab der Implementierung.» | Raster ausfüllen |
| Unbeantwortete Leitfragen (UC-003 Schritt 4) | *vorher* im Seitenpanel, *dabei* beim Einreichen | Warnung | «Leitfragen: 3 von 25 unbeantwortet (Klinik 2, Infrastruktur 1). Beantworten Sie sie oder begründen Sie, warum sie nicht zutreffen.» | beantworten oder «trifft nicht zu» mit Begründung |
| Wesentliche Abweichung zur Baseline (UC-003 Schritt 3; Schwelle K11) | *dabei* am Feld | Hinweis | «Budget P2: CHF 2,40 Mio. statt 2,10 Mio. (+14 %). Erscheint in den Hauptänderungen.» | – |
| Änderung an Scope, Budget oder Ressourcen (UC-007 A1, Q8 Kap. 8.5) | *vorher* in der Zusammenfassung des SP | Sperre für «freigeben» | «Freigabe durch den PRAT: Diese Änderung betrifft Budget und Ressourcen. Sie können sie unterstützen; entscheiden wird der PRAT.» | **Antrag an den PRAT unterstützen** |
| Nicht unterzeichnen, Ablehnen, Zurückziehen ohne Begründung (UC-003 A5, UC-007 A2, UC-002 A4) | *dabei* | Sperre | «Begründung fehlt: Die Projektleitung erfährt sonst nicht, was zu ändern ist.» | Begründung erfassen |

## Texte

- Schaltflächen: «Entwurf für Phase P2 anlegen», «Änderung beantragen», «Zur Prüfung einreichen», «Änderung einreichen»,
  «Quality-Check bestätigen», «Zurück an die Projektleitung», «Unterzeichnen», «Nicht unterzeichnen», «Änderung
  freigeben», «Antrag an den PRAT unterstützen», «Ablehnen», «Projekt zurückziehen», «Als Dokument herunterladen»
- Seitenpanel Gate: «Gate P1–P2 · Leitfragen 18 von 25 · Lieferergebnisse 4 von 5 · 2 Angaben fehlen»
- Wirkung Unterzeichnen: «Mit Ihrer Unterschrift ist der Vertrag vollständig unterzeichnet und wird für die PRAT-Sitzung
  vom Mi 10.12. traktandiert.»
- Toast nach Unterzeichnen: «Unterzeichnet. Es fehlt noch die Unterschrift von Lea Brunner (CTL).»

## Barrierefreiheit und Tastatur

- Kapitelnavigation: ↑/↓ wechselt das Kapitel, Enter öffnet; **Alt+N** springt zur nächsten fehlenden Angabe.
- Raster Personal (Rolle × Phase): Pfeiltasten, Eingabe direkt in der Zelle, Summen je Zeile und Spalte werden angesagt.
- Versionsvergleich: Änderungen sind zusätzlich zu Farbe mit «neu» / «entfernt» / «geändert» gekennzeichnet (Q-B5).
- Zusammenfassung zum Unterzeichnen ab 360 px ohne horizontales Scrollen; «Unterzeichnen» in der Daumenzone (I-M1).

## Abnahmekriterien

- [ ] Die Gate-Aufgabe öffnet die Projektakte im Gate-Modus mit den Leitfragen des richtigen Gates und den Standard-Lieferergebnissen der Phase.
- [ ] «Entwurf anlegen» übernimmt die Baseline vollständig; jede danach geänderte Zahl zeigt die Differenz zur Baseline.
- [ ] Die Hauptänderungen enthalten nach einer Budgeterhöhung den alten und den neuen Wert in der Rubrik Ressourcen/Budget.
- [ ] Einreichen ohne Pflichtangaben ist gesperrt; jede gelistete Angabe führt mit einem Klick zur Stelle.
- [ ] Am Gate P1–P2 lässt sich nicht mit Grösse S/M/L einreichen.
- [ ] Nach «Quality-Check bestätigen» haben SP, PL und CTL je eine Unterzeichnungsaufgabe im Eingang.
- [ ] Ein SP unterzeichnet auf einem Telefon (360 px) ab der Benachrichtigung mit höchstens 3 Interaktionen.
- [ ] Nach der dritten Unterschrift erscheint das Traktandum als Vorschlag in der nächsten Sitzung des zuständigen Gremiums.
- [ ] Eine Änderung, die das Kapitel Kosten betrifft, kann der SP nicht freigeben, nur an den PRAT unterstützen.
- [ ] Ein zweiter Entwurf neben einem bestehenden lässt sich nicht anlegen; der Hinweis verlinkt den bestehenden.
- [ ] Jede Version lässt sich als Dokument herunterladen; das Dokument trägt Versionsnummer und Unterschriften.

## Entscheide und offene Fragen

- Entscheid: Ein Ablauf für Erstvertrag, Gate und Änderung, weil die Person dreimal dasselbe tut: einen Entwurf gegen die
  Baseline fortschreiben und freigeben lassen (G3, Heuristik «näher am Bestehenden»).
- Entscheid: Höchstens ein Entwurf je Projekt (UX-E5). Präzisiert UC-003 Schritt 2 und UC-007 Schritt 1; mit der UE
  bestätigen ([UX-OF-8](../fahrplan.md#offene-fragen)).
- Entscheid: Ob eine Änderung an den PRAT muss, leitet das System aus den geänderten Kapiteln ab (UC-007 A1); der SP
  sieht es, bevor er entscheidet (G4). Welche Kapitel Scope, Budget und Ressourcen bilden, legt die UE im Phasenmodell fest.
- Entscheid: Unterzeichnen als protokollierter Klick der angemeldeten Person; keine Rückfrage, aber Wirkung davor (G6, I-R1
  Stufe 3). Ob das rechtlich genügt, ist offen ([UX-OF-10](../fahrplan.md#offene-fragen)).
- Annahme (A-10, K11): Die Toleranzen des Projekts je Dimension (Termin, Kosten, Umfang) stehen in Kapitel 7 bei der
  Zusammenfassung der Projektplanung, weil Q7 kein Kapitel dafür hat. Sie gelten ab der Baseline und ersetzen den Standard
  des Phasenmodells; ohne Eintrag gilt der Standard.
- Offen: Pflichtangaben je Phase (K13), Struktur Business Case (K21), Sponsoren-Koalition (K05), Anbindung DTI/DBI (K24).
- Offen: Zeitpunkt der Gate-Aufgabe ([UX-OF-5](../fahrplan.md#offene-fragen)); Dateiformat der Dokumentausgabe.
- Umsetzung AP-E3-4: «Änderung freigeben» informiert die Projektleitung per Mitteilung; die Unternehmensentwicklung sieht
  die neue Baseline im Projekt (Mitteilungen gehen nur an Personen, eine Mitteilung an ein Recht fehlt im Eingang). Ein
  eingereichter Änderungsantrag steht «in Prüfung» mit dem Banner «Beim Sponsor zum Entscheid seit ‹Datum›». E2E folgt,
  sobald eine Baseline über den Gate-Entscheid (AP-E3-3) entsteht.
