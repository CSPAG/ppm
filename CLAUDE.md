# Arbeitsregeln für Claude (PPM)

PPM ist eine mandantenfähige App für Strategieumsetzung und Projektportfoliomanagement. Grundgerüst nach der
Boilerplate-Spezifikation (Assets-Vorlage) mit Anmeldung, Mandanten und Rechten aus `@vollholz/iam` (identity-kit).
Fachliche Spezifikation: [`docs/PPM-Master.md`](docs/PPM-Master.md).

## Befehle

| Befehl | Wann |
|---|---|
| `npm run check` | vor jedem Push: Typen, Modulgrenzen (`arch`), Tests, Webapp |
| `npm run dev:setup` | einmalig lokal: `.env`, PostgreSQL + Keycloak, Migrationen, Realm |
| `npm run dev:api` / `dev:worker` / `dev:mcp` | Prozesse lokal |
| `npm run env:docs` | nach jeder Änderung an `src/platform/config/env.ts` (erzeugt `.env.example`, `docs/konfiguration.md`) |
| `npm run api:types` | nach jeder Änderung an Routen oder Schemas (`openapi:export` + Typen der Webapp) |
| `npm run identity:platform-json` | nach jeder Änderung am Modell `src/platform/authz/model.ts` |

## Regeln

- **Modulgrenzen** (`.dependency-cruiser.cjs`) und die Checkliste «Neues Modul anlegen» in
  [`docs/zielarchitektur.md`](docs/zielarchitektur.md) einhalten. Ausnahmen nur mit TODO, Begründung und Doku.
- **Jede neue Tabelle** mit `tenant_id` zuerst, RLS (`ENABLE` + `FORCE`, `tenant_isolation`) und Eintrag in der
  Testmatrix von `test/platform/rls.test.ts`.
- **Keine neuen Netz-Adapter** ohne Eintrag in `scripts/check-network.ts` (`NETWORK_ADAPTERS`) mit Begründung.
- **Versionen exakt**, ohne `^` oder `~`; neue Pakete mit Mindestalter 14 Tage; TypeScript 5.9.
- **Verwaltete Dateien** von identity-kit (Kopf «Verwaltet von identity-kit», `.identity-kit.lock`) nie von Hand
  ändern; Einstellungen in `identity.app.json`, dann `npm run identity:sync`.
- **Sprache:** Code-Kommentare, Doku und Oberfläche Deutsch, Schweizer Rechtschreibung ohne Eszett (auch nicht in
  Kommentaren und Tests, dort `\u00df`), Oberfläche in Du-Form, sichtbar «Organisation» statt «Mandant».
- **Branch-Namen** `<typ>/<kurze-beschreibung>` mit `typ` ∈ `feat|fix|refactor|chore|docs`, z. B.
  `feat/projekt-phasen`.
