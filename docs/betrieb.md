# Betrieb

## Prozesse und Startbefehle

Ein Image (`ghcr.io/cspag/ppm`), Startbefehl als erstes Argument (`deploy/docker-entrypoint.sh`). Jeder
Node-Prozess lädt zuerst `@vollholz/platform/preload` (Telemetrie vor allen Modulen).

| Befehl | Port | Aufgabe | Endet |
|---|---|---|---|
| `api` | `HTTP_PORT` 8080, `OPS_PORT` 9090 | REST-API, OpenAPI `/v1/docs`, BFF `/auth/*`, Webapp | nein |
| `worker` | `OPS_PORT` 9090 | Warteschlange, Outbox, Webhooks, Aufräumen, Mitgliederabgleich | nein |
| `mcp` | `MCP_PORT` 8081, `OPS_PORT` 9090 | MCP-Dienst ([mcp.md](mcp.md)) | nein |
| `migrate` | – | Migrationen von `@vollholz/iam` und `db/migrations/` | ja |
| `tenant <befehl>` | – | `list`, `create <alias> [--name]`, `suspend`, `resume`, `delete <alias> --confirm <alias>` | ja |
| `rotate-keys [--dry-run]` | – | Geheimnisse mit dem ersten Schlüssel aus `ENCRYPTION_KEYS` neu verpacken | ja |
| `healthcheck` | – | `GET /healthz` auf `OPS_PORT` (`HEALTHCHECK` des Images) | ja |

Ungültige Konfiguration: alle Meldungen zugleich auf stderr, Exit 78. Das Image läuft als UID 1000 mit nur lesbaren
Dateien und tini als PID 1.

Betriebs-Endpunkt (`@vollholz/platform`): `/healthz` (Lebenszeichen), `/readyz` (503 beim Beenden oder wenn
eine Prüfung scheitert: Datenbank, Anmeldedienst), `/metrics` (nur mit `METRICS_ENABLED=true`). Die API bietet
`/healthz` und `/readyz` zusätzlich auf dem Dienst-Port.

## Geheimnisse je Dienst

Jeder Dienst erhält nur, was sein Code liest (Feld `services` der Variablen, [konfiguration.md](konfiguration.md)); in
`deploy/compose.prod.yaml` als Dateien unter `/run/secrets/` mit `<NAME>_FILE`.

| Geheimnis | api | worker | mcp | migrate |
|---|---|---|---|---|
| `DATABASE_URL` (Rolle `ppm_runtime`) | ✓ | | | |
| `DATABASE_WORKER_URL` (Rolle `ppm_worker`) | | ✓ | | |
| `DATABASE_ADMIN_URL` (Rolle `ppm_owner`) | | | | ✓ |
| `SESSION_SECRET` | ✓ | | | |
| `ENCRYPTION_KEYS` | ✓ | ✓ | | |
| `OIDC_BFF_PRIVATE_KEY` (`ppm-platform`) | ✓ | | | |
| `KEYCLOAK_MGMT_PRIVATE_KEY` (`ppm-admin`) | ✓ | | | |
| `KEYCLOAK_SYNC_PRIVATE_KEY` (`ppm-sync`) | | ✓ | | |
| `MCP_PRIVATE_KEY` (`ppm-mcp`) | | | ✓ | |
| `MCP_DPOP_KEY` | | | ✓ | |
| CA der Datenbank (`NODE_EXTRA_CA_CERTS`, `DATABASE_SSL=verify-full`) | ✓ | ✓ | | ✓ |

Der MCP-Dienst hat keinen Datenbank-Login. Alle Variablen: [konfiguration.md](konfiguration.md).

## Geordnetes Beenden

Auf SIGTERM (`@vollholz/platform`): `/readyz` sofort 503 → `SHUTDOWN_DELAY` (5 s) warten → Server
schliessen bzw. Worker holt nichts mehr ab und führt laufende Jobs zu Ende → Pools schliessen, Telemetrie leeren →
Exit 0; dauert es länger als `SHUTDOWN_TIMEOUT` (25 s), Exit 1. Plattform-Frist grösser wählen
(`stop_grace_period: 40s` in Compose, `terminationGracePeriodSeconds` in `deploy/k8s/`).

