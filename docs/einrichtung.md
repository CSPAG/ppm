# Einrichtung (lokale Entwicklung)

## Voraussetzungen

| Was | Wozu |
|---|---|
| Node 24 und npm ≥ 11 (`.nvmrc`) | Backend läuft direkt mit Type Stripping, Webapp mit Vite |
| Docker mit Compose | PostgreSQL 17 und Keycloak 26 lokal ([`deploy/compose.dev.yaml`](../deploy/compose.dev.yaml)) |
| `~/.npmrc` mit `//npm.pkg.github.com/:_authToken=<token>` | Pakete `@vollholz/*` aus GitHub Packages; persönliches Token (classic) mit nur `read:packages`. Die Zuordnung `@vollholz` → `npm.pkg.github.com` steht schon in [`.npmrc`](../.npmrc) bzw. [`web/.npmrc`](../web/.npmrc) |

Freie Ports: 8080 (API), 8081 (MCP), 9090 (Betrieb), 5433 (PostgreSQL), 8180 (Keycloak); für E2E zusätzlich 8090
und 9091. Alle Container lauschen nur auf `127.0.0.1`.

## Loslegen

```sh
npm ci
npm run web:install
npm run dev:setup      # .env, PostgreSQL 17 + Keycloak 26, Migrationen, Realm «ppm» mit Testpersonen
npm run web:build
npm run dev:api        # http://localhost:8080, Anmeldung z. B. als anna@demo.example
```

Weitere Prozesse in eigenen Terminals: `npm run dev:worker` (Jobs, Outbox, Webhooks, Mitgliederabgleich) und
`npm run dev:mcp` (MCP-Dienst auf 8081, [mcp.md](mcp.md)). Alle drei laden die `.env` und
[`ops/preload.ts`](../src/platform/ops/preload.ts) (Telemetrie).

Ohne `npm run web:build` zeigt die API unter `/` eine Hinweisseite. Die Webapp bringt zusätzlich einen Vite-Server mit
Proxy auf `/v1` und `/auth` (`npm run dev --prefix web`, Port 5173, Ziel `PPM_API`, Standard `http://localhost:8080`).

### Was `dev:setup` tut

| Schritt | Skript | Ergebnis |
|---|---|---|
| `dev:env` | [`scripts/dev-env.ts`](../scripts/dev-env.ts) | `.env` (0600) mit Zufallsgeheimnissen und Verbindungen der Rollen `ppm_owner`, `ppm_runtime`, `ppm_worker`; Schlüsselpaare der Clients `ppm-platform`, `ppm-admin`, `ppm-sync`, `ppm-mcp` unter `.local/keys/`. Bestehende Werte bleiben, fehlende kommen dazu |
| `dev:up` | `docker compose --env-file .env -f deploy/compose.dev.yaml up -d --wait` | PostgreSQL (Rollen und Datenbank `ppm` über [`db/bootstrap.sql`](../db/bootstrap.sql) im Init-Skript) und Keycloak im Dev-Modus (Admin `admin`, Passwort `KEYCLOAK_ADMIN_PASSWORD`) |
| `db:migrate` | [`scripts/db-migrate.ts`](../scripts/db-migrate.ts) | Migrationen von `@vollholz/iam`, danach [`db/migrations/`](../db/migrations) als `ppm_owner` |
| `keycloak:setup` | [`scripts/keycloak-setup.ts`](../scripts/keycloak-setup.ts) | Realm `ppm` wie das Realm-Modul in Produktion (Clients `ppm-api`, `ppm-platform`, `ppm-admin`, `ppm-sync`, `ppm-mcp`, `ppm-mcp-cli`, Scopes aus dem Modell, Realm-Rolle `platform-admin`), Organisationen `demo` und `muster`, Testpersonen; dazu Mandanten, Principals und Rollen in der Datenbank. Idempotent; der Realm `master` wird nie verändert |

Zurücksetzen: `npm run dev:down`, Volumes `ppm-dev_pgdata` und `ppm-dev_kcdata` löschen, dann wieder
`npm run dev:setup`.

