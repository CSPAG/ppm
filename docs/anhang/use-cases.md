# Use Cases Projektportfoliomanagement (Insel Gruppe)

Entwurf, Stand 26. Oktober 2026. Use Cases bündeln Business Cases zu Abläufen; jeder Use Case hat einen Heimat-Arbeitsraum (Projekt, Portfolio, Gremium, Ziele, Administration). Prinzip siehe [PPM-Master.md](../PPM-Master.md#7-ux-prinzip-arbeitsräume).

## Use-Case-Liste

● = Kernablauf

| ID | Use Case | Kern | Heimat | berührt | Primärakteur | Business Cases |
|---|---|---|---|---|---|---|
| UC-001 | Projektidee erfassen und qualifizieren |  | Portfolio | Projekt | AS, UE | DM.01.01, DM.01.02, DM.01.03, DM.01.04, PP.02.04 |
| UC-002 | Projektvertrag erarbeiten und freigeben | ● | Projekt |  | PL | DM.02.01, DM.02.02, DM.02.03, DM.02.04, DM.02.05, DM.02.06, DM.02.07, PP.02.03, PP.02.05, PP.04.04, PC.01.01, PC.02.04, PC.03.01, PS.02.04, PS.05.01, PS.05.02, RK.02.01, RK.02.06 |
| UC-003 | Gate-Übergang durchführen | ● | Projekt | Gremium | PL | PS.02.01, PS.02.02, PS.02.05, PS.03.04, DM.02.03, DM.02.05, DM.02.06, RK.02.05, PC.03.02 |
| UC-004 | Monatlich berichten | ● | Projekt |  | PL | PS.01.01, PS.02.04, PC.01.03, PC.02.03, PC.02.04, PS.05.03 |
| UC-005 | Statusberichte prüfen und nachverfolgen |  | Portfolio |  | UE | PS.01.02, PS.01.03, PS.01.04 |
| UC-006 | PRAT-Sitzung vorbereiten und durchführen | ● | Gremium | Portfolio | UE, PRAT | PP.04.01, PP.04.02, PP.04.05, PS.02.02, PS.02.03, PS.03.03, PS.04.02, PC.02.02 |
| UC-007 | Änderung am Projektvertrag beantragen und entscheiden |  | Projekt |  | PL, AG | PS.03.01, PS.03.02, PS.03.04 |
| UC-008 | Portfolio priorisieren und ausbalancieren | ● | Portfolio | Gremium | UE, PRAT | PP.01.02, PP.01.03, PP.02.01, PP.02.02, PP.02.03, PP.03.01, PP.03.02, PP.03.03, PP.03.04, PC.02.01, RK.02.04 |
| UC-009 | Ressourcen planen und zuteilen |  | Portfolio | Projekt | RM | RK.01.01, RK.01.02, RK.02.02, RK.02.03, RK.02.04 |
| UC-010 | Portfoliofinanzen überwachen |  | Portfolio |  | FI, UE | PC.01.02, PC.01.04, PC.01.05 |
| UC-011 | Ziele im Jahreszyklus festlegen | ● | Ziele | Portfolio | GL, VR | ZM.01.01, ZM.01.02, ZM.02.01, ZM.02.02, ZM.02.03, ZM.02.04, PP.04.03, PC.01.05 |
| UC-012 | Quartalsreporting an den VR erstellen |  | Ziele | Portfolio | UE, CEO | ZM.03.01, ZM.03.02, PC.04.02 |
| UC-013 | Jahresrückblick auswerten |  | Gremium | Ziele | PRAT | ZM.03.03, PS.04.03 |
| UC-014 | Portfolio auswerten |  | Portfolio |  | PRAT, GLPA, DIR, UE | PC.04.01, PC.04.02, PC.04.03, PC.02.02 |
| UC-015 | Vorhaben abschliessen oder abbrechen |  | Projekt | Gremium | PL, PRAT | PS.04.01, PS.04.02, PS.04.03, PC.03.02 |
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
| PS.03.03 Eskalation behandeln |  |  |  |  |  | ● |  |  |  |  |  |  |  |  |  |  |  |  |
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

Alle 87 aktiven Business Cases sind durch mindestens einen Use Case realisiert. PP.01.01 entfällt.

## Ausformulierte Use Cases

Nach CSP-Vorlage. Ausformuliert sind bisher UC-003 und UC-004; als Nächstes UC-006.


### UC-003 Gate-Übergang durchführen

**Referenz Funktionsbaum:** PS.02.01 Phasenfreigabe beantragen, PS.02.02 Phasenfreigabe entscheiden, PS.02.05 Projektvertrag fortschreiben, PS.03.04 Vertragsversionen vergleichen, DM.02.03 Projektvertrag überarbeiten, DM.02.05 Quality Review durchführen, DM.02.06 Projektvertrag freigeben, RK.02.05 Ressourcenbedarf präzisieren, PC.03.02 Nutzenrealisierung überprüfen

**Arbeitsraum:** Projekt

#### Beschreibung
- **Ausgangslage:** Eine Phase nähert sich dem Ende. Der nächste PRAT-Gate-Review ist im Projektvertrag eingeplant (Kap. 7.2); das System legt der Projektleitung eine Gate-Aufgabe in den Eingang.
- **Use Case:** PL schreibt den Projektvertrag für die nächste Phase fort und beantwortet die Leitfragen des Gates. UE führt das Quality Review durch, Auftraggeber, Sponsor, PL und CTL geben frei, das PRAT entscheidet am Gate.
- **Resultat:** Neue Vertragsversion freigegeben und als Baseline gespeichert, Gate-Entscheid mit Datum dokumentiert, Vorhaben in der nächsten Phase, Dashboard aktuell.
- **User Interfaces:** Eingang; Projektakte im Gate-Modus mit Vertragskapiteln, Leitfragen und Versionsvergleich; Traktandum im Arbeitsraum Gremium.

#### Beteiligte Akteure
| Akteur | Rolle im Use Case |
|---|---|
| PL | löst aus, schreibt den Vertrag fort, beantwortet Leitfragen |
| UE | führt das Quality Review durch, bereitet das Traktandum vor |
| AG, SP, CTL | geben den Projektvertrag frei |
| PRAT | entscheidet am Gate |

#### Vorbedingungen
- PL ist angemeldet und für das Vorhaben berechtigt (AM.01.02).
- Vorhaben hat einen freigegebenen Projektvertrag der laufenden Phase.
- Ein Gate-Review ist eingeplant (PP.04.05).

#### Ablauf

**Standardablauf**

| Schritt | Abzweigung Alternativablauf | Aktion User | Systemverhalten |
|---|---|---|---|
| 1 |  | PL öffnet die Gate-Aufgabe im Eingang. | System öffnet die Projektakte im Gate-Modus: Leitfragen des Gates je Dimension (Nutzen, Klinik, ICT, Infrastruktur) und die Kapitel, die für die nächste Phase zu ergänzen sind. |
| 2 |  | PL legt eine neue Vertragsversion an. | System übernimmt die freigegebene Version als Entwurf mit neuer Versionsnummer und Phase. |
| 3 | A1, A2 | PL ergänzt die Kapitel, etwa Planung, Kosten je Phase, Personal, Risiken, Stakeholder und Kommunikation. | System speichert und zeigt laufend die Abweichungen zur Baseline. |
| 4 |  | PL beantwortet die Leitfragen des Gates. | System speichert die Antworten zur Version. |
| 5 |  | PL prüft die Zusammenfassung der Hauptänderungen und ergänzt «Andere». | System erzeugt die Hauptänderungen zu Scope, Zeitplan, Ressourcen/Budget, Annahmen und Key-Risiken aus dem Versionsvergleich. |
| 6 | A3 | PL reicht den Vertrag zur Prüfung ein. | System prüft die Pflichtangaben der Phase, setzt den Status «in Prüfung» und legt der UE die Aufgabe Quality Review in den Eingang. |
| 7 | A4 | UE prüft Vollständigkeit und Einhaltung des PM-Handbuchs und bestätigt. | System protokolliert das Review und legt AG, SP, PL und CTL je eine Freigabeaufgabe an. |
| 8 | A5 | AG, SP, PL und CTL geben frei. | System protokolliert die Freigaben, setzt den Status «abgenommen» und setzt das Vorhaben auf die Traktandenliste des nächsten Gate-Reviews [OFFEN: Reihenfolge Freigabe und Gate-Entscheid]. |
| 9 |  | UE bereitet das Traktandum vor (UC-006). | System stellt die Entscheidungsvorlage aus Vertrag, Leitfragen und Hauptänderungen zusammen. |
| 10 | A6 | PRAT gibt die nächste Phase frei; UE erfasst den Entscheid. | System speichert den Entscheid, setzt die Version als neue Baseline, wechselt die Phase, aktualisiert das Dashboard und informiert PL und SP. |

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
| A2.1 |  | System zeigt die Projekt-KPIs mit Zielwert. |
| A2.2 | PL und SP erfassen erreichte Werte und Beurteilung. | System speichert die Nutzenprüfung. Beim Exit-Gate P4 weiter in UC-015. |

Ende: weiter bei Schritt 4.

**A3 Pflichtangaben fehlen (ab Schritt 6):** Bedingung: Für die Phase verlangte Angaben sind leer [OFFEN: Pflichtangaben je Phase gemäss PM-Handbuch].

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

**A5 Freigabe verweigert (ab Schritt 8):** Bedingung: Eine der vier Rollen gibt nicht frei.

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A5.1 | Rolle erfasst die Begründung. | System setzt den Status «in Arbeit» und informiert PL. |

Ende: weiter bei Schritt 3.

**A6 PRAT gibt nicht frei (ab Schritt 10):** Bedingung: PRAT stellt zurück, erteilt Auflagen oder stoppt.

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A6.1 | UE erfasst Entscheid und Auflagen. | System informiert PL und SP; die Baseline bleibt unverändert. |

Ende: bei Auflagen weiter bei Schritt 3; bei Stopp weiter in UC-015.

### UC-004 Monatlich berichten

**Referenz Funktionsbaum:** PS.01.01 Statusbericht erfassen, PS.02.04 Meilensteinplan pflegen, PC.01.03 Kostenprognose aktualisieren, PC.02.03 Risikomassnahme verfolgen, PC.02.04 Projektrisiko erfassen, PS.05.03 Kommunikationsmassnahme nachführen

**Arbeitsraum:** Projekt

#### Beschreibung
- **Ausgangslage:** Der Berichtsstichtag ist erreicht [OFFEN: Rhythmus, vermutlich monatlich zum operativen Review des PRAT, Q6 F2]. Das System legt der Projektleitung eine Berichtsaufgabe in den Eingang.
- **Use Case:** PL aktualisiert in einem Durchgang Meilensteine, Kostenprognose, Risiken und Kommunikationsmassnahmen und gibt Status und Trend ab. Das System erstellt daraus den Statusbericht der Periode.
- **Resultat:** Statusbericht eingereicht, mit Status, Trend und Vergleich zur Vorperiode; Projektdaten aktualisiert; Dashboard aktuell; Prüfaufgabe bei der UE.
- **User Interfaces:** Eingang; Projektakte, Bereich Bericht; Dashboard-Zeile des Vorhabens (Q6 F7).

#### Beteiligte Akteure
| Akteur | Rolle im Use Case |
|---|---|
| PL | löst aus, aktualisiert die Daten, reicht ein |
| UE | erhält den Bericht zur Prüfung (UC-005) |
| SP | wird bei Status «kritisch» informiert [OFFEN: Freigabe des Berichts?] |

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
| 6 | A2 | PL wählt Status und Trend und erfasst den nächsten Meilenstein mit Kommentar. | System prüft die Pflichtangaben des Berichts. |
| 7 |  | PL reicht den Bericht ein. | System speichert den Bericht als Stand der Periode, aktualisiert das Dashboard und legt der UE die Prüfaufgabe an (UC-005). |

**Alternativablauf**

**A1 Wesentliche Abweichung (ab Schritt 2):** Bedingung: Termine, Kosten oder Umfang weichen wesentlich vom Projektvertrag ab [OFFEN: Schwelle].

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A1.1 |  | System weist darauf hin, dass eine Änderung am Projektvertrag zu beantragen ist. |
| A1.2 | PL startet den Änderungsantrag (UC-007) oder eine Eskalation (UC-006). | System verknüpft Antrag bzw. Eskalation mit dem Bericht. |

Ende: weiter bei Schritt 3.

**A2 Status «kritisch» (ab Schritt 6):** Bedingung: PL wählt den Status «kritisch».

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A2.1 |  | System verlangt Begründung und Massnahme. |
| A2.2 | PL erfasst beides. | System markiert das Vorhaben im Dashboard und informiert SP und UE. |

Ende: weiter bei Schritt 7.

**A3 Frist verpasst (ab Schritt 1):** Bedingung: Bis zur Frist ist kein Bericht eingereicht [OFFEN: Frist].

| Schritt | Aktion User | Systemverhalten |
|---|---|---|
| A3.1 |  | System erinnert PL und zeigt der UE den fehlenden Bericht (PS.01.03). |

Ende: weiter bei Schritt 1.
