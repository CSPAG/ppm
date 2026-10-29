# UX-Schicht PPM

Die UX-Schicht übersetzt die Fachgrundlage ([Masterdokument](../PPM-Master.md), [Funktionsbaum](../anhang/funktionsbaum.md),
[Use Cases](../anhang/use-cases.md)) in Vorgaben für die Oberfläche: für wen, auf welchem Gerät, in wie vielen Schritten,
mit welcher Rückmeldung. Es gelten die Produktgrundsätze G1–G4 ([Master Abschnitt 0](../PPM-Master.md#0-produktgrundsätze)): Governance wird sichtbar gemacht, nicht erzwungen; Nachvollziehbarkeit geht vor Sperre. Referenzkunde ist die Insel Gruppe. Methode, Grundsätze und querschnittliche Regeln stehen im projektneutralen
[UX-Rahmen](rahmen/README.md); hier steht nur, was für das PPM der Insel Gruppe gilt. Sie baut auf dem UX-Prinzip
«Arbeitsräume» des Masterdokuments auf ([Abschnitt 7](../PPM-Master.md#7-ux-prinzip-arbeitsräume)).

| | |
|---|---|
| Stand | 29. Oktober 2026 |
| Status | Entwurf, Annahmen nicht mit dem Kunden validiert |
| Tiefe | vollständig: Nutzungskontexte, Informationsarchitektur, sechs Kernabläufe, Darstellung, Fahrplan |
| Rahmen | Version 1.1, unverändert in [rahmen/](rahmen/) |

| Datei | Inhalt |
|---|---|
| [nutzungskontexte.md](nutzungskontexte.md) | Rollen: Gerät, Umgebung, Häufigkeit, Kernfrage |
| [informationsarchitektur.md](informationsarchitektur.md) | Arbeitsräume, Sichtbarkeit je Rolle, Startseiten, abgeleiteter UI-Katalog UI-01–UI-52, Adressen |
| [darstellung.md](darstellung.md) | wie Projekte, Status, Stände, Beträge, Fristen und Personen überall aussehen |
| [ablaeufe/](ablaeufe/) | die Kernabläufe K1–K6 |
| [fahrplan.md](fahrplan.md) | Etappen mit Abnahme, offene Fragen UX-OF, Rückfluss an die Anforderungen |
| [rahmen/](rahmen/) | UX-Rahmen: Grundsätze G1–G12, Qualitätsziele, Interaktionsregeln, Vorlage, Prüfung und UX-Definition of Done |

## Kernabläufe

Aus den 18 Use Cases entscheiden diese sechs über den Erfolg: der Monatszyklus mit allen Projektleitungen und dem Stichtag,
die Freigaben mit Wirkung auf Baseline und Budget, die Sitzung, in der der PRAT entscheidet, der Zufluss neuer Ideen durch
ungeübte Personen, die Priorisierung mit Folgen für das ganze Portfolio und der Zielzyklus, der alles mit der Strategie
verbindet. Alle übrigen Use Cases folgen den Seitentypen und Regeln des Rahmens ohne eigene Spezifikation
([Zuordnung](informationsarchitektur.md#zuordnung-ui-katalog--arbeitsräume)).

| Nr. | Ablauf | Rollen | Gerät | Use Cases |
|---|---|---|---|---|
| [K1](ablaeufe/K1-statusbericht.md) | Statusbericht erstellen und prüfen | PL, UE, AG | Desktop | UC-004, UC-005 |
| [K2](ablaeufe/K2-projektvertrag.md) | Projektvertrag fortschreiben und freigeben | PL, AG, UE | PL Desktop; Unterzeichnen beides, primär Telefon | UC-002, UC-003, UC-007 |
| [K3](ablaeufe/K3-gremiumssitzung.md) | Gremiumssitzung vorbereiten und durchführen | UE, PRAT, GLPA, PL, AG | UE Desktop; Mitglieder Tablet | UC-006 (mit den Entscheidschritten aus UC-001, 002, 003, 007, 008, 012, 013, 015) |
| [K4](ablaeufe/K4-projektidee.md) | Projektidee einreichen und qualifizieren | AS, UE, AG, DIR | beides, primär Desktop | UC-001 |
| [K5](ablaeufe/K5-priorisierung.md) | Portfolio priorisieren und Szenario entscheiden | UE, PRAT | Desktop | UC-008, UC-009 (Auslastung) |
| [K6](ablaeufe/K6-ziele.md) | Ziele festlegen und Zielerreichung berichten | GL, UE, PRAT | Desktop | UC-011, UC-012 |

**Auswahl.** Bewertung je Use Case mit Dialog, 0–3 je Kriterium (Massstab im Rahmen): Häufigkeit, Anzahl Personen,
Zeitdruck, Folgen eines Fehlers. Die Summe ist ein Hinweis, kein Automat.

| UC | Name | Rollen | Häufigkeit | Personen | Zeitdruck | Fehlerfolgen | Summe | Kernablauf |
|---|---|---|---|---|---|---|---|---|
| UC-006 | PRAT-Sitzung vorbereiten und durchführen | UE, PRAT | 1 | 2 | 3 | 3 | 9 | K3 |
| UC-004 | Monatlich berichten | PL | 1 | 3 | 2 | 2 | 8 | K1 |
| UC-005 | Statusberichte prüfen und nachverfolgen | UE | 2 | 1 | 3 | 2 | 8 | K1 (eine Geschichte mit UC-004) |
| UC-003 | Gate-Übergang durchführen | PL, AG, UE | 1 | 2 | 2 | 3 | 8 | K2 |
| UC-002 | Projektvertrag erarbeiten und freigeben | PL, AG, UE | 1 | 2 | 1 | 3 | 7 | K2 (Erstvertrag = Gate P0–P1) |
| UC-014 | Portfolio auswerten | PRAT, GLPA, DIR, UE | 2 | 3 | 1 | 1 | 7 | Seitentyp Bericht; Dashboard-Zeile in darstellung.md |
| UC-007 | Änderung am Projektvertrag beantragen und entscheiden | PL, AG | 1 | 1 | 1 | 3 | 6 | K2 (gleiche Mechanik: Entwurf gegen Baseline) |
| UC-008 | Portfolio priorisieren und ausbalancieren | UE, PRAT | 1 | 1 | 1 | 3 | 6 | K5 (Fehlerfolgen für das ganze Portfolio) |
| UC-009 | Ressourcen planen und zuteilen | UE | 2 | 1 | 1 | 2 | 6 | Seitentypen Arbeitsfläche, Liste + Schublade; Auslastung in K5 (keine Rolle RM, Master Entscheid 15) |
| UC-010 | Portfoliofinanzen überwachen | UE | 1 | 1 | 1 | 3 | 6 | Seitentypen Bericht, Assistent (Quelle Ist-Kosten offen, K18) |
| UC-001 | Projektidee erfassen und qualifizieren | AS, UE | 2 | 2 | 0 | 1 | 5 | K4 (seltene, ungeübte Nutzende; erster Kontakt vieler Mitarbeitender) |
| UC-011 | Ziele im Jahreszyklus festlegen | GL, UE | 0 | 1 | 1 | 3 | 5 | K6 (verbindet Strategie und Portfolio) |
| UC-012 | Quartalsreporting an den VR erstellen | UE, PRAT | 0 | 1 | 1 | 2 | 4 | K6 (dieselben Ziele und Metriken) |
| UC-015 | Vorhaben abschliessen oder abbrechen | PL, PRAT | 1 | 1 | 0 | 2 | 4 | Seitentyp Arbeitsfläche; Entscheid in K3 |
| UC-016 | Benutzer, Rollen und Stellvertretungen verwalten | ADM | 1 | 1 | 0 | 2 | 4 | Liste + Schublade; Stellvertretung im Kontomenü |
| UC-017 | Stammdaten und Governance konfigurieren | ADM, UE | 0 | 1 | 0 | 2 | 3 | Liste + Schublade, Phasenmodell Arbeitsfläche |
| UC-013 | Jahresrückblick auswerten | PRAT | 0 | 1 | 0 | 1 | 2 | Seitentyp Bericht; Entscheid in K3 |
| UC-018 | Vorlagen und Schnittstellen verwalten | ADM | 0 | 1 | 0 | 1 | 2 | Liste + Schublade, Änderungsprotokoll Bericht |

Gegenüber der Kennzeichnung im Masterdokument (UC-002, 003, 004, 006, 008, 011) kommt UC-001 als eigener Kernablauf dazu;
UC-005, UC-007 und UC-012 gehen in bestehenden Kernabläufen auf ([Rückfluss](fahrplan.md#rückfluss-an-die-anforderungen)).

## Zielwerte des Projekts

Es gelten die Standardwerte aus [qualitaetsziele.md](rahmen/qualitaetsziele.md) mit diesen Ergänzungen. Alle Werte sind
Vorschläge von CSP; heutige Vergleichswerte (Excel, Word, E-Mail) sind nicht erhoben.

| Nr. | Ziel | Wert |
|---|---|---|
| PPM-1 | Statusbericht ohne wesentliche Änderung erstellen und einreichen (häufigste Aufgabe der PL) | ≤ 5 Min., ≤ 15 Interaktionen (K1-1) |
| PPM-2 | Projektvertrag ab Benachrichtigung auf dem Telefon unterzeichnen | ≤ 60 s, ≤ 3 Interaktionen (K2-1) |
| PPM-3 | Monatsabschluss bis Monatsende ohne Nacharbeit ausserhalb des Systems | 100 % der Perioden (K1-5) |
| PPM-4 | Gate Review Packet und Portfoliobericht entstehen im System | 0 von Hand erstellte Dateien (K2-5, K3) |
| PPM-5 | Gremiumsmitglied findet auf dem Tablet Antrag und Hauptänderungen eines Traktandums | ≤ 30 s, ≥ 90 % ohne Hilfe (K3-5) |
| PPM-6 | Zufriedenheit | SUS ≥ 75 je Rolle PL, UE, AG, Gremium; Antragstellende Aufgabenerfolg ≥ 90 % (K4-1) |

## Abweichungen vom Rahmen

| Regel | Abweichung | Begründung |
|---|---|---|
| I-N1 | Die Arbeitsräume heissen nach dem Gegenstand der Fachleute (Projekte, Portfolio, Gremien, Ziele), nicht nach einem Verb. | Begriffe des PM-Handbuchs und des Masterdokuments (G10, Master §7). Jeder Arbeitsraum gehört trotzdem zu einer Tätigkeit (Projekt führen, Portfolio steuern, im Gremium entscheiden, Ziele setzen), nicht zu einem Datenobjekt oder Business Module. |

## Projektentscheide

| Nr. | Entscheid | Begründung |
|---|---|---|
| UX-E1 | **Web-Anwendung im Browser, Desktop primär.** Unterzeichnen, Änderung entscheiden, Unterlagen lesen und der Eingang sind ab 360 px vollständig; dichte Arbeitsflächen (Bewertung, Szenarien, Kapazität, Protokoll) bearbeitbar ab 1024 px, darunter lesend. Keine native App, keine Offline-Fähigkeit. | Kurze Zeitfenster der Projektauftraggeber:innen ([nutzungskontexte.md](nutzungskontexte.md)); keine Rolle arbeitet ohne Netz. Neu prüfen, wenn sich die Annahmen zu den Geräten nicht bestätigen (UX-OF-3) oder der Zugriff von unterwegs eingeschränkt wird (UX-OF-6). |
| UX-E2 | **Sechs Arbeitsräume:** Eingang, Projekte, Portfolio, Gremien, Ziele, Administration. | UX-Prinzip des Masterdokuments (§7); I-N1 |
| UX-E3 | **Ein Eingang als Startseite jeder Rolle** mit Kopf je Rolle und einer Liste «Zu tun» für alle Aufgaben der Person aus allen Rollen. | G1; Master §7 «jede wiederkehrende Aufgabe ist aus dem Eingang erreichbar»; Mehrfachrollen |
| UX-E4 | **Die Projektakte ist der Projektvertrag.** Bericht, Gate, Änderung und Abschluss sind Bereiche bzw. Entwürfe derselben Akte; Dashboard, Gate Review Packet und Dokument sind Sichten darauf. | G3; Master §7 «Daten werden einmal erfasst» |
| UX-E5 | **Höchstens ein Entwurf je Projekt** neben der Baseline. | eine Wahrheit je Projekt, kein Zusammenführen paralleler Versionen (Heuristik «weniger Möglichkeiten für folgenreiche Fehler»); UX-OF-8 |
| UX-E6 | **Projektstatus und Bearbeitungsstand getrennt dargestellt:** Status als Kreis mit Symbol, Stand als Badge. | Verwechslung «Kritisch» mit «abgelehnt» vermeiden ([darstellung.md](darstellung.md)) |
| UX-E7 | **Anrede «Du»**, Schweizer Rechtschreibung mit «ss». | Entscheid UX-OF-1 (28.10.2026); gleiche Anrede wie der Baukasten (Anmeldung, Verwaltung, E-Mails) |
| UX-E8 | **VR und SNS-VR sind keine Benutzer.** Sie erhalten Dokumente; die UE erfasst Vorlagen, Freigaben und Entscheide. | Vorschlag K02; wenige, seltene Vorgänge |
| UX-E9 | **Gremienunterlagen im System**, PDF zum Herunterladen, E-Mail nur mit Link. | G3, I-B2; ein Stand für alle; UX-OF-15 |
| UX-E10 | **«Projekt» statt «Vorhaben»** in der Oberfläche. | Sprache des PM-Handbuchs und des Dashboards (G10); siehe Glossar |
| UX-E11 | **Fristen aus dem PM-Handbuch in Arbeitstagen** (Versand 5, Protokoll 2–3), übrige Fristen in Kalendertagen; die Art steht immer dabei. | Q8 Kap. 8.1 rechnet in Arbeitstagen; Verwechslung vermeiden |
| UX-E12 | **Vermerk statt Sperre.** Fehlen Quality-Check, Unterschrift, Freigabe oder Abnahme, zeigt die Aktion vorher, was fehlt, und lässt sich trotzdem ausführen; das Objekt trägt den Vermerk sichtbar («ohne Freigabe»), die Aufgabe bleibt im Eingang, bis der Vermerk nachgetragen ist. Sperren bleiben nur für unvollständige Eingaben (Pflichtangaben, Begründungen). | Produktgrundsatz G1; eine Unterschrift oder Freigabe darf den Ablauf nicht anhalten |
| UX-E13 | **Verlauf am Objekt statt Sperre nach Einreichen, Versand oder Abschluss.** Änderungen danach erzeugen eine Version mit Markierung («geändert nach Versand») und sind im Verlauf des Objekts für alle sichtbar, die es sehen. | Produktgrundsatz G2 |
| UX-E14 | **Zugriff in der Projektakte und am Portfolio** als eigener Bereich «Zugriff»: wer führt, steuert, mitliest, mit «Warum?»; zentral zusätzlich in Administration › Zugänge. Die Projektorganisation wirkt nicht auf den Zugriff. | Master Entscheide 16, 18 |

## Glossar der Oberfläche

Ein Begriff je Sache (I-X4). Rollenkürzel der Spezifikation (PL, AG, UE, AS, KT …) und IDs (UC, BC, K, UI) erscheinen nie in
der Oberfläche. Eigennamen der Insel Gruppe (PRAT, GLPA, SNS-VR, Kategorie A/B/C, P0–P4) erscheinen, weil die
Fachleute sie so verwenden.

| Begriff in der Oberfläche | Fachgrundlage | Nicht verwenden |
|---|---|---|
| Eingang | Eingang (Master §7) | Posteingang, Inbox, Cockpit, Aufgabenliste |
| Zu tun | Aufgabe im Eingang | Pendenz, To-do |
| Projekt | Vorhaben (Funktionsbaum), Projekt (Q8) | Vorhaben, Initiative, Massnahme |
| Projektidee | Projektidee (DM.01) | Antrag, Idee-Antrag, Projektantrag |
| Ideenpool | Ideenpool (Q8 Kap. 6.1) | Ideenspeicher, Backlog |
| Projektvertrag | Projektvertrag (Q7); «Projektvereinbarung» in Q8 | Projektvereinbarung, Projektauftrag |
| Projektakte | Projektakte (UC-002 UI) | Projektdossier |
| Baseline | freigegebene, verbindliche Version des Projektvertrags | Referenzversion, Master |
| Entwurf | neue, noch nicht freigegebene Version | Arbeitsversion, Draft |
| Phase P0 Initialisierung … P4 Abschluss | Phasenmodell (Q8 Kap. 7) | Stufe, Etappe |
| Gate | Gate (Q6 F6, Q8) | Meilensteinentscheid, Stage-Gate, Tor |
| Leitfragen | Leitfragen je Gate und Wertestrom | Checkliste, Kriterien |
| Gate Review Packet | Gate Review Packet (Q8 Kap. 8.2) | Gate-Unterlagen, Dossier |
| Quality-Check | Quality-Check bzw. Quality Review (DM.02.05) | Quality Review, QS-Prüfung, Review |
| Unterzeichnen | Unterzeichnung durch Projektauftraggeber:in und PL; ein Vermerk (G1) | signieren, visieren |
| Freigeben | Entscheid eines Gremiums bzw. der Projektauftraggeber:in; ein Vermerk (G1) | genehmigen, bewilligen |
| Vermerk | festgehaltene Prüfung, Unterschrift, Freigabe oder Abnahme, auch nachgetragen (G1); fehlt einer: «ohne Freigabe», «Unterschrift offen» | Sperre, Status (für Vermerke) |
| Verlauf | Änderungen am Objekt: wer, wann, vorher, nachher (G2) | Historie, Log |
| Zugriff | Rolle einer Person an einem Portfolio oder Projekt (Master Entscheide 16, 18) | Berechtigung, Freigabe (für Zugriff) |
| Steuern, Führen, Mitlesen | Rollen je Portfolio bzw. Projekt (Master Entscheid 18) | Owner, Admin, Viewer |
| Statusbericht | Statusbericht (PS.01.01) | Monatsbericht, Reporting, Meldung |
| Im Plan / Kritisch | Status (Q8 Kap. 9) | grün / rot, OK / nicht OK, Ampel |
| Trend aufwärts / gleichbleibend / abwärts | Trend (Q8 Kap. 9) | Tendenz, besser / schlechter |
| Eskalation | Eskalation (PS.03.03) | Eskalationsmeldung, Issue |
| Änderung am Projektvertrag | Änderungsantrag (UC-007) | Change Request, CR, Nachtrag |
| Monatsabschluss | Konsolidierung der Periode (UC-005) | Konsolidierung, Periodenabschluss |
| Dashboard | Dashboard (Q8 «Single Source of Truth») | Cockpit, Übersicht |
| Gremium | PRAT, GLPA, SNS-VR | Ausschuss (als Oberbegriff), Board |
| Sitzung | Sitzung des Gremiums | Meeting, Termin |
| Traktandum, Traktandenliste | Traktandum (UC-006) | Agendapunkt, Tagesordnungspunkt, Geschäft |
| Entscheid | Entscheid (UC-006) | Beschluss, Entscheidung |
| Auflage | Auflage (UC-006 A3) | Bedingung, Pendenz |
| Protokoll | Protokoll (UC-006) | Beschlussprotokoll, Minutes |
| Projektauftraggeber:in | Projektauftraggeber und -sponsor (AG, eine Funktion; Master Entscheid 12) | Sponsor, Auftraggeber |
| Projektleitung | PL (Funktion Projektmanager:in im Produkt) | Projektleiter/in, PM |
| Unternehmensentwicklung | UE (Programmleitung) | Programmleitung, PMO (als Name der Stelle) |
| Handlungsfeld | strategisches Handlungsfeld (Q9) | Themenfeld, Säule |
| Strategisches Ziel, Jahresziel, Hauptaktivität | Zielstruktur (Q6 F3) | Objective, Key Result, Massnahme |
| Metrik | Metrik je Ziel (ZM.02.04) | KPI (für Ziele), Messgrösse |
| KPI | Projekt-KPI (PC.03.01) | Metrik (für Projekte) |
| Kategorie A / B / C | Projektkategorie (Q8 Kap. 6) | Tier, Stufe |
| Portfolio Transformation / Geschäftsleitung / Direktion ‹Name› | Portfolios A, B, C | Transformationsportfolio, strategisches Portfolio |
| Szenario, Wasserlinie | Szenario, Wasserlinie (UC-008) | Variante, Budgetlinie, Cut-off |
| Stellvertretung | Stellvertretung (AM.01.03) | Vertretung, Delegation |

## Verankerung

- Vor einer Oberfläche zu einem Kernablauf wird dessen Datei in [ablaeufe/](ablaeufe/) gelesen oder ergänzt; Abweichungen
  werden dort nachgeführt.
- Jede Umsetzung mit Oberfläche erfüllt die UX-Definition of Done ([rahmen/pruefung.md](rahmen/pruefung.md#beim-bau-ux-definition-of-done)).
- [rahmen/](rahmen/) wird nicht projektbezogen geändert; Abweichungen gehören in den Abschnitt oben.
- Nummern K, UX-E, UX-OF, PPM und UI werden nie umnummeriert; Neues wird hinten angefügt.
