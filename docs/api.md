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
(Arbeitstage ohne Wochenende und Feiertage der Organisation, A-43), `plusArbeitstage`, `arbeitstageBis`.

## Projekte

Projekte mit Nummer «JJJJ-NNN» (A-47), Portfolio, Phase und Lebenszyklus, Projektorganisation mit Sponsor,
Sponsoren-Koalition, Projektleitung, CTL und Kernteam (BC PP.04.04, UC-002 Schritt 2, UC-014 A1). Lesen nach Rolle an der
Organisation, am Portfolio oder am Projekt; «vertraulich» nur für Projektrollen, UE und Gremium (A-34). Endzustände
(`abgebrochen`, `abgeschlossen`, `zurueckgezogen`) sind lesend (409). Fähigkeiten: `can: { write, organisation }`.

| Methode und Pfad | Recht | Hinweis |
|---|---|---|
| `GET /v1/projekte?rolle=&portfolio=&phase=&lebenszyklus=&nummer=&q=&cursor=&limit=` | `projekt:read` irgendwo | sortiert nach Nummer; `rolle` = eigene Funktion (`sp`, `pl`, `ctl`, `kt`, `koalition`), `portfolio` = Schlüssel |
| `GET /v1/projekte/kopf` | `projekt:read` irgendwo | laufende Projekte mit eigener Funktion (Kopfkarte im Eingang) |
| `POST /v1/projekte` | `projekt:create` an org oder am Portfolio | Nummer fortlaufend je Jahr der Anlage, Phase ohne Angabe P0 |
| `GET /v1/projekte/{id}` | `projekt:read` | `ETag` |
| `PATCH /v1/projekte/{id}` | `projekt:write` | Name, Federführung, Handlungsfeld, «vertraulich»; `If-Match` Pflicht |
| `GET /v1/projekte/{id}/organisation` | `projekt:read` | `ETag` = Stand der Projektorganisation |
| `PUT /v1/projekte/{id}/organisation` | `projekt:organisation` | ersetzt die Liste; setzt bzw. entzieht die Rollen `sp`, `pl`, `ctl`, `kt` als Tupel am Projekt; `If-Match` Pflicht |

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
| `ch.ppm.sitzung.created`, `ch.ppm.sitzung.updated` | Sitzung angelegt bzw. Beginn, Dauer, Ort geändert |
| `ch.ppm.traktandum.scheduled`, `.unscheduled`, `.updated`, `.postponed`, `.invitations_changed` | Traktandum aufgenommen, entfernt, geändert, verschoben, Eingeladene geändert |
| `ch.ppm.sitzung.reordered` | Traktanden geordnet |
| `ch.ppm.sitzung.dispatched` | Unterlagen versendet (mit Vorlauf in Arbeitstagen und Frist eingehalten) |

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
