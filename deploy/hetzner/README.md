# Betrieb bei Hetzner

PPM läuft im **bestehenden Hetzner-Cloud-Projekt** auf zwei VMs:

| VM | Inhalt | Verzeichnis |
|---|---|---|
| App-VM (`ppm-app`) | Caddy (TLS, ein Host, Wartungsseite), `migrate`, `api`, `worker`, `mcp` mit Docker Compose ([`../compose.prod.yaml`](../compose.prod.yaml)) | `/opt/ppm` |
| DB-VM (`ppm-db`) | PostgreSQL 17 mit TLS und pgBackRest (WAL-Archiv, Sicherungen, PITR) mit Docker Compose ([`db/compose.yaml`](db/compose.yaml)), Daten auf einem Volume | `/opt/ppm-db` |

Beide VMs hängen im privaten Netz; die Datenbank ist nur dort erreichbar (`pg_hba.conf`: nur `hostssl` aus dem
privaten Netz). Infrastruktur als Code in [`infra/hetzner`](../../infra/hetzner) und [`infra/dns`](../../infra/dns)
(OpenTofu, Workflow [`infra.yml`](../../.github/workflows/infra.yml)), Ausrollen über den Workflow
[`deploy.yml`](../../.github/workflows/deploy.yml) und [`rollout.sh`](rollout.sh).

Im Repository stehen **keine IDs, Adressen oder Schlüssel** des Projekts: alles kommt aus Variablen und Secrets der
GitHub-Environments (Liste unten). `.sops.yaml` enthält Platzhalter-Empfänger, bis die Schlüssel festgelegt sind.

## Bestehendes Hetzner-Projekt anbinden

### 1. Werte im Projekt nachschlagen bzw. anlegen

| Wert | Wo | Wofür |
|---|---|---|
| API-Token «Lesen und Schreiben» | Hetzner Console › Projekt › Sicherheit › API-Tokens | Secret `HCLOUD_TOKEN` (Environment `production`) |
| API-Token «Lesen» | ebenda | Secret `HCLOUD_TOKEN_READ` (Environment `infra-plan`, Plan im PR) |
| Standort | z. B. `fsn1`, `nbg1`, `hel1` | Variable `HCLOUD_LOCATION` |
| Servertypen | App z. B. `cx33`, DB z. B. `cx43` (arm64: `cax…`, das Image ist Multi-Arch) | `HCLOUD_APP_SERVER_TYPE`, `HCLOUD_DB_SERVER_TYPE` |
| Bestehende SSH-Schlüssel des Betriebs | Projekt › Sicherheit › SSH-Keys (Namen) | `HCLOUD_SSH_KEY_NAMES` als Liste, z. B. `["betrieb-anna"]` |
| Bestehendes privates Netz (optional) | Projekt › Netzwerke (Name); sonst legt OpenTofu `ppm-net` an | `HCLOUD_NETWORK_NAME`; Adressbereich muss zu `network_ip_range` und [`db/pg_hba.conf`](db/pg_hba.conf) passen |
| Object Storage: Bucket für den State | Projekt › Object Storage (z. B. `ppm-tofu-state`), Versionierung an | `TF_STATE_BUCKET`, `TF_STATE_REGION`, `TF_STATE_ENDPOINT` (`https://<region>.your-objectstorage.com`) |
| Object Storage: Bucket für pgBackRest | z. B. `ppm-pgbackrest`, privat | [`db/db.env`](db/db.env.example) auf der DB-VM |
| Object-Storage-Zugang | Projekt › Object Storage › Zugangsdaten | Secrets `S3_ACCESS_KEY`, `S3_SECRET_KEY` (State); getrennter Zugang für pgBackRest in `db.enc.yaml` |
| DNS-Zone `project-suite.ch` | Hetzner Console › DNS (falls die Zone dort liegt, sonst offener Punkt) | `DNS_ZONE` |
| SSH-Zugang erlaubt aus | feste Adressen des Betriebs bzw. Bastion (GitHub-Runner: der Deploy-Workflow öffnet Port 22 nur für die Dauer des Laufs) | `ADMIN_CIDRS`, z. B. `["203.0.113.10/32"]` |

Die Buckets und den Object-Storage-Zugang legt der Betrieb von Hand an (der Provider `hcloud` verwaltet sie nicht).
Teilt PPM das State-Bucket mit infra/keycloak, liegen die Schlüssel unter `ppm/hetzner.tfstate` und `ppm/dns.tfstate`.

### 2. Schlüssel erzeugen (lokal, nie committen)

