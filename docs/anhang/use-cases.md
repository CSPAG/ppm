# Use Cases Projektportfoliomanagement (Insel Gruppe)

Entwurf, Stand 29. Oktober 2026. Use Cases bündeln Business Cases zu Abläufen; jeder Use Case hat einen Heimat-Arbeitsraum (Projekt, Portfolio, Gremium, Ziele, Administration). Prinzip siehe [PPM-Master.md](../PPM-Master.md#7-ux-prinzip-arbeitsräume).

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
| UC-007 | Änderung am Projektvertrag beantragen und entscheiden |  | Projekt |  | PL, AG | PS.03.01, PS.03.02, PS.03.04 |
| UC-008 | Portfolio priorisieren und ausbalancieren | ● | Portfolio | Gremium | UE, PRAT | PP.01.02, PP.01.03, PP.02.01, PP.02.02, PP.02.03, PP.03.01, PP.03.02, PP.03.03, PP.03.04, PC.02.01, RK.02.04 |
| UC-009 | Ressourcen planen und zuteilen |  | Portfolio | Projekt | UE | RK.01.01, RK.01.02, RK.02.02, RK.02.03, RK.02.04 |
| UC-010 | Portfoliofinanzen überwachen |  | Portfolio |  | UE | PC.01.02, PC.01.04, PC.01.05 |
| UC-011 | Ziele im Jahreszyklus festlegen | ● | Ziele | Portfolio | GL, UE | ZM.01.01, ZM.01.02, ZM.02.01, ZM.02.02, ZM.02.03, ZM.02.04, PP.04.03, PC.01.05 |
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
- **Use Case:** AS stellt die Idee nach Vorlage in den Ideenpool. UE prüft sie mit der vorgesehenen Projektauftraggeber:in anhand der Leitfragen zum Eintritt P0, ordnet sie über das Kriterienraster einer Kategorie zu und legt sie dem zuständigen Gremium zur Freigabe der Initialisierung vor.
- **Resultat:** Idee qualifiziert und der Kategorie A, B oder C zugeordnet; bei Freigabe Vorhaben in Phase P0 und Aufgabe «Projektvertrag erstellen» im Eingang der Projektleitung (UC-002); sonst Idee begründet zurückgewiesen oder zusammengeführt.
- **User Interfaces:** Formular Projektidee; Ideenpool im Arbeitsraum Portfolio als Liste und Funnel «Pre-P0»; Eingang.

#### Beteiligte Akteure
| Akteur | Rolle im Use Case |
|---|---|
| AS | erfasst die Idee, ergänzt bei Rückfragen |
| UE | prüft, führt zusammen, ordnet zu, traktandiert |
| AG | vorgesehene Projektauftraggeber:in, qualifiziert mit |
| PRAT, GLPA | geben die Initialisierung frei |

#### Vorbedingungen
- AS ist angemeldet (AM.01.01).
- Handlungsfelder und strategische Ziele sind erfasst (UC-011).
- Kriterienraster und Leitfragen zum Eintritt P0 sind konfiguriert (PP.01.02, AM.02.03).

#### Ablauf

**Standardablauf**

| Schritt | Abzweigung Alternativablauf | Aktion User | Systemverhalten |
|---|---|---|---|
| 1 |  | AS legt eine neue Projektidee an. | System zeigt das Formular nach Vorlage: Ausgangslage, Zielsetzung, Strategiebezug (Handlungsfeld, strategisches Ziel), betroffene Bereiche, erste Einschätzung von Nutzen, Aufwand und Relevanz, Herkunft der Idee. Beim Ausfüllen zeigt es eingereichte Ideen mit gleichem Handlungsfeld oder gleichen betroffenen Bereichen; alle Mitglieder lesen eingereichte Ideen (Entscheid 14). |
| 2 |  | AS füllt das Formular aus und reicht die Idee ein. | System prüft die Pflichtfelder, stellt die Idee in den Ideenpool und legt der UE eine Prüfaufgabe in den Eingang. |
| 3 | A1 | UE öffnet die Idee. | System zeigt die Idee und ähnliche Ideen im Ideenpool mit gleichem Handlungsfeld oder gleichen betroffenen Bereichen. |
| 4 | A2, A3 | UE und AG beantworten die Leitfragen zum Eintritt P0: strategische Relevanz, Projektziel, klinische Fragestellung, ICT-Einbindung, Infrastruktur. | System speichert die Antworten zur Idee. |
| 5 | A4 | UE ordnet die Idee anhand des Kriterienrasters ein: strategisch, taktisch-operativ oder operativ. | System speichert die Kategorie A, B oder C und damit das zuständige Portfolio und Gremium. |
| 6 | A6 | UE traktandiert die Freigabe der Initialisierung (UC-006). | System setzt die Idee auf die Traktandenliste des zuständigen Gremiums. |
| 7 | A5 | Das Gremium gibt die Initialisierung frei; UE erfasst den Entscheid mit Projektauftraggeber:in und Projektleitung [OFFEN: Wer benennt Projektauftraggeber:in und Projektleitung?]. | System legt das Vorhaben in Phase P0 an, übernimmt die Angaben der Idee, schlägt Zugriff für die Projektleitung (Projekt führen) und die Projektauftraggeber:in (Projekt steuern) vor (Entscheid 16), informiert AS und legt der Projektleitung die Aufgabe «Projektvertrag erstellen» in den Eingang (UC-002). |

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

**A3 Idee zurückweisen (ab Schritt 4):** Bedingung: Die Idee ist nicht strategisch relevant oder wird aus anderen Gründen nicht verfolgt. Ob die UE allein zurückweist oder das Gremium entscheidet, regelt die Organisation; das System verlangt keinen Gremiumsentscheid (G1) [OFFEN beim Referenzkunden: K07].

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A3.1 | UE erfasst die Begründung. | System schliesst die Idee als «zurückgewiesen» und informiert AS. |

Ende: Use Case endet.

**A4 Projekt einer Direktion (ab Schritt 5):** Bedingung: Die Idee gehört in Kategorie C.

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A4.1 |  | System weist die Idee dem Portfolio der zuständigen Direktion zu; Freigabe und Steuerung liegen dort, ohne Vorgaben des PM-Handbuchs (Q8 Kap. 1). |
| A4.2 | Die Direktion gibt die Initialisierung frei; den Entscheid erfasst, wer das Portfolio führt: die Direktion selbst oder die UE (Entscheid 18). | System legt das Vorhaben in Phase P0 an. |

Ende: weiter in UC-002.

**A5 Initialisierung nicht freigegeben (ab Schritt 7):** Bedingung: Das Gremium stellt die Idee zurück oder lehnt sie ab.

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A5.1 | UE erfasst Entscheid und Begründung. | System lässt eine zurückgestellte Idee mit den Auflagen im Ideenpool; eine abgelehnte schliesst es als «zurückgewiesen». AS wird informiert. |

Ende: bei Rückstellung weiter bei Schritt 4; bei Ablehnung endet der Use Case.

**A6 Initialisierung vor dem Entscheid (ab Schritt 6):** Bedingung: Die UE will das Vorhaben starten, bevor das Gremium entschieden hat (G1).

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A6.1 | UE startet die Initialisierung. | System weist auf den ausstehenden Entscheid hin, legt das Vorhaben wie in Schritt 7 in Phase P0 an, mit dem Vermerk «Initialisierung nicht freigegeben», und lässt das Traktandum offen. |
| A6.2 | Das Gremium entscheidet später; UE erfasst den Entscheid. | System ersetzt den Vermerk durch den Entscheid; bei Ablehnung weist es PL und AG auf das laufende Vorhaben hin. |

Ende: weiter in UC-002; bei Ablehnung weiter in UC-015.

### UC-002 Projektvertrag erarbeiten und freigeben

**Referenz Funktionsbaum:** DM.02.01 Projektvertrag erstellen, DM.02.02 Projektvertrag zur Prüfung einreichen, DM.02.03 Projektvertrag überarbeiten, DM.02.04 Projektvertrag zurückziehen, DM.02.05 Quality Review durchführen, DM.02.06 Projektvertrag freigeben, DM.02.07 Projektvertrag als Dokument ausgeben, PP.02.03 Abhängigkeiten zwischen Vorhaben erfassen, PP.02.05 Vorhaben mit strategischen Zielen verknüpfen, PP.04.04 Projektorganisation festlegen, PC.01.01 Projektbudget planen, PC.02.04 Projektrisiko erfassen, PC.03.01 Projekt-KPIs festlegen, PC.03.04 Business Case fortschreiben, PS.02.04 Meilensteinplan pflegen, PS.05.01 Stakeholder erfassen, PS.05.02 Kommunikationsplan erstellen, RK.02.01 Ressourcenbedarf anmelden, RK.02.06 ICT- und Infrastrukturbedarf anmelden

**Arbeitsraum:** Projekt

#### Beschreibung
- **Ausgangslage:** Das Gremium hat die Initialisierung freigegeben (UC-001); das Vorhaben ist in Phase P0. Das System legt der Projektleitung die Aufgabe «Projektvertrag erstellen» in den Eingang.
- **Use Case:** PL erarbeitet mit der Projektauftraggeber:in den Projektvertrag für Phase P1 und den initialen Business Case, bei Bedarf gestützt auf eine Vorstudie. UE führt den Quality-Check durch, AG und PL unterzeichnen, und das zuständige Gremium gibt am Gate P0–P1 den Vertrag und die Phase P1 frei. Quality-Check, Unterschriften und Freigabe sind Vermerke, die den Ablauf nicht anhalten (G1).
- **Resultat:** Projektvertrag P1 freigegeben und als erste Baseline gespeichert; Projektorganisation, Ziele, Meilensteine, Budget, Ressourcenbedarf, Risiken, KPIs, Stakeholder und Kommunikation erfasst; ICT- und Infrastrukturbedarf gemeldet; Vorhaben in P1; Vertrag als Dokument verfügbar.
- **User Interfaces:** Eingang; Projektakte mit den Kapiteln des Projektvertrags; Dokumentausgabe im Layout der Vorlage; Traktandum im Arbeitsraum Gremium.

#### Beteiligte Akteure
| Akteur | Rolle im Use Case |
|---|---|
| PL | erarbeitet den Vertrag, reicht ein, unterzeichnet |
| AG | Projektauftraggeber:in; legt mit PL die Projektorganisation fest, stimmt ab, unterzeichnet |
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
| 2 |  | PL und AG legen die Projektorganisation fest: Projektauftraggeber:in, Projektleitung und weitere Personen mit Funktion und AKV. | System schlägt für weitere Funktionen vor, was in der Organisation schon verwendet wird (z. B. Kernteam, PMO; Entscheid 17), und speichert die Projektorganisation als Kapitel des Projektvertrags. Den Zugriff ändert das nicht (Entscheid 16); hat PL oder AG keinen Zugriff auf das Vorhaben, weist das System darauf hin und bietet «Zugriff geben» an. |
| 3 |  | PL erfasst Ausgangslage, Ziele und Nutzenbeitrag, Lösungsansatz und Abgrenzung und ordnet das Vorhaben einem strategischen Ziel und allenfalls einem Jahresziel zu. | System verknüpft das Vorhaben mit dem Ziel; es erscheint im Arbeitsraum Ziele. |
| 4 |  | PL erfasst den initialen Business Case mit Kosten und Nutzen und die Projekt-KPIs mit Zielwert; eine Vorstudie legt PL als Beilage ab. | System speichert Business Case P0, KPIs und Beilage. |
| 5 |  | PL erfasst Abhängigkeiten zu anderen Vorhaben mit Ansprechperson. | System bietet alle aufgelisteten Vorhaben zur Auswahl an (Entscheid 14) und zeigt die Abhängigkeit auch beim anderen Vorhaben. |
| 6 | A1 | PL plant Meilensteine und Lieferergebnisse je Phase, Kosten je Phase (CAPEX/OPEX) und den Personalbedarf. | System schlägt die Standard-Lieferergebnisse und -Meilensteine der Phase vor (AM.02.03) und stellt den Bedarf der Ressourcenplanung bereit (UC-009). |
| 7 | A2 | PL erfasst Risiken mit Eintrittswahrscheinlichkeit, Auswirkung und Massnahme sowie Stakeholder und Kommunikationsmassnahmen. | System speichert sie im Risikoregister und im Kommunikationsplan des Vorhabens. |
| 8 | A3, A4, A7 | PL reicht den Vertrag zur Prüfung ein. | System prüft die Pflichtangaben der Phase, setzt den Status «in Prüfung» und legt der UE die Aufgabe Quality-Check in den Eingang. |
| 9 | A5 | UE prüft Vollständigkeit und Einhaltung des PM-Handbuchs und bestätigt. | System vermerkt den Quality-Check und legt AG und PL je eine Unterzeichnungsaufgabe an. |
| 10 |  | AG und PL unterzeichnen. | System vermerkt die Unterschriften und setzt das Vorhaben auf die Traktandenliste des Gate-Reviews P0–P1 beim zuständigen Gremium (UC-006). |
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

**A4 Vorhaben zurückziehen (ab Schritt 8):** Bedingung: Die Projektauftraggeber:in will das Vorhaben nicht weiterverfolgen.

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A4.1 | AG zieht das Vorhaben mit Begründung zurück. | System schliesst Vertrag und Vorhaben als «zurückgezogen», gibt den Ressourcenbedarf frei und informiert die UE. |

Ende: Use Case endet.

**A5 Quality-Check mit Rückmeldungen (ab Schritt 9):** Bedingung: UE stellt Mängel fest.

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A5.1 | UE erfasst Rückmeldungen. | System setzt den Status «in Arbeit» und informiert PL. |

Ende: weiter bei Schritt 3.

**A6 Gremium gibt nicht frei (ab Schritt 11):** Bedingung: Das Gremium stellt zurück, erteilt Auflagen oder lehnt ab.

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A6.1 | UE erfasst Entscheid und Auflagen. | System informiert PL und AG; das Vorhaben bleibt in P0. |

Ende: bei Auflagen weiter bei Schritt 3; bei Ablehnung weiter in UC-015.

**A7 Weiter ohne Vermerk (ab Schritt 8):** Bedingung: PL will den Vertrag dem Gremium vorlegen oder Phase P1 beginnen, bevor Quality-Check, Unterschriften oder Freigabe vorliegen (G1).

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A7.1 |  | System zeigt, welche Vermerke fehlen. |
| A7.2 | PL legt den Vertrag trotzdem vor oder wechselt in Phase P1. | System setzt das Traktandum bzw. die Phase mit dem Vermerk «Quality-Check offen», «Unterschrift offen» oder «ohne Freigabe»; die Aufgaben bleiben im Eingang, bis die Vermerke nachgetragen sind. |

Ende: weiter bei Schritt 11 bzw. in UC-003.

### UC-003 Gate-Übergang durchführen

**Referenz Funktionsbaum:** PS.02.01 Phasenfreigabe beantragen, PS.02.02 Phasenfreigabe entscheiden, PS.02.05 Projektvertrag fortschreiben, PS.03.04 Vertragsversionen vergleichen, DM.02.03 Projektvertrag überarbeiten, DM.02.05 Quality Review durchführen, DM.02.06 Projektvertrag freigeben, RK.02.05 Ressourcenbedarf präzisieren, PC.03.02 Nutzenrealisierung überprüfen, PC.03.04 Business Case fortschreiben

**Arbeitsraum:** Projekt

#### Beschreibung
- **Ausgangslage:** Eine Phase nähert sich dem Ende. Der nächste Gate-Review ist im Projektvertrag eingeplant (Kap. 7.2); das System legt der Projektleitung eine Gate-Aufgabe in den Eingang.
- **Use Case:** PL schreibt Projektvertrag und Business Case für die nächste Phase fort und beantwortet die Leitfragen des Gates. UE führt den Quality-Check durch, Projektauftraggeber:in und PL unterzeichnen. Das zuständige Gremium entscheidet am Gate und gibt damit den Vertrag für die nächste Phase frei: der PRAT, in P0 und P1 bis zur Freigabe von P2 zusätzlich der SNS-VR, bei Kategorie B die GLPA. Quality-Check, Unterschriften und Gate-Entscheid sind Vermerke: Fehlt einer, weist das System darauf hin, hält den Ablauf aber nicht an (G1).
- **Resultat:** Neue Vertragsversion freigegeben und als Baseline gespeichert, Gate-Entscheid mit Datum dokumentiert, Vorhaben in der nächsten Phase, Dashboard aktuell.
- **User Interfaces:** Eingang; Projektakte im Gate-Modus mit Vertragskapiteln, Leitfragen und Versionsvergleich; Traktandum im Arbeitsraum Gremium.

#### Beteiligte Akteure
| Akteur | Rolle im Use Case |
|---|---|
| PL | löst aus, schreibt Vertrag und Business Case fort, beantwortet Leitfragen, unterzeichnet |
| UE | führt den Quality-Check durch, stellt das Gate Review Packet bereit |
| AG | Projektauftraggeber:in; stimmt die Vorlage ab und unterzeichnet |
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
| 6 | A3, A7 | PL reicht den Vertrag zur Prüfung ein. | System prüft die Pflichtangaben der Phase, setzt den Status «in Prüfung» und legt der UE die Aufgabe Quality-Check in den Eingang. |
| 7 | A4 | UE prüft Vollständigkeit und Einhaltung des PM-Handbuchs und bestätigt. | System vermerkt den Quality-Check und legt AG und PL je eine Unterzeichnungsaufgabe an. |
| 8 | A5 | AG und PL unterzeichnen. | System vermerkt die Unterschriften und setzt das Vorhaben auf die Traktandenliste des nächsten Gate-Reviews des zuständigen Gremiums. |
| 9 |  | UE stellt das Gate Review Packet spätestens 5 Arbeitstage vor der Sitzung bereit (UC-006). | System stellt das Packet aus Vertrag, Business Case, Leitfragen und Hauptänderungen zusammen. |
| 10 | A6 | Das Gremium gibt die nächste Phase und den Vertrag frei; UE erfasst den Entscheid. | System speichert den Entscheid, setzt den Status «abgenommen» und die Version als neue Baseline, wechselt die Phase, aktualisiert das Dashboard und informiert PL und AG. |

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
| A2.2 | PL und AG erfassen erreichte Werte und Beurteilung. | System speichert die Nutzenprüfung. Beim Exit-Gate P4 weiter in UC-015. |

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

**A5 Unterschrift verweigert (ab Schritt 8):** Bedingung: AG oder PL unterzeichnet nicht.

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A5.1 | AG bzw. PL erfasst die Begründung. | System vermerkt die Verweigerung am Vertrag und am Traktandum und informiert PL. |

Ende: weiter bei Schritt 3, wenn PL nachbessert, sonst bei Schritt 9.

**A6 Gremium gibt nicht frei (ab Schritt 10):** Bedingung: Das Gremium stellt zurück, erteilt Auflagen oder stoppt.

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A6.1 | UE erfasst Entscheid und Auflagen. | System informiert PL und AG; die Baseline bleibt unverändert. |

Ende: bei Auflagen weiter bei Schritt 3; bei Stopp weiter in UC-015.

**A7 Weiter ohne Vermerk (ab Schritt 6):** Bedingung: PL will den Vertrag dem Gremium vorlegen oder die nächste Phase beginnen, bevor Quality-Check, Unterschriften oder Gate-Entscheid vorliegen (G1).

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A7.1 |  | System zeigt, welche Vermerke fehlen. |
| A7.2 | PL legt den Vertrag trotzdem vor oder wechselt die Phase. | System setzt das Traktandum bzw. die Phase mit dem Vermerk «Quality-Check offen», «Unterschrift offen» oder «ohne Gate-Entscheid»; die Aufgaben bleiben im Eingang, bis die Vermerke nachgetragen sind. |

Ende: weiter bei Schritt 9 bzw. in der nächsten Phase.

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
| AG | Projektauftraggeber:in; wird bei Status «kritisch» informiert, gibt den Bericht nicht frei |

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
| 8 | A4 | PL reicht den Bericht ein. | System speichert den Bericht als Stand der Periode, aktualisiert das Dashboard und legt der UE die Prüfaufgabe an; die UE konsolidiert bis Monatsende (UC-005). |

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
| A2.2 | PL erfasst beides und hält fest, ob ein Entscheid des PRAT nötig ist. | System markiert das Vorhaben im Dashboard, informiert AG und UE und legt bei Entscheidbedarf eine Eskalation an (PS.03.03, UC-006). |

Ende: weiter bei Schritt 8.

**A3 Frist verpasst (ab Schritt 1):** Bedingung: Bis zum 25. ist kein Bericht eingereicht.

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A3.1 |  | System erinnert PL und zeigt der UE den fehlenden Bericht (PS.01.03). |

Ende: weiter bei Schritt 1.

**A4 Bericht nach dem Einreichen ändern (ab Schritt 8):** Bedingung: PL korrigiert einen bereits eingereichten Bericht (G2).

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A4.1 | PL ändert den Bericht. | System speichert eine neue Version mit dem Vermerk «geändert nach Einreichen», zeigt der UE die Änderung und aktualisiert das Dashboard; eine bereits erfolgte Prüfung bleibt bei der früheren Version sichtbar. |

Ende: Use Case endet.

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
| 5 | A3, A4 | UE schliesst die Periode bis Monatsende ab. | System weist auf ungeprüfte Berichte hin; schliesst die UE trotzdem ab, tragen sie den Vermerk «nicht geprüft» (G1). Das System finalisiert das Dashboard und stellt es ab dem 1. den Gremien bereit. |

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

**A4 Änderung nach dem Abschluss (ab Schritt 5):** Bedingung: PL ändert einen Bericht einer abgeschlossenen Periode oder reicht ihn nach (G2).

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A4.1 | PL ändert oder reicht nach. | System speichert eine neue Version mit dem Vermerk «geändert nach Abschluss», zeigt die Änderung im Dashboard der Periode und informiert die UE. |

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
| PL | stellt das Geschäft des Vorhabens vor |
| AG | Projektauftraggeber:in; hat die Vorlage vorab abgestimmt, vertritt das Vorhaben |

#### Vorbedingungen
- UE ist angemeldet und für das Gremium PRAT berechtigt (AM.01.02).
- Der Sitzungstermin ist im Gremium erfasst (AM.02.04).
- Das Dashboard des Vormonats ist final (UC-005).

#### Ablauf

**Standardablauf**

| Schritt | Abzweigung Alternativablauf | Aktion User | Systemverhalten |
|---|---|---|---|
| 1 |  | UE öffnet die Aufgabe «Sitzung vorbereiten» im Eingang. | System öffnet die Sitzung im Arbeitsraum Gremium mit Traktandenvorschlägen: Portfoliobericht, eingeplante Gate-Reviews, anstehende Meilensteinabnahmen, Eskalationen, Änderungen mit Wirkung auf Scope, Budget oder Ressourcen, Priorisierungs- und Szenarioentscheide. |
| 2 | A1 | UE stellt die Traktandenliste zusammen und lädt je Geschäft PL und AG sowie bei Bedarf weitere Personen ein. | System legt die Traktanden mit Zeitbedarf an, für ein Gate-Review rund 35 Minuten (Präsentation 20, Diskussion 10, Entscheid 5), und informiert die Eingeladenen. |
| 3 | A2 | UE prüft je Traktandum, ob die Unterlagen vollständig sind und den Quality-Check bestanden haben (UC-003). | System zeigt je Traktandum den Stand der Unterlagen und offene Vermerke wie Quality-Check oder Unterschriften. |
| 4 |  | UE stellt den Portfoliobericht zusammen. | System erzeugt ihn aus dem Dashboard: Gesamtstatus, Status und Trend je Vorhaben, Risikolage, Abhängigkeiten, Eskalationen, anstehende Meilensteine, Freigaben und Abnahmen. |
| 5 |  | UE versendet die Unterlagen spätestens 5 Arbeitstage vor der Sitzung. | System stellt Traktandenliste, Portfoliobericht und Gate Review Packets den PRAT-Mitgliedern im Arbeitsraum Gremium bereit und protokolliert den Versand. Traktanden und Unterlagen bleiben änderbar; Änderungen nach dem Versand markiert das System für die Teilnehmenden (G2). |
| 6 |  | In der Sitzung berichtet UE über das Portfolio. | System zeigt Dashboard und Risikolage des Portfolios. |
| 7 | A3, A4 | Je Traktandum stellt PL das Geschäft vor, der PRAT berät und entscheidet, UE erfasst den Entscheid mit Begründung. | System speichert den Entscheid am Traktandum und am Vorhaben und löst die Folgeschritte aus: Gate freigegeben (UC-003), Meilenstein abgenommen, Änderung freigegeben (UC-007), Eskalation erledigt, Priorisierung festgehalten, Vorhaben sistiert oder abgebrochen (UC-015). |
| 8 |  | UE schliesst die Sitzung. | System erzeugt den Protokollentwurf aus Traktanden und Entscheiden und aktualisiert das Dashboard. |
| 9 |  | UE bereinigt das Protokoll und versendet es innert 2–3 Arbeitstagen. | System versendet es an den PRAT und die Beteiligten und schlägt nicht behandelte Traktanden für die nächste Sitzung vor. |

**Alternativablauf**

**A1 Geschäft über den SNS-VR (ab Schritt 2):** Bedingung: Ein Vorhaben in P0 oder P1 legt einen relevanten Meilenstein oder ein Gate bis zur Freigabe von P2 vor.

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A1.1 |  | System markiert das Traktandum «via SNS-VR». |
| A1.2 | UE erfasst in Schritt 7 die Stellungnahme des PRAT. | System legt das Geschäft dem SNS-VR vor und vermerkt, dass dessen Entscheid aussteht [OFFEN: Ablauf und Erfassung im SNS-VR]. |

Ende: weiter bei Schritt 3.

**A2 Unterlagen fehlen (ab Schritt 3):** Bedingung: Das Gate Review Packet liegt 5 Arbeitstage vor der Sitzung nicht vor, oder Quality-Check oder Unterschriften fehlen.

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A2.1 |  | System weist am Traktandum darauf hin. |
| A2.2 | UE verschiebt das Traktandum auf die nächste Sitzung oder lässt es mit dem Vermerk stehen (G1). | System plant das Traktandum neu ein bzw. zeigt den Vermerk in Unterlagen und Protokoll und informiert PL und AG. |

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
- **Use Case:** PL beantragt die Änderung als neue Vertragsversion mit Begründung und Auswirkungen. Die Projektauftraggeber:in entscheidet; Änderungen an Scope, Budget oder Ressourcen gibt der PRAT frei (Q8 Kap. 8.5). Mit der Freigabe wird die Baseline nachgeführt. Beide Entscheide sind Vermerke: PL kann die Änderung übernehmen, bevor sie vorliegen (G1).
- **Resultat:** Änderung entschieden und begründet; bei Freigabe neue Vertragsversion als Baseline mit dokumentierten Hauptänderungen; Planung und Dashboard aktuell.
- **User Interfaces:** Projektakte mit Änderungsantrag und Versionsvergleich; Eingang; Traktandum im Arbeitsraum Gremium.

#### Beteiligte Akteure
| Akteur | Rolle im Use Case |
|---|---|
| PL | beantragt, beschreibt die Auswirkungen |
| AG | Projektauftraggeber:in; entscheidet oder unterstützt den Antrag an den PRAT |
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
| 3 | A3 | PL reicht den Antrag ein. | System legt der AG eine Entscheidaufgabe in den Eingang; fehlt in der Projektorganisation eine Projektauftraggeber:in, weist es darauf hin. |
| 4 | A1, A2 | AG prüft den Antrag mit dem Versionsvergleich und gibt die Änderung frei. | System vermerkt den Entscheid, setzt die Version als neue Baseline, aktualisiert Planung und Dashboard und informiert PL und UE. |

**Alternativablauf**

**A1 Wirkung auf Scope, Budget oder Ressourcen (ab Schritt 4):** Bedingung: Die Änderung verändert Scope, Budget oder Ressourcen.

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A1.1 | AG unterstützt den Antrag. | System setzt ihn auf die Traktandenliste des PRAT (UC-006). |
| A1.2 | Der PRAT entscheidet; UE erfasst den Entscheid. | System verfährt bei Freigabe wie in Schritt 4, bei Ablehnung wie in A2. |

Ende: Use Case endet.

**A2 Änderung abgelehnt (ab Schritt 4):** Bedingung: AG oder PRAT lehnen die Änderung ab.

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A2.1 | AG bzw. UE für den PRAT erfasst die Begründung. | System vermerkt die Ablehnung und verwirft den Entwurf, die Baseline bleibt unverändert; PL wird informiert. |

Ende: Use Case endet; bei Bedarf Eskalation (UC-006).

**A3 Änderung vor dem Entscheid übernehmen (ab Schritt 3):** Bedingung: PL will mit der geänderten Planung weiterarbeiten, bevor AG oder PRAT entschieden haben (G1).

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A3.1 | PL übernimmt die Änderung. | System weist auf den ausstehenden Entscheid hin, setzt die Version als neue Baseline mit dem Vermerk «nicht freigegeben» und lässt die Entscheidaufgabe offen. |
| A3.2 | AG oder PRAT entscheiden später. | System ersetzt den Vermerk durch den Entscheid; bei Ablehnung zeigt es die Ablehnung an der Baseline, und PL beantragt eine Gegenänderung. |

Ende: Use Case endet.

### UC-008 Portfolio priorisieren und ausbalancieren

**Referenz Funktionsbaum:** PP.01.02 Bewertungsmodell festlegen, PP.01.03 Portfoliokategorien und Budgetrahmen festlegen, PP.02.01 Vorhaben bewerten, PP.02.02 Vorhaben priorisieren, PP.02.03 Abhängigkeiten zwischen Vorhaben erfassen, PP.03.01 Portfolioszenario erstellen, PP.03.02 Szenario gegen Budget und Kapazität prüfen, PP.03.03 Szenarien vergleichen, PP.03.04 Portfolio in Matrixsicht beurteilen, PC.02.01 Portfoliorisiko erfassen, RK.02.04 Auslastung analysieren

**Arbeitsraum:** Portfolio

#### Beschreibung
- **Ausgangslage:** Neue Vorhaben sind zur Initialisierung freigegeben, Budget- oder Kapazitätsrahmen ändern sich, oder der Jahreszyklus verlangt eine Neupriorisierung (Q6 F2). UE bereitet die Priorisierung für das zuständige Gremium vor.
- **Use Case:** UE bewertet die Vorhaben nach den Kriterien des Bewertungsmodells, erfasst Abhängigkeiten und Portfoliorisiken, beurteilt das Portfolio in der Matrixsicht und spielt Szenarien gegen Budget und Kapazität durch. Das Gremium entscheidet über Rangfolge und Szenario.
- **Resultat:** Bewertung je Vorhaben, Rangfolge je Portfolio und gewähltes Szenario entschieden und dokumentiert; Wasserlinie sichtbar; betroffene Projektauftraggeber:innen und Projektleitungen informiert.
- **User Interfaces:** Arbeitsraum Portfolio: Liste, Bewertungsmaske, Matrix (Nutzen/Risiko, Ressourcen/Nutzen), Szenariovergleich mit Wasserlinie, Auslastung; Traktandum im Arbeitsraum Gremium.

#### Beteiligte Akteure
| Akteur | Rolle im Use Case |
|---|---|
| UE | bewertet, erstellt Szenarien, führt Budgetrahmen und Kapazitätsangebot, bereitet den Entscheid vor |
| PRAT | legt das Bewertungsmodell fest, entscheidet Rangfolge und Szenario |

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
| 8 | A2 | Das Gremium entscheidet über Rangfolge und Szenario; UE erfasst den Entscheid. | System übernimmt Rangfolge und Szenario als Ist-Stand des Portfolios und informiert die betroffenen Projektauftraggeber:innen und Projektleitungen. |

**Alternativablauf**

**A1 Bewertungsmodell oder Budgetrahmen anpassen (ab Schritt 1):** Bedingung: Kriterien oder Portfoliokategorien mit Budgetrahmen sind neu festzulegen, etwa im Jahreszyklus.

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A1.1 | UE erarbeitet Kriterien und Budgetrahmen je Kategorie [OFFEN: Budgetrahmen je Kategorie]. | System speichert sie als Entwurf. |
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
- **Ausgangslage:** Vorhaben melden Ressourcenbedarf als Grösse S, M oder L oder in FTE und Monaten je Rolle und Phase (UC-002, UC-003). Die UE plant das Kapazitätsangebot und teilt Personen zu; eine eigene Rolle Ressourcenmanagement gibt es nicht (Entscheid 15) [OFFEN: Planung je Pool].
- **Use Case:** UE hält das Kapazitätsangebot aktuell, deckt den angemeldeten Bedarf mit Personen, löst Überbuchungen nach Priorität auf und analysiert die Auslastung.
- **Resultat:** Bedarf der Vorhaben gedeckt oder Lücken ausgewiesen; Konflikte nach Priorität bereinigt; Auslastung je Pool sichtbar.
- **User Interfaces:** Arbeitsraum Portfolio: Kapazitätsplanung je Pool, Bedarfsliste, Zuteilung, Auslastung; Eingang.

#### Beteiligte Akteure
| Akteur | Rolle im Use Case |
|---|---|
| UE | plant das Angebot, teilt zu, löst Konflikte nach Priorität |
| PL | meldet Bedarf, erhält die Zuteilung |

#### Vorbedingungen
- UE ist angemeldet und berechtigt (AM.01.02).
- Ressourcenpools sind definiert [OFFEN].
- Vorhaben haben Bedarf gemeldet (RK.02.01, RK.02.05).

#### Ablauf

**Standardablauf**

| Schritt | Abzweigung Alternativablauf | Aktion User | Systemverhalten |
|---|---|---|---|
| 1 |  | UE öffnet die Kapazitätsplanung. | System zeigt je Pool das Kapazitätsangebot aus Personal- und Abwesenheitsdaten und den angemeldeten Bedarf der Vorhaben [OFFEN: Übernahme aus dem HR-System]. |
| 2 |  | UE legt die für Vorhaben verfügbare Kapazität je Pool und Periode fest. | System speichert das Angebot. |
| 3 |  | UE öffnet einen offenen Bedarf. | System zeigt Rolle, Umfang, Zeitraum und Priorität des Vorhabens sowie Personen mit freier Kapazität. |
| 4 | A1, A2 | UE teilt Personen zu. | System bucht die Kapazität, informiert PL und die Zugeteilten und aktualisiert die Auslastung. |
| 5 |  | UE analysiert die Auslastung. | System zeigt Engpässe und Unterauslastung je Pool und Periode, auch für Szenarien (UC-008). |

**Alternativablauf**

**A1 Ressourcenkonflikt (ab Schritt 4):** Bedingung: Die Zuteilung überbucht eine Person oder einen Pool.

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A1.1 |  | System zeigt die beteiligten Vorhaben mit ihrer Priorität. |
| A1.2 | UE löst den Konflikt nach Priorität. | System passt die Zuteilungen an und informiert die betroffenen Projektleitungen. |

Ende: weiter bei Schritt 5.

**A2 Bedarf nicht deckbar (ab Schritt 4):** Bedingung: Für den Bedarf ist keine Kapazität verfügbar.

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A2.1 | UE meldet die Lücke. | System markiert den Bedarf als ungedeckt und zeigt ihn im Dashboard und in der Priorisierung (UC-008). |

Ende: weiter bei Schritt 5.

### UC-010 Portfoliofinanzen überwachen

**Referenz Funktionsbaum:** PC.01.02 Ist-Kosten übernehmen, PC.01.04 Budgetabweichungen analysieren, PC.01.05 Budgetbedarf in den Budgetprozess übergeben

**Arbeitsraum:** Portfolio

#### Beschreibung
- **Ausgangslage:** Die Vorhaben führen Kosten je Phase und eine Kostenprognose (UC-002, UC-004). Ist-Kosten sollen ohne Handerfassung aus dem ERP kommen [OFFEN: Quelle der Ist-Kosten].
- **Use Case:** Das System übernimmt die Ist-Kosten. Die UE analysiert Budgetabweichungen über das Portfolio und klärt Ursachen; eine eigene Rolle Finanzen gibt es nicht (Entscheid 12). Für den Budgetprozess leiten GL und UE aus den Kosten je Phase den Jahresbedarf CAPEX und OPEX ab.
- **Resultat:** Ist-Kosten aktuell; Abweichungen je Vorhaben und Portfolio ausgewiesen und begründet; Jahresbedarf an den Budgetprozess übergeben.
- **User Interfaces:** Arbeitsraum Portfolio: Finanzübersicht mit Budget, Ist und Prognose je Vorhaben und Phase; Abweichungsanalyse; Export für den Budgetprozess.

#### Beteiligte Akteure
| Akteur | Rolle im Use Case |
|---|---|
| UE | analysiert, klärt Ursachen mit der Projektleitung, leitet den Jahresbedarf ab |
| GL | übergibt den Bedarf an den Budgetprozess |
| PL | begründet Abweichungen |

#### Vorbedingungen
- UE ist angemeldet und berechtigt (AM.01.02).
- Die Vorhaben haben Kosten je Phase (PC.01.01).
- Die Schnittstelle zum ERP ist konfiguriert (AM.03.02).

#### Ablauf

**Standardablauf**

| Schritt | Abzweigung Alternativablauf | Aktion User | Systemverhalten |
|---|---|---|---|
| 1 |  |  | System übernimmt periodisch die Ist-Kosten je Vorhaben aus dem ERP [OFFEN: Rhythmus und Kostenzuordnung]. |
| 2 | A1 | UE öffnet die Finanzübersicht des Portfolios. | System zeigt je Vorhaben Budget je Phase, Ist-Kosten und Prognose und markiert Überschreitungen. |
| 3 | A2 | UE analysiert die Abweichungen. | System zeigt die Abweichungen nach Vorhaben, Phase und CAPEX/OPEX mit Verlauf. |
| 4 |  | UE klärt die Ursachen mit der Projektleitung und hält sie fest. | System speichert die Begründung zum Vorhaben. |
| 5 |  | UE leitet für den Budgetprozess den Jahresbedarf ab. | System rechnet aus Kosten je Phase und Terminplanung den Bedarf je Jahr, CAPEX und OPEX, je Vorhaben und Portfolio [OFFEN: Umrechnung Phase zu Jahr]. |
| 6 |  | GL und UE übergeben den Bedarf an den Budgetprozess. | System erzeugt den Export und protokolliert die Übergabe. |

**Alternativablauf**

**A1 Ist-Kosten fehlen (ab Schritt 2):** Bedingung: Für ein Vorhaben liegen keine Ist-Kosten aus dem ERP vor.

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A1.1 | UE klärt die Zuordnung des Vorhabens im ERP. | System übernimmt die Kosten beim nächsten Lauf. |

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
- **Use Case:** GL pflegt Handlungsfelder und strategische Ziele, leitet die Jahresziele ab und legt Hauptaktivitäten mit Verantwortlichen und je Ziel eine Metrik fest; im System pflegen das die GL oder die UE, je nachdem, wer alle Portfolios führt (Entscheid 18). Der VR gibt die Jahresziele frei; die Freigabe ist ein Vermerk (G1). Daraus entstehen die Portfolio-Roadmap und der Input für den Budgetprozess.
- **Resultat:** Handlungsfelder, strategische Ziele und Jahresziele mit Metrik freigegeben; Hauptaktivitäten und Vorhaben zugeordnet; Roadmap publiziert; Budgetbedarf übergeben.
- **User Interfaces:** Arbeitsraum Ziele mit der Hierarchie Handlungsfeld, strategisches Ziel, Jahresziel, Hauptaktivität, Projekt; Freigabemaske; Roadmap im Arbeitsraum Portfolio.

#### Beteiligte Akteure
| Akteur | Rolle im Use Case |
|---|---|
| GL | legt Ziele fest, leitet Jahresziele ab, legt Hauptaktivitäten und Metriken fest |
| VR | aktualisiert die Strategie mit der GL, gibt die Jahresziele frei |
| UE | unterstützt den Zielprozess, pflegt die Ziele im System, erfasst Freigaben, publiziert die Roadmap, übergibt mit der GL den Budgetbedarf |

#### Vorbedingungen
- GL oder UE ist angemeldet und führt alle Portfolios (AM.01.02, Entscheid 18).
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
| 6 |  | GL legt die Jahresziele dem VR zur Freigabe vor. | System setzt die Jahresziele auf «zur Freigabe»; Änderungen bleiben möglich und werden als «geändert nach Vorlage» markiert (G2). |
| 7 | A2 | Der VR gibt die Jahresziele frei; UE erfasst die Freigabe. | System setzt die Jahresziele in Kraft. |
| 8 | A3 | UE publiziert die Portfolio-Roadmap. | System erzeugt die Roadmap aus Zielen, Hauptaktivitäten und Vorhaben und stellt sie intern bereit. |
| 9 |  | GL und UE übergeben den Budgetbedarf an den Budgetprozess (UC-010). | System stellt den Jahresbedarf der Vorhaben bereit. |

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

**A3 Roadmap vor der Freigabe (ab Schritt 8):** Bedingung: Die Roadmap soll erscheinen, bevor der VR die Jahresziele freigegeben hat (G1).

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A3.1 | UE publiziert die Roadmap trotzdem. | System weist darauf hin und publiziert sie mit dem Vermerk «Jahresziele noch nicht freigegeben»; der Vermerk entfällt mit der Freigabe. |

Ende: weiter bei Schritt 9.

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
- **Ausgangslage:** Ein Gremium, eine Projektauftraggeber:in, die GL oder die UE will den Stand eines Portfolios überblicken oder eine spezifische Frage beantworten.
- **Use Case:** Die Nutzenden sehen das Dashboard ihrer Portfolios und die Risikolage. UE erstellt den periodischen Portfoliobericht für das Gremium und beantwortet spezifische Fragen mit Ad-hoc-Auswertungen.
- **Resultat:** Überblick gewonnen; Portfoliobericht oder Auswertung erstellt und bei Bedarf exportiert.
- **User Interfaces:** Arbeitsraum Portfolio: Dashboard, Funnel nach Phase, Matrix, Risikolage, Auswertungen mit Filtern und Export.

#### Beteiligte Akteure
| Akteur | Rolle im Use Case |
|---|---|
| PRAT, GLPA, DIR | sehen Dashboard und Bericht ihres Portfolios |
| GL | sieht alle Portfolios |
| UE | erstellt Portfoliobericht und Auswertungen, auch zu den Finanzen |

#### Vorbedingungen
- Die Nutzenden sind angemeldet und sehen nur Portfolios, an denen sie eine Rolle haben, oder alle mit «alle Portfolios lesen» (AM.01.02, Entscheid 18); Beträge und vertrauliche Projekte sehen sie dort mit (Entscheid 13).
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
| A2.1 | UE wählt Filter, Kennzahlen und Gruppierung. | System zeigt das Ergebnis und bietet einen Export an. |

Ende: Use Case endet.

### UC-015 Vorhaben abschliessen oder abbrechen

**Referenz Funktionsbaum:** PS.04.01 Vorhaben abschliessen, PS.04.02 Vorhaben sistieren oder abbrechen, PS.04.03 Lessons Learned erfassen, PC.03.02 Nutzenrealisierung überprüfen, PC.03.04 Business Case fortschreiben

**Arbeitsraum:** Projekt

#### Beschreibung
- **Ausgangslage:** Das Vorhaben hat die Phase P4 Abschluss erreicht, oder das Gremium hat entschieden, es zu sistieren oder abzubrechen (UC-006, UC-008).
- **Use Case:** PL erstellt den Abschlussbericht mit Zielerreichung, Business Case Abschluss, offenen Punkten, Übergabe an den Betrieb und Lessons Learned. Projektauftraggeber:in und UE überprüfen die Nutzenrealisierung. Am Exit-Gate P4 entscheidet das Gremium über den formellen Abschluss (Q8 Kap. 7.5); die Abnahme ist ein Vermerk (G1).
- **Resultat:** Vorhaben formell abgeschlossen, sistiert oder abgebrochen; Abschlussbericht und Business Case Abschluss P4 gespeichert; Ressourcen freigegeben; Lessons Learned verfügbar; Dashboard aktuell.
- **User Interfaces:** Projektakte, Bereich Abschluss; Eingang; Traktandum im Arbeitsraum Gremium.

#### Beteiligte Akteure
| Akteur | Rolle im Use Case |
|---|---|
| PL | erstellt Abschlussbericht und Lessons Learned |
| AG, UE | überprüfen die Nutzenrealisierung |
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
| 3 |  | AG und UE beurteilen die Nutzenrealisierung. | System speichert die Beurteilung. |
| 4 |  | PL erfasst die Übergabe an Betrieb und Linie, offene Punkte mit Verantwortlichen und die Lessons Learned. | System speichert sie; die Lessons Learned stehen künftigen Vorhaben und dem Jahresrückblick zur Verfügung (UC-013). |
| 5 | A3 | PL reicht den Abschlussbericht ein; UE traktandiert das Exit-Gate P4 (UC-006). | System erzeugt den Abschlussbericht und setzt ihn auf die Traktandenliste. |
| 6 | A2 | Das Gremium nimmt den Abschlussbericht ab und schliesst das Vorhaben formell; UE erfasst den Entscheid. | System setzt das Vorhaben auf «abgeschlossen», gibt zugeteilte Ressourcen frei und aktualisiert das Dashboard. Spätere Änderungen an der Projektakte bleiben möglich und werden als «geändert nach Abschluss» markiert (G2). |

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

**A3 Abschliessen vor der Abnahme (ab Schritt 5):** Bedingung: Das Vorhaben soll abgeschlossen werden, bevor das Gremium den Abschlussbericht abgenommen hat (G1).

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A3.1 | PL oder UE schliessen das Vorhaben. | System weist auf die ausstehende Abnahme hin, setzt das Vorhaben wie in Schritt 6 auf «abgeschlossen», mit dem Vermerk «Abnahme offen», und lässt das Traktandum offen; die Abnahme wird nachgetragen. |

Ende: Use Case endet.

### UC-016 Benutzer, Rollen und Stellvertretungen verwalten

**Referenz Funktionsbaum:** AM.01.01 Benutzer verwalten, AM.01.02 Rolle mit Berechtigungen definieren, AM.01.03 Stellvertretung regeln

**Arbeitsraum:** Administration

#### Beschreibung
- **Ausgangslage:** Personen treten ein, wechseln die Funktion oder übernehmen eine Rolle in einem Vorhaben oder Gremium.
- **Use Case:** ADM verwaltet die Mitglieder der Organisation und vergibt Zugriff zentral; wer ein Portfolio oder Projekt führt, vergibt Zugriff auch direkt dort (Entscheid 16). Die Rollen sind vorgegeben (Entscheid 18): je Portfolio steuern, führen oder Gremium, je Projekt steuern, führen oder mitlesen, übergreifend alle Portfolios lesen oder führen; eigene Rollen kann die Organisation ergänzen. Alle regeln ihre Stellvertretung, damit Aufgaben bei Abwesenheit nicht liegen bleiben.
- **Resultat:** Mitglieder mit Zugriff aktuell; Stellvertretungen geregelt; Änderungen protokolliert und am Portfolio bzw. Projekt sichtbar.
- **User Interfaces:** Administration › Zugänge; Bereich «Zugriff» in Portfolio und Projektakte; Profil mit Stellvertretung.

#### Beteiligte Akteure
| Akteur | Rolle im Use Case |
|---|---|
| ADM | verwaltet Mitglieder und Zugriff zentral |
| PL, UE | vergeben Zugriff am Projekt bzw. Portfolio, das sie führen |
| alle | regeln ihre Stellvertretung |

#### Vorbedingungen
- ADM ist angemeldet und berechtigt.
- Die Organisationseinheiten sind erfasst (UC-017).

#### Ablauf

**Standardablauf**

| Schritt | Abzweigung Alternativablauf | Aktion User | Systemverhalten |
|---|---|---|---|
| 1 | A1 | ADM nimmt eine Person als Mitglied auf oder öffnet ein bestehendes Mitglied. | System zeigt Personendaten, Organisationseinheit und Zugriffe [OFFEN: Übernahme aus HR-System oder Verzeichnisdienst]. Jedes Mitglied listet Projekte auf, liest eingereichte Ideen und erfasst eigene (Entscheid 14). |
| 2 | A2, A3 | ADM vergibt Zugriff: eine Rolle an einem Portfolio, an einem Projekt oder übergreifend, bei Bedarf befristet. | System prüft, dass niemand mehr vergibt, als er selbst hat, und leitet die Rechte aus der Rolle ab; eine Rolle an einem Portfolio oder Projekt gilt nur dort. |
| 3 |  | ADM speichert. | System protokolliert die Änderung (AM.03.03) und informiert die Person. |
| 4 |  | Ein Mitglied erfasst in seinem Profil eine Stellvertretung mit Zeitraum. | System stellt Aufgaben im Zeitraum auch der Stellvertretung in den Eingang und protokolliert deren Vermerke als Stellvertretung. |

**Alternativablauf**

**A1 Zugang entziehen (ab Schritt 1):** Bedingung: Eine Person verlässt die Organisation oder gibt eine Rolle ab.

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A1.1 | ADM entzieht Zugang oder Rolle. | System zeigt offene Aufgaben und Rollen in Vorhaben, die neu zu besetzen sind, und sperrt den Zugang. |

Ende: Use Case endet.

**A2 Zugriff direkt am Projekt vergeben (ab Schritt 2):** Bedingung: Wer ein Projekt oder Portfolio führt, vergibt den Zugriff selbst (Entscheid 16).

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A2.1 | PL öffnet in der Projektakte den Bereich «Zugriff». | System zeigt, wer das Projekt führt, steuert oder mitliest, und wer über das Portfolio oder übergreifend Zugriff hat, mit «Warum?». |
| A2.2 | PL fügt eine Person mit Rolle hinzu, befristet oder entfernt einen Zugriff. | System prüft wie in Schritt 2, weist bei einem vertraulichen Projekt vorher darauf hin, protokolliert die Änderung und zeigt sie im Verlauf des Projekts. |

Ende: Use Case endet.

**A3 Eigene Rolle definieren (ab Schritt 2):** Bedingung: Die vorgegebenen Rollen passen nicht, etwa für eine Person, die nur Ressourcen plant (Entscheid 15).

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A3.1 | ADM stellt eine eigene Rolle aus Rechten zusammen und legt fest, an welchen Orten sie vergeben werden darf. | System speichert sie neben den vorgegebenen Rollen, die unverändert bleiben, und wendet spätere Änderungen sofort auf alle an, die sie haben. |

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
| 4 | A1 | UE bildet Portfolios und Gremien ab: je Portfolio das Gremium, Gremienweg je Phase und Kategorie, Sitzungsrhythmus und Dashboard; beim Referenzkunden die Portfolios A und B und je Direktion ein Portfolio C. | System speichert sie und wendet den Gremienweg bei der Traktandierung an (UC-006); den Zugriff je Portfolio vergibt UC-016. |
| 5 |  | ADM setzt die neue Version in Kraft. | System protokolliert die Änderung [OFFEN: Gilt eine neue Version auch für laufende Phasen?]. |

**Alternativablauf**

**A1 Portfolio einer Direktion (ab Schritt 4):** Bedingung: Für das Portfolio einer Direktion gelten keine Vorgaben des PM-Handbuchs.

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A1.1 | UE konfiguriert das Portfolio ohne Hinweise auf Gates und Reporting und gibt der Direktion die Rolle «Portfolio steuern», bei Bedarf auch «Portfolio führen» (Entscheid 18). | System lässt die Direktion Phasen, Gates und Berichte freiwillig nutzen. |

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
| 5 |  | ADM oder UE sehen das Änderungsprotokoll ein. | System zeigt Änderungen mit Benutzer, Zeitpunkt, altem und neuem Wert, filterbar nach Objekt und Zeitraum. Am Objekt selbst sieht jede Person, die es sehen darf, dessen Verlauf (G2). |

**Alternativablauf**

**A1 Lauf fehlerhaft (ab Schritt 4):** Bedingung: Ein Lauf einer Schnittstelle schlägt fehl.

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A1.1 | ADM analysiert den Fehler und startet den Lauf erneut. | System führt den Lauf aus und protokolliert das Ergebnis. |

Ende: weiter bei Schritt 4.