## Testpersonen

Passwort für alle: `E2E_PASSWORD` aus der `.env` (Standard `Test1234!`).

| Person | Organisation | Rolle |
|---|---|---|
| `anna@demo.example` | `demo` | `org-admin` (Freigabestufe 2) |
| `bruno@demo.example` | `demo` | `viewer` |
| `max@muster.example` | `muster` (zweite Organisation) | `org-admin` |
| `betrieb@ppm.example` | – | `platform-admin` (Realm-Rolle, ohne Organisation) |

## Demodaten

```sh
npm run seed:demo      # einige Projekte in «demo» und «muster», idempotent, nie in Produktion
```

## Tests

```sh
npm test                                   # alle Backend-Tests (node --test, höchstens 10 Dateien parallel)
npm test -- test/platform/rls.test.ts      # eine Datei
npm run web:check                          # Webapp: Typen, ESLint, Vitest
npm run check                              # alles: typecheck, arch, test, web:check
```

`npm test` ([`scripts/test.ts`](../scripts/test.ts)) nutzt die **Dev-Datenbank als Superuser** über die `.env`
(`POSTGRES_SUPERUSER_PASSWORD`, `POSTGRES_PORT`) oder `TEST_POSTGRES_URL`. Jede Testdatei legt eine eigene
**Wegwerf-Datenbank** mit allen Migrationen an ([`test/platform/harness.ts`](../test/platform/harness.ts)); die
Verbindungen setzen die Rolle (`ppm_runtime`, `ppm_worker` …), damit RLS wie in Produktion gilt. Reste abgebrochener
Läufe räumt das Test-Kit auf. Ist keine Datenbank erreichbar, überspringen sich die Datenbanktests. Keycloak braucht
`npm test` nicht (Mock-IdP in [`test/platform/api.ts`](../test/platform/api.ts)).

## E2E

```sh
npm run web:build
npm run e2e
```

[`scripts/e2e-db.ts`](../scripts/e2e-db.ts) legt die Datenbank **`ppm_e2e`** neu an, führt die Migrationen aus,
übernimmt die Testpersonen aus `.local/people.json` (von `keycloak:setup`) und schreibt `.local/e2e.env`. Playwright
startet dann eine **zweite Instanz der API auf Port 8090** (Betrieb 9091) gegen `ppm_e2e` und meldet sich über das
Formular von Keycloak an. Die laufende Entwicklungsinstanz auf 8080 bleibt unberührt.

| Variable | Bedeutung |
|---|---|
| `E2E_BASE_URL` | gegen eine schon laufende Instanz testen (dann startet Playwright keine eigene) |
| `E2E_PASSWORD` | Passwort der Testpersonen |
| `E2E_CHROMIUM` | Pfad zu einem vorhandenen Chromium, wenn `npx playwright install` nicht geht (z. B. `/opt/pw-browsers/chromium`) |

