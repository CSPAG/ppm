# REST-API

Die API liegt unter `/v1` und ist mit OpenAPI 3.1 beschrieben: **`/v1/openapi.json`** (maschinenlesbar) und
**`/v1/docs`** (Swagger UI mit strenger CSP, ohne «Try it out»). Der Export für die Webapp liegt in
[`web/openapi.json`](../web/openapi.json) (`npm run openapi:export`, in CI geprüft). Jede Route nennt genau einen Tag
(`API_TAGS` in [`src/platform/http/app.ts`](../src/platform/http/app.ts) und die Tags des Baukastens).

Die Konventionen sind für alle Module verbindlich; das Beispielmodul `projekt` zeigt jede einmal
([`modules/projekt/routes.ts`](../src/platform/modules/projekt/routes.ts)), die Bausteine liegen in
[`http/route-kit.ts`](../src/platform/http/route-kit.ts).

## Konventionen

| Thema | Regel |
|---|---|
| Version | Pfad `/v1`; brechende Änderungen nur mit neuer Version oder Ankündigung (unten) |
| Inhalt | JSON; unbekannte Felder ergeben 422 (kein stilles Entfernen) |
| Listen | Cursor-Paginierung: Parameter `cursor` und `limit` (1–200, Standard 50), Antwort `{ "items": [...], "next": "<cursor>" \| null }`. Der Cursor gilt nur für dieselbe Abfrage (z. B. denselben Suchbegriff `q`) |
| Fassung | Einzelne Ressourcen tragen `version` und den Header `ETag: W/"<version>"` |
| Ändern, Löschen | Header `If-Match` mit dem ETag der gelesenen Fassung: ohne → **428**, veraltet → **412** mit `currentVersion` im Body |
| Idempotenz | `Idempotency-Key` (1–255 Zeichen) bei allen schreibenden Aufrufen (`POST`, `PUT`, `PATCH`, `DELETE`): Wiederholung mit gleichem Inhalt liefert die gespeicherte Antwort mit `Idempotency-Replayed: true`; anderer Inhalt mit demselben Schlüssel oder eine noch laufende erste Anfrage → **409**. Schlüssel je Principal in der Organisation, `IDEMPOTENCY_TTL` (24 h) lang; Antworten ≥ 500 werden nicht gespeichert |
| Fehler | immer `application/problem+json` (RFC 9457) mit `type` = `<PUBLIC_BASE_URL>/probleme/<status>`, `title`, `status`, `detail` |
| Validierung | **422** mit `errors: [{ "path": "/ende", "message": "…" }]` (JSON-Pointer); Invarianten über mehrere Felder prüft die API vor dem Schreiben, bei `PATCH` gegen den zusammengeführten Stand |
| Datenbankfehler | `23505`/`23503` → 409, `42501` → 403 (mit Warnung im Log), sonst 500 mit Referenz (Request-ID im `detail`, ohne Interna) |
| Rechte | 401 ohne gültige Anmeldung, 403 ohne Recht; fremde oder nicht lesbare Ressourcen → **404** (nie 403 mit Inhalt). Klassifizierte Einträge über der eigenen Freigabestufe innerhalb der eigenen Organisation → 403 ohne Inhalt |
| Fähigkeiten | Ressourcen tragen `can` (z. B. `{ "write": true, "delete": false }`), damit Clients Knöpfe nicht raten |
| Lange Läufe | **202** mit `Location: /v1/vorgaenge/{id}`; der Vorgang zeigt `status` (`queued`, `running`, `done`, `failed`), `result`, `error`; solange er läuft, mit `Retry-After: 2`. Sichtbar nur für die Person bzw. den Client, die ihn ausgelöst haben |
| Aktionen | `POST /v1/<sammlung>:aktion` bzw. `POST /v1/<sammlung>/{id}:aktion` (Doppelpunkt, kein Verb im Pfad), z. B. `POST /v1/projekte:zusammenfassen` |
| Wegfall | Vor dem Entfernen einer Route oder eines Felds: Header `Deprecation` und `Sunset` (RFC 9745, RFC 8594), in der OpenAPI `deprecated: true`. Derzeit ist nichts abgekündigt |
| Rate-Limit | `RATE_LIMIT_MAX` je `RATE_LIMIT_WINDOW` und Principal in der Organisation (ohne Anmeldung je IP), 429 mit `Retry-After`; die Oberfläche (Sitzung) ist nicht begrenzt |
| Korrelation | `X-Request-ID` wird übernommen (bis 128 Zeichen `[\w.:-]`) oder neu gesetzt und in jeder Antwort zurückgegeben |
| CSP | Antworten der API mit `default-src 'none'; frame-ancestors 'none'; …` |

