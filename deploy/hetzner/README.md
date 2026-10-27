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
| DNS `ppm.project-suite.ch` | Zone `project-suite.ch` bei Hostpoint, von Hand (Schritt 7) |
| Compose, Caddy, Wartungsseite | `deploy/compose.prod.yaml`, `deploy/caddy/` |
| Rollout, Rollback, Wartung | `deploy/hetzner/rollout.sh`, Workflow «Deploy» |
| Datenbank, Backup, PITR | `deploy/hetzner/db/` |
| Geheimnisse | `deploy/hetzner/secrets.sops.yaml` (SOPS mit age, `.sops.yaml`) |

## Neues Hetzner-Projekt einrichten

Einmalig, in dieser Reihenfolge. Werte in `‹…›` setzt die Person, die einrichtet; nichts davon steht im Repository.

1. **Projekt anlegen** in der Hetzner Cloud Console: «ppm». Unter *Sicherheit › API-Tokens* zwei Tokens
   (Lesen & Schreiben): `‹HCLOUD_TOKEN›` für OpenTofu. Als Secret `HCLOUD_TOKEN` im Environment `production` des
   Repositorys und lokal nur in der Shell (`export HCLOUD_TOKEN=…`).
2. **Object Storage** im Projekt aktivieren (Standort wie die Server, Standard `nbg1`) und drei Buckets anlegen
   (privat):
   - `ppm-tofu-state` – State von OpenTofu (`infra/hetzner`)
   - `ppm-pgbackrest` – Backups und WAL-Archiv der Datenbank
   - Schlüsselpaar (S3) je Zweck anlegen: `‹S3_ACCESS_KEY›`/`‹S3_SECRET_KEY›` für den State (Secrets im Environment
     `production`), ein zweites nur für `ppm-pgbackrest` (in die SOPS-Datei, Schritt 5).
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

   Danach `tofu output` notieren (IPv4/IPv6 der App-VM). Die SSH-Schlüssel der Betriebspersonen und `admin_cidrs`
   gehören in `terraform.tfvars` (nicht versioniert) bzw. für den Workflow in die Variable `HETZNER_TFVARS`.
5. **Geheimnisse (SOPS):** age-Schlüssel je Betriebsperson und einen für den Deploy-Workflow erzeugen (Kopf von
   `.sops.yaml`), die öffentlichen Teile in `.sops.yaml` statt der Platzhalter eintragen, den privaten Deploy-Schlüssel
   als Secret `SOPS_AGE_KEY` (Environment `production`). Dann
   `cp deploy/hetzner/secrets.sops.yaml.example deploy/hetzner/secrets.sops.yaml`, Werte eintragen, verschlüsseln
   (`sops --encrypt --in-place …`) und einchecken. Die privaten Schlüssel der Keycloak-Clients stammen aus
   `npx create-iam-app keys` (`~/.identity/ppm/`).
6. **DB-VM einrichten** (über die App-VM als Sprungserver, die DB-VM hat kein öffentliches SSH):

   ```sh
   scp -J deploy@‹app-ipv4› -r deploy/hetzner/db db/bootstrap.sql root@10.0.1.20:/root/ppm-db/
   sops exec-env deploy/hetzner/secrets.sops.yaml \
     'ssh -J deploy@‹app-ipv4› root@10.0.1.20 "cd /root/ppm-db && OWNER_PW=$db_OWNER_PW …  sh db/setup.sh"'
   ```

   `setup.sh` legt TLS (eigene CA, Zertifikat für `db.ppm.internal`), Rollen (`db/bootstrap.sql`),
   pgBackRest (Stanza, Prüfung) und die Backup-Timer an. Den Inhalt von `/etc/postgresql/17/main/tls/ca.crt` als
   `app.database_ca` in die SOPS-Datei übernehmen.
7. **DNS:** Die Zone `project-suite.ch` liegt bei Hostpoint (Control Panel › Domains › DNS-Zone bearbeiten). Hostpoint
   hat keine öffentliche DNS-API, darum von Hand (Werte aus `tofu output` von Schritt 4):

   | Name | Typ | Wert | TTL |
   |---|---|---|---|
   | `ppm` | A | `‹app_ipv4›` | 300 |
   | `ppm` | AAAA | `‹app_ipv6›` | 300 |
   | `ppm` | CAA | `0 issue "letsencrypt.org"` (nur Let's Encrypt stellt Zertifikate aus) | 300 |

   Ändert sich die App-VM (neue IP), die Records nachführen. MCP läuft unter demselben Namen (`/mcp`).
8. **Deploy-Zugang:** Einen SSH-Schlüssel nur für den Workflow erzeugen, öffentlichen Teil auf der App-VM in
   `~deploy/.ssh/authorized_keys`, privaten als Secret `DEPLOY_SSH_KEY`, `ssh-keyscan ‹app-ipv4›` als Variable
   `DEPLOY_KNOWN_HOSTS`, Variable `APP_HOST=deploy@‹app-ipv4›` und `ACME_EMAIL` (Environment `production`).
9. **Erster Rollout:** Workflow «Deploy» mit Aktion `deploy` und dem Digest aus dem Lauf «CI» auf `main`. Danach
   Realm (Workflow «Keycloak») und erste Organisation (`npm run identity:first-org`, docs/identity-kit.md).
10. **Wiederherstellung üben:** einmal PITR auf eine Wegwerf-VM (unten), Ergebnis in `docs/betrieb.md` festhalten.

## Täglicher Betrieb

| Aufgabe | Wie |
|---|---|
| Neue Version | Workflow «Deploy» › `deploy` mit Image-Digest; Migrationen laufen vorher (`migrate`) |
| Zurück | «Deploy» › `rollback` (vorheriges Image; Migrationen bleiben, deshalb nur vorwärts verträgliche Schemaänderungen) |
| Wartungsseite | «Deploy» › `maintenance-on` / `maintenance-off` (Caddy antwortet 503 mit Wartungsseite) |
| Zustand | «Deploy» › `status` |
| Geheimnis ändern | SOPS-Datei ändern, PR, danach «Deploy» › `deploy` mit dem laufenden Digest |

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
