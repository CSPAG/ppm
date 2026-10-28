#!/bin/sh
# Rollout auf die App-VM (Hetzner) über SSH; aufgerufen von .github/workflows/deploy.yml oder lokal.
#
#   deploy/hetzner/rollout.sh deploy <image@sha256:…>   Dateien und Geheimnisse ablegen, migrieren, Dienste neu starten
#   deploy/hetzner/rollout.sh rollback                  auf das vorherige Image zurück (ohne Migrationen rückwärts)
#   deploy/hetzner/rollout.sh registry-login <benutzer>  Anmeldung der VM bei ghcr.io, Token von stdin
#   deploy/hetzner/rollout.sh registry-logout
#   deploy/hetzner/rollout.sh maintenance-on|maintenance-off
#   deploy/hetzner/rollout.sh status
#
# Umgebung: APP_HOST (z. B. deploy@ppm.project-suite.ch), SSH-Schlüssel im Agent bzw. ~/.ssh,
# SOPS_AGE_KEY (oder SOPS_AGE_KEY_FILE) zum Entschlüsseln von deploy/hetzner/secrets.sops.yaml, ACME_EMAIL.
# Auf der VM führt ppm-ssh-gate die Aktion aus (alles unter /opt/ppm; Images in state/image,
# state/previous-image).
set -eu

here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../.." && pwd)"
: "${APP_HOST:?APP_HOST fehlt (deploy@<app-vm>)}"
ssh_() { ssh -o BatchMode=yes -o StrictHostKeyChecking=yes "$APP_HOST" "$@"; }

# Der Schlüssel von «deploy» erlaubt nur die Befehle von ppm-ssh-gate (erzwungener Befehl, keine Shell).
# deploy schickt ein Bündel (tar.gz auf stdin): Compose, Caddy, prod.env und die Geheimnisse aus SOPS als Dateien
# (eine je Schlüssel). Es entsteht nur im temporären Verzeichnis und geht über SSH, nie anderswo auf die Platte.
bundle() {
  tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT INT TERM
  mkdir -m 0700 "$tmp/secrets"
  # shellcheck disable=SC2016 # JavaScript, kein Shell-Ausdruck
  sops --decrypt --output-type json "$here/secrets.sops.yaml" \
    | node -e '
        const fs = require("fs"); const out = process.argv[1];
        const data = JSON.parse(fs.readFileSync(0, "utf8"));
        for (const [k, v] of Object.entries(data.app ?? {})) {
          if (!/^[a-z_]+$/.test(k)) throw new Error(`ungültiger Schlüssel ${k}`);
          fs.writeFileSync(`${out}/${k}`, String(v), { mode: 0o400 });
        }' "$tmp/secrets"
  cp "$root/deploy/compose.prod.yaml" "$tmp/" && cp -R "$root/deploy/caddy" "$tmp/caddy"
  # prod.env: Vorlage aus dem Repository, ergänzt um ACME_EMAIL (keine Geheimnisse)
  # CADDY_CONFIG_HASH: Prüfsumme von caddy/, damit «up -d» Caddy bei geänderter Konfiguration neu erstellt
  caddy_hash="$(cd "$tmp" && find caddy -type f | LC_ALL=C sort | xargs sha256sum | sha256sum | cut -c1-16)"
  { cat "$root/deploy/prod.env.example"; echo "ACME_EMAIL=${ACME_EMAIL:?ACME_EMAIL fehlt}"; echo "CADDY_CONFIG_HASH=$caddy_hash"; } > "$tmp/prod.env"
  tar -C "$tmp" -czf - compose.prod.yaml prod.env caddy secrets
}

case "${1:-}" in
  deploy)
    image="${2:?Image mit Digest fehlt (ghcr.io/cspag/ppm@sha256:…)}"
    case "$image" in *@sha256:*) ;; *) echo "Nur Images mit Digest" >&2; exit 64 ;; esac
    bundle | ssh_ deploy "$image" ;; # bundle läuft in einer Subshell, ihr trap räumt auf
  registry-login) ssh_ registry-login "${2:?Benutzer fehlt}" ;; # Token auf stdin, nie als Argument
  rollback | registry-logout | maintenance-on | maintenance-off | status) ssh_ "$1" < /dev/null ;;
  *) echo "Aufruf: $0 deploy <image@sha256:…> | registry-login <benutzer> | registry-logout | rollback | maintenance-on | maintenance-off | status" >&2; exit 64 ;;
esac
