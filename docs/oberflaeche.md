# Oberfläche (Webapp)

Die Webapp ist ein eigenes npm-Paket unter [`web/`](../web) (`ppm-web`): eine React-SPA, die der `api`-Prozess
same-origin ausliefert ([`src/platform/modules/auth/ui.ts`](../src/platform/modules/auth/ui.ts)). Anmeldung, Organisation
je Tab, Kontomenü, «Zugriff» und die Verwalten-Seiten kommen aus `@vollholz/iam-web`.

## Bausteine

| Baustein | Wahl |
|---|---|
| Build | Vite 8 ([`vite.config.ts`](../web/vite.config.ts)): ohne Inline-Skripte, Schriften und Bilder als eigene Dateien (CSP `script-src 'self'`, `font-src 'self'`), Ziel `es2023`, Sourcemaps |
| UI | React 19, TypeScript strict |
| Server-Zustand | TanStack Query 5 (4xx nicht wiederholen, sonst bis zweimal) |
| Routing | TanStack Router, code-basiert ([`router.tsx`](../web/src/router.tsx)), typisierte Suchparameter ([`search.ts`](../web/src/search.ts)) |
| API-Client | `openapi-fetch` mit Typen aus `openapi-typescript` ([`src/api/schema.d.ts`](../web/src/api/schema.d.ts) aus [`web/openapi.json`](../web/openapi.json)) |
| Anmeldung, Rechte | `@vollholz/iam-web` (`IamProvider`, `iamMiddleware`, `AccountMenu`, `IamNav`, `AccessSheet`, `ClassificationBadge`, Verwalten-Seiten über `makeIamRoutes`) |
| Stil | eigenes CSS mit Farb-Tokens hell/dunkel ([`styles/tokens.css`](../web/src/styles/tokens.css)), Schrift Inter lokal (`@fontsource-variable/inter`), [`public/theme.js`](../web/public/theme.js) setzt `data-theme` vor dem ersten Zeichnen |
| Tests | Vitest + Testing Library mit `mockIamApi`/`StaticIam` aus iam-web; Playwright + axe gegen den lokalen Stack |
| Lint | ESLint 10 (Flat Config) mit `typescript-eslint` (strict, typgeprüft), `react-hooks`, `jsx-a11y` |

Das Paket führt alle `devDependencies` selbst (auch `@types/node` für `vite.config.ts` und `e2e/`), damit CI ohne das
`node_modules` des Root-Pakets dieselben Typen sieht.

## Ordner

| Pfad | Inhalt |
|---|---|
| `src/main.tsx` | Einstieg: Schrift, Stile, Thema, Router, App |
| `src/app.tsx` | Zusammensetzung: QueryClient, Toasts, `AppIamProvider`, Router; Namen der Projekte für «Zugriff» |
| `src/router.tsx` | Routen und `SHELL` (Navigation, Befehle der Features), Verwalten-Seiten aus iam-web (bei Bedarf geladen) |
| `src/search.ts` | Suchparameter je Route; ungültige Werte fallen weg |
| `src/api/` | `client.ts` (Client, `idempotencyKey`, `isVersionConflict`, `currentVersion`, `fieldErrors`), `schema.d.ts` (erzeugt) |
| `src/auth/` | `iam.tsx` (Produkt, Pfade, Schalter, Router-Adapter, `AppIamProvider`), `session.tsx` (`useSession`) |
| `src/shell/` | `AppShell` (Sprunglink, Kopf, Kontomenü, hell/dunkel), `Rail` (Navigation, auf schmalen Bildschirmen als Schublade), `CommandPalette` (Strg+K/Cmd+K), `NotFound`, `context.ts` (Vertrag zwischen Router und Shell) |
| `src/ui/` | `Overlay` (Schublade und Dialog mit Fokusfalle, `Confirm`), `Toasts`, `states.tsx` (laden, leer, Fehler, Skelett), `Icons`, `theme.ts`, `texts.test.ts` |
| `src/features/projekt/` | Beispiel-Feature: `ProjektePage`, `ProjektDrawer`, `ProjektForm`, `api.ts` (Abfragen und Änderungen), `validate.ts`, `format.ts`, `types.ts`, `index.ts` (Schnittstelle) |
| `src/styles/` | `tokens.css`, `base.css`, `shell.css`, `components.css` |
| `src/test/` | `render.tsx` (App mit fester Sitzung, echtem Router, nachgebildeter API), `fixtures.ts`, Tests |
| `e2e/` | Playwright-Tests und `helpers.ts` |