## Beobachtbarkeit

- **Logs:** JSON auf stdout (pino), `trace_id`/`span_id` der aktiven Spur, Request-ID (`X-Request-ID`, übernommen
  oder neu), Redaction von `authorization`, `dpop`, `cookie` u. a. (`REDACT_PATHS` in `@vollholz/platform`).
- **Traces:** OpenTelemetry mit Instrumentierung von http, pg und undici; Ausleitung über
  `OTEL_EXPORTER_OTLP_ENDPOINT` (OTLP/HTTP).
- **Metriken:** `http.server.request.duration` (je Route), `platform.job.duration` (je Art und Ergebnis),
  `platform.outbox.dispatched` (Namen aus `@vollholz/platform`; die App unterscheidet `service.name`); über OTLP
  und/oder `/metrics` (Prometheus).

## Warteschlange und feste Aufgaben

Die Warteschlange liegt in PostgreSQL (`ppm.job`, `Worker` in `@vollholz/platform`): Abholen serialisiert über
eine Advisory-Lock, höchstens `WORKER_TENANT_LIMIT` laufende Jobs je Organisation, keine Jobs gesperrter
Organisationen, Heartbeat jede Minute, verwaist nach 15 Minuten, Backoff 10 s · 2^(Versuch−1) bis 1 h, Versuche nach `maxAttempts`
der Job-Definition (Standard 5). Ein Ergebnis hält nur der Worker fest, der den Job gerade hat.

| Aufgabe | Abstand | Inhalt |
|---|---|---|
| `outbox.dispatch` | 2 s | unverteilte Ereignisse an die Abnehmer (Webhooks) übergeben |
| `webhooks.deliver` | 5 s | fällige Zustellungen senden (Standard Webhooks, SSRF-Schutz) |
| `webhooks.retention` | 1 h | zugestellte und endgültig gescheiterte Zustellungen nach `OUTBOX_RETENTION` löschen |
| `shared-state.purge` | 5 min | Rate-Limit- und Replay-Einträge aufräumen |
| `retention` | 1 h | erledigte Jobs (`JOB_RETENTION`), abgelaufene Idempotenz, verteilte Ereignisse (`OUTBOX_RETENTION`) löschen |
| Mitgliederabgleich | `MEMBER_SYNC_INTERVAL` | Mitglieder aus Keycloak (`ppm-sync`), abgelaufene Freigaben und Break-Glass |

Jede Aufgabe läuft über alle Instanzen höchstens einmal gleichzeitig. Fachjobs: noch keine.

## Runbooks

