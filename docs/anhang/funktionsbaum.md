# Funktionsbaum Projektportfoliomanagement (Insel Gruppe)

Entwurf, Stand 26. Oktober 2026. 7 Business Modules, 23 Business Domains, 89 aktive Business Cases, davon 73 aus Kundenunterlagen (Q6–Q9) belegt. Methode, Quellen und Entscheide: siehe [PPM-Master.md](../PPM-Master.md).

## Funktionsbaum

```
- BM ZM Zielmanagement
  - BD ZM.01 Strategie und Handlungsfelder
    - BC ZM.01.01 Strategische Handlungsfelder pflegen
    - BC ZM.01.02 Strategische Ziele festlegen
  - BD ZM.02 Jahresziele und Massnahmen
    - BC ZM.02.01 Jahresziele ableiten
    - BC ZM.02.02 Jahresziele freigeben
    - BC ZM.02.03 Hauptaktivitäten festlegen
    - BC ZM.02.04 Zielmetrik definieren
  - BD ZM.03 Zielerreichung und Reviews
    - BC ZM.03.01 Zielerreichung erfassen
    - BC ZM.03.02 Quartalsreporting an den VR erstellen
    - BC ZM.03.03 Jahresrückblick auswerten
- BM DM Demand Management
  - BD DM.01 Projektideen
    - BC DM.01.01 Projektidee erfassen
    - BC DM.01.02 Projektidee qualifizieren
    - BC DM.01.03 Projektideen zusammenführen
    - BC DM.01.04 Projektidee zurückweisen
  - BD DM.02 Projektvertrag
    - BC DM.02.01 Projektvertrag erstellen
    - BC DM.02.02 Projektvertrag zur Prüfung einreichen
    - BC DM.02.03 Projektvertrag überarbeiten
    - BC DM.02.04 Projektvertrag zurückziehen
    - BC DM.02.05 Quality Review durchführen
    - BC DM.02.06 Projektvertrag freigeben
    - BC DM.02.07 Projektvertrag als Dokument ausgeben
- BM PP Portfolioplanung
  - BD PP.01 Strategische Ausrichtung
    - BC PP.01.01 Strategische Ziele erfassen — entfällt
    - BC PP.01.02 Bewertungsmodell festlegen
    - BC PP.01.03 Portfoliokategorien und Budgetrahmen festlegen
  - BD PP.02 Bewertung und Priorisierung
    - BC PP.02.01 Vorhaben bewerten
    - BC PP.02.02 Vorhaben priorisieren
    - BC PP.02.03 Abhängigkeiten zwischen Vorhaben erfassen
    - BC PP.02.04 Projektkategorie zuordnen
    - BC PP.02.05 Vorhaben mit strategischen Zielen verknüpfen
  - BD PP.03 Szenarien und Balancing
    - BC PP.03.01 Portfolioszenario erstellen
    - BC PP.03.02 Szenario gegen Budget und Kapazität prüfen
    - BC PP.03.03 Szenarien vergleichen
    - BC PP.03.04 Portfolio in Matrixsicht beurteilen
  - BD PP.04 Portfolioentscheide
    - BC PP.04.01 Entscheidungsvorlage vorbereiten
    - BC PP.04.02 Portfolioentscheid erfassen
    - BC PP.04.03 Portfolio-Roadmap publizieren
    - BC PP.04.04 Projektorganisation festlegen
    - BC PP.04.05 Gate-Reviews einplanen
- BM PS Portfoliosteuerung
  - BD PS.01 Statusberichterstattung
    - BC PS.01.01 Statusbericht erfassen
    - BC PS.01.02 Statusbericht prüfen
    - BC PS.01.03 Ausstehende Statusberichte nachverfolgen
    - BC PS.01.04 Terminabweichungen analysieren
  - BD PS.02 Phasen, Gates, Meilensteine
    - BC PS.02.01 Phasenfreigabe beantragen
    - BC PS.02.02 Phasenfreigabe entscheiden
    - BC PS.02.03 Meilenstein abnehmen
    - BC PS.02.04 Meilensteinplan pflegen
    - BC PS.02.05 Projektvertrag fortschreiben
  - BD PS.03 Änderungen und Eskalationen
    - BC PS.03.01 Änderung am Projektvertrag beantragen
    - BC PS.03.02 Änderung am Projektvertrag entscheiden
    - BC PS.03.03 Eskalation behandeln
    - BC PS.03.04 Vertragsversionen vergleichen
  - BD PS.04 Abschluss
    - BC PS.04.01 Vorhaben abschliessen
    - BC PS.04.02 Vorhaben sistieren oder abbrechen
    - BC PS.04.03 Lessons Learned erfassen
  - BD PS.05 Stakeholder und Kommunikation
    - BC PS.05.01 Stakeholder erfassen
    - BC PS.05.02 Kommunikationsplan erstellen
    - BC PS.05.03 Kommunikationsmassnahme nachführen
- BM PC Portfoliocontrolling
  - BD PC.01 Finanzen
    - BC PC.01.01 Projektbudget planen
    - BC PC.01.02 Ist-Kosten übernehmen
    - BC PC.01.03 Kostenprognose aktualisieren
    - BC PC.01.04 Budgetabweichungen analysieren
    - BC PC.01.05 Budgetbedarf in den Budgetprozess übergeben
  - BD PC.02 Risiken
    - BC PC.02.01 Portfoliorisiko erfassen
    - BC PC.02.02 Risikolage des Portfolios beurteilen
    - BC PC.02.03 Risikomassnahme verfolgen
    - BC PC.02.04 Projektrisiko erfassen
  - BD PC.03 Nutzen und KPIs
    - BC PC.03.01 Projekt-KPIs festlegen
    - BC PC.03.02 Nutzenrealisierung überprüfen
    - BC PC.03.03 KPI-Werte nachführen
    - BC PC.03.04 Business Case fortschreiben
  - BD PC.04 Reporting
    - BC PC.04.01 Portfolio-Dashboard einsehen
    - BC PC.04.02 Portfoliobericht erstellen
    - BC PC.04.03 Ad-hoc-Auswertung erstellen
- BM RK Ressourcen und Kapazitäten
  - BD RK.01 Kapazitätsangebot
    - BC RK.01.01 Kapazitätsangebot planen
    - BC RK.01.02 Personal- und Abwesenheitsdaten übernehmen
  - BD RK.02 Bedarf und Zuteilung
    - BC RK.02.01 Ressourcenbedarf anmelden
    - BC RK.02.02 Ressourcen zuteilen
    - BC RK.02.03 Ressourcenkonflikt auflösen
    - BC RK.02.04 Auslastung analysieren
    - BC RK.02.05 Ressourcenbedarf präzisieren
    - BC RK.02.06 ICT- und Infrastrukturbedarf anmelden
- BM AM Application Management
  - BD AM.01 Benutzer und Berechtigungen
    - BC AM.01.01 Benutzer verwalten
    - BC AM.01.02 Rolle mit Berechtigungen definieren
    - BC AM.01.03 Stellvertretung regeln
  - BD AM.02 Stammdaten und Konfiguration
    - BC AM.02.01 Organisationseinheiten verwalten
    - BC AM.02.02 Codetabellen pflegen
    - BC AM.02.03 Phasenmodell und Gates konfigurieren
    - BC AM.02.04 Portfolioebenen und Gremien konfigurieren
  - BD AM.03 Vorlagen, Schnittstellen, Protokoll
    - BC AM.03.01 Vorlagen verwalten
    - BC AM.03.02 Schnittstelle konfigurieren
    - BC AM.03.03 Änderungsprotokoll einsehen
```

