# PPM Insel Gruppe – Masterdokument

**Führendes Dokument** für die fachliche Spezifikation von Strategieumsetzung und Projektportfoliomanagement (PPM) der Insel Gruppe. Alle Entscheide, Annahmen und offenen Punkte werden hier geführt; Details stehen im [Anhang](anhang/).

| | |
|---|---|
| Stand | 26. Oktober 2026 |
| Status | Entwurf, nicht mit dem Kunden validiert |
| Verantwortlich | André Hochreutener, CSP AG |
| Umfang | 7 Business Modules · 23 Business Domains · 87 Business Cases · 18 Use Cases |

## Inhalt

1. [Auftrag](#1-auftrag)
2. [Methode](#2-methode)
3. [Quellen](#3-quellen)
4. [Fachliche Eckpunkte der Insel Gruppe](#4-fachliche-eckpunkte-der-insel-gruppe)
5. [Akteure](#5-akteure)
6. [Systemgrenze](#6-systemgrenze)
7. [UX-Prinzip: Arbeitsräume](#7-ux-prinzip-arbeitsräume)
8. [Funktionsbaum](#8-funktionsbaum)
9. [Use Cases](#9-use-cases)
10. [Entscheide](#10-entscheide)
11. [Annahmen](#11-annahmen)
12. [Offene Punkte](#12-offene-punkte)
13. [Nächste Schritte](#13-nächste-schritte)
14. [Anhang und Pflege](#14-anhang-und-pflege)

## 1. Auftrag

Fachliche Spezifikation eines Systems für Strategieumsetzung und PPM der Insel Gruppe nach CSP-Methode: Funktionsbaum (Business Module → Business Domain → Business Case) und Use Cases der Gesamtspezifikation, gebündelt nach Abläufen, damit das UI Prozesse abbildet statt verteilter Einzelfunktionen.

## 2. Methode

- **Business Module (BM)** gruppiert Domains eines grossen Bereichs; BM **AM Application Management** ist immer dabei.
- **Business Domain (BD)** gruppiert thematisch ähnliche Business Cases; gehört zu genau einem BM.
- **Business Case (BC)**: was ein User erreichen will und wie er das mit dem System tut. Name = Objekt + Verb. Jeder BC braucht eine **Herleitung** (Quelle oder analytischer Weg), sonst `[OFFEN]`.
- **Use Case (UC)**: Zusammenspiel User ↔ System im Detail; BC ↔ UC ist n:m. Jeder BC wird durch ≥ 1 UC realisiert.
- Nummerierung: BM `XX`, BD `XX.nn`, BC `XX.nn.nn`, UC `UC-nnn`. **IDs nie umnummerieren**; Neues hinten anfügen, Gestrichenes als «entfällt» markieren.
- UC-Vorlage: Referenz Funktionsbaum · Beschreibung (Ausgangslage, Use Case, Resultat, User Interfaces) · Beteiligte Akteure · Vorbedingungen · Standardablauf (Schritt | Abzweigung | Aktion User | Systemverhalten) · Alternativabläufe A1… mit Bedingung und Ende. Keine erfundenen Regeln; fehlt die Grundlage, `[OFFEN]`.
- Sprache: Schweizer Hochdeutsch (ss, «»).

## 3. Quellen

| ID | Quelle | Art | Datei |
|---|---|---|---|
| Q6 | Insel Gruppe, Eckpunkte PPM, 9 Folien (F1 Strategieumsetzung, F2 Jahreszyklus, F3 Zielstruktur, F4 Portfolios und Rollen, F5 Projektorganisation, F6 Phasen und Gates mit Leitfragen, F7 Dashboard, F8–F9 Portfolio-Mockups, ausgeblendet) | empirisch | [quellen/Q6_Eckpunkte_PPM.pptx](anhang/quellen/Q6_Eckpunkte_PPM.pptx), Text: [Q6_Eckpunkte_PPM.md](anhang/quellen/Q6_Eckpunkte_PPM.md), Dashboard: [Q6_F7_Dashboard.png](anhang/quellen/Q6_F7_Dashboard.png) |
| Q7 | Insel Gruppe, Vorlage Projektvertrag (Kopf, Kap. 1–13, Freigabe); Basis ist das PM-Handbuch der Insel Gruppe | empirisch | [quellen/Q7_Vorlage_Projektvertrag.docx](anhang/quellen/Q7_Vorlage_Projektvertrag.docx), Text: [Q7_Vorlage_Projektvertrag.md](anhang/quellen/Q7_Vorlage_Projektvertrag.md) |
| Q1 | Lebenszyklus der Geschäftsobjekte | analytisch | – |
| Q2 | Event-Partitionierung (externe, zeitliche, interne Ereignisse) | analytisch | – |
| Q3 | Ziele je Akteur | analytisch | – |
| Q4 | PMI, The Standard for Portfolio Management | Referenzstandard | – |
| Q5 | AXELOS, Management of Portfolios (MoP) | Referenzstandard | – |

Q6 und Q7 enthalten Kundenmaterial (Klassifikation intern) und Personennamen im Dashboard. Nur in privaten Repositories ablegen.

## 4. Fachliche Eckpunkte der Insel Gruppe

- **Zielkette:** Strategie → 5 strategische Handlungsfelder (Mitarbeitende & Kultur, Patientenorientierung, Medizin der Zukunft, Markt & Vernetzung, Wirtschaftlichkeit) → strategische Ziele (Mehrjahresziele) → Jahresziele → Hauptaktivitäten → Projekte; je Ziel eine Metrik.
- **Drei Portfolios = Projektkategorien:** A strategisches Transformationsportfolio (Gremium PRAT), B Projekte der Geschäftsleitung (GLPA), C Projekte der Direktionen (DIR). Zuordnung über ein Kriterienraster.
- **Phasenmodell:** Pre-P0 Ideen, P0 Initialisierung, P1 Konzept & Planung, P2 Implementierung, P3 Stabilisierung & Monitoring, P4 Abschluss; Gates P0 Eintritt, P0–P1, P1–P2, P2–P3 (Go-Live), P3–P4, P4 Exit mit Leitfragen je Dimension Nutzen, Klinik, ICT, Infrastruktur.
- **Jahreszyklus (F2):** Strategie-Aktualisierung (VR mit GL), Zielsetzung (Freigabe VR, Input Budgetprozess), Vorbereitung und Start Umsetzung, monatlicher operativer Review (PRAT: Priorisierung, Freigaben, Meilensteine, Eskalationen), quartalsweiser strategischer Review (VR), Jahresrückblick (PRAT).
- **Projektvertrag (Q7):** zentrales, lebendes Steuerungsdokument je Projekt; wird an jedem Gate für die nächste Phase fortgeschrieben; Status geplant / in Arbeit / in Prüfung / abgenommen; Quality Review durch UE; Freigabe durch Auftraggeber, Sponsor, PL, CTL; die freigegebene Version ist verbindlich (Baseline).

## 5. Akteure

VR Verwaltungsrat (Programmauftraggeber) · SNS VR-Ausschuss · CEO Programmsponsor · PRAT Programmausschuss Transformation (GL) · UE Unternehmensentwicklung (Programmleitung) · GL Geschäftsleitung · GLPA Gremium GL-Portfolio [OFFEN] · DIR Gremium Direktionen [OFFEN] · AG Auftraggeber/in · SP Projektsponsor (GL-Mitglied bzw. Direktion) · PL Projektleitung · CTL Clinical Transformation Lead · KT Kernteam · AS Antragsteller/in · FI Finanzen [OFFEN] · RM Ressourcenmanagement [OFFEN] · ADM Administrator/in

## 6. Systemgrenze

**Im System:** strategische Ziele, Jahresziele, Metriken · Ideen und Projektverträge · Bewertung, Priorisierung, Szenarien · Portfolioentscheide und Roadmap · Status, Gates, Änderungen, Abschluss · Finanzen, Risiken, Nutzen, Reporting · Ressourcen und Kapazitäten · Stakeholder und Kommunikation · drei Portfolioebenen.

**Ausserhalb / Umsysteme:** Strategiearbeit (Trends, PESTEL) · Budgetprozess (erhält Input) · ERP (Ist-Kosten, offen) · HR-System · operatives Projektmanagement (Aufgaben, Arbeitspakete, Detailplanung).

**Regel Projektebene:** Auf Projektebene hält das System nur Portfoliorelevantes – Status, Meilensteine, Budget, Risiken, Ressourcen, KPIs, Kommunikation – also alles, was das Portfolio zusammenzieht oder ein Gate als Nachweis braucht. Keine zu operative Projektleitung.

## 7. UX-Prinzip: Arbeitsräume

Der Funktionsbaum ist eine thematische Zerlegung, keine Navigationsstruktur. Das UI wird entlang von Abläufen gebaut:

- **Projekt:** Projektvertrag als Akte (Kapitel, Status, Gates, Versionen, Berichte).
- **Portfolio:** Liste, Matrix, Funnel, Dashboard je Kategorie A/B/C.
- **Gremium:** Sitzungen mit Traktanden, Vorlagen, Entscheiden.
- **Ziele:** Handlungsfelder, Ziele, Jahresziele mit Metrik und zugeordneten Projekten.
- **Eingang:** anstehende Aufgaben je Rolle, ereignisgesteuert. **Administration** separat.

Prüfregeln: Jeder Kernablauf läuft in seinem Heimat-Arbeitsraum, Übergaben laufen über den Eingang · jede wiederkehrende Aufgabe ist aus dem Eingang erreichbar · Daten werden einmal erfasst (Bericht, Vorlage und Dashboard sind Sichten auf den Projektvertrag) · Prototyp der Kernabläufe wird mit PL, UE und PRAT an realen Fällen getestet.

## 8. Funktionsbaum

Übersicht mit aktiven Business Cases (Kurz-ID = letzte Stelle). Ziel des Users, Akteure, Herleitung und Use Cases je Business Case: [anhang/funktionsbaum.md](anhang/funktionsbaum.md). Entfallen: PP.01.01 (→ ZM.01.02).

- **BM ZM Zielmanagement**
  - BD ZM.01 Strategie und Handlungsfelder: 01 Strategische Handlungsfelder pflegen; 02 Strategische Ziele festlegen
  - BD ZM.02 Jahresziele und Massnahmen: 01 Jahresziele ableiten; 02 Jahresziele freigeben; 03 Hauptaktivitäten festlegen; 04 Zielmetrik definieren
  - BD ZM.03 Zielerreichung und Reviews: 01 Zielerreichung erfassen; 02 Quartalsreporting an den VR erstellen; 03 Jahresrückblick auswerten
- **BM DM Demand Management**
  - BD DM.01 Projektideen: 01 Projektidee erfassen; 02 Projektidee qualifizieren; 03 Projektideen zusammenführen; 04 Projektidee zurückweisen
  - BD DM.02 Projektvertrag: 01 Projektvertrag erstellen; 02 Projektvertrag zur Prüfung einreichen; 03 Projektvertrag überarbeiten; 04 Projektvertrag zurückziehen; 05 Quality Review durchführen; 06 Projektvertrag freigeben; 07 Projektvertrag als Dokument ausgeben
- **BM PP Portfolioplanung**
  - BD PP.01 Strategische Ausrichtung: 02 Bewertungsmodell festlegen; 03 Portfoliokategorien und Budgetrahmen festlegen
  - BD PP.02 Bewertung und Priorisierung: 01 Vorhaben bewerten; 02 Vorhaben priorisieren; 03 Abhängigkeiten zwischen Vorhaben erfassen; 04 Projektkategorie zuordnen; 05 Vorhaben mit strategischen Zielen verknüpfen
  - BD PP.03 Szenarien und Balancing: 01 Portfolioszenario erstellen; 02 Szenario gegen Budget und Kapazität prüfen; 03 Szenarien vergleichen; 04 Portfolio in Matrixsicht beurteilen
  - BD PP.04 Portfolioentscheide: 01 Entscheidungsvorlage vorbereiten; 02 Portfolioentscheid erfassen; 03 Portfolio-Roadmap publizieren; 04 Projektorganisation festlegen; 05 Gate-Reviews einplanen
- **BM PS Portfoliosteuerung**
  - BD PS.01 Statusberichterstattung: 01 Statusbericht erfassen; 02 Statusbericht prüfen; 03 Ausstehende Statusberichte nachverfolgen; 04 Terminabweichungen analysieren
  - BD PS.02 Phasen, Gates, Meilensteine: 01 Phasenfreigabe beantragen; 02 Phasenfreigabe entscheiden; 03 Meilenstein abnehmen; 04 Meilensteinplan pflegen; 05 Projektvertrag fortschreiben
  - BD PS.03 Änderungen und Eskalationen: 01 Änderung am Projektvertrag beantragen; 02 Änderung am Projektvertrag entscheiden; 03 Eskalation behandeln; 04 Vertragsversionen vergleichen
  - BD PS.04 Abschluss: 01 Vorhaben abschliessen; 02 Vorhaben sistieren oder abbrechen; 03 Lessons Learned erfassen
  - BD PS.05 Stakeholder und Kommunikation: 01 Stakeholder erfassen; 02 Kommunikationsplan erstellen; 03 Kommunikationsmassnahme nachführen
- **BM PC Portfoliocontrolling**
  - BD PC.01 Finanzen: 01 Projektbudget planen; 02 Ist-Kosten übernehmen; 03 Kostenprognose aktualisieren; 04 Budgetabweichungen analysieren; 05 Budgetbedarf in den Budgetprozess übergeben
  - BD PC.02 Risiken: 01 Portfoliorisiko erfassen; 02 Risikolage des Portfolios beurteilen; 03 Risikomassnahme verfolgen; 04 Projektrisiko erfassen
  - BD PC.03 Nutzen und KPIs: 01 Projekt-KPIs festlegen; 02 Nutzenrealisierung überprüfen
  - BD PC.04 Reporting: 01 Portfolio-Dashboard einsehen; 02 Portfoliobericht erstellen; 03 Ad-hoc-Auswertung erstellen
- **BM RK Ressourcen und Kapazitäten**
  - BD RK.01 Kapazitätsangebot: 01 Kapazitätsangebot planen; 02 Personal- und Abwesenheitsdaten übernehmen
  - BD RK.02 Bedarf und Zuteilung: 01 Ressourcenbedarf anmelden; 02 Ressourcen zuteilen; 03 Ressourcenkonflikt auflösen; 04 Auslastung analysieren; 05 Ressourcenbedarf präzisieren; 06 ICT- und Infrastrukturbedarf anmelden
- **BM AM Application Management**
  - BD AM.01 Benutzer und Berechtigungen: 01 Benutzer verwalten; 02 Rolle mit Berechtigungen definieren; 03 Stellvertretung regeln
  - BD AM.02 Stammdaten und Konfiguration: 01 Organisationseinheiten verwalten; 02 Codetabellen pflegen; 03 Phasenmodell und Gates konfigurieren; 04 Portfolioebenen und Gremien konfigurieren
  - BD AM.03 Vorlagen, Schnittstellen, Protokoll: 01 Vorlagen verwalten; 02 Schnittstelle konfigurieren; 03 Änderungsprotokoll einsehen

## 9. Use Cases

● = Kernablauf. Business Cases je Use Case, Traceability-Matrix und ausformulierte Use Cases (UC-003, UC-004): [anhang/use-cases.md](anhang/use-cases.md).

| ID | Use Case | Kern | Heimat-Arbeitsraum | Primärakteur |
|---|---|---|---|---|
| UC-001 | Projektidee erfassen und qualifizieren |  | Portfolio (+ Projekt) | AS, UE |
| UC-002 | Projektvertrag erarbeiten und freigeben | ● | Projekt | PL |
| UC-003 | Gate-Übergang durchführen | ● | Projekt (+ Gremium) | PL |
| UC-004 | Monatlich berichten | ● | Projekt | PL |
| UC-005 | Statusberichte prüfen und nachverfolgen |  | Portfolio | UE |
| UC-006 | PRAT-Sitzung vorbereiten und durchführen | ● | Gremium (+ Portfolio) | UE, PRAT |
| UC-007 | Änderung am Projektvertrag beantragen und entscheiden |  | Projekt | PL, AG |
| UC-008 | Portfolio priorisieren und ausbalancieren | ● | Portfolio (+ Gremium) | UE, PRAT |
| UC-009 | Ressourcen planen und zuteilen |  | Portfolio (+ Projekt) | RM |
| UC-010 | Portfoliofinanzen überwachen |  | Portfolio | FI, UE |
| UC-011 | Ziele im Jahreszyklus festlegen | ● | Ziele (+ Portfolio) | GL, VR |
| UC-012 | Quartalsreporting an den VR erstellen |  | Ziele (+ Portfolio) | UE, CEO |
| UC-013 | Jahresrückblick auswerten |  | Gremium (+ Ziele) | PRAT |
| UC-014 | Portfolio auswerten |  | Portfolio | PRAT, GLPA, DIR, UE |
| UC-015 | Vorhaben abschliessen oder abbrechen |  | Projekt (+ Gremium) | PL, PRAT |
| UC-016 | Benutzer, Rollen und Stellvertretungen verwalten |  | Administration | ADM |
| UC-017 | Stammdaten und Governance konfigurieren |  | Administration | ADM, UE |
| UC-018 | Vorlagen und Schnittstellen verwalten |  | Administration | ADM |

## 10. Entscheide

1. Analytischer Erstentwurf aus Q1–Q5: 6 BM, 19 BD, 57 BC.
2. Q6 eingearbeitet: neues **BM ZM Zielmanagement**; drei Portfolioebenen; Gates P0–P4; Insel-Rollen als Akteure; PP.01.01 *entfällt* (→ ZM.01.02); PC.03.01 umbenannt in «Projekt-KPIs festlegen».
3. **PS.05 Stakeholder und Kommunikation** mit PS.05.01–03 aufgenommen; PS.05.04 «Kommunikationskalender abstimmen» bewusst **nicht**.
4. Portfoliorelevante Aspekte auf Projektebene ergänzt: PS.02.04 Meilensteinplan pflegen, PC.02.04 Projektrisiko erfassen, RK.02.05 Ressourcenbedarf präzisieren, RK.02.06 ICT- und Infrastrukturbedarf anmelden.
5. Q7 eingearbeitet: **Projektvertrag als strukturiertes Objekt je Projekt**, Dokument wird daraus erzeugt. DM.02 heisst «Projektvertrag»; neu DM.02.05–07, PS.02.05, PS.03.04; Zusammenzug im PPM über PS.01.04 Terminabweichungen und PP.04.05 Gate-Reviews einplanen. Änderungen am Vertrag gibt der Auftraggeber frei (PS.03.02).
6. **UX-Prinzip** festgelegt (siehe unten); 18 Use Cases definiert, UC-003 und UC-004 ausformuliert.

Vorgeschlagen, **nicht entschieden:** PC.03.03 «KPI-Werte nachführen» (laufende Ist-Werte der Projekt-KPIs, Q6 F1, F2).

## 11. Annahmen

- Strategiearbeit und PESTEL-Analyse liegen ausserhalb des Systems.
- Das Transformationsprogramm entspricht dem strategischen Portfolio (Kategorie A).
- Der Projektvertrag wird als Daten je Projekt geführt; das Dokument entsteht daraus.

## 12. Offene Punkte

- **Abkürzungen:** Wofür stehen GLPA, DIR, AeD, PFLE, DMS, DRC, «CP» (Gate-Modell F6) und «Streams» (F2)?
- **Auftraggeber und Sponsor:** verschiedene Personen? Was ist die Sponsoren-Koalition?
- **Kategorie B und C:** Gelten Projektvertrag, Gates und Quality Review auch dort? Entscheiden GLPA und DIR an den Gates?
- **Kriterienraster:** Kriterien und Gewichte für Kategorie A/B/C?
- **Zeithorizont:** Strategie 2035 (F1) oder Ziele 2030 (F3)? 3–5- oder Dreijahresziele?
- **Finanzen:** Kosten je Phase vs. Budget je Jahr – Umrechnung? Quelle der Ist-Kosten?
- **PM-Handbuch:** als Quelle anfordern (Pflichtangaben je Phase).
- **Reihenfolge:** Vertragsfreigabe vor oder nach dem PRAT-Gate-Entscheid?
- **Berichtswesen:** Rhythmus, Frist, Freigabe des Statusberichts durch den Sponsor? Projektstatus als eine Ampel oder je Dimension?
- **Abweichung:** Ab welcher Schwelle ist eine Abweichung wesentlich?
- **Ressourcen:** Reicht die Planung in FTE × Monate je Rolle und Phase, oder braucht es Kapazitätsplanung je Pool?

## 13. Nächste Schritte

1. UC-006 «PRAT-Sitzung vorbereiten und durchführen» ausformulieren.
2. Grobe Skizzen der Arbeitsräume Projekt und Gremium.
3. Prototyp-Test der Kernabläufe mit PL, UE und PRAT vorbereiten.
4. Offene Punkte mit der Insel Gruppe klären; PM-Handbuch als Quelle einarbeiten.

## 14. Anhang und Pflege

| Pfad | Inhalt |
|---|---|
| [anhang/funktionsbaum.md](anhang/funktionsbaum.md) | Funktionsbaum mit allen Business Cases im Detail |
| [anhang/use-cases.md](anhang/use-cases.md) | Use-Case-Liste, Traceability-Matrix, ausformulierte Use Cases |
| [anhang/daten/](anhang/daten/) | Funktionsbaum und Use Cases als JSON |
| [anhang/pdf/](anhang/pdf/) | gestaltete PDFs im CSP-Design |
| [anhang/quellen/](anhang/quellen/) | Kundenunterlagen Q6, Q7 im Original und als Text (intern) |
| [anhang/generator/](anhang/generator/) | Python-Skripte für die PDFs |

**Pflege**

- Dieses Masterdokument ist führend. Neue Entscheide, Annahmen und offene Punkte zuerst hier eintragen.
- Inhaltliche Quelle für Funktionsbaum und Use Cases sind `anhang/generator/daten.py` und `anhang/generator/uc_daten.py`; Anhang-Markdown, JSON und PDFs werden daraus erzeugt. Abschnitte 8 und 9 hier nachführen, wenn sich diese Daten ändern.
- IDs nie umnummerieren; Neues hinten anfügen, Gestrichenes als «entfällt» markieren.
- Der Generator setzt die CSP-Skills `csp-dokumente` und `csp-grafiken` voraus (Pfade `/mnt/skills/plugins/csp-solutions:*`) sowie `symbol.html`, `pruef.html` und `csp-assets/` im Arbeitsordner.