## Anmeldung

Alles kommt aus `@vollholz/iam` (Plugin in [`http/app.ts`](../src/platform/http/app.ts)); die Zugänge unterscheiden
sich nur in der Anmeldung, nicht in den Rechten.

| Zugang | Anmeldung | Organisation |
|---|---|---|
| Oberfläche | BFF unter `/auth/*` (OIDC Code-Flow mit PKCE, Client `ppm-platform`); Sitzungs-Cookie `HttpOnly`, `Secure`, `SameSite=Lax`. Schreibende Aufrufe brauchen `X-CSRF-Token` (aus `/auth/me`), sonst 403 | `X-Tenant` je Tab, Wechsel ausdrücklich |
| Maschinen-Client | Token aus Client Credentials (Zielgruppe `ppm-api`), **DPoP** Pflicht (`DPOP_MODE=required-for-clients`): `Authorization: DPoP <token>` mit Proof im Header `DPoP`; alternativ mTLS-gebunden (`MTLS_HEADER`) mit `Authorization: Bearer <token>` | Freigabe des Clients in der Organisation mit Rollen und Freigabestufe (`PUT /v1/admin/clients/{clientId}`) |
| MCP-Dienst | getauschtes, DPoP-gebundenes Token (RFC 8693) im Namen der Person ([mcp.md](mcp.md)) | je Werkzeugaufruf |

