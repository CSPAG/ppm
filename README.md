# PPM

Strategieumsetzung und Projektportfoliomanagement (PPM), mandantenfähig. Fachliche Spezifikation:
[docs/PPM-Master.md](docs/PPM-Master.md).

Grundgerüst: drei Schichten (Webapp + BFF · API, Worker, MCP · PostgreSQL mit RLS), ein Image, Anmeldung und Rechte
über Keycloak und [`@vollholz/iam`](https://github.com/vollholz/identity-kit).

## Loslegen

Voraussetzungen: Node 24, Docker, `~/.npmrc` mit `//npm.pkg.github.com/:_authToken=<token>` (`read:packages`).

```sh
npm ci
npm run web:install
npm run dev:setup      # .env, PostgreSQL 17 + Keycloak 26, Migrationen, Realm «ppm» mit Testpersonen
npm run web:build
npm run dev:api        # http://localhost:8080, Anmeldung z. B. als anna@demo.example
```

## Dokumentation

| Dokument | Inhalt |
|---|---|
| [docs/zielarchitektur.md](docs/zielarchitektur.md) | Leitentscheidungen, Schichten, Modulgrenzen, Checkliste «Neues Modul anlegen» |
| [docs/einrichtung.md](docs/einrichtung.md) | Lokale Entwicklung, Testpersonen, Fehlersuche |
| [docs/konfiguration.md](docs/konfiguration.md) | Alle Umgebungsvariablen (erzeugt) |
| [docs/betrieb.md](docs/betrieb.md) | Prozesse, Geheimnisse je Dienst, Beenden, Beobachtbarkeit, Runbooks, CI |
| [docs/api.md](docs/api.md) | Konventionen der REST-API |
| [docs/oberflaeche.md](docs/oberflaeche.md) | Aufbau der Webapp |
| [docs/mandantentrennung.md](docs/mandantentrennung.md) | Bedrohungsmodell, Inventar der Tabellen |
| [docs/mcp.md](docs/mcp.md) | MCP-Dienst |
| [docs/identity-kit.md](docs/identity-kit.md) | Anbindung an identity-kit (verwaltet) |
| [docs/offene-punkte.md](docs/offene-punkte.md) | Offene Punkte |
| [docs/PPM-Master.md](docs/PPM-Master.md) | Fachliche Spezifikation |
