# Betrieb auf Hetzner

PPM läuft in einem **eigenen Hetzner-Projekt** mit zwei VMs im privaten Netz:

```text
Internet ──443──▶ App-VM (Caddy, api, worker, mcp; Docker Compose)   10.0.1.10
                      │ privates Netz, TLS verify-full
                      ▼
                  DB-VM (PostgreSQL 17, pgBackRest → Object Storage) 10.0.1.20   (von aussen gesperrt)
```

| Teil | Wo |
|---|---|
| Server, Netz, Firewall, Volume | `infra/hetzner/` (OpenTofu, Workflow «Infrastruktur») |
| DNS `ppm.project-suite.ch` | Zone `project-suite.ch` bei Infomaniak, `infra/dns/` aus `tofu output dns` (Schritt 7) |
| Compose, Caddy, Wartungsseite | `deploy/compose.prod.yaml`, `deploy/caddy/` |
| Rollout, Rollback, Wartung | `deploy/hetzner/rollout.sh` → `ppm-ssh-gate.sh` auf der App-VM, Workflow «Deploy» |
| Datenbank, Backup, PITR | `deploy/hetzner/db/` |
| Geheimnisse | `deploy/hetzner/secrets.sops.yaml` (App, DB-VM) und `infra/hetzner/betrieb.sops.yaml` (Zugänge des Betriebs, nur Empfänger «betrieb»); SOPS mit age, `.sops.yaml` |

## Neues Hetzner-Projekt einrichten