```sh
ssh-keygen -t ed25519 -N '' -C ppm-deploy -f ppm-deploy          # Deploy-Benutzer auf beiden VMs
age-keygen -o ppm-deploy.age                                     # SOPS: Deploy-Workflow
age-keygen -o ppm-betrieb.age                                    # SOPS: Notfallzugang des Betriebs (offline)
openssl rand -base64 48                                          # TF_STATE_PASSPHRASE (nicht verlieren!)
```

Die öffentlichen age-Schlüssel (`age1…`) in [`.sops.yaml`](../../.sops.yaml) statt der Platzhalter eintragen.

### 3. GitHub-Environments, Variablen und Secrets

Environments unter *Settings › Environments*; `production` mit Pflicht-Reviewern und nur Branch `main`.

**Environment `production`** (Deploy, Apply der Infrastruktur, Keycloak):

| Name | Art | Inhalt |
|---|---|---|
| `HCLOUD_TOKEN` | Secret | API-Token «Lesen und Schreiben» (Apply; Deploy öffnet damit SSH für die Adresse des Runners vorübergehend in der Firewall `ppm-app`) |
| `S3_ACCESS_KEY`, `S3_SECRET_KEY` | Secret | Object Storage (State; dieselben wie für infra/keycloak) |
| `TF_STATE_PASSPHRASE` | Secret | Verschlüsselung von State und Plan (dieselbe wie für infra/keycloak) |
| `SSH_PRIVATE_KEY` | Secret | privater Schlüssel `ppm-deploy` |
| `SOPS_AGE_KEY` | Secret | Inhalt von `ppm-deploy.age` (`AGE-SECRET-KEY-…`) |
| `GHCR_READ_TOKEN` | Secret, optional | nur wenn das Paket `ghcr.io/cspag/ppm` privat ist: Token mit `read:packages` |
| `APP_HOST` | Variable | öffentliche IPv4 der App-VM (Ausgabe `app_ipv4`) |
| `SSH_KNOWN_HOSTS` | Variable | Hostschlüssel der App-VM (`ssh-keyscan <app_ipv4>`, Fingerprint in der Konsole prüfen) |
| `SSH_USER` | Variable, optional | Standard `deploy` |
| `PPM_DOMAIN` | Variable, optional | Standard `ppm.project-suite.ch` |

**Environment `infra-plan`** (Plan im Pull Request, ohne Reviewer): `HCLOUD_TOKEN_READ`, `S3_ACCESS_KEY`,
`S3_SECRET_KEY`, `TF_STATE_PASSPHRASE`.

**Variablen** (Repository oder beide Environments, ohne Geheimnisse):

| Name | Beispiel | Verwendet in |
|---|---|---|
| `TF_STATE_BUCKET`, `TF_STATE_REGION`, `TF_STATE_ENDPOINT` | `ppm-tofu-state`, `fsn1`, `https://fsn1.your-objectstorage.com` | infra/hetzner, infra/dns |
| `HCLOUD_LOCATION` | `fsn1` | infra/hetzner |
| `HCLOUD_APP_SERVER_TYPE`, `HCLOUD_DB_SERVER_TYPE` | `cx33`, `cx43` | infra/hetzner |
| `HCLOUD_SSH_KEY_NAMES` | `["betrieb-anna"]` | infra/hetzner |
| `HCLOUD_NETWORK_NAME` | leer (neues Netz) | infra/hetzner |
| `DEPLOY_SSH_PUBLIC_KEY` | Inhalt von `ppm-deploy.pub` | infra/hetzner |
| `ADMIN_CIDRS` | `["203.0.113.10/32"]` | infra/hetzner |
| `DNS_ZONE` | `project-suite.ch` | infra/dns |
| `APP_IPV4`, `APP_IPV6` | Ausgaben von infra/hetzner | infra/dns |

**Repository-Secret** `NPM_READ_TOKEN` (optional): Token (classic) mit nur `read:packages`, falls `GITHUB_TOKEN` die
Pakete `@vollholz/*` nicht lesen darf (CI und Image-Build).

### 4. Infrastruktur anlegen

1. PR mit den Variablen → Workflow «Infrastruktur» zeigt den Plan (Lese-Token).
2. Nach dem Merge: «Run workflow» › `hetzner` → Freigabe Plan → Freigabe Apply. Ausgaben `app_ipv4`, `app_ipv6`,
   `db_private_ip` als Variablen `APP_HOST`, `APP_IPV4`, `APP_IPV6` eintragen.
3. «Run workflow» › `dns` (A, AAAA, CAA für `ppm.project-suite.ch`).

Die DB-VM hat Lösch- und Rebuild-Schutz, das Volume Löschschutz; aufheben nur bewusst in der Konsole.

### 5. DB-VM einrichten (einmalig, von Hand)