## Business Cases


### BM ZM Zielmanagement

| ID | Business Case | Ziel des Users | Akteure | Herleitung | UC |
|---|---|---|---|---|---|
| **ZM.01** | **Strategie und Handlungsfelder** | | | | |
| ZM.01.01 | Strategische Handlungsfelder pflegen | Die fünf Handlungsfelder mit Leitsatz und Stossrichtungen als oberste Ordnung für Ziele und Vorhaben führen. | GL, ADM | Q6 F1, F8; Q9 S. 9–11 | UC-011 |
| ZM.01.02 | Strategische Ziele festlegen | Mehrjahresziele je Handlungsfeld festhalten und jährlich aktualisieren. | VR, GL | Q6 F2 Strategie-Aktualisierung, F3; Q9 S. 8 | UC-011 |
| **ZM.02** | **Jahresziele und Massnahmen** | | | | |
| ZM.02.01 | Jahresziele ableiten | Aus den strategischen Zielen die Kernziele für das Folgejahr bestimmen. | GL | Q6 F2 Zielsetzung, F3 | UC-011 |
| ZM.02.02 | Jahresziele freigeben | Die Jahresziele durch den VR verbindlich freigeben lassen. | VR | Q6 F2 «Freigabe: VR» | UC-011 |
| ZM.02.03 | Hauptaktivitäten festlegen | Jahresziele in Massnahmen mit Verantwortlichen übersetzen. | GL | Q6 F2 Vorbereitung Umsetzung, F3 | UC-011 |
| ZM.02.04 | Zielmetrik definieren | Für jedes Ziel festlegen, woran die Erreichung gemessen wird. | GL | Q6 F1, F3 «Metrik» | UC-011 |
| **ZM.03** | **Zielerreichung und Reviews** | | | | |
| ZM.03.01 | Zielerreichung erfassen | Den Stand je Ziel anhand der Metrik nachführen. | GL, UE | Q6 F1 «Zielerreichung» | UC-012 |
| ZM.03.02 | Quartalsreporting an den VR erstellen | Dem VR quartalsweise Gesamtstatus, Fortschritte, kritische Risiken, Abhängigkeiten, Eskalationen und finanzielle Auswirkungen vorlegen; der PRAT berichtet, die UE erstellt den Bericht aus dem Dashboard. | PRAT, UE, VR | Q6 F1, F2 Quartals-Review; Q8 Kap. 8.7 | UC-012 |
| ZM.03.03 | Jahresrückblick auswerten | Ergebnisse und Erkenntnisse des Jahres auswerten und den nächsten Zyklus planen. | PRAT | Q6 F2 Rückblick Q4 | UC-013 |

