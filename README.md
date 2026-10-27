# PPM

Strategieumsetzung und Projektportfoliomanagement (PPM) für Organisationen: Zielmanagement, Demand Management,
Portfolioplanung und -steuerung, Portfoliocontrolling, Ressourcen. Fachgrundlage: [Masterdokument](docs/PPM-Master.md)
mit [Funktionsbaum](docs/anhang/funktionsbaum.md), [Use Cases](docs/anhang/use-cases.md) und
[UX-Schicht](docs/ux/README.md).

Das Repository enthält neben der Spezifikation das technische **Grundgerüst** der App (mandantenfähig, Anmeldung und
Rechte über [identity-kit](https://github.com/vollholz/identity-kit), Querschnitt aus `@vollholz/platform`, ein Image,
Qualitäts-Gates). Fachlich enthält es zunächst nur das Beispielmodul **Handlungsfelder** (BC ZM.01.01); weitere Module
entstehen nach den Etappen im [Fahrplan](docs/ux/fahrplan.md) und der
[Checkliste](docs/zielarchitektur.md#checkliste-neues-modul-anlegen).

## Loslegen

Voraussetzungen: Node 24, npm ≥ 11, Docker, ein GitHub-Token (classic, nur `read:packages`) in `~/.npmrc`:
`//npm.pkg.github.com/:_authToken=<token>`.

```sh
npm ci && npm run web:install      # Abhängigkeiten (Backend, Webapp)
npm run dev:setup                  # .env, PostgreSQL 17 + Keycloak 26, Migrationen, Realm mit Testpersonen
npm run web:build                  # Oberfläche bauen (oder: npm --prefix web run dev)
npm run dev:api                    # http://localhost:8080 – Anmeldung als anna@demo.example / ppm-demo
npm run check                      # vor jedem Push: Typen, Modulgrenzen, Tests, Webapp
```

## Dokumentation

| Dokument | Inhalt |
|---|---|
| [docs/PPM-Master.md](docs/PPM-Master.md) | Fachliche Spezifikation (führend): Auftrag, Akteure, Funktionsbaum, Use Cases, Entscheide, offene Punkte |
| [docs/ux/](docs/ux/README.md) | UX-Schicht: Arbeitsräume, Kernabläufe K1–K6, Darstellung, Fahrplan |
| [docs/zielarchitektur.md](docs/zielarchitektur.md) | Anforderungen, Leitentscheidungen, Schichten, Modulgrenzen, Checkliste «Neues Modul», offene Entscheidungen |
| [docs/einrichtung.md](docs/einrichtung.md) | Lokale Umgebung, Keycloak, erste Organisation |
| [docs/konfiguration.md](docs/konfiguration.md) | Alle Umgebungsvariablen (erzeugt) |
| [docs/betrieb.md](docs/betrieb.md) | Prozesse, Geheimnisse je Dienst, Beenden, Beobachtbarkeit, Runbooks, CI |
| [docs/api.md](docs/api.md) | REST-API: Konventionen, Fehler, Paginierung, Idempotenz |
| [docs/oberflaeche.md](docs/oberflaeche.md) | Webapp: Aufbau, Bausteine, Tests |
| [docs/mandantentrennung.md](docs/mandantentrennung.md) | Bedrohungsmodell, Inventar der Tabellen, Prüfungen |
| [docs/mcp.md](docs/mcp.md) | MCP-Dienst: Anmeldung, Token Exchange, Werkzeuge |
| [docs/identity-kit.md](docs/identity-kit.md) | Anbindung an das identity-kit (verwaltet) |
| [docs/offene-punkte.md](docs/offene-punkte.md) | Offene Punkte der Technik und des Betriebs, nummeriert (fachliche: Masterdokument und Klärungsliste) |
| [CLAUDE.md](CLAUDE.md) | Arbeitsregeln |