```sh
# lokal: Dateien übertragen
rsync -r deploy/hetzner/db/ db/bootstrap.sql deploy@<db_ipv4>:/opt/ppm-db/
ssh deploy@<db_ipv4>
cd /opt/ppm-db
sudo mount -a && sudo chown 999:999 /srv/pgdata && sudo chmod 0700 /srv/pgdata   # falls das Volume beim Boot fehlte
cp db.env.example db.env && $EDITOR db.env            # DB_PRIVATE_IP, Bucket, Endpunkt, Region
install -d -m 0700 secrets secrets/tls
# Werte aus deploy/hetzner/secrets/db.enc.yaml (sops decrypt): postgres_password, pgbackrest.env, tls/*
sudo chown 999:999 secrets/tls/server.key && sudo chmod 0400 secrets/tls/server.key
docker compose --env-file db.env up -d --build --wait
./backup.sh init                                       # Stanza anlegen, Archiv prüfen
./backup.sh full                                       # erste Vollsicherung
sudo cp ppm-backup@.service ppm-backup@full.timer ppm-backup@diff.timer /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now ppm-backup@full.timer ppm-backup@diff.timer
```

Rollen und Datenbank (einmal, idempotent) mit [`db/bootstrap.sql`](../../db/bootstrap.sql) als Superuser:

```sh
docker compose --env-file db.env exec -T postgres psql -U postgres -v ON_ERROR_STOP=1 \
  -v p=ppm -v db=ppm -v owner_pw='…' -v runtime_pw='…' -v worker_pw='…' -f - < bootstrap.sql
```

Das TLS-Zertifikat der Datenbank stammt aus einer privaten CA (SAN: private Adresse der DB-VM). Dasselbe
CA-Zertifikat geht als `db_ca.crt` in `app.enc.yaml`; die App prüft mit `DATABASE_SSL=verify-full` und
`NODE_EXTRA_CA_CERTS`.

### 6. App-VM: Geheimnisse und erstes Deploy

```sh
cp deploy/hetzner/secrets/app.example.yaml deploy/hetzner/secrets/app.dec.yaml && $EDITOR deploy/hetzner/secrets/app.dec.yaml
sops encrypt --filename-override deploy/hetzner/secrets/app.enc.yaml deploy/hetzner/secrets/app.dec.yaml \
  > deploy/hetzner/secrets/app.enc.yaml && rm deploy/hetzner/secrets/app.dec.yaml
```

`ACME_EMAIL` in [`prod.env`](prod.env) setzen (Platzhalter verhindert den Deploy), committen, dann Workflow
«Deploy» › `deploy` mit `image` = `main` oder einem Digest. Der Workflow löst den Tag zum Digest auf, prüft Signatur
(cosign, nur `ci.yml` auf `main`/Tags) und Provenienz, überträgt `compose.prod.yaml`, `caddy/`, `maintenance/`,
`prod.env`, `rollout.sh` und die Geheimnisse (je Datei 0400, UID 1000) nach `/opt/ppm` und ruft
`rollout.sh deploy <image@digest>` auf.

## Betrieb

| Aufgabe | Wie |
|---|---|
| Neue Version ausrollen | «Deploy» › `deploy` (Migrationen vor dem Wechsel, bei ungesunden Diensten automatisch zurück) |
| Zurück auf das vorherige Image | «Deploy» › `rollback` (ohne Migrationen; Migrationen sind nur vorwärts) |
| Wartungsseite | «Deploy» › `maintenance-on` / `maintenance-off` (Caddy antwortet 503 mit [`maintenance/`](../maintenance/index.html)) |
| Zustand | «Deploy» › `status` bzw. `ssh deploy@<app> /opt/ppm/rollout.sh status` |
| Organisationen | `ssh deploy@<app> /opt/ppm/rollout.sh tenant list` |
| Hauptschlüssel rotieren | neuen Schlüssel vorne in `encryption_keys` (SOPS), deploy, dann `rollout.sh rotate-keys`, alten Schlüssel entfernen, deploy |
| Sicherungen ansehen | `ssh deploy@<db> /opt/ppm-db/backup.sh info` |
| Wiederherstellung (PITR) | Wartung ein, `ssh deploy@<db>`, `/opt/ppm-db/restore-pitr.sh "2026-10-26 14:30:00+00"`, prüfen, Wartung aus |

**Sicherung und PITR:** WAL laufend archiviert (`archive_timeout` 60 s), Vollsicherung sonntags, differenziell an den
übrigen Tagen, Aufbewahrung 35 Tage, Repository verschlüsselt (`aes-256-cbc`). Wiederherstellung auf jeden
Zeitpunkt innerhalb der Aufbewahrung. Die Wiederherstellung mindestens vierteljährlich auf einer Wegwerf-VM üben.
Zusätzlich sind die Hetzner-Backups der DB-VM eingeschaltet (`backups = true`, nur als Notnagel; nicht konsistent).
