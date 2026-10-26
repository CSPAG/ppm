# PPM Insel Gruppe – Masterdokument

**Führendes Dokument** für die fachliche Spezifikation von Strategieumsetzung und Projektportfoliomanagement (PPM) der Insel Gruppe. Alle Entscheide, Annahmen und offenen Punkte werden hier geführt; Details stehen im [Anhang](anhang/).

| | |
|---|---|
| Stand | 26. Oktober 2026 |
| Status | Entwurf, nicht mit dem Kunden validiert |
| Verantwortlich | André Hochreutener, CSP AG |
| Umfang | 7 Business Modules · 23 Business Domains · 89 Business Cases · 18 Use Cases |

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
| Q8 | Insel Gruppe, Handbuch zum strategischen Projekt- und Programmmanagement (PM-Handbuch), Version 0.92 vom 02.09.2026, präfinal (Kap. 1 Geltungsbereich, 4 Governance, 5 Rollen, 6 Portfolio- und Priorisierungsmodell, 7 Phasenmodell und Lieferergebnisse, 8 Steuerung und Reporting, 9 Status und Eskalation, 10 Risiko, 11 Change und Kommunikation, 12 Kernteam, 13 Templates, 14 Glossar, Anhang 1 Deliverable-Matrix) | empirisch | [quellen/Q8_PM-Handbuch_Insel_0.92.docx](anhang/quellen/Q8_PM-Handbuch_Insel_0.92.docx), Text mit transkribierten Abbildungen: [Q8_PM-Handbuch_Insel_0.92.md](anhang/quellen/Q8_PM-Handbuch_Insel_0.92.md), Abbildungen: `Q8_Abb*`, [Q8_Anhang1_Deliverable-Matrix.png](anhang/quellen/Q8_Anhang1_Deliverable-Matrix.png) |
| Q9 | Insel Gruppe, Strategie 2035, vom VR am 13.06.2025 verabschiedet (Vorwort, Werte, Vision, fünf Handlungsfelder mit Leitsatz und Stossrichtungen), öffentlich, [insel.ch](https://www.insel.ch/fileadmin/Insel_Gruppe/Dokumente/Publikationen/ING-Strategie-2035-de.pdf) | empirisch | [quellen/Q9_Strategie_2035.pdf](anhang/quellen/Q9_Strategie_2035.pdf), Text: [Q9_Strategie_2035.md](anhang/quellen/Q9_Strategie_2035.md) |
| Q1 | Lebenszyklus der Geschäftsobjekte | analytisch | – |
| Q2 | Event-Partitionierung (externe, zeitliche, interne Ereignisse) | analytisch | – |
| Q3 | Ziele je Akteur | analytisch | – |
| Q4 | PMI, The Standard for Portfolio Management | Referenzstandard | – |
| Q5 | AXELOS, Management of Portfolios (MoP) | Referenzstandard | – |

Q6, Q7 und Q8 enthalten Kundenmaterial (Klassifikation intern) und Personennamen (Dashboard Q6, Dokumentbesitz Q8). Nur in privaten Repositories ablegen. Q9 ist öffentlich.

## 4. Fachliche Eckpunkte der Insel Gruppe

- **Zielkette (Q9, Q6 F1, F3):** Strategie 2035 (vom VR am 13.06.2025 verabschiedet; Vision und Werte Respekt, Exzellenz, Verantwortung) → 5 strategische Handlungsfelder mit Leitsatz und Stossrichtungen: Mitarbeitende und Unternehmenskultur · Patientenorientierung · Medizin der Zukunft · Marktpositionierung und Vernetzung · Wirtschaftlichkeit → strategische Ziele (Horizont 2030) → Jahresziele (z. B. 2027) → Hauptaktivitäten → Projekte; je Ziel eine Metrik. Q9 nennt zwischen strategischen Zielen und Massnahmen/Projekten «kurz-, mittel- und langfristige Ziele».
- **Drei Portfolios = Projektkategorien (Q8 Kap. 1, 6):** A strategisches Transformationsportfolio = Transformationsprogramm (Gremium PRAT), B taktisch-operatives Portfolio der Geschäftsleitung (GLPA), C operative Portfolios der Direktionen (DIR). Geltung des PM-Handbuchs: für A verbindlich (Programm- und Projekt-Governance), für B die Projekt-Governance (Phasenmodell, Rollen, Steuerung, Reporting), für C keine Vorgaben, Orientierung empfohlen; C braucht kein Reporting an die GL. Zuordnung über das Kriterienraster «Tiering» (Relevanz, Anzahl betroffener Direktionen, Abhängigkeiten, Bedarf an zentraler Priorisierung und Finanzierung, Change-Aufwand) als Gesamtbeurteilung, nicht als starre Logik.
- **Priorisierung (Q8 Kap. 6.1):** Ideen kommen aus Innovationsprozess und jährlichem Strategieprozess in den Ideenpool; Ablauf: Erfassung → erste Bewertung der strategischen Relevanz → Entscheid strategisch, taktisch-operativ oder operativ → Priorisierung → Freigabe Initialisierung. Kriterien: Strategiebeitrag, Transformationsrelevanz, Anzahl betroffener Bereiche, Komplexität und Abhängigkeiten, Finanzierungsbedarf, Ressourcenverfügbarkeit, Kommunikations- und Change-Aufwand.
- **Phasenmodell:** Pre-P0 Ideen, P0 Initialisierung (mit optionaler Vorstudie), P1 Konzept & Planung, P2 Implementierung, P3 Stabilisierung & Monitoring, P4 Abschluss; Gates P0 Eintritt, P0–P1, P1–P2, P2–P3 (Go-Live), P3–P4, P4 Exit mit je fünf Leitfragen entlang der **Werteströme** Business Value (Nutzen), Projektmanagement, klinische Transformation und Lösungsdesign, Integration ICT (DTI) und Infrastruktur (DBI) (Q6 F6, Q8 Kap. 7.6, Abb. 4, 6). Lieferergebnisse je Phase: Business Case P0 initial, P1 Baseline, P2–P3 Update, P4 Abschluss; Projektvertrag für die jeweils nächste Phase; Lösungskonzept (P1); Abschlussbericht (P4); Details in der Deliverable-Matrix (Q8 Anhang 1).
- **Gremienweg (Q8 Kap. 5.1, 8.1, 8.2):** PL → Projektsponsor → UE (Quality-Check, Traktandierung) → PRAT entscheidet über Gates, Freigaben und Projektvereinbarungen je Phase. In P0 und P1 laufen relevante Meilensteine und Gates bis zur Freigabe von P2 zusätzlich über den SNS-VR; ab P2 steuert der PRAT, der VR wird quartalsweise informiert. Gate Review Packet 5 Arbeitstage vor der Sitzung; im PRAT ca. 20 Min. Präsentation PL/CTL, 10 Min. Diskussion, 5 Min. Entscheid; Protokoll nach 2–3 Arbeitstagen. Für Kategorie B entscheidet die GLPA (Q8 Kap. 7).
- **Jahreszyklus (F2):** Strategie-Aktualisierung (VR mit GL), Zielsetzung (Freigabe VR, Input Budgetprozess), Vorbereitung und Start Umsetzung, monatlicher operativer Review (PRAT: Priorisierung, Freigaben, Meilensteine, Eskalationen), quartalsweiser strategischer Review (VR), Jahresrückblick (PRAT).
- **Reporting und Status (Q8 Kap. 8.3–8.7, 9):** Das Dashboard ist «Single Source of Truth», heute in Excel geführt. PL aktualisiert mindestens monatlich bis zum 25., bei wesentlichen Entwicklungen sofort; UE konsolidiert und prüft bis Monatsende; ab dem 1. geht das Dashboard an die Gremien. Inhalt: Status, Fortschritt und Meilensteine, Risiken und Eskalationen, Abweichungen bei Inhalt, Termin, Ressourcen, Budget, Abhängigkeiten, anstehende Entscheide und Meilensteinfreigaben. Die Programmleitung (UE) berichtet monatlich an den PRAT, der PRAT quartalsweise an den VR. Status zweistufig: grün «im Plan» / rot «kritisch», dazu Trend aufwärts / gleichbleibend / abwärts. Rot heisst Eskalation, beurteilt nach Zeit, Kosten/Aufwand, Ergebnis/Qualität.
- **Projektvertrag (Q7; in Q8 «Projektvereinbarung»):** zentrales, lebendes Steuerungsdokument je Projekt; wird an jedem Gate für die nächste Phase fortgeschrieben; Status geplant / in Arbeit / in Prüfung / abgenommen; Quality Review durch UE; Unterzeichnung durch Auftraggeber/Sponsor, PL, CTL; Freigabe je Phase durch den PRAT (Q8 Kap. 5.1); die freigegebene Version ist verbindlich (Baseline).
- **Risiko, Change, Kommunikation (Q8 Kap. 10, 11):** pragmatischer Minimalstandard, kein formalisiertes Risikomodell; Programmleitung führt projektübergreifende Risiken und Abhängigkeiten. Change nach ADKAR; UE und Unternehmenskommunikation unterstützen bedarfsorientiert.
- **PL und CTL (Q8 Abb. 7):** PL führt bei Zeit, Budget und Lieferergebnis, CTL bei klinischer Qualität und Patientensicherheit; bei Konflikt entscheiden Sponsor oder Sponsoren-Koalition.

## 5. Akteure

VR Verwaltungsrat (Programmauftraggeber) · SNS Strategie-, Nominations- und Strukturausschuss des VR (Schnittstelle PRAT ↔ VR; Gates in P0 und P1) · CEO Programmsponsor · PRAT Programmausschuss Transformation (GL) · UE Unternehmensentwicklung (Programmleitung) · PMO Project Management Office (unterstützt die Programmleitung bei Reporting und Dokumentation) · GL Geschäftsleitung · GLPA GL Portfolio Ausschuss (Portfolio B) · DIR Direktionen (Portfolio C; im Kernteam vertreten als AeD, DPF, DLF, DMS, DTI, DP, DIB) · AG/SP Projektauftraggeber und -sponsor, eine Rolle (GL-Mitglied, bei B die GL, bei C die Direktion; Q8 Kap. 1) · PL Projektleitung · CTL Clinical Transformation Lead · KT Kernteam · AS Antragsteller/in · KOM Unternehmenskommunikation (Change und Kommunikation, mit UE) · DTI/DBI zuständige Stellen für ICT und Infrastruktur · FI Finanzen [OFFEN] · RM Ressourcenmanagement [OFFEN] · ADM Administrator/in

## 6. Systemgrenze

**Im System:** strategische Ziele, Jahresziele, Metriken · Ideen und Projektverträge · Bewertung, Priorisierung, Szenarien · Portfolioentscheide und Roadmap · Status, Gates, Änderungen, Abschluss · Finanzen, Risiken, Nutzen, Reporting · Ressourcen und Kapazitäten · Stakeholder und Kommunikation · drei Portfolioebenen.

**Ausserhalb / Umsysteme:** Strategiearbeit (Trends, PESTEL, Vision und Werte) · Budgetprozess (erhält Input) · ERP (Ist-Kosten, offen) · HR-System · ICT- und Infrastruktur-Projektprozesse mit eigenen Investitionsfreigaben (DTI, DBI; Q8 Abb. 4) · operatives Projektmanagement (Aufgaben, Arbeitspakete, Detailplanung, RAID-Log mit Actions und Issues, Lösungskonzept, SOPs, Change-Management-Plan) · heutiges Excel-Dashboard (wird abgelöst; Datenübernahme offen).

**Regel Projektebene:** Auf Projektebene hält das System nur Portfoliorelevantes – Status, Meilensteine, Budget, Risiken, Ressourcen, KPIs, Business Case, Kommunikation, Entscheide und Eskalationen – also alles, was das Portfolio zusammenzieht oder ein Gate als Nachweis braucht. Keine zu operative Projektleitung.

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
  - BD PC.03 Nutzen und KPIs: 01 Projekt-KPIs festlegen; 02 Nutzenrealisierung überprüfen; 03 KPI-Werte nachführen; 04 Business Case fortschreiben
  - BD PC.04 Reporting: 01 Portfolio-Dashboard einsehen; 02 Portfoliobericht erstellen; 03 Ad-hoc-Auswertung erstellen
- **BM RK Ressourcen und Kapazitäten**
  - BD RK.01 Kapazitätsangebot: 01 Kapazitätsangebot planen; 02 Personal- und Abwesenheitsdaten übernehmen
  - BD RK.02 Bedarf und Zuteilung: 01 Ressourcenbedarf anmelden; 02 Ressourcen zuteilen; 03 Ressourcenkonflikt auflösen; 04 Auslastung analysieren; 05 Ressourcenbedarf präzisieren; 06 ICT- und Infrastrukturbedarf anmelden
- **BM AM Application Management**
  - BD AM.01 Benutzer und Berechtigungen: 01 Benutzer verwalten; 02 Rolle mit Berechtigungen definieren; 03 Stellvertretung regeln
  - BD AM.02 Stammdaten und Konfiguration: 01 Organisationseinheiten verwalten; 02 Codetabellen pflegen; 03 Phasenmodell und Gates konfigurieren; 04 Portfolioebenen und Gremien konfigurieren
  - BD AM.03 Vorlagen, Schnittstellen, Protokoll: 01 Vorlagen verwalten; 02 Schnittstelle konfigurieren; 03 Änderungsprotokoll einsehen

## 9. Use Cases

● = Kernablauf. Business Cases je Use Case, Traceability-Matrix und alle 18 ausformulierten Use Cases: [anhang/use-cases.md](anhang/use-cases.md).

| ID | Use Case | Kern | Heimat-Arbeitsraum | Primärakteur |
|---|---|---|---|---|
| UC-001 | Projektidee erfassen und qualifizieren |  | Portfolio (+ Projekt) | AS, UE |
| UC-002 | Projektvertrag erarbeiten und freigeben | ● | Projekt | PL |
| UC-003 | Gate-Übergang durchführen | ● | Projekt (+ Gremium) | PL |
| UC-004 | Monatlich berichten | ● | Projekt | PL |
| UC-005 | Statusberichte prüfen und nachverfolgen |  | Portfolio | UE |
| UC-006 | PRAT-Sitzung vorbereiten und durchführen | ● | Gremium (+ Portfolio) | UE, PRAT |
| UC-007 | Änderung am Projektvertrag beantragen und entscheiden |  | Projekt | PL, SP |
| UC-008 | Portfolio priorisieren und ausbalancieren | ● | Portfolio (+ Gremium) | UE, PRAT |
| UC-009 | Ressourcen planen und zuteilen |  | Portfolio (+ Projekt) | RM |
| UC-010 | Portfoliofinanzen überwachen |  | Portfolio | FI, UE |
| UC-011 | Ziele im Jahreszyklus festlegen | ● | Ziele (+ Portfolio) | GL, VR |
| UC-012 | Quartalsreporting an den VR erstellen |  | Ziele (+ Portfolio) | UE, PRAT |
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
7. **Q8 PM-Handbuch 0.92 und Q9 Strategie 2035** als Quellen aufgenommen; Fakten in Abschnitt 4 bis 6, Annahmen und offenen Punkten eingearbeitet.
8. Änderungen aus Q8 und Q9 im Funktionsbaum und in den Use Cases übernommen (Vorschläge V1–V9, V11–V13):
   - **Neu:** PC.03.03 «KPI-Werte nachführen» (UC-004) und PC.03.04 «Business Case fortschreiben» (UC-002, UC-003, UC-015).
   - **Gremienweg:** PS.02.02 entscheidet je Phase und Kategorie (PRAT; in P0 und P1 bis zur Freigabe von P2 zusätzlich SNS-VR; Kategorie B GLPA); AM.02.04 bildet den Gremienweg ab.
   - **Projektvertrag:** SP, PL und CTL unterzeichnen; die Freigabe für die nächste Phase erteilt das Gremium im Gate-Entscheid (DM.02.06). Änderungen entscheidet der SP, Änderungen an Scope, Budget oder Ressourcen der PRAT (PS.03.02). Der Akteur AG geht in SP auf.
   - **Reporting:** Statusbericht nach Q8 mit Stichtag 25., Status im Plan/kritisch, Trend, Abweichungen je Dimension, Abhängigkeiten und anstehenden Entscheiden (PS.01.01); «kritisch» führt bei Entscheidbedarf zur Eskalation (PS.03.03, neu in UC-004). Quartalsreporting an den VR durch den PRAT (ZM.03.02, UC-012).
   - **Konfiguration:** Codetabellen Status und Trend (AM.02.02); Phasenmodell mit Leitfragen je Wertestrom und Standard-Lieferergebnissen je Phase (AM.02.03).
   - **Weitere Beschriebe:** Handlungsfelder mit Leitsatz und Stossrichtungen als Stammdaten (ZM.01.01); Projektidee nach Vorlage des PM-Handbuchs (DM.01.01–02); Gate Review Packet 5 Arbeitstage vor der Sitzung, Protokoll nach 2–3 Arbeitstagen (PP.04.01–02).
   - **Herleitungen:** Q8 und Q9 bei 36 bestehenden Business Cases als Beleg nachgetragen.
   - **UC-003 und UC-004** an Q8 angepasst; die [OFFEN] zu Reihenfolge, Rhythmus, Frist und Freigabe durch den Sponsor sind geschlossen.
9. **UC-006** «PRAT-Sitzung vorbereiten und durchführen» nach Q8 Kap. 8.1–8.5 ausformuliert. Offen dort: Vorlage an den SNS-VR in P0 und P1, Weiterleitung an den VR ausserhalb des Quartalsreportings.
10. **Alle 18 Use Cases ausformuliert** (CSP-Vorlage). Fehlende Grundlagen sind als [OFFEN] markiert und unter «Aus den Use Cases» in den offenen Punkten gesammelt.

**Vorgeschlagen, nicht entschieden**

- **V10 Bewertungsmodell:** PP.01.02 «Bewertungsmodell festlegen» verlangt heute «Kriterien und Gewichte». Laut Q8 sind Kriterienraster und Priorisierungskriterien eine Orientierung für eine Gesamtbeurteilung, kein Rechenmodell. Vorschlag: Das System führt die Kriterien als Checkliste mit Einschätzung je Kriterium, rechnet aber keinen gewichteten Score. Offen, bis die Insel Gruppe entschieden hat, ob sie einen Score will (siehe offene Punkte).

## 11. Annahmen

- Strategiearbeit und PESTEL-Analyse liegen ausserhalb des Systems; Vision und Werte (Q9) ebenfalls.
- Der Projektvertrag wird als Daten je Projekt geführt; das Dokument entsteht daraus.
- «Projektvereinbarung» (Q8) und «Projektvertrag» (Q7, Q8 Abb. 4 und Anhang 1) bezeichnen dasselbe; die Spezifikation bleibt bei «Projektvertrag».
- Q8 Kap. 7.4 «Phase 4: Stabilisierung & Monitoring» ist ein Schreibfehler für Phase 3.
- Kategorie C nutzt das System freiwillig; die Funktionen werden nicht eingeschränkt, Pflichten (Gates, Reporting) gelten nur für A und B.

## 12. Offene Punkte

Alle offenen Punkte mit Fundstelle und Vorschlag von CSP als Fragen K01–K25: [anhang/klaerungsliste.md](anhang/klaerungsliste.md).

Erledigt durch Q8 und Q9: GLPA, DIR, SNS, Rolle Auftraggeber/Sponsor, Geltung für Kategorie B und C, Reihenfolge Vertragsfreigabe und Gate, Berichtsrhythmus und Frist, Freigabe des Berichts durch den Sponsor (keine), Ampel (eine Ampel plus Trend), Zuordnung Kategorie A = Transformationsprogramm, PM-Handbuch als Quelle.

- **Abkürzungen:** Ausschreibung der Direktionskürzel AeD, DPF, DLF, DMS, DP, DTI (laut Q8 ICT) und DIB bzw. DBI (Q8 schreibt beides; Infrastruktur); PFLE (Q6 F1), DRC (Dashboard), «CP» in Phase 1 (Q6 F6, Q8 Abb. 4) und «Streams» (F2)?
- **Sponsoren-Koalition:** Wer gehört dazu? Sie entscheidet Konflikte zwischen PL und CTL (Q8 Abb. 7). Q7 verlangt Freigabe durch «Auftraggeber» und «Sponsor» getrennt – ist das dieselbe Person?
- **SNS-VR und VR:** Wie werden Geschäfte in P0 und P1 dem SNS-VR vorgelegt und dessen Entscheide erfasst? Gibt es Weiterleitungen an den VR ausserhalb des Quartalsreportings (UC-006 A1, A4)?
- **Programmauftraggeber:** VR (Q8 Kap. 1, 5.1) oder VR-Präsident (Q8 Glossar «VRP»)?
- **Kategorie B:** Gelten Quality-Check durch UE, monatliches Dashboard und Projektvertrag auch für GL-Projekte? Sitzungsrhythmus der GLPA?
- **Kategorie C:** Soll das System Direktionsportfolios überhaupt führen, oder genügt eine Projektliste ohne Governance?
- **Kriterienraster (V10):** Bleibt es bei der qualitativen Gesamtbeurteilung (Q8), oder braucht die Priorisierung (Q6 F9 Matrix) doch Gewichte und einen Score?
- **Zeithorizont:** Sind die «3–5-Jahresziele» (Q6 F1) und «Dreijahresziele» (F2) die strategischen Ziele 2030 (F3)? Ist die Ebene «kurz-, mittel- und langfristige Ziele» (Q9) eine eigene Stufe?
- **Finanzen:** Kosten je Phase vs. Budget je Jahr – Umrechnung? Quelle der Ist-Kosten? Struktur des Business Case (Kosten/Nutzen, Top Line/Bottom Line, Q6 F8)?
- **Pflichtangaben je Phase:** Q8 Anhang 1 nennt Lieferergebnisse, aber keine Pflichtfelder des Projektvertrags je Phase. Abgleich mit Q7 nötig. Wann erscheint die Finalversion von Q8?
- **Abweichung:** Ab welcher Schwelle ist eine Abweichung wesentlich? Q8 spricht von «definierten Toleranzen», nennt aber keine.
- **Ressourcen:** Reicht die Planung in FTE × Monate je Rolle und Phase («Ressourcensteuerung auf Top-Level», Q8 Abb. 3), oder braucht es Kapazitätsplanung je Pool?
- **Datenübernahme:** Werden die Projekte aus dem heutigen Excel-Dashboard initial übernommen?
- **Aus den Use Cases:** Wer benennt Sponsor und Projektleitung bei der Freigabe der Initialisierung (UC-001)? Darf die UE eine Idee allein zurückweisen (UC-001 A3)? Wie wird mit fehlenden Statusberichten umgegangen (UC-005 A3)? Wie werden sistierte Vorhaben wieder aufgenommen (UC-015)? Gilt eine neue Version des Phasenmodells auch für laufende Phasen (UC-017)? Werden Benutzer aus HR-System oder Verzeichnisdienst übernommen (UC-016)?
- **ICT und Infrastruktur:** Wie werden die eigenen Projekt- und Investitionsprozesse von DTI und DBI angebunden (Meldung, Status, Freigaben)?

## 13. Nächste Schritte

1. PDFs mit dem Generator neu erzeugen und in `anhang/pdf/` ablegen (braucht die CSP-Skills); die alten PDFs (Stand vor Entscheid 8) sind gelöscht.
2. Use Cases mit PL, UE und PRAT durchgehen und die Klärungsliste K01–K25 beantworten; Antworten hier als Entscheid oder Annahme eintragen.
3. V10 mit der Insel Gruppe klären.
4. Grobe Skizzen der Arbeitsräume Projekt und Gremium.
5. Prototyp-Test der Kernabläufe mit PL, UE und PRAT vorbereiten.
6. Offene Punkte mit der Insel Gruppe klären.

## 14. Anhang und Pflege

| Pfad | Inhalt |
|---|---|
| [anhang/funktionsbaum.md](anhang/funktionsbaum.md) | Funktionsbaum mit allen Business Cases im Detail |
| [anhang/use-cases.md](anhang/use-cases.md) | Use-Case-Liste, Traceability-Matrix, ausformulierte Use Cases |
| [anhang/klaerungsliste.md](anhang/klaerungsliste.md) | offene Fragen K01–K25 mit Fundstelle und Vorschlag |
| [anhang/daten/](anhang/daten/) | Funktionsbaum und Use Cases als JSON |
| [anhang/quellen/](anhang/quellen/) | Kundenunterlagen Q6–Q9 im Original und als Text (Q6–Q8 intern, Q9 öffentlich) |
| [anhang/generator/](anhang/generator/) | Python-Skripte für PDFs, Markdown und JSON |

**Pflege**

- Dieses Masterdokument ist führend. Neue Entscheide, Annahmen und offene Punkte zuerst hier eintragen.
- Inhaltliche Quelle für Funktionsbaum und Use Cases sind `anhang/generator/daten.py`, `anhang/generator/uc_daten.py` und für die ausformulierten Use Cases `anhang/generator/uc_texte.py`; Anhang-Markdown, JSON und PDFs werden daraus erzeugt. Markdown und JSON erzeugt `anhang/generator/markdown.py`; die ausformulierten Use Cases liefert `use_cases_pdf.py` als `uc_ausformuliert.md`. Abschnitte 8 und 9 hier nachführen, wenn sich diese Daten ändern.
- IDs nie umnummerieren; Neues hinten anfügen, Gestrichenes als «entfällt» markieren.
- Der Generator setzt die CSP-Skills `csp-dokumente` und `csp-grafiken` voraus (Pfade `/mnt/skills/plugins/csp-solutions:*`) sowie `symbol.html`, `pruef.html` und `csp-assets/` im Arbeitsordner.
