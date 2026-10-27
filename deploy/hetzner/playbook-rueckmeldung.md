# Rückmeldung an das Playbook

Stolpersteine, die bei der Einrichtung von PPM neu aufgetreten sind und im Playbook
[identity-kit › docs/hetzner-einrichten.md](https://github.com/vollholz/identity-kit/blob/main/docs/hetzner-einrichten.md)
bzw. in der Vorlage (vollholz/nachtschicht) fehlen. Bei Gelegenheit dort übernehmen und hier streichen.

| Beobachtung | Ursache | Vorgehen |
|---|---|---|
| Workflow «Infrastruktur»: `apply` findet das Artefakt `tfplan-hetzner` nicht | In nachtschicht `main` fehlt im Job `plan` der Schritt `upload-artifact` (beim Einbau des DNS-Probelaufs entfallen); `apply` lädt ihn trotzdem | Upload wieder einfügen (in PPM erledigt); in nachtschicht nachziehen |
| Workflow «Deploy» meldet Erfolg, obwohl der Rollout fehlschlug | `rollout.sh … \| tee` ohne `pipefail`: ohne `shell: bash` startet GitHub `bash -e` ohne `pipefail` | `set -o pipefail` im Schritt (in PPM erledigt); in nachtschicht nachziehen |
| `registry-login` des Gates landet nicht dort, wo `docker pull` sucht | Gate läuft über `sudo`; `docker login` schreibt nach `$HOME/.docker`, je nach sudo-Einstellung unter `/home/deploy` | Im Gate `DOCKER_CONFIG=/root/.docker` setzen (PPM `ppm-ssh-gate.sh`) |
| Secret `INFOMANIAK_API_TOKEN` fehlt im Environment, `infra.yml` bricht beim DNS-Abgleich ab | Abschnitt 4 des Playbooks zählt es nicht zu den Secrets | In Abschnitt 4 und im Abschnitt `github` von `betrieb.sops.yaml` aufnehmen |
| Variablen `HETZNER_BACKEND_HCL`, `HETZNER_TFVARS` müssen abgetippt werden | Abschnitt 4 setzt nur Secrets aus SOPS | Abschnitt `variablen` in `betrieb.sops.yaml`, gleiche Schleife mit `gh variable set` (PPM [lokale-session.md](lokale-session.md)) |
| S3-Schlüssel der Session-Umgebung gehören zu einem anderen Projekt | Umgebung mit mehreren Projekten; `S3_ACCESS_KEY` ohne Präfix | Vor der Verwendung prüfen: `ListBuckets` auf `nbg1.your-objectstorage.com` zeigt die Buckets des Projekts. Präfix `<PRODUKT>_S3_*` empfehlen |
| `setup.sh` verlangt `PGBR_S3_KEY`/`PGBR_S3_SECRET`, die Vorlage `secrets.sops.yaml` von nachtschicht hat sie nicht | Werte dort nur in `betrieb.sops.yaml` › `github` | In `secrets.sops.yaml` › `db` aufnehmen (ein S3-Schlüssel für alles, Abschnitt 0) |
| README der Vorlage: «zwei Tokens», «drei Buckets» | Zählfehler (ein Token, zwei Buckets) | In PPM korrigiert; in nachtschicht nachziehen |