### BM DM Demand Management

| ID | Business Case | Ziel des Users | Akteure | Herleitung | UC |
|---|---|---|---|---|---|
| **DM.01** | **Projektideen** | | | | |
| DM.01.01 | Projektidee erfassen | Eine Idee in den Ideenpool stellen: Ausgangslage, Zielsetzung, Strategiebezug, betroffene Bereiche, erste Einschätzung von Nutzen, Aufwand und Relevanz. | AS | Q6 F8 «Pre P0 Ideen»; Q8 Kap. 6.1, 13; Q2 | UC-001 |
| DM.01.02 | Projektidee qualifizieren | Am Eintritt P0 prüfen: strategisch relevant, Ziel klar, klinische Frage, ICT, Infrastruktur; als strategisch, taktisch-operativ oder operativ einstufen. | UE, SP | Q6 F6 Eintritt P0; Q8 Kap. 6.1 | UC-001 |
| DM.01.03 | Projektideen zusammenführen | Doppelspurigkeiten vermeiden, indem gleichartige Ideen zusammengelegt werden. | UE | Q1; Q3 | UC-001 |
| DM.01.04 | Projektidee zurückweisen | Eine nicht verfolgte Idee begründet abschliessen und Antragstellende informieren. | UE | Q1; Q8 Abb. 3 | UC-001 |
| **DM.02** | **Projektvertrag** | | | | |
| DM.02.01 | Projektvertrag erstellen | Ausgangslage, Strategiebezug, Ziele, Lösung, Planung, Organisation, Ressourcen, Risiken und Change für Phase 1 erfassen. | PL, SP | Q7 Kap. 1–11; Q6 F8 | UC-002 |
| DM.02.02 | Projektvertrag zur Prüfung einreichen | Den Vertrag in den Status «in Prüfung» bringen. | PL | Q7 Kopf «Status» | UC-002 |
| DM.02.03 | Projektvertrag überarbeiten | Rückmeldungen aus Review oder Gremium einarbeiten und erneut einreichen. | PL | Q7 Kap. 12; Q1 | UC-002, UC-003 |
| DM.02.04 | Projektvertrag zurückziehen | Ein nicht mehr verfolgtes Vorhaben aus dem Prozess nehmen. | SP | Q1 | UC-002 |
| DM.02.05 | Quality Review durchführen | Vollständigkeit und Einhaltung des PM-Handbuchs prüfen. | UE | Q7 Kap. 12; Q8 Kap. 8.2 | UC-002, UC-003 |
| DM.02.06 | Projektvertrag freigeben | Auftraggeber/Sponsor, PL und CTL unterzeichnen; der PRAT gibt den Vertrag für die nächste Phase im Gate-Entscheid frei; die Version wird zur Baseline. | SP, PL, CTL, PRAT | Q7 Kap. 12, Handhabung; Q8 Kap. 5.1, 8.1 | UC-002, UC-003 |
| DM.02.07 | Projektvertrag als Dokument ausgeben | Den Vertrag aus den erfassten Daten im Layout der Vorlage erzeugen. | PL, UE | Q7 Vorlage; Q3 | UC-002 |

