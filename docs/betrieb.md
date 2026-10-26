# Betrieb

Ein Image (`ghcr.io/cspag/ppm`), mehrere Prozesse; der Startbefehl ist das erste Argument
([`deploy/docker-entrypoint.sh`](../deploy/docker-entrypoint.sh), `tini` als PID 1). Alle Variablen:
[konfiguration.md](konfiguration.md). Ablage bei Hetzner (VMs, Netze, Sicherung, PITR):
[`deploy/hetzner/README.md`](../deploy/hetzner/README.md).

## Prozesse und Startbefehle

| Befehl | Einstieg | Port | Aufgabe |
|---|---|---|---|
| `api` | [`src/platform/main/api.ts`](../src/platform/main/api.ts) | `HTTP_PORT` 8080 | REST-API `/v1`, OpenAPI unter `/v1/docs`, BFF `/auth/*`, Webapp |
| `worker` | [`src/platform/main/worker.ts`](../src/platform/main/worker.ts) | – | Warteschlange, Outbox (Webhooks), Aufräumen, verwaiste Jobs, Mitgliederabgleich |
| `mcp` | [`src/platform/main/mcp.ts`](../src/platform/main/mcp.ts) | `MCP_PORT` 8081 | MCP über Streamable HTTP unter `/mcp` ([mcp.md](mcp.md)) |
| `migrate` | [`scripts/db-migrate.ts`](../scripts/db-migrate.ts) | – | Migrationen (`DATABASE_ADMIN_URL`), endet danach |
| `tenant <aktion>` | [`scripts/tenant-admin.ts`](../scripts/tenant-admin.ts) | – | `list`, `create`, `suspend`, `resume`, `delete` |
| `rotate-keys [--dry-run]` | [`scripts/rotate-encryption-keys.ts`](../scripts/rotate-encryption-keys.ts) | – | Geheimnisse mit dem ersten Schlüssel aus `ENCRYPTION_KEYS` neu versiegeln |
| `healthcheck [live]` | Entrypoint | – | `/readyz` (bzw. `/healthz` mit `live`) des Betriebs-Endpunkts, Exit 0 nur bei 2xx |

Lokal entsprechen dem `npm run dev:api`, `dev:worker`, `dev:mcp`, `db:migrate`, `tenant -- <aktion>`, `rotate-keys`.

| Port | Dienst | Erreichbar |
|---|---|---|
| 8080 | api | hinter Caddy bzw. Ingress |
| 8081 | mcp | hinter Caddy (`/mcp`, `/.well-known/oauth-protected-resource*`) |
| 9090 | Betriebs-Endpunkt jedes Prozesses (`OPS_PORT`) | nur intern (Health Checks, Metriken), nie von aussen |

Ungültige Konfiguration beendet `api`, `worker` und `mcp` mit **Exit 78** und allen Meldungen in einer Logzeile
`fatal`; `migrate`, `tenant` und `rotate-keys` ebenso, wenn ihre Verbindungen fehlen.

## Geheimnisse je Dienst

Jeder Dienst verlangt und bekommt nur, was sein Code liest (`VARS` › `services`/`secret` in
[`src/platform/config/env.ts`](../src/platform/config/env.ts)). Geheimnisse gehen als Dateien über `<NAME>_FILE`
hinein ([`deploy/compose.prod.yaml`](../deploy/compose.prod.yaml): `/run/secrets/<name>`, UID 1000, 0400).

