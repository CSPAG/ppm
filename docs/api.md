# REST-API

OpenAPI 3.1 unter `/v1/openapi.json`, lesbar unter `/v1/docs` (beide öffentlich). Jede Route hat genau einen Tag
(`tags` der Module in `defineModule`). Die Routen für Anmeldung, Konto, Zugriff, Verwaltung und Personen
liefert `@vollholz/iam`.

## Konventionen

| Thema | Regel |
|---|---|
| Version | Präfix `/v1`; Wegfall mit `Deprecation`- und `Sunset`-Header vor dem Entfernen |
| Listen | Cursor-Paginierung: `?cursor=…&limit=…` (1–200, Standard 50), Antwort `{ items, nextCursor }`; `nextCursor` ist opak und `null` auf der letzten Seite; ein Cursor einer anderen Abfrage ergibt 422 |
| Lesen | `ETag: W/"<version>"` |
| Ändern, Löschen | `If-Match` mit dem ETag ist Pflicht: fehlt er → 428, Version veraltet → 412 (mit `currentVersion` und aktuellem `ETag`) |
| Anlegen | 201 mit `Location` und `ETag` |
| Idempotenz | `Idempotency-Key` (1–255 Zeichen) bei allen schreibenden Aufrufen: Wiederholung liefert die gespeicherte Antwort mit `Idempotent-Replayed: true`; gleicher Schlüssel mit anderer Anfrage oder noch in Bearbeitung → 409; 5xx werden nicht gespeichert; Aufbewahrung `IDEMPOTENCY_TTL` (24 h) |
| Aktionen | `POST /v1/<ding>/{id}:<aktion>` |
| Lange Läufe | `202 Accepted` mit `Location` auf den Status |
| Unbekannte Felder | 422 (keine stille Entfernung) |
| Rate-Limit | `API_RATE_LIMIT` je Minute und Principal in der Organisation, ohne Anmeldung je IP; 429 mit `Retry-After` |

## Fehler (RFC 9457)

Immer `application/problem+json` mit `type` = `<PUBLIC_BASE_URL>/probleme/<status>`, `title`, `status`, optional
`detail` und `instance`. 422 zusätzlich mit `errors: [{ path, message }]`. Datenbankfehler: Eindeutigkeit (23505) und
Verweise (23503) → 409, Zeilenrichtlinie (42501) → 403 mit Warnung im Log; alles Unerwartete → 500 mit `Referenz <request-id>`
im `detail`, ohne Interna. Fremde IDs (andere Organisation) ergeben dieselbe Antwort wie unbekannte (404).

## Anmeldung

| Wer | Wie |
|---|---|
| Oberfläche | Sitzung über das BFF (`/auth/*`, Code-Flow mit PKCE); Cookie `HttpOnly`, `Secure`, `SameSite=Lax`; schreibende Aufrufe mit CSRF-Token |
| Maschinen-Clients | Client Credentials (`private_key_jwt`) an Keycloak, Token mit Zielgruppe `ppm-api`, DPoP-gebunden (`DPOP_MODE=required-for-clients`) |
| MCP-Hosts | über den MCP-Dienst ([mcp.md](mcp.md)) |

Eine Anfrage gilt für genau eine Organisation (aus dem Token, bei mehreren über die Wahl der Sitzung bzw. `X-Tenant`).

## Rechte

Effektiv gilt **Rolle ∩ Scope** (Scopes nur bei Maschinen-Clients und MCP). Rollen sind Tupel in der Datenbank der
App (`<subjekt> <rolle> <ort>`), nie im Token. Modell: `src/authz/model.ts`, ausgeliefert unter
`GET /v1/authz/catalog`.

| Rolle | Orte | Rechte |
|---|---|---|
| `org-admin` | org | alle (vom Baukasten, inkl. `tenant:*`, `members:admin`, `access:admin`, `audit:read`, `webhook:admin`) |
| `gl` (Geschäftsleitung) | org | `tenant:read`, `handlungsfeld:read`, `handlungsfeld:write`, `handlungsfeld:delete` |
| `leser` (Leser:in) | org | `tenant:read`, `handlungsfeld:read` |

| Scope | Rechte |
|---|---|
| `ppm:read` | `tenant:read` und alle `*:read` der Fachbereiche ausser `finanzen:read` (Beträge) |
| `handlungsfeld:write` | `handlungsfeld:write`, `handlungsfeld:delete` |