Effektiv gilt **Rolle ∩ Scope**: Ein Client mit Rolle `editor` und nur Scope `ppm:read` liest, ändert aber nicht.
Scopes: `ppm:read` (`tenant:read`, `projekt:read`), `projekt:write` (`projekt:write`, `projekt:delete`).
`webhook:admin`, `members:admin` und `access:admin` stehen in keinem Scope (nur Personen). Rollen und Rechte:
[zielarchitektur.md › Bausteine](zielarchitektur.md#bausteine), Katalog zur Laufzeit unter `GET /v1/authz/catalog`.

## Routen der App

### Projekte (Beispielmodul)

| Methode und Pfad | Recht | Hinweise |
|---|---|---|
| `GET /v1/projekte?q=&cursor=&limit=` | `projekt:read` (irgendwo) | nur lesbare Projekte (Lesesicht), sortiert nach Bezeichnung |
| `POST /v1/projekte` | `projekt:write`, Freigabestufe ≥ `classification` | `Idempotency-Key`; 201 mit `Location`, `ETag` |
| `GET /v1/projekte/{id}` | `projekt:read` am Projekt | `ETag` |
| `PATCH /v1/projekte/{id}` | `projekt:write` am Projekt | `If-Match` Pflicht; Beginn und Ende nur gemeinsam, Ende nicht vor Beginn (422) |
| `DELETE /v1/projekte/{id}` | `projekt:delete` am Projekt | `If-Match` Pflicht; 204 |
| `GET /v1/projekte/{id}/history` | `projekt:read` am Projekt | alle Fassungen, auch nach dem Löschen |
| `POST /v1/projekte:zusammenfassen` | `projekt:read` | langer Lauf (Job `projekt.summary`): 202 mit `Location` |
| `GET /v1/vorgaenge/{id}` | Auslöser des Vorgangs | Zustand und Ergebnis langer Läufe |

Felder eines Projekts: `id`, `label`, `beschreibung`, `beginn`, `ende` (Datum), `classification` (0 intern,
1 vertraulich, 2 streng vertraulich), `version`, `createdAt`, `updatedAt`, `can`. Jede Änderung
schreibt einen Audit-Eintrag (`projekt.created|updated|deleted`, bei neuer Klassifizierung zusätzlich
`object.classified`) und ein Ereignis in die Outbox.

### Webhooks (Profil outbox)

Nur Personen mit `webhook:admin` (`org-admin`).

| Methode und Pfad | Hinweise |
|---|---|
| `GET /v1/webhooks` | alle Webhooks der Organisation |
| `POST /v1/webhooks` | `{ url, description?, events }`; Antwort 201 mit `{ webhook, secret }` – das Geheimnis (`whsec_…`) gibt es **nur hier** (`Cache-Control: no-store`). Adressen prüft der SSRF-Schutz (422 mit Pfad `/url`) |
| `GET /v1/webhooks/{id}` | `ETag` |
| `PATCH /v1/webhooks/{id}` | `If-Match`; `url`, `description`, `events`, `active` |
| `DELETE /v1/webhooks/{id}` | `If-Match`; 204 |
| `GET /v1/webhooks/{id}/deliveries` | letzte Zustellungen mit Status, Versuchen, Antwortcode, Fehler |

`events` sind Ereignistypen wie `projekt.created` oder `*`. Zugestellt wird jedes Ereignis als **CloudEvent 1.0**
([`core/events.ts`](../src/platform/core/events.ts)):

```json
{
  "specversion": "1.0",
  "id": "<uuid des Ereignisses>",
  "source": "/ppm/<ui|api|mcp|worker|system>",
  "type": "ch.project-suite.ppm.projekt.updated",
  "subject": "projekt/<id>",
  "time": "2026-10-26T14:30:00.000Z",
  "datacontenttype": "application/json",
  "data": { "id": "…", "label": "…", "version": 2, "classification": 0 },
  "tenant": "<id der Organisation>"
}
```

Signiert nach **Standard Webhooks** ([`modules/webhooks/sign.ts`](../src/platform/modules/webhooks/sign.ts)):
Header `webhook-id` (= CloudEvent-`id`), `webhook-timestamp` (Unix-Sekunden), `webhook-signature: v1,<base64>`.

**Signatur prüfen** (Empfänger): HMAC-SHA256 mit dem Geheimnis (Base64 nach `whsec_`) über
`<webhook-id>.<webhook-timestamp>.<roher Body>`, Base64, mit jedem Eintrag in `webhook-signature` (durch Leerzeichen
getrennt) in konstanter Zeit vergleichen; Zeitstempel höchstens 5 Minuten alt. Die Bibliotheken von
standardwebhooks.com tun genau das; Vorlage: `verify()` in `sign.ts`. `webhook-id` dient dem Empfänger zum
Entdoppeln, denn Zustellungen können wiederholt werden.

Zustellung im Worker: feste Gesamtfrist `WEBHOOK_TIMEOUT` (10 s), Antwort höchstens `WEBHOOK_MAX_RESPONSE_BYTES`,
keine Weiterleitungen, keine privaten Adressen; jeder Status ausserhalb 2xx gilt als Fehler. Bis zu 8 Versuche mit
exponentiellem Backoff, danach `failed`.

## Routen des Baukastens

`@vollholz/iam` bringt eigene Routen mit eigenen Tags mit (Beschreibung: identity-kit
[`packages/iam/docs/backend.md`](https://github.com/vollholz/identity-kit/blob/main/packages/iam/docs/backend.md) › 5):

| Bereich | Routen |
|---|---|
| Konto | `GET /v1/me`, `GET /v1/authz/catalog`, `GET /v1/account`, `POST /v1/account/organizations`, `POST /v1/signup` |
| Zugriff | `/v1/access…` (Wer hat Zugriff?, Warum?, freigeben, Ablauf, entfernen), `POST/DELETE /v1/break-glass` |
| Verwaltung | `/v1/admin/status`, `/v1/admin/members…`, `/v1/admin/clients…`, `/v1/admin/entra…` |
| Plattform | `/v1/platform/organizations…` (nur `platform-admin`) |
| Personen | `GET /v1/people`, `GET /v1/people/{id}` |
| BFF | `/auth/login`, `/auth/callback`, `/auth/me`, `/auth/logout` u. a. |
| Betrieb | `GET /v1/health` (öffentlich) |

Ein Beispielaufruf eines Maschinen-Clients (Token mit DPoP aus Keycloak, `ppm:read`):

```http
GET /v1/projekte?limit=20 HTTP/1.1
Host: ppm.project-suite.ch
Authorization: DPoP eyJhbGciOi…
DPoP: eyJ0eXAiOiJkcG9wK2p3dCIs…
```