### BM PP Portfolioplanung

| ID | Business Case | Ziel des Users | Akteure | Herleitung | UC |
|---|---|---|---|---|---|
| **PP.01** | **Strategische Ausrichtung** | | | | |
| PP.01.01 | ~~Strategische Ziele erfassen~~ | entfällt: Aufgegangen in ZM.01.02. | – | Q6 F1–F3 | |
| PP.01.02 | Bewertungsmodell festlegen | Das Kriterienraster mit Kriterien und Gewichten definieren. | UE, PRAT | Q6 F1 Kriterienraster, F8 | UC-008 |
| PP.01.03 | Portfoliokategorien und Budgetrahmen festlegen | Investitionen steuern: Kategorien mit Budgetrahmen definieren. | UE, FI, PRAT | Q5 [OFFEN] | UC-008 |
| **PP.02** | **Bewertung und Priorisierung** | | | | |
| PP.02.01 | Vorhaben bewerten | Nutzen, Risiko und Ressourcenbedarf eines Vorhabens einstufen. | UE | Q6 F8, F9 | UC-008 |
| PP.02.02 | Vorhaben priorisieren | Eine begründete Rangfolge je Portfolioebene festlegen. | PRAT, GLPA, DIR | Q6 F1, F2, F7; Q8 Kap. 6.1 | UC-008 |
| PP.02.03 | Abhängigkeiten zwischen Vorhaben erfassen | Abhängigkeiten zu anderen Projekten mit Ansprechperson festhalten. | UE, PL | Q7 Kap. 6; Q8 Kap. 8.3; Q4 | UC-002, UC-008 |
| PP.02.04 | Projektkategorie zuordnen | Kategorie A strategisch, B Geschäftsleitung oder C Direktion festlegen und damit das Portfolio. | UE, GL | Q7 Kopf; Q6 F1, F4 | UC-001 |
| PP.02.05 | Vorhaben mit strategischen Zielen verknüpfen | Handlungsfeld, strategisches Ziel und allenfalls Jahresziel zuordnen. | PL, SP | Q7 Kap. 2; Q6 F3, F7 | UC-002 |
| **PP.03** | **Szenarien und Balancing** | | | | |
| PP.03.01 | Portfolioszenario erstellen | Varianten der Zusammensetzung durchspielen, ohne den Ist-Stand zu verändern. | UE | Q1; Q5 | UC-008 |
| PP.03.02 | Szenario gegen Budget und Kapazität prüfen | Die Wasserlinie ziehen: was mit den verfügbaren Mitteln umsetzbar ist. | UE, FI | Q6 F8 «Waterline» | UC-008 |
| PP.03.03 | Szenarien vergleichen | Die beste Variante nach Kosten, Nutzen, Risiko und Strategiebeitrag ermitteln. | UE, PRAT | Q3; Q5 | UC-008 |
| PP.03.04 | Portfolio in Matrixsicht beurteilen | Vorhaben nach Nutzen und Risiko einordnen: priorisieren, rasch umsetzen, opportunistisch, hinterfragen. | UE, PRAT | Q6 F9 | UC-008 |
| **PP.04** | **Portfolioentscheide** | | | | |
| PP.04.01 | Entscheidungsvorlage vorbereiten | Das Gate Review Packet nach dem Quality-Check der UE spätestens 5 Arbeitstage vor der Sitzung dem Ausschuss bereitstellen. | UE | Q6 F4; Q8 Kap. 8.2, Abb. 5 | UC-006 |
| PP.04.02 | Portfolioentscheid erfassen | Priorisierung und Freigabe von Streams und Projekten festhalten und das Protokoll innert 2–3 Arbeitstagen versenden. | PRAT | Q6 F2 Monatlicher Review; Q8 Abb. 5 | UC-006 |
| PP.04.03 | Portfolio-Roadmap publizieren | Die beschlossene Planung intern kommunizieren. | UE | Q6 F2, F3 «VR-Roadmap» | UC-011 |
| PP.04.04 | Projektorganisation festlegen | Sponsor, Sponsoren-Koalition, PL, CTL und Kernteam mit AKV benennen. | SP, UE | Q7 Kap. 8; Q6 F4, F5 | UC-002 |
| PP.04.05 | Gate-Reviews einplanen | Die nächsten PRAT-Gate-Reviews aller Vorhaben als Traktandenplanung bündeln. | UE | Q7 Kap. 7.2; Q6 F2; Q8 Kap. 8.5 | UC-006 |