| Geheimnis | api | worker | mcp | migrate | tenant | rotate-keys | Bemerkung |
|---|:-:|:-:|:-:|:-:|:-:|:-:|---|
| `DATABASE_URL` (`ppm_runtime`) | ✓ | | | | ✓ | ✓ | Pflicht für api |
| `DATABASE_WORKER_URL` (`ppm_worker`) | | ✓ | | | | (✓) | rotate-keys nimmt sie, sonst `DATABASE_URL` |
| `DATABASE_ADMIN_URL` (`ppm_owner`) | | | | ✓ | ✓ | ✓ | nur Skripte, nie in einem Dienst |
| `DATABASE_SUPERUSER_URL` | | | | | `delete` | | nur `tenant delete` (RLS bindet auch die Besitzer-Rolle) |
| `SESSION_SECRET` | ✓ | | | | | | Pflicht in Produktion |
| `ENCRYPTION_KEYS` | ✓ | ✓ | | | | ✓ | Pflicht in Produktion |
| `OIDC_BFF_PRIVATE_KEY` (bzw. `_CLIENT_SECRET`) | ✓ | | | | | | Client `ppm-platform` |
| `KEYCLOAK_MGMT_PRIVATE_KEY` (bzw. `_CLIENT_SECRET`) | ✓ | | | | | | Client `ppm-admin` (Verwaltung) |
| `KEYCLOAK_SYNC_PRIVATE_KEY` (bzw. `_CLIENT_SECRET`) | | ✓ | | | | | Client `ppm-sync` (Abgleich) |
| `ENTRA_CLIENT_SECRET` | (✓) | | | | | | nur mit Entra-App der Plattform; in Compose auskommentiert |
| `MCP_PRIVATE_KEY` (bzw. `MCP_CLIENT_SECRET`) | | | ✓ | | | | Client `ppm-mcp` (Token Exchange) |
| `MCP_DPOP_KEY` | | | ✓ | | | | DPoP der getauschten Tokens; ohne Angabe je Instanz neu |

Der **MCP-Dienst hat keinen Datenbank-Login**: Er ist ein Client der REST-API (`MCP_API_URL`). Jeder Dienst mit
Datenbank vertraut der privaten CA der Datenbank über `NODE_EXTRA_CA_CERTS=/run/secrets/db_ca.crt`
(`DATABASE_SSL=verify-full` ist in Produktion Pflicht).

## Geordnetes Beenden

[`ops/runtime.ts`](../src/platform/ops/runtime.ts) auf SIGTERM/SIGINT:

1. `/readyz` antwortet sofort 503 (Load Balancer nimmt die Instanz heraus).
2. `SHUTDOWN_DELAY` (5 s) warten.
3. Schritte in Reihenfolge: HTTP-Server schliessen bzw. Worker holt nichts mehr ab und wartet auf laufende Jobs,
   Mitgliederabgleich stoppen, Betriebs-Endpunkt schliessen, Pools schliessen.
4. Telemetrie leeren, Exit 0. Dauert es länger als `SHUTDOWN_TIMEOUT` (20 s): Exit 1.

Kubernetes: `terminationGracePeriodSeconds: 40` ([`deploy/k8s/`](../deploy/k8s)) liegt über
`SHUTDOWN_DELAY + SHUTDOWN_TIMEOUT`.

## Betriebs-Endpunkt

Jeder Prozess auf `OPS_PORT` (9090, [`ops/server.ts`](../src/platform/ops/server.ts)):

| Pfad | Antwort |
|---|---|
| `/healthz` | 200, solange der Prozess lebt |
| `/readyz` | 200 mit Prüfungen; 503 beim Beenden oder wenn eine Prüfung scheitert (api: Datenbank und Anmeldedienst aus `readinessChecks`; worker: Datenbank; mcp: REST-API erreichbar) |
| `/metrics` | Prometheus-Format, nur mit `METRICS_ENABLED=true` |

Die API beantwortet `/healthz` und `/readyz` zusätzlich auf dem Dienst-Port (für Proxys ohne Zugang zum
Betriebs-Endpunkt), öffentlich ist ausserdem `GET /v1/health`.

## Beobachtbarkeit

| Thema | Umsetzung |
|---|---|
| Logs | JSON auf stdout (pino), `LOG_LEVEL`; Redaction von `authorization`, `dpop`, `cookie` u. a. ([`core/redact.ts`](../src/platform/core/redact.ts)); `X-Request-ID` übernommen oder neu und in jeder Antwort |
| Traces | OpenTelemetry über [`ops/preload.ts`](../src/platform/ops/preload.ts) (vor allen Modulen geladen): http, pg, undici; Export OTLP/HTTP an `OTEL_EXPORTER_OTLP_ENDPOINT`. Span-Attribute `http.route`, `ppm.request_id`. `service.name` = `ppm-<dienst>`, `service.namespace` = `OTEL_SERVICE_NAMESPACE` |
| Metriken | OpenTelemetry ([`ops/metrics.ts`](../src/platform/ops/metrics.ts)), OTLP und/oder Prometheus unter `/metrics` |
| Audit | jede schreibende Aktion in `ppm.audit_log` (Hash-Kette), Plattform-Aktionen zusätzlich in `ppm.platform_audit_log`; MCP-Aufrufe als Logzeile `audit: mcp.tool` ([mcp.md](mcp.md)) |

