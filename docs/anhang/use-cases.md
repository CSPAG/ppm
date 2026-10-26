# Use Cases Projektportfoliomanagement (Insel Gruppe)

Entwurf, Stand 26. Oktober 2026. Use Cases bündeln Business Cases zu Abläufen; jeder Use Case hat einen Heimat-Arbeitsraum (Projekt, Portfolio, Gremium, Ziele, Administration). Prinzip siehe [PPM-Master.md](../PPM-Master.md#7-ux-prinzip-arbeitsräume).

## Use-Case-Liste

● = Kernablauf

| ID | Use Case | Kern | Heimat | berührt | Primärakteur | Business Cases |
|---|---|---|---|---|---|---|
| UC-001 | Projektidee erfassen und qualifizieren |  | Portfolio | Projekt | AS, UE | DM.01.01, DM.01.02, DM.01.03, DM.01.04, PP.02.04 |
| UC-002 | Projektvertrag erarbeiten und freigeben | ● | Projekt |  | PL | DM.02.01, DM.02.02, DM.02.03, DM.02.04, DM.02.05, DM.02.06, DM.02.07, PP.02.03, PP.02.05, PP.04.04, PC.01.01, PC.02.04, PC.03.01, PC.03.04, PS.02.04, PS.05.01, PS.05.02, RK.02.01, RK.02.06 |
| UC-003 | Gate-Übergang durchführen | ● | Projekt | Gremium | PL | PS.02.01, PS.02.02, PS.02.05, PS.03.04, DM.02.03, DM.02.05, DM.02.06, RK.02.05, PC.03.02, PC.03.04 |
| UC-004 | Monatlich berichten | ● | Projekt |  | PL | PS.01.01, PS.02.04, PC.01.03, PC.02.03, PC.02.04, PC.03.03, PS.05.03, PS.03.03 |
| UC-005 | Statusberichte prüfen und nachverfolgen |  | Portfolio |  | UE | PS.01.02, PS.01.03, PS.01.04 |
| UC-006 | PRAT-Sitzung vorbereiten und durchführen | ● | Gremium | Portfolio | UE, PRAT | PP.04.01, PP.04.02, PP.04.05, PS.02.02, PS.02.03, PS.03.03, PS.04.02, PC.02.02 |
| UC-007 | Änderung am Projektvertrag beantragen und entscheiden |  | Projekt |  | PL, SP | PS.03.01, PS.03.02, PS.03.04 |
| UC-008 | Portfolio priorisieren und ausbalancieren | ● | Portfolio | Gremium | UE, PRAT | PP.01.02, PP.01.03, PP.02.01, PP.02.02, PP.02.03, PP.03.01, PP.03.02, PP.03.03, PP.03.04, PC.02.01, RK.02.04 |
| UC-009 | Ressourcen planen und zuteilen |  | Portfolio | Projekt | RM | RK.01.01, RK.01.02, RK.02.02, RK.02.03, RK.02.04 |
| UC-010 | Portfoliofinanzen überwachen |  | Portfolio |  | FI, UE | PC.01.02, PC.01.04, PC.01.05 |
| UC-011 | Ziele im Jahreszyklus festlegen | ● | Ziele | Portfolio | GL, VR | ZM.01.01, ZM.01.02, ZM.02.01, ZM.02.02, ZM.02.03, ZM.02.04, PP.04.03, PC.01.05 |
| UC-012 | Quartalsreporting an den VR erstellen |  | Ziele | Portfolio | UE, PRAT | ZM.03.01, ZM.03.02, PC.04.02 |
| UC-013 | Jahresrückblick auswerten |  | Gremium | Ziele | PRAT | ZM.03.03, PS.04.03 |
| UC-014 | Portfolio auswerten |  | Portfolio |  | PRAT, GLPA, DIR, UE | PC.04.01, PC.04.02, PC.04.03, PC.02.02 |
| UC-015 | Vorhaben abschliessen oder abbrechen |  | Projekt | Gremium | PL, PRAT | PS.04.01, PS.04.02, PS.04.03, PC.03.02, PC.03.04 |
| UC-016 | Benutzer, Rollen und Stellvertretungen verwalten |  | Administration |  | ADM | AM.01.01, AM.01.02, AM.01.03 |
| UC-017 | Stammdaten und Governance konfigurieren |  | Administration |  | ADM, UE | AM.02.01, AM.02.02, AM.02.03, AM.02.04 |
| UC-018 | Vorlagen und Schnittstellen verwalten |  | Administration |  | ADM | AM.03.01, AM.03.02, AM.03.03 |

## Traceability-Matrix

| Business Case | 01 | 02 | 03 | 04 | 05 | 06 | 07 | 08 | 09 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ZM.01.01 Strategische Handlungsfelder pflegen |  |  |  |  |  |  |  |  |  |  | ● |  |  |  |  |  |  |  |
| ZM.01.02 Strategische Ziele festlegen |  |  |  |  |  |  |  |  |  |  | ● |  |  |  |  |  |  |  |
| ZM.02.01 Jahresziele ableiten |  |  |  |  |  |  |  |  |  |  | ● |  |  |  |  |  |  |  |
| ZM.02.02 Jahresziele freigeben |  |  |  |  |  |  |  |  |  |  | ● |  |  |  |  |  |  |  |
| ZM.02.03 Hauptaktivitäten festlegen |  |  |  |  |  |  |  |  |  |  | ● |  |  |  |  |  |  |  |
| ZM.02.04 Zielmetrik definieren |  |  |  |  |  |  |  |  |  |  | ● |  |  |  |  |  |  |  |
| ZM.03.01 Zielerreichung erfassen |  |  |  |  |  |  |  |  |  |  |  | ● |  |  |  |  |  |  |
| ZM.03.02 Quartalsreporting an den VR erstellen |  |  |  |  |  |  |  |  |  |  |  | ● |  |  |  |  |  |  |
| ZM.03.03 Jahresrückblick auswerten |  |  |  |  |  |  |  |  |  |  |  |  | ● |  |  |  |  |  |
| DM.01.01 Projektidee erfassen | ● |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| DM.01.02 Projektidee qualifizieren | ● |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| DM.01.03 Projektideen zusammenführen | ● |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| DM.01.04 Projektidee zurückweisen | ● |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| DM.02.01 Projektvertrag erstellen |  | ● |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| DM.02.02 Projektvertrag zur Prüfung einreichen |  | ● |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| DM.02.03 Projektvertrag überarbeiten |  | ● | ● |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| DM.02.04 Projektvertrag zurückziehen |  | ● |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| DM.02.05 Quality Review durchführen |  | ● | ● |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| DM.02.06 Projektvertrag freigeben |  | ● | ● |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| DM.02.07 Projektvertrag als Dokument ausgeben |  | ● |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| PP.01.02 Bewertungsmodell festlegen |  |  |  |  |  |  |  | ● |  |  |  |  |  |  |  |  |  |  |
| PP.01.03 Portfoliokategorien und Budgetrahmen festlegen |  |  |  |  |  |  |  | ● |  |  |  |  |  |  |  |  |  |  |
| PP.02.01 Vorhaben bewerten |  |  |  |  |  |  |  | ● |  |  |  |  |  |  |  |  |  |  |
| PP.02.02 Vorhaben priorisieren |  |  |  |  |  |  |  | ● |  |  |  |  |  |  |  |  |  |  |
| PP.02.03 Abhängigkeiten zwischen Vorhaben erfassen |  | ● |  |  |  |  |  | ● |  |  |  |  |  |  |  |  |  |  |
| PP.02.04 Projektkategorie zuordnen | ● |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| PP.02.05 Vorhaben mit strategischen Zielen verknüpfen |  | ● |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| PP.03.01 Portfolioszenario erstellen |  |  |  |  |  |  |  | ● |  |  |  |  |  |  |  |  |  |  |
| PP.03.02 Szenario gegen Budget und Kapazität prüfen |  |  |  |  |  |  |  | ● |  |  |  |  |  |  |  |  |  |  |
| PP.03.03 Szenarien vergleichen |  |  |  |  |  |  |  | ● |  |  |  |  |  |  |  |  |  |  |
| PP.03.04 Portfolio in Matrixsicht beurteilen |  |  |  |  |  |  |  | ● |  |  |  |  |  |  |  |  |  |  |
| PP.04.01 Entscheidungsvorlage vorbereiten |  |  |  |  |  | ● |  |  |  |  |  |  |  |  |  |  |  |  |
| PP.04.02 Portfolioentscheid erfassen |  |  |  |  |  | ● |  |  |  |  |  |  |  |  |  |  |  |  |
| PP.04.03 Portfolio-Roadmap publizieren |  |  |  |  |  |  |  |  |  |  | ● |  |  |  |  |  |  |  |
| PP.04.04 Projektorganisation festlegen |  | ● |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| PP.04.05 Gate-Reviews einplanen |  |  |  |  |  | ● |  |  |  |  |  |  |  |  |  |  |  |  |
| PS.01.01 Statusbericht erfassen |  |  |  | ● |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| PS.01.02 Statusbericht prüfen |  |  |  |  | ● |  |  |  |  |  |  |  |  |  |  |  |  |  |
| PS.01.03 Ausstehende Statusberichte nachverfolgen |  |  |  |  | ● |  |  |  |  |  |  |  |  |  |  |  |  |  |
| PS.01.04 Terminabweichungen analysieren |  |  |  |  | ● |  |  |  |  |  |  |  |  |  |  |  |  |  |
| PS.02.01 Phasenfreigabe beantragen |  |  | ● |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| PS.02.02 Phasenfreigabe entscheiden |  |  | ● |  |  | ● |  |  |  |  |  |  |  |  |  |  |  |  |
| PS.02.03 Meilenstein abnehmen |  |  |  |  |  | ● |  |  |  |  |  |  |  |  |  |  |  |  |
| PS.02.04 Meilensteinplan pflegen |  | ● |  | ● |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| PS.02.05 Projektvertrag fortschreiben |  |  | ● |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| PS.03.01 Änderung am Projektvertrag beantragen |  |  |  |  |  |  | ● |  |  |  |  |  |  |  |  |  |  |  |
| PS.03.02 Änderung am Projektvertrag entscheiden |  |  |  |  |  |  | ● |  |  |  |  |  |  |  |  |  |  |  |
| PS.03.03 Eskalation behandeln |  |  |  | ● |  | ● |  |  |  |  |  |  |  |  |  |  |  |  |
| PS.03.04 Vertragsversionen vergleichen |  |  | ● |  |  |  | ● |  |  |  |  |  |  |  |  |  |  |  |
| PS.04.01 Vorhaben abschliessen |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ● |  |  |  |
| PS.04.02 Vorhaben sistieren oder abbrechen |  |  |  |  |  | ● |  |  |  |  |  |  |  |  | ● |  |  |  |
| PS.04.03 Lessons Learned erfassen |  |  |  |  |  |  |  |  |  |  |  |  | ● |  | ● |  |  |  |
| PS.05.01 Stakeholder erfassen |  | ● |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| PS.05.02 Kommunikationsplan erstellen |  | ● |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| PS.05.03 Kommunikationsmassnahme nachführen |  |  |  | ● |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| PC.01.01 Projektbudget planen |  | ● |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| PC.01.02 Ist-Kosten übernehmen |  |  |  |  |  |  |  |  |  | ● |  |  |  |  |  |  |  |  |
| PC.01.03 Kostenprognose aktualisieren |  |  |  | ● |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| PC.01.04 Budgetabweichungen analysieren |  |  |  |  |  |  |  |  |  | ● |  |  |  |  |  |  |  |  |
| PC.01.05 Budgetbedarf in den Budgetprozess übergeben |  |  |  |  |  |  |  |  |  | ● | ● |  |  |  |  |  |  |  |
| PC.02.01 Portfoliorisiko erfassen |  |  |  |  |  |  |  | ● |  |  |  |  |  |  |  |  |  |  |
| PC.02.02 Risikolage des Portfolios beurteilen |  |  |  |  |  | ● |  |  |  |  |  |  |  | ● |  |  |  |  |
| PC.02.03 Risikomassnahme verfolgen |  |  |  | ● |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| PC.02.04 Projektrisiko erfassen |  | ● |  | ● |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| PC.03.01 Projekt-KPIs festlegen |  | ● |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| PC.03.02 Nutzenrealisierung überprüfen |  |  | ● |  |  |  |  |  |  |  |  |  |  |  | ● |  |  |  |
| PC.03.03 KPI-Werte nachführen |  |  |  | ● |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| PC.03.04 Business Case fortschreiben |  | ● | ● |  |  |  |  |  |  |  |  |  |  |  | ● |  |  |  |
| PC.04.01 Portfolio-Dashboard einsehen |  |  |  |  |  |  |  |  |  |  |  |  |  | ● |  |  |  |  |
| PC.04.02 Portfoliobericht erstellen |  |  |  |  |  |  |  |  |  |  |  | ● |  | ● |  |  |  |  |
| PC.04.03 Ad-hoc-Auswertung erstellen |  |  |  |  |  |  |  |  |  |  |  |  |  | ● |  |  |  |  |
| RK.01.01 Kapazitätsangebot planen |  |  |  |  |  |  |  |  | ● |  |  |  |  |  |  |  |  |  |
| RK.01.02 Personal- und Abwesenheitsdaten übernehmen |  |  |  |  |  |  |  |  | ● |  |  |  |  |  |  |  |  |  |
| RK.02.01 Ressourcenbedarf anmelden |  | ● |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| RK.02.02 Ressourcen zuteilen |  |  |  |  |  |  |  |  | ● |  |  |  |  |  |  |  |  |  |
| RK.02.03 Ressourcenkonflikt auflösen |  |  |  |  |  |  |  |  | ● |  |  |  |  |  |  |  |  |  |
| RK.02.04 Auslastung analysieren |  |  |  |  |  |  |  | ● | ● |  |  |  |  |  |  |  |  |  |
| RK.02.05 Ressourcenbedarf präzisieren |  |  | ● |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| RK.02.06 ICT- und Infrastrukturbedarf anmelden |  | ● |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| AM.01.01 Benutzer verwalten |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ● |  |  |
| AM.01.02 Rolle mit Berechtigungen definieren |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ● |  |  |
| AM.01.03 Stellvertretung regeln |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ● |  |  |
| AM.02.01 Organisationseinheiten verwalten |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ● |  |
| AM.02.02 Codetabellen pflegen |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ● |  |
| AM.02.03 Phasenmodell und Gates konfigurieren |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ● |  |
| AM.02.04 Portfolioebenen und Gremien konfigurieren |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ● |  |
| AM.03.01 Vorlagen verwalten |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ● |
| AM.03.02 Schnittstelle konfigurieren |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ● |
| AM.03.03 Änderungsprotokoll einsehen |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | ● |

Alle 89 aktiven Business Cases sind durch mindestens einen Use Case realisiert. PP.01.01 entfällt.

## Ausformulierte Use Cases

Nach CSP-Vorlage. Alle 18 Use Cases sind ausformuliert.


### UC-001 Projektidee erfassen und qualifizieren

**Referenz Funktionsbaum:** DM.01.01 Projektidee erfassen, DM.01.02 Projektidee qualifizieren, DM.01.03 Projektideen zusammenführen, DM.01.04 Projektidee zurückweisen, PP.02.04 Projektkategorie zuordnen

**Arbeitsraum:** Portfolio

#### Beschreibung
- **Ausgangslage:** Aus dem Innovationsprozess, dem jährlichen Strategieprozess oder einem Bereich der Organisation entsteht eine Projektidee (Q8 Kap. 6.1).
- **Use Case:** AS stellt die Idee nach Vorlage in den Ideenpool. UE prüft sie mit dem vorgesehenen Sponsor anhand der Leitfragen zum Eintritt P0, ordnet sie über das Kriterienraster einer Kategorie zu und legt sie dem zuständigen Gremium zur Freigabe der Initialisierung vor.
- **Resultat:** Idee qualifiziert und der Kategorie A, B oder C zugeordnet; bei Freigabe Vorhaben in Phase P0 und Aufgabe «Projektvertrag erstellen» im Eingang der Projektleitung (UC-002); sonst Idee begründet zurückgewiesen oder zusammengeführt.
- **User Interfaces:** Formular Projektidee; Ideenpool im Arbeitsraum Portfolio als Liste und Funnel «Pre-P0»; Eingang.

#### Beteiligte Akteure
| Akteur | Rolle im Use Case |
|---|---|
| AS | erfasst die Idee, ergänzt bei Rückfragen |
| UE | prüft, führt zusammen, ordnet zu, traktandiert |
| SP | vorgesehener Sponsor, qualifiziert mit |
| PRAT, GLPA | geben die Initialisierung frei |

#### Vorbedingungen
- AS ist angemeldet (AM.01.01).
- Handlungsfelder und strategische Ziele sind erfasst (UC-011).
- Kriterienraster und Leitfragen zum Eintritt P0 sind konfiguriert (PP.01.02, AM.02.03).

#### Ablauf

**Standardablauf**

| Schritt | Abzweigung Alternativablauf | Aktion User | Systemverhalten |
|---|---|---|---|
| 1 |  | AS legt eine neue Projektidee an. | System zeigt das Formular nach Vorlage: Ausgangslage, Zielsetzung, Strategiebezug (Handlungsfeld, strategisches Ziel), betroffene Bereiche, erste Einschätzung von Nutzen, Aufwand und Relevanz, Herkunft der Idee. |
| 2 |  | AS füllt das Formular aus und reicht die Idee ein. | System prüft die Pflichtfelder, stellt die Idee in den Ideenpool und legt der UE eine Prüfaufgabe in den Eingang. |
| 3 | A1 | UE öffnet die Idee. | System zeigt die Idee und ähnliche Ideen im Ideenpool mit gleichem Handlungsfeld oder gleichen betroffenen Bereichen. |
| 4 | A2, A3 | UE und SP beantworten die Leitfragen zum Eintritt P0: strategische Relevanz, Projektziel, klinische Fragestellung, ICT-Einbindung, Infrastruktur. | System speichert die Antworten zur Idee. |
| 5 | A4 | UE ordnet die Idee anhand des Kriterienrasters ein: strategisch, taktisch-operativ oder operativ. | System speichert die Kategorie A, B oder C und damit das zuständige Portfolio und Gremium. |
| 6 |  | UE traktandiert die Freigabe der Initialisierung (UC-006). | System setzt die Idee auf die Traktandenliste des zuständigen Gremiums. |
| 7 | A5 | Das Gremium gibt die Initialisierung frei; UE erfasst den Entscheid mit Sponsor und Projektleitung [OFFEN: Wer benennt Sponsor und Projektleitung?]. | System legt das Vorhaben in Phase P0 an, übernimmt die Angaben der Idee, informiert AS und legt der Projektleitung die Aufgabe «Projektvertrag erstellen» in den Eingang (UC-002). |

**Alternativablauf**

**A1 Ähnliche Idee vorhanden (ab Schritt 3):** Bedingung: Die Idee deckt sich ganz oder teilweise mit einer anderen.

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A1.1 | UE führt die Ideen zusammen und wählt die führende Idee. | System übernimmt die Angaben in die führende Idee, schliesst die andere als «zusammengeführt» und informiert beide Antragstellenden. |

Ende: weiter bei Schritt 4 mit der führenden Idee.

**A2 Angaben ungenügend (ab Schritt 4):** Bedingung: Die Idee lässt sich mit den Angaben nicht beurteilen.

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A2.1 | UE erfasst Rückfragen. | System gibt die Idee mit Status «in Ergänzung» an AS zurück. |
| A2.2 | AS ergänzt und reicht erneut ein. | System legt der UE die Prüfaufgabe erneut an. |

Ende: weiter bei Schritt 3.

**A3 Idee zurückweisen (ab Schritt 4):** Bedingung: Die Idee ist nicht strategisch relevant oder wird aus anderen Gründen nicht verfolgt [OFFEN: Darf die UE allein zurückweisen, oder entscheidet das Gremium?].

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A3.1 | UE erfasst die Begründung. | System schliesst die Idee als «zurückgewiesen» und informiert AS. |

Ende: Use Case endet.

**A4 Projekt einer Direktion (ab Schritt 5):** Bedingung: Die Idee gehört in Kategorie C.

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A4.1 |  | System weist die Idee dem Portfolio der zuständigen Direktion zu; Freigabe und Steuerung liegen dort, ohne Vorgaben des PM-Handbuchs (Q8 Kap. 1). |
| A4.2 | Die Direktion gibt die Initialisierung frei und erfasst den Entscheid. | System legt das Vorhaben in Phase P0 an. |

Ende: weiter in UC-002.

**A5 Initialisierung nicht freigegeben (ab Schritt 7):** Bedingung: Das Gremium stellt die Idee zurück oder lehnt sie ab.

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A5.1 | UE erfasst Entscheid und Begründung. | System lässt eine zurückgestellte Idee mit den Auflagen im Ideenpool; eine abgelehnte schliesst es als «zurückgewiesen». AS wird informiert. |

Ende: bei Rückstellung weiter bei Schritt 4; bei Ablehnung endet der Use Case.

### UC-002 Projektvertrag erarbeiten und freigeben

**Referenz Funktionsbaum:** DM.02.01 Projektvertrag erstellen, DM.02.02 Projektvertrag zur Prüfung einreichen, DM.02.03 Projektvertrag überarbeiten, DM.02.04 Projektvertrag zurückziehen, DM.02.05 Quality Review durchführen, DM.02.06 Projektvertrag freigeben, DM.02.07 Projektvertrag als Dokument ausgeben, PP.02.03 Abhängigkeiten zwischen Vorhaben erfassen, PP.02.05 Vorhaben mit strategischen Zielen verknüpfen, PP.04.04 Projektorganisation festlegen, PC.01.01 Projektbudget planen, PC.02.04 Projektrisiko erfassen, PC.03.01 Projekt-KPIs festlegen, PC.03.04 Business Case fortschreiben, PS.02.04 Meilensteinplan pflegen, PS.05.01 Stakeholder erfassen, PS.05.02 Kommunikationsplan erstellen, RK.02.01 Ressourcenbedarf anmelden, RK.02.06 ICT- und Infrastrukturbedarf anmelden

**Arbeitsraum:** Projekt

#### Beschreibung
- **Ausgangslage:** Das Gremium hat die Initialisierung freigegeben (UC-001); das Vorhaben ist in Phase P0. Das System legt der Projektleitung die Aufgabe «Projektvertrag erstellen» in den Eingang.
- **Use Case:** PL erarbeitet mit Sponsor und CTL den Projektvertrag für Phase P1 und den initialen Business Case, bei Bedarf gestützt auf eine Vorstudie. UE führt den Quality-Check durch, Sponsor, PL und CTL unterzeichnen, und das zuständige Gremium gibt am Gate P0–P1 den Vertrag und die Phase P1 frei.
- **Resultat:** Projektvertrag P1 freigegeben und als erste Baseline gespeichert; Projektorganisation, Ziele, Meilensteine, Budget, Ressourcenbedarf, Risiken, KPIs, Stakeholder und Kommunikation erfasst; ICT- und Infrastrukturbedarf gemeldet; Vorhaben in P1; Vertrag als Dokument verfügbar.
- **User Interfaces:** Eingang; Projektakte mit den Kapiteln des Projektvertrags; Dokumentausgabe im Layout der Vorlage; Traktandum im Arbeitsraum Gremium.

#### Beteiligte Akteure
| Akteur | Rolle im Use Case |
|---|---|
| PL | erarbeitet den Vertrag, reicht ein, unterzeichnet |
| SP | legt mit PL die Projektorganisation fest, stimmt ab, unterzeichnet |
| CTL | bringt Zielbild und klinische Anforderungen ein, unterzeichnet |
| UE | führt den Quality-Check durch, traktandiert |
| PRAT, SNS, GLPA | geben am Gate P0–P1 frei |

#### Vorbedingungen
- PL ist angemeldet und für das Vorhaben berechtigt (AM.01.02).
- Das Vorhaben ist in Phase P0 (UC-001).
- Die Vorlage Projektvertrag ist hinterlegt (AM.03.01).

#### Ablauf

**Standardablauf**

| Schritt | Abzweigung Alternativablauf | Aktion User | Systemverhalten |
|---|---|---|---|
| 1 |  | PL öffnet die Aufgabe im Eingang. | System legt den Projektvertrag in Version 0.1 mit Status «in Arbeit» an und übernimmt Ausgangslage, Zielsetzung und Strategiebezug aus der Projektidee. |
| 2 |  | PL und SP legen die Projektorganisation fest: Sponsor, Sponsoren-Koalition, PL, CTL und Kernteam mit AKV. | System speichert die Rollen und gibt den benannten Personen Zugriff auf das Vorhaben. |
| 3 |  | PL erfasst Ausgangslage, Ziele und Nutzenbeitrag, Lösungsansatz und Abgrenzung und ordnet das Vorhaben einem strategischen Ziel und allenfalls einem Jahresziel zu. | System verknüpft das Vorhaben mit dem Ziel; es erscheint im Arbeitsraum Ziele. |
| 4 |  | PL erfasst den initialen Business Case mit Kosten und Nutzen und die Projekt-KPIs mit Zielwert; eine Vorstudie legt PL als Beilage ab. | System speichert Business Case P0, KPIs und Beilage. |
| 5 |  | PL erfasst Abhängigkeiten zu anderen Vorhaben mit Ansprechperson. | System zeigt die Abhängigkeit auch beim anderen Vorhaben. |
| 6 | A1 | PL plant Meilensteine und Lieferergebnisse je Phase, Kosten je Phase (CAPEX/OPEX) und den Personalbedarf. | System schlägt die Standard-Lieferergebnisse und -Meilensteine der Phase vor (AM.02.03) und stellt den Bedarf der Ressourcenplanung bereit (UC-009). |
| 7 | A2 | PL erfasst Risiken mit Eintrittswahrscheinlichkeit, Auswirkung und Massnahme sowie Stakeholder und Kommunikationsmassnahmen. | System speichert sie im Risikoregister und im Kommunikationsplan des Vorhabens. |
| 8 | A3, A4 | PL reicht den Vertrag zur Prüfung ein. | System prüft die Pflichtangaben der Phase, setzt den Status «in Prüfung» und legt der UE die Aufgabe Quality-Check in den Eingang. |
| 9 | A5 | UE prüft Vollständigkeit und Einhaltung des PM-Handbuchs und bestätigt. | System legt SP, PL und CTL je eine Unterzeichnungsaufgabe an. |
| 10 |  | SP, PL und CTL unterzeichnen. | System setzt das Vorhaben auf die Traktandenliste des Gate-Reviews P0–P1 beim zuständigen Gremium (UC-006). |
| 11 | A6 | Das Gremium gibt Vertrag und Phase P1 frei; UE erfasst den Entscheid. | System setzt den Status «abgenommen», speichert die Version als Baseline, wechselt in Phase P1 und aktualisiert das Dashboard. |
| 12 |  | PL gibt den Vertrag als Dokument aus. | System erzeugt das Dokument im Layout der Vorlage mit Versionierung und Freigabe. |

**Alternativablauf**

**A1 Grösse statt Detailplanung (ab Schritt 6):** Bedingung: Der Personalbedarf ist in P0 noch nicht in FTE planbar.

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A1.1 | PL meldet den Bedarf als Grösse S, M oder L. | System speichert die Grösse; die Planung in FTE und Monaten folgt am Gate P1–P2 (UC-003 A1). |

Ende: weiter bei Schritt 7.

**A2 ICT- oder Infrastrukturbedarf (ab Schritt 7):** Bedingung: Die Leitfragen zeigen Bedarf an ICT oder Infrastruktur.

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A2.1 | PL meldet den Bedarf. | System leitet die Meldung an die zuständige Stelle weiter (DTI, DBI) [OFFEN: Anbindung an deren Projekt- und Investitionsprozesse]. |

Ende: weiter bei Schritt 8.

**A3 Pflichtangaben fehlen (ab Schritt 8):** Bedingung: Für die Phase verlangte Angaben sind leer [OFFEN: Pflichtfelder je Phase].

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A3.1 |  | System listet die fehlenden Angaben. |
| A3.2 | PL ergänzt sie. | System prüft erneut. |

Ende: weiter bei Schritt 8.

**A4 Vorhaben zurückziehen (ab Schritt 8):** Bedingung: Der Sponsor will das Vorhaben nicht weiterverfolgen.

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A4.1 | SP zieht das Vorhaben mit Begründung zurück. | System schliesst Vertrag und Vorhaben als «zurückgezogen», gibt den Ressourcenbedarf frei und informiert die UE. |

Ende: Use Case endet.

**A5 Quality-Check mit Rückmeldungen (ab Schritt 9):** Bedingung: UE stellt Mängel fest.

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A5.1 | UE erfasst Rückmeldungen. | System setzt den Status «in Arbeit» und informiert PL. |

Ende: weiter bei Schritt 3.

**A6 Gremium gibt nicht frei (ab Schritt 11):** Bedingung: Das Gremium stellt zurück, erteilt Auflagen oder lehnt ab.

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A6.1 | UE erfasst Entscheid und Auflagen. | System informiert PL und SP; das Vorhaben bleibt in P0. |

Ende: bei Auflagen weiter bei Schritt 3; bei Ablehnung weiter in UC-015.

### UC-003 Gate-Übergang durchführen

**Referenz Funktionsbaum:** PS.02.01 Phasenfreigabe beantragen, PS.02.02 Phasenfreigabe entscheiden, PS.02.05 Projektvertrag fortschreiben, PS.03.04 Vertragsversionen vergleichen, DM.02.03 Projektvertrag überarbeiten, DM.02.05 Quality Review durchführen, DM.02.06 Projektvertrag freigeben, RK.02.05 Ressourcenbedarf präzisieren, PC.03.02 Nutzenrealisierung überprüfen, PC.03.04 Business Case fortschreiben

**Arbeitsraum:** Projekt

#### Beschreibung
- **Ausgangslage:** Eine Phase nähert sich dem Ende. Der nächste Gate-Review ist im Projektvertrag eingeplant (Kap. 7.2); das System legt der Projektleitung eine Gate-Aufgabe in den Eingang.
- **Use Case:** PL schreibt Projektvertrag und Business Case für die nächste Phase fort und beantwortet die Leitfragen des Gates. UE führt den Quality-Check durch, Sponsor, PL und CTL unterzeichnen. Das zuständige Gremium entscheidet am Gate und gibt damit den Vertrag für die nächste Phase frei: der PRAT, in P0 und P1 bis zur Freigabe von P2 zusätzlich der SNS-VR, bei Kategorie B die GLPA.
- **Resultat:** Neue Vertragsversion freigegeben und als Baseline gespeichert, Gate-Entscheid mit Datum dokumentiert, Vorhaben in der nächsten Phase, Dashboard aktuell.
- **User Interfaces:** Eingang; Projektakte im Gate-Modus mit Vertragskapiteln, Leitfragen und Versionsvergleich; Traktandum im Arbeitsraum Gremium.

#### Beteiligte Akteure
| Akteur | Rolle im Use Case |
|---|---|
| PL | löst aus, schreibt Vertrag und Business Case fort, beantwortet Leitfragen, unterzeichnet |
| UE | führt den Quality-Check durch, stellt das Gate Review Packet bereit |
| SP, CTL | stimmen die Vorlage ab und unterzeichnen |
| PRAT, SNS, GLPA | entscheiden am Gate je nach Phase und Kategorie und geben den Vertrag frei |

#### Vorbedingungen
- PL ist angemeldet und für das Vorhaben berechtigt (AM.01.02).
- Vorhaben hat einen freigegebenen Projektvertrag der laufenden Phase.
- Ein Gate-Review ist eingeplant (PP.04.05).

#### Ablauf

**Standardablauf**

| Schritt | Abzweigung Alternativablauf | Aktion User | Systemverhalten |
|---|---|---|---|
| 1 |  | PL öffnet die Gate-Aufgabe im Eingang. | System öffnet die Projektakte im Gate-Modus: Leitfragen des Gates je Wertestrom (Nutzen, Projekt, Klinik, ICT, Infrastruktur), die Standard-Lieferergebnisse der Phase und die Kapitel, die für die nächste Phase zu ergänzen sind. |
| 2 |  | PL legt eine neue Vertragsversion an. | System übernimmt die freigegebene Version als Entwurf mit neuer Versionsnummer und Phase. |
| 3 | A1, A2 | PL ergänzt die Kapitel, etwa Planung, Kosten je Phase, Personal, Risiken, Stakeholder und Kommunikation, und schreibt den Business Case fort. | System speichert und zeigt laufend die Abweichungen zur Baseline. |
| 4 |  | PL beantwortet die Leitfragen des Gates. | System speichert die Antworten zur Version. |
| 5 |  | PL prüft die Zusammenfassung der Hauptänderungen und ergänzt «Andere». | System erzeugt die Hauptänderungen zu Scope, Zeitplan, Ressourcen/Budget, Annahmen und Key-Risiken aus dem Versionsvergleich. |
| 6 | A3 | PL reicht den Vertrag zur Prüfung ein. | System prüft die Pflichtangaben der Phase, setzt den Status «in Prüfung» und legt der UE die Aufgabe Quality-Check in den Eingang. |
| 7 | A4 | UE prüft Vollständigkeit und Einhaltung des PM-Handbuchs und bestätigt. | System protokolliert den Quality-Check und legt SP, PL und CTL je eine Unterzeichnungsaufgabe an. |
| 8 | A5 | SP, PL und CTL unterzeichnen. | System protokolliert die Unterzeichnung und setzt das Vorhaben auf die Traktandenliste des nächsten Gate-Reviews des zuständigen Gremiums. |
| 9 |  | UE stellt das Gate Review Packet spätestens 5 Arbeitstage vor der Sitzung bereit (UC-006). | System stellt das Packet aus Vertrag, Business Case, Leitfragen und Hauptänderungen zusammen. |
| 10 | A6 | Das Gremium gibt die nächste Phase und den Vertrag frei; UE erfasst den Entscheid. | System speichert den Entscheid, setzt den Status «abgenommen» und die Version als neue Baseline, wechselt die Phase, aktualisiert das Dashboard und informiert PL und SP. |

**Alternativablauf**

**A1 Gate P1–P2 (ab Schritt 3):** Bedingung: Das Vorhaben will in die Implementierung.

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A1.1 |  | System verlangt Personal in FTE und Monaten je Rolle und Phase sowie Kosten P2–P4 statt der Grösse S/M/L. |
| A1.2 | PL erfasst die Angaben. | System speichert sie im Vertrag und stellt sie der Ressourcen- und Finanzplanung bereit. |

Ende: weiter bei Schritt 4.

**A2 Gate ab P3 (ab Schritt 3):** Bedingung: Das Gate betrifft Stabilisierung oder Exit.

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A2.1 |  | System zeigt die Projekt-KPIs mit Zielwert und den nachgeführten Ist-Werten (PC.03.03). |
| A2.2 | PL und SP erfassen erreichte Werte und Beurteilung. | System speichert die Nutzenprüfung. Beim Exit-Gate P4 weiter in UC-015. |

Ende: weiter bei Schritt 4.

**A3 Pflichtangaben fehlen (ab Schritt 6):** Bedingung: Für die Phase verlangte Angaben sind leer [OFFEN: Pflichtfelder je Phase; das PM-Handbuch (Q8 Anhang 1) nennt nur Lieferergebnisse].

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A3.1 |  | System listet die fehlenden Angaben. |
| A3.2 | PL ergänzt sie. | System prüft erneut. |

Ende: weiter bei Schritt 6.

**A4 Review mit Rückmeldungen (ab Schritt 7):** Bedingung: UE stellt Mängel fest.

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A4.1 | UE erfasst Rückmeldungen. | System setzt den Status «in Arbeit» und informiert PL. |

Ende: weiter bei Schritt 3.

**A5 Freigabe verweigert (ab Schritt 8):** Bedingung: SP, PL oder CTL unterzeichnet nicht.

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A5.1 | Rolle erfasst die Begründung. | System setzt den Status «in Arbeit» und informiert PL. |

Ende: weiter bei Schritt 3.

**A6 Gremium gibt nicht frei (ab Schritt 10):** Bedingung: Das Gremium stellt zurück, erteilt Auflagen oder stoppt.

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A6.1 | UE erfasst Entscheid und Auflagen. | System informiert PL und SP; die Baseline bleibt unverändert. |

Ende: bei Auflagen weiter bei Schritt 3; bei Stopp weiter in UC-015.

### UC-004 Monatlich berichten

**Referenz Funktionsbaum:** PS.01.01 Statusbericht erfassen, PS.02.04 Meilensteinplan pflegen, PC.01.03 Kostenprognose aktualisieren, PC.02.03 Risikomassnahme verfolgen, PC.02.04 Projektrisiko erfassen, PC.03.03 KPI-Werte nachführen, PS.05.03 Kommunikationsmassnahme nachführen, PS.03.03 Eskalation behandeln

**Arbeitsraum:** Projekt

#### Beschreibung
- **Ausgangslage:** Der monatliche Stichtag (25.) naht, oder eine wesentliche Entwicklung verlangt eine Meldung ausserhalb des Rhythmus (Q8 Kap. 8.3, 8.4). Das System legt der Projektleitung eine Berichtsaufgabe in den Eingang.
- **Use Case:** PL aktualisiert in einem Durchgang Meilensteine, Kostenprognose, Risiken, KPI-Werte und Kommunikationsmassnahmen und gibt Status, Trend, Abweichungen, Abhängigkeiten und anstehende Entscheide ab. Das System erstellt daraus den Statusbericht der Periode.
- **Resultat:** Statusbericht eingereicht, mit Status, Trend und Vergleich zur Vorperiode; Projektdaten aktualisiert; Dashboard aktuell; Prüfaufgabe bei der UE.
- **User Interfaces:** Eingang; Projektakte, Bereich Bericht; Dashboard-Zeile des Vorhabens (Q6 F7).

#### Beteiligte Akteure
| Akteur | Rolle im Use Case |
|---|---|
| PL | löst aus, aktualisiert die Daten, reicht ein |
| UE | erhält den Bericht zur Prüfung (UC-005) |
| SP | wird bei Status «kritisch» informiert; gibt den Bericht nicht frei |

#### Vorbedingungen
- PL ist angemeldet und für das Vorhaben berechtigt (AM.01.02).
- Vorhaben ist in Phase P0 bis P3 und hat einen freigegebenen Projektvertrag.
- Die Berichtsperiode ist offen.

#### Ablauf

**Standardablauf**

| Schritt | Abzweigung Alternativablauf | Aktion User | Systemverhalten |
|---|---|---|---|
| 1 | A3 | PL öffnet die Berichtsaufgabe im Eingang. | System zeigt die Berichtsmaske mit den Werten der Vorperiode: Phase, Abschluss per, nächster Meilenstein, Status, Trend, dazu Meilensteine, Kosten, Risiken und Kommunikation. |
| 2 | A1 | PL meldet erreichte Meilensteine und aufdatierte Termine. | System speichert im Meilensteinplan und markiert Abweichungen zur Baseline. |
| 3 |  | PL aktualisiert die Kostenprognose. | System zeigt die Prognose gegenüber dem Budget je Phase [OFFEN: Quelle Ist-Kosten]. |
| 4 |  | PL aktualisiert Risiken und Massnahmen. | System speichert im Risikoregister des Vorhabens. |
| 5 |  | PL meldet erledigte Kommunikationsmassnahmen. | System setzt sie auf erledigt. |
| 6 |  | PL erfasst ab der Implementierung die Ist-Werte der Projekt-KPIs. | System speichert sie zum Zielwert. |
| 7 | A2 | PL wählt Status (im Plan/kritisch) und Trend, beurteilt die Abweichungen bei Inhalt, Termin, Ressourcen und Budget und erfasst nächsten Meilenstein, Abhängigkeiten und anstehende Entscheide. | System prüft die Pflichtangaben des Berichts. |
| 8 |  | PL reicht den Bericht ein. | System speichert den Bericht als Stand der Periode, aktualisiert das Dashboard und legt der UE die Prüfaufgabe an; die UE konsolidiert bis Monatsende (UC-005). |

**Alternativablauf**

**A1 Wesentliche Abweichung (ab Schritt 2):** Bedingung: Termine, Kosten oder Umfang weichen wesentlich vom Projektvertrag ab [OFFEN: Schwelle].

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A1.1 |  | System weist darauf hin, dass eine Änderung am Projektvertrag zu beantragen ist. |
| A1.2 | PL startet den Änderungsantrag (UC-007) oder eine Eskalation (UC-006). | System verknüpft Antrag bzw. Eskalation mit dem Bericht. |

Ende: weiter bei Schritt 3.

**A2 Status «kritisch» (ab Schritt 7):** Bedingung: PL wählt den Status «kritisch».

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A2.1 |  | System verlangt Begründung und Massnahme. |
| A2.2 | PL erfasst beides und hält fest, ob ein Entscheid des PRAT nötig ist. | System markiert das Vorhaben im Dashboard, informiert SP und UE und legt bei Entscheidbedarf eine Eskalation an (PS.03.03, UC-006). |

Ende: weiter bei Schritt 8.

**A3 Frist verpasst (ab Schritt 1):** Bedingung: Bis zum 25. ist kein Bericht eingereicht.

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A3.1 |  | System erinnert PL und zeigt der UE den fehlenden Bericht (PS.01.03). |

Ende: weiter bei Schritt 1.

### UC-005 Statusberichte prüfen und nachverfolgen

**Referenz Funktionsbaum:** PS.01.02 Statusbericht prüfen, PS.01.03 Ausstehende Statusberichte nachverfolgen, PS.01.04 Terminabweichungen analysieren

**Arbeitsraum:** Portfolio

#### Beschreibung
- **Ausgangslage:** Bis zum 25. des Monats reichen die Projektleitungen ihre Statusberichte ein (UC-004). Das System legt der UE je Bericht eine Prüfaufgabe in den Eingang.
- **Use Case:** UE prüft die Berichte auf Plausibilität, klärt Rückfragen mit den Projektleitungen, fordert fehlende Berichte ein und analysiert die Terminabweichungen über alle Vorhaben. Bis Monatsende ist das Dashboard konsolidiert; ab dem 1. steht es den Gremien zur Verfügung (Q8 Kap. 8.4).
- **Resultat:** Alle Berichte der Periode geprüft oder als fehlend markiert; Terminabweichungen ausgewiesen; Dashboard final und für die Gremien bereit.
- **User Interfaces:** Eingang; Berichtsübersicht der Periode im Arbeitsraum Portfolio; Abweichungsanalyse; Dashboard.

#### Beteiligte Akteure
| Akteur | Rolle im Use Case |
|---|---|
| UE | prüft, klärt, konsolidiert, schliesst die Periode ab |
| PMO | unterstützt bei der Konsolidierung |
| PL | beantwortet Rückfragen, reicht fehlende Berichte nach |

#### Vorbedingungen
- UE ist angemeldet und für das Portfolio berechtigt (AM.01.02).
- Die Berichtsperiode ist offen.

#### Ablauf

**Standardablauf**

| Schritt | Abzweigung Alternativablauf | Aktion User | Systemverhalten |
|---|---|---|---|
| 1 | A1 | UE öffnet die Berichtsübersicht der Periode. | System zeigt je Vorhaben den Stand (eingereicht, geprüft, ausstehend) mit Status, Trend und Veränderung zur Vorperiode. |
| 2 |  | UE öffnet einen eingereichten Bericht. | System zeigt den Bericht im Vergleich zur Vorperiode und zur Baseline und markiert Auffälligkeiten: Status geändert, Termine verschoben, Prognose über Budget. |
| 3 | A2 | UE prüft die Plausibilität und bestätigt den Bericht. | System setzt den Bericht auf «geprüft». UE wiederholt Schritte 2 und 3 für alle eingereichten Berichte. |
| 4 |  | UE analysiert die Terminabweichungen über alle Vorhaben. | System vergleicht je Vorhaben Baseline und aufdatierte Phasen- und Abschlusstermine und zeigt die Abweichungen nach Grösse sortiert. |
| 5 | A3 | UE schliesst die Periode bis Monatsende ab. | System prüft, dass alle Berichte geprüft sind, finalisiert das Dashboard und stellt es ab dem 1. den Gremien bereit. |

**Alternativablauf**

**A1 Bericht fehlt (ab Schritt 1):** Bedingung: Ein Vorhaben hat bis zum 25. keinen Bericht eingereicht.

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A1.1 | UE fordert den Bericht ein. | System erinnert PL über den Eingang und markiert den Bericht als ausstehend. |

Ende: weiter bei Schritt 1.

**A2 Rückfrage (ab Schritt 3):** Bedingung: Der Bericht ist nicht plausibel.

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A2.1 | UE erfasst die Rückfrage. | System gibt den Bericht an PL zurück. |
| A2.2 | PL beantwortet oder korrigiert und reicht erneut ein. | System legt der UE die Prüfaufgabe erneut an. |

Ende: weiter bei Schritt 2.

**A3 Bericht bleibt aus (ab Schritt 5):** Bedingung: Bei Monatsende fehlt weiterhin ein Bericht.

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A3.1 | UE schliesst die Periode trotzdem ab. | System übernimmt für das Vorhaben die Werte der Vorperiode mit dem Vermerk «nicht gemeldet» [OFFEN: Umgang mit fehlenden Berichten]. |

Ende: Use Case endet.

### UC-006 PRAT-Sitzung vorbereiten und durchführen

**Referenz Funktionsbaum:** PP.04.01 Entscheidungsvorlage vorbereiten, PP.04.02 Portfolioentscheid erfassen, PP.04.05 Gate-Reviews einplanen, PS.02.02 Phasenfreigabe entscheiden, PS.02.03 Meilenstein abnehmen, PS.03.03 Eskalation behandeln, PS.04.02 Vorhaben sistieren oder abbrechen, PC.02.02 Risikolage des Portfolios beurteilen

**Arbeitsraum:** Gremium

#### Beschreibung
- **Ausgangslage:** Die monatliche PRAT-Sitzung steht an. Das konsolidierte Dashboard des Vormonats ist final (UC-005). Eingeplante Gate-Reviews (PP.04.05), gemeldete Eskalationen (PS.03.03) und Änderungsanträge (UC-007) liegen als Traktandenvorschläge im Arbeitsraum Gremium.
- **Use Case:** UE stellt die Traktandenliste zusammen, prüft die Unterlagen und versendet sie spätestens 5 Arbeitstage vor der Sitzung. In der Sitzung berichtet die Programmleitung über das Portfolio, die eingeladenen Projekte stellen ihre Geschäfte vor, der PRAT entscheidet. UE erfasst die Entscheide und versendet das Protokoll innert 2–3 Arbeitstagen.
- **Resultat:** Entscheide je Traktandum erfasst und mit den Vorhaben verknüpft; Phasen, Baselines, Meilensteine und Dashboard nachgeführt; Auflagen als Aufgaben bei den Verantwortlichen; Protokoll versendet.
- **User Interfaces:** Eingang; Arbeitsraum Gremium mit Sitzung, Traktandenliste, Unterlagen und Entscheidmaske; Portfolio-Dashboard und Risikolage aus dem Arbeitsraum Portfolio.

#### Beteiligte Akteure
| Akteur | Rolle im Use Case |
|---|---|
| UE | bereitet vor, versendet Unterlagen, berichtet als Programmleitung, erfasst Entscheide, versendet das Protokoll |
| PRAT | berät und entscheidet |
| PL, CTL | stellen das Geschäft ihres Vorhabens vor |
| SP | hat die Vorlage vorab abgestimmt, vertritt das Vorhaben |

#### Vorbedingungen
- UE ist angemeldet und für das Gremium PRAT berechtigt (AM.01.02).
- Der Sitzungstermin ist im Gremium erfasst (AM.02.04).
- Das Dashboard des Vormonats ist final (UC-005).

#### Ablauf

**Standardablauf**

| Schritt | Abzweigung Alternativablauf | Aktion User | Systemverhalten |
|---|---|---|---|
| 1 |  | UE öffnet die Aufgabe «Sitzung vorbereiten» im Eingang. | System öffnet die Sitzung im Arbeitsraum Gremium mit Traktandenvorschlägen: Portfoliobericht, eingeplante Gate-Reviews, anstehende Meilensteinabnahmen, Eskalationen, Änderungen mit Wirkung auf Scope, Budget oder Ressourcen, Priorisierungs- und Szenarioentscheide. |
| 2 | A1 | UE stellt die Traktandenliste zusammen und lädt je Geschäft PL, CTL und SP ein. | System legt die Traktanden mit Zeitbedarf an, für ein Gate-Review rund 35 Minuten (Präsentation 20, Diskussion 10, Entscheid 5), und informiert die Eingeladenen. |
| 3 | A2 | UE prüft je Traktandum, ob die Unterlagen vollständig sind und den Quality-Check bestanden haben (UC-003). | System zeigt je Traktandum den Stand der Unterlagen. |
| 4 |  | UE stellt den Portfoliobericht zusammen. | System erzeugt ihn aus dem Dashboard: Gesamtstatus, Status und Trend je Vorhaben, Risikolage, Abhängigkeiten, Eskalationen, anstehende Meilensteine, Freigaben und Abnahmen. |
| 5 |  | UE versendet die Unterlagen spätestens 5 Arbeitstage vor der Sitzung. | System stellt Traktandenliste, Portfoliobericht und Gate Review Packets den PRAT-Mitgliedern im Arbeitsraum Gremium bereit und protokolliert den Versand. |
| 6 |  | In der Sitzung berichtet UE über das Portfolio. | System zeigt Dashboard und Risikolage des Portfolios. |
| 7 | A3, A4 | Je Traktandum stellen PL und CTL das Geschäft vor, der PRAT berät und entscheidet, UE erfasst den Entscheid mit Begründung. | System speichert den Entscheid am Traktandum und am Vorhaben und löst die Folgeschritte aus: Gate freigegeben (UC-003), Meilenstein abgenommen, Änderung freigegeben (UC-007), Eskalation erledigt, Priorisierung festgehalten, Vorhaben sistiert oder abgebrochen (UC-015). |
| 8 |  | UE schliesst die Sitzung. | System erzeugt den Protokollentwurf aus Traktanden und Entscheiden und aktualisiert das Dashboard. |
| 9 |  | UE bereinigt das Protokoll und versendet es innert 2–3 Arbeitstagen. | System versendet es an den PRAT und die Beteiligten und schlägt nicht behandelte Traktanden für die nächste Sitzung vor. |

**Alternativablauf**

**A1 Geschäft über den SNS-VR (ab Schritt 2):** Bedingung: Ein Vorhaben in P0 oder P1 legt einen relevanten Meilenstein oder ein Gate bis zur Freigabe von P2 vor.

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A1.1 |  | System markiert das Traktandum «via SNS-VR». |
| A1.2 | UE erfasst in Schritt 7 die Stellungnahme des PRAT. | System legt das Geschäft dem SNS-VR vor; der Entscheid gilt erst mit dem SNS-VR [OFFEN: Ablauf und Erfassung im SNS-VR]. |

Ende: weiter bei Schritt 3.

**A2 Unterlagen fehlen (ab Schritt 3):** Bedingung: Das Gate Review Packet liegt 5 Arbeitstage vor der Sitzung nicht vor oder hat den Quality-Check nicht bestanden.

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A2.1 | UE verschiebt das Traktandum auf die nächste Sitzung. | System informiert PL und SP und plant das Traktandum neu ein. |

Ende: weiter bei Schritt 3 mit dem nächsten Traktandum.

**A3 Zurückgestellt oder mit Auflagen (ab Schritt 7):** Bedingung: Der PRAT stellt das Geschäft zurück oder entscheidet mit Auflagen.

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A3.1 | UE erfasst die Auflagen mit Termin und Verantwortlichen. | System legt die Auflagen als Aufgaben in den Eingang der Verantwortlichen und plant das Traktandum für eine Folgesitzung ein. |

Ende: weiter bei Schritt 7 mit dem nächsten Traktandum.

**A4 Weiterleitung an den VR (ab Schritt 7):** Bedingung: Der PRAT stellt besonderen Entscheidungs- oder Eskalationsbedarf fest.

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A4.1 | UE erfasst die Weiterleitung an den VR. | System markiert das Geschäft und nimmt es in das nächste Quartalsreporting an den VR auf (UC-012) [OFFEN: Weiterleitung auch ausserhalb des Quartalsrhythmus?]. |

Ende: weiter bei Schritt 7 mit dem nächsten Traktandum.

### UC-007 Änderung am Projektvertrag beantragen und entscheiden

**Referenz Funktionsbaum:** PS.03.01 Änderung am Projektvertrag beantragen, PS.03.02 Änderung am Projektvertrag entscheiden, PS.03.04 Vertragsversionen vergleichen

**Arbeitsraum:** Projekt

#### Beschreibung
- **Ausgangslage:** Während einer Phase zeichnet sich eine wesentliche Änderung an Zielen, Umfang, Terminen, Ressourcen oder Budget ab, etwa aus dem Monatsbericht (UC-004 A1). Wesentliche Änderungen sind im Projektvertrag nachzuführen und zur Entscheidung vorzulegen (Q7) [OFFEN: Schwelle für «wesentlich»].
- **Use Case:** PL beantragt die Änderung als neue Vertragsversion mit Begründung und Auswirkungen. Der Sponsor entscheidet; Änderungen an Scope, Budget oder Ressourcen gibt der PRAT frei (Q8 Kap. 8.5). Mit der Freigabe wird die Baseline nachgeführt.
- **Resultat:** Änderung entschieden und begründet; bei Freigabe neue Vertragsversion als Baseline mit dokumentierten Hauptänderungen; Planung und Dashboard aktuell.
- **User Interfaces:** Projektakte mit Änderungsantrag und Versionsvergleich; Eingang; Traktandum im Arbeitsraum Gremium.

#### Beteiligte Akteure
| Akteur | Rolle im Use Case |
|---|---|
| PL | beantragt, beschreibt die Auswirkungen |
| SP | entscheidet oder unterstützt den Antrag an den PRAT |
| UE | traktandiert Anträge für den PRAT |
| PRAT | gibt Änderungen an Scope, Budget oder Ressourcen frei |

#### Vorbedingungen
- PL ist angemeldet und für das Vorhaben berechtigt (AM.01.02).
- Das Vorhaben hat einen freigegebenen Projektvertrag (Baseline).

#### Ablauf

**Standardablauf**

| Schritt | Abzweigung Alternativablauf | Aktion User | Systemverhalten |
|---|---|---|---|
| 1 |  | PL legt einen Änderungsantrag an. | System legt eine neue Vertragsversion als Entwurf an. |
| 2 |  | PL passt die betroffenen Kapitel an und begründet die Änderung. | System zeigt den Vergleich zur Baseline und erzeugt die Hauptänderungen zu Scope, Zeitplan, Ressourcen/Budget, Annahmen und Key-Risiken. |
| 3 |  | PL reicht den Antrag ein. | System legt dem SP eine Entscheidaufgabe in den Eingang. |
| 4 | A1, A2 | SP prüft den Antrag mit dem Versionsvergleich und gibt die Änderung frei. | System speichert den Entscheid, setzt die Version als neue Baseline, aktualisiert Planung und Dashboard und informiert PL und UE. |

**Alternativablauf**

**A1 Wirkung auf Scope, Budget oder Ressourcen (ab Schritt 4):** Bedingung: Die Änderung verändert Scope, Budget oder Ressourcen.

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A1.1 | SP unterstützt den Antrag. | System setzt ihn auf die Traktandenliste des PRAT (UC-006). |
| A1.2 | Der PRAT entscheidet; UE erfasst den Entscheid. | System verfährt bei Freigabe wie in Schritt 4, bei Ablehnung wie in A2. |

Ende: Use Case endet.

**A2 Änderung abgelehnt (ab Schritt 4):** Bedingung: SP oder PRAT lehnen die Änderung ab.

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A2.1 | Die entscheidende Rolle erfasst die Begründung. | System verwirft den Entwurf, die Baseline bleibt unverändert; PL wird informiert. |

Ende: Use Case endet; bei Bedarf Eskalation (UC-006).

### UC-008 Portfolio priorisieren und ausbalancieren

**Referenz Funktionsbaum:** PP.01.02 Bewertungsmodell festlegen, PP.01.03 Portfoliokategorien und Budgetrahmen festlegen, PP.02.01 Vorhaben bewerten, PP.02.02 Vorhaben priorisieren, PP.02.03 Abhängigkeiten zwischen Vorhaben erfassen, PP.03.01 Portfolioszenario erstellen, PP.03.02 Szenario gegen Budget und Kapazität prüfen, PP.03.03 Szenarien vergleichen, PP.03.04 Portfolio in Matrixsicht beurteilen, PC.02.01 Portfoliorisiko erfassen, RK.02.04 Auslastung analysieren

**Arbeitsraum:** Portfolio

#### Beschreibung
- **Ausgangslage:** Neue Vorhaben sind zur Initialisierung freigegeben, Budget- oder Kapazitätsrahmen ändern sich, oder der Jahreszyklus verlangt eine Neupriorisierung (Q6 F2). UE bereitet die Priorisierung für das zuständige Gremium vor.
- **Use Case:** UE bewertet die Vorhaben nach den Kriterien des Bewertungsmodells, erfasst Abhängigkeiten und Portfoliorisiken, beurteilt das Portfolio in der Matrixsicht und spielt Szenarien gegen Budget und Kapazität durch. Das Gremium entscheidet über Rangfolge und Szenario.
- **Resultat:** Bewertung je Vorhaben, Rangfolge je Portfolio und gewähltes Szenario entschieden und dokumentiert; Wasserlinie sichtbar; betroffene Sponsoren und Projektleitungen informiert.
- **User Interfaces:** Arbeitsraum Portfolio: Liste, Bewertungsmaske, Matrix (Nutzen/Risiko, Ressourcen/Nutzen), Szenariovergleich mit Wasserlinie, Auslastung; Traktandum im Arbeitsraum Gremium.

#### Beteiligte Akteure
| Akteur | Rolle im Use Case |
|---|---|
| UE | bewertet, erstellt Szenarien, bereitet den Entscheid vor |
| PRAT | legt das Bewertungsmodell fest, entscheidet Rangfolge und Szenario |
| FI | liefert Budgetrahmen |
| RM | liefert Kapazitätsangebot und Auslastung |

#### Vorbedingungen
- UE ist angemeldet und für das Portfolio berechtigt (AM.01.02).
- Die Vorhaben haben Business Case und Ressourcenbedarf (UC-002).

#### Ablauf

**Standardablauf**

| Schritt | Abzweigung Alternativablauf | Aktion User | Systemverhalten |
|---|---|---|---|
| 1 | A1 | UE öffnet die Priorisierung des Portfolios. | System zeigt die Vorhaben mit Phase, Business Case, Ressourcenbedarf, Status und bisheriger Rangfolge. |
| 2 |  | UE bewertet je Vorhaben Strategiebeitrag, Transformationsrelevanz, betroffene Bereiche, Komplexität und Abhängigkeiten, Finanzierungsbedarf, Ressourcenverfügbarkeit sowie Kommunikations- und Change-Aufwand. | System speichert die Bewertung je Kriterium [OFFEN: Einschätzung je Kriterium oder gewichteter Score, V10]. |
| 3 |  | UE erfasst Abhängigkeiten zwischen Vorhaben und vorhabenübergreifende Risiken. | System zeigt sie in Matrix und Szenarien. |
| 4 |  | UE beurteilt das Portfolio in der Matrixsicht. | System ordnet die Vorhaben nach Nutzen und Risiko in die Felder priorisieren, rasch umsetzen, opportunistisch umsetzen und hinterfragen ein. |
| 5 |  | UE erstellt ein oder mehrere Szenarien mit Reihenfolge und Startzeitpunkten. | System rechnet je Szenario Budget- und Kapazitätsbedarf gegen den Rahmen, zieht die Wasserlinie und zeigt Engpässe; der Ist-Stand des Portfolios bleibt unverändert. |
| 6 |  | UE vergleicht die Szenarien und wählt einen Antrag. | System stellt die Szenarien nach Kosten, Nutzen, Risiko und Strategiebeitrag nebeneinander und erzeugt die Entscheidungsvorlage. |
| 7 |  | UE traktandiert den Antrag (UC-006). | System setzt ihn auf die Traktandenliste des zuständigen Gremiums. |
| 8 | A2 | Das Gremium entscheidet über Rangfolge und Szenario; UE erfasst den Entscheid. | System übernimmt Rangfolge und Szenario als Ist-Stand des Portfolios und informiert die betroffenen Sponsoren und Projektleitungen. |

**Alternativablauf**

**A1 Bewertungsmodell oder Budgetrahmen anpassen (ab Schritt 1):** Bedingung: Kriterien oder Portfoliokategorien mit Budgetrahmen sind neu festzulegen, etwa im Jahreszyklus.

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A1.1 | UE erarbeitet mit FI Kriterien und Budgetrahmen je Kategorie [OFFEN: Budgetrahmen je Kategorie]. | System speichert sie als Entwurf. |
| A1.2 | Der PRAT gibt frei; UE erfasst den Entscheid. | System setzt das Modell für folgende Bewertungen in Kraft; frühere Bewertungen bleiben nachvollziehbar. |

Ende: weiter bei Schritt 1.

**A2 Vorhaben unter der Wasserlinie (ab Schritt 8):** Bedingung: Ein laufendes Vorhaben liegt im gewählten Szenario unter der Wasserlinie.

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A2.1 | Das Gremium entscheidet über Zurückstellung, Sistierung oder Abbruch; UE erfasst den Entscheid. | System leitet bei Sistierung oder Abbruch UC-015 ein. |

Ende: Use Case endet.

### UC-009 Ressourcen planen und zuteilen

**Referenz Funktionsbaum:** RK.01.01 Kapazitätsangebot planen, RK.01.02 Personal- und Abwesenheitsdaten übernehmen, RK.02.02 Ressourcen zuteilen, RK.02.03 Ressourcenkonflikt auflösen, RK.02.04 Auslastung analysieren

**Arbeitsraum:** Portfolio

#### Beschreibung
- **Ausgangslage:** Vorhaben melden Ressourcenbedarf als Grösse S, M oder L oder in FTE und Monaten je Rolle und Phase (UC-002, UC-003). RM plant das Kapazitätsangebot und teilt Personen zu [OFFEN: Rolle RM, Planung je Pool].
- **Use Case:** RM hält das Kapazitätsangebot aktuell, deckt den angemeldeten Bedarf mit Personen, löst Überbuchungen nach Priorität auf und analysiert die Auslastung.
- **Resultat:** Bedarf der Vorhaben gedeckt oder Lücken ausgewiesen; Konflikte nach Priorität bereinigt; Auslastung je Pool sichtbar.
- **User Interfaces:** Arbeitsraum Portfolio: Kapazitätsplanung je Pool, Bedarfsliste, Zuteilung, Auslastung; Eingang.

#### Beteiligte Akteure
| Akteur | Rolle im Use Case |
|---|---|
| RM | plant das Angebot, teilt zu, löst Konflikte |
| UE | bringt die Priorität ein, unterstützt bei Konflikten |
| PL | meldet Bedarf, erhält die Zuteilung |

#### Vorbedingungen
- RM ist angemeldet und berechtigt (AM.01.02).
- Ressourcenpools sind definiert [OFFEN].
- Vorhaben haben Bedarf gemeldet (RK.02.01, RK.02.05).

#### Ablauf

**Standardablauf**

| Schritt | Abzweigung Alternativablauf | Aktion User | Systemverhalten |
|---|---|---|---|
| 1 |  | RM öffnet die Kapazitätsplanung. | System zeigt je Pool das Kapazitätsangebot aus Personal- und Abwesenheitsdaten und den angemeldeten Bedarf der Vorhaben [OFFEN: Übernahme aus dem HR-System]. |
| 2 |  | RM legt die für Vorhaben verfügbare Kapazität je Pool und Periode fest. | System speichert das Angebot. |
| 3 |  | RM öffnet einen offenen Bedarf. | System zeigt Rolle, Umfang, Zeitraum und Priorität des Vorhabens sowie Personen mit freier Kapazität. |
| 4 | A1, A2 | RM teilt Personen zu. | System bucht die Kapazität, informiert PL und die Zugeteilten und aktualisiert die Auslastung. |
| 5 |  | RM analysiert die Auslastung. | System zeigt Engpässe und Unterauslastung je Pool und Periode, auch für Szenarien (UC-008). |

**Alternativablauf**

**A1 Ressourcenkonflikt (ab Schritt 4):** Bedingung: Die Zuteilung überbucht eine Person oder einen Pool.

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A1.1 |  | System zeigt die beteiligten Vorhaben mit ihrer Priorität. |
| A1.2 | RM löst den Konflikt mit der UE nach Priorität. | System passt die Zuteilungen an und informiert die betroffenen Projektleitungen. |

Ende: weiter bei Schritt 5.

**A2 Bedarf nicht deckbar (ab Schritt 4):** Bedingung: Für den Bedarf ist keine Kapazität verfügbar.

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A2.1 | RM meldet die Lücke. | System markiert den Bedarf als ungedeckt und zeigt ihn im Dashboard und in der Priorisierung (UC-008). |

Ende: weiter bei Schritt 5.

### UC-010 Portfoliofinanzen überwachen

**Referenz Funktionsbaum:** PC.01.02 Ist-Kosten übernehmen, PC.01.04 Budgetabweichungen analysieren, PC.01.05 Budgetbedarf in den Budgetprozess übergeben

**Arbeitsraum:** Portfolio

#### Beschreibung
- **Ausgangslage:** Die Vorhaben führen Kosten je Phase und eine Kostenprognose (UC-002, UC-004). Ist-Kosten sollen ohne Handerfassung aus dem ERP kommen [OFFEN: Quelle der Ist-Kosten].
- **Use Case:** Das System übernimmt die Ist-Kosten. FI und UE analysieren Budgetabweichungen über das Portfolio und klären Ursachen. Für den Budgetprozess leiten GL und FI aus den Kosten je Phase den Jahresbedarf CAPEX und OPEX ab.
- **Resultat:** Ist-Kosten aktuell; Abweichungen je Vorhaben und Portfolio ausgewiesen und begründet; Jahresbedarf an den Budgetprozess übergeben.
- **User Interfaces:** Arbeitsraum Portfolio: Finanzübersicht mit Budget, Ist und Prognose je Vorhaben und Phase; Abweichungsanalyse; Export für den Budgetprozess.

#### Beteiligte Akteure
| Akteur | Rolle im Use Case |
|---|---|
| FI | analysiert, leitet den Jahresbedarf ab |
| UE | analysiert mit, klärt Ursachen mit der Projektleitung |
| GL | übergibt den Bedarf an den Budgetprozess |
| PL | begründet Abweichungen |

#### Vorbedingungen
- FI ist angemeldet und berechtigt (AM.01.02).
- Die Vorhaben haben Kosten je Phase (PC.01.01).
- Die Schnittstelle zum ERP ist konfiguriert (AM.03.02).

#### Ablauf

**Standardablauf**

| Schritt | Abzweigung Alternativablauf | Aktion User | Systemverhalten |
|---|---|---|---|
| 1 |  |  | System übernimmt periodisch die Ist-Kosten je Vorhaben aus dem ERP [OFFEN: Rhythmus und Kostenzuordnung]. |
| 2 | A1 | FI öffnet die Finanzübersicht des Portfolios. | System zeigt je Vorhaben Budget je Phase, Ist-Kosten und Prognose und markiert Überschreitungen. |
| 3 | A2 | FI und UE analysieren die Abweichungen. | System zeigt die Abweichungen nach Vorhaben, Phase und CAPEX/OPEX mit Verlauf. |
| 4 |  | UE klärt die Ursachen mit der Projektleitung und hält sie fest. | System speichert die Begründung zum Vorhaben. |
| 5 |  | FI leitet für den Budgetprozess den Jahresbedarf ab. | System rechnet aus Kosten je Phase und Terminplanung den Bedarf je Jahr, CAPEX und OPEX, je Vorhaben und Portfolio [OFFEN: Umrechnung Phase zu Jahr]. |
| 6 |  | GL und FI übergeben den Bedarf an den Budgetprozess. | System erzeugt den Export und protokolliert die Übergabe. |

**Alternativablauf**

**A1 Ist-Kosten fehlen (ab Schritt 2):** Bedingung: Für ein Vorhaben liegen keine Ist-Kosten aus dem ERP vor.

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A1.1 | FI klärt die Zuordnung des Vorhabens im ERP. | System übernimmt die Kosten beim nächsten Lauf. |

Ende: weiter bei Schritt 3.

**A2 Wesentliche Überschreitung (ab Schritt 3):** Bedingung: Die Prognose eines Vorhabens überschreitet das Budget wesentlich [OFFEN: Schwelle].

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A2.1 | UE fordert PL auf, eine Änderung zu beantragen oder zu eskalieren. | System legt PL die Aufgabe an (UC-007, UC-006). |

Ende: weiter bei Schritt 4.

### UC-011 Ziele im Jahreszyklus festlegen

**Referenz Funktionsbaum:** ZM.01.01 Strategische Handlungsfelder pflegen, ZM.01.02 Strategische Ziele festlegen, ZM.02.01 Jahresziele ableiten, ZM.02.02 Jahresziele freigeben, ZM.02.03 Hauptaktivitäten festlegen, ZM.02.04 Zielmetrik definieren, PP.04.03 Portfolio-Roadmap publizieren, PC.01.05 Budgetbedarf in den Budgetprozess übergeben

**Arbeitsraum:** Ziele

#### Beschreibung
- **Ausgangslage:** Im Jahreszyklus aktualisiert der VR mit der GL Strategie und Mehrjahresziele; danach setzt die GL die Ziele für das Folgejahr (Q6 F2). Grundlage ist die Strategie 2035 mit fünf Handlungsfeldern (Q9).
- **Use Case:** GL pflegt Handlungsfelder und strategische Ziele, leitet die Jahresziele ab und legt Hauptaktivitäten mit Verantwortlichen und je Ziel eine Metrik fest. Der VR gibt die Jahresziele frei. Daraus entstehen die Portfolio-Roadmap und der Input für den Budgetprozess.
- **Resultat:** Handlungsfelder, strategische Ziele und Jahresziele mit Metrik freigegeben; Hauptaktivitäten und Vorhaben zugeordnet; Roadmap publiziert; Budgetbedarf übergeben.
- **User Interfaces:** Arbeitsraum Ziele mit der Hierarchie Handlungsfeld, strategisches Ziel, Jahresziel, Hauptaktivität, Projekt; Freigabemaske; Roadmap im Arbeitsraum Portfolio.

#### Beteiligte Akteure
| Akteur | Rolle im Use Case |
|---|---|
| GL | pflegt Ziele, leitet Jahresziele ab, legt Hauptaktivitäten und Metriken fest |
| VR | aktualisiert die Strategie mit der GL, gibt die Jahresziele frei |
| UE | unterstützt den Zielprozess, erfasst Freigaben, publiziert die Roadmap |
| FI | übergibt mit der GL den Budgetbedarf |

#### Vorbedingungen
- GL ist angemeldet und für den Arbeitsraum Ziele berechtigt (AM.01.02).
- Die Handlungsfelder sind erfasst.
- Der Jahresrückblick des Vorjahres liegt vor, sofern vorhanden (UC-013).

#### Ablauf

**Standardablauf**

| Schritt | Abzweigung Alternativablauf | Aktion User | Systemverhalten |
|---|---|---|---|
| 1 | A1 | GL öffnet den Zielzyklus des Folgejahres. | System zeigt die Handlungsfelder mit Leitsatz und Stossrichtungen, die strategischen Ziele mit Zielerreichung und die zugeordneten Vorhaben. |
| 2 |  | GL aktualisiert bei Bedarf die strategischen Ziele. | System versioniert die Ziele; frühere Stände bleiben nachvollziehbar. |
| 3 |  | GL leitet je strategischem Ziel die Jahresziele ab. | System legt die Jahresziele unter dem strategischen Ziel an. |
| 4 |  | GL legt je Jahresziel Hauptaktivitäten mit Verantwortlichen fest. | System speichert sie und erlaubt, Vorhaben zuzuordnen; neue Vorhaben lassen sich als Projektidee anstossen (UC-001). |
| 5 |  | GL definiert je Ziel eine Metrik mit Zielwert. | System prüft, dass jedes Ziel eine Metrik hat. |
| 6 |  | GL legt die Jahresziele dem VR zur Freigabe vor. | System setzt die Jahresziele auf «zur Freigabe». |
| 7 | A2 | Der VR gibt die Jahresziele frei; UE erfasst die Freigabe. | System setzt die Jahresziele in Kraft. |
| 8 |  | UE publiziert die Portfolio-Roadmap. | System erzeugt die Roadmap aus Zielen, Hauptaktivitäten und Vorhaben und stellt sie intern bereit. |
| 9 |  | GL und FI übergeben den Budgetbedarf an den Budgetprozess (UC-010). | System stellt den Jahresbedarf der Vorhaben bereit. |

**Alternativablauf**

**A1 Strategie-Aktualisierung (ab Schritt 1):** Bedingung: Der VR aktualisiert die strategische Richtung oder die Handlungsfelder.

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A1.1 | UE erfasst die geänderten Handlungsfelder, Leitsätze und Stossrichtungen. | System versioniert sie und zeigt die betroffenen Ziele und Vorhaben. |

Ende: weiter bei Schritt 2.

**A2 Freigabe verweigert (ab Schritt 7):** Bedingung: Der VR verlangt Anpassungen.

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A2.1 | UE erfasst die Rückmeldungen. | System setzt die Jahresziele auf «in Arbeit» zurück und informiert die GL. |

Ende: weiter bei Schritt 3.

### UC-012 Quartalsreporting an den VR erstellen

**Referenz Funktionsbaum:** ZM.03.01 Zielerreichung erfassen, ZM.03.02 Quartalsreporting an den VR erstellen, PC.04.02 Portfoliobericht erstellen

**Arbeitsraum:** Ziele

#### Beschreibung
- **Ausgangslage:** Ein Quartal ist abgeschlossen. Der PRAT berichtet dem VR quartalsweise über den Stand des Transformationsprogramms (Q8 Kap. 8.7).
- **Use Case:** GL und UE erfassen die Zielerreichung. UE erstellt aus Dashboard und Zielerreichung das Quartalsreporting, der PRAT verabschiedet es und legt es dem VR vor.
- **Resultat:** Zielerreichung je Ziel nachgeführt; Quartalsreporting verabschiedet und dem VR vorgelegt; Rückmeldungen und Aufträge des VR erfasst.
- **User Interfaces:** Arbeitsraum Ziele mit Zielerreichung; Berichtsentwurf; Eingang; Traktandum im Arbeitsraum Gremium.

#### Beteiligte Akteure
| Akteur | Rolle im Use Case |
|---|---|
| UE | erfasst die Zielerreichung mit, erstellt den Bericht |
| GL | beurteilt die Zielerreichung |
| PRAT | verabschiedet den Bericht, berichtet dem VR |
| VR | nimmt Kenntnis, steuert nach |

#### Vorbedingungen
- UE ist angemeldet und berechtigt (AM.01.02).
- Das Dashboard zum Quartalsende ist final (UC-005).
- Die Ziele haben eine Metrik (UC-011).

#### Ablauf

**Standardablauf**

| Schritt | Abzweigung Alternativablauf | Aktion User | Systemverhalten |
|---|---|---|---|
| 1 |  | UE öffnet die Aufgabe «Quartalsreporting» im Eingang. | System zeigt je Ziel Metrik, Zielwert und letzten Stand. |
| 2 |  | GL und UE erfassen die Zielerreichung je Ziel. | System speichert den Stand mit Datum und zeigt den Fortschritt. |
| 3 |  | UE erstellt den Bericht. | System erzeugt den Entwurf aus Dashboard und Zielerreichung: Gesamtstatus mit Fortschritten und Meilensteinen, wesentliche Entwicklungen, kritische Portfoliorisiken, strategische Abhängigkeiten und Eskalationen, finanzielle und organisatorische Auswirkungen sowie die zur Weiterleitung markierten Geschäfte (UC-006 A4). |
| 4 |  | UE ergänzt Kommentare und traktandiert den Bericht im PRAT (UC-006). | System setzt ihn auf die Traktandenliste. |
| 5 | A1 | Der PRAT verabschiedet den Bericht; UE erfasst den Entscheid. | System setzt den Bericht auf «verabschiedet» und stellt ihn dem VR bereit. |
| 6 |  | UE erfasst Rückmeldungen und Aufträge des VR. | System speichert sie und legt Aufträge als Aufgaben bei den Verantwortlichen an. |

**Alternativablauf**

**A1 Anpassungen verlangt (ab Schritt 5):** Bedingung: Der PRAT verlangt Anpassungen am Bericht.

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A1.1 | UE erfasst die Rückmeldungen. | System setzt den Bericht auf «in Arbeit» zurück. |

Ende: weiter bei Schritt 3.

### UC-013 Jahresrückblick auswerten

**Referenz Funktionsbaum:** ZM.03.03 Jahresrückblick auswerten, PS.04.03 Lessons Learned erfassen

**Arbeitsraum:** Gremium

#### Beschreibung
- **Ausgangslage:** Das Jahr geht zu Ende. Im Q4 wertet der PRAT Ergebnisse und Erkenntnisse aus und plant den nächsten Zyklus (Q6 F2).
- **Use Case:** UE stellt die Jahresauswertung zusammen: Zielerreichung, abgeschlossene, abgebrochene und laufende Vorhaben und die Lessons Learned des Jahres. Der PRAT wertet sie aus und hält Erkenntnisse und Massnahmen für den nächsten Zyklus fest.
- **Resultat:** Jahresrückblick dokumentiert; Erkenntnisse und Massnahmen für den nächsten Zielzyklus festgehalten (UC-011).
- **User Interfaces:** Arbeitsraum Gremium mit Jahresauswertung; Arbeitsraum Ziele; Sammlung der Lessons Learned.

#### Beteiligte Akteure
| Akteur | Rolle im Use Case |
|---|---|
| UE | stellt die Auswertung zusammen, erfasst die Ergebnisse |
| PRAT | wertet aus, legt Massnahmen fest |
| PL | liefern Lessons Learned nach |

#### Vorbedingungen
- UE ist angemeldet und berechtigt (AM.01.02).
- Die Zielerreichung des Q4 ist erfasst (UC-012).

#### Ablauf

**Standardablauf**

| Schritt | Abzweigung Alternativablauf | Aktion User | Systemverhalten |
|---|---|---|---|
| 1 |  | UE öffnet die Aufgabe «Jahresrückblick» im Eingang. | System zeigt die Zielerreichung des Jahres, die abgeschlossenen, abgebrochenen und laufenden Vorhaben und die Lessons Learned des Jahres. |
| 2 | A1 | UE prüft, ob für alle abgeschlossenen Vorhaben Lessons Learned vorliegen. | System zeigt die Vorhaben ohne Lessons Learned. |
| 3 |  | UE stellt die Auswertung zusammen und traktandiert sie im PRAT (UC-006). | System erzeugt die Jahresauswertung und setzt sie auf die Traktandenliste. |
| 4 |  | Der PRAT wertet aus; UE erfasst Erkenntnisse und Massnahmen für den nächsten Zyklus. | System speichert sie und zeigt sie im Zielzyklus des Folgejahres (UC-011). |

**Alternativablauf**

**A1 Lessons Learned fehlen (ab Schritt 2):** Bedingung: Für abgeschlossene Vorhaben fehlen Lessons Learned.

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A1.1 | UE fordert sie an. | System legt den Projektleitungen eine Aufgabe in den Eingang. |
| A1.2 | PL erfassen die Lessons Learned. | System speichert sie zum Vorhaben. |

Ende: weiter bei Schritt 3.

### UC-014 Portfolio auswerten

**Referenz Funktionsbaum:** PC.04.01 Portfolio-Dashboard einsehen, PC.04.02 Portfoliobericht erstellen, PC.04.03 Ad-hoc-Auswertung erstellen, PC.02.02 Risikolage des Portfolios beurteilen

**Arbeitsraum:** Portfolio

#### Beschreibung
- **Ausgangslage:** Ein Gremium, ein Sponsor oder die UE will den Stand eines Portfolios überblicken oder eine spezifische Frage beantworten.
- **Use Case:** Die Nutzenden sehen das Dashboard ihrer Portfolioebene und die Risikolage. UE erstellt den periodischen Portfoliobericht für das Gremium; UE und FI beantworten spezifische Fragen mit Ad-hoc-Auswertungen.
- **Resultat:** Überblick gewonnen; Portfoliobericht oder Auswertung erstellt und bei Bedarf exportiert.
- **User Interfaces:** Arbeitsraum Portfolio: Dashboard, Funnel nach Phase, Matrix, Risikolage, Auswertungen mit Filtern und Export.

#### Beteiligte Akteure
| Akteur | Rolle im Use Case |
|---|---|
| PRAT, GLPA, DIR | sehen Dashboard und Bericht ihrer Portfolioebene |
| UE | erstellt Portfoliobericht und Auswertungen |
| FI | erstellt Finanzauswertungen |

#### Vorbedingungen
- Die Nutzenden sind angemeldet und sehen nur Portfolios gemäss ihrer Berechtigung (AM.01.02).
- Das Dashboard der Periode ist final (UC-005).

#### Ablauf

**Standardablauf**

| Schritt | Abzweigung Alternativablauf | Aktion User | Systemverhalten |
|---|---|---|---|
| 1 | A1 | Nutzende öffnen das Dashboard und wählen die Portfolioebene. | System zeigt die berechtigten Portfolios mit Status, Trend, Phase, nächstem Meilenstein und Verantwortlichen je Vorhaben, wahlweise als Liste, Funnel nach Phase oder Matrix. |
| 2 |  | Nutzende öffnen die Risikolage. | System zeigt Projekt- und Portfoliorisiken mit Bewertung und Massnahmen sowie Abhängigkeiten und Eskalationen. |
| 3 | A2 | UE erstellt den Portfoliobericht der Periode für das Gremium. | System erzeugt den Bericht aus dem Dashboard und stellt ihn dem Gremium bereit. |

**Alternativablauf**

**A1 Vorhaben im Detail (ab Schritt 1):** Bedingung: Nutzende wollen ein einzelnes Vorhaben genauer sehen.

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A1.1 | Nutzende öffnen das Vorhaben. | System öffnet die Projektakte lesend. |

Ende: weiter bei Schritt 1.

**A2 Ad-hoc-Auswertung (ab Schritt 3):** Bedingung: Eine spezifische Frage ist zu beantworten.

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A2.1 | UE oder FI wählt Filter, Kennzahlen und Gruppierung. | System zeigt das Ergebnis und bietet einen Export an. |

Ende: Use Case endet.

### UC-015 Vorhaben abschliessen oder abbrechen

**Referenz Funktionsbaum:** PS.04.01 Vorhaben abschliessen, PS.04.02 Vorhaben sistieren oder abbrechen, PS.04.03 Lessons Learned erfassen, PC.03.02 Nutzenrealisierung überprüfen, PC.03.04 Business Case fortschreiben

**Arbeitsraum:** Projekt

#### Beschreibung
- **Ausgangslage:** Das Vorhaben hat die Phase P4 Abschluss erreicht, oder das Gremium hat entschieden, es zu sistieren oder abzubrechen (UC-006, UC-008).
- **Use Case:** PL erstellt den Abschlussbericht mit Zielerreichung, Business Case Abschluss, offenen Punkten, Übergabe an den Betrieb und Lessons Learned. Sponsor und UE überprüfen die Nutzenrealisierung. Am Exit-Gate P4 entscheidet das Gremium über den formellen Abschluss (Q8 Kap. 7.5).
- **Resultat:** Vorhaben formell abgeschlossen, sistiert oder abgebrochen; Abschlussbericht und Business Case Abschluss P4 gespeichert; Ressourcen freigegeben; Lessons Learned verfügbar; Dashboard aktuell.
- **User Interfaces:** Projektakte, Bereich Abschluss; Eingang; Traktandum im Arbeitsraum Gremium.

#### Beteiligte Akteure
| Akteur | Rolle im Use Case |
|---|---|
| PL | erstellt Abschlussbericht und Lessons Learned |
| SP, UE | überprüfen die Nutzenrealisierung |
| PRAT | entscheidet am Exit-Gate, sistiert oder bricht ab |
| UE | traktandiert das Exit-Gate |

#### Vorbedingungen
- PL ist angemeldet und für das Vorhaben berechtigt (AM.01.02).
- Das Vorhaben ist in P4, oder ein Entscheid zu Sistierung oder Abbruch ist erfasst.

#### Ablauf

**Standardablauf**

| Schritt | Abzweigung Alternativablauf | Aktion User | Systemverhalten |
|---|---|---|---|
| 1 | A1 | PL öffnet die Aufgabe «Abschluss» im Eingang. | System zeigt Ziele, KPIs mit Ziel- und Ist-Werten, Business Case, Meilensteine und offene Punkte des Vorhabens. |
| 2 |  | PL erfasst die Zielerreichung und den Business Case Abschluss P4 mit Kosten und Nutzen. | System vergleicht mit Baseline und Zielwerten. |
| 3 |  | SP und UE beurteilen die Nutzenrealisierung. | System speichert die Beurteilung. |
| 4 |  | PL erfasst die Übergabe an Betrieb und Linie, offene Punkte mit Verantwortlichen und die Lessons Learned. | System speichert sie; die Lessons Learned stehen künftigen Vorhaben und dem Jahresrückblick zur Verfügung (UC-013). |
| 5 |  | PL reicht den Abschlussbericht ein; UE traktandiert das Exit-Gate P4 (UC-006). | System erzeugt den Abschlussbericht und setzt ihn auf die Traktandenliste. |
| 6 | A2 | Das Gremium nimmt den Abschlussbericht ab und schliesst das Vorhaben formell; UE erfasst den Entscheid. | System setzt das Vorhaben auf «abgeschlossen», gibt zugeteilte Ressourcen frei, archiviert die Projektakte lesend und aktualisiert das Dashboard. |

**Alternativablauf**

**A1 Sistieren oder abbrechen (ab Schritt 1):** Bedingung: Das Gremium hat entschieden, das Vorhaben zu sistieren oder abzubrechen.

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A1.1 | PL erfasst Stand, offene Punkte und Lessons Learned. | System speichert sie. |
| A1.2 |  | System setzt das Vorhaben auf «sistiert» oder «abgebrochen», gibt Ressourcen frei und aktualisiert Dashboard und Szenarien. |

Ende: Use Case endet [OFFEN: Wiederaufnahme sistierter Vorhaben].

**A2 Abschluss nicht abgenommen (ab Schritt 6):** Bedingung: Das Gremium verlangt Nacharbeiten.

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A2.1 | UE erfasst die Auflagen. | System legt PL die Aufgaben in den Eingang. |

Ende: weiter bei Schritt 2.

### UC-016 Benutzer, Rollen und Stellvertretungen verwalten

**Referenz Funktionsbaum:** AM.01.01 Benutzer verwalten, AM.01.02 Rolle mit Berechtigungen definieren, AM.01.03 Stellvertretung regeln

**Arbeitsraum:** Administration

#### Beschreibung
- **Ausgangslage:** Personen treten ein, wechseln die Funktion oder übernehmen eine Rolle in einem Vorhaben oder Gremium.
- **Use Case:** ADM verwaltet Benutzer und Rollen der Programm- und Projektebene mit ihren Berechtigungen. Alle regeln ihre Stellvertretung, damit Freigaben bei Abwesenheit nicht liegen bleiben.
- **Resultat:** Benutzer mit Rollen und Berechtigungen aktuell; Stellvertretungen geregelt; Änderungen protokolliert.
- **User Interfaces:** Administration: Benutzer, Rollen, Berechtigungen; Profil mit Stellvertretung.

#### Beteiligte Akteure
| Akteur | Rolle im Use Case |
|---|---|
| ADM | verwaltet Benutzer und Rollen |
| alle | regeln ihre Stellvertretung |

#### Vorbedingungen
- ADM ist angemeldet und berechtigt.
- Die Organisationseinheiten sind erfasst (UC-017).

#### Ablauf

**Standardablauf**

| Schritt | Abzweigung Alternativablauf | Aktion User | Systemverhalten |
|---|---|---|---|
| 1 | A1 | ADM legt einen Benutzer an oder öffnet einen bestehenden. | System zeigt Personendaten, Organisationseinheit und Rollen [OFFEN: Übernahme aus HR-System oder Verzeichnisdienst]. |
| 2 | A2 | ADM teilt Rollen zu: Programmrollen wie PRAT, UE oder PMO, Projektrollen wie SP, PL, CTL oder Kernteam je Vorhaben, Gremienrollen und Administration. | System leitet die Berechtigungen aus den Rollen ab; Projektrollen gelten nur für das jeweilige Vorhaben. |
| 3 |  | ADM speichert. | System protokolliert die Änderung (AM.03.03) und informiert den Benutzer. |
| 4 |  | Ein Benutzer erfasst in seinem Profil eine Stellvertretung mit Zeitraum. | System stellt Aufgaben im Zeitraum auch der Stellvertretung in den Eingang und protokolliert deren Freigaben als Stellvertretung. |

**Alternativablauf**

**A1 Zugang entziehen (ab Schritt 1):** Bedingung: Eine Person verlässt die Organisation oder gibt eine Rolle ab.

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A1.1 | ADM entzieht Zugang oder Rolle. | System zeigt offene Aufgaben und Rollen in Vorhaben, die neu zu besetzen sind, und sperrt den Zugang. |

Ende: Use Case endet.

**A2 Rolle definieren (ab Schritt 2):** Bedingung: Eine Rolle fehlt, oder ihre Berechtigungen ändern sich.

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A2.1 | ADM definiert die Rolle mit Berechtigungen je Arbeitsraum und Objekt. | System speichert sie und wendet sie auf alle Inhaber an. |

Ende: weiter bei Schritt 2.

### UC-017 Stammdaten und Governance konfigurieren

**Referenz Funktionsbaum:** AM.02.01 Organisationseinheiten verwalten, AM.02.02 Codetabellen pflegen, AM.02.03 Phasenmodell und Gates konfigurieren, AM.02.04 Portfolioebenen und Gremien konfigurieren

**Arbeitsraum:** Administration

#### Beschreibung
- **Ausgangslage:** Das System wird eingeführt, oder Organisation, Governance oder PM-Handbuch ändern sich.
- **Use Case:** ADM pflegt Organisationseinheiten und Codetabellen. UE bildet Phasenmodell, Gates, Leitfragen und Standard-Lieferergebnisse sowie Portfolioebenen, Gremien und Gremienweg nach dem PM-Handbuch ab.
- **Resultat:** Konfiguration entspricht PM-Handbuch und Organisation; Änderungen versioniert und protokolliert.
- **User Interfaces:** Administration: Organisation, Codetabellen, Phasenmodell, Portfolios und Gremien.

#### Beteiligte Akteure
| Akteur | Rolle im Use Case |
|---|---|
| ADM | pflegt Stammdaten, setzt Versionen in Kraft |
| UE | verantwortet Phasenmodell und Governance gemäss PM-Handbuch |

#### Vorbedingungen
- ADM und UE sind angemeldet und berechtigt (AM.01.02).

#### Ablauf

**Standardablauf**

| Schritt | Abzweigung Alternativablauf | Aktion User | Systemverhalten |
|---|---|---|---|
| 1 |  | ADM pflegt die Organisationseinheiten inklusive Direktionen. | System speichert die Hierarchie; Vorhaben, Benutzer und Portfolios verweisen darauf. |
| 2 |  | ADM pflegt die Codetabellen: Status (im Plan, kritisch), Trend (aufwärts, gleichbleibend, abwärts), Grössen S, M, L, Projektkategorien und weitere Auswahlwerte. | System speichert sie; nicht mehr verwendete Werte werden deaktiviert statt gelöscht. |
| 3 |  | UE bildet das Phasenmodell ab: Phasen P0 bis P4, Gates, Leitfragen je Wertestrom, Standard-Lieferergebnisse und -Meilensteine je Phase sowie Pflichtangaben des Projektvertrags je Phase. | System speichert das Phasenmodell als neue Version [OFFEN: Pflichtfelder je Phase]. |
| 4 | A1 | UE bildet Portfolioebenen und Gremien ab: drei Portfolios mit Gremium, Gremienweg je Phase und Kategorie, Sitzungsrhythmus und Dashboard. | System speichert sie und wendet den Gremienweg bei der Traktandierung an (UC-006). |
| 5 |  | ADM setzt die neue Version in Kraft. | System protokolliert die Änderung [OFFEN: Gilt eine neue Version auch für laufende Phasen?]. |

**Alternativablauf**

**A1 Portfolio einer Direktion (ab Schritt 4):** Bedingung: Für das Portfolio einer Direktion gelten keine Vorgaben des PM-Handbuchs.

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A1.1 | UE konfiguriert das Portfolio ohne Pflicht-Gates und Pflicht-Reporting. | System lässt die Direktion Phasen, Gates und Berichte freiwillig nutzen. |

Ende: weiter bei Schritt 5.

### UC-018 Vorlagen und Schnittstellen verwalten

**Referenz Funktionsbaum:** AM.03.01 Vorlagen verwalten, AM.03.02 Schnittstelle konfigurieren, AM.03.03 Änderungsprotokoll einsehen

**Arbeitsraum:** Administration

#### Beschreibung
- **Ausgangslage:** Vorlagen des PM-Handbuchs ändern sich, oder Umsysteme wie ERP, HR-System oder Budgetprozess sind anzubinden.
- **Use Case:** UE verwaltet die Vorlagen für Dokumente und Berichte. ADM richtet Schnittstellen zu Umsystemen ein und überwacht sie. Über das Änderungsprotokoll ist nachvollziehbar, wer wann was geändert hat.
- **Resultat:** Vorlagen aktuell und versioniert; Schnittstellen laufen überwacht; Änderungen nachvollziehbar.
- **User Interfaces:** Administration: Vorlagen, Schnittstellen mit Laufprotokoll, Änderungsprotokoll.

#### Beteiligte Akteure
| Akteur | Rolle im Use Case |
|---|---|
| UE | verwaltet die Vorlagen, sieht das Änderungsprotokoll ein |
| ADM | richtet Schnittstellen ein und überwacht sie |

#### Vorbedingungen
- ADM und UE sind angemeldet und berechtigt (AM.01.02).

#### Ablauf

**Standardablauf**

| Schritt | Abzweigung Alternativablauf | Aktion User | Systemverhalten |
|---|---|---|---|
| 1 |  | UE öffnet die Vorlagen. | System zeigt die Vorlagen: Projektidee, Vorstudie, Business Case, Projektvertrag, Lösungskonzept, Abschlussbericht, Statusbericht, Portfoliobericht, Quartalsreporting. |
| 2 |  | UE lädt eine neue Version einer Vorlage hoch und ordnet die Felder den Daten zu. | System prüft die Zuordnung, versioniert die Vorlage und verwendet sie für künftige Dokumentausgaben (DM.02.07). |
| 3 |  | ADM richtet eine Schnittstelle ein: Umsystem, Daten, Richtung, Rhythmus. | System speichert die Konfiguration und führt einen Testlauf aus. |
| 4 | A1 | ADM überwacht die Schnittstellen. | System zeigt je Lauf Zeitpunkt, Umfang und Fehler und meldet Fehler im Eingang des ADM. |
| 5 |  | ADM oder UE sehen das Änderungsprotokoll ein. | System zeigt Änderungen mit Benutzer, Zeitpunkt, altem und neuem Wert, filterbar nach Objekt und Zeitraum. |

**Alternativablauf**

**A1 Lauf fehlerhaft (ab Schritt 4):** Bedingung: Ein Lauf einer Schnittstelle schlägt fehl.

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A1.1 | ADM analysiert den Fehler und startet den Lauf erneut. | System führt den Lauf aus und protokolliert das Ergebnis. |

Ende: weiter bei Schritt 4.
