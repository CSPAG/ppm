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
| Stil | Erscheinungsbild der Werkbank aus [vollholz/assets](https://github.com/vollholz/assets) (`web/src/styles/`): Topbar mit Suche als Befehlspalette, Navigation nach Arbeitsräumen (links bzw. unten), Arbeitsfläche als Karte, Schublade rechts; Farb-Tokens hell und dunkel in `src/styles/base.css`, Ergänzungen in `app.css`, `--iam-*` in `iam.css`; Schriften IBM Plex Sans und Mono, Schibsted Grotesk (lokal, `@fontsource`), Icons in `src/ui/icons.ts`; `public/theme.js` setzt das Farbschema vor dem ersten Zeichnen |
| Tests | Vitest + Testing Library; Playwright + axe (WCAG 2.2 AA) |
| Lint | ESLint 9 mit `typescript-eslint`, `react-hooks`, `jsx-a11y` |

## Ordner

| Ordner/Datei | Inhalt |
|---|---|
| `src/main.tsx`, `app.tsx` | Einstieg; Baukasten, Navigation und Shell zusammensetzen |
| `src/nav.ts` | Registrierung der Navigation: Bereiche je Arbeitsraum, Aktionen und Suchen der Befehlspalette, je mit Recht (siehe «Navigation») |
| `src/router.tsx`, `search.ts` | Routen der App und Verwalten-Seiten des Baukastens (`makeIamRoutes`); Suchparameter je Seite |
| `src/api/` | Client mit CSRF, `X-Tenant`, problem+json, 401/403 an die Sitzung; Hilfen für 412, 404, Idempotency-Key |
| `src/auth/` | `IamProvider`, Sitzung, Rechte der App |
| `src/shell/` | AppShell (Topbar, Navigation, Arbeitsfläche), `nav.ts` (Arbeitsräume, Sichtbarkeit nach Recht), Leiste links mit Bereichsleiste, Leiste unten mit «Mehr», Befehlspalette (Strg+K), Hell/Dunkel, NotFound |
| `src/ui/` | Bausteine (siehe «Bausteine der Darstellung»), Overlay mit Fokusfalle, Toasts, Zustände leer/Fehler/laden, Icons, Texte je Sprache (`texte/de-CH.ts`) |
| `src/dev/` | Galerie der Bausteine unter `/dev/galerie`, nur im Entwicklungsbuild (`npm --prefix web run dev`), nicht im Produktionsbuild |
| `src/features/eingang/` | Arbeitsraum «Eingang» (`/eingang`, Startseite jeder Rolle, UI-01): Kopf mit Aufgaben und Vertretung, Kopfkarten der Module (`kopf.ts`, eine Zeile je Modul), «Zu tun» nach Frist mit Direktaktion (`?filter=frist`), Mitteilungen |
| `src/features/konto/` | Kontomenü › Profil mit Stellvertretung (`/konto/stellvertretung`, UI-43): Liste, Erfassen in der Schublade (`?o=neu`) mit Personensuche, Beenden mit Rückfrage |
| `src/features/handlungsfeld/` | Arbeitsraum «Ziele» › Handlungsfelder (`/ziele/handlungsfelder`): Liste mit Suche und Cursor, Schublade über `?o=<id>` (`?o=neu` zum Anlegen), Bearbeiten mit 412-Hinweis, Löschen, Verlauf |
| `src/features/stammdaten/` | Arbeitsraum «Administration» › Organisation (`/administration/organisation`, Ansichten Einheiten und Feiertage über `?ansicht=feiertage`) und Codetabellen (`/administration/codetabellen`, Werte in der Schublade `?o=<tabelle>`), UI-44, UI-45; Bereiche sichtbar mit `stammdaten:write` |
| `src/features/phasenmodell/` | Arbeitsraum «Administration» › Phasenmodell (`/administration/phasenmodell`, UI-46): Arbeitsfläche mit Version (`?v=`) und Abschnitt (`?e=`), automatischem Speichern, Rückgängig/Wiederholen, Prüfbericht, Entwurf anlegen, verwerfen und in Kraft setzen |
| `src/features/bericht/` | Projekte › Projekt › Bericht (`/projekte/<nr>/bericht?periode=2026-10`, UI-13, K1): Arbeitsfläche mit Vorbelegung aus Vorperiode und Registern, Meilensteine, Kosten, Risiken, Kommunikation, KPIs (ab P2) und Beurteilung, automatischem Speichern, Seitenpanel «Bereit zum Einreichen», Einreichen mit Rückgängig (10 s); Befehlspalette «Statusbericht erstellen» mit Projektwahl |
| `src/styles/`, `src/test/`, `e2e/` | Tokens und Layout; Testhilfen; Playwright-Tests |

## Regeln

- **Modulgrenzen** ([zielarchitektur.md](zielarchitektur.md#modulgrenzen)): Features nutzen nur `ui/`, `api/`, `auth/`;
  sie kennen Shell und Router nicht (Navigation über Suchparameter). Gemeinsame Bausteine kennen keine Features.
- **Same-origin:** keine absoluten Adressen in `fetch`, `EventSource`, `WebSocket`, `sendBeacon`; keine externen
  `src`/`href` im Build (`scripts/check-network.ts`). CSP der Oberfläche ohne `unsafe-inline`, `connect-src 'self'`.
- **Texte:** zentral je Sprache in `src/ui/texte/` (`de-CH.ts`, Typ `Texte`; bis zur Klärung von UX-OF-2 nur Deutsch); Anrede «Sie» (UX-E7, bis zur Klärung von UX-OF-1), Schweizer Rechtschreibung, «Organisation» statt «Mandant»
  (`src/ui/texte/texte.test.ts`, `scripts/check-address.ts`); Begriffe aus dem Glossar der UX-Schicht ([ux/README.md](ux/README.md#glossar-der-oberfläche)).
- **Barrierefreiheit:** alles per Tastatur, Fokus in Dialogen gefangen und zurückgegeben, hell und dunkel, ab 360 px
  Breite; axe in jedem E2E-Test.

## Navigation

Nach Arbeitsräumen ([ux/informationsarchitektur.md](ux/informationsarchitektur.md#navigation), UX-E2): Eingang, Projekte,
Portfolio, Gremien, Ziele, Administration, in dieser Reihenfolge (`src/shell/nav.ts`). Ein Arbeitsraum erscheint nur, wenn die
Person mindestens einen seiner Bereiche sehen darf (I-N2); leere Arbeitsräume gibt es nicht.

| Breite | Darstellung |
|---|---|
| ab 1024 px | Leiste links mit Namen, darunter die Bereiche des aktiven Arbeitsraums |
| 768–1023 px | schmale Leiste mit Symbol und Name; Bereiche als Leiste über der Arbeitsfläche |
| unter 768 px | Leiste unten mit den ersten drei sichtbaren aus Eingang, Projekte, Gremien (sonst die nächsten), dazu «Mehr» als Blatt von unten mit den übrigen Arbeitsräumen und dem Konto (Person, Organisation, Farbschema, Meine Rollen und Rechte, Organisation wechseln, Abmelden) |

**Ein Feature trägt sich in `src/nav.ts` ein**, die Shell kennt keine Features:

```ts
bereiche: [{ raum: 'ziele', pfad: '/ziele/handlungsfelder', label: T.bereich.handlungsfelder, recht: 'handlungsfeld:read' }],
aktionen: [{ id: 'handlungsfeld-anlegen', label: T.aktion.handlungsfeldAnlegen, icon: 'plus', pfad: '/ziele/handlungsfelder?o=neu', recht: 'handlungsfeld:write' }],
suchen: [{ id: 'handlungsfelder', recht: 'handlungsfeld:read', suchen: (q, signal) => … }],
```

- **Bereiche** (I-N5 `/<arbeitsraum>/<bereich>`) erscheinen mit dem Recht irgendwo (`canSomewhere`); das Ziel eines
  Arbeitsraums ist sein erster sichtbarer Bereich. Die Verwalten-Seiten des Baukastens (`useIamNav()`, nach Recht) sind
  die Bereiche der Administration; ihre Adressen bleiben `/verwalten/*`, weil `ENTRA_UI_PATH` des Servers daran hängt.
- **Aktionen** der Befehlspalette (I-N4) erscheinen mit dem Recht an der Organisation (`can`), Verb + Objekt (I-X1).
- **Suchen** nach Objekten laufen ab zwei Zeichen mit dem Recht irgendwo; was die Person sieht, entscheidet die API.

## Bausteine der Darstellung

Aus [ux/darstellung.md](ux/darstellung.md), exportiert über `src/ui/index.ts`, mit Vitest und axe getestet
(`src/ui/*.test.*`), alle zusammen in der Galerie (`/dev/galerie`). Features bauen sie nicht nach.

| Baustein | Inhalt |
|---|---|
| `Status`, `TrendPfeil` | Projektstatus als Kreis mit Symbol und Text (Im Plan, Kritisch, Nicht gemeldet mit Vorperiode), Wechsel «Im Plan → Kritisch», Trend mit Text für Bildschirmleser; `kompakt` für enge Spalten |
| `Stand` | Bearbeitungsstand als Badge mit Rahmen: Familien Entwurf, wartet, traktandiert, positiv, negativ, ruhend, gesperrt |
| `ProjektKlein`, `ProjektListe`, `PhaseKurz`, `Merkmale` | Projekt klein und mittel (Dashboard-Zeile), auf dem Telefon als Karte |
| `fmt…` in `format.ts` | Datum zum Planen, Frist relativ (≤ 14 Tage) und in Arbeitstagen, Zeitpunkt, Periode, Quartal, Beträge CHF (Detail und kurz), Abweichung, FTE, Phase, Gate |
| `Hinweis`, `Regelmeldung`, `regelText` | Stufen Hinweis, Warnung, Sperre mit Symbol und Text; Text nach I-P2, Quelle einblendbar |
| `Datenliste` | Liste + Schublade mit Zuständen Z1 (Skelett nach 300 ms), Z2, Z3, Z4, Z5 und «Mehr laden»; auf dem Telefon Karten |

## Tests

| Befehl | Inhalt |
|---|---|
| `npm run web:check` | Typen, ESLint, Vitest |
| `npm run e2e` | Playwright gegen den lokalen Stack (Datenbank `ppm_e2e`): Anmeldung, Anlegen/Ändern mit 412/Löschen, zweite Organisation sieht nichts, Leser:in ändert nicht, Navigation nach Recht mit Tastatur, «Mehr» auf dem Telefon, Befehlspalette; axe hell/dunkel, 360 px |

Umgebung der E2E-Tests: `E2E_BASE_URL` (Standard `http://localhost:8080`), `E2E_USER`/`E2E_PASSWORD`,
`E2E_USER_B`/`E2E_PASSWORD_B`, `E2E_USER_C`/`E2E_PASSWORD_C`, `E2E_CHROMIUM`.

## Abgleich OpenAPI ↔ Client

Nach jeder Änderung an Routen: `npm run openapi:export && npm run api:types`. Der Backend-Test
`test/app/webui.test.ts` vergleicht `web/openapi.json` mit der aktuellen Beschreibung; der Typcheck der Webapp
scheitert, wenn der Client nicht mehr zu den Typen passt.
