# Konfiguration

Erzeugt von `npm run env:docs` aus [`src/platform/config/env.ts`](../src/platform/config/env.ts) – nicht von Hand
ändern. Geheimnisse (🔒) auch als `<NAME>_FILE` mit Pfad zu einer Datei (Docker/Kubernetes Secrets). Ungültige
Konfiguration beendet jeden Prozess mit allen Meldungen und Exit 78. Spalte «Dienste»: wer die Variable liest; nur
dieser Dienst bekommt das Geheimnis (docs/betrieb.md › Geheimnisse je Dienst).

## Allgemein

| Variable | Standard | Pflicht | Dienste | Beschreibung |
|---|---|---|---|---|
| `NODE_ENV` | `development` | – | alle | Betriebsmodus. In `production` gelten strengere Prüfungen (HTTPS, Geheimnisse, DPoP). Werte: `development`, `test`, `production`. |
| `PUBLIC_BASE_URL` | `http://localhost:8080` | in production | alle | Öffentliche Adresse der API und der Oberfläche, ohne abschliessenden Schrägstrich. Grundlage für Weiterleitungen und DPoP (`htu`). |
| `LOG_LEVEL` | `info` | – | alle | Stufe der Logs (JSON auf stdout). Werte: `fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent`. |

## Datenbank

| Variable | Standard | Pflicht | Dienste | Beschreibung |
|---|---|---|---|---|
| `DATABASE_URL` 🔒 | – | ja | api | Verbindung der Laufzeit (Rolle ohne BYPASSRLS, nicht Besitzerin der Tabellen). |
| `DATABASE_ADMIN_URL` 🔒 | – | – | nur Skripte | Verbindung für Migrationen (Besitzer-Rolle). |
| `DATABASE_WORKER_URL` 🔒 | – | – | worker | Verbindung des Workers. Ohne Angabe gilt `DATABASE_URL`; der Worker braucht nur eine der beiden. |
| `DATABASE_POOL_MAX` | `20` | – | alle | Maximale Verbindungen pro Prozess. |
| `DATABASE_STATEMENT_TIMEOUT` | `30s` | – | alle | Abbruch langer SQL-Anweisungen. |
| `DATABASE_SSL` | `disable` | – | alle | TLS zur Datenbank. In Produktion `verify-full`. Werte: `disable`, `require`, `verify-full`. |

## Anmeldung (Keycloak)