Grenzen (geprüft mit `npm run arch`, [zielarchitektur.md › Modulgrenzen](zielarchitektur.md#modulgrenzen)): Features
nutzen keine anderen Features und kennen Shell, Router und `app.tsx` nicht; `ui/`, `api/`, `auth/`, `styles/`
kennen keine Features. Ein Feature erscheint nur über `router.tsx` (Route, `SHELL.nav`, `SHELL.actions`).

## Routing

| Pfad | Inhalt |
|---|---|
| `/` | leitet auf `/projekte` um |
| `/projekte` | Liste mit Suche `?q=`, Detail als Schublade `?o=<id>`, Formular «Neues Projekt» `?neu=true` |
| `/verwalten/mitglieder`, `/verwalten/anmeldung`, `/verwalten/organisationen` | Seiten von iam-web (Mitglieder, Anmeldung über Entra ID, Plattform-Administration), mit Guard nach Recht |
| `/abgemeldet` | nach dem Abmelden (iam-web) |

Die Seiten kennen den Router nicht: `router.tsx` reicht Suchparameter und Navigieren herein
(`ProjektePage({ search, onSearch })`). Navigation und Befehlspalette zeigen Einträge nur mit dem Recht (`perm`).

## API-Client

- Basis ist `window.location.origin`, nie eine feste Adresse (geprüft in `scripts/check-network.ts`).
- Die Middleware von iam-web setzt `X-Tenant` (Organisation des Tabs) und bei schreibenden Aufrufen `X-CSRF-Token`,
  wirft Fehler als `ApiError` (problem+json) und meldet 401 an die Sitzung: Diese zeigt «Sitzung abgelaufen» mit
  «Erneut anmelden», Eingaben bleiben stehen.
- Anlegen mit `Idempotency-Key`, Ändern und Löschen mit `If-Match` (`ifMatch(version)`). Bei 412/428 zeigt die
  Schublade den Hinweis «Jemand hat das Projekt inzwischen geändert.» und bietet «Neu laden» an.
- Feldfehler eines 422 (`errors[].path`) erscheinen am passenden Feld; das Formular prüft vorher mit denselben Pfaden
  und Texten wie die API ([`validate.ts`](../web/src/features/projekt/validate.ts)).
- Nach Änderungen an Routen oder Schemas: `npm run api:types`. Der Backend-Test `webui.test.ts` meldet, wenn
  `web/openapi.json` nicht zur API passt.

## Anmeldung

`AppIamProvider` ([`auth/iam.tsx`](../web/src/auth/iam.tsx)) umschliesst die App mit `IamProvider` von iam-web
(Produkt «PPM», Pfade, Schalter `access`, `entra`, `platform`, Meldungen über die Toasts der App). Die Shell zeichnet
erst mit Sitzung; Person, Organisation und Rechte liefert `useSession()`. Rechte an einer Ressource kommen aus deren
`can` (Antwort der API), sonst gilt das Recht an der Organisation. Die Anmeldung selbst läuft über den BFF
(`/auth/login` → Keycloak → `/auth/callback`); Tokens erreichen den Browser nie.

«Zugriff» an einem Projekt ist das `AccessSheet` von iam-web (Ressource `{ type: 'projekt', id }`). Ein Konto ohne
Organisation (`platform-admin`) landet in der Plattform-Administration.

## Texte und Sprache

- Deutsch, Schweizer Rechtschreibung ohne Eszett, **Du-Form**, sichtbar «Organisation» (nie «Mandant» oder
  «Tenant»). [`src/ui/texts.test.ts`](../web/src/ui/texts.test.ts) prüft alle Zeichenketten und JSX-Texte unter
  `src`; `scripts/check-address.ts` prüft zusätzlich das ganze Repository.
- Datum in Schweizer Schreibweise (`de-CH`, z. B. `01.03.2026`), Zeitpunkte in der Zeitzone des Browsers ([`format.ts`](../web/src/features/projekt/format.ts)).

## Barrierefreiheit

| Thema | Umsetzung |
|---|---|
| Tastatur | überall bedienbar; Sprunglink «Zum Inhalt springen»; Befehlspalette als Combobox mit Listbox (Pfeile, Enter, Esc) |
| Dialoge | Fokusfalle (Tab läuft im Kreis), Esc schliesst, Fokus kehrt zum auslösenden Element zurück; nur die oberste Ebene reagiert |
| Zustände | laden/leer/Fehler mit `role="status"` bzw. `alert`, Toasts als Live-Region |
| Farben | Tokens hell und dunkel, Kontraste nach WCAG 2.2 AA (Text 4.5:1, Bedienelemente und Fokus 3:1) |
| Schmale Bildschirme | 390 px ohne waagrechtes Scrollen, Navigation über den Menüknopf, Schublade über die ganze Breite |
| Prüfung | `jsx-a11y` im Lint, axe (WCAG 2.2 AA) in den E2E-Tests hell und dunkel |

## Auslieferung

[`modules/auth/ui.ts`](../src/platform/modules/auth/ui.ts) liefert `WEB_DIST_DIR` (Standard `web/dist`) aus:
SPA-Fallback auf `index.html` (`no-cache`), `/assets/*` mit `immutable`, Pfadprüfung gegen das Verlassen von `dist`
(auch über Symlinks), CSP ohne `unsafe-inline`:

```text
default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self';
connect-src 'self'; form-action 'self' <Keycloak>; frame-ancestors 'none'; base-uri 'self'; object-src 'none'
```

Pfade unter `/v1`, `/auth`, `/healthz`, `/readyz`, `/mcp` gehen nie an die Webapp. Ohne Build zeigt die API ausserhalb
der Produktion eine Hinweisseite, in Produktion 503.

## Befehle

| Befehl (im Root) | Im Paket `web/` | Inhalt |
|---|---|---|
| `npm run web:install` | `npm ci` | Abhängigkeiten |
| `npm run web:check` | `npm run check` | `tsc`, ESLint, Vitest |
| `npm run web:build` | `npm run build` | Produktions-Build nach `web/dist` |
| `npm run api:types` | `npm run api:types` | OpenAPI-Export (nur Root) und `src/api/schema.d.ts` |
| `npm run e2e` | `npm run e2e` | Playwright (Root legt vorher `ppm_e2e` an) |
| – | `npm run dev` | Vite auf 5173 mit Proxy auf `/v1` und `/auth` (`PPM_API`) |

## Tests

**Vitest** (22 Tests, `npm run web:check`):

| Datei | Inhalt |
|---|---|
| `src/test/projekte.test.tsx` | Liste mit Cursor («Mehr laden» bis `next = null`), Suche über `?q=` mit Organisation des Tabs, leerer Zustand, Schublade über `?o=` (öffnen, Esc, Fokus zurück, ungültige ID), Knöpfe nach `can` |
| `src/test/bearbeiten.test.tsx` | Bearbeiten mit `If-Match`, Konflikt 412 mit «Neu laden», Löschen mit Rückfrage, Anlegen mit `Idempotency-Key` |
| `src/test/formular.test.tsx` | Prüfung des Formulars wie die API, Feldfehler am Feld mit Fokus, Feldfehler eines 422 |
| `src/ui/texts.test.ts` | Eszett, «Mandant»/«Tenant», Sie-Form |

**Playwright** (11 Tests gegen den echten Stack auf Port 8090, [einrichtung.md › E2E](einrichtung.md#e2e)):

| Datei | Inhalt |
|---|---|
| `e2e/anmeldung.spec.ts` | Anmeldung als Organisations-Admin, Abmelden, Betrieb ohne Organisation erreicht die Plattform-Administration |
| `e2e/projekt.spec.ts` | Anlegen, bearbeiten, löschen; Konflikt 412 aus zwei Browsern; Leser:in ohne Schreibknöpfe |
| `e2e/organisation.spec.ts` | zweite Organisation sieht nichts |
| `e2e/barrierefreiheit.spec.ts` | axe hell und dunkel (Liste, Formular, Schublade, Befehlspalette), Fokusfalle, 390 px |

Ohne `npx playwright install` lässt sich ein vorhandenes Chromium mit `E2E_CHROMIUM=<pfad>` verwenden (z. B.
`E2E_CHROMIUM=/opt/pw-browsers/chromium`).

## Neues Feature

Ordner `web/src/features/<name>/` mit `index.ts`, Route und `SHELL`-Einträge in `router.tsx`, Suchparameter in
`search.ts`, danach `npm run api:types` und `npm run check`
([zielarchitektur.md › Checkliste](zielarchitektur.md#checkliste-neues-modul-anlegen)).