Inhalt der Tests: [oberflaeche.md › Tests](oberflaeche.md#tests).

## Rauchtest

```sh
npm run smoke          # gegen PUBLIC_BASE_URL, Betriebs-Endpunkt auf http://localhost:9090
```

[`scripts/smoke.ts`](../scripts/smoke.ts) prüft mit echtem Keycloak: Betriebs-Endpunkt, OpenAPI, problem+json ohne
Anmeldung, Anmeldung über den BFF (Code-Flow mit PKCE), `/auth/me`, `/v1/me`, Projekt anlegen, lesen, löschen (mit
CSRF und `If-Match`), Abmelden. Umgebung: `SMOKE_URL`, `SMOKE_OPS_URL` (leer = überspringen), `SMOKE_USER`,
`SMOKE_PASSWORD`, `SMOKE_WRITE=false` ohne Schreibtest. Nach einem Deploy: [betrieb.md › Rauchtest](betrieb.md#rauchtest-nach-einem-deploy).

## Ohne Zugang zu GitHub Packages

Sind die Pakete `@vollholz/*` nicht erreichbar (z. B. in einer Session ohne Token), liefert identity-kit sie lokal
aus (identity-kit [`docs/ausrollen.md`](https://github.com/vollholz/identity-kit/blob/main/docs/ausrollen.md) › Ohne
Zugang):

```sh
node scripts/local-registry.ts                                   # im Checkout von identity-kit: 127.0.0.1:4873
env 'npm_config_@vollholz:registry=http://127.0.0.1:4873/' npm ci                 # hier
env 'npm_config_@vollholz:registry=http://127.0.0.1:4873/' npm ci --prefix web    # Webapp
```

Die lokal gepackten Pakete sind nicht byte-gleich mit den veröffentlichten. Darum stehen die Einträge `@vollholz/*` in
`package-lock.json` und `web/package-lock.json` **ohne `resolved` und `integrity`**; das nächste `npm install` mit
echtem Zugang trägt sie nach ([offene-punkte.md](offene-punkte.md), Punkt 6).

## Keycloak-Image

[`deploy/compose.dev.yaml`](../deploy/compose.dev.yaml) nimmt Keycloak 26.8.1 per Digest von `quay.io` (die Version,
gegen die identity-kit getestet ist). Ist `quay.io` nicht erreichbar:

```sh
echo 'KEYCLOAK_IMAGE=keycloak/keycloak:26.8.1' >> .env && npm run dev:up
```

## Fehlersuche

| Befund | Ursache und Abhilfe |
|---|---|
| `npm ci`: 401/403 bei `@vollholz/*` | Token in `~/.npmrc` fehlt oder hat nicht `read:packages`; sonst [lokale Registry](#ohne-zugang-zu-github-packages) |
| Prozess endet mit Exit 78 | Konfiguration ungültig; alle Meldungen stehen in der Logzeile `fatal`. Variablen: [konfiguration.md](konfiguration.md). Fehlt die `.env`: `npm run dev:env` |
| `dev:up`: «npm run dev:env» als Fehler | Compose findet die Variablen nicht: `.env` fehlt oder `dev:up` lief ohne `--env-file .env` |
| `dev:up` hängt bei Keycloak | Der Erststart dauert; der Healthcheck wartet bis 5 Minuten. Image nicht ladbar → [Keycloak-Image](#keycloak-image) |
| Port 5433 oder 8180 belegt | anderen Stack beenden; `POSTGRES_PORT` in der `.env` ändern (dann `npm run dev:env` und neu starten) |
| `keycloak:setup`: Scope «organization» fehlt | Keycloak-Version ohne Organisationen; Image 26.x verwenden |
| Anmeldung: «Invalid redirect uri» | `PUBLIC_BASE_URL` weicht von `http://localhost:8080` ab; `npm run keycloak:setup` erneut ausführen |
| Unter `/` nur Hinweisseite | Webapp nicht gebaut: `npm run web:build` |
| `betrieb@ppm.example` sieht keine Projekte | Konto ohne Organisation (nur `platform-admin`): Die Oberfläche führt in die Plattform-Administration (Organisationen); Projekte sieht nur ein Mitglied einer Organisation |
| Tests übersprungen | Datenbank nicht erreichbar: `npm run dev:up`, sonst `TEST_POSTGRES_URL` setzen |
| `rls.test.ts`: «Tabelle ohne Eintrag in MATRIX» | neue Tabelle ohne Testmatrix ([zielarchitektur.md › Checkliste](zielarchitektur.md#checkliste-neues-modul-anlegen)) |
| `npm run arch`: Befund `check-network` | Netzzugriff ausserhalb der Netz-Adapter ([zielarchitektur.md › Modulgrenzen](zielarchitektur.md#modulgrenzen)) |
| `npm run arch`: Befund `check-address` | Eszett oder «Sie»-Anrede in einem Text |
| `web:check` meldet Typfehler im API-Client | OpenAPI geändert: `npm run api:types` |
| E2E: Port 8090 belegt | alte E2E-Instanz beenden oder `E2E_BASE_URL` auf sie setzen |