| Aufgabe | Vorgehen |
|---|---|
| Organisation sperren | `tenant suspend <alias>`; Anfragen und Jobs der Organisation ruhen. Entsperren: `tenant resume <alias>` |
| Organisation löschen | zuerst sperren, dann `tenant delete <alias> --confirm <alias>` (alle Daten, Eintrag im Protokoll der Plattform; [OP-16](offene-punkte.md#op-16)) |
| Hauptschlüssel rotieren | neuen Schlüssel vorne in `ENCRYPTION_KEYS`, alle Dienste neu starten, `rotate-keys --dry-run`, dann `rotate-keys`; danach alten Schlüssel entfernen |
| Migration | läuft vor jedem Deploy als `migrate` (nur vorwärts, idempotent); einzeln: `docker run … migrate` |
| Neue Version, Rollback, Wartung, Zustand | Workflow «Deploy» (`.github/workflows/deploy.yml`, nur manuell mit Freigabe): `deploy` (Image-Digest), `rollback`, `maintenance-on`, `maintenance-off`, `status` |
| Backup und PITR | pgBackRest auf der DB-VM: [deploy/hetzner/README.md](../deploy/hetzner/README.md#backup-und-wiederherstellung-pitr) |
| Demo-Organisation | [Demo-Daten im Betrieb](#demo-daten-im-betrieb) |
| Rauchtest | `npm run smoke` (Betriebs-Endpunkt, OpenAPI, 401 ohne Token, mit Maschinen-Client `GET /v1/handlungsfelder`) |

## CI und Lieferkette

`.github/workflows/ci.yml` (Vorgabe `permissions: contents: read`):

| Job | Inhalt |
|---|---|
| check | PostgreSQL-17-Service, `db/bootstrap.sql`, Migrationen (zweimal), Typen, `arch`, Tests, Konformität identity-kit (Datenbank), generierte Dateien aktuell (`.env.example`, `docs/konfiguration.md`, `web/openapi.json`) |
| web | Typen, ESLint, Vitest, Build, Client-Typen passen zu `web/openapi.json` |
| dependencies | `npm audit --omit=dev --audit-level=high`, `npm audit signatures`, OSV-Scanner – für beide Lockfiles |
| manifests | `kustomize build \| kubeconform`, `docker compose config`, `caddy validate`, shellcheck |
| image | Build, Rauchtest (ohne Konfiguration Exit 78, UID 1000), Trivy, SBOM (CycloneDX, SPDX); auf `main`/Tags Push nach GHCR (amd64, arm64) mit Digest, Provenienz aus dem Build (`provenance: mode=max`), Signatur und SBOM über cosign keyless; GitHub-Attestation nur mit Variable `ENABLE_GITHUB_ATTESTATIONS=true` (für private Repositories von CSPAG nicht verfügbar) |

Weitere Workflows: `deploy.yml`, `infra.yml` (OpenTofu Hetzner: Plan im PR, Apply nur manuell; danach DNS bei Infomaniak über `infra/dns/`),
`keycloak.yml` und `identity-conformity.yml` (verwaltet von identity-kit). Renovate (`renovate.json`): wöchentlich,
14 Tage Mindestalter, Sicherheitsupdates sofort, Gruppe «identity-kit» ohne Automerge, Digests gepinnt.

## Demo-Daten im Betrieb

Eine eigene Organisation `demo` mit dem Spitalbeispiel aus `scripts/seed-demo.ts` (Inhalt:
[einrichtung.md](einrichtung.md)), getrennt von den Organisationen der Kundschaft. Das Skript läuft im
Image als Einmal-Container des Dienstes `api` (dessen Geheimnisse und Verwaltung), handelt über die öffentlichen Routen
und schreibt nur in diese Organisation.

1. **Organisation anlegen** (Plattform-Administration): in der Oberfläche unter Plattform › Organisationen, Alias `demo`,
   Name z. B. «Demo Spital». Sich selbst als `org-admin` mit Freigabestufe 2 einladen, die Einladung annehmen und sich
   einmal in `demo` anmelden.
2. **Seed** auf der App-VM als `betrieb` (Image mit dem Skript ist deployt):

   ```sh
   cd /opt/ppm
   sudo env IMAGE="$(sudo cat state/image)" docker compose -f compose.prod.yaml --env-file prod.env run --rm --no-deps api \
     node scripts/seed-demo.ts --org demo --admin <eigene E-Mail> --einladen
   ```

   `IMAGE` ist das deployte Image (`compose.prod.yaml` verlangt es). Bis zum Image vom 29.10.2026
   (`sha256:c6ca458f…`) öffnet das Skript die Datenbank ohne TLS («pg_hba.conf rejects connection … no encryption»);
   dann nach `--no-deps` zusätzlich `-e PGSSLMODE=verify-full` (so am 29.10.2026 für `demo` gelaufen).

   `--einladen` lädt die 16 Personen der Demo (`scripts/seed/personen.ts`) über die Verwaltung ein: Keycloak legt Konten
   ohne Passwort unter `…@demo.example` an; die Mail «Passwort setzen» erreicht niemanden (`.example`, RFC 2606), also
   meldet sich niemand als diese Personen an. Die eigene Person handelt als Administration der Demo. Dauer einige
   Minuten (zwei Starts der Anwendung im Container).
3. **Ansehen:** als eigene Person in der Organisation `demo` (mit `org-admin` alle Bereiche).

Das Skript läuft nur auf einer Organisation ohne Portfolios. Neu aufsetzen: Organisation sperren und löschen (oben),
dann von vorn. Die Schnittstelle «ERP» der Demo zeigt auf einen Server des Skripts, der danach nicht mehr läuft
(Rhythmus manuell, ein neuer Lauf scheitert mit Hinweis); die Ist-Kosten bleiben.

