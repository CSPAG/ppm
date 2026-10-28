# Fachmodell und Modulschnitt

Verbindlicher Bauplan für die parallele Umsetzung von PPM: Module, Tabellen, Rechte, Aufgaben, API und Arbeitspakete.
Fachlich führen [PPM-Master.md](PPM-Master.md), [Funktionsbaum](anhang/funktionsbaum.md), [Use Cases](anhang/use-cases.md),
[Klärungsliste](anhang/klaerungsliste.md) und die [UX-Schicht](ux/README.md); technisch die
[Zielarchitektur](zielarchitektur.md). Dieses Dokument erfindet keine Fachregeln: Wo die Grundlage `[OFFEN]` ist, gilt
eine Annahme aus [Abschnitt 8](#8-annahmen) (`A-nn`). Stand der Umsetzung: [umsetzungsstand.md](umsetzungsstand.md).

| | |
|---|---|
| Stand | 27. Oktober 2026 |
| Gilt für | alle Sessions, die Arbeitspakete `AP-<Etappe>-<n>` umsetzen |
| Ändern | nur per PR; Modulschnitt, Rechte und Migrationsbereiche nur zusammen mit der Master-Session |

## Inhalt

1. [Modulschnitt](#1-modulschnitt)
2. [Datenmodell](#2-datenmodell)
3. [Rechte und Orte](#3-rechte-und-orte)
4. [Aufgaben und Eingang](#4-aufgaben-und-eingang)
5. [API-Schnitt](#5-api-schnitt)
6. [Regeln und Konfiguration (UC-017)](#6-regeln-und-konfiguration-uc-017)
7. [Arbeitspakete](#7-arbeitspakete)
8. [Annahmen](#8-annahmen)

## 1. Modulschnitt

### 1.1 Backend-Module (`src/modules/<x>/`)

Reihenfolge = Reihenfolge in `src/app.ts` (Tags der API-Doku). Jedes Modul nach dem Muster `handlungsfeld`
(`index.ts` mit `defineModule`, `routes.ts`, `store.ts`, `schemas.ts`, `mcp.ts`).

| Modul | Inhalt | BC | UC | Etappe | nutzt (nur über `index.ts`) |
|---|---|---|---|---|---|
| `eingang` | Aufgaben, Mitteilungen, Stellvertretung | AM.01.03 | UC-016 Schritt 4; alle mit Aufgaben | E0 | – (Basis, kennt kein Fachmodul) |
| `stammdaten` | Organisationseinheiten (Direktionen), Codetabellen, Feiertage | AM.02.01, AM.02.02 | UC-017 | E0 | – |
| `handlungsfeld` (besteht) | strategische Handlungsfelder | ZM.01.01 | UC-011 | E0 | – |
| `phasenmodell` | Phasen, Gates, Leitfragen je Wertestrom, Standard-Lieferergebnisse und -Meilensteine, Pflichtangaben, Fristen, Toleranzen; versioniert | AM.02.03 | UC-017 | E0 | `stammdaten` |
| `portfolio` | Portfolios A/B/C, Gremien, Gremienweg je Phase und Kategorie, Sitzungsrhythmus | AM.02.04 | UC-017 | E0 | `stammdaten`, `phasenmodell` |
| `projekt` | Projekt (Nummer, Portfolio, Phase, Lebenszyklus), Projektorganisation, Meine Projekte, Projektübersicht, Übernahme Excel | PP.04.04, PP.02.04 (Zuordnung), PC.04.01 (UC-014 A1) | UC-002 Schritt 2, UC-014 A1, UC-016 Schritt 2 | E0 | `eingang`, `stammdaten`, `phasenmodell`, `portfolio` |
| `projektdaten` | Register je Projekt: Meilensteine, Lieferergebnisse, Kosten je Phase, Risiken (Projekt und Portfolio), KPIs mit Werten, Stakeholder, Kommunikation, Abhängigkeiten, Ressourcenbedarf, ICT-/Infrastrukturmeldung | PS.02.04, PC.01.01, PC.01.03, PC.02.01, PC.02.03, PC.02.04, PC.03.01, PC.03.03, PS.05.01–03, PP.02.03, RK.02.01, RK.02.05, RK.02.06 | UC-002, UC-003, UC-004 | E0 | `projekt`, `phasenmodell`, `eingang` |
| `ziel` | strategische Ziele, Jahresziele, Hauptaktivitäten, Metrik, Zuordnung Projekt ↔ Ziel, Zielerreichung, Quartalsreporting, Roadmap | ZM.01.02, ZM.02.01–04, ZM.03.01, ZM.03.02, PP.02.05, PP.04.03 | UC-011, UC-012 | E0, E6 | `handlungsfeld`, `projekt`, `eingang`, `sitzung` (ab E6), `vorlage` (Dokument des Quartalsreportings, AP-E6-4); liest den Portfoliobericht (`auswertung`) nur als Daten in den Entwurf |
| `sitzung` | Sitzungen, Traktanden mit Arten-Registry, Unterlagen, Versand, Entscheide, Auflagen, Protokoll | PP.04.01, PP.04.02, PP.04.05, PS.02.02, PS.02.03 | UC-006 | E2 | `portfolio`, `projekt`, `phasenmodell`, `eingang` |
| `statusbericht` | Periode, Statusbericht, Prüfung, Rückfrage, Monatsabschluss, Dashboard-Stand der Periode, Terminabweichungen, Eskalation | PS.01.01–04, PS.03.03 | UC-004, UC-005 | E1, E2 | `projekt`, `projektdaten`, `phasenmodell`, `eingang`, `sitzung` (ab E2) |
| `auswertung` | Dashboard (Liste, Funnel), Risikolage, Portfoliobericht, Ad-hoc-Auswertungen | PC.04.01–03, PC.02.02 | UC-014 | E1, E2, E7 | `statusbericht`, `projektdaten`, `projekt`, `portfolio`, `sitzung` |
| `vorlage` | Vorlagen mit Versionen und Feldzuordnung, Dokumentausgabe (Word/PDF) | AM.03.01, DM.02.07 | UC-018, UC-002 Schritt 12 | E3, E7 | – |
| `vertrag` | Projektvertrag: Versionen, Kapitel, Baseline, Pflichtangaben, Quality-Check, Unterschriften, Gate-Antrag mit Leitfragen, Hauptänderungen, Versionsvergleich, Änderungsantrag | DM.02.01–07, PS.02.01, PS.02.05, PS.03.01, PS.03.02, PS.03.04, PC.03.02, PC.03.04 | UC-002, UC-003, UC-007 | E3 | `projekt`, `projektdaten`, `phasenmodell`, `portfolio`, `ziel`, `vorlage`, `sitzung`, `eingang` |
| `idee` | Projektidee, Ideenpool, Leitfragen Eintritt P0, Kriterienraster, Zusammenführen, Zurückweisen, Freigabe Initialisierung | DM.01.01–04, PP.02.04 | UC-001 | E4 | `projekt`, `phasenmodell`, `portfolio`, `stammdaten`, `handlungsfeld`, `ziel`, `sitzung`, `eingang` |
| `ressource` | Kapazitätsangebot je Rolle, Zuteilung, Konflikte, Auslastung | RK.01.01, RK.01.02, RK.02.02–04 | UC-009, UC-008 | E5, E7 | `projekt`, `projektdaten`, `eingang` |
| `priorisierung` | Bewertungsmodell, Budgetrahmen, Bewertung, Matrix, Rangfolge, Szenarien mit Wasserlinie | PP.01.02, PP.01.03, PP.02.01, PP.02.02, PP.03.01–04 | UC-008 | E5 | `projekt`, `projektdaten`, `portfolio`, `ressource`, `sitzung`, `eingang` |
| `abschluss` | Abschlussbericht, Nutzenprüfung am Exit, Sistieren, Abbrechen, Wiederaufnahme, Lessons Learned | PS.04.01–03, PC.03.02 | UC-015 | E7 | `projekt`, `projektdaten`, `vertrag`, `sitzung`, `eingang` |
| `finanzen` | Ist-Kosten (ERP), Budgetabweichungen, Übergabe an den Budgetprozess | PC.01.02, PC.01.04, PC.01.05 | UC-010 | E7 | `projekt`, `projektdaten`, `schnittstelle`, `eingang` |
| `jahresrueckblick` | Jahresauswertung, Erkenntnisse und Massnahmen | ZM.03.03 | UC-013 | E7 | `ziel`, `abschluss`, `sitzung`, `eingang` |
| `schnittstelle` | Schnittstellen zu Umsystemen mit Laufprotokoll, Änderungsprotokoll (Audit des Baukastens) | AM.03.02, AM.03.03 | UC-018 | E7 | `eingang` |
| `webhooks` (besteht) | Webhooks (Profil outbox) | AM.03.02 (teilweise) | UC-018 | – | – |

Benutzer und Rollen (AM.01.01, AM.01.02, UC-016 Schritte 1–3) kommen aus dem Baukasten (`@vollholz/iam`, Verwalten-Seiten,
Entra ID je Organisation, A-21); PPM baut dafür kein eigenes Modul.

**Abhängigkeitsregeln**

- Richtung von unten nach oben: `eingang`, `stammdaten`, `handlungsfeld` → `phasenmodell` → `portfolio` → `projekt` →
  `projektdaten` → `sitzung` → übrige Fachmodule. Ein Modul nutzt nur Module, die in der Spalte «nutzt» stehen; neue Kanten
  nur per Änderung dieses Dokuments. `npm run arch` (`keine-zyklen`) prüft.
- **Rückwirkung über Registrierung, nie über Import:** Braucht ein unteres Modul Verhalten eines oberen (Entscheid in der
  Sitzung setzt die Baseline des Vertrags), registriert sich das obere beim unteren
  ([Traktandenarten, 2.9](#29-sitzung)); so in `zielarchitektur.md`, Checkliste Schritt 3.
- Daten, die ein oberes Modul an ein unteres übergibt (Idee → Projekt), werden beim Aufruf übergeben und im unteren Modul
  gespeichert (`projekt.herkunft`), damit das untere das obere nie lesen muss.
- Jede Änderung in einer Transaktion mit Audit und Ereignis (`record` aus `src/platform.ts`); Aufgaben werden in derselben
  Transaktion geöffnet und erledigt ([Abschnitt 4](#4-aufgaben-und-eingang)).

### 1.2 Features der Webapp (`web/src/features/<x>/`)

Features nutzen keine anderen Features (`feature-nur-gemeinsame-bausteine`); gemeinsame Bausteine aus `web/src/ui/`
(AP-E0-0). Adressen nach [informationsarchitektur.md](ux/informationsarchitektur.md#adressen).

| Feature | Arbeitsraum › Bereich | UI | Backend-Modul | Ablauf | AP |
|---|---|---|---|---|---|
| `eingang` | Eingang | UI-01 | `eingang` (+ Kopfdaten der Module) | alle | AP-E0-8 |
| `konto` | Kontomenü › Profil, Stellvertretung | UI-43 | `eingang` | – | AP-E0-8 |
| `projekt` | Projekte (Meine Projekte), Projekt › Übersicht; Rahmen der Projektakte (Kopf, Reiter) | UI-05, UI-06 | `projekt`, `projektdaten` | K1, K2 | AP-E0-4 |
| `bericht` | Projekte › Projekt › Bericht | UI-13 | `statusbericht` | K1 | AP-E1-1 |
| `monatsabschluss` | Portfolio › Monatsabschluss (+ Termine) | UI-15, UI-16 | `statusbericht` | K1 | AP-E1-2 |
| `dashboard` | Portfolio › Dashboard (+ Risiken), Auswertungen | UI-17, UI-18, UI-29, UI-30 | `auswertung` | K1, K3 | AP-E1-3, AP-E2-3, AP-E7-6 |
| `sitzung` | Gremien › Sitzungen, Traktandum, Protokoll, Entscheide | UI-33–UI-36 | `sitzung` | K3 | AP-E2-1, AP-E2-2 |
| `vertrag` | Projekte › Projekt › Vertrag, Versionen (Gate-Modus, Prüfen, Unterzeichnen, Änderung, Vergleich, Dokument) | UI-07–UI-12 | `vertrag` | K2 | AP-E3-1–AP-E3-5 |
| `idee` | Portfolio › Ideen (Assistent, Pool, Prüfung) | UI-02–UI-04 | `idee` | K4 | AP-E4-1–AP-E4-3 |
| `priorisierung` | Portfolio › Priorisierung (Modell, Bewertung, Matrix, Szenarien) | UI-19–UI-22 | `priorisierung` | K5 | AP-E5-1–AP-E5-3, AP-E5-5 |
| `ressourcen` | Portfolio › Ressourcen (Auslastung, Kapazität, Bedarf) | UI-23–UI-25 | `ressource` | K5 | AP-E5-4, AP-E7-2 |
| `finanzen` | Portfolio › Finanzen | UI-26–UI-28 | `finanzen` | – | AP-E7-4 |
| `ziele` | Ziele › Zielzyklus, Zielerreichung, Quartalsreporting; Portfolio › Auswertungen › Roadmap | UI-31, UI-38–UI-41 | `ziel` | K6 | AP-E0-9, AP-E6-1–AP-E6-4 |
| `handlungsfeld` (besteht) | Ziele › Handlungsfelder | – | `handlungsfeld` | K6 | – |
| `abschluss` | Projekte › Projekt › Abschluss; Portfolio › Auswertungen › Lessons Learned | UI-14, UI-32 | `abschluss` | – | AP-E7-1 |
| `jahresrueckblick` | Gremien › Jahresrückblick | UI-37 | `jahresrueckblick` | – | AP-E7-5 |
| `stammdaten` | Administration › Organisation, Codetabellen | UI-44, UI-45 | `stammdaten` | – | AP-E0-2 |
| `phasenmodell` | Administration › Phasenmodell | UI-46 | `phasenmodell` | – | AP-E0-3 |
| `portfolios` | Administration › Portfolios und Gremien | UI-47 | `portfolio` | – | AP-E0-5 |
| `vorlagen` | Administration › Vorlagen | UI-48 | `vorlage` | – | AP-E7-7 |
| `schnittstellen` | Administration › Schnittstellen, Änderungsprotokoll | UI-49, UI-50 | `schnittstelle` | – | AP-E7-3 |
| Baukasten (`makeIamRoutes`) | Administration › Benutzer und Rollen | UI-42 | `@vollholz/iam` | – | AP-E7-8 |

Die Projektakte (`/projekte/<nr>/…`) besteht aus Reitern verschiedener Features: Der Rahmen (Kopf mit Status, Phase,
Reiter) gehört dem Feature `projekt`; der Router hängt die Reiter der anderen Features als Kinder ein (der Rahmen erhält
den Inhalt als Kind, er importiert keine Features).

## 2. Datenmodell

Gemeinsam für **alle** Tabellen (Muster `db/migrations/001_handlungsfeld.sql`, Regeln in `CLAUDE.md`):

- Schema `ppm`; `tenant_id uuid NOT NULL REFERENCES ppm.tenant (id) ON DELETE CASCADE` zuerst; Primärschlüssel
  `(tenant_id, id)` mit `id uuid DEFAULT gen_random_uuid()`; Fremdschlüssel immer zusammengesetzt `(tenant_id, x_id)`.
- Stammdaten und Kopfobjekte mit `version int` (ETag), `created_at/_by`, `updated_at/_by` (Trigger `*_touch`); wo die
  Spezifikation Nachvollziehbarkeit verlangt, Verlaufstabelle `*_version` nur anhängend (Trigger `*_history`).
- `SELECT app.secure_tenant_tables()`, Policies der Lesesicht nach [3.4](#34-policies-der-lesesicht), `GRANT` nur an
  `ppm_app` bzw. `ppm_sched`; jede Tabelle in `test/app/rls.test.ts`.
- Codewerte (Status, Trend, Grösse, Kategorie …) als `text` mit dem Schlüssel aus `stammdaten.codewert`; feste Zustände
  von Abläufen (Bearbeitungsstand) als `text` mit `CHECK`, weil das System ihr Verhalten kennt.
- Schlüssel in der Oberfläche (I-N5): Projekt `nummer` («2026-014»), Idee `nummer` (laufend), Sitzung `datum`, Periode
  `'YYYY-MM'`, Jahr `int`. Interne IDs erscheinen nie in Adressen.

Unten nur Schlüssel- und Steuerspalten; fachliche Felder ergeben sich aus Use Case und Kernablauf.

### 2.1 eingang

| Tabelle | Schlüssel und Steuerspalten | Bemerkung |
|---|---|---|
| `aufgabe` | `id`, `art` (z. B. `statusbericht.erstellen`), `bezug_typ`, `bezug_id`, `empfaenger_person` uuid NULL, `empfaenger_recht` text NULL, `ort_typ` (`org`/`portfolio`/`projekt`), `ort_id`, `titel`, `link`, `frist` date, `frist_art` (`kalendertage`/`arbeitstage`, UX-E11), `stand` (`offen`/`erledigt`/`entfallen`), `erledigt_von`, `erledigt_at`; eindeutig offen je (`art`, `bezug_id`, Empfänger) | genau eines von Person oder Recht |
| `mitteilung` | `id`, `empfaenger_person`, `bezug_typ`, `bezug_id`, `text`, `link`, `gelesen_at` | Benachrichtigungen; E-Mail nur mit Link (A-44) |
| `stellvertretung` | `id`, `vertretene_person`, `vertreter_person`, `von`, `bis`, `unterschriften` bool (UX-OF-10, A-31) | befristete Tupel, [4.3](#43-stellvertretung) |
| `neubesetzung`, `neubesetzung_rolle` | `id`, `person`, `stand` (`vorbereitet`/`entzogen`), `entzogen_at`; Rollen `ort_typ`, `ort_id`, `rolle` | Zugang entziehen (UC-016 A1, AP-E7-8); «besetzt» aus den Tupeln, nicht gespeichert |

### 2.2 stammdaten

| Tabelle | Schlüssel und Steuerspalten | Bemerkung |
|---|---|---|
| `org_einheit` | `id`, `parent_id`, `kuerzel` (eindeutig), `name`, `art` (`direktion`/`bereich`/…), `aktiv` | Direktionen mit Kürzeln (A-23); Hierarchie |
| `codewert` | `id`, `codetabelle` (`CHECK`: `projektstatus`, `trend`, `groesse`, `kategorie`, `abweichung`, `wertestrom`, `risikostufe`, `ressourcenrolle`, `idee_herkunft`; die Liste der Codetabellen ist fest im Code, keine eigene Tabelle), `schluessel`, `label`, `position`, `aktiv` (deaktivieren statt löschen, UC-017 Schritt 2) | Vorgabewerte je Organisation beim Anlegen |
| `feiertag` | `datum`, `label` | für Arbeitstage (A-43) |

### 2.3 phasenmodell

| Tabelle | Schlüssel und Steuerspalten | Bemerkung |
|---|---|---|
| `phasenmodell` | `id`, `nummer` int, `stand` (`entwurf`/`in_kraft`/`abgeloest`), `in_kraft_ab` | höchstens eine Version `in_kraft`; ADM setzt in Kraft (UC-017 Schritt 5) |
| `phase` | `phasenmodell_id`, `code` (`PRE_P0`, `P0`…`P4`), `name`, `position` | Pre-P0 = Ideen |
| `gate` | `phasenmodell_id`, `code` (`EINTRITT_P0`, `P0_P1`, `P1_P2`, `P2_P3`, `P3_P4`, `EXIT_P4`), `von_phase`, `nach_phase` | |
| `leitfrage` | `gate_id`, `wertestrom` (Codewert), `position`, `text` | je Gate fünf Werteströme |
| `standard_ergebnis` | `phase_id`, `art` (`lieferergebnis`/`meilenstein`), `text`, `position` | Vorschlag beim Planen (UC-002 Schritt 6) |
| `pflichtangabe` | `phase_id` bzw. `gate_id`, `kapitel`, `feld`, `text` | K13 offen, A-12 |
| `kapitel_wirkung` | `kapitel`, `dimension` (`scope`/`budget`/`ressourcen`) | UC-007 A1: Änderung an den PRAT |
| `frist` | `schluessel` (`bericht_aufgabe`, `bericht_stichtag`, `gate_vorbereiten`, `sitzung_vorbereiten`, `versand`, `protokoll`), `wert` int, `einheit` | A-26, A-27, Q8 Kap. 8.1 |
| `toleranz` | `dimension` (`termin`/`kosten`/`umfang`), `wert`, `einheit` | Standardwerte, Vertrag kann übersteuern (A-10) |

Neue Version gilt für ein Projekt ab seinem nächsten Gate (A-13): `projekt.phasenmodell_id` wird beim Gate-Entscheid
nachgeführt.

### 2.4 portfolio

| Tabelle | Schlüssel und Steuerspalten | Bemerkung |
|---|---|---|
| `portfolio` | `id`, `kategorie` (`A`/`B`/`C`), `schluessel` (`transformation`, `geschaeftsleitung`, Kürzel der Direktion), `name`, `org_einheit_id` (bei C), `pflichten` bool (A, B: true; C: false, A-07, A-08) | **Ort** im Rechtemodell; Tabelle entsteht in AP-E0-1 |
| `gremium` | `id`, `portfolio_id`, `kuerzel` (`prat`, `glpa`, `sns-vr`, Direktion), `name`, `art` (`entscheidend`/`extern`), `rhythmus` | extern = keine Benutzer (SNS-VR, UX-E8, A-02); ein entscheidendes Gremium je Portfolio (A-45) |
| `gremienweg` | `portfolio_id`, `gate_code`, `gremium_id`, `zusaetzlich_gremium_id` NULL | P0, P1 bis Freigabe P2: zusätzlich SNS-VR (Q8 Kap. 5.1) |
| `sitzungstermin` | `gremium_id`, `datum` | geplante Termine (UC-006 Vorbedingung); Sitzung entsteht daraus |

### 2.5 projekt

| Tabelle | Schlüssel und Steuerspalten | Bemerkung |
|---|---|---|
| `projekt` | `id`, `nummer` (eindeutig, «JJJJ-NNN», A-47), `name`, `portfolio_id`, `org_einheit_id` (federführend), `handlungsfeld_id`, `phase` (Code), `phasenmodell_id`, `lebenszyklus` (`aktiv`/`sistiert`/`abgebrochen`/`abgeschlossen`/`zurueckgezogen`), `vertraulich` bool (UX-OF-13, A-34), `herkunft` jsonb (Angaben aus Idee bzw. Übernahme), `version` | **Ort** (Blatt) im Rechtemodell; Tabelle entsteht in AP-E0-1 |
| `projekt_person` | `projekt_id`, `person_id`, `funktion` (`sp`/`pl`/`ctl`/`kt`/`koalition`), `akv` text | Projektorganisation (PP.04.04, Q7 Kap. 8); die Rollen (`sp`, `pl`, `ctl`, `kt`) setzt das Modul zusätzlich als Tupel am Projekt |
| `projekt_version` | Verlauf von `projekt` | Phase und Lebenszyklus nachvollziehbar |

Lebenszyklus: `aktiv` → `sistiert` ↔ `aktiv` (Wiederaufnahme per Gremiumsentscheid, A-09) · `aktiv` → `abgebrochen` |
`abgeschlossen` (Exit P4) | `zurueckgezogen` (UC-002 A4). Endzustände sind lesend (UC-015 Schritt 6).

### 2.6 projektdaten

Register je Projekt («aufdatiert»). Werte der Baseline stehen in der Baseline-Version des Vertrags; beim Gate- oder
Änderungsentscheid schreibt `vertrag` die geplanten Werte als neue Baseline-Spalten ins Register.

| Tabelle | Schlüssel und Steuerspalten | Bemerkung |
|---|---|---|
| `meilenstein` | `projekt_id`, `phase`, `art` (`meilenstein`/`lieferergebnis`/`kommunikation`), `text`, `termin_baseline`, `termin_aktuell`, `erreicht_am`, `abnahme` (`keine`/`gremium`) | PS.02.04, PS.05.03 («wie ein Meilenstein»), PS.02.03 |
| `kosten` | `projekt_id`, `phase`, `art` (`capex`/`opex`), `lieferant`, `offerte`, `budget_baseline`, `prognose`, `ist` | Beträge, eigene Policy ([3.4](#34-policies-der-lesesicht)) |
| `risiko` | `projekt_id` NULL, `portfolio_id` NULL (genau eines), `text`, `wahrscheinlichkeit`, `auswirkung` (hoch/mittel/tief), `massnahme`, `massnahme_stand`, `verantwortlich` | PC.02.04 bzw. PC.02.01 |
| `kpi` | `projekt_id`, `art` (`klinisch`/`nicht_klinisch`/`projekt`), `text`, `einheit`, `zielwert` | PC.03.01 |
| `kpi_wert` | `kpi_id`, `periode`, `wert` | PC.03.03, ab P2 |
| `stakeholder` | `projekt_id`, `gruppe`, `interesse`, `einfluss`, `massnahmen` | PS.05.01 |
| `abhaengigkeit` | `projekt_id`, `zu_projekt_id`, `text`, `ansprechperson` | beim anderen Projekt sichtbar (UC-002 Schritt 5) |
| `ressourcenbedarf` | `projekt_id`, `phase`, `rolle` (Codewert), `groesse` (S/M/L) NULL, `fte` NULL, `von_monat`, `bis_monat`, `gedeckt` | Grösse bis Gate P1–P2, danach FTE × Monate (UC-003 A1, A-20) |
| `meldung` | `projekt_id`, `stelle` (`dti`/`dbi`), `text`, `gemeldet_at` | RK.02.06, A-22 |

### 2.7 ziel

| Tabelle | Schlüssel und Steuerspalten | Bemerkung |
|---|---|---|
| `strategisches_ziel` | `id`, `handlungsfeld_id`, `nummer` («2.1»), `text`, `horizont` (2030, A-15), `metrik`, `zielwert`, `version` + `strategisches_ziel_version` | versioniert (UC-011 Schritt 2) |
| `zieljahr` | `jahr`, `stand` (`in_arbeit`/`zur_freigabe`/`in_kraft`), `freigabe_at`, `freigabe_text` | Jahresziele gemeinsam freigegeben (UX-E8) |
| `jahresziel` | `id`, `jahr`, `strategisches_ziel_id`, `nummer`, `text`, `metrik`, `zielwert` | ab `zur_freigabe` gesperrt |
| `hauptaktivitaet` | `id`, `jahresziel_id`, `text`, `verantwortlich` | |
| `ziel_projekt` | `projekt_id`, `strategisches_ziel_id`, `jahresziel_id` NULL | PP.02.05; aus Vertrag Kap. 2 |
| `zielerreichung` | `ziel_typ`, `ziel_id`, `quartal` («2026-Q3»), `stand`, `beurteilung`, `erfasst_at` | ZM.03.01 |
| `quartalsbericht` | `quartal`, `stand` (`in_arbeit`/`traktandiert`/`verabschiedet`), `inhalt` jsonb, `vr_rueckmeldung` | ZM.03.02 |
| `roadmap` | `jahr`, `publiziert_at`, `inhalt` jsonb (Stand bei Publikation) | PP.04.03 |

### 2.8 statusbericht

| Tabelle | Schlüssel und Steuerspalten | Bemerkung |
|---|---|---|
| `periode` | `periode` ('YYYY-MM'), `stand` (`offen`/`abgeschlossen`), `abgeschlossen_at/_by` | gesperrt nach Abschluss |
| `statusbericht` | `id`, `projekt_id`, `periode`, `stand` (`entwurf`/`eingereicht`/`zurueckgegeben`/`geprueft`), `status` (`im_plan`/`kritisch`), `trend`, `phase`, `abschluss_per`, `naechster_meilenstein`, `abweichung` jsonb (Inhalt, Termin, Ressourcen, Budget: keine/gering/wesentlich + Kommentar, A-38), `abhaengigkeiten`, `entscheide`, `begruendung`, `massnahme`, `entscheid_noetig`, `eingereicht_at`, `geprueft_at/_by`; eindeutig (`projekt_id`, `periode`) | UC-004; Einreichen 10 s rückgängig (UX-Rückfluss) |
| `rueckfrage` | `statusbericht_id`, `text`, `antwort`, `gestellt_by/_at`, `beantwortet_at` | UC-005 A2 |
| `einforderung` | `periode`, `projekt_id`, `anzahl`, `eingefordert_at/_by` | UC-005 A1: letzte Einforderung («eingefordert am»); die Erinnerung ist eine Aufgabe (AP-E1-2) |
| `dashboard_zeile` | `periode`, `projekt_id`, Werte der mittleren Projektzeile (darstellung.md), `gemeldet` bool, `status_vorperiode` | Stand bei Abschluss; «nicht gemeldet» = Vorperiode übernommen (A-11) |
| `eskalation` | `id`, `projekt_id`, `statusbericht_id`, `grund`, `stand` (`offen`/`traktandiert`/`erledigt`) | PS.03.03 |

Ein Bericht, der nach Abschluss der Periode eingeht, zählt für die nächste Periode (UX-OF-16, A-37).

### 2.9 sitzung

| Tabelle | Schlüssel und Steuerspalten | Bemerkung |
|---|---|---|
| `sitzung` | `id`, `gremium_id`, `datum`, `stand` (`geplant`/`in_vorbereitung`/`versendet`/`laufend`/`geschlossen`/`protokoll_versendet`), `versendet_at`, `geschlossen_at`, `protokoll_versendet_at` | K3; Fristen aus `phasenmodell.frist` |
| `traktandum` | `id`, `sitzung_id` NULL (Vorschlag ohne Sitzung), `art`, `bezug_typ`, `bezug_id`, `projekt_id` NULL, `position`, `dauer_min` (Gate 35), `stand` (`vorgeschlagen`/`traktandiert`/`verschoben`/`entschieden`), `via_sns` bool, `vertraulich` bool | Arten-Registry unten |
| `einladung` | `traktandum_id`, `person_id` | PL, CTL, SP je Geschäft; versandt mit den Unterlagen (UX-Rückfluss UC-006 2) |
| `unterlage` | `traktandum_id`, `art` (`packet`/`bericht`/`beilage`), `stand_ok` bool, `inhalt` jsonb bzw. Datei | Gate Review Packet aus dem Vertrag |
| `entscheid` | `traktandum_id`, `ergebnis` (`freigegeben`/`mit_auflagen`/`zurueckgestellt`/`abgelehnt`/`sistiert`/`abgebrochen`/`stellungnahme`), `begruendung`, `sns_ergebnis` NULL, `erfasst_at/_by`, `version` + `entscheid_version` | korrigierbar bis `geschlossen` (UX-OF-9, A-30) |
| `auflage` | `entscheid_id`, `text`, `verantwortlich`, `termin`, `stand` | als Aufgabe im Eingang (UC-006 A3) |
| `protokoll` | `sitzung_id`, `inhalt` jsonb, `stand` (`entwurf`/`versendet`) | aus Traktanden und Entscheiden erzeugt |

**Traktandenarten (Registry):** `sitzung` exportiert `registriereTraktandenart({ art, label, zusammenfassung(tx, bezug),
unterlagen(tx, bezug), ergebnisse: [...], beiEntscheid(tx, entscheid) })`. Module registrieren ihre Arten in ihrem
`index.ts` (Aufruf beim Laden des Moduls); `beiEntscheid` läuft in der Transaktion des Entscheids (Wirkung sofort,
UX-Rückfluss UC-006 7–8).

| Art | registriert | Folge bei Entscheid |
|---|---|---|
| `portfoliobericht` | `auswertung` | Kenntnisnahme |
| `gate` | `vertrag` | Baseline, Phase, Phasenmodell nachführen (UC-003 Schritt 10) |
| `aenderung` | `vertrag` | Baseline nachführen oder Entwurf verwerfen (UC-007 A1) |
| `meilenstein` | `statusbericht` | Meilenstein abgenommen über `projektdaten` (PS.02.03); `projektdaten` liegt unter `sitzung` und registriert selbst nichts |
| `eskalation` | `statusbericht` | Eskalation erledigt; ggf. Sistieren/Abbrechen über `projekt` |
| `idee` | `idee` | Initialisierung: Projekt in P0 anlegen (UC-001 Schritt 7) |
| `priorisierung` | `priorisierung` | Rangfolge und Szenario als Ist-Stand (UC-008 Schritt 8) |
| `quartalsreporting` | `ziel` | Bericht verabschiedet (UC-012 Schritt 5) |
| `abschluss` | `abschluss` | Projekt abgeschlossen, sistiert, abgebrochen (UC-015) |
| `jahresrueckblick` | `jahresrueckblick` | Erkenntnisse gespeichert (UC-013 Schritt 4) |

### 2.10 vertrag

| Tabelle | Schlüssel und Steuerspalten | Bemerkung |
|---|---|---|
| `vertrag_version` | `id`, `projekt_id`, `nummer` («2.0», «2.1»), `anlass` (`initial`/`gate`/`aenderung`), `zielphase`, `stand` (`in_arbeit`/`in_pruefung`/`zur_unterzeichnung`/`unterzeichnet`/`traktandiert`/`abgenommen`/`abgelehnt`/`verworfen`/`zurueckgezogen`), `baseline` bool, `baseline_at`, `basis_version_id`, `hauptaenderungen` jsonb, `andere` text, `begruendung` | höchstens ein Entwurf je Projekt (UX-E5, A-29), genau eine Baseline |
| `vertrag_kapitel` | `version_id`, `kapitel` (1–13, Q7), `inhalt` jsonb (Schema je Kapitel), `geaendert` bool | Kapitel sind die Daten; Listen (Meilensteine, Kosten, Risiken …) als Teil des Kapitels |
| `quality_check` | `version_id`, `ergebnis` (`bestaetigt`/`rueckmeldung`), `kommentare` jsonb je Kapitel, `at/_by` | DM.02.05 |
| `unterschrift` | `version_id`, `funktion` (`sp`/`pl`/`ctl`), `person_id`, `in_vertretung_von` NULL, `ergebnis` (`unterzeichnet`/`verweigert`), `begruendung`, `at` | Klick mit Protokoll (A-31) |
| `gate_antrag` | `version_id`, `gate_code`, `sitzung_id` NULL, `stand` | Leitfragen und Packet |
| `leitfrage_antwort` | `gate_antrag_id` bzw. `idee_id`, `leitfrage_id`, `antwort` | auch für Idee (Eintritt P0) im Modul `idee` gespiegelt |
| `nutzenpruefung` | `version_id`, `beurteilung`, Werte je KPI | UC-003 A2 |
| `beilage` | `version_id`, `name`, Datei | Vorstudie (UC-002 Schritt 4) |

Ablauf: `in_arbeit` → `in_pruefung` (Pflichtangaben erfüllt) → Rückmeldung: `in_arbeit` | bestätigt: `zur_unterzeichnung`
→ alle drei: `unterzeichnet` → `traktandiert` (Gate) → `abgenommen` (Baseline) | Auflagen: `in_arbeit` · Änderung:
`in_arbeit` → eingereicht beim SP → `abgenommen` | `abgelehnt` (Entwurf verworfen) | an den PRAT → `traktandiert`.

### 2.11 idee

| Tabelle | Schlüssel und Steuerspalten | Bemerkung |
|---|---|---|
| `idee` | `id`, `nummer`, `erfasst_von`, `vorgesehener_sponsor` NULL, `stand` (`entwurf`/`eingereicht`/`in_pruefung`/`in_ergaenzung`/`traktandiert`/`freigegeben`/`zurueckgestellt`/`zurueckgewiesen`/`zusammengefuehrt`), Felder nach Vorlage (Ausgangslage, Zielsetzung, `handlungsfeld_id`, `strategisches_ziel_id`, betroffene `org_einheit_id[]`, Nutzen, Aufwand, Relevanz, `herkunft`), `kategorie` NULL, `portfolio_id` NULL, `fuehrende_idee_id` NULL, `begruendung`, `projekt_id` NULL | UC-001 |
| `idee_rueckfrage` | `idee_id`, `text`, `antwort` | A2 |
| `idee_leitfrage` | `idee_id`, `leitfrage_id`, `antwort` | Eintritt P0 |
| `idee_raster` | `idee_id`, `kriterium`, `einschaetzung` (hoch/mittel/tief), `vorschlag_kategorie` | Tiering; die UE entscheidet (UX-Rückfluss UC-001 5) |

### 2.12 priorisierung, ressource

| Tabelle | Schlüssel und Steuerspalten | Bemerkung |
|---|---|---|
| `bewertungsmodell` | `id`, `nummer`, `stand` (`entwurf`/`in_kraft`), `in_kraft_at` | frühere Bewertungen bleiben nachvollziehbar (UC-008 A1) |
| `kriterium` | `bewertungsmodell_id`, `schluessel`, `text`, `dimension` (`nutzen`/`risiko`/–), `position` | Zuordnung für die Matrix fest und angezeigt (A-39) |
| `budgetrahmen` | `bewertungsmodell_id`, `portfolio_id`, `kategorie`, `betrag` | optional (A-18) |
| `bewertung` | `projekt_id`, `bewertungsmodell_id`, `kriterium`, `einschaetzung` (hoch/mittel/tief), `kommentar` | ohne Score (A-01) |
| `rangfolge` | `portfolio_id`, `projekt_id`, `rang`, `stand` (`entwurf`/`entschieden`) | |
| `szenario` | `id`, `portfolio_id`, `name`, `stand` (`entwurf`/`beantragt`/`entschieden`/`verworfen`) | Ist-Stand bleibt unverändert |
| `szenario_position` | `szenario_id`, `projekt_id`, `rang`, `start_monat`, `aktiv` | Wasserlinie gerechnet, nicht gespeichert |
| `kapazitaet` | `rolle`, `monat`, `fte` | Angebot je Rolle = Pool (A-20) |
| `zuteilung` | `ressourcenbedarf_id`, `person_id`, `monat`, `fte` | E7 (UC-009) |

### 2.13 abschluss, finanzen, jahresrueckblick, vorlage, schnittstelle

| Tabelle | Schlüssel und Steuerspalten | Bemerkung |
|---|---|---|
| `abschlussbericht` | `projekt_id`, `art` (`abschluss`/`sistierung`/`abbruch`), `stand` (`entwurf`/`eingereicht`/`traktandiert`/`abgenommen`/`nacharbeit`), Zielerreichung, Business Case P4, Übergabe, offene Punkte | UC-015 |
| `lessons_learned` | `projekt_id`, `text`, `kategorie`, `jahr` | auch UC-013 |
| `ist_kosten` | `projekt_id`, `kostentraeger`, `monat`, `art`, `betrag`, `lauf_id` | A-16 |
| `abweichung_begruendung` | `projekt_id`, `periode`, `text` | UC-010 Schritt 4 |
| `budgetuebergabe` | `jahr`, `stand`, `inhalt` jsonb, `uebergeben_at` | A-17 |
| `jahresrueckblick` | `jahr`, `stand`, `erkenntnisse`, `massnahmen` | |
| `vorlage` | `id`, `art` (Projektidee, Vorstudie, Business Case, Projektvertrag, Lösungskonzept, Abschlussbericht, Statusbericht, Portfoliobericht, Quartalsreporting), `version`, Datei, `zuordnung` jsonb | UC-018 Schritt 1–2 |
| `schnittstelle`, `schnittstelle_lauf` | `id`, `umsystem`, `richtung`, `rhythmus`, `aktiv` · `lauf`: `start`, `ende`, `umfang`, `fehler` | Netz-Adapter in `scripts/check-network.ts` |

### 2.14 Perioden und Fristen

| Zyklus | Takt | Fristen (Quelle) |
|---|---|---|
| Monatszyklus | Periode `YYYY-MM` | Aufgabe «Statusbericht erstellen» am 18. (A-26) · Stichtag 25. (Q8 Kap. 8.4) · überfällig ab 26. · UE prüft und schliesst bis Monatsende · Dashboard ab 1. für die Gremien |
| Sitzung | Termin je Gremium | «Gate vorbereiten» 30 Arbeitstage und «Sitzung vorbereiten» 15 Arbeitstage vorher (A-27) · Versand 5 Arbeitstage vorher (Q8) · Protokoll 3 Arbeitstage nachher (Q8: 2–3) |
| Quartal | `YYYY-Qn` | Quartalsreporting nach Abschluss des Quartals (UC-012); Termin offen |
| Jahr | `jahr` | Zielzyklus (UC-011), Jahresrückblick Q4 (UC-013), Budgetübergabe (UC-010) |

Arbeitstage: Montag bis Freitag ohne `stammdaten.feiertag` (A-43). Fristen kommen nie als Konstante in den Code, sondern
aus `phasenmodell.frist`.

## 3. Rechte und Orte

### 3.1 Stufe und Orte

Stufe «mittel» (identity-kit, Spezifikation 8.3): Kette **`org → portfolio → projekt`**. `projekt` ist der Blatt-Typ
(höchstens einer, M6). Gremien sind kein eigener Ort: Ein entscheidendes Gremium gehört zu genau einem Portfolio (A-45);
Rechte im Gremium sind Rollen am Portfolio.

```ts
types: {
  portfolio: { label: 'Portfolio', parent: 'org', roles: ['gremium', 'direktion'], read: 'projekt:read' },
  projekt: { label: 'Projekt', parent: 'portfolio', roles: ['pl', 'ctl', 'sp', 'kt'], leaf: true, read: 'projekt:read', write: 'projekt:write' },
}
```

`src/authz/resources.ts`: Kette über `projekt.portfolio_id` (`load`/`version` aus `ppm.projekt`), `exists` für beide Typen.
Keine Klassifizierung über `classified`: «vertraulich» ist eine Spalte mit eigener Policy (A-34).

### 3.2 Rechte

Schlüssel `<bereich>:<verb>`. «Ort» = Typen in `resources` (immer mit `org`).

| Gruppe | Recht | Ort | Wofür (BC) |
|---|---|---|---|
| handlungsfelder | `handlungsfeld:read`, `:write`, `:delete` (bestehen) | org | ZM.01.01 |
| ziele | `ziel:read` | org | Ziele, Roadmap lesen |
| ziele | `ziel:write` | org | ZM.01.02, ZM.02.01, ZM.02.03, ZM.02.04 |
| ziele | `ziel:freigabe` | org | ZM.02.02 erfassen, PP.04.03 publizieren |
| ziele | `zielerreichung:write` | org | ZM.03.01 |
| ziele | `quartalsbericht:write` | org | ZM.03.02 |
| stammdaten | `stammdaten:read`, `stammdaten:write` | org | AM.02.01, AM.02.02 |
| phasenmodell | `phasenmodell:read`, `phasenmodell:write`, `phasenmodell:activate` | org | AM.02.03 |
| portfolios | `portfolio:read`, `portfolio:admin` | org | AM.02.04 |
| projekte | `projekt:read` | org, portfolio, projekt | Projekt und Register lesen |
| projekte | `projekt:write` | org, projekt | Register pflegen (UC-002, UC-004) |
| projekte | `projekt:create` | org, portfolio | Projekt anlegen (Übernahme, Initialisierung) |
| projekte | `projekt:organisation` | org, projekt | PP.04.04 Projektorganisation festlegen |
| projekte | `projekt:vertraulich` | org, portfolio | vertrauliche Projekte sehen (A-34) |
| finanzen | `finanzen:read` | org, portfolio, projekt | Beträge sehen (UX-OF-12, A-33) |
| finanzen | `finanzen:write` | org | Ist-Kosten, Begründungen, Budgetübergabe (UC-010) |
| berichte | `statusbericht:write` | org, projekt | PS.01.01 |
| berichte | `statusbericht:review` | org, portfolio | PS.01.02, PS.01.03 |
| berichte | `periode:close` | org | UC-005 Schritt 5 |
| berichte | `kpi:write` | org, projekt | PC.03.03 (PL, CTL) |
| vertraege | `vertrag:write` | org, projekt | DM.02.01–03, PS.02.01, PS.02.05, PS.03.01 |
| vertraege | `vertrag:review` | org | DM.02.05 |
| vertraege | `vertrag:sign` | org, projekt | DM.02.06 Unterschrift (SP, PL, CTL) |
| vertraege | `vertrag:decide` | org, projekt | DM.02.04 zurückziehen, PS.03.02 Änderung entscheiden (SP) |
| gremien | `sitzung:read` | org, portfolio | Sitzung und Unterlagen ab Versand |
| gremien | `sitzung:write` | org, portfolio | UC-006 vorbereiten, Entscheide erfassen, Protokoll |
| ideen | `idee:create` | org | DM.01.01 (eigene) |
| ideen | `idee:read` | org, portfolio | Ideenpool |
| ideen | `idee:write` | org | DM.01.02–04 |
| ideen | `idee:decide` | org, portfolio | Initialisierung freigeben bei Kategorie C (UC-001 A4) |
| priorisierung | `priorisierung:read` | org, portfolio | Matrix, Szenarien sehen |
| priorisierung | `priorisierung:write` | org | UC-008 |
| ressourcen | `ressource:read`, `ressource:write` | org | UC-009, RK.02.04 |
| auswertungen | `auswertung:read` | org, portfolio | Dashboard, Risikolage, Portfoliobericht |
| auswertungen | `auswertung:write` | org | Portfoliobericht, Ad-hoc-Auswertungen |
| vorlagen | `vorlage:write` | org | AM.03.01 |
| schnittstellen | `schnittstelle:admin` (scope: false) | org | AM.03.02 |
| webhooks | `webhook:admin` (besteht) | org | AM.03.02 |
| reserviert | `tenant:read`, `tenant:admin`, `members:admin`, `access:admin`, `audit:read` | | Baukasten; `audit:read` für AM.03.03 |

### 3.3 Rollen

Rollen nach den Akteuren (Master §5), Rechte aus der Sichtbarkeitstabelle in
[informationsarchitektur.md](ux/informationsarchitektur.md#sichtbarkeit-je-rolle). Alle Rollen enthalten `tenant:read`,
`stammdaten:read`, `phasenmodell:read`, `portfolio:read`. `<bereich>:*` = alle Rechte des Bereichs aus 3.2.

| Rolle (Schlüssel) | Ort | Akteur | Rechte (zusätzlich zur Grundmenge) |
|---|---|---|---|
| `org-admin` | org | ADM | alle (Paket) |
| `ue` | org | UE (Programmleitung) | `projekt:*`, `finanzen:read`, `statusbericht:review`, `periode:close`, `vertrag:review`, `sitzung:*`, `idee:read/write`, `priorisierung:*`, `ressource:read`, `auswertung:*`, `ziel:read/freigabe`, `zielerreichung:write`, `quartalsbericht:write`, `phasenmodell:write`, `portfolio:admin`, `vorlage:write`, `audit:read`, `handlungsfeld:read` |
| `pmo` | org | PMO | wie `ue` (A-42) |
| `gl` | org | GL | `ziel:read/write`, `zielerreichung:write`, `handlungsfeld:*`, `projekt:read`, `auswertung:read`, `finanzen:read` (A-41), `sitzung:read` |
| `fi` | org | FI | `projekt:read`, `finanzen:read/write`, `auswertung:read/write` |
| `rm` | org | RM | `projekt:read`, `ressource:read/write`, `auswertung:read` |
| `antragsteller` | org (an «Alle Mitglieder», A-46) | AS | `idee:create` (eigene Ideen über Policy) |
| `leser` (besteht) | org | – | `handlungsfeld:read`, `ziel:read` |
| `gremium` | portfolio | PRAT-, GLPA-Mitglied | `projekt:read`, `projekt:vertraulich`, `finanzen:read`, `sitzung:read`, `idee:read`, `priorisierung:read`, `auswertung:read` |
| `direktion` | portfolio (Kategorie C) | DIR | `projekt:read`, `projekt:create`, `finanzen:read`, `idee:read`, `idee:decide`, `auswertung:read` |
| `sp` | projekt | SP | `projekt:read`, `projekt:organisation`, `finanzen:read`, `vertrag:sign`, `vertrag:decide` |
| `pl` | projekt | PL | `projekt:read/write`, `projekt:organisation`, `finanzen:read`, `statusbericht:write`, `kpi:write`, `vertrag:write`, `vertrag:sign` |
| `ctl` | projekt | CTL | `projekt:read`, `finanzen:read`, `kpi:write`, `vertrag:sign` |
| `kt` | projekt | KT | `projekt:read` (keine Beträge) |

- VR, SNS-VR, KOM, DTI/DBI sind keine Rollen (UX-E8, A-02, A-22).
- `ziel:read` für alle Rollen ausser `antragsteller` (IA: Ziele ○ lesend); die Roadmap lesen alle (A-35) über eine eigene
  Route mit `tenant:read`.
- Projektrollen setzt `projekt` beim Festlegen der Projektorganisation selbst als Tupel (`iam.tuples.grant`), geprüft mit
  `projekt:organisation`; die Regel «niemand gibt mehr, als er hat» gilt für `/v1/access`, nicht für diese Fachaktion.
- **Scopes:** `ppm:read` umfasst alle `*:read` ausser `finanzen:read`; `handlungsfeld:write` (besteht). Weitere schreibende
  Scopes erst, wenn ein Maschinen-Client sie braucht (z. B. ERP in AP-E7-4).
- **mcpTools:** nur lesend (`list_*`, `get_*`) je Modul mit dem Leserecht der Ressource; schreibende Werkzeuge nur nach
  Entscheid der Master-Session.

### 3.4 Policies der Lesesicht

Restriktiv, zusätzlich zu `tenant_isolation`; **jede** Tabelle aus Abschnitt 2 hat genau ein Muster (die Liste ist vollständig; neue Tabellen zuerst hier eintragen). Hilfsfunktionen legt AP-E0-1 an (SQL, `STABLE`, Rechte der aufrufenden Rolle,
**nicht** `SECURITY DEFINER`): `ppm.projekt_sichtbar(projekt_id uuid)` = `EXISTS (SELECT 1 FROM ppm.projekt …)` unter RLS,
`ppm.portfolio_von(projekt_id uuid)`.

| Muster | Lesen (`USING`) | Schreiben (`WITH CHECK`) | Tabellen |
|---|---|---|---|
| **ORG** | `app.has_permission('<bereich>:read')` | `app.has_permission('<bereich>:write')` | `org_einheit`, `codewert`, `feiertag`, `phasenmodell` + Kinder, `strategisches_ziel`, `zieljahr`, `jahresziel`, `hauptaktivitaet`, `zielerreichung`, `quartalsbericht`, `bewertungsmodell` und `kriterium` (Lesen auch mit `priorisierung:read` an einem Portfolio, `ppm.priorisierung_lesbar()`: das Gremium liest die Bewertung seines Portfolios nach dem Modell), `kapazitaet`, `vorlage`, `schnittstelle*`, `periode`, `budgetuebergabe`, `jahresrueckblick`, `roadmap` (Lesen nach Publikation mit `tenant:read`, A-35) |
| **PORTFOLIO** | `app.has_permission('<r>') OR app.has_permission('<r>', 'portfolio', portfolio_id)` | dasselbe mit dem Schreibrecht | `portfolio` (Lesen mit `portfolio:read`), `gremium`, `gremienweg`, `sitzungstermin`, `sitzung`, `traktandum` (über Sitzung), `rangfolge`, `szenario*`, `budgetrahmen`, `risiko` (Portfoliorisiko) |
| **PROJEKT** (Blatt) | `(app.read_all() OR portfolio_id = ANY (app.read_types()) OR app.has_tuple('projekt', id, app.read_relations())) AND (NOT vertraulich OR app.has_tuple('projekt', id, app.read_relations()) OR app.has_permission('projekt:vertraulich') OR app.has_permission('projekt:vertraulich', 'portfolio', portfolio_id))` | `app.write_all() OR portfolio_id = ANY (app.write_types()) OR app.has_tuple('projekt', id, app.write_relations())`; Anlegen: `app.has_permission('projekt:create') OR app.has_permission('projekt:create', 'portfolio', portfolio_id)` | `projekt` |
| **KIND** | `ppm.projekt_sichtbar(projekt_id)` | `app.has_permission('<recht>', 'projekt', projekt_id)` | `projekt_person`, `meilenstein`, `risiko` (Projektrisiko), `kpi`, `kpi_wert` (`kpi:write`), `stakeholder`, `abhaengigkeit`, `ressourcenbedarf`, `meldung`, `statusbericht` (`statusbericht:write`; Prüfung: `statusbericht:review`), `rueckfrage`, `einforderung` (`statusbericht:review`), `eskalation`, `vertrag_*`, `quality_check` (`vertrag:review`), `unterschrift` (`vertrag:sign`), `ziel_projekt`, `abschlussbericht`, `lessons_learned`, `bewertung` (`priorisierung:write`) |
| **BETRAG** | `ppm.projekt_sichtbar(projekt_id) AND (app.has_permission('finanzen:read', 'projekt', projekt_id) OR app.has_permission('finanzen:read', 'portfolio', ppm.portfolio_von(projekt_id)))` | KIND mit `projekt:write` bzw. `finanzen:write` | `kosten`, `ist_kosten`, `abweichung_begruendung` |
| **EIGEN** | `<person> = app.principal_id() OR <Recht wie oben>` | `<person> = app.principal_id()` | `idee` (`erfasst_von`, `vorgesehener_sponsor`; sonst `idee:read` an org/portfolio), `idee_rueckfrage`, `stellvertretung`, `mitteilung` |
| **AUFGABE** | `empfaenger_person = app.principal_id() OR (empfaenger_recht IS NOT NULL AND (CASE ort_typ WHEN 'org' THEN app.has_permission(empfaenger_recht) ELSE app.has_permission(empfaenger_recht, ort_typ, ort_id) END)) OR <Stellvertretung>` | nur das schreibende Modul über `eingang` | `aufgabe` |
| **STAND** | wie KIND bzw. PORTFOLIO | nur anhängen (kein UPDATE/DELETE für `ppm_app`) | alle `*_version` (auch `projekt_version`, `strategisches_ziel_version`), `entscheid_version`, `dashboard_zeile` |
| **ÜBER ELTERN** | `EXISTS` auf die Elternzeile (deren Policy wirkt mit) | Schreibrecht des Elternobjekts | Sitzung: `einladung`, `unterlage`, `entscheid`, `auflage`, `protokoll` (Eltern `traktandum`/`sitzung`, Schreiben `sitzung:write`); Vertrag: `vertrag_version`, `vertrag_kapitel`, `gate_antrag`, `leitfrage_antwort`, `nutzenpruefung`, `beilage` (Eltern Projekt, Schreiben `vertrag:write`); Idee: `idee_leitfrage`, `idee_raster` (Schreiben `idee:write`); Ressourcen: `zuteilung` (`ressource:write`) |

Sichtbarkeit innerhalb von Gremien: Unterlagen und Protokollentwurf vor dem Versand nur mit `sitzung:write`; Mitglieder
(`sitzung:read`) ab `versendet`; Eingeladene nur ihr Traktandum (Policy über `einladung.person_id = app.principal_id()`).
Begründungen von Zurückweisung, Ablehnung und Abbruch nur für Betroffene, UE und Gremium (darstellung.md, sensible Daten).

## 4. Aufgaben und Eingang

### 4.1 Entstehung

«Zu tun» ist eine **gespeicherte** Liste (`eingang.aufgabe`), keine Abfrage über alle Module: Das Modul, dem der Ablauf
gehört, öffnet und erledigt seine Aufgaben **in derselben Transaktion** wie die auslösende Änderung, über die
Schnittstelle von `eingang`:

```ts
import { aufgabe } from '../eingang/index.ts';
await aufgabe.oeffnen(tx, { art: 'statusbericht.pruefen', bezug: { typ: 'periode', id }, empfaenger: { recht: 'statusbericht:review' }, titel, link, frist });
await aufgabe.erledigen(tx, { art: 'statusbericht.pruefen', bezug: { typ: 'periode', id } });
```

- **Zeitgesteuerte** Aufgaben (Berichtsaufgabe am 18., «Gate vorbereiten», «Sitzung vorbereiten», Erinnerung bei
  Überfälligkeit) erzeugt ein täglicher Job (`JobDefinition` im `defineModule`) des besitzenden Moduls, idempotent über die
  Eindeutigkeit (`art`, `bezug_id`, Empfänger).
- **Empfänger:** eine Person (Unterzeichnen, Rückfrage, Auflage) oder ein Recht an einem Ort (Sammelaufgabe der UE, Quality-
  Check); Rollenwechsel wirken damit sofort.
- Mitteilungen (Information ohne Handlung, z. B. «Idee zurückgewiesen») über `mitteilung.senden(tx, …)`.
- **Kopf je Rolle:** Jedes Modul bietet `GET /v1/<modul>/kopf` mit den Kennzahlen für die angemeldete Person (nach
  Recht); das Feature `eingang` ruft die Kopfdaten der Module auf, für die die Person ein Recht hat.
- Zähler an «Eingang» (I-N3) = offene Aufgaben der Person (`GET /v1/eingang/anzahl`).

### 4.2 Aufgaben je Rolle

| Art | Empfänger | Öffnet | Frist | Erledigt durch | AP |
|---|---|---|---|---|---|
| `statusbericht.erstellen` | PL (Person aus Projektorganisation) | Job am 18. je aktivem Projekt in P0–P3 | 25. | Einreichen | AP-E1-1 |
| `statusbericht.rueckfrage` | PL | Rückfrage der UE | – | erneutes Einreichen | AP-E1-2 |
| `statusbericht.pruefen` | Recht `statusbericht:review` | erstes Einreichen der Periode (Sammelaufgabe, UX-Rückfluss UC-005) | Monatsende | Periode abgeschlossen | AP-E1-2 |
| `periode.abschliessen` | Recht `periode:close` | Job am 25. | Monatsende | Abschluss | AP-E1-2 |
| `vertrag.erstellen` | PL | Initialisierung freigegeben | – | Einreichen | AP-E4-3 (AP-E3-1 für übernommene Projekte) |
| `vertrag.quality_check` | Recht `vertrag:review` | Einreichen | – | Bestätigen / Rückmeldung | AP-E3-2 |
| `vertrag.unterzeichnen` | SP, PL, CTL je Person | Quality-Check bestätigt | – | Unterzeichnen / Verweigern | AP-E3-2 |
| `vertrag.ueberarbeiten` | PL | Rückmeldung, Verweigerung, Auflage | – | Einreichen | AP-E3-2, AP-E3-3 |
| `gate.vorbereiten` | PL | Job 30 Arbeitstage vor geplanter Gate-Sitzung | Unterlagen 5 Arbeitstage vor Sitzung | Einreichen | AP-E3-3 |
| `aenderung.entscheiden` | SP | Änderungsantrag eingereicht | – | Entscheid / Antrag an den PRAT | AP-E3-4 |
| `sitzung.vorbereiten` | Recht `sitzung:write` am Portfolio | Job 15 Arbeitstage vor Sitzung | Versand 5 Arbeitstage vorher | Versand | AP-E2-1 |
| `sitzung.lesen` | Mitglieder (`sitzung:read` am Portfolio) | Versand | Sitzung | Sitzung geschlossen | AP-E2-1 |
| `protokoll.versenden` | Recht `sitzung:write` | Sitzung geschlossen | 3 Arbeitstage | Versand | AP-E2-2 |
| `auflage.erfuellen` | verantwortliche Person | Entscheid mit Auflage | Termin der Auflage | Erledigt melden | AP-E2-2 |
| `idee.pruefen` | Recht `idee:write` | Einreichen | – | Traktandieren / Zurückweisen / Zusammenführen | AP-E4-2 |
| `idee.ergaenzen` | AS | Rückfrage | – | erneutes Einreichen | AP-E4-2 |
| `idee.freigeben` | Recht `idee:decide` am Portfolio C | Kategorie C (UC-001 A4) | – | Entscheid | AP-E4-3 |
| `eskalation.behandeln` | Recht `sitzung:write` | Bericht «kritisch» mit Entscheidbedarf | nächste Sitzung | Entscheid | AP-E2-4 |
| `jahresziele.vervollstaendigen` | Recht `ziel:write` | Zielzyklus geöffnet | Vorlage an den VR | Vorlage | AP-E6-1 |
| `zielerreichung.erfassen` | Recht `zielerreichung:write` | Job nach Quartalsende | – | erfasst | AP-E6-3 |
| `quartalsreporting.erstellen` | Recht `quartalsbericht:write` | Job nach Quartalsende | – | traktandiert | AP-E6-4 |
| `quartalsreporting.auftrag` | verantwortliche Person | Auftrag des VR erfasst (UC-012 Schritt 6) | Termin des Auftrags | Erledigt melden | AP-E6-4 |
| `abschluss.erstellen` | PL | Phase P4 erreicht bzw. Entscheid Sistieren/Abbrechen | – | Einreichen | AP-E7-1 |
| `lessons_learned.erfassen` | PL | UE fordert an (UC-013 A1) | – | erfasst | AP-E7-5 |
| `bedarf.decken`, `konflikt.aufloesen` | Recht `ressource:write` | Bedarf gemeldet / Überbuchung | – | Zuteilung | AP-E7-2 |
| `abweichung.klaeren`, `budget.uebergeben` | Recht `finanzen:write` | Prognose über Budget / Budgetzyklus | – | Begründung / Übergabe | AP-E7-4 |
| `schnittstelle.fehler` | Recht `schnittstelle:admin` | Lauf fehlgeschlagen | – | erfolgreicher Lauf | AP-E7-3 |
| `zugang.neu_besetzen` | Recht `members:admin` | Zugang entzogen mit Rollen an Orten oder offenen Aufgaben (UC-016 A1) | – | von Hand, sobald neu besetzt | AP-E7-8 |

### 4.3 Stellvertretung

Eine Person erfasst im Profil Vertretung und Zeitraum (UC-016 Schritt 4). Wirkung:

- Personen-Aufgaben der vertretenen Person erscheinen auch der Vertretung (Policy AUFGABE, Bedingung über
  `stellvertretung`).
- Damit die Vertretung handeln kann, setzt `eingang` für den Zeitraum befristete Tupel (`expires_at` = Ende) mit den
  Projekt- und Portfoliorollen der vertretenen Person; `vertrag:sign` nur, wenn `unterschriften` ausdrücklich erteilt ist
  (A-31).
- Entscheide, Unterschriften und Verlauf zeigen «‹Vertretung› in Vertretung von ‹Person›» (darstellung.md, Personen).

## 5. API-Schnitt

Muster der Handlungsfelder für **jede** Route ([routes.ts](../src/modules/handlungsfeld/routes.ts)): `req.need(<recht>,
ort)`, Lesesicht über `req.tx`, Fähigkeiten `can` in jeder Antwort, Cursor-Paginierung (`limit`, `cursor`, `nextCursor`),
`ETag`/`If-Match` (412) bei Änderungen, `Idempotency-Key` bei `POST`, Audit und Ereignis mit `record` in derselben
Transaktion, Fehler als `application/problem+json` (`HttpError`), genau ein Tag je Route. Übergänge im Ablauf sind eigene
`POST`-Routen auf der Ressource (`…/einreichen`), nicht `PATCH` auf `stand`.

Ereignisse und Audit-Aktionen: `<ressource>.<verb>` wie bestehend (`handlungsfeld.created`), Verben englisch in der
Vergangenheit (`statusbericht.submitted`, `vertrag.baselined`, `entscheid.recorded`).

| Modul | Ressourcen und Routen (Präfix `/v1`) | MCP (lesend) |
|---|---|---|
| `eingang` | `GET /eingang` (Aufgaben, Filter `frist`), `GET /eingang/anzahl`, `POST /eingang/aufgaben/:id/erledigen` (nur manuell erledigbare), `GET /mitteilungen`, `POST /mitteilungen/:id/gelesen`, `GET/POST/DELETE /stellvertretungen`; `GET /zugaenge/:person`, `POST /zugaenge/:person/entziehen`, `GET /neubesetzungen`, `GET /neubesetzungen/:id` (AP-E7-8) | `list_aufgaben` |
| `stammdaten` | `/org-einheiten` (CRUD), `/codetabellen`, `/codetabellen/:schluessel/werte` (CRUD, deaktivieren), `/feiertage` | `list_org_einheiten` |
| `phasenmodell` | `/phasenmodelle` (Liste, Entwurf anlegen aus aktueller Version), `/phasenmodelle/:id` (lesen mit Phasen, Gates, Leitfragen, Ergebnissen, Pflichtangaben, Fristen, Toleranzen; `PATCH` nur Entwurf), `POST /phasenmodelle/:id/in-kraft-setzen`, `GET /phasenmodelle/aktuell` | `get_phasenmodell` |
| `portfolio` | `/portfolios`, `/gremien`, `/gremien/:id/termine`, `/portfolios/:id/gremienweg` | `list_portfolios` |
| `projekt` | `/projekte` (Filter `rolle`, `portfolio`, `phase`, `nummer`, `q`), `/projekte/:id` (`PATCH`), `/projekte/:id/organisation` (`PUT`), `POST /projekte/uebernahme` (Datei, Prüflauf ohne Speichern, A-14), `GET /projekte/kopf` | `list_projekte`, `get_projekt` |
| `projektdaten` | `/projekte/:id/meilensteine`, `/kosten`, `/risiken`, `/kpis`, `/kpis/:kpiId/werte`, `/stakeholder`, `/abhaengigkeiten`, `/ressourcenbedarf`, `/meldungen`; `/portfolios/:id/risiken` | `get_projektdaten` |
| `statusbericht` | `/projekte/:id/berichte/:periode` (`GET` mit Vorbelegung, `PUT` Entwurf), `POST …/einreichen`, `POST …/zurueckziehen` (10 s), `POST …/pruefen`, `POST …/pruefung-zuruecknehmen` (Rückgängig), `GET/POST …/rueckfragen`; `/perioden/:periode` (Übersicht je Portfolio, Filter `stand`, `sort=auffaellig`), `POST /perioden/:periode/bestaetigen` (Sammelbestätigung, A-28), `POST /perioden/:periode/einfordern`, `POST /perioden/:periode/abschliessen`, `GET /perioden/:periode/terminabweichungen`, `GET /statusberichte/kopf` | `list_statusberichte`, `get_periode` |
| `auswertung` | `GET /dashboard?portfolio&periode&ansicht=liste|funnel`, `GET /dashboard/risiken`, `/portfolioberichte` (erzeugen, lesen, PDF), `GET /auswertungen?filter…` (Export CSV) | `get_dashboard` |
| `sitzung` | `/gremien/:kuerzel/sitzungen`, `/sitzungen/:id` (Traktandenliste), `GET /sitzungen/:id/vorschlaege`, `/sitzungen/:id/traktanden` (anlegen aus Vorschlag, ordnen, verschieben), `POST /sitzungen/:id/versenden`, `PUT /traktanden/:id/entscheid`, `/entscheide/:id/auflagen`, `POST /sitzungen/:id/schliessen`, `/sitzungen/:id/protokoll` (`PUT`, PDF), `POST …/protokoll/versenden`, `GET /entscheide` (Filter Projekt, Gremium) | `list_sitzungen`, `get_sitzung`, `list_entscheide` |
| `vertrag` | `/projekte/:id/vertrag` (Versionen), `POST …/entwuerfe` (Anlass `initial`/`gate`/`aenderung`), `/vertragsversionen/:id/kapitel/:nr` (`PUT`), `GET …/pflichtangaben`, `POST …/einreichen`, `POST …/quality-check`, `POST …/unterschriften`, `POST …/zurueckziehen`, `/vertragsversionen/:id/gate` (Leitfragen), `GET …/vergleich?mit=`, `GET …/hauptaenderungen`, `POST …/aenderung/entscheiden`, `GET …/dokument?format=docx|pdf`, `/vertragsversionen/:id/beilagen` | `get_vertrag`, `compare_vertrag` |
| `idee` | `/ideen` (Filter `stand`, `eigene`), `/ideen/:id`, `POST …/einreichen`, `…/rueckfragen`, `PUT …/leitfragen`, `PUT …/raster`, `POST …/kategorie`, `POST …/zusammenfuehren`, `POST …/zurueckweisen`, `POST …/traktandieren`, `GET …/aehnliche` (nur `idee:write`, A-32), `GET /ideen/kopf` | `list_ideen`, `get_idee` |
| `priorisierung` | `/bewertungsmodelle` (Entwurf, in Kraft), `/portfolios/:id/bewertungen` (Raster `PUT`), `/portfolios/:id/matrix`, `/portfolios/:id/rangfolge`, `/szenarien` (+ `/positionen`), `GET /szenarien/vergleich?ids=`, `POST /szenarien/:id/beantragen` | `get_matrix`, `compare_szenarien` |
| `ressource` | `/kapazitaet`, `/auslastung?von&bis&szenario`, `/bedarfe`, `/bedarfe/:id/zuteilungen` | `get_auslastung` |
| `ziel` | `/strategische-ziele` (+ Verlauf), `/ziele/:jahr` (Zielzyklus), `/jahresziele`, `/hauptaktivitaeten`, `POST /ziele/:jahr/vorlegen`, `POST /ziele/:jahr/freigabe`, `/projekte/:id/ziele`, `/zielerreichung/:quartal`, `/quartalsberichte/:quartal` (erzeugen, `POST …/traktandieren`), `/roadmap/:jahr` (`POST` publizieren, `GET` alle) | `list_ziele`, `get_roadmap` |
| `abschluss` | `/projekte/:id/abschluss` (`PUT`, `POST …/einreichen`), `POST /projekte/:id/wiederaufnahme`, `/lessons-learned` | `list_lessons_learned` |
| `finanzen` | `/finanzen?portfolio`, `/finanzen/abweichungen`, `/projekte/:id/abweichungsbegruendungen`, `/budgetuebergaben/:jahr` (`POST` Export) | `get_finanzen` |
| `jahresrueckblick` | `/jahresrueckblicke/:jahr` (`GET` erzeugt Auswertung, `PUT` Erkenntnisse, `POST …/traktandieren`) | – |
| `vorlage` | `/vorlagen` (Versionen hochladen, Zuordnung prüfen) | – |
| `schnittstelle` | `/schnittstellen` (+ `/laeufe`, `POST …/starten`), `GET /aenderungsprotokoll` (Audit, Filter Objekt, Zeitraum) | – |

Nach jeder Route: `npm run openapi:export && npm run api:types`; jede Route mit Fall in `test/app/tenant-isolation.test.ts`.

## 6. Regeln und Konfiguration (UC-017)

| Stammdaten (UC-017) | Pflegt | Tabelle | Wer nutzt es |
|---|---|---|---|
| Organisationseinheiten mit Direktionen (Schritt 1) | ADM | `stammdaten.org_einheit` | Projekt (federführend), Idee (betroffene Bereiche), Portfolio C (Direktion), Personen |
| Codetabellen (Schritt 2): Projektstatus, Trend, Grösse S/M/L, Kategorie A/B/C, Abweichungsskala, Werteströme, Risikostufen, Rollen des Ressourcenbedarfs, Herkunft der Idee | ADM | `stammdaten.codewert` | Statusbericht, Dashboard, Register, Idee, Priorisierung, Ressourcen |
| Feiertage | ADM | `stammdaten.feiertag` | alle Fristen in Arbeitstagen |
| Phasen P0–P4, Gates, Leitfragen je Wertestrom (Schritt 3) | UE, in Kraft durch ADM | `phasenmodell.*` | Idee (Eintritt P0), Vertrag (Gate-Modus), Sitzung (Packet), Dashboard (Funnel) |
| Standard-Lieferergebnisse und -Meilensteine je Phase | UE | `standard_ergebnis` | Vertrag (Vorschlag beim Planen), Register |
| Pflichtangaben des Vertrags je Phase (K13) | UE | `pflichtangabe` | Vertrag (Einreichen gesperrt, K2-4) |
| Kapitel mit Wirkung auf Scope, Budget, Ressourcen | UE | `kapitel_wirkung` | Änderungsantrag (UC-007 A1) |
| Fristen, Toleranzen | UE | `frist`, `toleranz` | Eingang (Jobs), Statusbericht (Warnung), Sitzung (Versand, Protokoll) |
| Portfolios A/B/C mit Pflichten (Schritt 4, A1) | UE | `portfolio.portfolio` | Rechte (Ort), Dashboard, Idee (Kategorie → Portfolio), Pflicht-Reporting nur bei `pflichten` |
| Gremien, Gremienweg je Gate, Sitzungstermine | UE | `gremium`, `gremienweg`, `sitzungstermin` | Sitzung (Traktandierung, «via SNS-VR»), Gate (zuständiges Gremium), Eingang (Fristen) |
| Vorlagen (UC-018) | UE | `vorlage` | Dokumentausgabe (Vertrag, Berichte) |

Beim Anlegen einer Organisation lädt eine Vorgabe (Aktion «Vorgabe des PM-Handbuchs laden» in Administration) Phasen,
Gates, Werteströme, Codewerte und Fristen nach Q6 F6, Q8 Kap. 7–9; Leitfragen-Texte übernimmt die UE aus dem PM-Handbuch.

## 7. Arbeitspakete

### 7.1 Regeln für alle Pakete

- **Besitz:** Ein Paket ändert nur die Dateien und Ordner in seiner Spalte «Besitz» und die gemeinsamen Dateien nach 7.2.
  Kleine Korrekturen ausserhalb gehören in den Schlussbericht als Folgearbeit.
- **Migrationen:** nur Nummern aus dem eigenen Bereich (001–002 belegt). Bereiche sind in Abhängigkeitsfolge vergeben: Eine
  Migration darf nur Tabellen aus Bereichen mit **kleinerer** Nummer voraussetzen (frische Datenbanken laufen nach Nummer).
- **Start und Merge:** «Start» = ab wann das Paket beginnen kann; «Merge nach» = was vorher in `main` sein muss. Wer
  früher startet, programmiert gegen die Schnittstellen in diesem Dokument.
  «Merge nach» ist erfüllt, sobald der PR **gegen das aktuelle `main` grün** ist und keine Schnittstelle eines noch nicht
  gemergten Pakets nachbildet (Platzhalter, eigene Kopie): Dann sofort mergen, nicht auf die Reihenfolge warten; jeder
  wartende grüne PR kostet bei den anderen einen Konflikt.
- **Grösse:** ein PR, höchstens zwei (PR 1 Tabellen und API, PR 2 Oberfläche); jeder PR für sich grün und mergebar.
- **Abnahme:** UX-Definition of Done ([pruefung.md](ux/rahmen/pruefung.md)) als Checkliste im PR; Zielgrössen des Kernablaufs
  als automatischer Test, wo die Spalte «Abnahme» «Test» nennt, sonst im Schlussbericht als «beim Aufgabentest zu messen».
- **Stand nachführen:** [umsetzungsstand.md](umsetzungsstand.md), Klärungsliste und Annahmen führt nur die Master-Session,
  übergreifend in eigenen Doku-PRs (keine Konflikte zwischen den Paketen). Ein Paket meldet mit jedem Merge einen Block
  «STAND:» mit seinen Zeilen (Paket, BC, Zielgrössen, UX-DoD, PR-Nummer, verwendete Annahmen).

### 7.2 Gemeinsame Dateien

| Datei | Regel |
|---|---|
| `src/app.ts` | je Modul genau eine Import-Zeile (alphabetisch) und **eine Zeile** in `modules` an der Stelle der Reihenfolge aus 1.1; eine Zeile je Recht in `people.permissions` (alphabetisch); Konflikt = beide Zeilen behalten |
| `test/app/mcp.test.ts` | eine Zeile je Werkzeug in der erwarteten Liste, alphabetisch |
| `src/authz/model.ts`, `src/authz/resources.ts` | **AP-E0-1 setzt das vollständige Modell aus Abschnitt 3** (alle Rechte, Rollen, Typen, Scopes). Spätere Pakete ändern daran nur `mcpTools` (eine Zeile je Werkzeug, Block je Modul mit Kommentar `// <modul>`) und `capabilities`; fehlt ein Recht, zuerst dieses Dokument ändern. Danach immer `npm run identity:platform-json` |
| `web/src/auth/permissions.ts` | AP-E0-1 trägt alle Rechte aus 3.2 ein; sonst unverändert |
| `web/src/router.tsx`, `web/src/search.ts` | AP-E0-0 teilt die Routen nach Arbeitsraum auf (`web/src/routes/<arbeitsraum>.tsx`, Vorschlag); ein Paket fügt je Seite eine Route in der Datei seines Arbeitsraums und einen Eintrag in `search.ts` hinzu |
| Navigation (`web/src/app.tsx`, `web/src/shell/`) | gehört AP-E0-0: alle sechs Arbeitsräume und ihre Bereiche stehen zentral mit dem Recht, das sie sichtbar macht (IA, Sichtbarkeit je Rolle); ein Paket schaltet seinen Bereich frei, indem es die Route anlegt (Bereich ohne Route = nicht angezeigt). Shell nicht in Fachpaketen ändern |
| `web/src/ui/` | gehört AP-E0-0; neue gemeinsame Bausteine nur über die Master-Session, sonst im Feature |
| Texte | je Feature eine eigene Textdatei (Namensraum = Feature) nach dem Muster, das AP-E0-0 festlegt |
| `test/app/rls.test.ts`, `test/app/tenant-isolation.test.ts` | AP-E0-1 teilt Matrix und Fälle in Dateien je Modul (`test/app/matrix/<modul>.ts`) mit einer Import-Zeile je Modul; danach ändert jedes Paket nur seine Datei und eine Zeile |
| Erzeugte Dateien (`web/openapi.json`, `web/src/api/schema.d.ts`, `infra/keycloak/platform.json`, `.env.example`, `docs/konfiguration.md`) | nie von Hand auflösen: nach dem Merge von `main` neu erzeugen |
| `docs/umsetzungsstand.md`, Klärungsliste, Annahmen (Abschnitt 8) | nur die Master-Session; Pakete ändern sie nicht (Konflikt = Fassung von `main`) |
| `src/modules/<x>/index.ts`, `web/src/features/<x>/index.ts` bei Erweiterungspaketen | Ein Paket, das Dateien in einem Modul oder Feature eines anderen Pakets besitzt (z. B. AP-E2-2 in `sitzung`, AP-E3-2–E3-5 in `vertrag`), legt eigene Dateien an (`routes-<teil>.ts`, `schemas-<teil>.ts`, `mcp-<teil>.ts`, Seiten) und ändert in `index.ts` des Moduls bzw. Features je Datei **eine** Zeile (Import und Aufruf in `register`, Werkzeuge, Export); `routes.ts`, `store.ts` und `schemas.ts` des Grundpakets bleiben unberührt, gemeinsame Abfragen kommen in eine eigene `store-<teil>.ts`. Das Grundpaket legt `register` so an, dass weitere Routendateien je eine Zeile brauchen |

### 7.3 Pakete

**E0 Fundament** (Abnahme Etappe: Q-L1, Q-L6, Q-B1–B6 auf allen Bausteinen; G1-Prüfung des Eingangs je Rolle)

| AP | Inhalt (BC/UC) | Modul(e) · Feature(s) | Besitz | Migr. | Start · Merge nach | Abnahme |
|---|---|---|---|---|---|---|
| **AP-E0-0** | Navigation nach Arbeitsräumen und Recht, Startseite-Gerüst, Befehlspalette, Kontomenü, Bausteine aus darstellung.md (Projektzeile klein/mittel/gross, Status und Trend, Bearbeitungsstand, Formate de-CH, Frist, Regelmeldung), Texte zentral (UX-E2, UX-E3, I-N1–N4) — **Session S2, `feat/webapp-fundament-navigation`** | – · `shell`, `ui` | `web/src/shell/`, `web/src/ui/`, `web/src/styles/`, `web/src/app.tsx`, `web/src/router.tsx` (Aufteilung), `web/src/routes/` | – | läuft · – | Q-L1, Q-L6, Q-B1–B6 je Baustein; Navigation je Rolle nach IA-Tabelle |
| **AP-E0-1** | Rechte Stufe «mittel» vollständig (Abschnitt 3), Orte Portfolio und Projekt (Tabellen `portfolio` und `projekt` als Kern; übrige Spalten und Tabellen ergänzen AP-E0-4 und AP-E0-5), Hilfsfunktionen der Lesesicht, Aufteilung der RLS-/Isolationsmatrix je Modul. PR 1 ohne Routen, **zuerst und schnell** | `portfolio`, `projekt` (nur Migration, keine Routen) | `src/authz/`, `web/src/auth/permissions.ts`, `infra/keycloak/platform.json` (erzeugt), `db/migrations/010–019`, `test/app/matrix/`, `test/app/rls.test.ts`, `test/app/tenant-isolation.test.ts` | 010–019 | sofort · – | `npm run check`; Konformitätstest; Test «Lesesicht = `can`» für Projekt (Rolle an Portfolio, an Projekt, vertraulich) |
| **AP-E0-2** | Organisationseinheiten, Codetabellen mit Vorgabewerten, Feiertage (AM.02.01, AM.02.02; UC-017 Schritte 1–2) | `stammdaten` · `stammdaten` | `src/modules/stammdaten/`, `web/src/features/stammdaten/` | 020–029 | sofort · AP-E0-1 | UI-44, UI-45 Liste + Schublade; UX-DoD |
| **AP-E0-3** | Phasenmodell versioniert mit Gates, Leitfragen je Wertestrom, Standard-Ergebnissen, Pflichtangaben, Kapitelwirkung, Fristen, Toleranzen; Vorgabe PM-Handbuch; in Kraft setzen (AM.02.03; UC-017 Schritte 3, 5) | `phasenmodell` · `phasenmodell` | `src/modules/phasenmodell/`, `web/src/features/phasenmodell/` | 030–039 | sofort · AP-E0-1 | UI-46 Arbeitsfläche; Arbeitstage-Rechnung mit Feiertagen getestet; UX-DoD |
| **AP-E0-4** | Projekt: Routen, Nummer, Lebenszyklus, Projektorganisation mit Tupeln, Meine Projekte, Projektübersicht, Rahmen der Projektakte (PP.04.04; UC-002 Schritt 2, UC-014 A1, UC-016 Schritt 2) | `projekt` · `projekt` | `src/modules/projekt/`, `web/src/features/projekt/` | 040–049 | nach AP-E0-1 PR 1 · AP-E0-1, AP-E0-2, AP-E0-3 | UI-05, UI-06; Projektrolle wirkt nur im eigenen Projekt (Test); UX-DoD |
| **AP-E0-5** | Portfolios und Gremien: Pflichten je Kategorie, Gremienweg je Gate, Sitzungstermine, Administration (AM.02.04; UC-017 Schritt 4, A1) | `portfolio` · `portfolios` | `src/modules/portfolio/`, `web/src/features/portfolios/` | 050–059 | nach AP-E0-1 PR 1 · AP-E0-3 | UI-47; «via SNS-VR» aus dem Gremienweg ableitbar (Test); UX-DoD |
| **AP-E0-6** | Register Projektdaten: Meilensteine, Kosten, Risiken, KPIs, Stakeholder, Kommunikation, Abhängigkeiten, Ressourcenbedarf, Meldung ICT/Infrastruktur; API ohne eigene Seiten (Lesend in der Projektübersicht) | `projektdaten` | `src/modules/projektdaten/` | 060–069 | nach AP-E0-1 PR 1 · AP-E0-4 | Beträge nur für Rollen mit `finanzen:read` (RLS-Test, A-33); Abhängigkeit beidseitig sichtbar |
| **AP-E0-8** | Eingang: Aufgaben, Mitteilungen, Stellvertretung mit befristeten Tupeln; Startseite mit «Zu tun» und Kopfkarten; Profil mit Stellvertretung (AM.01.03; UC-016 Schritt 4; UX-E3) | `eingang` · `eingang`, `konto` | `src/modules/eingang/`, `web/src/features/eingang/`, `web/src/features/konto/` | 070–079 | sofort · AP-E0-1, AP-E0-0 | G1-Prüfung je Rolle; Aufgabe einer Person sieht die Vertretung (Test); UX-DoD |
| **AP-E0-9** | Strategische Ziele als Stammdaten, versioniert, je Handlungsfeld (ZM.01.02; UC-011 Schritt 2) | `ziel` · `ziele` | `src/modules/ziel/`, `web/src/features/ziele/` | 080–089 | sofort · AP-E0-1 | Verlauf nachvollziehbar; UX-DoD |
| **AP-E0-7** | Übernahme der laufenden Projekte aus dem Excel-Dashboard: Stammdaten, Phase, Status, Trend, nächster Meilenstein, Verantwortliche, Prüflauf vor dem Speichern (K16, A-14) | `projekt` (Datei `uebernahme.ts`) | `src/modules/projekt/uebernahme*.ts`, `scripts/uebernahme/` | 120–129 | nach AP-E0-4 · AP-E0-6, AP-E1-1 | Prüflauf meldet Fehler je Zeile; Status und Trend als Vorperiode des ersten Berichts |

**E1 Monatsbericht** ([K1](ux/ablaeufe/K1-statusbericht.md); Abnahme K1-1 bis K1-5, PPM-1, PPM-3)

| AP | Inhalt (BC/UC) | Modul(e) · Feature(s) | Besitz | Migr. | Start · Merge nach | Abnahme |
|---|---|---|---|---|---|---|
| **AP-E1-1** | Statusbericht erfassen mit Vorbelegung, Meilensteine, Prognose, Risiken, KPI-Werte, Kommunikation in einem Durchgang; «kritisch» mit Begründung und Massnahme; Einreichen mit 10 s Rückgängig; Berichtsaufgabe am 18. (PS.01.01, PS.02.04, PC.01.03, PC.02.03–04, PC.03.03, PS.05.03; UC-004) | `statusbericht` · `bericht` | `src/modules/statusbericht/` (ausser `pruefung*`, `abschluss*`, `eskalation*`), `web/src/features/bericht/` | 090–099 | nach AP-E0-1 PR 1 · AP-E0-3, AP-E0-6, AP-E0-8 | K1-1 (≤ 5 Min., ≤ 15 Interaktionen; Interaktionen als E2E-Test gezählt), Tastatur-E2E, UX-DoD |
| **AP-E1-2** | Monatsabschluss: Posteingang der Periode, Auffälligkeiten, Sammelbestätigung, Rückfrage, Einfordern, Abschluss mit «nicht gemeldet», Terminabweichungen (PS.01.02–04; UC-005) | `statusbericht` (Dateien `pruefung*`, `abschluss*`) · `monatsabschluss` | diese Dateien, `web/src/features/monatsabschluss/` | 100–109 | nach AP-E1-1 PR 1 · AP-E1-1 | K1-3, K1-4 (5 Auffälligkeiten in 30 Berichten als Testdaten), K1-5; UX-DoD |
| **AP-E1-3** | Dashboard der Periode: Liste und Funnel nach Phase, je Portfolio, Badges «nicht gemeldet», «Eskalation» (PC.04.01; UC-014 Schritt 1) | `auswertung` · `dashboard` | `src/modules/auswertung/`, `web/src/features/dashboard/` | 110–119 | nach AP-E1-2 PR 1 · AP-E1-2 | Q-L5 (1000 Zeilen), Sichtbarkeit je Rolle (Test); UX-DoD |

**E2 Gremium** ([K3](ux/ablaeufe/K3-gremiumssitzung.md); Abnahme K3-1 bis K3-5, PPM-5)

| AP | Inhalt (BC/UC) | Modul(e) · Feature(s) | Besitz | Migr. | Start · Merge nach | Abnahme |
|---|---|---|---|---|---|---|
| **AP-E2-1** | Sitzung, Traktandenvorschläge, Arten-Registry, Einladungen, Unterlagen-Stand, Versand 5 Arbeitstage vorher, Aufgaben «Sitzung vorbereiten» (PP.04.01, PP.04.05; UC-006 Schritte 1–5, A1, A2) | `sitzung` · `sitzung` | `src/modules/sitzung/` (ausser `entscheid*`, `protokoll*`), `web/src/features/sitzung/` (ausser `Sitzungsmodus*`, `Protokoll*`, `Entscheide*`) | 130–139 | nach AP-E0-5 · AP-E0-4, AP-E0-5, AP-E0-8 | K3-1, K3-2; UX-DoD |
| **AP-E2-2** | Sitzungsmodus, Entscheid je Traktandum mit Folgen über die Registry, Auflagen als Aufgaben, Korrektur bis Schliessen, Protokoll erzeugen und versenden, Entscheide und Auflagen (PP.04.02, PS.02.02; UC-006 Schritte 6–9, A3, A4) | `sitzung` (Dateien `entscheid*`, `protokoll*`) · `sitzung` (Dateien `Sitzungsmodus*`, `Protokoll*`, `Entscheide*`) | diese Dateien | 140–149 | nach AP-E2-1 PR 1 · AP-E2-1 | K3-3 (≤ 60 s, Messung im E2E), K3-4, K3-5 auf Tablet-Breite; UX-DoD |
| **AP-E2-3** | Portfoliobericht aus dem Dashboard (PDF), Risikolage aus Projekt- und Portfoliorisiken, Art `portfoliobericht` (PC.04.02, PC.02.02; UC-014 Schritte 2–3) | `auswertung` (Dateien `bericht*`, `risiko*`) · `dashboard` (Dateien `Risiken*`, `Portfoliobericht*`) | diese Dateien | 150–159 | nach AP-E1-3 · AP-E1-3, AP-E2-1 | PPM-4 (0 Dateien von Hand); UX-DoD |
| **AP-E2-4** | Eskalation aus «kritisch» mit Entscheidbedarf und Meilensteinabnahme als Traktanden (PS.03.03, PS.02.03; UC-004 A2, UC-006 Schritt 7) | `statusbericht` (`eskalation*`, `abnahme*`) | diese Dateien | 160–169 | nach AP-E2-1 PR 1 · AP-E1-1, AP-E2-2 | Folge des Entscheids sichtbar vor Schliessen der Sitzung (Test) |

**E3 Projektvertrag und Gate** ([K2](ux/ablaeufe/K2-projektvertrag.md); Abnahme K2-1 bis K2-5, PPM-2, PPM-4)

| AP | Inhalt (BC/UC) | Modul(e) · Feature(s) | Besitz | Migr. | Start · Merge nach | Abnahme |
|---|---|---|---|---|---|---|
| **AP-E3-1** | Projektakte: Versionen, Kapitel 1–13 mit Schemas, Entwurf (initial), Pflichtangaben je Phase, Einreichen, Verknüpfung mit Zielen, Register-Übernahme bei Baseline (DM.02.01–03, PP.02.05, PC.01.01, PC.02.04, PC.03.01, PC.03.04, PS.02.04, PS.05.01–02, RK.02.01, RK.02.06; UC-002 Schritte 1–8) | `vertrag` · `vertrag` | `src/modules/vertrag/` (ausser `pruefung*`, `gate*`, `aenderung*`, `vergleich*`, `dokument*`), `web/src/features/vertrag/` (entsprechend) | 170–179 | nach AP-E0-6 · AP-E0-3, AP-E0-6, AP-E0-8, AP-E0-9 | K2-4 (jede fehlende Angabe mit 1 Klick, automatischer Test); UX-DoD |
| **AP-E3-2** | Quality-Check mit Kommentar je Kapitel, Unterzeichnen auf dem Telefon, Verweigern mit Begründung, Stellvertretung (DM.02.05, DM.02.06; UC-002 Schritte 9–10, A5; UC-003 Schritte 7–8, A4, A5) | `vertrag` (`pruefung*`) · `vertrag` (`Pruefen*`, `Unterzeichnen*`) | diese Dateien | 180–189 | nach AP-E3-1 PR 1 · AP-E3-1 | K2-1 (≤ 60 s, ≤ 3 Interaktionen bei 360 px, E2E), K2-2, K2-3 als Betriebskennzahl; UX-DoD |
| **AP-E3-3** | Gate-Modus: Entwurf für Phase n, Leitfragen je Wertestrom, Standard-Lieferergebnisse, Gate Review Packet, Art `gate` mit Baseline und Phasenwechsel, Gremienweg und SNS-VR, Aufgabe «Gate vorbereiten» (PS.02.01, PS.02.02, PS.02.05, RK.02.05, PC.03.02; UC-003, UC-002 Schritt 11) | `vertrag` (`gate*`) · `vertrag` (`Gate*`) | diese Dateien | 190–199 | nach AP-E3-2 PR 1 · AP-E3-2, AP-E2-2 | K2-5, PPM-4; Phase und Baseline nach Entscheid (Test); UX-DoD |
| **AP-E3-4** | Versionsvergleich, Hauptänderungen, Änderungsantrag mit Entscheid SP oder Antrag an den PRAT nach Kapitelwirkung (PS.03.01, PS.03.02, PS.03.04; UC-007) | `vertrag` (`aenderung*`, `vergleich*`) · `vertrag` (`Versionen*`, `Aenderung*`) | diese Dateien | 200–209 | nach AP-E3-1 PR 1 · AP-E3-1, AP-E2-2 | SP kann Änderung an Kosten nicht freigeben (Test, K2-Prüfung); UX-DoD |
| **AP-E3-5** | Dokumentausgabe des Vertrags im Layout der Vorlage (Word, PDF) mit Version und Freigabe; Vorlage Projektvertrag als Grundbestand (DM.02.07, AM.03.01 Grundfunktion) | `vorlage`, `vertrag` (`dokument*`) · `vertrag` (`Dokument*`) | `src/modules/vorlage/`, diese Dateien | 210–219 | nach AP-E3-1 PR 1 · AP-E3-1 | Dokument enthält «Intern · enthält Personendaten» (G12); UX-DoD |

**E4 Ideen** ([K4](ux/ablaeufe/K4-projektidee.md); Abnahme K4-1 bis K4-4)

| AP | Inhalt (BC/UC) | Modul(e) · Feature(s) | Besitz | Migr. | Start · Merge nach | Abnahme |
|---|---|---|---|---|---|---|
| **AP-E4-1** | Assistent Projektidee, eigene Ideen mit Stand, Rückfragen beantworten (DM.01.01; UC-001 Schritte 1–2, A2.2) | `idee` · `idee` | `src/modules/idee/` (ausser `pruefung*`, `freigabe*`), `web/src/features/idee/` (ausser `Pool*`, `Pruefung*`) | 220–229 | nach AP-E0-9 · AP-E0-2, AP-E0-8, AP-E0-9 | K4-1, K4-2 (Aufgabentest), Antragstellende sehen nur Eingang und Ideen; UX-DoD |
| **AP-E4-2** | Ideenpool mit Funnel Pre-P0, Prüfung mit ähnlichen Ideen, Leitfragen Eintritt P0, Kriterienraster mit Kategorie-Vorschlag, Zusammenführen, Zurückweisen, Rückfrage (DM.01.02–04, PP.02.04; UC-001 Schritte 3–5, A1–A3) | `idee` (`pruefung*`) · `idee` (`Pool*`, `Pruefung*`) | diese Dateien | 230–239 | nach AP-E4-1 PR 1 · AP-E4-1, AP-E0-3, AP-E0-5 | K4-3, K4-4 als Betriebskennzahl; UX-DoD |
| **AP-E4-3** | Freigabe Initialisierung: Art `idee`, Projekt in P0 mit Herkunft, SP und PL, Aufgabe «Projektvertrag erstellen»; Kategorie C über die Direktion (UC-001 Schritte 6–7, A4, A5) | `idee` (`freigabe*`) | diese Dateien | 240–249 | nach AP-E4-2 PR 1 · AP-E4-2, AP-E2-2, AP-E3-1 | Projekt entsteht mit Angaben der Idee (Test) |

**E5 Priorisierung** ([K5](ux/ablaeufe/K5-priorisierung.md); Abnahme K5-1 bis K5-4)

| AP | Inhalt (BC/UC) | Modul(e) · Feature(s) | Besitz | Migr. | Start · Merge nach | Abnahme |
|---|---|---|---|---|---|---|
| **AP-E5-1** | Bewertungsmodell und Budgetrahmen (Entwurf, in Kraft), Bewertung je Kriterium hoch/mittel/tief (PP.01.02, PP.01.03, PP.02.01; UC-008 Schritte 1–2, A1) | `priorisierung` · `priorisierung` | `src/modules/priorisierung/` (ausser `matrix*`, `szenario*`, `entscheid*`), `web/src/features/priorisierung/` (entsprechend) | 250–259 | nach AP-E0-6 · AP-E0-5, AP-E0-6 | K5-2 (15 × 7 nur Tastatur); UX-DoD |
| **AP-E5-2** | Matrix Nutzen/Risiko und Ressourcen/Nutzen, Rangfolge, Portfoliorisiken und Abhängigkeiten erfassen (PP.03.04, PP.02.02, PP.02.03, PC.02.01; UC-008 Schritte 3–4) | `priorisierung` (`matrix*`) · `priorisierung` (`Matrix*`) | diese Dateien | 260–269 | nach AP-E5-1 PR 1 · AP-E5-1 | Zuordnung zur Matrix angezeigt (A-39); UX-DoD |
| **AP-E5-4** | Kapazitätsangebot je Rolle und Monat, Auslastung (auch je Szenario) (RK.01.01 Grundfunktion, RK.02.04; UC-009 Schritte 1–2, 5) | `ressource` · `ressourcen` | `src/modules/ressource/`, `web/src/features/ressourcen/` | 270–279 | nach AP-E0-6 · AP-E0-6 | Q-L5 (50 × 31 Zellen); UX-DoD |
| **AP-E5-3** | Szenarien mit Reihenfolge und Start, Wasserlinie gegen Budget und Kapazität, Vergleich, Entscheidungsvorlage (PP.03.01–03; UC-008 Schritte 5–6) | `priorisierung` (`szenario*`) · `priorisierung` (`Szenario*`) | diese Dateien | 280–289 | nach AP-E5-2 PR 1 · AP-E5-2, AP-E5-4 | K5-1 (≤ 200 ms / ≤ 1 s bei 60 Projekten, automatisch), K5-4; UX-DoD |
| **AP-E5-5** | Antrag traktandieren, Art `priorisierung`, Ist-Stand übernehmen, Projekte unter der Wasserlinie (UC-008 Schritte 7–8, A2) | `priorisierung` (`entscheid*`) | diese Dateien | 290–299 | nach AP-E5-3 PR 1 · AP-E5-3, AP-E2-2 | K5-3 |

**E6 Ziele** ([K6](ux/ablaeufe/K6-ziele.md); Abnahme K6-1 bis K6-4)

| AP | Inhalt (BC/UC) | Modul(e) · Feature(s) | Besitz | Migr. | Start · Merge nach | Abnahme |
|---|---|---|---|---|---|---|
| **AP-E6-1** | Zielzyklus: Jahresziele je strategischem Ziel, Hauptaktivitäten mit Verantwortlichen, Metrik mit Zielwert, Zuordnung der Projekte, Idee anstossen (ZM.02.01, ZM.02.03, ZM.02.04; UC-011 Schritte 1–5) | `ziel` (`zyklus*`) · `ziele` (`Zielzyklus*`) | diese Dateien | 300–309 | nach AP-E0-9 · AP-E0-9, AP-E0-4 | K6-1, K6-2 (≤ 2 Klicks, automatisch); UX-DoD |
| **AP-E6-2** | Vorlage an den VR, Freigabe erfassen, Sperre ab «zur Freigabe», Roadmap publizieren (ZM.02.02, PP.04.03; UC-011 Schritte 6–8, A2) | `ziel` (`freigabe*`, `roadmap*`) · `ziele` (`Freigabe*`, `Roadmap*`) | diese Dateien | 310–319 | nach AP-E6-1 PR 1 · AP-E6-1 | Jahresziel ohne Metrik sperrt die Vorlage (Test); UX-DoD |
| **AP-E6-3** | Zielerreichung je Quartal (ZM.03.01; UC-012 Schritte 1–2) | `ziel` (`erreichung*`) · `ziele` (`Zielerreichung*`) | diese Dateien | 320–329 | nach AP-E6-1 PR 1 · AP-E6-1 | K6-3; UX-DoD |
| **AP-E6-4** | Quartalsreporting aus Dashboard und Zielerreichung, Art `quartalsreporting`, VR-Weiterleitungen, Rückmeldungen und Aufträge des VR (ZM.03.02, PC.04.02; UC-012 Schritte 3–6, A1; UC-006 A4) | `ziel` (`quartal*`) · `ziele` (`Quartalsreporting*`) | diese Dateien | 330–339 | nach AP-E6-3 PR 1 · AP-E6-3, AP-E2-3 | K6-4; UX-DoD |

**E7 Ausbauen** (Abnahme Q-W1 und Q-W2 je Rolle, PPM-6)

| AP | Inhalt (BC/UC) | Modul(e) · Feature(s) | Besitz | Migr. | Start · Merge nach | Abnahme |
|---|---|---|---|---|---|---|
| **AP-E7-1** | Abschlussbericht, Nutzenprüfung, Exit-Gate, Sistieren, Abbrechen, Wiederaufnahme (A-09), Lessons Learned (PS.04.01–03, PC.03.02, PC.03.04; UC-015) | `abschluss` · `abschluss` | `src/modules/abschluss/`, `web/src/features/abschluss/` | 340–349 | nach AP-E3-3 · AP-E3-3 | Endzustand lesend (Test); UX-DoD |
| **AP-E7-2** | Bedarfsliste, Zuteilung, Konflikte nach Priorität, ungedeckter Bedarf (RK.02.02, RK.02.03; UC-009 Schritte 3–4, A1, A2) | `ressource` (`zuteilung*`) · `ressourcen` (`Bedarf*`) | diese Dateien | 350–359 | nach AP-E5-4 · AP-E5-4 | Zuteilung einzelner Personen nur für RM, UE, Person selbst (darstellung.md) |
| **AP-E7-3** | Schnittstellen mit Laufprotokoll und Fehleraufgabe, Änderungsprotokoll über Audit (AM.03.02, AM.03.03; UC-018 Schritte 3–5, A1) | `schnittstelle` · `schnittstellen` | `src/modules/schnittstelle/`, `web/src/features/schnittstellen/`, Eintrag in `scripts/check-network.ts` | 360–369 | sofort · AP-E0-8 | UI-49, UI-50; UX-DoD |
| **AP-E7-4** | Ist-Kosten aus dem ERP (A-16), Finanzübersicht, Abweichungen mit Begründung, Jahresbedarf und Export an den Budgetprozess (A-17) (PC.01.02, PC.01.04, PC.01.05; UC-010) | `finanzen` · `finanzen` | `src/modules/finanzen/`, `web/src/features/finanzen/` | 370–379 | nach AP-E0-6 · AP-E7-3 | «noch nicht verfügbar» statt 0 (darstellung.md); UX-DoD |
| **AP-E7-5** | Jahresrückblick mit Lessons-Learned-Prüfung, Art `jahresrueckblick` (ZM.03.03, PS.04.03; UC-013) | `jahresrueckblick` · `jahresrueckblick` | `src/modules/jahresrueckblick/`, `web/src/features/jahresrueckblick/` | 380–389 | nach AP-E7-1 · AP-E7-1, AP-E6-3 | UX-DoD |
| **AP-E7-6** | Ad-hoc-Auswertungen mit Filter, Kennzahl, Gruppierung, Export (PC.04.03; UC-014 A2) | `auswertung` (`adhoc*`) · `dashboard` (`Auswertungen*`) | diese Dateien | 390–399 | nach AP-E1-3 · AP-E1-3 | UX-DoD |
| **AP-E7-7** | Vorlagen mit Versionen und Feldzuordnung für alle Dokumente (AM.03.01; UC-018 Schritte 1–2) | `vorlage` · `vorlagen` | `src/modules/vorlage/` (Erweiterung), `web/src/features/vorlagen/` | 400–409 | nach AP-E3-5 · AP-E3-5 | UX-DoD |
| **AP-E7-8** | Benutzer und Rollen vollständig: Zugang entziehen mit offenen Aufgaben und neu zu besetzenden Rollen (AM.01.01, AM.01.02; UC-016 Schritte 1–3, A1, A2) | `eingang` (`neubesetzung*`), Baukasten | diese Dateien | 410–419 | nach AP-E0-8 · AP-E0-8, AP-E0-4 | UX-DoD |

### 7.4 Wellen (Vorschlag der Parallelität)

| Welle | Pakete gleichzeitig |
|---|---|
| 2 | AP-E0-0 (läuft), **AP-E0-1 (zuerst mergen)**, AP-E0-2, AP-E0-3, AP-E0-8, AP-E0-9, AP-E7-3 |
| 3 | AP-E0-4, AP-E0-5, danach AP-E0-6 |
| 4 | AP-E1-1, AP-E1-2 (nach PR 1 von E1-1), AP-E2-1, AP-E5-4, AP-E6-1 |
| 5 | AP-E1-3, AP-E0-7, AP-E2-2, AP-E3-1, AP-E4-1, AP-E5-1, AP-E6-3 |
| 6 | AP-E2-3, AP-E2-4, AP-E3-2, AP-E3-4, AP-E3-5, AP-E4-2, AP-E5-2, AP-E6-2, AP-E7-6 |
| 7 | AP-E3-3, AP-E4-3, AP-E5-3, AP-E6-4, AP-E7-2, AP-E7-4, AP-E7-8 |
| 8 | AP-E5-5, AP-E7-1, AP-E7-7, danach AP-E7-5 |

## 8. Annahmen

Vorschläge aus [Klärungsliste](anhang/klaerungsliste.md) (K) und [Fahrplan](ux/fahrplan.md#offene-fragen) (UX-OF), die bis
zur Klärung gelten. Sie werden im PR und in [umsetzungsstand.md](umsetzungsstand.md) genannt; nach der Klärung im
Masterdokument wird die Annahme Entscheid oder Änderung.

| ID | Offen | Annahme | Pakete |
|---|---|---|---|
| A-01 | K01, V10 | Bewertung ohne Score: je Kriterium hoch/mittel/tief, Gesamtbeurteilung durch das Gremium | AP-E5-1, AP-E5-2 |
| A-02 | K02, UX-E8 | SNS-VR ist ein Gremium ohne Benutzer am Portfolio A; die UE erfasst Vorlage und Entscheid | AP-E0-5, AP-E2-2, AP-E3-3 |
| A-03 | K03 | Weiterleitung an den VR auch ausserhalb des Quartals als Ausnahme; die UE erfasst sie | AP-E2-2, AP-E6-4 |
| A-04 | K04, K05 | Programmauftraggeber VR; Sponsoren-Koalition als Liste in der Projektorganisation; eine Unterschrift für Auftraggeber/Sponsor | AP-E0-4, AP-E3-2 |
| A-05 | K06 | Das Gremium benennt den Sponsor, der Sponsor die Projektleitung; die UE erfasst beide mit dem Entscheid | AP-E4-3 |
| A-06 | K07 | Die UE weist offensichtlich ungeeignete Ideen allein zurück und informiert das Gremium (Mitteilung); alle anderen entscheidet das Gremium | AP-E4-2 |
| A-07 | K08 | Kategorie B: gleicher Mindeststandard wie A (Vertrag, Quality-Check, Monatsbericht) | AP-E0-5, AP-E1-1 |
| A-08 | K09 | Kategorie C wird geführt, freiwillig, ohne Pflicht-Gates und Pflicht-Reporting (`portfolio.pflichten = false`) | AP-E0-5, AP-E1-1 |
| A-09 | K10 | Wiederaufnahme sistierter Projekte per Gremiumsentscheid, Vertrag über ein Gate fortgeschrieben | AP-E7-1 |
| A-10 | K11 | Toleranzen je Projekt im Vertrag, Standard im Phasenmodell; ohne Wert keine Warnung «wesentlich» | AP-E0-3, AP-E1-1, AP-E7-4 |
| A-11 | K12 | Fehlender Bericht: Werte der Vorperiode mit «nicht gemeldet», im Dashboard sichtbar | AP-E1-2 |
| A-12 | K13 | Pflichtangaben je Phase konfigurierbar; Vorgabe nur Personal in FTE und Kosten P2–P4 ab Gate P1–P2 (UC-003 A1); weitere legt die UE fest | AP-E0-3, AP-E3-1 |
| A-13 | K15 | Neue Version des Phasenmodells gilt für ein Projekt ab seinem nächsten Gate | AP-E0-3, AP-E3-3 |
| A-14 | K16 | Einmalige Übernahme der laufenden Projekte aus dem Excel-Dashboard | AP-E0-7 |
| A-15 | K17 | Strategische Ziele = Ziele 2030; keine Zwischenstufe | AP-E0-9 |
| A-16 | K18 | Ist-Kosten monatlich aus dem ERP über einen Kostenträger je Projekt | AP-E7-4 |
| A-17 | K19 | Jahresbedarf zeitanteilig nach Phasenterminen, durch FI korrigierbar | AP-E7-4 |
| A-18 | K20 | Budgetrahmen je Kategorie optional; ohne Rahmen keine Budget-Wasserlinie | AP-E5-1, AP-E5-3 |
| A-19 | K21 | Business Case bis zur Vorlage: Kosten je Phase CAPEX/OPEX aus dem Register, Nutzen als Text mit KPIs | AP-E3-1 |
| A-20 | K22 | Ressourcen in FTE × Monate je Rolle und Phase; Pool = Rolle | AP-E0-6, AP-E5-4, AP-E7-2 |
| A-21 | K23 | Benutzer aus dem Verzeichnisdienst (Entra über den Baukasten); keine Abwesenheiten | AP-E7-8 |
| A-22 | K24 | ICT- und Infrastrukturbedarf als Meldung im System (Mitteilung an die konfigurierte Stelle); keine Schnittstelle | AP-E0-6, AP-E3-1 |
| A-23 | K25 | Direktionen als Organisationseinheiten mit Kürzel; Bedeutung der Kürzel pflegt ADM | AP-E0-2 |
| A-24 | UX-OF-1, UX-OF-2 | Anrede «Sie», nur Deutsch, Texte zentral und übersetzbar | alle mit Oberfläche |
| A-26 | UX-OF-4 | Aufgabe «Statusbericht erstellen» am 18. | AP-E1-1 |
| A-27 | UX-OF-5 | «Gate vorbereiten» 30, «Sitzung vorbereiten» 15 Arbeitstage vor der Sitzung, im Phasenmodell konfigurierbar | AP-E0-3, AP-E2-1, AP-E3-3 |
| A-28 | UX-OF-7 | Sammelbestätigung unauffälliger Berichte; Berichte mit Auffälligkeit einzeln | AP-E1-2 |
| A-29 | UX-OF-8 | Höchstens ein Entwurf je Projekt; Änderung während der Gate-Vorbereitung im Gate-Entwurf | AP-E3-1, AP-E3-4 |
| A-30 | UX-OF-9 | Entscheid bis zum Schliessen der Sitzung korrigierbar, mit Verlauf; danach nur über ein neues Traktandum | AP-E2-2 |
| A-31 | UX-OF-10 | Unterzeichnen als protokollierter Klick; Stellvertretung nur mit ausdrücklich erteiltem Recht für Unterschriften | AP-E0-8, AP-E3-2 |
| A-32 | UX-OF-11 | Ähnliche Ideen sieht nur die UE | AP-E4-2 |
| A-33 | UX-OF-12 | Projektrollen sehen nur ihre Projekte; Beträge nur PL, CTL, SP, UE, FI, Gremium (und GL, A-41) | AP-E0-1, AP-E0-6, AP-E1-3 |
| A-34 | UX-OF-13 | Kennzeichnung «vertraulich» am Projekt; sichtbar nur für Projektrollen, UE und Gremium des Portfolios | AP-E0-1, AP-E0-4 |
| A-35 | UX-OF-14 | Publizierte Roadmap lesen alle angemeldeten Personen | AP-E6-2 |
| A-36 | UX-OF-15 | Gremienunterlagen im System, PDF zum Herunterladen, E-Mail nur mit Link | AP-E2-1 |
| A-37 | UX-OF-16 | Bericht nach Abschluss der Periode zählt für die nächste; die abgeschlossene bleibt «nicht gemeldet» | AP-E1-2 |
| A-38 | UX-OF-17 | Abweichung je Dimension «keine / gering / wesentlich» mit Kommentar | AP-E1-1 |
| A-39 | UX-OF-18 | Nutzen und Risiko der Matrix aus der Bewertung je Kriterium nach fester, angezeigter Zuordnung | AP-E5-2 |
| A-40 | UX-OF-3, UX-OF-6 | Nutzungskontexte wie beschrieben; Zugriff wie andere interne Web-Anwendungen | alle |
| A-41 | – (Bauplan) | GL sieht Beträge, weil sie den Budgetbedarf übergibt (UC-010 Schritt 6, UC-011 Schritt 9) | AP-E0-1 |
| A-42 | – (Bauplan) | PMO hat dieselben Rechte wie die UE (IA: gleiche Sichtbarkeit) | AP-E0-1 |
| A-43 | – (Bauplan) | Arbeitstage = Montag bis Freitag ohne gepflegte Feiertage | AP-E0-2, AP-E0-3 |
| A-44 | – (Bauplan) | Benachrichtigungen vorerst nur im Eingang; E-Mail mit Link folgt mit einem Netz-Adapter für Mail | AP-E0-8 |
| A-45 | – (Bauplan) | Je Portfolio genau ein entscheidendes Gremium (PRAT ↔ A, GLPA ↔ B, Direktion ↔ C); Rechte im Gremium = Rolle `gremium` am Portfolio | AP-E0-1, AP-E0-5 |
| A-46 | – (Bauplan) | Antragstellende = alle Mitglieder (Rolle `antragsteller` an «Alle Mitglieder») | AP-E0-1, AP-E4-1 |
| A-47 | – (Bauplan) | Projektnummer «JJJJ-NNN» fortlaufend je Jahr der Anlage und Organisation | AP-E0-4 |

A-25 ist nicht vergeben (in A-24 enthalten). Annahmen A-41 bis A-47 sind technische Schnitte dieses Bauplans ohne
Fachregel; sie kommen als Frage in die Klärungsliste, sobald eine Fachfrage daran hängt.
