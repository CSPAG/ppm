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
| `ppm:read` | `tenant:read`, `handlungsfeld:read` |
| `handlungsfeld:write` | `handlungsfeld:write`, `handlungsfeld:delete` |

`members:admin`, `access:admin` und `webhook:admin` stehen in keinem Scope. Das Modell hat Stufe «einfach» (nur Rollen
an der Organisation); Rollen der Projekte, Portfolios und Gremien und die Typen dazu kommen mit den Modulen, die sie
brauchen. Antworten tragen die Fähigkeiten der anfragenden Person (`can: { write, delete }`).

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
