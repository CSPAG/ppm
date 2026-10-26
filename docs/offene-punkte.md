# Offene Punkte

Stand: 26.10.2026, Abschluss des Grundgerüsts (Schritt 10 der Boilerplate-Spezifikation). Nummern bleiben stabil;
Erledigtes wird durchgestrichen, nicht entfernt.

| # | Punkt | Bereich |
|---|---|---|
| 1 | Abgleich mit der Vorlage Assets | Zugänge, Infrastruktur, Betrieb |
| 2 | Hetzner: Werte des bestehenden Projekts fehlen | Zugänge, Infrastruktur, Betrieb |
| 3 | `identity.app.json`: Betrieb, erste Organisation, State | Zugänge, Infrastruktur, Betrieb |
| 4 | Realm `ppm` in Produktion anlegen | Zugänge, Infrastruktur, Betrieb |
| 5 | Repository-Secret `NPM_READ_TOKEN` | Zugänge, Infrastruktur, Betrieb |
| 6 | Lockfiles ohne `resolved`/`integrity` für `@vollholz/*` | Zugänge, Infrastruktur, Betrieb |
| 7 | Rate-Limit erst nach der Anmeldung | Entscheidung im Code |
| 8 | Löschen eines Mandanten | Entscheidung im Code |
| 9 | Beispieljob `projekt.summary` | Entscheidung im Code |
| 10 | Audit der MCP-Werkzeugaufrufe | Entscheidung im Code |
| 11 | Lokaler Realm mit breiteren Rollen | Entscheidung im Code |
| 12 | Keycloak lokal: Image von Docker Hub statt quay.io | Zugänge, Infrastruktur, Betrieb |
| 13 | Commits nach der Umsetzung aufgeteilt | Ablauf |
| 14 | Erster CI-Lauf | Zugänge, Infrastruktur, Betrieb |
| 15 | Fachmodule | Entscheidung im Code |
| 16 | DNS-Zone `project-suite.ch` | Zugänge, Infrastruktur, Betrieb |
| 17 | Voller Rauchtest nach dem Deploy | Zugänge, Infrastruktur, Betrieb |
| 18 | Liste der App-Tabellen beim Löschen eines Mandanten (geprüft, Abweichung von Kriterium 7) | Entscheidung im Code |
| 19 | Aufbewahrung der Webhook-Zustellungen | Entscheidung im Code |
| 20 | Abkündigung (`Deprecation`/`Sunset`) | Entscheidung im Code |
| 21 | ESLint 10 statt 9 | Webapp |
| 22 | Sourcemaps im Produktions-Build | Webapp |
| 23 | «Zugriff» für alle Lesenden sichtbar | Webapp |

### 1. Abgleich mit der Vorlage Assets

- **Was:** Das Gerüst folgt der Boilerplate-Spezifikation und identity-kit; die Vorlage `vollholz/assets` war in der
  Session nicht zugänglich.
- **Warum offen:** Details, die die Spezifikation nur mit «wie Assets» beschreibt (z. B. Runbooks, Kustomize-Overlays,
  Texte der Webapp), sind nach bestem Wissen umgesetzt, aber nicht verglichen.
- **Wer / Nächster Schritt:** Entwicklung mit Zugang zu Assets: Querschnitt (`http/app.ts`, `worker/`, `ops/`,
  `deploy/`, `.github/workflows/`) gegen Assets abgleichen, Abweichungen hier festhalten oder übernehmen.

### 2. Hetzner: Werte des bestehenden Projekts fehlen

- **Was:** Gewählt ist das bestehende Hetzner-Projekt. Es fehlen Projekt-Zugang (API-Tokens), Standort und
  Servertypen, SSH-Schlüssel, ggf. bestehendes Netz, Object-Storage-Buckets (State, pgBackRest) und Zugänge, DNS-Zone,
  `ADMIN_CIDRS`, die age-Schlüssel für SOPS (Platzhalter in [`.sops.yaml`](../.sops.yaml)), die verschlüsselten
  Geheimnisse `deploy/hetzner/secrets/app.enc.yaml` und `db.enc.yaml`, `ACME_EMAIL` in
  [`deploy/hetzner/prod.env`](../deploy/hetzner/prod.env) sowie alle Variablen und Secrets der Environments
  `production` und `infra-plan`.
