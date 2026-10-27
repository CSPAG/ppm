# Umsetzungsstand

Stand der Umsetzung nach dem Bauplan [fachmodell.md](fachmodell.md). Jedes Arbeitspaket führt nur seine Zeilen nach: «in
Arbeit» beim ersten Push, «umgesetzt» mit PR-Nummer beim Merge, Annahmen (`A-nn`, [fachmodell.md Abschnitt
8](fachmodell.md#8-annahmen)) in der Spalte des Pakets.

Stände: **offen** · **in Arbeit** · **umgesetzt** · **teilweise** (Grundfunktion umgesetzt, Rest in späterem Paket).

## Arbeitspakete

| AP | Inhalt | Migr. | Stand | PR | Annahmen |
|---|---|---|---|---|---|
| S1 | Bauplan: fachmodell.md und umsetzungsstand.md | – | umgesetzt | #11 | A-01–A-47 festgelegt |
| AP-E0-0 | Webapp-Fundament und Navigation (Session S2) | – | in Arbeit (S2) | – | – |
| AP-E0-1 | Rechte Stufe «mittel», Orte Portfolio und Projekt | 010–019 | umgesetzt (Modell, 010, Matrix je Modul, Test «Lesesicht = can») | #14 | A-33, A-34, A-41, A-42, A-45, A-46 |
| AP-E0-2 | Organisation, Codetabellen, Feiertage | 020–029 | in Arbeit (PR 1 Tabellen und API; PR 2 Oberfläche UI-44, UI-45 folgt) | – | A-23, A-43; Arten der Organisationseinheit vorerst `direktion`/`bereich`; Vorgabewerte per Aktion «Vorgabe laden» |
| AP-E0-3 | Phasenmodell mit Gates, Leitfragen, Pflichtangaben, Fristen | 030–039 | umgesetzt (Modul, 030, Fristen in Arbeitstagen über `stammdaten`, UI-46) | #17 | A-10, A-12, A-13, A-27, A-43 |
| AP-E0-4 | Projekt, Projektorganisation, Meine Projekte, Übersicht | 040–049 | offen | – | – |
| AP-E0-5 | Portfolios und Gremien, Gremienweg | 050–059 | offen | – | – |
| AP-E0-6 | Register Projektdaten | 060–069 | offen | – | – |
| AP-E0-8 | Eingang, Mitteilungen, Stellvertretung | 070–079 | offen | – | – |
| AP-E0-9 | Strategische Ziele | 080–089 | umgesetzt (080, Modul `ziel`, `list_ziele`; Seite Ziele › Strategische Ziele) | #13, #23 | A-15 |
| AP-E0-7 | Übernahme aus dem Excel-Dashboard | 120–129 | offen | – | – |
| AP-E1-1 | Statusbericht erfassen | 090–099 | offen | – | – |
| AP-E1-2 | Monatsabschluss und Terminabweichungen | 100–109 | offen | – | – |
| AP-E1-3 | Dashboard der Periode | 110–119 | offen | – | – |
| AP-E2-1 | Sitzung, Traktanden, Versand | 130–139 | offen | – | – |
| AP-E2-2 | Sitzungsmodus, Entscheide, Auflagen, Protokoll | 140–149 | offen | – | – |
| AP-E2-3 | Portfoliobericht und Risikolage | 150–159 | offen | – | – |
| AP-E2-4 | Eskalation und Meilensteinabnahme | 160–169 | offen | – | – |
| AP-E3-1 | Projektakte mit Kapiteln und Pflichtangaben | 170–179 | offen | – | – |
| AP-E3-2 | Quality-Check und Unterzeichnen | 180–189 | offen | – | – |
| AP-E3-3 | Gate-Modus und Gate-Entscheid | 190–199 | offen | – | – |
| AP-E3-4 | Versionsvergleich und Änderungsantrag | 200–209 | offen | – | – |
| AP-E3-5 | Dokumentausgabe Projektvertrag | 210–219 | offen | – | – |
| AP-E4-1 | Projektidee einreichen | 220–229 | offen | – | – |
| AP-E4-2 | Ideenpool und Prüfung | 230–239 | offen | – | – |
| AP-E4-3 | Freigabe der Initialisierung | 240–249 | offen | – | – |
| AP-E5-1 | Bewertungsmodell und Bewertung | 250–259 | offen | – | – |
| AP-E5-2 | Matrix, Rangfolge, Portfoliorisiken | 260–269 | offen | – | – |
| AP-E5-4 | Kapazität und Auslastung | 270–279 | offen | – | – |
| AP-E5-3 | Szenarien mit Wasserlinie | 280–289 | offen | – | – |
| AP-E5-5 | Priorisierungsentscheid | 290–299 | offen | – | – |
| AP-E6-1 | Zielzyklus mit Jahreszielen | 300–309 | offen | – | – |
| AP-E6-2 | Freigabe Jahresziele und Roadmap | 310–319 | offen | – | – |
| AP-E6-3 | Zielerreichung | 320–329 | offen | – | – |
| AP-E6-4 | Quartalsreporting | 330–339 | offen | – | – |
| AP-E7-1 | Abschluss, Sistierung, Abbruch, Lessons Learned | 340–349 | offen | – | – |
| AP-E7-2 | Ressourcen zuteilen, Konflikte | 350–359 | offen | – | – |
| AP-E7-3 | Schnittstellen und Änderungsprotokoll | 360–369 | offen | – | – |
| AP-E7-4 | Finanzen | 370–379 | offen | – | – |
| AP-E7-5 | Jahresrückblick | 380–389 | offen | – | – |
| AP-E7-6 | Ad-hoc-Auswertungen | 390–399 | offen | – | – |
| AP-E7-7 | Vorlagen mit Feldzuordnung | 400–409 | offen | – | – |
| AP-E7-8 | Benutzer und Zugänge vollständig | 410–419 | offen | – | – |

## Business Cases

UC = Nummer des Use Case (UC-0nn). Etappe nach [Fahrplan](ux/fahrplan.md).

| BC | Business Case | UC | Etappe | Arbeitspaket | Stand | PR |
|---|---|---|---|---|---|---|
| ZM.01.01 | Strategische Handlungsfelder pflegen | 011 | E0 | – (besteht) | umgesetzt (Grundfunktion) | Gerüst (695ab82) |
| ZM.01.02 | Strategische Ziele festlegen | 011 | E0 | AP-E0-9 | umgesetzt (UC-011 Schritt 2; Ziele je Jahr in E6) | #13, #23 |
| ZM.02.01 | Jahresziele ableiten | 011 | E6 | AP-E6-1 | offen | – |
| ZM.02.02 | Jahresziele freigeben | 011 | E6 | AP-E6-2 | offen | – |
| ZM.02.03 | Hauptaktivitäten festlegen | 011 | E6 | AP-E6-1 | offen | – |
| ZM.02.04 | Zielmetrik definieren | 011 | E6 | AP-E6-1 | offen | – |
| ZM.03.01 | Zielerreichung erfassen | 012 | E6 | AP-E6-3 | offen | – |
| ZM.03.02 | Quartalsreporting an den VR erstellen | 012 | E6 | AP-E6-4 | offen | – |
| ZM.03.03 | Jahresrückblick auswerten | 013 | E7 | AP-E7-5 | offen | – |
| DM.01.01 | Projektidee erfassen | 001 | E4 | AP-E4-1 | offen | – |
| DM.01.02 | Projektidee qualifizieren | 001 | E4 | AP-E4-2 | offen | – |
| DM.01.03 | Projektideen zusammenführen | 001 | E4 | AP-E4-2 | offen | – |
| DM.01.04 | Projektidee zurückweisen | 001 | E4 | AP-E4-2 | offen | – |
| DM.02.01 | Projektvertrag erstellen | 002 | E3 | AP-E3-1 | offen | – |
| DM.02.02 | Projektvertrag zur Prüfung einreichen | 002 | E3 | AP-E3-1 | offen | – |
| DM.02.03 | Projektvertrag überarbeiten | 002, 003 | E3 | AP-E3-1, AP-E3-2 | offen | – |
| DM.02.04 | Projektvertrag zurückziehen | 002 | E3 | AP-E3-1 | offen | – |
| DM.02.05 | Quality Review durchführen | 002, 003 | E3 | AP-E3-2 | offen | – |
| DM.02.06 | Projektvertrag freigeben | 002, 003 | E3 | AP-E3-2, AP-E3-3 | offen | – |
| DM.02.07 | Projektvertrag als Dokument ausgeben | 002 | E3 | AP-E3-5 | offen | – |
| PP.01.02 | Bewertungsmodell festlegen | 008 | E5 | AP-E5-1 | offen | – |
| PP.01.03 | Portfoliokategorien und Budgetrahmen festlegen | 008 | E5 | AP-E5-1 | offen | – |
| PP.02.01 | Vorhaben bewerten | 008 | E5 | AP-E5-1 | offen | – |
| PP.02.02 | Vorhaben priorisieren | 008 | E5 | AP-E5-2 | offen | – |
| PP.02.03 | Abhängigkeiten zwischen Vorhaben erfassen | 002, 008 | E0, E5 | AP-E0-6, AP-E5-2 | offen | – |
| PP.02.04 | Projektkategorie zuordnen | 001 | E4 | AP-E4-2 | offen | – |
| PP.02.05 | Vorhaben mit strategischen Zielen verknüpfen | 002 | E3, E6 | AP-E3-1, AP-E6-1 | offen | – |
| PP.03.01 | Portfolioszenario erstellen | 008 | E5 | AP-E5-3 | offen | – |
| PP.03.02 | Szenario gegen Budget und Kapazität prüfen | 008 | E5 | AP-E5-3 | offen | – |
| PP.03.03 | Szenarien vergleichen | 008 | E5 | AP-E5-3 | offen | – |
| PP.03.04 | Portfolio in Matrixsicht beurteilen | 008 | E5 | AP-E5-2 | offen | – |
| PP.04.01 | Entscheidungsvorlage vorbereiten | 006 | E2 | AP-E2-1 | offen | – |
| PP.04.02 | Portfolioentscheid erfassen | 006 | E2 | AP-E2-2 | offen | – |
| PP.04.03 | Portfolio-Roadmap publizieren | 011 | E6 | AP-E6-2 | offen | – |
| PP.04.04 | Projektorganisation festlegen | 002 | E0 | AP-E0-4 | offen | – |
| PP.04.05 | Gate-Reviews einplanen | 006 | E2 | AP-E2-1 | offen | – |
| PS.01.01 | Statusbericht erfassen | 004 | E1 | AP-E1-1 | offen | – |
| PS.01.02 | Statusbericht prüfen | 005 | E1 | AP-E1-2 | offen | – |
| PS.01.03 | Ausstehende Statusberichte nachverfolgen | 005 | E1 | AP-E1-2 | offen | – |
| PS.01.04 | Terminabweichungen analysieren | 005 | E1 | AP-E1-2 | offen | – |
| PS.02.01 | Phasenfreigabe beantragen | 003 | E3 | AP-E3-3 | offen | – |
| PS.02.02 | Phasenfreigabe entscheiden | 003, 006 | E2, E3 | AP-E2-2, AP-E3-3 | offen | – |
| PS.02.03 | Meilenstein abnehmen | 006 | E2 | AP-E2-4 | offen | – |
| PS.02.04 | Meilensteinplan pflegen | 002, 004 | E0, E1 | AP-E0-6, AP-E1-1 | offen | – |
| PS.02.05 | Projektvertrag fortschreiben | 003 | E3 | AP-E3-3 | offen | – |
| PS.03.01 | Änderung am Projektvertrag beantragen | 007 | E3 | AP-E3-4 | offen | – |
| PS.03.02 | Änderung am Projektvertrag entscheiden | 007 | E3 | AP-E3-4 | offen | – |
| PS.03.03 | Eskalation behandeln | 004, 006 | E2 | AP-E2-4 | offen | – |
| PS.03.04 | Vertragsversionen vergleichen | 003, 007 | E3 | AP-E3-4 | offen | – |
| PS.04.01 | Vorhaben abschliessen | 015 | E7 | AP-E7-1 | offen | – |
| PS.04.02 | Vorhaben sistieren oder abbrechen | 006, 015 | E7 | AP-E7-1 | offen | – |
| PS.04.03 | Lessons Learned erfassen | 013, 015 | E7 | AP-E7-1, AP-E7-5 | offen | – |
| PS.05.01 | Stakeholder erfassen | 002 | E0, E3 | AP-E0-6, AP-E3-1 | offen | – |
| PS.05.02 | Kommunikationsplan erstellen | 002 | E0, E3 | AP-E0-6, AP-E3-1 | offen | – |
| PS.05.03 | Kommunikationsmassnahme nachführen | 004 | E1 | AP-E1-1 | offen | – |
| PC.01.01 | Projektbudget planen | 002 | E0, E3 | AP-E0-6, AP-E3-1 | offen | – |
| PC.01.02 | Ist-Kosten übernehmen | 010 | E7 | AP-E7-4 | offen | – |
| PC.01.03 | Kostenprognose aktualisieren | 004 | E1 | AP-E1-1 | offen | – |
| PC.01.04 | Budgetabweichungen analysieren | 010 | E7 | AP-E7-4 | offen | – |
| PC.01.05 | Budgetbedarf in den Budgetprozess übergeben | 010, 011 | E7 | AP-E7-4 | offen | – |
| PC.02.01 | Portfoliorisiko erfassen | 008 | E5 | AP-E5-2 | offen | – |
| PC.02.02 | Risikolage des Portfolios beurteilen | 006, 014 | E2 | AP-E2-3 | offen | – |
| PC.02.03 | Risikomassnahme verfolgen | 004 | E1 | AP-E1-1 | offen | – |
| PC.02.04 | Projektrisiko erfassen | 002, 004 | E0, E1 | AP-E0-6, AP-E1-1 | offen | – |
| PC.03.01 | Projekt-KPIs festlegen | 002 | E0, E3 | AP-E0-6, AP-E3-1 | offen | – |
| PC.03.02 | Nutzenrealisierung überprüfen | 003, 015 | E3, E7 | AP-E3-3, AP-E7-1 | offen | – |
| PC.03.03 | KPI-Werte nachführen | 004 | E1 | AP-E1-1 | offen | – |
| PC.03.04 | Business Case fortschreiben | 002, 003, 015 | E3, E7 | AP-E3-1, AP-E3-3, AP-E7-1 | offen | – |
| PC.04.01 | Portfolio-Dashboard einsehen | 014 | E1 | AP-E1-3 | offen | – |
| PC.04.02 | Portfoliobericht erstellen | 012, 014 | E2, E6 | AP-E2-3, AP-E6-4 | offen | – |
| PC.04.03 | Ad-hoc-Auswertung erstellen | 014 | E7 | AP-E7-6 | offen | – |
| RK.01.01 | Kapazitätsangebot planen | 009 | E5 | AP-E5-4 | offen | – |
| RK.01.02 | Personal- und Abwesenheitsdaten übernehmen | 009 | E7 | AP-E7-2 | offen | – |
| RK.02.01 | Ressourcenbedarf anmelden | 002 | E0, E3 | AP-E0-6, AP-E3-1 | offen | – |
| RK.02.02 | Ressourcen zuteilen | 009 | E7 | AP-E7-2 | offen | – |
| RK.02.03 | Ressourcenkonflikt auflösen | 009 | E7 | AP-E7-2 | offen | – |
| RK.02.04 | Auslastung analysieren | 008, 009 | E5 | AP-E5-4 | offen | – |
| RK.02.05 | Ressourcenbedarf präzisieren | 003 | E3 | AP-E3-3 | offen | – |
| RK.02.06 | ICT- und Infrastrukturbedarf anmelden | 002 | E0, E3 | AP-E0-6, AP-E3-1 | offen | – |
| AM.01.01 | Benutzer verwalten | 016 | E7 | AP-E7-8 (Baukasten) | offen | – |
| AM.01.02 | Rolle mit Berechtigungen definieren | 016 | E0, E7 | AP-E0-1, AP-E7-8 | offen | – |
| AM.01.03 | Stellvertretung regeln | 016 | E0 | AP-E0-8 | offen | – |
| AM.02.01 | Organisationseinheiten verwalten | 017 | E0 | AP-E0-2 | in Arbeit (API) | – |
| AM.02.02 | Codetabellen pflegen | 017 | E0 | AP-E0-2 | in Arbeit (API) | – |
| AM.02.03 | Phasenmodell und Gates konfigurieren | 017 | E0 | AP-E0-3 | umgesetzt | #17 |
| AM.02.04 | Portfolioebenen und Gremien konfigurieren | 017 | E0 | AP-E0-5 | offen | – |
| AM.03.01 | Vorlagen verwalten | 018 | E3, E7 | AP-E3-5, AP-E7-7 | offen | – |
| AM.03.02 | Schnittstelle konfigurieren | 018 | E7 | AP-E7-3 | teilweise (Webhooks) | Gerüst (695ab82) |
| AM.03.03 | Änderungsprotokoll einsehen | 018 | E7 | AP-E7-3 | offen | – |

PP.01.01 entfällt (aufgegangen in ZM.01.02).

Heute umgesetzt (Gerüst, vor dem Bauplan): **ZM.01.01** Handlungsfelder mit Verlauf, API, MCP und Seite unter Ziele ›
Handlungsfelder (Grundfunktion; Versionierung bei Strategie-Aktualisierung UC-011 A1 und Anzeige betroffener Ziele folgen
mit AP-E0-9 und AP-E6-1) · **AM.03.02** Webhooks (Profil outbox) als Teil der Schnittstellen; Schnittstellen zu Umsystemen
mit Laufprotokoll folgen mit AP-E7-3.

## Abnahme der Kernabläufe

Zielgrössen aus [ux/ablaeufe/](ux/ablaeufe/); Messung in der Abnahme der Etappe ([pruefung.md](ux/rahmen/pruefung.md#bei-der-abnahme-einer-etappe)).
«Test» = automatischer Test im Paket; übrige Werte im Aufgabentest oder im Betrieb.

| Ablauf | Zielgrösse | Soll | Messung | Paket | Ergebnis |
|---|---|---|---|---|---|
| K1-1 | Statusbericht ohne wesentliche Änderung (PPM-1) | ≤ 5 Min., ≤ 15 Interaktionen | Test (Interaktionen), Aufgabentest | AP-E1-1 | offen |
| K1-2 | Berichte bis zum 25. eingereicht | ≥ 90 % | Betrieb | AP-E1-1 | offen |
| K1-3 | Prüfung unauffälliger Bericht | ≤ 1 Min. ohne Detail | Aufgabentest | AP-E1-2 | offen |
| K1-4 | Auffälligkeiten erkannt | 5 von 5 in 30 Berichten | Aufgabentest (Testdaten im Paket) | AP-E1-2 | offen |
| K1-5 | Periode bis Monatsende ohne Excel (PPM-3) | 100 %, 0 Dateien | Betrieb | AP-E1-2 | offen |
| K2-1 | Unterzeichnen auf dem Telefon (PPM-2) | ≤ 60 s, ≤ 3 Interaktionen | Test bei 360 px, Aufgabentest | AP-E3-2 | offen |
| K2-2 | Quality-Checks ohne Rückmeldung | ≥ 70 % | Betrieb | AP-E3-2 | offen |
| K2-3 | Eingereicht → unterzeichnet | Median ≤ 5 Arbeitstage | Betrieb | AP-E3-2 | offen |
| K2-4 | Fehlende Pflichtangaben auffinden | 1 Klick, 100 % | Test | AP-E3-1 | offen |
| K2-5 | Gate Review Packet ohne Dateien (PPM-4) | 0 Dateien | Aufgabentest, Betrieb | AP-E3-3 | offen |
| K3-1 | Unterlagen ≥ 5 Arbeitstage vorher | 100 % | Betrieb (Versandprotokoll) | AP-E2-1 | offen |
| K3-2 | Traktandenliste versandbereit | ≤ 30 Min. | Aufgabentest | AP-E2-1 | offen |
| K3-3 | Entscheid erfassen | ≤ 60 s je Traktandum | Test (Messung im Sitzungsmodus) | AP-E2-2 | offen |
| K3-4 | Protokoll ≤ 3 Arbeitstage | 100 % | Betrieb | AP-E2-2 | offen |
| K3-5 | Antrag und Hauptänderungen finden (PPM-5) | ≥ 90 %, ≤ 30 s, Tablet | Aufgabentest | AP-E2-2 | offen |
| K4-1 | Idee ohne Hilfe einreichen | ≥ 90 % | Aufgabentest | AP-E4-1 | offen |
| K4-2 | Zeit zum Einreichen | ≤ 10 Min. | Aufgabentest | AP-E4-1 | offen |
| K4-3 | Ideen mit Rückfrage | ≤ 20 % | Betrieb | AP-E4-2 | offen |
| K4-4 | Einreichung → bereit für das Gremium | Median ≤ 20 Arbeitstage | Betrieb | AP-E4-2 | offen |
| K5-1 | Rang verschieben → Wasserlinie | ≤ 200 ms, ≤ 1 s bei 60 Projekten | Test | AP-E5-3 | offen |
| K5-2 | 15 × 7 Bewertungen nur Tastatur | ≤ 10 Min. | Aufgabentest | AP-E5-1 | offen |
| K5-3 | Entscheidungsvorlage ohne Dateien | 0 Dateien | Aufgabentest | AP-E5-5 | offen |
| K5-4 | Projekte unter der Wasserlinie und Engpass nennen | ≥ 90 % | Aufgabentest | AP-E5-3 | offen |
| K6-1 | Jahresziel mit Metrik und Hauptaktivität | ≤ 3 Min. | Aufgabentest | AP-E6-1 | offen |
| K6-2 | Projekt ↔ strategisches Ziel | ≤ 2 Klicks | Test | AP-E6-1 | offen |
| K6-3 | Zielerreichung 30 Ziele | ≤ 20 Min. | Aufgabentest | AP-E6-3 | offen |
| K6-4 | Entwurf Quartalsreporting | ≤ 30 Min., ohne Dateien | Aufgabentest | AP-E6-4 | offen |
| E0 | Q-L1, Q-L6, Q-B1–B6 auf allen Bausteinen; G1 je Rolle | wie qualitaetsziele.md | CI, Review | AP-E0-0, AP-E0-8 | offen |
| E7 | Q-W1, Q-W2 je Rolle, PPM-6 | ≥ 90 %, SUS ≥ 75 | Test mit 5 Personen je Rolle | alle | offen |

## UX-Definition of Done je PR

Jeder PR mit Oberfläche trägt die Checkliste aus [pruefung.md](ux/rahmen/pruefung.md) im PR-Text und hier eine Zeile.

| PR | AP | Seitentyp und Zustände | Tastatur | axe hell/dunkel | 360/768/1440 px | Texte zentral, «Sie» | Zielgrössen |
|---|---|---|---|---|---|---|---|
| #23 | AP-E0-9 | Liste + Schublade; Z1, Z2, Z3, Z5, unbekannte Nummer | ja (Datenliste, Formular) | ohne Befund (E2E hell, dunkel; jsdom) | 360 px ohne Überlauf (E2E «schmal»); 768/1440 nicht eigens geprüft | ja (Feature-Texte), «Sie» | – (keine Zielgrösse in E0) |
| #17 | AP-E0-3 | Arbeitsfläche; Z1, Z2, Z5, Z7–Z10 | vollständig, Strg+Z/Strg+Umschalt+Z | ohne Befund | geprüft (360/1024/1280/1440) | ja | keine Zielgrössen (kein Kernablauf für UC-017) |
