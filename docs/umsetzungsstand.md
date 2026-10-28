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
| AP-E0-2 | Organisation, Codetabellen, Feiertage | 020–029 | umgesetzt (PR 1 Tabellen und API, PR 2 Oberfläche UI-44, UI-45) | #20, #26 | A-23, A-43; Arten der Organisationseinheit vorerst `direktion`/`bereich`; Vorgabewerte per Aktion «Vorgabe laden» |
| AP-E0-3 | Phasenmodell mit Gates, Leitfragen, Pflichtangaben, Fristen | 030–039 | umgesetzt (Modul, 030, Fristen in Arbeitstagen über `stammdaten`, UI-46) | #17 | A-10, A-12, A-13, A-27, A-43 |
| AP-E0-4 | Projekt, Projektorganisation, Meine Projekte, Übersicht | 040–049 | umgesetzt (040, 041; Modul und Feature `projekt`, Rahmen der Projektakte mit Reitern in `web/src/routes/projekte.tsx`) | #21, #25 | A-04, A-34, A-47; `POST /v1/projekte` mit `projekt:create`; Status, Trend und Meilenstein in der Projektzeile folgen mit AP-E1-1/AP-E0-6 |
| AP-E0-5 | Portfolios und Gremien, Gremienweg | 050–059 | umgesetzt (050, Modul `portfolio` mit API, MCP, Gremienweg «via SNS-VR»; Oberfläche UI-47; E2E offen bis CI läuft) | #19 (Merge-Zug #46), #24 | A-02, A-07, A-08, A-23, A-45 |
| AP-E0-6 | Register Projektdaten | 060–069 | umgesetzt (Tabellen 060, API, MCP `get_projektdaten`; Register lesend in der Projektübersicht: Meilensteine, Risiken, Kosten nur mit `finanzen:read`, Abhängigkeiten beidseitig, weitere Register als Anzahl; E2E offen bis CI läuft) | #29, #51 | A-20, A-22 (Meldung im System mit Ereignis `meldung.created`; Mitteilung an die Stelle folgt mit AP-E0-8), A-33 (Beträge auch in der Lesesicht nur mit `finanzen:read`); Massnahme eines Risikos `offen`/`umgesetzt`; KPI-Werte ab P2 |
| AP-E0-8 | Eingang, Mitteilungen, Stellvertretung | 070–079 | umgesetzt (070, Modul `eingang` mit Schnittstelle `aufgabe`/`mitteilung`/`stellvertretung`, `list_aufgaben`; Seiten `/eingang`, `/konto/stellvertretung`); offen: Zähler an «Eingang» und Eintrag im Kontomenü (Shell) | #22, #31 | A-31 (Unterschrift in Vertretung prüft AP-E3-2 mit `stellvertretung.aktiv`), A-44 |
| AP-E0-9 | Strategische Ziele | 080–089 | umgesetzt (080, Modul `ziel`, `list_ziele`; Seite Ziele › Strategische Ziele) | #13, #23 | A-15 |
| AP-E0-7 | Übernahme aus dem Excel-Dashboard | 120–129 | umgesetzt (ohne Migration; `POST /v1/projekte/uebernahme`, Beiträge von statusbericht und projektdaten über Registrierung) | offen | A-14; Spalten nach Q6 F7 als CSV (`scripts/uebernahme/`), zusätzlich «Meilenstein Termin», «Begründung», «Massnahme»; Status und Trend als geprüfter Bericht der Übernahmeperiode; Recht faktisch ADM (UE ohne `statusbericht:write`); keine Oberfläche |
| AP-E1-1 | Statusbericht erfassen | 090–099 | umgesetzt (090; Periode und Statusbericht, API mit Vorbelegung aus Vorperiode und Meilensteinplan, Einreichen mit Rückgängig; Berichtsaufgabe ab dem 18. über den Eingang, erledigt beim Einreichen, Mitteilung an den Sponsor bei «kritisch»; Oberfläche UI-13 Reiter «Bericht» mit Registern im selben Durchgang). E2E `web/e2e/bericht.spec.ts` offen bis CI läuft | #30, #52, #58 | A-07, A-08 (Aufgabe nur in Portfolios mit Pflichten), A-10 (Warnung «wesentlich» nur mit Toleranz im Phasenmodell), A-26, A-37 (Periode nach Abschluss gesperrt), A-38; Periode lesbar für alle der Organisation (enthält keine Projektdaten); UE bei «kritisch» ohne persönliche Mitteilung (Sammelaufgabe AP-E1-2) |
| AP-E1-2 | Monatsabschluss und Terminabweichungen | 100–109 | umgesetzt (100; Prüfung, Rückfrage, Einfordern, Abschluss mit «nicht gemeldet», Terminabweichungen, Aufgaben, MCP `get_periode`; Oberfläche Portfolio › Monatsabschluss UI-15, UI-16) | #41, #44 | A-11, A-28, A-37; Auffälligkeiten ohne Schwelle: jede Statusänderung, jede Verschiebung gegenüber Baseline bzw. «Abschluss per» der Vorperiode, jede Prognose über Budget (K1-4); berichtspflichtig = aktiv, P0–P3, Portfolio mit Pflichten (A-07, A-08); «Periode abschliessen» per Job am Stichtag, eingereiht beim ersten Einreichen (Stichtag aus dem Phasenmodell; ohne Phasenmodell in Kraft sofort); Tabelle `einforderung` (fachmodell.md 2.8) |
| AP-E1-3 | Dashboard der Periode | 110–119 | in Arbeit (PR 1: Modul `auswertung`, `GET /v1/dashboard`, MCP `get_dashboard`, ohne Migration; PR 2: Oberfläche UI-17) | – | A-11, A-33 (Projektrollen ohne Dashboard, UX-OF-12); Badge «Eskalation» bis AP-E2-4 aus «Entscheid des PRAT nötig» des Berichts; offene Periode live, abgeschlossene aus dem Stand bei Abschluss |
| AP-E2-1 | Sitzung, Traktanden, Versand | 130–139 | umgesetzt (130, 131, Modul `sitzung` mit Registry, Vorschlägen, Einladungen, Unterlagenstand, Versand, Lauf der Fristen; Oberfläche Gremien › Sitzungen, UI-33 Vorbereiten; E2E offen bis CI läuft) | #32, #39, #65 | A-27, A-34, A-36, A-44, A-45; «via SNS-VR» nur für Gate und Meilenstein eines Projekts in P0/P1 (UC-006 A1); Sitzungsdauer ohne Vorgabe; Traktandenliste nach dem Versand fest |
| AP-E2-2 | Sitzungsmodus, Entscheide, Auflagen, Protokoll | 140–149 | umgesetzt (140; Dateien `entscheid*`, `protokoll*` im Modul `sitzung`: Starten, Entscheid mit Folge über die Registry, Auflagen als Aufgaben, Korrektur bis Schliessen mit Verlauf, SNS-VR nachtragen, Schliessen mit Folgevorschlägen, Protokoll bereinigen und versenden, Liste Entscheide, MCP `list_entscheide`; Oberfläche UI-34 Sitzungsmodus, UI-35 Protokoll, UI-36 Entscheide und Auflagen) | #42, #45 | A-02, A-30, A-34, A-44; Ergebnisse je Art aus K3 Schritt 8, solange die Art nicht registriert ist; Stellungnahme «via SNS-VR» mit Ergebnis des Gremiums, Entscheid des SNS-VR nach dem Schliessen; Auflagen-Aufgaben und Mitteilungen erst beim Schliessen; Weiterleitung an den VR als Markierung (K03); Protokoll ohne PDF (Druckansicht); Entscheide bei unterbrochener Verbindung nicht lokal gehalten (I-F7, offen) |
| AP-E2-3 | Portfoliobericht und Risikolage | 150–159 | offen | – | – |
| AP-E2-4 | Eskalation und Meilensteinabnahme | 160–169 | umgesetzt (160, `statusbericht/eskalation*`, `abnahme*`: Arten `eskalation` und `meilenstein` in der Registry, Folge des Entscheids in dessen Transaktion; Entscheid über die Route mit AP-E2-2) | #65 | A-30, A-46; Vorschlag ohne entscheidendes Gremium entfällt, die Aufgabe «Eskalation behandeln» bleibt; «Nicht abgenommen» ändert das Register nicht, eine erteilte Abnahme bleibt bei Korrektur (Zurücknehmen bietet `projektdaten` nicht); Abnahme als System, solange `EntscheidFolge` keinen Akteur trägt; Frist der Aufgabe offen |
| AP-E3-1 | Projektakte mit Kapiteln und Pflichtangaben | 170–179 | in Arbeit (PR 1: 170, Modul `vertrag` mit Versionen, Kapiteln 1–13, Pflichtangaben, Einreichen, Baseline mit Register-Übernahme und Zuordnung zum Ziel, MCP `get_vertrag`; PR 2 Oberfläche Reiter «Vertrag» der Projektakte) | #43, #48 | A-04 (Koalition als Liste in Kap. 8), A-12 (Pflichtangaben aus dem Phasenmodell; ab Gate P1–P2 Personal in FTE und Kosten bis P4), A-19 (Business Case als Text, Kosten aus Kap. 9), A-29; erster Vertrag eines übernommenen Projekts gilt für die laufende Phase; Register-Übernahme erst bei der Baseline; Beilagen ohne Datei |
| AP-E3-2 | Quality-Check und Unterzeichnen | 180–189 | in Arbeit (PR 1: 180, `pruefung*` im Modul `vertrag`: Quality-Check mit Kommentar je Kapitel, Unterschriften SP/PL/CTL mit Stellvertretung, Verweigern mit Begründung, Aufgaben; PR 2: Oberfläche UI-12 `/projekte/<nr>/vertrag/pruefen` und `…/unterzeichnen`, Aufgabe «Quality-Check» verweist auf die Prüfansicht) | #64, #75 | A-04, A-31 |
| AP-E3-3 | Gate-Modus und Gate-Entscheid | 190–199 | offen | – | – |
| AP-E3-4 | Versionsvergleich und Änderungsantrag | 200–209 | offen | – | – |
| AP-E3-5 | Dokumentausgabe Projektvertrag | 210–219 | in Arbeit (Modul `vorlage` mit Grundbestand Projektvertrag nach Q7 und Ausgabe PDF/Word ohne Fremdbibliothek, `GET /v1/vorlagen`; `GET /v1/vertragsversionen/:id/dokument?format=pdf|docx`; Baustein `DokumentAusgabe` im Kopf der Projektakte › Vertrag, nachgeladen mit der Seite) | – | Format PDF und Word (Vorschlag K2, «Format offen»); Grundbestand als Vorlage im Code, ohne Tabelle `vorlage` (Hochladen, Fassungen und Feldzuordnung mit AP-E7-7, Migration 210–219 ungenutzt); Beträge ohne `finanzen:read` «nicht verfügbar» (A-33); Unterschriften in Kap. 12 «noch keine» bis AP-E3-2; Export im Audit (`vertrag.exported`) |
| AP-E4-1 | Projektidee einreichen | 220–229 | umgesetzt (220, Modul `idee`, `list_ideen`, `get_idee`; Assistent, Meine Ideen, Ansicht, Rückfragen beantworten); offen: Kopfkarte «Ideen» auf der Startseite (Eintrag über Feature-Grenze), E2E bis CI läuft | #36, #50 | A-46; Pflichtfelder beim Einreichen: Titel, Ausgangslage, Zielsetzung, Handlungsfeld, Nutzen, Aufwand, Relevanz (Ziel, Bereiche, Herkunft freiwillig); Auswahl des Strategiebezugs über `GET /v1/ideen/auswahl` mit voller Sicht, weil Antragstellende kein `ziel:read` haben; Entwürfe sieht nur, wer sie erfasst; Rückfrage mit betroffenem Feld (`idee_rueckfrage.feld`) |
| AP-E4-2 | Ideenpool und Prüfung | 230–239 | umgesetzt (230 Leitfragen, Raster, Vorschlag; Pool mit Funnel, Prüfung, Rückfrage, Zurückweisen, Zusammenführen; Oberfläche Pool und Prüfansicht) | #70 | A-06 (UE weist allein zurück, Gremium des Portfolios per Mitteilung informiert), A-32; Vorschlag der Kategorie: Mehrheit «hoch» → A, Mehrheit «tief» → C, sonst B (Annahme bis zur Klärung, G11); Leitfragen als Abschrift aus dem Phasenmodell in Kraft; erste Prüfhandlung setzt «in Prüfung»; Bereich Portfolio › Ideen zeigt mit `idee:read` den Pool, «Meine Ideen» als Ansicht |
| AP-E4-3 | Freigabe der Initialisierung | 240–249 | in Arbeit (240 Sponsor, Projektleitung, Zeitpunkt der Freigabe; Art `idee` in der Registry der Sitzung; dem Gremium vorlegen bzw. der Direktion übergeben (Aufgabe `idee.freigeben`); Freigabe legt das Projekt in P0 mit `herkunft`, SP und PL an, Aufgabe `vertrag.erstellen` an die PL; Oberfläche folgt) | – | A-05 (die UE erfasst Sponsor und Projektleitung vor dem Entscheid bei der Idee; ohne beide scheitert «Freigegeben» mit 422; bei Kategorie C benennt die Direktion beide mit der Freigabe); A-23 statt K25: die Direktion ist das Portfolio der Kategorie C mit ihrer Organisationseinheit, das Projekt erhält diese als Organisationseinheit (A, B: keine); Korrektur des Entscheids weg von «Freigegeben» zieht das entstandene Projekt zurück (Lebenszyklus «zurückgezogen», A-30), die Aufgabe des Vertrags entfällt; «Mit Auflagen freigegeben» legt das Projekt an wie «Freigegeben»; die Direktion gibt frei oder weist zurück (kein Zurückstellen, UC-001 A4.2); ihre Handlung läuft nach geprüftem `idee:decide` am Portfolio mit voller Sicht (sie hat am neuen Projekt noch keine Rolle) |
| AP-E5-1 | Bewertungsmodell und Bewertung | 250–259 | umgesetzt (250, Modul `priorisierung`; Portfolio › Priorisierung mit Bewertung UI-20 und Modell UI-19; E2E grün) | #71, #79 | A-01, A-18; Modell «Entwurf»/«in Kraft», gilt das zuletzt in Kraft gesetzte; Entscheid des Gremiums als Text erfasst; Vorgabe = Kriterien aus UC-008 Schritt 2 ohne Zuordnung Nutzen/Risiko (A-39 legt die UE fest); Budgetrahmen je Portfolio; Modell lesen auch mit `priorisierung:read` am Portfolio (Gremium) |
| AP-E5-2 | Matrix, Rangfolge, Portfoliorisiken | 260–269 | offen | – | – |
| AP-E5-4 | Kapazität und Auslastung | 270–279 | umgesetzt (270, Modul `ressource`, `get_auslastung`; Portfolio › Ressourcen mit Auslastung UI-23 und Kapazität UI-24; Bedarfsliste UI-25 mit AP-E7-2; E2E offen bis CI läuft) | #35 (über #46), #40 | A-20; Auslastung zählt den Bedarf der Projekte, die die Person sieht (vertrauliche nur mit `projekt:vertraulich`); Bedarf nur als Grösse S/M/L zählt nicht (Richtwerte je Grösse offen, K5 Z4); Szenario: inaktive Projekte fallen weg, Start verschiebt den ganzen Bedarf, Projekte ausserhalb bleiben; Engpass je Rolle und Quartal = Monat mit der grössten Überbuchung |
| AP-E5-3 | Szenarien mit Wasserlinie | 280–289 | offen | – | – |
| AP-E5-5 | Priorisierungsentscheid | 290–299 | offen | – | – |
| AP-E6-1 | Zielzyklus mit Jahreszielen | 300–309 | umgesetzt (300 Zielzyklus, Jahresziele, Hauptaktivitäten, Zuordnung Projekt ↔ Ziel; Aufgabe «Jahresziele vervollständigen» über den Eingang; `projektZuordnen` für den Vertrag mit 301; Oberfläche UI-38 Zielzyklus; E2E offen bis CI läuft) | #28, #34, #38, #49 | Spalte `zieljahr.vorlage_bis` (geplante Vorlage an den VR, K6); Projekte am Jahresziel bzw. strategischen Ziel, nicht an der Hauptaktivität (2.7); Sperre ausserhalb «in Arbeit» schon in AP-E6-1; Arbeitsfläche speichert beim Verlassen eines Feldes, ohne Rückgängig/Wiederholen; «Projektidee anstossen» erscheint erst mit AP-E4-1; «Aus Vorjahr übernehmen» (K6 Z2) erst mit der Zielerreichung (AP-E6-3) |
| AP-E6-2 | Freigabe Jahresziele und Roadmap | 310–319 | umgesetzt (310, Vorlage an den VR mit Sperre ohne Metrik, Freigabe erfassen, Roadmap mit Vorschau und Publikation; Oberfläche UI-39, UI-31; E2E) | #72 | A-35 (Roadmap für alle Angemeldeten); «Anpassungen verlangt» informiert die GL über die Aufgabe im Eingang (Recht `ziel:write`), keine Mitteilung je Person; Roadmap ohne vertrauliche Projekte (A-34) und ohne Zeitplan (Termine liegen in `projektdaten`, das `ziel` nicht nutzt); Unterlagen für den VR als gedruckte Zusammenfassung, Dokumentausgabe folgt mit `vorlage` |
| AP-E6-3 | Zielerreichung | 320–329 | teilweise (PR 1: 320, `/v1/zielerreichung/:quartal`, Seite Ziele › Zielerreichung UI-40; PR 2 Aufgabe im Eingang folgt) | #37 | Zielerreichung je strategischem Ziel und Jahresziel des Jahres (`ziel_typ`); `beurteilung` als Kommentar ohne Skala (keine festgelegt); ein Stand je Ziel und Quartal, Änderungen im Audit; Jahresziele nur im Quartal ihres Jahres; Aufgabe `zielerreichung.erfassen` (Job nach Quartalsende) folgt in PR 2, sobald es ein Muster für zeitgesteuerte Aufgaben je Organisation gibt (wie AP-E1-1, Job am 18.) |
| AP-E6-4 | Quartalsreporting | 330–339 | offen | – | – |
| AP-E7-1 | Abschluss, Sistierung, Abbruch, Lessons Learned | 340–349 | offen | – | – |
| AP-E7-2 | Ressourcen zuteilen, Konflikte | 350–359 | umgesetzt (350, `zuteilung*` im Modul `ressource`: Bedarfsliste, Zuteilung, Konflikte, Lücke, Sammelaufgaben, MCP `list_bedarfe`; Oberfläche UI-25 Portfolio › Ressourcen › Bedarf: Liste + Schublade, Zuteilen, Lücke, Überbuchungen; HR-Übernahme RK.01.02 offen) | #69, #77 | A-20; eine Person höchstens eine Stelle (Beschäftigungsgrad aus dem HR-System offen, RK.01.02, K23); Pool-Konflikt nur gegen erfasstes Angebot; Priorität über `prioritaetQuelleSetzen` der Priorisierung (ohne: nach Projektnummer); «gedeckt» im Register darf auch `ressource:write` ändern (Policy in 350) |
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
| ZM.02.01 | Jahresziele ableiten | 011 | E6 | AP-E6-1 | umgesetzt (API und Oberfläche UI-38) | #28, #49 |
| ZM.02.02 | Jahresziele freigeben | 011 | E6 | AP-E6-2 | umgesetzt (#72) | #72 |
| ZM.02.03 | Hauptaktivitäten festlegen | 011 | E6 | AP-E6-1 | umgesetzt (API und Oberfläche UI-38) | #28, #49 |
| ZM.02.04 | Zielmetrik definieren | 011 | E6 | AP-E6-1 | umgesetzt (API und Oberfläche UI-38) | #28, #49 |
| ZM.03.01 | Zielerreichung erfassen | 012 | E6 | AP-E6-3 | teilweise (UC-012 Schritte 1–2; Aufgabe im Eingang folgt in PR 2) | #37 |
| ZM.03.02 | Quartalsreporting an den VR erstellen | 012 | E6 | AP-E6-4 | offen | – |
| ZM.03.03 | Jahresrückblick auswerten | 013 | E7 | AP-E7-5 | offen | – |
| DM.01.01 | Projektidee erfassen | 001 | E4 | AP-E4-1 | umgesetzt | #36, #50 |
| DM.01.02 | Projektidee qualifizieren | 001 | E4 | AP-E4-2 | umgesetzt | #70 |
| DM.01.03 | Projektideen zusammenführen | 001 | E4 | AP-E4-2 | umgesetzt | #70 |
| DM.01.04 | Projektidee zurückweisen | 001 | E4 | AP-E4-2 | umgesetzt | #70 |
| DM.02.01 | Projektvertrag erstellen | 002 | E3 | AP-E3-1 | in Arbeit (API) | – |
| DM.02.02 | Projektvertrag zur Prüfung einreichen | 002 | E3 | AP-E3-1 | in Arbeit (API) | – |
| DM.02.03 | Projektvertrag überarbeiten | 002, 003 | E3 | AP-E3-1, AP-E3-2 | in Arbeit (Kapitel bearbeiten, API) | – |
| DM.02.04 | Projektvertrag zurückziehen | 002 | E3 | AP-E3-1 | offen | – |
| DM.02.05 | Quality Review durchführen | 002, 003 | E3 | AP-E3-2 | in Arbeit (API, Prüfansicht UI-12) | – |
| DM.02.06 | Projektvertrag freigeben | 002, 003 | E3 | AP-E3-2, AP-E3-3 | in Arbeit (Unterschriften, API und Oberfläche UI-12; Entscheid im Gremium AP-E3-3) | – |
| DM.02.07 | Projektvertrag als Dokument ausgeben | 002 | E3 | AP-E3-5 | in Arbeit (API; «Als Dokument herunterladen» im Kopf der Projektakte › Vertrag) | – |
| PP.01.02 | Bewertungsmodell festlegen | 008 | E5 | AP-E5-1 | umgesetzt | #71, #79 |
| PP.01.03 | Portfoliokategorien und Budgetrahmen festlegen | 008 | E5 | AP-E5-1 | umgesetzt (Budgetrahmen je Portfolio, A-18) | #71, #79 |
| PP.02.01 | Vorhaben bewerten | 008 | E5 | AP-E5-1 | umgesetzt (hoch/mittel/tief ohne Score, A-01) | #71, #79 |
| PP.02.02 | Vorhaben priorisieren | 008 | E5 | AP-E5-2 | offen | – |
| PP.02.03 | Abhängigkeiten zwischen Vorhaben erfassen | 002, 008 | E0, E5 | AP-E0-6, AP-E5-2 | Register umgesetzt (AP-E0-6) | #29, #51 |
| PP.02.04 | Projektkategorie zuordnen | 001 | E4 | AP-E4-2 | umgesetzt | #70 |
| PP.02.05 | Vorhaben mit strategischen Zielen verknüpfen | 002 | E3, E6 | AP-E3-1, AP-E6-1 | Zuordnung im Zielzyklus umgesetzt (AP-E6-1, API und Oberfläche); aus Vertrag Kap. 2 bei der Baseline über `projektZuordnen` (AP-E3-1, in Arbeit) | #28, #38, #43, #49 |
| PP.03.01 | Portfolioszenario erstellen | 008 | E5 | AP-E5-3 | offen | – |
| PP.03.02 | Szenario gegen Budget und Kapazität prüfen | 008 | E5 | AP-E5-3 | offen | – |
| PP.03.03 | Szenarien vergleichen | 008 | E5 | AP-E5-3 | offen | – |
| PP.03.04 | Portfolio in Matrixsicht beurteilen | 008 | E5 | AP-E5-2 | offen | – |
| PP.04.01 | Entscheidungsvorlage vorbereiten | 006 | E2 | AP-E2-1 | umgesetzt (UC-006 Schritte 1–5, A1, A2) | #32, #39 |
| PP.04.02 | Portfolioentscheid erfassen | 006 | E2 | AP-E2-2 | umgesetzt (UC-006 Schritte 6–9, A1, A3, A4) | #42, #45 |
| PP.04.03 | Portfolio-Roadmap publizieren | 011 | E6 | AP-E6-2 | umgesetzt (#72) | #72 |
| PP.04.04 | Projektorganisation festlegen | 002 | E0 | AP-E0-4 | umgesetzt | #21, #25 |
| PP.04.05 | Gate-Reviews einplanen | 006 | E2 | AP-E2-1 | umgesetzt (UC-006 Schritte 1–5, A1, A2) | #32, #39 |
| PS.01.01 | Statusbericht erfassen | 004 | E1 | AP-E1-1 | umgesetzt | #30, #52, #58 |
| PS.01.02 | Statusbericht prüfen | 005 | E1 | AP-E1-2 | umgesetzt | #41, #44 |
| PS.01.03 | Ausstehende Statusberichte nachverfolgen | 005 | E1 | AP-E1-2 | umgesetzt | #41, #44 |
| PS.01.04 | Terminabweichungen analysieren | 005 | E1 | AP-E1-2 | umgesetzt | #41, #44 |
| PS.02.01 | Phasenfreigabe beantragen | 003 | E3 | AP-E3-3 | offen | – |
| PS.02.02 | Phasenfreigabe entscheiden | 003, 006 | E2, E3 | AP-E2-2, AP-E3-3 | in Arbeit (Entscheid im Gremium umgesetzt #42, #45; Folge über die Art `gate` mit AP-E3-3) | #42, #45 |
| PS.02.03 | Meilenstein abnehmen | 006 | E2 | AP-E2-4 | umgesetzt (UC-006 Schritt 7) | #65 |
| PS.02.04 | Meilensteinplan pflegen | 002, 004 | E0, E1 | AP-E0-6, AP-E1-1 | Register umgesetzt (AP-E0-6) | #29, #51 |
| PS.02.05 | Projektvertrag fortschreiben | 003 | E3 | AP-E3-3 | offen | – |
| PS.03.01 | Änderung am Projektvertrag beantragen | 007 | E3 | AP-E3-4 | offen | – |
| PS.03.02 | Änderung am Projektvertrag entscheiden | 007 | E3 | AP-E3-4 | offen | – |
| PS.03.03 | Eskalation behandeln | 004, 006 | E2 | AP-E2-4 | umgesetzt (UC-004 A2.2, UC-006 Schritt 7) | #65 |
| PS.03.04 | Vertragsversionen vergleichen | 003, 007 | E3 | AP-E3-4 | offen | – |
| PS.04.01 | Vorhaben abschliessen | 015 | E7 | AP-E7-1 | offen | – |
| PS.04.02 | Vorhaben sistieren oder abbrechen | 006, 015 | E7 | AP-E7-1 | offen | – |
| PS.04.03 | Lessons Learned erfassen | 013, 015 | E7 | AP-E7-1, AP-E7-5 | offen | – |
| PS.05.01 | Stakeholder erfassen | 002 | E0, E3 | AP-E0-6, AP-E3-1 | Register umgesetzt (AP-E0-6) | #29, #51 |
| PS.05.02 | Kommunikationsplan erstellen | 002 | E0, E3 | AP-E0-6, AP-E3-1 | Register umgesetzt (AP-E0-6) | #29, #51 |
| PS.05.03 | Kommunikationsmassnahme nachführen | 004 | E1 | AP-E1-1 | umgesetzt (im Bericht, UI-13) | #58 |
| PC.01.01 | Projektbudget planen | 002 | E0, E3 | AP-E0-6, AP-E3-1 | Register umgesetzt (AP-E0-6) | #29, #51 |
| PC.01.02 | Ist-Kosten übernehmen | 010 | E7 | AP-E7-4 | offen | – |
| PC.01.03 | Kostenprognose aktualisieren | 004 | E1 | AP-E1-1 | umgesetzt (im Bericht, UI-13) | #58 |
| PC.01.04 | Budgetabweichungen analysieren | 010 | E7 | AP-E7-4 | offen | – |
| PC.01.05 | Budgetbedarf in den Budgetprozess übergeben | 010, 011 | E7 | AP-E7-4 | offen | – |
| PC.02.01 | Portfoliorisiko erfassen | 008 | E5 | AP-E5-2 | offen | – |
| PC.02.02 | Risikolage des Portfolios beurteilen | 006, 014 | E2 | AP-E2-3 | offen | – |
| PC.02.03 | Risikomassnahme verfolgen | 004 | E1 | AP-E1-1 | umgesetzt (im Bericht, UI-13) | #58 |
| PC.02.04 | Projektrisiko erfassen | 002, 004 | E0, E1 | AP-E0-6, AP-E1-1 | Register umgesetzt (AP-E0-6) | #29, #51 |
| PC.03.01 | Projekt-KPIs festlegen | 002 | E0, E3 | AP-E0-6, AP-E3-1 | Register umgesetzt (AP-E0-6) | #29, #51 |
| PC.03.02 | Nutzenrealisierung überprüfen | 003, 015 | E3, E7 | AP-E3-3, AP-E7-1 | offen | – |
| PC.03.03 | KPI-Werte nachführen | 004 | E1 | AP-E1-1 | umgesetzt (im Bericht ab P2, UI-13) | #58 |
| PC.03.04 | Business Case fortschreiben | 002, 003, 015 | E3, E7 | AP-E3-1, AP-E3-3, AP-E7-1 | in Arbeit (Business Case P0 in Kap. 3, A-19) | – |
| PC.04.01 | Portfolio-Dashboard einsehen | 014 | E1 | AP-E1-3 | in Arbeit (API) | – |
| PC.04.02 | Portfoliobericht erstellen | 012, 014 | E2, E6 | AP-E2-3, AP-E6-4 | offen | – |
| PC.04.03 | Ad-hoc-Auswertung erstellen | 014 | E7 | AP-E7-6 | offen | – |
| RK.01.01 | Kapazitätsangebot planen | 009 | E5 | AP-E5-4 | umgesetzt (Grundfunktion: Angebot je Rolle und Monat; HR-Übernahme RK.01.02 mit AP-E7-2) | #35, #40 |
| RK.01.02 | Personal- und Abwesenheitsdaten übernehmen | 009 | E7 | AP-E7-2 | offen | – |
| RK.02.01 | Ressourcenbedarf anmelden | 002 | E0, E3 | AP-E0-6, AP-E3-1 | Register umgesetzt (AP-E0-6) | #29, #51 |
| RK.02.02 | Ressourcen zuteilen | 009 | E7 | AP-E7-2 | umgesetzt | #69, #77 |
| RK.02.03 | Ressourcenkonflikt auflösen | 009 | E7 | AP-E7-2 | umgesetzt | #69, #77 |
| RK.02.04 | Auslastung analysieren | 008, 009 | E5 | AP-E5-4 | umgesetzt (auch je Szenario über die Schnittstelle für AP-E5-3) | #35, #40 |
| RK.02.05 | Ressourcenbedarf präzisieren | 003 | E3 | AP-E3-3 | offen | – |
| RK.02.06 | ICT- und Infrastrukturbedarf anmelden | 002 | E0, E3 | AP-E0-6, AP-E3-1 | Register umgesetzt (AP-E0-6) | #29, #51 |
| AM.01.01 | Benutzer verwalten | 016 | E7 | AP-E7-8 (Baukasten) | offen | – |
| AM.01.02 | Rolle mit Berechtigungen definieren | 016 | E0, E7 | AP-E0-1, AP-E7-8 | offen | – |
| AM.01.03 | Stellvertretung regeln | 016 | E0 | AP-E0-8 | umgesetzt | #22, #31 |
| AM.02.01 | Organisationseinheiten verwalten | 017 | E0 | AP-E0-2 | umgesetzt | #20, #26 |
| AM.02.02 | Codetabellen pflegen | 017 | E0 | AP-E0-2 | umgesetzt | #20, #26 |
| AM.02.03 | Phasenmodell und Gates konfigurieren | 017 | E0 | AP-E0-3 | umgesetzt | #17 |
| AM.02.04 | Portfolioebenen und Gremien konfigurieren | 017 | E0 | AP-E0-5 | umgesetzt | #19, #24 |
| AM.03.01 | Vorlagen verwalten | 018 | E3, E7 | AP-E3-5, AP-E7-7 | in Arbeit (Grundfunktion: Grundbestand Projektvertrag, Liste; Verwaltung mit AP-E7-7) | – |
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
| K1-1 | Statusbericht ohne wesentliche Änderung (PPM-1) | ≤ 5 Min., ≤ 15 Interaktionen | Test (Interaktionen), Aufgabentest | AP-E1-1 | Interaktionen gezählt: Vitest 3, E2E 8 (E2E offen bis CI läuft); 5 Min. beim Aufgabentest zu messen |
| K1-2 | Berichte bis zum 25. eingereicht | ≥ 90 % | Betrieb | AP-E1-1 | offen |
| K1-3 | Prüfung unauffälliger Bericht | ≤ 1 Min. ohne Detail | Aufgabentest | AP-E1-2 | offen |
| K1-4 | Auffälligkeiten erkannt | 5 von 5 in 30 Berichten | Aufgabentest (Testdaten im Paket) | AP-E1-2 | Test: 5 von 5 zuoberst (`test/app/monatsabschluss.test.ts`, Testdaten `monatsabschluss-testdaten.ts`); Aufgabentest offen |
| K1-5 | Periode bis Monatsende ohne Excel (PPM-3) | 100 %, 0 Dateien | Betrieb | AP-E1-2 | offen |
| K2-1 | Unterzeichnen auf dem Telefon (PPM-2) | ≤ 60 s, ≤ 3 Interaktionen | Test bei 360 px, Aufgabentest | AP-E3-2 | Interaktionen gezählt: Vitest 1 ab der Aufgabe, E2E 2 ab dem Eingang bei 360 px mit Zeitmessung (E2E offen bis CI läuft); 60 s beim Aufgabentest zu bestätigen |
| K2-2 | Quality-Checks ohne Rückmeldung | ≥ 70 % | Betrieb | AP-E3-2 | offen |
| K2-3 | Eingereicht → unterzeichnet | Median ≤ 5 Arbeitstage | Betrieb | AP-E3-2 | offen |
| K2-4 | Fehlende Pflichtangaben auffinden | 1 Klick, 100 % | Test | AP-E3-1 | API mit Sprungziel je Angabe getestet (`vertrag.test.ts`); Oberfläche in PR 2 |
| K2-5 | Gate Review Packet ohne Dateien (PPM-4) | 0 Dateien | Aufgabentest, Betrieb | AP-E3-3 | offen |
| K3-1 | Unterlagen ≥ 5 Arbeitstage vorher | 100 % | Betrieb (Versandprotokoll) | AP-E2-1 | offen |
| K3-2 | Traktandenliste versandbereit | ≤ 30 Min. | Aufgabentest | AP-E2-1 | offen |
| K3-3 | Entscheid erfassen | ≤ 60 s je Traktandum | Test (Messung im Sitzungsmodus) | AP-E2-2 | gemessen im E2E (`sitzungsmodus.spec.ts`, Zeit bis zur Bestätigung als Annotation); Aufgabentest mit Personen offen |
| K3-4 | Protokoll ≤ 3 Arbeitstage | 100 % | Betrieb | AP-E2-2 | umgesetzt (Versand mit Arbeitstagen nach der Sitzung protokolliert, Aufgabe «Protokoll versenden» mit Frist); Messung im Betrieb |
| K3-5 | Antrag und Hauptänderungen finden (PPM-5) | ≥ 90 %, ≤ 30 s, Tablet | Aufgabentest | AP-E2-2 | Antrag auf 768 px ohne Scrollen im E2E; Aufgabentest mit Mitgliedern offen |
| K4-1 | Idee ohne Hilfe einreichen | ≥ 90 % | Aufgabentest | AP-E4-1 | beim Aufgabentest zu messen (Assistent mit Hilfe je Feld, Sperre mit Sprung zum Schritt) |
| K4-2 | Zeit zum Einreichen | ≤ 10 Min. | Aufgabentest | AP-E4-1 | beim Aufgabentest zu messen |
| K4-3 | Ideen mit Rückfrage | ≤ 20 % | Betrieb | AP-E4-2 | im Betrieb aus den Ereignissen `idee.submitted` und `idee.questioned` |
| K4-4 | Einreichung → bereit für das Gremium | Median ≤ 20 Arbeitstage | Betrieb | AP-E4-2 | im Betrieb aus `idee.submitted` bis Kategorie/Traktandierung (`idee.categorized`) |
| K5-1 | Rang verschieben → Wasserlinie | ≤ 200 ms, ≤ 1 s bei 60 Projekten | Test | AP-E5-3 | offen |
| K5-2 | 15 × 7 Bewertungen nur Tastatur | ≤ 10 Min. | Aufgabentest | AP-E5-1 | Test: 105 Einschätzungen mit 223 Tastendrücken ohne Maus (`BewertungPage.test.tsx`); Zeit beim Aufgabentest zu messen |
| K5-3 | Entscheidungsvorlage ohne Dateien | 0 Dateien | Aufgabentest | AP-E5-5 | offen |
| K5-4 | Projekte unter der Wasserlinie und Engpass nennen | ≥ 90 % | Aufgabentest | AP-E5-3 | offen |
| K6-1 | Jahresziel mit Metrik und Hauptaktivität | ≤ 3 Min. | Aufgabentest | AP-E6-1 | beim Aufgabentest zu messen (Ablauf im E2E web/e2e/zielzyklus.spec.ts) |
| K6-2 | Projekt ↔ strategisches Ziel | ≤ 2 Klicks | Test | AP-E6-1 | Ziel → Projekt 1 Klick (ZielzyklusPage.test.tsx, #49); Projekt → Ziel: API 1 Aufruf mit `link` (#28), Anzeige in der Projektübersicht offen (AP-E0-4/AP-E3-1) |
| K6-3 | Zielerreichung 30 Ziele | ≤ 20 Min. | Aufgabentest | AP-E6-3 | offen |
| K6-4 | Entwurf Quartalsreporting | ≤ 30 Min., ohne Dateien | Aufgabentest | AP-E6-4 | offen |
| E0 | Q-L1, Q-L6, Q-B1–B6 auf allen Bausteinen; G1 je Rolle | wie qualitaetsziele.md | CI, Review | AP-E0-0, AP-E0-8 | offen |
| E7 | Q-W1, Q-W2 je Rolle, PPM-6 | ≥ 90 %, SUS ≥ 75 | Test mit 5 Personen je Rolle | alle | offen |

## UX-Definition of Done je PR

Jeder PR mit Oberfläche trägt die Checkliste aus [pruefung.md](ux/rahmen/pruefung.md) im PR-Text und hier eine Zeile.

| PR | AP | Seitentyp und Zustände | Tastatur | axe hell/dunkel | 360/768/1440 px | Texte zentral, «Sie» | Zielgrössen |
|---|---|---|---|---|---|---|---|
| #23 | AP-E0-9 | Liste + Schublade; Z1, Z2, Z3, Z5, unbekannte Nummer | ja (Datenliste, Formular) | ohne Befund (E2E hell, dunkel; jsdom) | 360 px ohne Überlauf (E2E «schmal»); 768/1440 nicht eigens geprüft | ja (Feature-Texte), «Sie» | – (keine Zielgrösse in E0) |
| #26 | AP-E0-2 | Liste + Schublade (UI-44, UI-45); Z1–Z3, Z5, Z7, Z8, Z10 | ja (Vitest, E2E) | ja (Vitest, E2E) | 360 px im E2E | ja (`features/stammdaten/texte.ts`) | keine im Ablauf |
| #39 | AP-E2-1 | Arbeitsfläche (UI-33 Vorbereiten); Z1, Z2, Z5, Z7 (412 → neu laden), Z8, Z9, Z10; Übersicht je Gremium | Alt+↑/↓ am Griff, Fokus folgt; Rückgängig im Toast | Komponenten ohne Befund; E2E hell/dunkel/360 px | 360 (E2E), 1024/1440 (Raster) | ja, `features/sitzung/texte.ts` | K3-1 Versandprotokoll mit Vorlauf (Betrieb); K3-2 beim Aufgabentest |
| #70 | AP-E4-2 | Liste mit Funnel (Ansicht in der Adresse), Prüfansicht zweispaltig, Dialoge; Z1, Z2, Z3, Z5, Z7, Z8, Z9 | ja (Radiogruppen, Dialoge mit Fokus, Funnel als Liste) | ohne Befund (jsdom); E2E offen bis CI läuft | 360 px im E2E «schmal» (offen bis CI läuft) | ja (`features/idee/PruefungTexte.ts`), «Sie» | K4-3, K4-4 Betrieb |
| #45 | AP-E2-2 | Arbeitsfläche Sitzungsmodus (UI-34) und Protokoll (UI-35), Liste + Schublade Entscheide (UI-36); Z1, Z2, Z3, Z5, Z7 (412 → neu laden), Z8, Z9, Z10 | → / ← und E im Sitzungsmodus; Formular vollständig; Ansage nach Erfassen | Komponenten ohne Befund (jsdom); E2E hell/dunkel/360 px | 360 (E2E), 768 Tablet (E2E, Antrag ohne Scrollen), 1024/1440 (Raster) | ja, `features/sitzung/Sitzungsmodus.texte.ts` | K3-3 Messung im E2E (Zeit bis zur Bestätigung); K3-4 Versand protokolliert (Betrieb); K3-5 Tablet im E2E, Aufgabentest offen |
| #50 | AP-E4-1 | Assistent (4 Schritte), Liste, Ansicht; Z1, Z2, Z5, Z7, Z8, Z10, Entwurf, in Ergänzung | ja (Fokus auf Schrittüberschrift, Radiogruppen, Vitest) | ohne Befund (jsdom); E2E hell, dunkel offen bis CI läuft | 360 px im E2E «schmal» (offen bis CI läuft) | ja (`features/idee/texte.ts`), «Sie» | K4-1, K4-2 Aufgabentest |
| #17 | AP-E0-3 | Arbeitsfläche; Z1, Z2, Z5, Z7–Z10 | vollständig, Strg+Z/Strg+Umschalt+Z | ohne Befund | geprüft (360/1024/1280/1440) | ja | keine Zielgrössen (kein Kernablauf für UC-017) |
| #24 | AP-E0-5 | UI-47 Liste + Schublade (Portfolio › Gremium); Z1, Z2, Z5, Z7 (412), Z8, Z10 im Test | Formulare, Schubladen, Auswahl je Gate; E2E nur mit Tastatur in die Administration | Vitest-axe Liste und Schubladen; E2E hell, dunkel (E2E offen bis CI läuft) | 360 px im E2E (Projekt «schmal»), 768/1440 hell/dunkel | `features/portfolios/texte.ts`, «Sie» (check-address) | – (kein Kernablauf; UC-017) |
| #40 | AP-E5-4 | Bericht (Auslastung) + Schublade, Arbeitsfläche (Kapazität); Z1, Z2, Z4, Z5, Z7, Z8, Z10, ungültiger Zeitraum | ja (Reiter, Zellen, Raster mit Pfeilen, Eingabetaste, Strg+Z) | ohne Befund (jsdom; E2E hell, dunkel) | 360 und 1440 px ohne Überlauf (Chromium), 768 nicht eigens | ja (Feature-Texte), «Sie» | Q-L5 50 × 31 virtualisiert (Test mit Messung) |
| #48 | AP-E3-1 | Arbeitsfläche (UI-07); Z1, Z2, Z5, Z7, Z8, Z9 (Banner in Prüfung/Baseline), Z10 über den Rahmen | ↑/↓ Kapitel, Alt+N nächste fehlende Angabe, Strg+Z/Strg+Umschalt+Z | ohne Befund (jsdom, Vitest); E2E hell/dunkel offen (ohne Keycloak in der Session) | Layout 360/768/1200 px nach CSS-Brüchen; E2E offen | ja (`features/vertrag/texte.ts`), «Sie» | K2-4 als Vitest (1 Klick je Angabe, Fokus an der Stelle) und API-Test |
| #44 | AP-E1-2 | Posteingang (UI-15), Bericht (UI-16 Termine), Schublade, Dialog; Z1–Z5, Z7, Z8/Z10, Z9 | vollständig (↑/↓, B, R, E, Leertaste, Enter; Kürzel unter der Liste) | Vitest ohne Befund (Liste, Z9, Termine); E2E hell/dunkel offen bis CI läuft | 360 px im E2E (offen bis CI läuft) | ja (`features/monatsabschluss/texte.ts`), «Sie» | K1-3, K1-4 im Aufgabentest; Start-Bundle 203 kB |
| #75 | AP-E3-2 | Arbeitsfläche Prüfansicht (UI-12 Quality-Check), Zusammenfassung Unterzeichnen (Telefon); Z1, Z2, Z5, Z7 (412), Z8, Z9 (nicht in Prüfung/zur Unterzeichnung), Z10 | Formulare und Dialog «Nicht unterzeichnen» (Fokus, Pflichtbegründung) | ohne Befund (jsdom, Vitest); E2E hell/dunkel offen bis CI läuft | 360 px im E2E (offen bis CI läuft), Prüfansicht zweispaltig über 900 px | ja (`features/vertrag/PruefenTexte.ts`), «Sie» | K2-1 (Vitest 1 Interaktion, E2E 2 ab Eingang) |
| #79 | AP-E5-1 | Arbeitsfläche (Bewertung) + Schublade, Liste + Schublade (Modell); Z1, Z2, Z5, Z7–Z10 | ja (Raster mit Pfeilen, 1/2/3, Entf, Eingabetaste, Strg+Z; Editor) | ohne Befund (jsdom; E2E hell, dunkel) | 360 px ohne Überlauf (E2E «schmal», Chromium), 1440 px (Chromium); Bewerten ab 1024 px | ja (Feature-Texte), «Sie» | K5-2 Test: 105 Einschätzungen mit 223 Tastendrücken |