| Variable | Standard | Pflicht | Dienste | Beschreibung |
|---|---|---|---|---|
| `OIDC_ISSUER_URL` | – | ja | alle | Issuer des Realms. Endpunkte werden über Discovery ermittelt. |
| `OIDC_API_AUDIENCE` | `ppm-api` | – | alle | Erwartete Zielgruppe (`aud`) für Tokens der REST-API. |
| `OIDC_MCP_AUDIENCE` | `ppm-mcp` | – | alle | Erwartete Zielgruppe für Tokens des MCP-Dienstes. |
| `OIDC_CLOCK_TOLERANCE` | `30s` | – | alle | Toleranz für Uhrzeitabweichungen bei `exp`, `nbf`, `iat`. |
| `OIDC_BFF_CLIENT_ID` | `ppm-platform` | – | alle | Client der Oberfläche (BFF, vertraulich, Code-Flow mit PKCE). |
| `OIDC_BFF_CLIENT_SECRET` 🔒 | – | – | api | Geheimnis des BFF-Clients (nur übergangsweise; Warnung beim Start). In `production` Pflicht, ausser `OIDC_BFF_PRIVATE_KEY` ist gesetzt. |
| `OIDC_BFF_PRIVATE_KEY` 🔒 | – | – | api | Privater Schlüssel (PEM, PKCS#8) für `private_key_jwt` des BFF-Clients. Hat Vorrang vor dem Geheimnis. |
| `OIDC_SCOPES` | `openid profile email organization` | – | alle | Scopes bei der Anmeldung. `organization` liefert die Organisationen (als `organization:*`). |

## Mandanten und Rollen

| Variable | Standard | Pflicht | Dienste | Beschreibung |
|---|---|---|---|---|
| `TENANT_CLAIM` | `organization` | – | alle | Claim mit den Organisationen (Liste von Aliassen oder Objekt mit Aliassen als Schlüssel). |
| `TENANT_AUTO_PROVISION` | `false` | – | alle | Nur Entwicklung und Tests: unbekannte Organisation beim ersten Zugriff einer Person als Mandant anlegen (Maschinen-Clients nie). Sonst entstehen Mandanten nur ausdrücklich (Organisation erstellen, Plattform-Administration, `iam-org-bootstrap`). In Produktion nicht erlaubt. |
| `OIDC_PERSON_CLIENT_IDS` | – | – | alle | Clients (`azp`), deren Tokens als Person gelten. Leer = `OIDC_BFF_CLIENT_ID` und `MCP_CLIENT_ID`. Tokens aller anderen Clients gelten als Maschinen-Client (Freigabe je Mandant, Scopes). |
| `GROUPS_CLAIM` | `groups` | – | alle | Claim mit den Objekt-IDs der Gruppen aus Microsoft Entra ID (Subjekte `group:<id>`). |
| `PLATFORM_ADMIN_ROLE` | `platform-admin` | – | alle | Realm-Rolle für die Plattform-Administration über alle Mandanten. Braucht keine Mitgliedschaft in einer Organisation und gibt in einer Organisation keine Rechte. |

## Konto und Selbstregistrierung

| Variable | Standard | Pflicht | Dienste | Beschreibung |
|---|---|---|---|---|
| `SELF_SERVICE_SIGNUP` | `false` | – | alle | Personen ohne Konto registrieren sich mit ihrer E-Mail (`POST /v1/signup`). Braucht die Verwaltung (`KEYCLOAK_MGMT_CLIENT_ID`). |
| `SELF_SERVICE_ORGS` | `false` | – | alle | Angemeldete Personen mit bestätigter E-Mail erstellen eigene Organisationen (`POST /v1/me/organizations`) und werden dort org-admin. Braucht die Verwaltung. |
| `SELF_SERVICE_ORG_LIMIT` | `3` | – | alle | Höchstzahl selbst erstellter Organisationen je Konto (1 bis 100). |
| `RESERVED_ALIASES` | `admin,administrator,api,app,auth,help,hilfe,mail,ops,platform,plattform,root,security,signup,support,system,www` | – | alle | Aliasse, die niemand selbst erstellen kann (zusätzlich das Produkt). Die Plattform-Administration darf sie vergeben. |

## Verwaltung von Organisationen und Mitgliedern

| Variable | Standard | Pflicht | Dienste | Beschreibung |
|---|---|---|---|---|
| `KEYCLOAK_MGMT_CLIENT_ID` | – | – | api | Vertraulicher Client mit Service Account (`ppm-admin`). Ohne Angabe ist die Verwaltung von Organisationen, Mitgliedern und Rollen abgeschaltet. |
| `KEYCLOAK_MGMT_PRIVATE_KEY` 🔒 | – | – | api | Privater Schlüssel (PEM, PKCS#8, EC P-256 oder RSA) für `private_key_jwt` des Verwaltungs-Clients. Hat Vorrang vor dem Geheimnis. |
| `KEYCLOAK_MGMT_CLIENT_SECRET` 🔒 | – | – | api | Geheimnis des Verwaltungs-Clients (nur übergangsweise; Warnung beim Start). |
| `KEYCLOAK_MGMT_URL` | – | – | alle | Adresse der Admin-API des Realms, falls sie nicht aus `OIDC_ISSUER_URL` folgt (`…/realms/<realm>` → `…/admin/realms/<realm>`). |
| `KEYCLOAK_MGMT_INVITE_LIFESPAN` | `72h` | – | alle | Gültigkeit des Links in der Einladung («Passwort festlegen»). 1h bis 30d. |
| `KEYCLOAK_MGMT_INVITE_MIN_TIME` | `2s` | – | alle | Mindestdauer der Antwort auf Einladen, Zurückziehen und erneut Senden: neues und bestehendes Konto sind so auch an der Antwortzeit nicht zu unterscheiden. 0 = aus. |
| `KEYCLOAK_MGMT_TIMEOUT` | `10s` | – | alle | Zeitlimit je Aufruf der Admin-API. |
| `KEYCLOAK_SYNC_CLIENT_ID` | – | – | worker | Eigener Client mit Service Account für den Abgleich der Mitglieder im Worker (`ppm-sync`). Ohne Angabe kein Abgleich im Worker. |
| `KEYCLOAK_SYNC_PRIVATE_KEY` 🔒 | – | – | worker | Privater Schlüssel (PEM, PKCS#8) für `private_key_jwt` des Abgleich-Clients; nicht der des Verwaltungs-Clients. |
| `KEYCLOAK_SYNC_CLIENT_SECRET` 🔒 | – | – | worker | Geheimnis des Abgleich-Clients (nur übergangsweise; Warnung beim Start). |
| `MEMBER_SYNC_INTERVAL` | `1h` | – | alle | Abstand der Abgleiche aller Mandanten im Worker; höchstens ein Lauf über alle Instanzen. `0` = aus, sonst mindestens 1m. |

## Anmeldung über Microsoft Entra ID

| Variable | Standard | Pflicht | Dienste | Beschreibung |
|---|---|---|---|---|
| `ENTRA_CLIENT_ID` | – | – | alle | Anwendungs-ID der mandantenfähigen App der Plattform in Microsoft Entra ID (Zustimmung der Kunden). Optional: Ohne Angabe verbinden Organisationen nur mit einer eigenen App in ihrem Tenant (braucht `ENCRYPTION_KEYS`). Braucht die Verwaltung (`KEYCLOAK_MGMT_CLIENT_ID`). |
| `ENTRA_CLIENT_SECRET` 🔒 | – | – | api | Geheimnis der Entra-App (Tokens für Microsoft Graph, Identitätsanbieter in Keycloak). |
| `ENTRA_IDP_SLOTS` | `100` | – | alle | Anzahl der in der Entra-App eingetragenen Redirect-URIs `…/broker/entra-001/endpoint` bis `…/entra-<n>/endpoint`. 1 bis 250. |
| `ENTRA_UI_PATH` | `/verwalten/anmeldung` | – | alle | Seite «Anmeldung» der Oberfläche (`paths.entra` in `@vollholz/iam-web`). Rückkehr nach der Admin-Zustimmung: `<pfad>/zustimmung` (als Redirect-URI in der Entra-App eingetragen), nach der Testanmeldung: `<pfad>/test`. |
| `ENTRA_TIMEOUT` | `10s` | – | alle | Zeitlimit je Aufruf bei Microsoft (Anmeldung, Graph). |

## Maschinenzugriff (M2M)

| Variable | Standard | Pflicht | Dienste | Beschreibung |
|---|---|---|---|---|
| `DPOP_MODE` | `required-for-clients` | – | alle | DPoP-Pflicht. `required-for-clients`: Maschinen-Clients müssen sendergebundene Tokens verwenden, Personen (über BFF) nicht. Werte: `off`, `optional`, `required-for-clients`, `required`. |
| `DPOP_MAX_AGE` | `300s` | – | alle | Maximales Alter eines DPoP-Proofs (`iat`). |
| `MTLS_HEADER` | – | – | alle | Header, in dem der Proxy das Client-Zertifikat weitergibt (PEM, auch URL-kodiert, oder DER als base64); der Proxy muss ihn immer setzen bzw. überschreiben. Aktiviert mTLS-gebundene Tokens (RFC 8705). |

## Sitzung (Oberfläche)

| Variable | Standard | Pflicht | Dienste | Beschreibung |
|---|---|---|---|---|
| `SESSION_SECRET` 🔒 | – | in production | api | Schlüssel für Sitzungs-Cookies (mind. 32 Zeichen). Mehrere kommagetrennt für Rotation, der erste signiert. |
| `SESSION_TTL` | `8h` | – | alle | Maximale Dauer einer Sitzung. |
| `SESSION_IDLE_TIMEOUT` | `60m` | – | alle | Abmeldung nach Inaktivität. |

## Verschlüsselung

| Variable | Standard | Pflicht | Dienste | Beschreibung |
|---|---|---|---|---|
| `ENCRYPTION_KEYS` 🔒 | – | in production | api, worker | Hauptschlüssel (Sitzungen, Geheimnisse der App, Geheimnisse eigener Entra-Apps). Format `id:base64(32 Bytes)`, mehrere kommagetrennt; der erste verschlüsselt. |

## MCP

| Variable | Standard | Pflicht | Dienste | Beschreibung |
|---|---|---|---|---|
| `MCP_PUBLIC_URL` | `http://localhost:8081/mcp` | in production | mcp | Öffentliche Adresse des MCP-Endpunkts inkl. `/mcp` (Resource Identifier nach RFC 9728, `htu` bei DPoP). |
| `MCP_API_URL` | `http://localhost:8080` | – | alle | Interne Adresse der REST-API, die der MCP-Dienst aufruft. |
| `MCP_CLIENT_ID` | `ppm-mcp` | – | alle | Client des MCP-Dienstes für Token Exchange (RFC 8693). |
| `MCP_HOST_CLIENT_IDS` | `ppm-mcp-cli` | – | alle | Clients (`azp`), über die sich Personen in MCP-Hosts anmelden. Nur deren Tokens tauscht der MCP-Dienst; andere Tokens mit der Zielgruppe `OIDC_MCP_AUDIENCE` weist er mit 403 ab. |
| `MCP_CLIENT_SECRET` 🔒 | – | – | mcp | Geheimnis des MCP-Clients (nur übergangsweise; Warnung beim Start). Alternativ `MCP_PRIVATE_KEY`. |
| `MCP_PRIVATE_KEY` 🔒 | – | – | mcp | Privater Schlüssel (PEM) für `private_key_jwt` des MCP-Clients. |
| `MCP_DPOP_KEY` 🔒 | – | – | mcp | Privater Schlüssel (PEM, EC P-256) für DPoP der getauschten API-Tokens. Ohne Angabe erzeugt jede Instanz beim Start einen eigenen. |
| `MCP_HOST` | `0.0.0.0` | – | mcp | Adresse, an der der MCP-Dienst lauscht. |
| `MCP_PORT` | `8081` | – | mcp | Port des MCP-Dienstes (Streamable HTTP unter `/mcp`). |

## Betrieb

| Variable | Standard | Pflicht | Dienste | Beschreibung |
|---|---|---|---|---|
| `SHARED_STATE` | `postgres` | – | alle | Speicher für Replay-Schutz (DPoP, Logout-Tokens) und Rate-Limit. `postgres`: geteilt über alle Instanzen (Pflicht bei mehr als einer Instanz). `memory`: nur im Prozess. Werte: `postgres`, `memory`. |
| `RATE_LIMIT_NAMESPACE` | – | – | alle | Vorsatz der Rate-Limit-Schlüssel des Pakets (`<namespace>:<produkt>:…`), wenn mehrere Umgebungen denselben geteilten Speicher nutzen (z. B. E2E und lokale App mit SHARED_STATE=postgres). Buchstaben, Ziffern, `_`, `-`, `.`; leer: kein Vorsatz. |
| `OPS_HOST` | `0.0.0.0` | – | alle | Adresse des Betriebs-Endpunkts. |
| `OPS_PORT` | `9090` | – | alle | Port des Betriebs-Endpunkts (`/healthz`, `/readyz`, `/metrics`) jedes Prozesses. |
| `METRICS_ENABLED` | `false` | – | alle | Metriken im Prometheus-Format unter `/metrics` des Betriebs-Endpunkts. |
| `SHUTDOWN_DELAY` | `5s` | – | alle | Wartezeit nach SIGTERM mit `/readyz` 503, bevor der Server schliesst (Load Balancer nimmt die Instanz heraus). |
| `SHUTDOWN_TIMEOUT` | `20s` | – | alle | Höchstdauer des geordneten Beendens; danach Exit 1. |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | – | – | alle | OTLP/HTTP-Empfänger für Traces und Metriken (z. B. `http://otel-collector:4318`). Ohne Angabe keine Traces. |
| `OTEL_SERVICE_NAMESPACE` | `ppm` | – | alle | Namensraum der Dienste in der Telemetrie (`service.namespace`); `service.name` ist `ppm-<dienst>`. |

## HTTP

| Variable | Standard | Pflicht | Dienste | Beschreibung |
|---|---|---|---|---|
| `HTTP_HOST` | `0.0.0.0` | – | api | Adresse, an der die API lauscht. |
| `HTTP_PORT` | `8080` | – | api | Port der API (REST, BFF, Webapp). |
| `TRUST_PROXY` | `false` | – | alle | Vertrauen in `X-Forwarded-*`: `false`, `true`, Anzahl der Proxys oder Liste von Adressen/Netzen. Hinter Caddy bzw. Ingress `1`. |
| `BODY_LIMIT` | `1048576` | – | alle | Grösste Anfrage in Bytes. |
| `RATE_LIMIT_MAX` | `600` | – | alle | Anfragen je Zeitfenster und Principal in der Organisation (ohne Anmeldung je IP). Die Oberfläche (Sitzung) ist nie begrenzt. |
| `RATE_LIMIT_WINDOW` | `1m` | – | alle | Zeitfenster des Rate-Limits. |
| `IDEMPOTENCY_TTL` | `24h` | – | alle | Aufbewahrung gespeicherter Antworten zu `Idempotency-Key`. |
| `WEB_DIST_DIR` | `web/dist` | – | api | Verzeichnis des Builds der Webapp (relativ zur Wurzel oder absolut). |

## Worker

| Variable | Standard | Pflicht | Dienste | Beschreibung |
|---|---|---|---|---|
| `WORKER_CONCURRENCY` | `4` | – | worker | Gleichzeitige Jobs je Worker-Instanz. |
| `WORKER_TENANT_LIMIT` | `2` | – | worker | Höchstens so viele laufende Jobs je Organisation über alle Instanzen. |
| `WORKER_POLL_INTERVAL` | `1s` | – | worker | Abstand der Abfragen der Warteschlange, wenn nichts fällig war. |
| `JOB_RETENTION` | `14d` | – | worker | Aufbewahrung erledigter und endgültig gescheiterter Jobs sowie verteilter Ereignisse der Outbox. |
| `WEBHOOK_TIMEOUT` | `10s` | – | worker | Feste Gesamtfrist je Zustellung eines Webhooks (Verbindung, Senden, Antwort). |
| `WEBHOOK_MAX_RESPONSE_BYTES` | `65536` | – | worker | Grösste gelesene Antwort eines Webhook-Empfängers; danach Abbruch. |
| `WEBHOOK_ALLOW_PRIVATE` | `false` | – | alle | Nur Entwicklung und Tests: Webhooks an private und lokale Adressen erlauben (SSRF-Schutz aus). In Produktion verboten. |