- **Warum offen:** Keine IDs oder Schlüssel erfinden; im Repository stehen nur Variablen und Platzhalter. Der
  Deploy-Workflow bricht ab, solange `prod.env` Platzhalter enthält.
- **Wer / Nächster Schritt:** Betrieb nach [`deploy/hetzner/README.md`](../deploy/hetzner/README.md) › «Bestehendes
  Hetzner-Projekt anbinden», Schritte 1–6. Dabei die Platzhalter-Adressbereiche abgleichen: `10.20.0.0/16` in
  [`deploy/hetzner/db/pg_hba.conf`](../deploy/hetzner/db/pg_hba.conf) mit `network_ip_range`, `192.0.2.0/24` in
  [`deploy/k8s/networkpolicy.yaml`](../deploy/k8s/networkpolicy.yaml) (nur bei Kubernetes).

### 3. `identity.app.json`: Betrieb, erste Organisation, State

- **Was:** Im Manifest fehlen `operators` (E-Mail des Betriebskontos), `organizations` (Alias, Name und Admin der
  ersten Organisation) und `state` (S3-Bucket, Region, Endpoint für den OpenTofu-State des Realms).
- **Warum offen:** Optionale Parameter der Spezifikation, nicht angegeben.
- **Wer / Nächster Schritt:** Produktverantwortung nennt die Werte; Eintrag in [`identity.app.json`](../identity.app.json),
  `npm run identity:sync`, danach `npm run identity:first-org` ([betrieb.md](betrieb.md#konto-des-betriebs-und-erste-organisation)).
  Betrieb und Organisation nie mit derselben Adresse.

### 4. Realm `ppm` in Produktion anlegen

- **Was:** Der Realm auf `https://id.project-suite.ch` existiert noch nicht.
- **Warum offen:** Braucht den Betreiber der Keycloak-Instanz und Schlüssel, die nicht ins Repository gehören.
- **Wer / Nächster Schritt:**
  1. Öffentlichen Schlüssel `ppm-tofu` (von `create-iam-app keys`, liegt nur lokal unter `~/.identity/ppm/`) an den
     Betreiber von id.project-suite.ch; dieser legt im Realm `master` den Service Account `ppm-tofu` mit nur
     `create-realm` an.
  2. Lokal `infra/keycloak/kc.sh bootstrap init && infra/keycloak/kc.sh bootstrap apply` (Realm `ppm`, Client
     `ppm-iac`); der Schlüssel von `ppm-tofu` bleibt lokal, nie als CI-Secret.
  3. Betreiber gibt `ppm-iac` im Realm `ppm` die Rolle `realm-management/realm-admin`.
  4. Secrets im Environment `production`: `KEYCLOAK_IAC_PRIVATE_KEY`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`,
     `TF_STATE_PASSPHRASE`; dann Workflow «Keycloak» › `apply`.
  Vorlage: identity-kit `docs/neue-app.md` › 3 und 3a.

### 5. Repository-Secret `NPM_READ_TOKEN`

- **Was:** CI und Image-Build lesen `@vollholz/*` aus GitHub Packages. Das Repository liegt unter `CSPAG/ppm`,
  ausserhalb von `vollholz`; dort reicht `GITHUB_TOKEN` nicht (403).
- **Warum offen:** Token muss jemand mit Zugang zu `vollholz` ausstellen.
- **Wer / Nächster Schritt:** Persönliches Token (classic) mit nur `read:packages` als Repository-Secret
  `NPM_READ_TOKEN` hinterlegen ([`ci.yml`](../.github/workflows/ci.yml), Kopf).

### 6. Lockfiles ohne `resolved`/`integrity` für `@vollholz/*`

- **Was:** `package-lock.json` und `web/package-lock.json` enthalten für `@vollholz/*` weder `resolved` noch
  `integrity`.
- **Warum offen:** In der Session wurden die Pakete über die lokale Registry von identity-kit installiert; deren
  Pakete sind nicht byte-gleich mit den veröffentlichten ([einrichtung.md](einrichtung.md#ohne-zugang-zu-github-packages)).
- **Wer / Nächster Schritt:** Entwicklung: einmal `npm install` und `npm install --prefix web` mit echtem Zugang,
  Lockfiles committen; `npm audit signatures` in CI prüft danach auch diese Pakete.

### 7. Rate-Limit erst nach der Anmeldung

- **Was:** Das Rate-Limit greift im `preHandler`, also nach der Anmeldung (Schlüssel je Principal in der
  Organisation). Anfragen ohne gültige Anmeldung scheitern vorher mit 401 und werden nicht gezählt.
- **Warum offen:** So zählt das Limit je Principal statt je IP; ungültige Tokens kosten aber Prüfaufwand ohne Grenze.
- **Wer / Nächster Schritt:** Betrieb: Begrenzung je IP davor in Caddy bzw. im Ingress prüfen und einrichten.

### 8. Löschen eines Mandanten

- **Was:** `tenant delete` löscht nur die Fachdaten der App und sperrt den Mandanten; Principals, Tupel und Protokoll
  des Baukastens bleiben als Nachweis. Der Dienst `tenant` in `compose.prod.yaml` hat kein `DATABASE_SUPERUSER_URL`.
- **Warum offen:** Aufbewahrungsfrist des Protokolls und vollständiges Löschen (inkl. Organisation in Keycloak,
  Sicherungen) sind rechtlich und betrieblich zu entscheiden.
- **Wer / Nächster Schritt:** Produktverantwortung mit Datenschutz: Frist festlegen; danach vollständiges Löschen im
  Baukasten bzw. als Runbook ergänzen.

### 9. Beispieljob `projekt.summary`

- **Was:** Der Job des Beispielmoduls ist `projekt.summary` (langer Lauf mit 202 und `/v1/vorgaenge/{id}`) statt eines
  Aufräumjobs wie in der Spezifikation (`<beispiel>.cleanup`).
- **Warum offen:** Der Verlauf `projekt_version` wird nur angehängt; es gibt im Beispiel nichts aufzuräumen.
- **Wer / Nächster Schritt:** Entwicklung: Ein echter Fachjob kommt mit dem ersten Fachmodul.

### 10. Audit der MCP-Werkzeugaufrufe

- **Was:** Jeder Werkzeugaufruf wird nur als strukturierte Logzeile (`audit: "mcp.tool"`) festgehalten, nicht im
  `audit_log`.
- **Warum offen:** Der MCP-Dienst hat bewusst keine Datenbank; schreibende Werkzeuge protokolliert die API selbst
  (Quelle `mcp`). Lesende Aufrufe sind damit nur im Log nachvollziehbar.
- **Wer / Nächster Schritt:** Betrieb: Logzeilen mit `audit` in die zentrale Ablage übernehmen und aufbewahren; falls
  nötig, später einen Audit-Endpunkt der API für den MCP-Dienst vorsehen.

### 11. Lokaler Realm mit breiteren Rollen

- **Was:** `keycloak:setup` gibt den Service Accounts `ppm-admin` und `ppm-sync` breitere Rollen von
  `realm-management` (`manage-realm`, `manage-users`, `view-users`, `query-users`, `view-realm`,
  `manage-identity-providers` bzw. `manage-realm`, `view-users`, `query-users`, `view-realm`) als das Realm-Modul in
  Produktion (Fine-Grained Admin Permissions).
- **Warum offen:** Nur lokal, damit der Realm ohne OpenTofu entsteht; Fehler aus fehlenden Rechten zeigen sich so
  erst in Produktion.
- **Wer / Nächster Schritt:** Entwicklung: lokalen Realm bei Gelegenheit über das Realm-Modul (`kc.sh` gegen den
  lokalen Keycloak) anlegen oder die Rollen angleichen.

### 12. Keycloak lokal: Image von Docker Hub statt quay.io

- **Was:** [`deploy/compose.dev.yaml`](../deploy/compose.dev.yaml) nimmt Keycloak 26.8.1 per Digest von `quay.io`
  (wie identity-kit). In der Session war nur Docker Hub erreichbar (`KEYCLOAK_IMAGE=keycloak/keycloak:26.8.1`, ohne
  Digest).
- **Warum offen:** Der lokale Stack ist in der Session nur mit dem Ersatz-Image geprüft.
- **Wer / Nächster Schritt:** Entwicklung: einmal mit dem Standard-Image (`quay.io`, Digest) `npm run dev:setup` und
  `npm run e2e` laufen lassen.

### 13. Commits nach der Umsetzung aufgeteilt

- **Was:** Die Commits der Schritte 2–6 und 8 wurden nach der Umsetzung in Schritte aufgeteilt.
- **Warum offen:** Geprüft ist der Endstand (`npm run check`), nicht jeder Zwischenstand einzeln.
- **Wer / Nächster Schritt:** Keiner nötig, solange auf dem Endstand aufgebaut wird; ein `git bisect` über diese
  Commits kann auf Zwischenstände treffen, die nicht für sich grün sind.

### 14. Erster CI-Lauf

- **Was:** Image-Build, Trivy, OSV-Scanner, kubeconform, `caddy validate`, Push nach GHCR mit Provenienz und
  Signatur sind geschrieben, aber noch nie gelaufen.
- **Warum offen:** Erst der erste Lauf auf GitHub prüft sie (Abnahmekriterium 3).
- **Wer / Nächster Schritt:** Entwicklung: ersten Pull Request öffnen (nach Punkt 5), Befunde beheben; danach auf
  `main` die Veröffentlichung prüfen.

### 15. Fachmodule

- **Was:** Die Fachmodule gemäss [PPM-Master.md](PPM-Master.md) (Zielkette, Portfolios, Phasen und Gates …) sind
  nicht Teil des Gerüsts; vorhanden ist nur das Beispielmodul `projekt`.
- **Warum offen:** Bewusst ausserhalb des Umfangs der Boilerplate.
- **Wer / Nächster Schritt:** Entwicklung: je Fachmodul nach der Checkliste
  [«Neues Modul anlegen»](zielarchitektur.md#checkliste-neues-modul-anlegen); das Beispielmodul danach ersetzen oder
  ausbauen.

### 16. DNS-Zone `project-suite.ch`

- **Was:** [`infra/dns`](../infra/dns) setzt voraus, dass die Zone in der Hetzner Console liegt.
- **Warum offen:** Wo die Zone liegt, ist nicht bekannt.
- **Wer / Nächster Schritt:** Betrieb klärt den DNS-Anbieter; liegt die Zone nicht bei Hetzner, `infra/dns` durch den
  Provider des Anbieters ersetzen oder die Einträge (A, AAAA, CAA für `ppm.project-suite.ch`) von Hand setzen.

### 17. Voller Rauchtest nach dem Deploy

- **Was:** `deploy.yml` prüft nach `deploy`/`rollback` nur, dass `https://<PPM_DOMAIN>/` mit 200 oder 302 antwortet.
  Den Rauchtest mit Anmeldung (`scripts/smoke.ts`) startet der Betrieb von Hand.
- **Warum offen:** Braucht ein Konto der Zielumgebung mit Passwort als Secret; die Testpersonen gibt es nur lokal.
- **Wer / Nächster Schritt:** Betrieb: Prüfkonto in einer Prüforganisation anlegen, als Environment-Secret
  hinterlegen und `smoke.ts` (mit `SMOKE_WRITE=false`) als Schritt in `deploy.yml` aufnehmen.

### 18. Liste der App-Tabellen beim Löschen eines Mandanten

- **Was:** `APP_TENANT_TABLES` in [`ops/tenants.ts`](../src/platform/ops/tenants.ts) zählt die Tabellen der App von
  Hand auf (Kinder vor Eltern). `rls.test.ts` prüft, dass die Liste genau den Tabellen der `MATRIX` entspricht; ein neues
  Modul ohne Eintrag lässt den Test scheitern. Die Datei steht aber nicht in der Liste von Abnahmekriterium 7.
- **Warum offen:** Abweichung von Abnahmekriterium 7 (eine Datei mehr beim Anlegen eines Moduls).
- **Wer / Nächster Schritt:** Entwicklung: entscheiden, ob die Liste aus dem Katalog abgeleitet wird (Reihenfolge über
  Fremdschlüssel) oder als Schritt in der Checkliste bleibt.

### 19. Aufbewahrung der Webhook-Zustellungen

- **Was:** Die Aufbewahrung (`retention.ts`) löscht erledigte Jobs, verteilte Ereignisse und abgelaufene
  Idempotency-Keys, aber keine Zeilen aus `webhook_delivery`.
- **Warum offen:** Die Zustellungen dienen als Verlauf in der Oberfläche; eine Frist ist nicht festgelegt.
- **Wer / Nächster Schritt:** Produktverantwortung: Frist festlegen (z. B. `JOB_RETENTION`); Entwicklung: Löschen in
  `retentionTask` bzw. als feste Aufgabe des Moduls `webhooks` (`TASKS`).

### 20. Abkündigung (`Deprecation`/`Sunset`)

- **Was:** Die Konvention steht in [api.md](api.md); es gibt noch keinen Baustein in `route-kit.ts`, der die Header
  setzt.
- **Warum offen:** Noch ist nichts abgekündigt.
- **Wer / Nächster Schritt:** Entwicklung: beim ersten Wegfall eine Hilfe in `route-kit.ts` ergänzen (Header und
  `deprecated: true` in der OpenAPI).

### 21. ESLint 10 statt 9

- **Was:** Die Webapp nutzt ESLint 10 statt 9 (Spezifikation 5.8). Alle Versionen von ESLint 9.x sind auf npm als
  veraltet markiert. `eslint-plugin-jsx-a11y` 6.10.2 deklariert nur ESLint ≤ 9 als Peer; darum steht ein `overrides`
  in [`web/package.json`](../web/package.json).
- **Warum offen:** Abweichung von der Spezifikation; das Plugin ist für ESLint 10 nicht offiziell freigegeben.
- **Wer / Nächster Schritt:** Entwicklung: Override entfernen, sobald `jsx-a11y` ESLint 10 als Peer nennt. Zurück auf
  ESLint 9.39.5 ist möglich, wenn veraltete Pakete hingenommen werden.

### 22. Sourcemaps im Produktions-Build

- **Was:** Der Produktions-Build erzeugt Sourcemaps (`sourcemap: true` in [`web/vite.config.ts`](../web/vite.config.ts));
  `modules/auth/ui.ts` liefert `.map`-Dateien aus.
- **Warum offen:** Erleichtert die Fehlersuche, legt aber den Quelltext der Oberfläche offen.
- **Wer / Nächster Schritt:** Produktverantwortung entscheidet, ob sie ausgeliefert werden; sonst `sourcemap: false`
  oder `'hidden'` und die Dateien nur für die Fehlerauswertung aufbewahren.

### 23. «Zugriff» für alle Lesenden sichtbar

- **Was:** «Zugriff» (`AccessSheet` von iam-web) sieht jede Person, die das Projekt lesen darf; «Freigeben» ist ohne
  `access:admin` deaktiviert.
- **Warum offen:** Ob Lesende sehen sollen, wer sonst Zugriff hat, ist eine fachliche Entscheidung.
- **Wer / Nächster Schritt:** Produktverantwortung entscheidet; sonst den Knopf in
  [`ProjektDrawer.tsx`](../web/src/features/projekt/ProjektDrawer.tsx) an `access:admin` binden.