### BM PS Portfoliosteuerung

| ID | Business Case | Ziel des Users | Akteure | Herleitung | UC |
|---|---|---|---|---|---|
| **PS.01** | **Statusberichterstattung** | | | | |
| PS.01.01 | Statusbericht erfassen | Bis zum 25. Phase, Abschlusstermin, nächsten Meilenstein, Status (im Plan/kritisch), Trend, Abweichungen bei Inhalt, Termin, Ressourcen und Budget, Abhängigkeiten und anstehende Entscheide melden. | PL | Q6 F7 Dashboard; Q8 Kap. 8.3, 8.4, 9 | UC-004 |
| PS.01.02 | Statusbericht prüfen | Plausibilität sicherstellen und Rückfragen an die Projektleitung stellen. | UE | Q6 F4; Q8 Kap. 8.4; Q1 | UC-005 |
| PS.01.03 | Ausstehende Statusberichte nachverfolgen | Fehlende Berichte erkennen und einfordern. | UE | Q2; Q8 Kap. 8.4 | UC-005 |
| PS.01.04 | Terminabweichungen analysieren | Baseline und aufdatierte Phasen- und Abschlusstermine über alle Vorhaben vergleichen. | UE | Q7 Kap. 7.2 | UC-005 |
| **PS.02** | **Phasen, Gates, Meilensteine** | | | | |
| PS.02.01 | Phasenfreigabe beantragen | Den Gate-Übergang mit Antworten auf die Leitfragen beantragen. | PL, SP | Q6 F6; Q8 Kap. 8.1, 8.6 | UC-003 |
| PS.02.02 | Phasenfreigabe entscheiden | Am Gate zwischen P0 und P4 über die Weiterführung entscheiden; in P0 und P1 bis zur Freigabe von P2 zusätzlich über den SNS-VR, bei Kategorie B durch die GLPA. | PRAT, SNS, GLPA | Q6 F6; Q8 Kap. 5.1, 7, 8.1 | UC-003, UC-006 |
| PS.02.03 | Meilenstein abnehmen | Meilensteine und Ergebnisse im monatlichen Review abnehmen. | PRAT, SP | Q6 F2 Monatlicher Review; Q8 Kap. 5.1 | UC-006 |
| PS.02.04 | Meilensteinplan pflegen | Lieferergebnisse und Meilensteine je Phase mit Termin führen, Baseline und aufdatiert. | PL | Q7 Kap. 7; Q6 F7 | UC-002, UC-004 |
| PS.02.05 | Projektvertrag fortschreiben | Am Gate um die Inhalte der nächsten Phase ergänzen und als neue Version vorlegen. | PL | Q7 Handhabung, Kap. 7.1 | UC-003 |
| **PS.03** | **Änderungen und Eskalationen** | | | | |
| PS.03.01 | Änderung am Projektvertrag beantragen | Wesentliche Änderung an Zielen, Umfang, Terminen oder Budget vorlegen. | PL | Q7 Kap. 12 | UC-007 |
| PS.03.02 | Änderung am Projektvertrag entscheiden | Die Änderung freigeben oder ablehnen; Änderungen an Scope, Budget oder Ressourcen gibt der PRAT frei; die Baseline wird nachgeführt. | SP, PRAT | Q7 Kap. 12; Q8 Kap. 8.5 | UC-007 |
| PS.03.03 | Eskalation behandeln | Kritische Entwicklungen (Status «kritisch») frühzeitig dem Ausschuss zum Entscheid vorlegen. | PL, SP, PRAT | Q6 F2, F4; Q8 Kap. 9 | UC-004, UC-006 |
| PS.03.04 | Vertragsversionen vergleichen | Hauptänderungen seit der letzten Version zeigen. | PL, UE, PRAT | Q7 Kopf | UC-003, UC-007 |
| **PS.04** | **Abschluss** | | | | |
| PS.04.01 | Vorhaben abschliessen | Am Exit-Gate P4 Kosten/Nutzen prüfen und an die Linie übergeben. | PL, SP, PRAT | Q6 F6 Exit P4; Q8 Kap. 7.5 | UC-015 |
| PS.04.02 | Vorhaben sistieren oder abbrechen | Ein Vorhaben begründet anhalten oder beenden und Ressourcen freigeben. | PRAT | Q6 F9 «ggf. stoppen» | UC-006, UC-015 |
| PS.04.03 | Lessons Learned erfassen | Erkenntnisse für künftige Vorhaben festhalten. | PL, UE | Q6 F2 Rückblick; Q8 Kap. 7.5; Q3 | UC-013, UC-015 |
| **PS.05** | **Stakeholder und Kommunikation** | | | | |
| PS.05.01 | Stakeholder erfassen | Betroffene Gruppen mit Interesse, Einfluss und geplanten Massnahmen festhalten. | PL, SP | Q7 Kap. 11.1; Q6 F2; Q8 Kap. 11 | UC-002 |
| PS.05.02 | Kommunikationsplan erstellen | Massnahmen mit Adressat und Ziel planen. | PL, SP | Q7 Kap. 11.2; Q6 F2; Q8 Kap. 11.2 | UC-002 |
| PS.05.03 | Kommunikationsmassnahme nachführen | Durchgeführte Massnahmen wie einen Meilenstein als erledigt melden. | PL | Q6 F7 Meilenstein | UC-004 |

