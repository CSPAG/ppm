# Lokale Session: Schritte mit SSH und `gh`

Für die Schritte des Playbooks ([identity-kit › docs/hetzner-einrichten.md](https://github.com/vollholz/identity-kit/blob/main/docs/hetzner-einrichten.md#3-ablauf)),
die die Cloud-Session nicht kann (kein SSH, keine GitHub-Secrets). Ausführen in Claude Code auf dem Rechner der Person
oder von Hand, im Checkout von `CSPAG/ppm` auf dem Branch des Einrichtungs-PRs. Befehle für PowerShell 7 bzw. Git Bash; unter Linux und
macOS gelten dieselben Aufrufe mit `$VAR` statt `$env:VAR`. Aufrufe mit `sops -d --extract '["…"]'` nie in Windows
PowerShell 5.1 (Anführungszeichen gehen verloren), sondern in Git Bash oder PowerShell 7.3+.

Vorher immer `git pull`; Cloud- und lokale Session pushen nie gleichzeitig.

## Voraussetzungen

- `age`, `sops`, `gh` (angemeldet, Rechte auf `CSPAG/ppm`), Git, OpenSSH (Playbook Abschnitt 1).
- age-Schlüssel des Betriebs unter `%APPDATA%\sops\age\keys.txt` (Linux `~/.config/sops/age/keys.txt`). Prüfen:
  `sops -d --extract '["github"]' infra/hetzner/betrieb.sops.yaml > $null` darf keinen Fehler melden.
- SSH-Schlüssel des Benutzers `betrieb` aus SOPS in eine Datei, die nur Sie lesen dürfen (Klartext nur hier, nach der
  Einrichtung löschen oder in den SSH-Agent bzw. Passwortmanager):

  ```powershell
  $k = "$env:USERPROFILE\.ssh\ppm-betrieb"
  sops -d --extract '["lokal"]["ssh_betrieb_private_key"]' infra/hetzner/betrieb.sops.yaml | Set-Content -NoNewline $k
  Add-Content $k "`n"
  icacls $k /inheritance:r /grant:r "$($env:USERNAME):(R)"
  $app = "ppm.project-suite.ch"   # oder die IPv4 aus `tofu output app_ipv4`, solange DNS fehlt
  ssh -i $k betrieb@$app hostname  # beim ersten Mal den Fingerabdruck mit der Konsole von Hetzner vergleichen
  ```

## Schritt 8: GitHub-Environment `production`

Werte stehen verschlüsselt in `infra/hetzner/betrieb.sops.yaml`; nichts abtippen. **In Git Bash**, nicht in
PowerShell: Windows PowerShell 5.1 entfernt die inneren Anführungszeichen von `--extract '["github"]["…"]'`, `sops`
bricht ab und `gh secret set` speichert dann einen leeren Wert (vermutete Ursache; bei der Einrichtung waren so alle Secrets leer). Die Schleife bricht
bei einem leeren Wert ab und zeigt nur Längen:

```bash
f=infra/hetzner/betrieb.sops.yaml; r=(--env production --repo CSPAG/ppm)
gh api -X PUT repos/CSPAG/ppm/environments/production > /dev/null   # legt das Environment an, falls es fehlt
for n in HCLOUD_TOKEN S3_ACCESS_KEY S3_SECRET_KEY TF_STATE_PASSPHRASE INFOMANIAK_API_TOKEN SOPS_AGE_KEY DEPLOY_SSH_KEY KEYCLOAK_IAC_PRIVATE_KEY; do
  v="$(sops -d --extract "[\"github\"][\"$n\"]" "$f" </dev/null)" && [ -n "$v" ] || { echo "FEHLER: $n"; break; }
  gh secret set "$n" "${r[@]}" --body "$v" </dev/null && echo "ok $n (${#v} Zeichen)"
done
# HETZNER_TFVARS = infra/hetzner/production.tfvars
for n in HETZNER_BACKEND_HCL HETZNER_TFVARS APP_HOST ACME_EMAIL; do
  v="$(sops -d --extract "[\"variablen\"][\"$n\"]" "$f" </dev/null)" && [ -n "$v" ] || { echo "FEHLER: $n"; break; }
  gh variable set "$n" "${r[@]}" --body "$v" </dev/null && echo "ok $n"
done
unset v; gh secret list "${r[@]}"; gh variable list "${r[@]}"
```

Prüfen: Workflow «Infrastruktur» › `plan` muss «No changes» zeigen. Stehen dort leere Werte statt `***`, sind die
Secrets leer gesetzt.

In *Settings › Environments › production* «Required reviewers» setzen (Sie selbst) und unter *Deployment branches*
nur `main` zulassen. `DEPLOY_KNOWN_HOSTS` folgt in Schritt 10.

## Schritt 9: DB-VM einrichten

Die DB-VM hat kein öffentliches SSH; Zugang über die App-VM als Sprungserver. Unter Windows reicht `ssh -J` den
Schlüssel nicht weiter, darum `ProxyCommand`:

```powershell
$j = "ProxyCommand=ssh -i $k -W %h:%p betrieb@$app"
ssh -i $k -o $j root@10.0.1.20 "mkdir -p /root/ppm-db && mountpoint /srv/pgdata && ls -l /var/lib/postgresql/17"
scp -i $k -o $j -r deploy/hetzner/db db/bootstrap.sql root@10.0.1.20:/root/ppm-db/
```

`mountpoint` muss «is a mountpoint» melden (PostgreSQL auf dem Volume, nicht auf der Systemplatte). Danach `setup.sh`
mit den Werten aus SOPS (nur in der Umgebung des Aufrufs, nie in der History):

```powershell
$e = sops -d --output-type json deploy/hetzner/secrets.sops.yaml | ConvertFrom-Json
$envs = "OWNER_PW","RUNTIME_PW","WORKER_PW","PGBR_S3_KEY","PGBR_S3_SECRET","PGBR_CIPHER" | ForEach-Object { "$_='$($e.db.$_)'" }
"cd /root/ppm-db && $($envs -join ' ') sh db/setup.sh" | ssh -i $k -o $j root@10.0.1.20 sh
Remove-Variable e, envs
```

`setup.sh` legt TLS (eigene CA, `db.ppm.internal`), die Rollen, pgBackRest (Stanza, `check`) und die Backup-Timer an.
Am Ende muss `pgbackrest … check` ohne Fehler durchlaufen. Dann die CA in die SOPS-Datei:

```powershell
ssh -i $k -o $j root@10.0.1.20 cat /etc/postgresql/17/main/tls/ca.crt
sops edit deploy/hetzner/secrets.sops.yaml   # app.database_ca durch den Inhalt oben ersetzen (Block «|»)
git add deploy/hetzner/secrets.sops.yaml; git commit -m "DB-VM: CA der Datenbank in SOPS"; git push
```

Danach die Passwörter von `/root/ppm-db` auf der DB-VM entfernen: `ssh … root@10.0.1.20 rm -rf /root/ppm-db`.

## Schritt 10: Host-Schlüssel und Gate prüfen

```powershell
ssh-keyscan -t ed25519,ecdsa,rsa ppm.project-suite.ch | gh variable set DEPLOY_KNOWN_HOSTS --env production --repo CSPAG/ppm
```

Den Namen aus `APP_HOST` verwenden, nicht die IP (sonst schlägt `StrictHostKeyChecking` im Workflow fehl). Gate mit
dem Deploy-Schlüssel prüfen (Schlüssel nur für diese Prüfung entschlüsseln, danach löschen):

```powershell
$d = "$env:TEMP\ppm-deploy"
sops -d --extract '["github"]["DEPLOY_SSH_KEY"]' infra/hetzner/betrieb.sops.yaml | Set-Content -NoNewline $d
Add-Content $d "`n"; icacls $d /inheritance:r /grant:r "$($env:USERNAME):(R)"
ssh -i $d deploy@ppm.project-suite.ch status           # erlaubt: «Image: –», «Wartung: aus»
ssh -i $d deploy@ppm.project-suite.ch id               # abgelehnt: «ppm-ssh-gate: nicht erlaubt: id»
ssh -i $d deploy@ppm.project-suite.ch "status x"       # abgelehnt: «status erwartet keine Argumente»
ssh -i $d -t deploy@ppm.project-suite.ch               # keine Shell, kein TTY
ssh -i $d -N -L 5432:10.0.1.20:5432 deploy@ppm.project-suite.ch   # Weiterleitung abgelehnt (Ctrl+C)
ssh -i $d deploy@ppm.project-suite.ch "registry-login x;id"  # abgelehnt
Remove-Item $d
```

Ergebnis (welche Befehle erlaubt, welche abgelehnt) als Kommentar in den Einrichtungs-PR.

## Schritt 12: Realm anlegen (Bootstrap)

Erst nach dem Merge des PRs in `vollholz/identity` mit `ppm-tofu` (`grant_realm_admin = false`). Der private Schlüssel
von `ppm-tofu` bleibt lokal:

```powershell
$env:KEYCLOAK_TF_PRIVATE_KEY = sops -d --extract '["lokal"]["keycloak_tofu_private_key"]' infra/hetzner/betrieb.sops.yaml | Out-String
foreach ($n in "S3_ACCESS_KEY","S3_SECRET_KEY","TF_STATE_PASSPHRASE") {
  Set-Item "env:$n" (sops -d --extract "[`"github`"][`"$n`"]" infra/hetzner/betrieb.sops.yaml)
}
bash infra/keycloak/kc.sh bootstrap init
bash infra/keycloak/kc.sh bootstrap plan    # legt Realm ppm und Client ppm-iac an
bash infra/keycloak/kc.sh bootstrap apply
Remove-Item env:KEYCLOAK_TF_PRIVATE_KEY
```

Danach meldet die Cloud-Session den zweiten PR in `vollholz/identity` (`grant_realm_admin = true`). Den Inhalt des
Realms legt anschliessend der Workflow «Keycloak» (`keycloak.yml`) mit `ppm-iac` an.

## Schritt 14: Erste Organisation, Betrieb, Rauchtest

Erst nach dem Apply des Workflows «Keycloak» mit SMTP (Secret `SMTP_PASSWORD`,
[OP-05](../../docs/offene-punkte.md#op-05)); vorher die Mail des Realms prüfen.

```powershell
$env:KEYCLOAK_IAC_PRIVATE_KEY = sops -d --extract '["github"]["KEYCLOAK_IAC_PRIVATE_KEY"]' infra/hetzner/betrieb.sops.yaml | Out-String
foreach ($n in "S3_ACCESS_KEY","S3_SECRET_KEY","TF_STATE_PASSPHRASE") {
  Set-Item "env:$n" (sops -d --extract "[`"github`"][`"$n`"]" infra/hetzner/betrieb.sops.yaml)
}
npm ci
bash infra/keycloak/kc.sh init       # lädt das Modul (smtp-test liegt darin)
bash infra/keycloak/kc.sh smtp-test platform-admin@project-suite.ch   # Testmail über die SMTP-Einstellungen des Realms
Remove-Item env:S3_ACCESS_KEY, env:S3_SECRET_KEY, env:TF_STATE_PASSPHRASE
npm run identity:first-org      # organizations und operators aus identity.app.json; Einladungen per E-Mail
Remove-Item env:KEYCLOAK_IAC_PRIVATE_KEY
```

Rauchtest mit dem Maschinen-Client `ppm-rauchtest` ([OP-13](../../docs/offene-punkte.md#op-13)): zuerst in PPM als
Admin der Organisation `solutions` unter «Verwalten › Maschinen-Clients» freigeben. Dann (Git Bash):

```bash
k=infra/keycloak/keys/ppm-rauchtest.sops.yaml
SMOKE_CLIENT_ID="$(sops -d --extract '["SMOKE_CLIENT_ID"]' "$k")" \
SMOKE_CLIENT_KEY="$(sops -d --extract '["SMOKE_CLIENT_KEY"]' "$k")" \
OIDC_ISSUER_URL=https://identity.project-suite.ch/realms/ppm BASE_URL=https://ppm.project-suite.ch npm run smoke
```

Bis dahin genügt der Rauchtest im Workflow «Deploy».

## Schritt 15: PITR üben

Auf einer Wegwerf-VM (gleiches Projekt, `cx23`, Debian 13, im privaten Netz, ohne öffentliches SSH; Zugang über
`betrieb@<app>`): PostgreSQL 17 und pgBackRest wie in `infra/hetzner/cloud-init/db.yaml.tftpl` installieren,
`/etc/pgbackrest/` von der DB-VM übernehmen, dann wie in [README › PITR](README.md#backup-und-wiederherstellung-pitr)
auf einen Zeitpunkt der letzten Stunde zurücksetzen und eine bekannte Zeile prüfen. Ergebnis (Dauer, Zeitpunkt,
Abweichungen) in `docs/betrieb.md`; Wegwerf-VM löschen.

## Aufräumen

- `$env:USERPROFILE\.ssh\ppm-betrieb` in den SSH-Agent oder Passwortmanager übernehmen und die Datei löschen, wenn sie
  nicht mehr gebraucht wird; jederzeit wieder aus `betrieb.sops.yaml` erzeugbar.
- Keine entschlüsselten Dateien im Checkout lassen (`git status` muss sauber sein).
