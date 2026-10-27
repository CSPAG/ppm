# Oberfläche

Die Webapp ist ein eigenes npm-Paket unter `web/`. Sie wird gebaut (`npm run web:build` → `web/dist`) und vom
`api`-Prozess ausgeliefert (`uiModule` aus `@vollholz/platform`). Sie spricht nur mit der eigenen Herkunft
(`/auth/*`, `/v1/*`).

## Bausteine

| Baustein | Wahl |
|---|---|
| Build | Vite 8; Produktions-Build ohne Inline-Skripte |
| UI | React 19, TypeScript strict |
| Server-Zustand | TanStack Query 5 |
| Routing | TanStack Router, code-basiert, typisierte Suchparameter (`src/search.ts`) |
| API-Client | `openapi-fetch` mit Typen aus `openapi-typescript` (`src/api/schema.d.ts` aus `web/openapi.json`) |
| Anmeldung und Rechte | `@vollholz/iam-web` (`IamProvider`, Organisation je Tab, Kontomenü, `AccessSheet`, Verwalten › Mitglieder, Anmeldung, Organisationen) |
| Stil | eigenes CSS mit Farb-Tokens hell und dunkel (`src/styles/tokens.css`), `--iam-*` darauf abgebildet; Schriften lokal; `public/theme.js` setzt das Farbschema vor dem ersten Zeichnen |
| Tests | Vitest + Testing Library; Playwright + axe (WCAG 2.2 AA) |
| Lint | ESLint 9 mit `typescript-eslint`, `react-hooks`, `jsx-a11y` |

## Ordner

| Ordner/Datei | Inhalt |
|---|---|
| `src/main.tsx`, `app.tsx` | Einstieg; Baukasten, Navigation und Shell zusammensetzen |
| `src/router.tsx`, `search.ts` | Routen der App und Verwalten-Seiten des Baukastens (`makeIamRoutes`); Suchparameter je Seite |
| `src/api/` | Client mit CSRF, `X-Tenant`, problem+json, 401/403 an die Sitzung; Hilfen für 412, 404, Idempotency-Key |
| `src/auth/` | `IamProvider`, Sitzung, Rechte der App |
| `src/shell/` | AppShell, Rail, Befehlspalette (Strg+K), Farbschema, NotFound, `context.ts` |
| `src/ui/` | Overlay mit Fokusfalle, Toasts, Zustände leer/Fehler/laden, Icons, Texte (`texts.ts`) |
| `src/features/handlungsfeld/` | Arbeitsraum «Ziele» › Handlungsfelder (`/ziele/handlungsfelder`): Liste mit Suche und Cursor, Schublade über `?o=<id>` (`?o=neu` zum Anlegen), Bearbeiten mit 412-Hinweis, Löschen, Verlauf |
| `src/styles/`, `src/test/`, `e2e/` | Tokens und Layout; Testhilfen; Playwright-Tests |

## Regeln

- **Modulgrenzen** ([zielarchitektur.md](zielarchitektur.md#modulgrenzen)): Features nutzen nur `ui/`, `api/`, `auth/`;
  sie kennen Shell und Router nicht (Navigation über Suchparameter). Gemeinsame Bausteine kennen keine Features.
- **Same-origin:** keine absoluten Adressen in `fetch`, `EventSource`, `WebSocket`, `sendBeacon`; keine externen
  `src`/`href` im Build (`scripts/check-network.ts`). CSP der Oberfläche ohne `unsafe-inline`, `connect-src 'self'`.
- **Texte:** zentral in `src/ui/texts.ts`; Anrede «Sie» (UX-E7, bis zur Klärung von UX-OF-1), Schweizer Rechtschreibung, «Organisation» statt «Mandant»
  (`src/ui/texts.test.ts`, `scripts/check-address.ts`).
- **Barrierefreiheit:** alles per Tastatur, Fokus in Dialogen gefangen und zurückgegeben, hell und dunkel, ab 360 px
  Breite; axe in jedem E2E-Test.

## Tests

| Befehl | Inhalt |
|---|---|
| `npm run web:check` | Typen, ESLint, Vitest |
| `npm run e2e` | Playwright gegen den lokalen Stack (Datenbank `ppm_e2e`): Anmeldung, Anlegen/Ändern mit 412/Löschen, zweite Organisation sieht nichts, Leser:in ändert nicht, axe hell/dunkel, 360 px |

Umgebung der E2E-Tests: `E2E_BASE_URL` (Standard `http://localhost:8080`), `E2E_USER`/`E2E_PASSWORD`,
`E2E_USER_B`/`E2E_PASSWORD_B`, `E2E_USER_C`/`E2E_PASSWORD_C`, `E2E_CHROMIUM`.

## Abgleich OpenAPI ↔ Client

Nach jeder Änderung an Routen: `npm run openapi:export && npm run api:types`. Der Backend-Test
`test/app/webui.test.ts` vergleicht `web/openapi.json` mit der aktuellen Beschreibung; der Typcheck der Webapp
scheitert, wenn der Client nicht mehr zu den Typen passt.