### BM PC Portfoliocontrolling

| ID | Business Case | Ziel des Users | Akteure | Herleitung | UC |
|---|---|---|---|---|---|
| **PC.01** | **Finanzen** | | | | |
| PC.01.01 | Projektbudget planen | Kosten je Phase mit Lieferant, Offerte und CAPEX/OPEX planen. | PL, FI | Q7 Kap. 9.1 | UC-002 |
| PC.01.02 | Ist-Kosten übernehmen | Aktuelle Ist-Kosten aus dem ERP verfügbar haben, ohne Handerfassung. | FI (System) | Q2 [OFFEN] | UC-010 |
| PC.01.03 | Kostenprognose aktualisieren | Die erwarteten Gesamtkosten bis Projektende realistisch ausweisen. | PL | Q5 | UC-004 |
| PC.01.04 | Budgetabweichungen analysieren | Überschreitungen im Portfolio früh erkennen und Ursachen klären. | FI, UE | Q3 | UC-010 |
| PC.01.05 | Budgetbedarf in den Budgetprozess übergeben | Aus den Kosten je Phase den Jahresbedarf CAPEX/OPEX ableiten und einspeisen. | GL, FI | Q6 F2; Q7 Kap. 9.1 [OFFEN] | UC-010, UC-011 |
| **PC.02** | **Risiken** | | | | |
| PC.02.01 | Portfoliorisiko erfassen | Vorhabenübergreifende Risiken mit Bewertung festhalten. | UE | Q6 F9; Q8 Kap. 10.2; Q1 | UC-008 |
| PC.02.02 | Risikolage des Portfolios beurteilen | Die Gesamtrisikolage aus Projekt- und Portfoliorisiken überblicken. | UE, PRAT | Q6 F9; Q8 Kap. 8.5 | UC-006, UC-014 |
| PC.02.03 | Risikomassnahme verfolgen | Sicherstellen, dass beschlossene Massnahmen umgesetzt werden. | UE, PL | Q8 Kap. 10.3; Q1 | UC-004 |
| PC.02.04 | Projektrisiko erfassen | Risiken mit Eintrittswahrscheinlichkeit und Auswirkung (hoch/mittel/tief) und Massnahme festhalten. | PL | Q7 Kap. 10; Q6 F9; Q8 Kap. 10.3 | UC-002, UC-004 |
| **PC.03** | **Nutzen und KPIs** | | | | |
| PC.03.01 | Projekt-KPIs festlegen | Messbare Nutzen- und Projekt-KPIs mit Zielwert definieren (bisher «Nutzenziele festlegen»). | SP, PL | Q6 F1, F2 | UC-002 |
| PC.03.02 | Nutzenrealisierung überprüfen | In Stabilisierung und am Exit prüfen, ob der Nutzen stabil erreicht ist. | SP, UE | Q6 F6 P3–P4 | UC-003, UC-015 |
| PC.03.03 | KPI-Werte nachführen | Ist-Werte der klinischen und nicht-klinischen Projekt-KPIs ab der Implementierung laufend melden. | PL, CTL | Q6 F1, F2; Q8 Anhang 1 | UC-004 |
| PC.03.04 | Business Case fortschreiben | Kosten und Nutzen je Phase führen: initial P0, Baseline P1, Update P2 und P3, Abschluss P4. | PL, SP | Q8 Kap. 7, 13, Abb. 4, Anhang 1 | UC-002, UC-003, UC-015 |
| **PC.04** | **Reporting** | | | | |
| PC.04.01 | Portfolio-Dashboard einsehen | Den Stand je Portfolioebene auf einen Blick erfassen, auch als Funnel nach Phase. | PRAT, GLPA, DIR | Q6 F1, F7, F8; Q8 Kap. 8.3 | UC-014 |
| PC.04.02 | Portfoliobericht erstellen | Den periodischen Bericht für das jeweilige Gremium bereitstellen. | UE | Q6 F1 «Projekt Reporting»; Q8 Kap. 8.5 | UC-012, UC-014 |
| PC.04.03 | Ad-hoc-Auswertung erstellen | Spezifische Fragen mit Filtern und Auswertungen beantworten. | UE, FI | Q3 | UC-014 |

