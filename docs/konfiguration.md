# Konfiguration

> Erzeugt von `npm run env:docs` – nicht von Hand ändern.

Nur Umgebungsvariablen. Geheimnisse mit `_FILE` auch als Datei (Docker/Kubernetes Secrets). Bei ungültiger
Konfiguration endet jeder Prozess mit allen Meldungen zugleich und Exit-Code 78. «Dienste»: welcher Prozess den
Wert liest und nur dann verlangt (Geheimnisse je Dienst: [betrieb.md](betrieb.md#geheimnisse-je-dienst)).

## Allgemein

| Variable | Typ | Standard | Pflicht | Dienste | Beschreibung |
|---|---|---|---|---|---|
| `NODE_ENV` | `development` \| `test` \| `production` | `development` | – | alle | Betriebsmodus. In `production` gelten strengere Prüfungen (HTTPS, Geheimnisse, DPoP). |
| `PUBLIC_BASE_URL` | url | `http://localhost:8080` | production | alle | Öffentliche Adresse der API und der Oberfläche, ohne abschliessenden Schrägstrich. Grundlage für Weiterleitungen und DPoP (`htu`). |
| `LOG_LEVEL` | `fatal` \| `error` \| `warn` \| `info` \| `debug` \| `trace` \| `silent` | `info` | – | alle | Detailgrad der Logs (JSON auf stdout). |

## Datenbank

| Variable | Typ | Standard | Pflicht | Dienste | Beschreibung |
|---|---|---|---|---|---|
| `DATABASE_URL` | url | – | immer | api | Verbindung der Laufzeit (Rolle ohne BYPASSRLS, nicht Besitzerin der Tabellen). (geheim, `_FILE`) |
| `DATABASE_ADMIN_URL` | url | – | – | alle | Verbindung für Migrationen (Besitzer-Rolle). (geheim, `_FILE`) |
| `DATABASE_WORKER_URL` | url | – | – | alle | Verbindung des Workers. Ohne Angabe gilt `DATABASE_URL`; der Worker braucht nur eine der beiden. (geheim, `_FILE`) |
| `DATABASE_POOL_MAX` | int | `20` | – | alle | Maximale Verbindungen pro Prozess. |
| `DATABASE_STATEMENT_TIMEOUT` | duration | `30s` | – | alle | Abbruch langer SQL-Anweisungen. |
| `DATABASE_SSL` | `disable` \| `require` \| `verify-full` | `disable` | – | alle | TLS zur Datenbank. In Produktion `verify-full`. |

## Anmeldung (Keycloak)

| Variable | Typ | Standard | Pflicht | Dienste | Beschreibung |
|---|---|---|---|---|---|
| `OIDC_ISSUER_URL` | url | – | immer | alle | Issuer des Realms. Endpunkte werden über Discovery ermittelt. |
| `OIDC_API_AUDIENCE` | string | `ppm-api` | – | alle | Erwartete Zielgruppe (`aud`) für Tokens der REST-API. |
| `OIDC_MCP_AUDIENCE` | string | `ppm-mcp` | – | alle | Erwartete Zielgruppe für Tokens des MCP-Dienstes. |
| `OIDC_CLOCK_TOLERANCE` | duration | `30s` | – | alle | Toleranz für Uhrzeitabweichungen bei `exp`, `nbf`, `iat`. |
| `OIDC_BFF_CLIENT_ID` | string | `ppm-platform` | – | alle | Client der Oberfläche (BFF, vertraulich, Code-Flow mit PKCE). |
| `OIDC_BFF_CLIENT_SECRET` | string | – | – | alle | Geheimnis des BFF-Clients (nur übergangsweise; Warnung beim Start). In `production` Pflicht, ausser `OIDC_BFF_PRIVATE_KEY` ist gesetzt. (geheim, `_FILE`) |
| `OIDC_BFF_PRIVATE_KEY` | string | – | – | alle | Privater Schlüssel (PEM, PKCS#8) für `private_key_jwt` des BFF-Clients. Hat Vorrang vor dem Geheimnis. (geheim, `_FILE`) |
| `OIDC_SCOPES` | string | `openid profile email organization` | – | alle | Scopes bei der Anmeldung. `organization` liefert die Organisationen (als `organization:*`). |

## Mandanten und Rollen

| Variable | Typ | Standard | Pflicht | Dienste | Beschreibung |
|---|---|---|---|---|---|
| `TENANT_CLAIM` | string | `organization` | – | alle | Claim mit den Organisationen (Liste von Aliassen oder Objekt mit Aliassen als Schlüssel). |
| `TENANT_AUTO_PROVISION` | bool | `false` | – | alle | Nur Entwicklung und Tests: unbekannte Organisation beim ersten Zugriff einer Person als Mandant anlegen (Maschinen-Clients nie). Sonst entstehen Mandanten nur ausdrücklich (Organisation erstellen, Plattform-Administration, `iam-org-bootstrap`). In Produktion nicht erlaubt. |
| `OIDC_PERSON_CLIENT_IDS` | list | – | – | alle | Clients (`azp`), deren Tokens als Person gelten. Leer = `OIDC_BFF_CLIENT_ID` und `MCP_CLIENT_ID`. Tokens aller anderen Clients gelten als Maschinen-Client (Freigabe je Mandant, Scopes). |
| `GROUPS_CLAIM` | string | `groups` | – | alle | Claim mit den Objekt-IDs der Gruppen aus Microsoft Entra ID (Subjekte `group:<id>`). |
| `PLATFORM_ADMIN_ROLE` | string | `platform-admin` | – | alle | Realm-Rolle für die Plattform-Administration über alle Mandanten. Braucht keine Mitgliedschaft in einer Organisation und gibt in einer Organisation keine Rechte. |

## Konto und Selbstregistrierung

| Variable | Typ | Standard | Pflicht | Dienste | Beschreibung |
|---|---|---|---|---|---|
| `SELF_SERVICE_SIGNUP` | bool | `false` | – | alle | Personen ohne Konto registrieren sich mit ihrer E-Mail (`POST /v1/signup`). Braucht die Verwaltung (`KEYCLOAK_MGMT_CLIENT_ID`). |
| `SELF_SERVICE_ORGS` | bool | `false` | – | alle | Angemeldete Personen mit bestätigter E-Mail erstellen eigene Organisationen (`POST /v1/me/organizations`) und werden dort org-admin. Braucht die Verwaltung. |
| `SELF_SERVICE_ORG_LIMIT` | int | `3` | – | alle | Höchstzahl selbst erstellter Organisationen je Konto (1 bis 100). |
| `RESERVED_ALIASES` | list | `admin,administrator,api,app,auth,help,hilfe,mail,ops,platform,plattform,root,security,signup,support,system,www` | – | alle | Aliasse, die niemand selbst erstellen kann (zusätzlich das Produkt). Die Plattform-Administration darf sie vergeben. |

## Verwaltung von Organisationen und Mitgliedern

| Variable | Typ | Standard | Pflicht | Dienste | Beschreibung |
|---|---|---|---|---|---|
| `KEYCLOAK_MGMT_CLIENT_ID` | string | – | – | alle | Vertraulicher Client mit Service Account (`ppm-admin`). Ohne Angabe ist die Verwaltung von Organisationen, Mitgliedern und Rollen abgeschaltet. |
| `KEYCLOAK_MGMT_PRIVATE_KEY` | string | – | – | alle | Privater Schlüssel (PEM, PKCS#8, EC P-256 oder RSA) für `private_key_jwt` des Verwaltungs-Clients. Hat Vorrang vor dem Geheimnis. (geheim, `_FILE`) |
| `KEYCLOAK_MGMT_CLIENT_SECRET` | string | – | – | alle | Geheimnis des Verwaltungs-Clients (nur übergangsweise; Warnung beim Start). (geheim, `_FILE`) |
| `KEYCLOAK_MGMT_URL` | url | – | – | alle | Adresse der Admin-API des Realms, falls sie nicht aus `OIDC_ISSUER_URL` folgt (`…/realms/<realm>` → `…/admin/realms/<realm>`). |
| `KEYCLOAK_MGMT_INVITE_LIFESPAN` | duration | `72h` | – | alle | Gültigkeit des Links in der Einladung («Passwort festlegen»). 1h bis 30d. |
| `KEYCLOAK_MGMT_INVITE_MIN_TIME` | duration | `2s` | – | alle | Mindestdauer der Antwort auf Einladen, Zurückziehen und erneut Senden: neues und bestehendes Konto sind so auch an der Antwortzeit nicht zu unterscheiden. 0 = aus. |
| `KEYCLOAK_MGMT_TIMEOUT` | duration | `10s` | – | alle | Zeitlimit je Aufruf der Admin-API. |
| `KEYCLOAK_SYNC_CLIENT_ID` | string | – | – | alle | Eigener Client mit Service Account für den Abgleich der Mitglieder im Worker (`ppm-sync`). Ohne Angabe kein Abgleich im Worker. |
| `KEYCLOAK_SYNC_PRIVATE_KEY` | string | – | – | alle | Privater Schlüssel (PEM, PKCS#8) für `private_key_jwt` des Abgleich-Clients; nicht der des Verwaltungs-Clients. (geheim, `_FILE`) |
| `KEYCLOAK_SYNC_CLIENT_SECRET` | string | – | – | alle | Geheimnis des Abgleich-Clients (nur übergangsweise; Warnung beim Start). (geheim, `_FILE`) |
| `MEMBER_SYNC_INTERVAL` | duration | `1h` | – | alle | Abstand der Abgleiche aller Mandanten im Worker; höchstens ein Lauf über alle Instanzen. `0` = aus, sonst mindestens 1m. |

## Anmeldung über Microsoft Entra ID

| Variable | Typ | Standard | Pflicht | Dienste | Beschreibung |
|---|---|---|---|---|---|
| `ENTRA_CLIENT_ID` | string | – | – | alle | Anwendungs-ID der mandantenfähigen App der Plattform in Microsoft Entra ID (Zustimmung der Kunden). Optional: Ohne Angabe verbinden Organisationen nur mit einer eigenen App in ihrem Tenant (braucht `ENCRYPTION_KEYS`). Braucht die Verwaltung (`KEYCLOAK_MGMT_CLIENT_ID`). |
| `ENTRA_CLIENT_SECRET` | string | – | – | alle | Geheimnis der Entra-App (Tokens für Microsoft Graph, Identitätsanbieter in Keycloak). (geheim, `_FILE`) |
| `ENTRA_IDP_SLOTS` | int | `100` | – | alle | Anzahl der in der Entra-App eingetragenen Redirect-URIs `…/broker/entra-001/endpoint` bis `…/entra-<n>/endpoint`. 1 bis 250. |
| `ENTRA_UI_PATH` | string | `/verwalten/anmeldung` | – | alle | Seite «Anmeldung» der Oberfläche (`paths.entra` in `@vollholz/iam-web`). Rückkehr nach der Admin-Zustimmung: `<pfad>/zustimmung` (als Redirect-URI in der Entra-App eingetragen), nach der Testanmeldung: `<pfad>/test`. |
| `ENTRA_TIMEOUT` | duration | `10s` | – | alle | Zeitlimit je Aufruf bei Microsoft (Anmeldung, Graph). |

## Maschinenzugriff (M2M)

| Variable | Typ | Standard | Pflicht | Dienste | Beschreibung |
|---|---|---|---|---|---|
| `DPOP_MODE` | `off` \| `optional` \| `required-for-clients` \| `required` | `required-for-clients` | – | alle | DPoP-Pflicht. `required-for-clients`: Maschinen-Clients müssen sendergebundene Tokens verwenden, Personen (über BFF) nicht. |
| `DPOP_MAX_AGE` | duration | `300s` | – | alle | Maximales Alter eines DPoP-Proofs (`iat`). |
| `MTLS_HEADER` | string | – | – | alle | Header, in dem der Proxy das Client-Zertifikat weitergibt (PEM, auch URL-kodiert, oder DER als base64); der Proxy muss ihn immer setzen bzw. überschreiben. Aktiviert mTLS-gebundene Tokens (RFC 8705). |

## Sitzung (Oberfläche)

| Variable | Typ | Standard | Pflicht | Dienste | Beschreibung |
|---|---|---|---|---|---|
| `SESSION_SECRET` | string | – | production | api | Schlüssel für Sitzungs-Cookies (mind. 32 Zeichen). Mehrere kommagetrennt für Rotation, der erste signiert. (geheim, `_FILE`) |
| `SESSION_TTL` | duration | `8h` | – | alle | Maximale Dauer einer Sitzung. |
| `SESSION_IDLE_TIMEOUT` | duration | `60m` | – | alle | Abmeldung nach Inaktivität. |

## Verschlüsselung

| Variable | Typ | Standard | Pflicht | Dienste | Beschreibung |
|---|---|---|---|---|---|
| `ENCRYPTION_KEYS` | string | – | production | api, worker | Hauptschlüssel (Sitzungen, Geheimnisse der App, Geheimnisse eigener Entra-Apps). Format `id:base64(32 Bytes)`, mehrere kommagetrennt; der erste verschlüsselt. (geheim, `_FILE`) |

## MCP

| Variable | Typ | Standard | Pflicht | Dienste | Beschreibung |
|---|---|---|---|---|---|
| `MCP_PUBLIC_URL` | url | `http://localhost:8081/mcp` | production | mcp | Öffentliche Adresse des MCP-Endpunkts inkl. `/mcp` (Resource Identifier nach RFC 9728, `htu` bei DPoP). |
| `MCP_API_URL` | url | `http://localhost:8080` | – | alle | Interne Adresse der REST-API, die der MCP-Dienst aufruft. |
| `MCP_CLIENT_ID` | string | `ppm-mcp` | – | alle | Client des MCP-Dienstes für Token Exchange (RFC 8693). |
| `MCP_HOST_CLIENT_IDS` | list | `ppm-mcp-cli` | – | alle | Clients (`azp`), über die sich Personen in MCP-Hosts anmelden. Nur deren Tokens tauscht der MCP-Dienst; andere Tokens mit der Zielgruppe `OIDC_MCP_AUDIENCE` weist er mit 403 ab. |
| `MCP_CLIENT_SECRET` | string | – | – | alle | Geheimnis des MCP-Clients (nur übergangsweise; Warnung beim Start). Alternativ `MCP_PRIVATE_KEY`. (geheim, `_FILE`) |
| `MCP_PRIVATE_KEY` | string | – | – | alle | Privater Schlüssel (PEM) für `private_key_jwt` des MCP-Clients. (geheim, `_FILE`) |
| `MCP_DPOP_KEY` | string | – | – | alle | Privater Schlüssel (PEM, EC P-256) für DPoP der getauschten API-Tokens. Ohne Angabe erzeugt jede Instanz beim Start einen eigenen. (geheim, `_FILE`) |
| `MCP_PORT` | int | `8081` | – | mcp | Port des MCP-Dienstes (Streamable HTTP unter `/mcp`). |

## Betrieb

| Variable | Typ | Standard | Pflicht | Dienste | Beschreibung |
|---|---|---|---|---|---|
| `SHARED_STATE` | `postgres` \| `memory` | `postgres` | – | alle | Speicher für Replay-Schutz (DPoP, Logout-Tokens) und Rate-Limit. `postgres`: geteilt über alle Instanzen (Pflicht bei mehr als einer Instanz). `memory`: nur im Prozess. |
| `RATE_LIMIT_NAMESPACE` | string | – | – | alle | Vorsatz der Rate-Limit-Schlüssel des Pakets (`<namespace>:<produkt>:…`), wenn mehrere Umgebungen denselben geteilten Speicher nutzen (z. B. E2E und lokale App mit SHARED_STATE=postgres). Buchstaben, Ziffern, `_`, `-`, `.`; leer: kein Vorsatz. |
| `OPS_PORT` | int | `9090` | – | alle | Betriebs-Endpunkt jedes Prozesses: `/healthz`, `/readyz`, `/metrics`. |
| `SHUTDOWN_DELAY` | duration | `5s` | – | alle | Wartezeit nach SIGTERM mit `/readyz` = 503, bevor der Server schliesst (Load Balancer nimmt die Instanz heraus). |
| `SHUTDOWN_TIMEOUT` | duration | `25s` | – | alle | Höchstdauer des geordneten Beendens; danach Exit 1. |
| `METRICS_ENABLED` | bool | `false` | – | alle | Metriken im Prometheus-Format unter `/metrics` des Betriebs-Endpunkts. |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | url | – | – | alle | OTLP/HTTP-Empfänger für Traces und Metriken. Ohne Angabe keine Ausleitung. |
| `OTEL_SERVICE_NAME` | string | `ppm` | – | alle | Dienstname in der Telemetrie; der Prozess wird als `service.instance.id`-Suffix ergänzt. |

## HTTP

| Variable | Typ | Standard | Pflicht | Dienste | Beschreibung |
|---|---|---|---|---|---|
| `HTTP_HOST` | string | `0.0.0.0` | – | api | Adresse, an der die API lauscht. |
| `HTTP_PORT` | int | `8080` | – | api | Port der REST-API, des BFF und der Oberfläche. |
| `TRUST_PROXY` | string | `false` | – | alle | `trustProxy` von Fastify: `false`, `true`, Anzahl der Proxys (z. B. `1`) oder Liste von Adressen/Netzen. Hinter Caddy bzw. Ingress `1`. |
| `BODY_LIMIT` | int | `1048576` | – | alle | Grösste Anfrage in Bytes. |
| `API_RATE_LIMIT` | int | `600` | – | alle | Anfragen je Minute und Principal im Mandanten (ohne Anmeldung je IP). Die Oberfläche (`/`, `/assets/*`) ist nie begrenzt. |
| `IDEMPOTENCY_TTL` | duration | `24h` | – | alle | Aufbewahrung gespeicherter Antworten zu `Idempotency-Key`. |
| `WEB_DIST_DIR` | string | `web/dist` | – | api | Verzeichnis mit dem Build der Webapp. Fehlt es, zeigt die API ausserhalb der Produktion eine Hinweisseite. |

## Worker

| Variable | Typ | Standard | Pflicht | Dienste | Beschreibung |
|---|---|---|---|---|---|
| `WORKER_CONCURRENCY` | int | `4` | – | worker | Gleichzeitige Jobs je Worker-Prozess. |
| `WORKER_TENANT_LIMIT` | int | `2` | – | worker | Höchstens so viele gleichzeitige Jobs je Mandant über alle Worker. |
| `WORKER_POLL_INTERVAL` | duration | `1s` | – | worker | Abstand der Abfragen, wenn die Warteschlange leer ist. |
| `JOB_RETENTION` | duration | `30d` | – | worker | Aufbewahrung erledigter und endgültig gescheiterter Jobs. |

## Ereignisse und Webhooks

| Variable | Typ | Standard | Pflicht | Dienste | Beschreibung |
|---|---|---|---|---|---|
| `OUTBOX_RETENTION` | duration | `7d` | – | worker | Aufbewahrung verteilter Ereignisse der Outbox; Module mit eigenen Zustellungen (z. B. Webhooks) räumen abgeschlossene nach derselben Frist auf. |
| `WEBHOOK_TIMEOUT` | duration | `10s` | – | worker | Zeitlimit je Zustellung eines Webhooks. |
| `WEBHOOK_MAX_ATTEMPTS` | int | `8` | – | worker | Zustellversuche je Ereignis und Abonnement (exponentielles Backoff). |
| `WEBHOOK_ALLOW_PRIVATE` | bool | `false` | – | alle | Nur Entwicklung und Tests: Webhooks an private Adressen (localhost, RFC 1918) zulassen. In Produktion nicht erlaubt. |

## E-Mail

| Variable | Typ | Standard | Pflicht | Dienste | Beschreibung |
|---|---|---|---|---|---|
| `MAIL_ADAPTER` | `aus` \| `protokoll` \| `smtp` | `aus` | – | alle | Versand von E-Mails (`createMailer`): `aus` (jeder Versand scheitert), `protokoll` (nur ins Log, Entwicklung und Tests; in Produktion nicht erlaubt) oder `smtp`. |
| `MAIL_FROM` | string | – | – | worker | Absender, auch im Umschlag. Bei `MAIL_ADAPTER=smtp` im Worker Pflicht (nur er versendet). |
| `SMTP_URL` | url | – | – | worker | Mailserver mit Anmeldung: `smtps://` (TLS, Port 465) oder `smtp://` (STARTTLS Pflicht, Port 587); Benutzer und Passwort URL-kodiert. Bei `MAIL_ADAPTER=smtp` im Worker Pflicht (nur er versendet). (geheim, `_FILE`) |
| `SMTP_TIMEOUT` | duration | `30s` | – | alle | Frist für den ganzen Versand einer E-Mail (Verbindung bis Annahme). |
| `SMTP_ALLOW_INSECURE` | bool | `false` | – | alle | Nur Entwicklung: Mailserver ohne TLS bzw. mit ungeprüftem Zertifikat zulassen (z. B. Mailpit). In Produktion nicht erlaubt. |