`members:admin`, `access:admin`, `schnittstelle:admin` und `webhook:admin` stehen in keinem Scope. Das Modell hat
Stufe «mittel» mit der Kette `org → portfolio → projekt`: Rollen an der Organisation, am Portfolio (`gremium`,
`direktion`) und am Projekt (`sp`, `pl`, `ctl`, `kt`); Rechte, Rollen und Lesesicht in
[fachmodell.md, Abschnitt 3](fachmodell.md#3-rechte-und-orte). Antworten tragen die Fähigkeiten der anfragenden Person (`can: { write, delete }`).

## Handlungsfelder

Strategische Handlungsfelder mit Leitsatz und Stossrichtungen (BC ZM.01.01), Beispielmodul des Gerüsts.

| Methode und Pfad | Recht | Hinweis |
|---|---|---|
| `GET /v1/handlungsfelder?q=&cursor=&limit=` | `handlungsfeld:read` | Suche im Namen, sortiert nach `position`, dann Name |
| `POST /v1/handlungsfelder` | `handlungsfeld:write` | Name eindeutig ohne Gross/klein (409) |
| `GET /v1/handlungsfelder/{id}` | `handlungsfeld:read` | `ETag` |
| `PATCH /v1/handlungsfelder/{id}` | `handlungsfeld:write` | `If-Match` Pflicht |
| `DELETE /v1/handlungsfelder/{id}` | `handlungsfeld:delete` | `If-Match` Pflicht, Verlauf bleibt |
| `GET /v1/handlungsfelder/{id}/history` | `handlungsfeld:read` | alle Versionen, neueste zuerst |

## Phasenmodell

Phasen, Gates mit Leitfragen je Wertestrom, Standard-Lieferergebnisse und -Meilensteine, Pflichtangaben des Vertrags,
Kapitelwirkung, Fristen und Toleranzen (BC AM.02.03, UC-017 Schritte 3 und 5), versioniert: höchstens ein Entwurf und
eine Version in Kraft; eine Version in Kraft ist unveränderlich und wird durch die nächste abgelöst (gilt für laufende
Projekte ab ihrem nächsten Gate, A-13). Jede Antwort trägt den Prüfbericht (`pruefung`) und `can: { write, activate }`.

| Methode und Pfad | Recht | Hinweis |
|---|---|---|
| `GET /v1/phasenmodelle?cursor=&limit=` | `phasenmodell:read` | Versionen, neueste zuerst; `can.create` |
| `POST /v1/phasenmodelle` | `phasenmodell:write` | Entwurf aus der Version in Kraft (`quelle: aktuell`) oder der Vorgabe des PM-Handbuchs (`vorgabe`; ohne Version in Kraft immer); besteht ein Entwurf: 409 mit `entwurf` |
| `GET /v1/phasenmodelle/aktuell` | `phasenmodell:read` | Version in Kraft (404 ohne) |
| `GET /v1/phasenmodelle/{id}` | `phasenmodell:read` | `ETag` |
| `PATCH /v1/phasenmodelle/{id}` | `phasenmodell:write` | nur Entwurf (sonst 409), `If-Match` Pflicht; jede angegebene Liste ersetzt die bisherige |
| `DELETE /v1/phasenmodelle/{id}` | `phasenmodell:write` | Entwurf verwerfen, `If-Match` Pflicht |
| `POST /v1/phasenmodelle/{id}/in-kraft-setzen` | `phasenmodell:activate` | `If-Match` Pflicht; bisherige Version wird abgelöst |

Andere Module lesen das Phasenmodell und rechnen Fristen nur über `src/modules/phasenmodell/index.ts`:
`aktuellesPhasenmodell(tx)`, `phasenmodellLesen(tx, id)`, `frist(tx, schluessel)`, `fristDatum(tx, schluessel, bezug)`
(Arbeitstage ohne Wochenende und Feiertage der Organisation über `stammdaten`, A-43).
## Projekte

Projekte mit Nummer «JJJJ-NNN» (A-47), Portfolio, Phase und Lebenszyklus, Projektorganisation mit Sponsor,
Sponsoren-Koalition, Projektleitung, CTL und Kernteam (BC PP.04.04, UC-002 Schritt 2, UC-014 A1). Lesen nach Rolle an der
Organisation, am Portfolio oder am Projekt; «vertraulich» nur für Projektrollen, UE und Gremium (A-34). Endzustände
(`abgebrochen`, `abgeschlossen`, `zurueckgezogen`) sind lesend (409). Fähigkeiten: `can: { write, organisation }`.

| `GET /v1/projekte?rolle=&portfolio=&phase=&lebenszyklus=&nummer=&q=&cursor=&limit=` | `projekt:read` irgendwo | sortiert nach Nummer; `rolle` = eigene Funktion (`sp`, `pl`, `ctl`, `kt`, `koalition`), `portfolio` = Schlüssel |
| `GET /v1/projekte/kopf` | `projekt:read` irgendwo | laufende Projekte mit eigener Funktion (Kopfkarte im Eingang) |
| `POST /v1/projekte` | `projekt:create` an org oder am Portfolio | Nummer fortlaufend je Jahr der Anlage, Phase ohne Angabe P0 |
| `GET /v1/projekte/{id}` | `projekt:read` | `ETag` |
| `PATCH /v1/projekte/{id}` | `projekt:write` | Name, Federführung, Handlungsfeld, «vertraulich»; `If-Match` Pflicht |
| `GET /v1/projekte/{id}/organisation` | `projekt:read` | `ETag` = Stand der Projektorganisation |
| `PUT /v1/projekte/{id}/organisation` | `projekt:organisation` | ersetzt die Liste; setzt bzw. entzieht die Rollen `sp`, `pl`, `ctl`, `kt` als Tupel am Projekt; `If-Match` Pflicht |
| `POST /v1/projekte/uebernahme` | `projekt:create`, `projekt:write`, `projekt:organisation`, `statusbericht:write` an der Organisation | einmalige Übernahme aus dem Excel-Dashboard (K16, A-14): Prüflauf (`speichern: false`) mit Fehlern je Zeile, Speichern nur fehlerfrei; Spalten in `scripts/uebernahme/README.md` |
## Projektdaten

Register je Projekt (docs/fachmodell.md 2.6, AP-E0-6): Meilensteine, Lieferergebnisse und Kommunikationsmassnahmen
(PS.02.04, PS.05.02, PS.05.03), Kosten (PC.01.01, PC.01.03), Risiken (PC.02.04, PC.02.03; Portfoliorisiken PC.02.01),
KPIs mit Werten (PC.03.01, PC.03.03), Stakeholder (PS.05.01), Abhängigkeiten (PP.02.03), Ressourcenbedarf (RK.02.01,
RK.02.05, A-20) und Meldungen an ICT bzw. Infrastruktur (RK.02.06, A-22). Je Register `GET` (Cursor), `POST`, `PATCH`
und `DELETE /v1/projekte/{id}/<register>/{eintragId}` mit `If-Match`; Endzustände des Projekts sind lesend (409).
Baseline, Ist-Kosten, Abnahme durch das Gremium und «gedeckt» setzen nur obere Module (`projektdaten` in `index.ts`).

| Register (Pfad unter `/v1/projekte/{id}/`) | Lesen | Pflegen | Hinweis |
|---|---|---|---|
| `meilensteine?phase=&art=` | `projekt:read` | `projekt:write` | `art`: `meilenstein`, `lieferergebnis`, `kommunikation` |
| `kosten?phase=` | `projekt:read` und `finanzen:read` | `projekt:write` und `finanzen:read` | Beträge nur mit `finanzen:read` (A-33), auch in der Lesesicht; Beträge gehen nicht ins Ereignis |
| `risiken` | `projekt:read` | `projekt:write` | höchste Auswirkung zuerst |
| `kpis`, `kpis/{kpiId}/werte` | `projekt:read` | `projekt:write`; Werte `kpi:write` | `PUT …/werte/{JJJJ-MM}` ab Phase P2, `If-Match: W/"0"` für einen neuen Wert |
| `stakeholder` | `projekt:read` | `projekt:write` | |
| `abhaengigkeiten` | `projekt:read` | `projekt:write` | beide Richtungen (`ausgehend`, `eingehend`); das andere Projekt nur, wenn sichtbar |
| `ressourcenbedarf?phase=` | `projekt:read` | `projekt:write` | Grösse S/M/L oder FTE mit `vonMonat`–`bisMonat`; je Rolle und Phase ein Eintrag |
| `meldungen` | `projekt:read` | `projekt:write` | nur `GET` und `POST` (nur anhängen); Stelle `dti` oder `dbi` |
| `/v1/portfolios/{id}/risiken` | `projekt:read` (org oder Portfolio) | `projekt:write` an der Organisation | Portfoliorisiken (PC.02.01) |
## Statusberichte

Monatlicher Statusbericht je Projekt und Periode `YYYY-MM` (BC PS.01.01, UC-004, Kernablauf K1; `src/modules/statusbericht/`).

| `GET /v1/projekte/{id}/berichte` | `projekt:read` am Projekt | alle Berichte, neueste Periode zuerst |
| `GET /v1/projekte/{id}/berichte/{periode}` | `projekt:read` am Projekt | gespeichert oder Vorbelegung aus der Vorperiode (`version` 0, ohne Status und Trend); `fehlend` = Pflichtangaben für das Einreichen |
| `PUT /v1/projekte/{id}/berichte/{periode}` | `statusbericht:write` am Projekt | Entwurf speichern, `If-Match` Pflicht (`W/"0"` legt an); 409 nach dem Einreichen, in abgeschlossener Periode, in P4, für spätere Perioden |
| `POST /v1/projekte/{id}/berichte/{periode}/einreichen` | `statusbericht:write` am Projekt | 422 mit allen fehlenden Angaben in `errors` (Status, Trend, Beurteilung je Dimension; bei «kritisch» Begründung und Massnahme) |
| `POST /v1/projekte/{id}/berichte/{periode}/zurueckziehen` | `statusbericht:write` am Projekt | Rückgängig innert 10 s, nur durch die einreichende Person (409 sonst) |

Ereignisse: `statusbericht.created`, `statusbericht.updated`, `statusbericht.submitted`, `statusbericht.withdrawn`.

## Monatsabschluss

Prüfung und Abschluss der Periode durch die Unternehmensentwicklung (BC PS.01.02–04, UC-005, Kernablauf K1;
`src/modules/statusbericht/pruefung*`, `abschluss*`, AP-E1-2).

| Methode und Pfad | Recht | Hinweis |
|---|---|---|
| `GET /v1/perioden/{periode}` | `statusbericht:review` (Organisation; mit `portfolio` am Portfolio) | Posteingang: Stand je berichtspflichtigem Projekt, Status und Trend mit Vorperiode, Auffälligkeiten (Status geändert, Termin verschoben, Prognose über Budget); Filter `stand`, `portfolio`, `auffaellig`; `sort=auffaellig` (Standard) oder `nummer`; Kopf mit Anzahlen, Fristen und Wirkung des Abschlusses |
| `POST /v1/perioden/{periode}/bestaetigen` | `statusbericht:review` | Sammelbestätigung; auffällige und Berichte in anderem Stand werden übersprungen und genannt (A-28) |
| `POST /v1/perioden/{periode}/einfordern` | `statusbericht:review` | ausstehende Berichte einfordern: Aufgabe `statusbericht.erstellen` an die Projektleitung |
| `POST /v1/perioden/{periode}/abschliessen` | `periode:close` | 409 bei eingereichten, ungeprüften Berichten; sonst Stand je Projekt mit «nicht gemeldet» (A-11), Periode gesperrt (A-37); `If-Match` optional |
| `GET /v1/perioden/{periode}/terminabweichungen` | `statusbericht:review` | Baseline und aufdatiert je Phase und Abschluss, nach grösster Verschiebung |
| `POST /v1/projekte/{id}/berichte/{periode}/pruefen` | `statusbericht:review` am Portfolio | Bericht bestätigen («geprüft»), `If-Match` Pflicht |
| `POST /v1/projekte/{id}/berichte/{periode}/pruefung-zuruecknehmen` | `statusbericht:review` am Portfolio | Rückgängig: wieder «eingereicht» |
| `GET /v1/projekte/{id}/berichte/{periode}/rueckfragen` | `projekt:read` am Projekt | Rückfragen, neueste zuerst |
| `POST /v1/projekte/{id}/berichte/{periode}/rueckfragen` | `statusbericht:review` am Portfolio | Rückfrage: Bericht «zurückgegeben», Aufgabe `statusbericht.rueckfrage` an die Projektleitung |
| `GET /v1/statusberichte/kopf` | angemeldet | Kennzahlen für die Startseite; `pruefen` nur mit `statusbericht:review` |

Ereignisse: `statusbericht.reviewed`, `statusbericht.review_withdrawn`, `statusbericht.returned`, `statusbericht.requested`,
`periode.closed`. Aufgaben im Eingang: `statusbericht.pruefen` (Sammelaufgabe ab dem ersten Einreichen), `periode.abschliessen`
(Job `statusbericht.periode_faellig` am Stichtag), `statusbericht.rueckfrage`, `statusbericht.erstellen` (eingefordert).

## Dashboard

Dashboard der Periode (BC PC.04.01, UC-014 Schritt 1, Kernablauf K1/K3; `src/modules/auswertung/`, AP-E1-3). Nur lesend.

| Methode und Pfad | Recht | Hinweis |
|---|---|---|
| `GET /v1/dashboard?portfolio=&periode=&ansicht=liste\|funnel` | `auswertung:read` an der Organisation oder am Portfolio | Portfolios nach Recht (Gremium, Direktion nur ihr Portfolio; unbekanntes oder fremdes Portfolio 404); ohne `periode` die letzte abgeschlossene, sonst die laufende; abgeschlossen = Stand bei Abschluss mit «nicht gemeldet» (A-11), offen = aktueller Stand mit «ausstehend»; Badge `eskalation`; kritische zuerst; Funnel nach Phase |

## Risikolage und Portfoliobericht

Risikolage (BC PC.02.02, UC-014 Schritt 2) und Portfoliobericht (BC PC.04.02, UC-014 Schritt 3, K3 Schritt 4;
`src/modules/auswertung/` Dateien `risiko*`, `bericht*`, Tabelle `portfoliobericht` aus 150, AP-E2-3). Art
`portfoliobericht` in der Registry der Sitzung: Beim Bereitstellen schlägt der Bericht dem entscheidenden Gremium das
Traktandum «Bericht der Programmleitung» vor (K3 Schritte 1 und 4), Unterlage ist der Bericht selbst; Kenntnisnahme
ohne Entscheid.

| Methode und Pfad | Recht | Hinweis |
|---|---|---|
| `GET /v1/dashboard/risiken?portfolio=` | `auswertung:read` an der Organisation oder am Portfolio | Projektrisiken der aktiven Projekte und Portfoliorisiken, höchste Auswirkung und Wahrscheinlichkeit zuerst; Matrix 3 × 3; Abhängigkeiten; offene Eskalationen |
| `GET /v1/portfolioberichte?portfolio=` | `auswertung:read` | Entwürfe nur mit `auswertung:write`, sonst bereitgestellte Berichte der sichtbaren Portfolios |
| `POST /v1/portfolioberichte` | `auswertung:write` | aus dem abgeschlossenen Dashboard (offene Periode 409); 201 neu, 200 im Entwurf neu erzeugt (Kommentar bleibt), bereitgestellt 409 |
| `GET /v1/portfolioberichte/:id` | `auswertung:read` (Lesesicht) | Stand bei Erzeugung; ETag |
| `PATCH /v1/portfolioberichte/:id` | `auswertung:write` | Kommentar im Entwurf; `If-Match` |
| `POST /v1/portfolioberichte/:id/bereitstellen` | `auswertung:write` | danach fest und für Gremien sichtbar, Vorschlag an das entscheidende Gremium; `If-Match`; Ereignis `portfoliobericht.provided` |
| `GET /v1/portfolioberichte/:id/dokument?format=pdf\|docx` | `auswertung:read` (Lesesicht) | über die Ausgabe des Moduls `vorlage`; Export im Audit |

## Ressourcen

Kapazitätsangebot und Auslastung (docs/fachmodell.md 2.12, AP-E5-4; RK.01.01, RK.02.04; UC-009 Schritte 1–2, 5). Pool =
Rolle (Codetabelle `ressourcenrolle`, A-20); Zeitraum `von`/`bis` als `JJJJ-MM`, ohne Angabe der laufende Monat und die
elf folgenden, höchstens 60 Monate.

| Route | Recht | Hinweis |
|---|---|---|
| `GET /v1/kapazitaet?von=&bis=` | `ressource:read` | Angebot je Rolle und Monat mit `version` je Zelle, `can.write` |
| `PUT /v1/kapazitaet` | `ressource:write` | mehrere Zellen, alles oder nichts; vorhandene Zelle nur mit gelesener `version` (sonst 412); `fte: null` entfernt; Rolle nur aktiver Codewert (422) |
| `GET /v1/auslastung?von=&bis=&szenario=` | `ressource:read` | je Rolle und Monat Angebot, Bedarf, frei, Lage (`ueberbucht`, `ohne_angebot`, `ausgelastet`, `frei`, `leer`) mit Beiträgen je Projekt; Engpässe je Quartal; Bedarf der sichtbaren Projekte, nur FTE × Monate (Grösse S/M/L zählt nicht); `szenario` liefert die Priorisierung (AP-E5-3), sonst 404 |

Bedarfsliste, Zuteilung und Konflikte (AP-E7-2; RK.02.02, RK.02.03; UC-009 Schritte 3–4, A1, A2). Zugeteilt wird je
Bedarf, Person und Monat ein Anteil in FTE (höchstens eine Stelle je Person, Beschäftigungsgrad aus dem HR-System offen);
nur Bedarf in FTE × Monate (A-20). Zuteilungen einzelner Personen sehen RM, UE, die Person selbst und die Projektleitung
des Projekts (darstellung.md), auch in der Lesesicht. Jede Änderung führt «gedeckt» im Register nach, informiert Person
und Projektleitung (Mitteilung) und führt die Sammelaufgaben `bedarf.decken` und `konflikt.aufloesen` nach (zusätzlich
stündlich). Priorität kommt aus der Priorisierung (`prioritaetQuelleSetzen`), sonst `null`.

| Route | Recht | Hinweis |
|---|---|---|
| `GET /v1/bedarfe?stand=&rolle=&projekt=&von=&bis=` | `ressource:read` | mit Deckung (`benoetigt`, `zugeteilt` in FTE-Monaten), `stand` (`offen`, `teilweise`, `gedeckt`, `ungedeckt`), Lücke, Priorität; `anzahl` je Stand; nach Priorität und Beginn |
| `GET /v1/bedarfe/{id}` | `ressource:read` | Deckung je Monat und Zuteilungen |
| `GET /v1/bedarfe/{id}/personen?q=` | `ressource:write` | Personen mit Zuteilung und freier Kapazität je Monat des Bedarfs |
| `POST /v1/bedarfe/{id}/zuteilungen` | `ressource:write` | Person mit Anteil für den ganzen Bedarf oder `vonMonat`–`bisMonat` (ausserhalb 422, doppelt 409); Antwort mit berührten Überbuchungen (Warnung) |
| `PATCH`, `DELETE /v1/zuteilungen/{id}` | `ressource:write` | Anteil ändern bzw. entfernen, `If-Match` Pflicht |
| `PUT`, `DELETE /v1/bedarfe/{id}/luecke` | `ressource:write` | Lücke melden (Stand `ungedeckt`) bzw. zurücknehmen; bei gedecktem Bedarf 409 |
| `GET /v1/zuteilungen/konflikte?von=&bis=` | `ressource:read` | Personen über einer Stelle, Rollen über dem erfassten Angebot; Beteiligte nach Priorität |
| `GET /v1/zuteilungen?person=ich\|{id}&projekt=&von=&bis=` | eigene: jede Person; Projekt: `projekt:read` (Zeilen nur für Projektleitung, RM, UE); Person: `ressource:read` | Zuteilungen lesen |

## Sitzungen

Sitzungen der Gremien vorbereiten (BC PP.04.01, PP.04.05; UC-006 Schritte 1–5, A1, A2; Kernablauf K3). Die Sitzung
entsteht aus einem Sitzungstermin des Gremiums (von Hand oder 15 Arbeitstage vorher durch den Lauf der Fristen, A-27).
Lesen mit `sitzung:read` am Portfolio des Gremiums, Traktanden und Unterlagen erst ab Versand; Eingeladene sehen ab
Versand nur ihr Traktandum. Bearbeiten mit `sitzung:write` bis zum Versand. Fähigkeiten: `can: { write }`.

| Methode und Pfad | Recht | Hinweis |
|---|---|---|
| `GET /v1/gremien/{kuerzel}/sitzungen?von=&bis=&cursor=&limit=` | `sitzung:read` | Termine und Sitzungen ab heute; Termin ohne Sitzung mit `id: null` |
| `POST /v1/gremien/{kuerzel}/sitzungen` | `sitzung:write` | `{ datum }` eines Termins (sonst 422), feste Traktanden der Registry |
| `GET /v1/gremien/{kuerzel}/sitzungen/{datum}` | `sitzung:read` | Adresse der Oberfläche; `ETag` |
| `GET /v1/sitzungen/kopf` | `sitzung:read` irgendwo | nächste Sitzungen mit Versandfrist (Eingang) |
| `GET /v1/sitzungen/{id}` | `sitzung:read` | Traktandenliste mit Zeitbedarf, Zeitfenster, Unterlagenstand, Eingeladenen, Versandfrist; `ETag` |
| `PATCH /v1/sitzungen/{id}` | `sitzung:write` | Beginn, Dauer, Ort; `If-Match` Pflicht |
| `GET /v1/sitzungen/{id}/vorschlaege` | `sitzung:write` | Vorschläge je Art; verschobene der letzten Sitzung zuerst |
| `POST /v1/sitzungen/{id}/traktanden` | `sitzung:write` | `{ vorschlagId }` aufnehmen oder `{ art, projektId, titel, antrag }` einplanen (PP.04.05); liefert die Sitzung |
| `PUT /v1/sitzungen/{id}/traktanden` | `sitzung:write` | `{ reihenfolge }` aller Traktanden; `If-Match` (Sitzung) |
| `GET /v1/sitzungen/{id}/versand` | `sitzung:write` | Vorschau der Wirkung (I-R1): Traktanden, Unterlagen, Eingeladene, Frist, Warnungen |
| `POST /v1/sitzungen/{id}/versenden` | `sitzung:write` | `If-Match`; protokolliert Zeitpunkt und Arbeitstage vor der Sitzung (K3-1) |
| `GET /v1/traktanden/{id}` | `sitzung:read` | Antrag, Unterlagen, Eingeladene |
| `PATCH /v1/traktanden/{id}` | `sitzung:write` | Titel, Antrag, Zeitbedarf; `If-Match` |
| `POST /v1/traktanden/{id}/entfernen` | `sitzung:write` | zurück zu den Vorschlägen |
| `POST /v1/traktanden/{id}/verschieben` | `sitzung:write` | auf den nächsten Termin (UC-006 A2); ohne Termin 409 |
| `PUT /v1/traktanden/{id}/einladungen` | `sitzung:write` | Eingeladene ersetzen; `If-Match` (Traktandum) |

Andere Module registrieren ihre Traktandenart und schlagen Geschäfte vor, nur über `src/modules/sitzung/index.ts`
(`registriereTraktandenart`, `traktandum.vorschlagen`); siehe [README des Moduls](../src/modules/sitzung/README.md).
## Projektvertrag

Versionen des Projektvertrags mit den Kapiteln 1–13 der Vorlage (Q7) als Daten (docs/fachmodell.md 2.10, AP-E3-1;
DM.02.01–03, UC-002 Schritte 1–8). Höchstens ein Entwurf je Projekt (UX-E5, A-29), genau eine Baseline. Lesen mit
`projekt:read`, bearbeiten und einreichen mit `vertrag:write` am Projekt; Kapitel 9 (Kosten) nur mit `finanzen:read`
(ohne: Beträge `null`, Speichern 403; A-33). Endzustände des Projekts sind lesend (409).

| `GET /v1/projekte/{id}/vertrag` | `projekt:read` | Versionen (neueste zuerst), `entwurf`, `baseline`, `can.entwerfen` (mögliche Anlässe) |
| `POST /v1/projekte/{id}/vertrag/entwuerfe` | `vertrag:write` | `anlass` `initial` (Version 0.1, Vorbelegung aus `projekt.herkunft` und den Standard-Ergebnissen des Phasenmodells); `aenderung` (nur mit Baseline, Begründung Pflicht: nächste Unternummer, alle Kapitel aus der Baseline); `gate` folgt mit AP-E3-3 (bis dahin 409); besteht ein Entwurf: 409 mit `entwurf` |
| `GET /v1/projekte/{id}/vertrag/ziele` | `projekt:write` | Ziele zur Wahl in Kap. 2: strategische Ziele mit Handlungsfeld, Jahresziele ab dem laufenden Jahr (in voller Sicht gelesen, auch ohne `ziel:read` an der Organisation) |
| `GET /v1/vertragsversionen/{id}` | `projekt:read` | Kopf und Kapitelnavigation (`geaendert`, `fehlend` je Kapitel); `ETag` der Version |
| `GET /v1/vertragsversionen/{id}/kapitel/{nr}` | `projekt:read` | Inhalt nach Schema (`Kapitel1` … `Kapitel13`) mit `basis` (Inhalt der Basisversion); `ETag` des Kapitels |
| `PUT /v1/vertragsversionen/{id}/kapitel/{nr}` | `vertrag:write` | nur Entwurf «in Arbeit», `If-Match` Pflicht (412 bei fremder Änderung); ganzer Inhalt, 422 mit Pfad `/inhalt/…` |
| `GET /v1/vertragsversionen/{id}/pflichtangaben` | `projekt:read` | Angaben des Gates in die Zielphase und der Zielphase (Phasenmodell, K13, A-12) mit `erfuellt`, `grund` und Sprungziel `kapitel`/`feld` (K2-4) |
| `POST /v1/vertragsversionen/{id}/einreichen` | `vertrag:write` | «in Arbeit» → «in Prüfung», `If-Match` Pflicht; fehlen Pflichtangaben: 422 mit `/kapitel/<nr>/<feld>` je Angabe; Aufgabe `vertrag.quality_check` an `vertrag:review`; nicht für eine Änderung (409) |
| `GET /v1/vertragsversionen/{id}/vergleich?mit=` | `projekt:read` | Unterschiede je Kapitel zu `mit` (Standard: Basisversion; PS.03.04): Felder alt/neu, Listeneinträge `neu`/`entfernt`/`geaendert` (gepaart über `registerId`, sonst Schlüssel), `differenz` bei Zahlen; Beträge nur mit `finanzen:read` |
| `GET /v1/vertragsversionen/{id}/hauptaenderungen` | `projekt:read` | Rubriken Scope, Zeitplan, Ressourcen/Budget, Annahmen, Key-Risiken mit erzeugten Sätzen (Budget je Phase alt und neu, nur mit `finanzen:read`) und Umformulierung `text`, dazu `andere`; `ETag` der Version |
| `PUT /v1/vertragsversionen/{id}/hauptaenderungen` | `vertrag:write` | Umformulierung je Rubrik (null = erzeugte Sätze) und `andere`, nur «in Arbeit», `If-Match` der Version; Ressourcen/Budget nur mit `finanzen:read` (403) |
| `GET /v1/vertragsversionen/{id}/aenderung` | `projekt:read` | Änderungsantrag (UC-007): Begründung, Baseline, `wirkung` (geänderte Kapitel mit Wirkung auf Scope, Budget, Ressourcen nach `kapitel_wirkung` → `prat`), `entscheid`, `can`; 404 für andere Anlässe |
| `POST /v1/vertragsversionen/{id}/aenderung/einreichen` | `vertrag:write` | «in Arbeit» → «in Prüfung» beim Sponsor (kein Quality-Check); Pflichtangaben der Phase (422), mindestens ein Kapitel geändert und ein Sponsor (409); Aufgabe `aenderung.entscheiden` an den SP |
| `POST /v1/vertragsversionen/{id}/aenderung/entscheiden` | `vertrag:decide` | `ergebnis` `freigegeben` (Baseline mit Register; mit Wirkung 409 `prat`), `an_prat` (Traktandum `aenderung` beim entscheidenden Gremium, nur mit Wirkung), `abgelehnt` (Begründung Pflicht); PL per Mitteilung informiert; `If-Match` |

Pflichtangaben im Phasenmodell nennen das Feld klein mit Unterstrich (`strategisches_ziel_id`), die Kapitel camelCase
(`strategischesZielId`). Ab dem Gate P1–P2 verlangen `personal` FTE mit Monaten (nicht Grösse S/M/L) und `kosten` einen
Betrag für jede Phase bis P4 (UC-003 A1). Obere Module nutzen `vertrag` aus `src/modules/vertrag/index.ts`:
`baselineSetzen(tx, who, versionId)` (Version abgenommen und verbindlich; Listen der Kapitel 3, 6, 7, 9, 10, 11 gehen
über `projektdaten.uebernehmen` ins Register, Termine und Budget als Baseline) und `entwurfsanlass.registrieren`.
Die Traktandenart `aenderung` (Ergebnisse «Freigegeben», «Abgelehnt») registriert `vertrag`; ihre Folge setzt die
Baseline bzw. lehnt den Entwurf ab und läuft in der Transaktion der UE mit `app.vertrag_intern` (200_vertrag_aenderung).

## Priorisierung

Bewertungsmodell mit Kriterien und Budgetrahmen, Bewertung der Projekte (docs/fachmodell.md 2.12, AP-E5-1; PP.01.02,
PP.01.03, PP.02.01; UC-008 Schritte 1–2, A1). Bewertung je Kriterium hoch/mittel/tief ohne Score (A-01); Budgetrahmen je
Portfolio optional (A-18).

| Route | Recht | Hinweis |
|---|---|---|
| `GET /v1/bewertungsmodelle`, `GET /v1/bewertungsmodelle/{id}`, `GET /v1/bewertungsmodelle/aktuell` | `priorisierung:read` | Versionen, neueste zuerst; `aktuell` = zuletzt in Kraft gesetzt (404 ohne); mit Kriterien, Budgetrahmen, Prüfbericht |
| `POST /v1/bewertungsmodelle` | `priorisierung:write` | Entwurf als Kopie des Modells in Kraft, beim ersten Mal mit den Kriterien aus UC-008 Schritt 2; höchstens ein Entwurf (409) |
| `PATCH /v1/bewertungsmodelle/{id}`, `DELETE …` | `priorisierung:write` | nur Entwurf (409), `If-Match`; Kriterien und Budgetrahmen als ganze Listen |
| `POST /v1/bewertungsmodelle/{id}/in-kraft-setzen` | `priorisierung:write` | mit Entscheid des Gremiums (`beschluss`), `If-Match`; Sperren des Prüfberichts → 422; danach unveränderlich |
| `GET /v1/portfolios/{id}/bewertungen?modell=` | `priorisierung:read` (Organisation oder Portfolio) | Raster aktive Projekte × Kriterien, Fortschritt; frühere Modellversion mit `modell` (G11) |
| `PUT /v1/portfolios/{id}/bewertungen` | `priorisierung:write` | mehrere Zellen, alles oder nichts, nach dem Modell in Kraft (409 ohne); bewertete Zelle nur mit `version` (412); `einschaetzung: null` entfernt |
| `GET /v1/portfolios/{id}/matrix` | `priorisierung:read` (Organisation oder Portfolio) | aktive Projekte mit Nutzen/Risiko je Achse (Durchschnitt hoch=3/mittel=2/tief=1 der zugeordneten Kriterien, A-39, ohne Score A-01), Feld (Q6 F9; Grenze = kein Feld), Ressourcen (FTE-Monate, Grösse), Kosten nur mit `finanzen:read`, Abhängigkeiten im Portfolio, Rang (PP.03.04) |
| `GET /v1/portfolios/{id}/rangfolge` | `priorisierung:read` (Organisation oder Portfolio) | Rangfolge entschieden und Entwurf mit Begründung; `ETag` = Version des Entwurfs (PP.02.02) |
| `PUT /v1/portfolios/{id}/rangfolge` | `priorisierung:write` | ganze Liste als Entwurf, `If-Match` (428/412); nur aktive Projekte des Portfolios, ohne Doppel (422) |

## Webhooks und Ereignisse

`GET`, `POST /v1/webhooks`, `DELETE /v1/webhooks/{id}` (Recht `webhook:admin`). Das Geheimnis (`whsec_…`) steht nur
in der Antwort des Anlegens; gespeichert ist es verschlüsselt. Ziel-Adressen prüft der SSRF-Schutz (keine privaten,
lokalen oder reservierten Netze, keine Weiterleitungen).

Ereignisse entstehen in derselben Transaktion wie die Änderung (Outbox) und werden als CloudEvent 1.0
(`application/cloudevents+json`) zugestellt; `source` = `<PUBLIC_BASE_URL>/organisationen/<alias>`.

| Typ | Wann |
|---|---|
| `ch.ppm.handlungsfeld.created` | Handlungsfeld angelegt |
| `ch.ppm.handlungsfeld.updated` | Handlungsfeld geändert |
| `ch.ppm.handlungsfeld.deleted` | Handlungsfeld gelöscht |
| `ch.ppm.phasenmodell.created` | Entwurf des Phasenmodells angelegt |
| `ch.ppm.phasenmodell.updated` | Entwurf geändert |
| `ch.ppm.phasenmodell.deleted` | Entwurf verworfen |
| `ch.ppm.phasenmodell.activated` | Version in Kraft gesetzt (mit `abgeloest`) |
| `ch.ppm.projekt.created`, `ch.ppm.projekt.updated` | Projekt angelegt bzw. geändert |
| `ch.ppm.projekt.organisation_changed` | Projektorganisation festgelegt |
| `ch.ppm.projekt.phase_changed` | Phase nachgeführt (Gate-Entscheid) |
| `ch.ppm.projekt.suspended`, `.resumed`, `.cancelled`, `.completed`, `.withdrawn` | Lebenszyklus: sistiert, wieder aufgenommen, abgebrochen, abgeschlossen, zurückgezogen |
| `ch.ppm.<register>.created`, `.updated`, `.deleted` | Eintrag eines Registers (`meilenstein`, `kosten`, `risiko`, `kpi`, `stakeholder`, `abhaengigkeit`, `ressourcenbedarf`); Kosten ohne Beträge |
| `ch.ppm.kpi_wert.recorded`, `ch.ppm.kpi_wert.deleted` | KPI-Wert einer Periode erfasst bzw. gelöscht |
| `ch.ppm.meldung.created` | ICT- bzw. Infrastrukturbedarf gemeldet (A-22) |
| `ch.ppm.zuteilung.created`, `.updated`, `.deleted` | Zuteilung einer Person zum Ressourcenbedarf (je Monat) |
| `ch.ppm.ressourcenbedarf.gap_reported`, `.gap_withdrawn` | Lücke gemeldet bzw. zurückgenommen (UC-009 A2) |
| `ch.ppm.<register>.created`, `.updated`, `.deleted` | Eintrag eines Registers (`meilenstein`, `kosten`, `risiko`, `kpi`, `stakeholder`, `abhaengigkeit`, `ressourcenbedarf`); Kosten ohne Beträge |
| `ch.ppm.kpi_wert.recorded`, `ch.ppm.kpi_wert.deleted` | KPI-Wert einer Periode erfasst bzw. gelöscht |
| `ch.ppm.meldung.created` | ICT- bzw. Infrastrukturbedarf gemeldet (A-22) |
| `ch.ppm.vertrag.drafted`, `.chapter_updated`, `.submitted`, `.baselined` | Projektvertrag: Entwurf angelegt, Kapitel gespeichert, zur Prüfung eingereicht, Version Baseline |
| `ch.ppm.meilenstein.baselined`, `.accepted`, `ch.ppm.kosten.baselined`, `.actuals_recorded`, `ch.ppm.ressourcenbedarf.coverage_changed` | Nachführung durch obere Module (Baseline, Abnahme, Ist-Kosten, Deckung) |
| `ch.ppm.sitzung.created`, `ch.ppm.sitzung.updated` | Sitzung angelegt bzw. Beginn, Dauer, Ort geändert |
| `ch.ppm.traktandum.scheduled`, `.unscheduled`, `.updated`, `.postponed`, `.invitations_changed` | Traktandum aufgenommen, entfernt, geändert, verschoben, Eingeladene geändert |
| `ch.ppm.sitzung.reordered` | Traktanden geordnet |
| `ch.ppm.sitzung.dispatched` | Unterlagen versendet (mit Vorlauf in Arbeitstagen und Frist eingehalten) |
| `ch.ppm.sitzung.started`, `ch.ppm.sitzung.closed` | Sitzung gestartet (Sitzungsmodus) bzw. geschlossen (mit Zahl der Folgevorschläge und Auflagen) |
| `ch.ppm.entscheid.recorded`, `.corrected`, `.sns_recorded` | Entscheid erfasst, bis zum Schliessen korrigiert, Entscheid des SNS-VR nachgetragen |
| `ch.ppm.auflage.fulfilled` | Auflage erledigt gemeldet |
| `ch.ppm.protokoll.updated`, `ch.ppm.protokoll.dispatched` | Protokoll bereinigt bzw. versendet (mit Arbeitstagen nach der Sitzung und Frist eingehalten) |

Abonniert wird mit dem Typ ohne Präfix (`handlungsfeld.created`) oder `*`. Zustellung mit Backoff bis
`WEBHOOK_MAX_ATTEMPTS`; Erfolg ist jede 2xx-Antwort.

Signatur nach [Standard Webhooks](https://www.standardwebhooks.com): Header `webhook-id`, `webhook-timestamp`,
`webhook-signature` = `v1,<base64(HMAC-SHA256(geheimnis, "<id>.<zeitstempel>.<body>"))>`. Prüfung beim Empfänger
(Node):

```js
import { createHmac, timingSafeEqual } from 'node:crypto';

function verify(secret, headers, body) {
  const id = headers['webhook-id'], ts = Number(headers['webhook-timestamp']);
  if (!id || Math.abs(Date.now() / 1000 - ts) > 300) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const want = Buffer.from(`v1,${createHmac('sha256', key).update(`${id}.${ts}.${body}`).digest('base64')}`);
  return headers['webhook-signature'].split(' ').some(s => s.length === want.length && timingSafeEqual(Buffer.from(s), want));
}
```