### BM RK Ressourcen und Kapazitäten

| ID | Business Case | Ziel des Users | Akteure | Herleitung | UC |
|---|---|---|---|---|---|
| **RK.01** | **Kapazitätsangebot** | | | | |
| RK.01.01 | Kapazitätsangebot planen | Die für Vorhaben verfügbare Kapazität je Ressourcenpool festlegen. | RM | Q4 [OFFEN] | UC-009 |
| RK.01.02 | Personal- und Abwesenheitsdaten übernehmen | Das Kapazitätsangebot ohne Doppelerfassung aktuell halten. | RM (System) | Q2 [OFFEN] | UC-009 |
| **RK.02** | **Bedarf und Zuteilung** | | | | |
| RK.02.01 | Ressourcenbedarf anmelden | Den Bedarf eines Vorhabens anmelden, mindestens als Grösse S/M/L. | PL | Q6 F8 | UC-002 |
| RK.02.02 | Ressourcen zuteilen | Angemeldeten Bedarf mit konkreten Personen decken. | RM | Q3 | UC-009 |
| RK.02.03 | Ressourcenkonflikt auflösen | Überbuchungen zwischen Vorhaben gemäss Priorität bereinigen. | RM, UE | Q6 F9 «sofern Kapazität verfügbar» | UC-009 |
| RK.02.04 | Auslastung analysieren | Engpässe und Unterauslastung erkennen. | RM, UE | Q6 F8 «Waterline» | UC-008, UC-009 |
| RK.02.05 | Ressourcenbedarf präzisieren | Personal in FTE und Monaten je Rolle und Phase planen. | PL | Q7 Kap. 9.2; Q6 F6 | UC-003 |
| RK.02.06 | ICT- und Infrastrukturbedarf anmelden | Den Bedarf früh bei den zuständigen Stellen melden, damit die Gates ihn prüfen können. | PL, SP | Q6 F6 Leitfragen ICT, Infrastruktur; Q8 Abb. 4 | UC-002 |

