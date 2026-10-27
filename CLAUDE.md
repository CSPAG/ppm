# Arbeitsregeln für Claude in ppm

PPM ist eine mandantenfähige App für Strategieumsetzung und Projektportfoliomanagement. Fachgrundlage (führend):
[docs/PPM-Master.md](docs/PPM-Master.md) mit `docs/anhang/` (Funktionsbaum, Use Cases, Klärungsliste). Architektur:
[docs/zielarchitektur.md](docs/zielarchitektur.md). UX-Schicht (Arbeitsräume, Kernabläufe, Regeln der Oberfläche):
[docs/ux/](docs/ux/README.md). **Bauplan** (verbindlich für jede Umsetzung): [docs/fachmodell.md](docs/fachmodell.md)
mit Modulschnitt, Datenmodell, Rechten, Arbeitspaketen (Besitz, Migrationsbereich, Abhängigkeiten) und Annahmen `A-nn`;
Stand in [docs/umsetzungsstand.md](docs/umsetzungsstand.md).

## Befehle

| Befehl | Wofür |
|---|---|
| `npm run check` | **vor jedem Push grün:** Typen, Modulgrenzen (`arch`), Tests, Webapp (Typen, ESLint, Vitest) |
| `sh scripts/session/setup.sh` + `. scripts/session/env.sh` | Cloud-Session ohne Token für GitHub Packages: `@vollholz/*` lokal gebaut, PostgreSQL auf 5433, danach `npm run check` mit Datenbank |
| `npm run dev:setup` | lokal: `.env`, PostgreSQL + Keycloak (Docker), Migrationen, Realm |
| `npm run dev:api` / `dev:worker` / `dev:mcp` | Prozesse lokal |
| `npm run env:docs` | nach jeder Änderung an Variablen (`vars` in `src/app.ts`) oder nach einem Update von `@vollholz/*`: erzeugt `.env.example` und `docs/konfiguration.md` |
| `npm run openapi:export && npm run api:types` | nach jeder Änderung an Routen: `web/openapi.json` und `web/src/api/schema.d.ts` |
| `npm run identity:platform-json` | nach jeder Änderung am Modell `src/authz/model.ts` |

Tests mit Datenbank brauchen `POSTGRES_SUPERUSER_PASSWORD` (und `POSTGRES_PORT`, Standard 5433) oder
`TEST_POSTGRES_URL`; ohne Datenbank werden sie übersprungen, in CI nie.

## Regeln

- **Querschnitt** (HTTP, Worker, Outbox, Betrieb, MCP, Konfiguration) kommt aus `@vollholz/platform`; die App hat nur
  `src/platform.ts`, `src/app.ts`, `src/cli.ts`, Modell und Module. Fehlt etwas im Querschnitt: ins Paket (identity-kit).
- **Modulgrenzen** (`.dependency-cruiser.cjs`): Module nur über ihre `index.ts`, Bausteine aus `src/platform.ts`, nie
  aus `app.ts`. Neues Modul: Checkliste in [docs/zielarchitektur.md](docs/zielarchitektur.md#checkliste-neues-modul-anlegen).
- **Jede neue Tabelle** mit Mandantendaten: `tenant_id` zuerst im Primärschlüssel, RLS `ENABLE` + `FORCE`
  (`SELECT app.secure_tenant_tables()`), Policies der Lesesicht, `GRANT` nur an `ppm_app`/`_sched`, Eintrag in
  der Testmatrix von `test/app/rls.test.ts`.
- Migrationen nur vorwärts (`db/migrations/NNN_name.sql`), Nummer nur aus dem Bereich des Arbeitspakets
  (`docs/fachmodell.md` Abschnitt 7); veröffentlichte nie ändern.
- **Arbeitspakete:** nur die Dateien im Besitz des Pakets ändern; gemeinsame Dateien (`src/app.ts`, `src/authz/`,
  Router, Navigation, Testmatrix) nach den Regeln in `docs/fachmodell.md` Abschnitt 7.2; eigene Zeilen in
  `docs/umsetzungsstand.md` nachführen.
- **Fachlich** gilt nur die Spezifikation in `docs/`: keine Regel bauen, die dort fehlt; `[OFFEN]` bleibt offen und
  kommt in die Klärungsliste; bis zur Klärung gilt die Annahme `A-nn` aus `docs/fachmodell.md`. IDs aus Funktionsbaum und Use Cases (z. B. `ZM.01.01`, `UC-004`) in Kommentaren nennen.
- **Oberfläche:** vor einem Feature den Kernablauf in `docs/ux/ablaeufe/` lesen (oder anlegen); Seitentyp, Zustände und
  Regeln aus `docs/ux/rahmen/interaktion.md`; jeder PR mit Oberfläche erfüllt die UX-Definition of Done
  (`docs/ux/rahmen/pruefung.md`). `docs/ux/rahmen/` ist projektneutral: nicht projektbezogen ändern.
- **Sprache:** Kommentare, Doku und Oberfläche Deutsch, Schweizer Rechtschreibung ohne ß; Oberfläche mit Anrede «Sie»
  (UX-E7, bis zur Klärung von UX-OF-1); in sichtbaren Texten «Organisation», nie «Mandant»/«Tenant».
- **Versionen exakt**, ohne `^`/`~`. `@vollholz/*` nur gemeinsam anheben (Renovate-Gruppe «identity-kit»).
- **Netz:** ausgehende Aufrufe nur in den Netz-Adaptern aus `scripts/check-network.ts` (mit Begründung), mit
  SSRF-Schutz (`safeRequest` aus `@vollholz/platform`). Die Webapp spricht nur same-origin.
- Konfiguration nur über Umgebungsvariablen; neue Variable der App in `vars` von `defineApp` (`src/app.ts`) mit `services`.
- Fehler immer `application/problem+json` über `HttpError` (`@vollholz/platform`).
- **Branches:** `<typ>/<kurze-beschreibung>` mit `typ` ∈ `feat|fix|refactor|chore|docs`, 2–5 Wörter, kleingeschrieben,
  Bindestriche (z. B. `feat/statusbericht-erfassen`).