| Metrik | Art | Attribute |
|---|---|---|
| `ppm_http_request_duration` | Histogramm (s) | `http.route`, `http.request.method`, `http.response.status_code` |
| `ppm_jobs_total` | Zähler | Art und Ergebnis |
| `ppm_job_duration` | Histogramm (s) | Art |
| `ppm_outbox_dispatched_total` | Zähler | – |
| `ppm_webhook_deliveries_total` | Zähler | `result` (`delivered`, `retry`, `failed`) |

## Runbooks

Auf der App-VM bei Hetzner laufen die Befehle über [`deploy/hetzner/rollout.sh`](../deploy/hetzner/rollout.sh)
(`ssh deploy@<app> /opt/ppm/rollout.sh …`) bzw. den Workflow **«Deploy»**
([`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml), nur von Hand, Freigabe im Environment
`production`).

### Neue Version ausrollen und Migration

1. CI auf `main` (oder Tag `v*`) veröffentlicht das Image signiert nach GHCR; die Zusammenfassung des Laufs nennt den
   Digest.
2. Workflow «Deploy» › `deploy` mit `image` = Digest (`sha256:…`) oder Tag (`main`, `1.2.3`). Der Workflow löst den
   Tag zum Digest auf, prüft Signatur (cosign, nur `ci.yml` auf `main`/Tags) und Provenienz, überträgt Dateien und
   Geheimnisse (SOPS) und ruft `rollout.sh deploy <image@digest>`.
3. `rollout.sh` holt das Image, führt **`migrate` vor dem Wechsel** aus (scheitert es, bleibt die laufende Version),
   erneuert `api`, `worker`, `mcp`, `caddy` und wartet auf gesunde Dienste; sonst automatisch zurück auf das
   vorherige Image.

Migrationen laufen **nur vorwärts** und müssen mit der laufenden Version verträglich sein (erweitern, umstellen, erst
in einem späteren Release aufräumen). Von Hand: `docker run … <image> migrate` mit `DATABASE_ADMIN_URL(_FILE)`;
Kubernetes: [`deploy/k8s/migrate-job.yaml`](../deploy/k8s/migrate-job.yaml).

### Rollback

Workflow «Deploy» › `rollback` (bzw. `rollout.sh rollback`): startet das vorherige Image **ohne Migrationen**. Die
Datenbank wird nie zurückgesetzt; dafür gibt es die Wiederherstellung auf einen Zeitpunkt (PITR,
[`deploy/hetzner/README.md`](../deploy/hetzner/README.md) › Betrieb).

### Wartungsmodus

Workflow «Deploy» › `maintenance-on` / `maintenance-off`: Caddy antwortet mit
[`deploy/maintenance/index.html`](../deploy/maintenance/index.html) und 503 (`Retry-After: 300`). `status` zeigt
Dienste, aktuelles und vorheriges Image.

### Rauchtest nach einem Deploy

Der Workflow prüft danach von aussen, dass `https://<PPM_DOMAIN>/` mit 200 oder 302 antwortet. Den vollen Rauchtest
mit Anmeldung ([`scripts/smoke.ts`](../scripts/smoke.ts)) startet der Betrieb von Hand mit einem Konto der
Zielumgebung:

```sh
SMOKE_URL=https://ppm.project-suite.ch SMOKE_OPS_URL= SMOKE_USER=<konto> SMOKE_PASSWORD=<passwort> \
  SMOKE_WRITE=false node scripts/smoke.ts
```

### Mandanten sperren, entsperren, löschen

```sh
rollout.sh tenant list                                   # bzw. npm run tenant -- list
rollout.sh tenant suspend <alias> --reason "<grund>"     # sofort: Anfragen 403, Jobs werden nicht abgeholt
rollout.sh tenant resume <alias>
npm run tenant -- delete <alias> --confirm <alias>       # braucht DATABASE_SUPERUSER_URL
```

`create <alias> [--name …] [--org <keycloak-org-id>]` legt nur den Mandanten an; Organisationen mit erster Person
legt `npm run identity:first-org` an (unten), danach die Plattform-Administration in der Oberfläche.
`delete` sperrt den Mandanten und löscht die **Fachdaten der App** (Tabellen aus `db/migrations`, Liste
`APP_TENANT_TABLES` in [`ops/tenants.ts`](../src/platform/ops/tenants.ts)); Principals, Tupel und Protokoll des
Baukastens bleiben als Nachweis ([offene-punkte.md](offene-punkte.md), Punkt 8). Der Dienst `tenant` in
`compose.prod.yaml` hat kein `DATABASE_SUPERUSER_URL`; `delete` läuft darum nur mit ausdrücklich übergebenem
Superuser-Zugang.

### Schlüsselrotation (`ENCRYPTION_KEYS`)

1. Neuen Schlüssel **vorn** eintragen (`neu:<base64 32 Bytes>,alt:<…>`; Hetzner: `encryption_keys` in
   `deploy/hetzner/secrets/app.enc.yaml` mit SOPS), ausrollen.
2. `rollout.sh rotate-keys --dry-run`, dann `rollout.sh rotate-keys`: versiegelt je Mandant alle Geheimnisse neu
   (Module über `ROTATIONS`, z. B. Webhook-Geheimnisse; eigene Entra-Apps des Baukastens).
3. Alten Schlüssel entfernen, erneut ausrollen. Sitzungen laufen über `SESSION_TTL` ab und brauchen keine Rotation.

`SESSION_SECRET` rotiert ohne Skript: mehrere Werte kommagetrennt, der erste signiert.

### Realm in Keycloak (Workflow «Keycloak»)

Der Realm `ppm` auf `https://id.project-suite.ch` ist Code: [`infra/keycloak/`](../infra/keycloak) (von identity-kit
verwaltet, Einstellungen in [`identity.app.json`](../identity.app.json)), Workflow
[`.github/workflows/keycloak.yml`](../.github/workflows/keycloak.yml). Ein Pull Request prüft nur; ein Push auf
`main` läuft Plan → Freigabe → Apply genau dieses Plans → Kontrollplan «No changes». Die Aktion `abgleich` meldet
Änderungen von Hand in der Konsole. Nach jeder Änderung am Modell zuerst `npm run identity:platform-json`.

Anlage des Realms (einmalig, `kc.sh bootstrap`) und Secrets des Workflows: identity-kit
[`docs/neue-app.md`](https://github.com/vollholz/identity-kit/blob/main/docs/neue-app.md) › 3, Stand in
[offene-punkte.md](offene-punkte.md), Punkt 4. Details zum Baukasten: [identity-kit.md](identity-kit.md).

### Konto des Betriebs und erste Organisation

Nach den Migrationen, mit dem Schlüssel von `ppm-iac`:

```sh
KEYCLOAK_TF_URL=https://id.project-suite.ch KEYCLOAK_TF_REALM=ppm KEYCLOAK_IAC_PRIVATE_KEY_B64=… \
DATABASE_ADMIN_URL=postgres://ppm_owner:…@…/ppm \
  npm run identity:first-org          # = iam-org-bootstrap --manifest identity.app.json
```

Das Skript liest `operators` und `organizations` aus `identity.app.json` (beides fehlt noch,
[offene-punkte.md](offene-punkte.md), Punkt 3), legt in Keycloak das Betriebskonto (`platform-admin`, ohne
Organisation) sowie Organisation und erste Person an und schreibt in der Datenbank Mandant, Principal und `org-admin`.
Danach `npx iam-conformity-test --db --no-repo`: «Jede Organisation hat einen org-admin» muss grün sein.

### Sicherung und Wiederherstellung

pgBackRest auf der DB-VM (WAL laufend, Vollsicherung sonntags, sonst differenziell, 35 Tage, verschlüsselt),
Wiederherstellung auf einen Zeitpunkt mit `restore-pitr.sh`: [`deploy/hetzner/README.md`](../deploy/hetzner/README.md)
› Betrieb.

## CI

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) auf Pull Requests, `main`, Tags `v*` und von Hand;
`permissions: contents: read` als Vorgabe.

| Job | Inhalt |
|---|---|
| `check` | PostgreSQL-17-Service, `db/bootstrap.sql`, Migrationen, `db/ci-org.sql`, `iam-conformity-test --db`, `typecheck`, `arch`, `npm test`, `env-docs.ts --check` (`.env.example`, `konfiguration.md`), `openapi-export.ts --check` (`web/openapi.json`) |
| `web` | `npm run web:install`, `api:types`, `web:check`, `web:build` |
| `dependencies` | `npm audit --omit=dev --audit-level=high` und `npm audit signatures` für beide Lockfiles, OSV-Scanner |
| `manifests` | kubeconform über `kustomize build deploy/k8s`, `docker compose config`, `caddy validate` und `fmt`, shellcheck |
| `image` | Build (amd64) mit Build-Secret `npmrc`, Rauchtest (Exit 78 ohne Konfiguration, UID 1000, ohne Paketmanager), Trivy, SBOM (CycloneDX, SPDX) |
| `publish` | nur `main` und Tags `v*`, nach allen anderen: Multi-Arch-Build (amd64, arm64), Push nach GHCR per Digest, Provenienz (GitHub Attestation), Signatur (cosign keyless) |

Weitere Workflows:

| Workflow | Inhalt |
|---|---|
| [`deploy.yml`](../.github/workflows/deploy.yml) | `deploy`, `rollback`, `maintenance-on`, `maintenance-off`, `status` (nur von Hand, Environment `production`) |
| [`infra.yml`](../.github/workflows/infra.yml) | OpenTofu für `infra/hetzner` und `infra/dns`: im PR Prüfen und Plan (Environment `infra-plan`), von Hand Plan → Apply (zwei Freigaben) |
| [`keycloak.yml`](../.github/workflows/keycloak.yml) | Realm (verwaltet von identity-kit) |
| [`identity-conformity.yml`](../.github/workflows/identity-conformity.yml) | Konformität mit identity-kit (verwaltet) |

Pakete `@vollholz/*` liest CI mit `NODE_AUTH_TOKEN`; ausserhalb von `vollholz` braucht es das Repository-Secret
`NPM_READ_TOKEN` ([offene-punkte.md](offene-punkte.md), Punkt 5).

## Lieferkette

| Thema | Umsetzung |
|---|---|
| Versionen | exakt, ohne `^`/`~`; neue Pakete mit Mindestalter 14 Tage; TypeScript 5.9 |
| Renovate | [`renovate.json`](../renovate.json): wöchentlich (Montag früh, Europe/Zurich), `minimumReleaseAge` 14 Tage, Sicherheitsupdates sofort, Digests gepinnt (Docker, Actions); verwaltete Dateien von identity-kit ausgenommen (Anheben über `npm run identity:sync`) |
| Image | Basis `node:24-alpine` per Index-Digest, `apk upgrade` in der Laufzeit, Typprüfung als Build-Gate, UID 1000, Dateien `root` und nur lesbar, Root-Dateisystem schreibgeschützt, `tini`, ohne npm/corepack/yarn, OCI-Labels, `HEALTHCHECK`, Multi-Arch |
| Geheimnisse beim Build | `@vollholz/*` über das Build-Secret `npmrc`, nie im Image |
| Prüfungen | `npm audit`, `npm audit signatures`, OSV-Scanner, Trivy (Schwachstellen und Geheimnisse) |
| Nachweise | SBOM CycloneDX und SPDX (Artefakt), Provenienz, cosign-Signatur; `deploy.yml` prüft Signatur und Provenienz vor jedem Deploy |
| Geheimnisse im Repository | nur verschlüsselt mit SOPS/age ([`.sops.yaml`](../.sops.yaml), `deploy/hetzner/secrets/*.enc.yaml`); öffentliche Client-Schlüssel unter [`infra/keycloak/keys/`](../infra/keycloak/keys) |