Einmalig, in dieser Reihenfolge. Werte in `‹…›` setzt die Person, die einrichtet; nichts davon steht im Repository.
Wer was tut (Person, Cloud-Session, lokale Session), die Standardwerte und die Stolpersteine stehen im Playbook
[identity-kit › docs/hetzner-einrichten.md](https://github.com/vollholz/identity-kit/blob/main/docs/hetzner-einrichten.md);
die Schritte mit SSH für die lokale Session in [lokale-session.md](lokale-session.md). Das Repository liegt bei
**CSPAG** (`--repo CSPAG/ppm`, Image `ghcr.io/cspag/ppm`, privat).

1. **Projekt anlegen** in der Hetzner Cloud Console: «ppm». Unter *Sicherheit › API-Tokens* ein Token
   (Lesen & Schreiben): `‹HCLOUD_TOKEN›` für OpenTofu. Als Secret `HCLOUD_TOKEN` im Environment `production` des
   Repositorys und lokal nur in der Shell (`export HCLOUD_TOKEN=…`).
2. **Object Storage** im Projekt aktivieren (Standort wie die Server, Standard `nbg1`) und zwei Buckets anlegen
   (privat):
   - `ppm-tofu-state` – State von OpenTofu (`infra/hetzner`)
   - `ppm-pgbackrest` – Backups und WAL-Archiv der Datenbank
   - Ein Schlüsselpaar (S3) `‹S3_ACCESS_KEY›`/`‹S3_SECRET_KEY›` für beide Buckets und den State des Realms: Secrets im
     Environment `production` und in den SOPS-Dateien (`db.PGBR_S3_*`, `github.S3_*`, Schritt 5). Hetzner beschränkt Schlüssel nicht
     auf einzelne Buckets.
   - Sind die Bucket-Namen vergeben, andere wählen und in `infra/hetzner/backend.hcl` und
     `deploy/hetzner/db/pgbackrest.conf` anpassen.
3. **State-Passphrase** erzeugen (`openssl rand -base64 48`) → Secret `TF_STATE_PASSPHRASE` (Environment
   `production`) und im Passwortmanager des Betriebs. Ohne sie ist der State nicht lesbar.
4. **Server anlegen:**

   ```sh
   cd infra/hetzner
   cp backend.hcl.example backend.hcl && cp terraform.tfvars.example terraform.tfvars   # SSH-Schlüssel, admin_cidrs
   export AWS_ACCESS_KEY_ID=‹S3_ACCESS_KEY› AWS_SECRET_ACCESS_KEY=‹S3_SECRET_KEY› TF_VAR_state_passphrase=‹…›
   tofu init -backend-config=backend.hcl && tofu plan -out=plan && tofu apply plan
   ```

   Danach `tofu output` notieren (IPv4/IPv6 der App-VM). In `terraform.tfvars` (nicht versioniert; für den Workflow
   die Variable `HETZNER_TFVARS`): `ssh_keys` der Betriebspersonen (Benutzer `betrieb` auf der App-VM, root auf der
   DB-VM), `deploy_ssh_public_key` des Workflows (Benutzer `deploy`, Schritt 8) und `admin_cidrs`. Weil GitHub-Runner
   keine festen Adressen haben, ist SSH auf der App-VM offen (`["0.0.0.0/0", "::/0"]`), nur mit Schlüssel.
   Neue Projekte haben tiefe Limits (Primary IPs, vCPU): für zwei cx33 mindestens 4 Primary IPs und 8 vCPU
   (Console › Limits).
5. **Geheimnisse (SOPS):** age-Schlüssel je Betriebsperson und einen für den Deploy-Workflow erzeugen (Kopf von
   `.sops.yaml`), die öffentlichen Teile in `.sops.yaml` statt der Platzhalter eintragen, den privaten Deploy-Schlüssel
   als Secret `SOPS_AGE_KEY` (Environment `production`). Dann
   `cp deploy/hetzner/secrets.sops.yaml.example deploy/hetzner/secrets.sops.yaml`, Werte eintragen, verschlüsseln
   (`sops --encrypt --in-place …`) und einchecken. Die privaten Schlüssel der Keycloak-Clients stammen aus
   `npx create-iam-app keys` (`~/.identity/ppm/`). Alles, was der Betrieb sonst noch braucht (Werte der
   GitHub-Secrets, SSH-Schlüssel, Schlüssel `ppm-tofu` für den Bootstrap des Realms), steht verschlüsselt in
   `infra/hetzner/betrieb.sops.yaml` (`sops -d infra/hetzner/betrieb.sops.yaml`).

   | Abschnitt in `betrieb.sops.yaml` | Inhalt | Verwendung |
   |---|---|---|
   | `github` | `HCLOUD_TOKEN`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `TF_STATE_PASSPHRASE`, `INFOMANIAK_API_TOKEN`, `SOPS_AGE_KEY`, `DEPLOY_SSH_KEY`, `KEYCLOAK_IAC_PRIVATE_KEY` | Secrets im Environment `production` ([lokale-session.md › Schritt 8](lokale-session.md#schritt-8-github-environment-production)) |
   | `variablen` | `HETZNER_BACKEND_HCL`, `HETZNER_TFVARS`, `APP_HOST`, `ACME_EMAIL` | Variablen im Environment `production` (keine Geheimnisse, der Einfachheit halber mit abgelegt) |
   | `lokal` | `ssh_betrieb_private_key`, `ssh_betrieb_public_key`, `ssh_deploy_public_key`, `keycloak_tofu_private_key`, `keycloak_tofu_public_jwks` | nur lokal: SSH als `betrieb`, Bootstrap des Realms |
6. **DB-VM einrichten** (über die App-VM als Sprungserver, die DB-VM hat kein öffentliches SSH):

   ```sh
   ssh -J betrieb@‹app-ipv4› root@10.0.1.20 mkdir -p /root/ppm-db
   scp -J betrieb@‹app-ipv4› -r deploy/hetzner/db db/bootstrap.sql root@10.0.1.20:/root/ppm-db/
   sops exec-env deploy/hetzner/secrets.sops.yaml \
     'ssh -J betrieb@‹app-ipv4› root@10.0.1.20 "cd /root/ppm-db && OWNER_PW=$db_OWNER_PW …  sh db/setup.sh"'
   ```

   `setup.sh` legt TLS (eigene CA, Zertifikat für `db.ppm.internal`), Rollen (`db/bootstrap.sql`),
   pgBackRest (Stanza, Prüfung) und die Backup-Timer an. Den Inhalt von `/etc/postgresql/17/main/tls/ca.crt` als
   `app.database_ca` in die SOPS-Datei übernehmen (`sops edit deploy/hetzner/secrets.sops.yaml`).
7. **DNS:** Die Zone `project-suite.ch` liegt bei Infomaniak. `infra/dns/dns.sh` setzt die Einträge aus
   `tofu output dns` über die Infomaniak-API und verwaltet nur den Namen `ppm`; alle anderen Einträge der Zone
   (z. B. `identity`) bleiben unberührt. API-Token (Infomaniak Manager › API, Recht nur «dns») als Secret
   `INFOMANIAK_API_TOKEN` (Environment `production`); der Workflow «Infrastruktur» gleicht nach jedem `apply` ab.
   Von Hand (im Verzeichnis `infra/hetzner` nach `tofu init`, Schritt 4):

   ```sh
   export INFOMANIAK_API_TOKEN=‹…›
   ../dns/dns.sh --dry-run   # Abweichungen zeigen (Exit 2 = Abweichungen)
   ../dns/dns.sh apply
   ```

   | Name | Typ | Wert | TTL |
   |---|---|---|---|
   | `ppm` | A | `‹app_ipv4›` | 300 |
   | `ppm` | AAAA | `‹app_ipv6›` | 300 |
   | `ppm` | CAA | `0 issue "letsencrypt.org"` (nur Let's Encrypt stellt Zertifikate aus) | 300 |

   Ändert sich die App-VM (neue IP), führt der nächste `apply` die Einträge nach. MCP läuft unter demselben Namen
   (`/mcp`). DNS muss vor dem ersten Rollout stimmen, sonst bekommt Caddy kein Zertifikat.
8. **Deploy-Zugang:** Einen SSH-Schlüssel nur für den Workflow erzeugen; der öffentliche Teil steht in
   `deploy_ssh_public_key` (Schritt 4), cloud-init legt ihn mit `restrict` beim Benutzer `deploy` ab. sshd erzwingt
   für `deploy` den Befehl `ppm-ssh-gate` (wie `identity-ssh-gate` in vollholz/identity): erlaubt sind nur
   `deploy <image@sha256:…>` (Bündel auf stdin), `registry-login <benutzer>` (Token auf stdin), `registry-logout`,
   `rollback`, `maintenance-on`, `maintenance-off`, `status`; keine Shell, kein TTY, keine Weiterleitungen, `deploy`
   ist nicht in der Gruppe `docker`. Weil das Image auf ghcr.io privat ist, meldet der Workflow «Deploy» die VM vor
   `deploy`/`rollback` mit seinem kurzlebigen `GITHUB_TOKEN` an (`registry-login`, wie `assets-ssh-gate` in
   vollholz/assets) und danach immer ab; ein dauerhaftes Token liegt nie auf der VM. Den privaten Teil als Secret
   `DEPLOY_SSH_KEY`, `ssh-keyscan ppm.project-suite.ch` (der Name aus `APP_HOST`, nicht die IP) als Variable
   `DEPLOY_KNOWN_HOSTS`, Variable `APP_HOST=deploy@ppm.project-suite.ch` und `ACME_EMAIL` (Environment
   `production`). Ändert sich
   `deploy/hetzner/ppm-ssh-gate.sh`, als `betrieb` neu einspielen (cloud-init läuft nur beim Anlegen):
   `sudo install -m 0755 ppm-ssh-gate.sh /usr/local/sbin/ppm-ssh-gate`.
9. **Erster Rollout:** Workflow «Deploy» mit Aktion `deploy` und dem Digest aus dem Lauf «CI» auf `main`. Danach
   Realm (Workflow «Keycloak») und erste Organisation (`npm run identity:first-org`, docs/identity-kit.md).
10. **Wiederherstellung üben:** einmal PITR auf eine Wegwerf-VM (unten), Ergebnis in `docs/betrieb.md` festhalten.

## Täglicher Betrieb

| Aufgabe | Wie |
|---|---|
| Neue Version | Workflow «Deploy» › `deploy` mit dem Digest des gewünschten Commits (unten «Digest finden»); Migrationen laufen vorher (`migrate`) |
| Zurück | «Deploy» › `rollback` (vorheriges Image; Migrationen bleiben, deshalb nur vorwärts verträgliche Schemaänderungen) |
| Wartungsseite | «Deploy» › `maintenance-on` / `maintenance-off` (Caddy antwortet 503 mit Wartungsseite) |
| Zustand | «Deploy» › `status` |
| Geheimnis, Caddy oder Compose ändern | PR, danach «Deploy» › `deploy`. Mit dem laufenden Digest (`status`) bleibt der Code der App alt; soll er mitkommen, den Digest des neuesten `main` nehmen |

### Digest finden

Das Formular von «Deploy» hat keine Vorgabe: Der Digest muss jedes Mal zum gewünschten Commit passen.

- Lauf «CI» des Commits auf `main` (grün), Job «Image (Build, Rauchtest, Scan, SBOM, Signatur)»: Die Zusammenfassung des
  Laufs zeigt unter «Image» `ghcr.io/cspag/ppm@sha256:…`. Nur ein solcher Digest besteht `cosign verify` in «Deploy».
- Der Tag `ghcr.io/cspag/ppm:sha-<commit>` (Package auf GitHub) zeigt auf denselben Digest. Das Formular nimmt nur den
  Digest, nicht den Tag.
- `status` zeigt den Digest, der gerade läuft. Mit ihm bleibt der Code der App beim alten Stand, auch wenn der Workflow
  von einem neueren `main` läuft: «Deploy» liefert Bundle (Compose, Caddy, Geheimnisse) aus dem Workflow-Stand, das Image
  aber nur aus der Eingabe.

## Backup und Wiederherstellung (PITR)

- pgBackRest: volles Backup sonntags, differenziell Mo–Sa (02:15), WAL laufend (`archive_timeout` 60 s);
  Aufbewahrung 4 volle, 14 differenzielle; verschlüsselt (`repo1-cipher-pass`).
- Prüfen: `sudo -u postgres pgbackrest --stanza=ppm info`.
- Zeitpunkt wiederherstellen (auf der DB-VM oder einer neuen):

  ```sh
  systemctl stop postgresql@17-main
  sudo -u postgres pgbackrest --stanza=ppm --delta --type=time --target="2026-10-26 14:00:00+01" \
    --target-action=promote restore
  systemctl start postgresql@17-main
  ```

  Vorher die App auf Wartung stellen (`maintenance-on`), danach Rauchtest (`npm run smoke`) und `maintenance-off`.
