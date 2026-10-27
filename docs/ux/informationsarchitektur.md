# Informationsarchitektur

Einen UI-Katalog gibt es in der Fachgrundlage nicht. Er ist hier aus dem Feld «User Interfaces» der 18 Use Cases
**abgeleitet** ([anhang/use-cases.md](../anhang/use-cases.md)): gleiche Oberflächen sind zusammengefasst, IDs `UI-01` …
neu vergeben. Die 50 Oberflächen werden zu **sechs Arbeitsräumen** zusammengefasst, wie im UX-Prinzip des Masterdokuments
festgelegt ([PPM-Master.md, Abschnitt 7](../PPM-Master.md#7-ux-prinzip-arbeitsräume); UX-E2). Jede Rolle sieht davon
höchstens sechs (I-N1).

«Arbeitsraum» ist der Projektbegriff für die Arbeitsfläche der Navigation im Rahmen (I-N1). Er ist nicht zu verwechseln
mit dem Seitentyp «Arbeitsfläche» (interaktion.md Abschnitt 2), der eine einzelne Ansicht beschreibt.

## Arbeitsräume

| Arbeitsraum | Adresse | Wofür | Bereiche |
|---|---|---|---|
| **Eingang** | `/eingang` | Startseite jeder Rolle: was jetzt gilt und zu tun ist (G1, UX-E3) | Kopf je Rolle, «Zu tun», Mitteilungen |
| **Projekte** | `/projekte` | ein Projekt führen: Vertrag erarbeiten und fortschreiben, berichten, ändern, abschliessen | Meine Projekte; je Projekt die Projektakte mit Übersicht, Vertrag, Bericht, Versionen, Abschluss |
| **Portfolio** | `/portfolio` | das Portfolio überblicken und steuern: Ideen aufnehmen, Monatszyklus abschliessen, priorisieren, Ressourcen und Finanzen | Dashboard, Ideen, Monatsabschluss, Priorisierung, Ressourcen, Finanzen, Auswertungen |
| **Gremien** | `/gremien` | im Gremium entscheiden: Sitzungen vorbereiten, durchführen, protokollieren | Sitzungen, Entscheide, Jahresrückblick |
| **Ziele** | `/ziele` | Ziele im Jahreszyklus setzen und ihre Erreichung berichten | Zielzyklus, Zielerreichung, Quartalsreporting |
| **Administration** | `/administration` | einrichten nach PM-Handbuch und Organisation | Benutzer und Rollen, Organisation, Codetabellen, Phasenmodell, Portfolios und Gremien, Vorlagen, Schnittstellen, Änderungsprotokoll |

Persönliches liegt im **Kontomenü**: Profil und Stellvertretung (UC-016 Schritt 4), Benachrichtigungen, Sprache,
Farbschema, Feedback, Abmelden.

## Sichtbarkeit je Rolle

● sichtbar · ○ teilweise (nur Bereiche oder Objekte der Rolle, meist lesend) · – nicht sichtbar. Massgebend ist das Recht,
nicht der Rollenname (I-N2); Projektrollen gelten je Projekt (UC-016 Schritt 2).

| Arbeitsraum | PL, CTL, KT | SP | AS | UE, PMO | PRAT, GLPA | GL | DIR | FI | RM | ADM |
|---|---|---|---|---|---|---|---|---|---|---|
| Eingang | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| Projekte | ● eigene | ● eigene | – | ● | ○ lesend | ○ lesend | ○ Direktion | ○ lesend | ○ lesend | – |
| Portfolio | ○ Ideen | ○ Dashboard, Ideen | ○ eigene Ideen | ● | ○ Dashboard, Priorisierung, Auswertungen | ○ Dashboard, Auswertungen | ○ Direktion | ○ Finanzen, Dashboard, Auswertungen | ○ Ressourcen, Dashboard | – |
| Gremien | ○ eigene Traktanden | ○ eigene Traktanden | – | ● | ● eigenes Gremium | ○ lesend | – | – | – | – |
| Ziele | ○ lesend | ○ lesend | – | ● | ○ lesend | ● | ○ lesend | – | – | – |
| Administration | – | – | – | ○ Phasenmodell, Portfolios und Gremien, Vorlagen, Änderungsprotokoll | – | – | – | – | – | ● |
| **Anzahl** | 5 | 5 | 2 | 6 | 5 | 5 | 4 | 3 | 3 | 2 |

Ob Projektleitungen das Dashboard des ganzen Portfolios sehen und wer Beträge sieht, ist offen
([UX-OF-12](fahrplan.md#offene-fragen)); bis zur Klärung sehen Projektrollen nur ihre Projekte.

## Navigation

- **Desktop (ab 1024 px):** Leiste links mit den sichtbaren Arbeitsräumen in der Reihenfolge der Tabelle oben, Zähler offener
  Aufgaben an «Eingang» (I-N3).
- **Tablet (768–1023 px):** schmale Leiste links mit Symbol und Kurzname.
- **Telefon:** Leiste unten mit **Eingang, Projekte, Gremien, Mehr**; unter «Mehr» Portfolio, Ziele, Administration und das
  Kontomenü. Wer einen Arbeitsraum nicht sieht, erhält das nächste sichtbare Ziel; Antragstellende sehen unten nur
  **Eingang** und **Ideen**.
- **Befehlspalette (Strg+K / ⌘K, I-N4):** Aktionen «Statusbericht erstellen», «Projektidee einreichen», «Änderung
  beantragen», «Stellvertretung erfassen», «Nächste Sitzung öffnen», «Dashboard öffnen»; Suche nach Projekten (Name,
  Nummer), Ideen, Sitzungen, Zielen und Personen, gefiltert nach Recht.
- **Kontext im Kopf:** In Portfolio und Gremien steht das gewählte **Portfolio** (Transformation, Geschäftsleitung oder eine
  Direktion) bzw. das **Gremium** im Kopf und in der Adresse (`?portfolio=transformation`, `/gremien/prat`). Im
  Monatsabschluss steht die **Periode** (`?periode=2026-10`), in Ziele das **Jahr** (`/ziele/2027`).

## Startseite je Rolle

Der Eingang hat für alle denselben Aufbau (Seitentyp Startseite): Kopf mit der Antwort auf die Kernfrage
([nutzungskontexte.md](nutzungskontexte.md)), darunter «Zu tun» mit allen Aufgaben der Person aus allen Rollen, nach
Frist sortiert, je mit Direktaktion, dann Mitteilungen. Wer mehrere Rollen hat, sieht mehrere Kopfkarten nebeneinander
(Telefon: untereinander, die erste offen).

| Rolle | Kopf | «Zu tun» (Beispiele) |
|---|---|---|
| PL | je eigenes Projekt: Phase, Status und Trend, nächster Meilenstein, nächste Frist («Statusbericht Oktober fällig Sa 25.10. · in 3 Tagen»; «Gate P1–P2 im PRAT Mi 10.12.») | «Statusbericht Oktober erstellen» → Bericht; «Rückfrage zum Statusbericht beantworten»; «Gate P1–P2 vorbereiten · Unterlagen bis Mi 3.12.»; «Projektvertrag unterzeichnen» |
| CTL | eigene Projekte mit Phase und nächstem Gremientermin («Sie stellen am Mi 10.12. im PRAT vor») | «Projektvertrag Version 2.0 unterzeichnen» → Zusammenfassung mit «Unterzeichnen» |
| SP | eigene Projekte, kritische zuerst: Status, Trend, Grund («Kritisch seit Oktober: Lieferverzug Hauptsystem») | «Änderung am Projektvertrag entscheiden»; «Projektvertrag unterzeichnen»; «Projekt kritisch: Massnahme ansehen» |
| AS | eigene Ideen mit Stand («Ideenpool: in Prüfung seit 3.10.») und Schaltfläche **Projektidee einreichen** | «Rückfragen zu Ihrer Idee beantworten» |
| UE, PMO | Monatszyklus: «Statusberichte Oktober: 23 von 31 eingereicht, 15 geprüft · Stichtag Sa 25.10. · Abschluss bis Fr 31.10.»; nächste Sitzung: «PRAT Mi 12.11. · Versand bis Mi 5.11. · 4 von 6 Traktanden mit Unterlagen» | «Statusbericht prüfen» (Sammelaufgabe je Periode); «Quality-Check Projektvertrag ‹Projekt›»; «Projektidee prüfen»; «Sitzung vorbereiten»; «Protokoll versenden · bis Mo 17.11.» |
| PRAT, GLPA | nächste Sitzung mit Anzahl Traktanden und Stand der Unterlagen («Unterlagen bereit seit Mi 5.11.»); Gesamtstatus des Portfolios («27 im Plan · 4 kritisch · 2 Eskalationen») | «Unterlagen PRAT 12.11. lesen»; Auflagen, für die man verantwortlich ist |
| GL | Zielzyklus («Jahresziele 2027: 28 von 32 mit Metrik · Vorlage an den VR bis 15.11.»); Zielerreichung des letzten Quartals | «Jahresziele 2027 vervollständigen»; «Zielerreichung Q3 beurteilen» |
| DIR | Projekte der Direktion mit Status und Trend | «Initialisierung freigeben» (UC-001 A4) |
| FI | Prognose gegenüber Budget über das Portfolio, Anzahl Projekte mit Überschreitung, letzter Lauf der Ist-Kosten | «Abweichung klären»; «Jahresbedarf an den Budgetprozess übergeben» |
| RM | offene Bedarfe, Konflikte, Auslastung der nächsten drei Monate | «Bedarf ‹Projekt› decken»; «Konflikt auflösen» |
| ADM | Schnittstellenläufe mit Fehler, Zugänge zu entziehen | «Lauf ‹ERP Ist-Kosten› fehlgeschlagen»; «Rollen von ‹Person› neu besetzen» |

## Zuordnung UI-Katalog → Arbeitsräume

Abgeleitet aus den Use Cases. Jede Oberfläche genau einmal.

| UI | Oberfläche | Use Cases | Arbeitsraum › Bereich | Seitentyp | Ablauf |
|---|---|---|---|---|---|
| UI-01 | Eingang | alle mit Aufgaben | Eingang | Startseite | alle |
| UI-02 | Formular Projektidee | UC-001 | Portfolio › Ideen › Neue Idee | Assistent | K4 |
| UI-03 | Ideenpool (Liste, Funnel «Pre-P0») | UC-001 | Portfolio › Ideen | Liste + Schublade | K4 |
| UI-04 | Idee prüfen (ähnliche Ideen, Leitfragen Eintritt P0, Kriterienraster) | UC-001 | Portfolio › Ideen › Idee (eigene Seite) | Liste + Schublade | K4 |
| UI-05 | Meine Projekte | UC-002–004, 007, 015 (Einstieg Projektakte) | Projekte | Liste + Schublade | K1, K2 |
| UI-06 | Projektübersicht (Phase, Status, Meilensteine, Entscheide) | UC-014 A1 | Projekte › Projekt › Übersicht | Bericht | – |
| UI-07 | Projektakte mit den Kapiteln des Projektvertrags | UC-002, UC-003 | Projekte › Projekt › Vertrag | Arbeitsfläche | K2 |
| UI-08 | Gate-Modus (Leitfragen je Wertestrom, Lieferergebnisse, Hauptänderungen) | UC-003 | Projekte › Projekt › Vertrag, Seitenpanel «Gate» | Arbeitsfläche | K2 |
| UI-09 | Änderungsantrag | UC-007 | Projekte › Projekt › Vertrag, Entwurf mit Anlass «Änderung» | Arbeitsfläche | K2 |
| UI-10 | Versionsvergleich | UC-003, UC-007 | Projekte › Projekt › Versionen | Arbeitsfläche | K2 |
| UI-11 | Dokumentausgabe Projektvertrag | UC-002 | Projekte › Projekt › Versionen, Aktion «Als Dokument herunterladen» | Arbeitsfläche | K2 |
| UI-12 | Prüfen und Unterzeichnen (Quality-Check, Unterschriften) | UC-002, UC-003 (aus Schritten 9–10 bzw. 7–8) | Projekte › Projekt › Vertrag, Prüf- bzw. Unterzeichnungsansicht | Arbeitsfläche | K2 |
| UI-13 | Statusbericht | UC-004 | Projekte › Projekt › Bericht | Arbeitsfläche | K1 |
| UI-14 | Abschluss | UC-015 | Projekte › Projekt › Abschluss | Arbeitsfläche | – |
| UI-15 | Berichte der Periode | UC-005 | Portfolio › Monatsabschluss | Posteingang | K1 |
| UI-16 | Terminabweichungen | UC-005 | Portfolio › Monatsabschluss › Termine | Bericht | K1 |
| UI-17 | Portfolio-Dashboard (Liste, Funnel nach Phase) | UC-004, 005, 006, 014 | Portfolio › Dashboard | Bericht | K1, K3 |
| UI-18 | Risikolage | UC-006, UC-014 | Portfolio › Dashboard › Risiken | Bericht | K3 |
| UI-19 | Bewertungsmodell und Budgetrahmen | UC-008 A1 | Portfolio › Priorisierung › Modell | Liste + Schublade | K5 |
| UI-20 | Bewertungsmaske | UC-008 | Portfolio › Priorisierung › Bewertung | Arbeitsfläche | K5 |
| UI-21 | Portfolio-Matrix (Nutzen/Risiko, Ressourcen/Nutzen) | UC-008, UC-014 | Portfolio › Priorisierung › Matrix (im Dashboard als Ansicht verlinkt, G3) | Arbeitsfläche | K5 |
| UI-22 | Szenarien und Szenariovergleich mit Wasserlinie | UC-008 | Portfolio › Priorisierung › Szenarien | Arbeitsfläche | K5 |
| UI-23 | Auslastung | UC-008, UC-009 | Portfolio › Ressourcen › Auslastung | Bericht | K5 |
| UI-24 | Kapazitätsplanung je Pool | UC-009 | Portfolio › Ressourcen › Kapazität | Arbeitsfläche | – |
| UI-25 | Bedarfsliste und Zuteilung | UC-009 | Portfolio › Ressourcen › Bedarf | Liste + Schublade | – |
| UI-26 | Finanzübersicht | UC-010 | Portfolio › Finanzen | Bericht | – |
| UI-27 | Budgetabweichungen | UC-010 | Portfolio › Finanzen › Abweichungen | Bericht | – |
| UI-28 | Übergabe an den Budgetprozess (Export) | UC-010, UC-011 | Portfolio › Finanzen › Budgetprozess | Assistent | – |
| UI-29 | Portfoliobericht | UC-006, UC-014 | Portfolio › Auswertungen › Portfoliobericht | Bericht | K3 |
| UI-30 | Ad-hoc-Auswertungen | UC-014 | Portfolio › Auswertungen | Bericht | – |
| UI-31 | Portfolio-Roadmap | UC-011 | Portfolio › Auswertungen › Roadmap | Bericht | K6 |
| UI-32 | Lessons Learned | UC-013, UC-015 | Portfolio › Auswertungen › Lessons Learned | Liste + Schublade | – |
| UI-33 | Sitzung mit Traktandenliste und Unterlagen | UC-006 (Traktanden aus UC-001, 002, 003, 007, 008, 012, 013, 015) | Gremien › Sitzungen | Arbeitsfläche | K3 |
| UI-34 | Entscheidmaske (Sitzungsmodus) | UC-006 | Gremien › Sitzungen › Traktandum | Arbeitsfläche | K3 |
| UI-35 | Protokoll | UC-006 (aus Schritten 8–9) | Gremien › Sitzungen › Protokoll | Arbeitsfläche | K3 |
| UI-36 | Entscheide und Auflagen | UC-006 (aus Schritt 7, A3) | Gremien › Entscheide | Liste + Schublade | K3 |
| UI-37 | Jahresauswertung | UC-013 | Gremien › Jahresrückblick | Bericht | – |
| UI-38 | Zielhierarchie und Zielzyklus | UC-011 | Ziele › Zielzyklus | Arbeitsfläche | K6 |
| UI-39 | Freigabe der Jahresziele | UC-011 | Ziele › Zielzyklus, «Zur Freigabe vorlegen» / «Freigabe erfassen» | Assistent | K6 |
| UI-40 | Zielerreichung | UC-012 | Ziele › Zielerreichung | Arbeitsfläche | K6 |
| UI-41 | Quartalsreporting (Berichtsentwurf) | UC-012 | Ziele › Quartalsreporting | Arbeitsfläche | K6 |
| UI-42 | Benutzer, Rollen und Berechtigungen | UC-016 | Administration › Benutzer und Rollen | Liste + Schublade | – |
| UI-43 | Profil mit Stellvertretung | UC-016 | Kontomenü › Profil | Liste + Schublade | – |
| UI-44 | Organisation | UC-017 | Administration › Organisation | Liste + Schublade | – |
| UI-45 | Codetabellen | UC-017 | Administration › Codetabellen | Liste + Schublade | – |
| UI-46 | Phasenmodell (Phasen, Gates, Leitfragen, Lieferergebnisse, Pflichtangaben; versioniert) | UC-017 | Administration › Phasenmodell | Arbeitsfläche | – |
| UI-47 | Portfolios und Gremien (Gremienweg, Sitzungsrhythmus) | UC-017 | Administration › Portfolios und Gremien | Liste + Schublade | – |
| UI-48 | Vorlagen | UC-018 | Administration › Vorlagen | Liste + Schublade | – |
| UI-49 | Schnittstellen mit Laufprotokoll | UC-018 | Administration › Schnittstellen | Liste + Schublade | – |
| UI-50 | Änderungsprotokoll | UC-018 | Administration › Änderungsprotokoll | Bericht | – |

Anmerkung zu UI-06: Die Projektübersicht ist ein Bericht über ein einzelnes Projekt (Kopf mit Status, Phasenleiste,
Meilensteine, letzte Entscheide) und der Einstieg in die Projektakte; sie ist keine Startseite im Sinn des Rahmens.

## Adressen

| Adresse | Inhalt |
|---|---|
| `/eingang?filter=frist` | Eingang, «Zu tun» gefiltert |
| `/projekte?rolle=sponsor` | eigene Projekte, gefiltert nach eigener Rolle |
| `/projekte/<nr>` | Projektübersicht, z. B. `/projekte/2026-014` |
| `/projekte/<nr>/vertrag?kapitel=7&version=entwurf` | Projektakte, Kapitel 7 des Entwurfs |
| `/projekte/<nr>/vertrag?gate=p1-p2` | Projektakte im Gate-Modus |
| `/projekte/<nr>/versionen?vergleich=baseline...entwurf` | Versionsvergleich |
| `/projekte/<nr>/bericht?periode=2026-10` | Statusbericht der Periode |
| `/portfolio/dashboard?portfolio=transformation&ansicht=funnel&periode=2026-10` | Dashboard |
| `/portfolio/ideen?stand=eingereicht&o=idee:118` | Ideenpool mit geöffneter Idee in der Schublade |
| `/portfolio/monatsabschluss?periode=2026-10&stand=eingereicht&sort=auffaellig` | Berichte der Periode |
| `/portfolio/priorisierung/szenarien?portfolio=transformation&vergleich=a,b` | Szenariovergleich |
| `/gremien/prat/sitzungen/2026-11-12?traktandum=3` | Sitzung, Traktandum 3 |
| `/gremien/prat/sitzungen/2026-11-12/protokoll` | Protokoll |
| `/ziele/2027?o=ziel:2.1` | Zielzyklus 2027 mit geöffnetem Ziel |
| `/ziele/2026/zielerreichung?quartal=q3` | Zielerreichung Q3 |

Projektnummern, Ideennummern und Sitzungsdaten sind stabil und lesbar; interne IDs erscheinen nicht in der Adresse (I-N5).

## Ablösung heutiger Mittel

Heute führt die UE das Dashboard in Excel (Q8 Kap. 8.3), Verträge entstehen in Word nach Vorlage Q7, Unterlagen gehen per
E-Mail. Die Oberfläche ersetzt das so:

| Heute | Neu | Grundsatz |
|---|---|---|
| Excel-Dashboard, von der UE aus den Meldungen zusammengetragen | Portfolio › Dashboard als Sicht auf die Statusberichte; die UE prüft, statt abzutippen | G3, Master §7 «Daten einmal erfassen» |
| Projektvertrag als Word-Datei je Version | Projektakte mit Kapiteln und Versionen; das Word- bzw. PDF-Dokument wird erzeugt (UI-11) | G3, G11 |
| Unterlagen und Protokoll per E-Mail-Anhang | Sitzung im Arbeitsraum Gremien; E-Mail nur als Zustellweg mit Link (I-B2), PDF zum Herunterladen | G3, UX-E9 |
| Aufgaben aus E-Mails und Kalender | Eingang mit allen Aufgaben und Fristen | G1, UX-E3 |