### BM AM Application Management

| ID | Business Case | Ziel des Users | Akteure | Herleitung | UC |
|---|---|---|---|---|---|
| **AM.01** | **Benutzer und Berechtigungen** | | | | |
| AM.01.01 | Benutzer verwalten | Personen Zugang zum System geben oder entziehen. | ADM | Q1 | UC-016 |
| AM.01.02 | Rolle mit Berechtigungen definieren | Die Rollen der Programm- und Projektebene abbilden. | ADM | Q6 F4 | UC-016 |
| AM.01.03 | Stellvertretung regeln | Abwesenheiten ohne liegende Freigaben überbrücken. | alle, ADM | Q3; Q2 | UC-016 |
| **AM.02** | **Stammdaten und Konfiguration** | | | | |
| AM.02.01 | Organisationseinheiten verwalten | Organisation inklusive Direktionen aktuell halten. | ADM | Q6 F1 | UC-017 |
| AM.02.02 | Codetabellen pflegen | Auswahlwerte wie Status (im Plan, kritisch), Trend (aufwärts, gleichbleibend, abwärts) und Grössen S/M/L zentral pflegen. | ADM | Q6 F7, F8; Q8 Kap. 9 | UC-017 |
| AM.02.03 | Phasenmodell und Gates konfigurieren | Phasen P0–P4, Gates, Leitfragen je Wertestrom sowie Standard-Lieferergebnisse und -Meilensteine je Phase abbilden. | ADM, UE | Q6 F6; Q7 Kap. 7.1; Q8 Kap. 7, Anhang 1 | UC-017 |
| AM.02.04 | Portfolioebenen und Gremien konfigurieren | Drei Portfolios mit Gremium, Gremienweg je Phase und Dashboard abbilden. | ADM, UE | Q6 F1, F4; Q8 Kap. 1, 8.1 | UC-017 |
| **AM.03** | **Vorlagen, Schnittstellen, Protokoll** | | | | |
| AM.03.01 | Vorlagen verwalten | Vorlagen wie den Projektvertrag und die Berichte bereitstellen. | ADM, UE | Q7; Q8 Kap. 13 | UC-018 |
| AM.03.02 | Schnittstelle konfigurieren | Datenaustausch mit Umsystemen einrichten und überwachen. | ADM | Q2 | UC-018 |
| AM.03.03 | Änderungsprotokoll einsehen | Nachvollziehen, wer wann was geändert hat. | ADM, UE | Q1 | UC-018 |
