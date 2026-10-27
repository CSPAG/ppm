# Einrichtung

## Lokale Umgebung

Voraussetzungen: Node 24 (`.nvmrc`), Docker mit Compose, npm ≥ 11 für `web/` ([OP-14](offene-punkte.md#op-14)) und
ein GitHub-Token (classic, nur `read:packages`, beliebiges Konto) für die Pakete `@vollholz/*` in `~/.npmrc`:

```sh
echo '//npm.pkg.github.com/:_authToken=<token>' >> ~/.npmrc
```

```sh
npm ci                 # Backend
npm run web:install    # Webapp (eigenes Paket web/)
npm run dev:setup      # dev:env → dev:up → db:migrate → keycloak:setup
npm run web:build      # Oberfläche bauen (oder: npm --prefix web run dev)
npm run dev:api        # http://localhost:8080
npm run dev:worker     # zweites Terminal
npm run dev:mcp        # optional, http://localhost:8081/mcp
```

| Schritt | Was passiert |
|---|---|
| `dev:env` | schreibt `.env` (nur wenn sie fehlt; `--force` überschreibt) mit Zufallspasswörtern, `SESSION_SECRET`, `ENCRYPTION_KEYS` und Schlüsselpaaren der Clients unter `.local/keys/` (`*_FILE`) |
| `dev:up` | `deploy/compose.dev.yaml`: PostgreSQL 17 auf `127.0.0.1:5433` (Rollen über `db/bootstrap.sql`, Datenbanken `ppm` und `ppm_e2e`), Keycloak 26 auf `127.0.0.1:8180` |
| `db:migrate` | Migrationen von `@vollholz/iam`, danach `db/migrations/` |
| `keycloak:setup` | Realm `ppm` mit Clients, Scopes, Organisationen `demo` und `muster`, Testpersonen, Rollen als Tupel in der Datenbank |

Testpersonen (Passwort `ppm-demo`, nur lokal):

| Person | Organisation | Rolle |
|---|---|---|
| `anna@demo.example` | demo | org-admin, Freigabestufe 2 |
| `bruno@demo.example` | demo | leser |
| `max@muster.example` | muster | org-admin, Freigabestufe 2 |
| `betrieb@ppm.example` | – | platform-admin (Realm-Rolle, ohne Organisation) |

Demo-Daten für `demo` (die fünf Handlungsfelder der Strategie 2035, ohne Leitsatz): `npm run seed:demo`.

## Tests

```sh
npm run check                                      # Typen, Modulgrenzen, Tests, Webapp
POSTGRES_SUPERUSER_PASSWORD=… POSTGRES_PORT=5433 npm test
```

Die Backend-Tests legen je Datei eine Wegwerf-Datenbank an (`test/app/harness.ts`). Ohne erreichbare Datenbank
überspringen sie sich lokal; in CI (`CI=true`) ist das ein Fehler.

End-to-End (Playwright mit axe, gegen den lokalen Stack und die Datenbank `ppm_e2e`):

```sh
npm run web:build && npm run e2e
```

## Keycloak in Produktion

Der Realm wird vollständig als Code geführt, mit dem Realm-Modul aus identity-kit (verwaltete Dateien in
`infra/keycloak/`, Einstellungen in `identity.app.json`; Leitfaden: [identity-kit.md](identity-kit.md)).

1. Schlüsselpaare: `npx create-iam-app keys` (öffentlich nach `infra/keycloak/keys/`, privat nach
   `~/.identity/ppm/`). `ppm-tofu.json` geht an den Betreiber der Keycloak-Instanz.
2. Betreiber: Service Account `ppm-tofu` im Realm `master` mit nur `create-realm`.
3. Lokal: `infra/keycloak/kc.sh bootstrap init && infra/keycloak/kc.sh bootstrap apply` (Realm und `ppm-iac`).
   Vorher das State-Backend (`state` in `identity.app.json`) anlegen ([OP-05](offene-punkte.md#op-05)).
4. Betreiber: `ppm-iac` erhält `realm-management/realm-admin` im Realm `ppm`.
5. Workflow «Keycloak» (`.github/workflows/keycloak.yml`): Plan → Freigabe → Apply. Secrets im Environment
   `production`: `KEYCLOAK_IAC_PRIVATE_KEY`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `TF_STATE_PASSPHRASE`.
6. Erste Organisation: in `identity.app.json` unter `organizations` eintragen ([OP-06](offene-punkte.md#op-06)), nach den Migrationen `npm run identity:first-org`; danach
   `npx iam-conformity-test --db --no-repo`.

## Hetzner (Vorlage)

Der Betriebsort ist offen ([OP-01](offene-punkte.md#op-01)). Vorlage für eine App-VM und eine DB-VM in einem neuen
Hetzner-Projekt:
[deploy/hetzner/README.md](../deploy/hetzner/README.md#neues-hetzner-projekt-einrichten).
