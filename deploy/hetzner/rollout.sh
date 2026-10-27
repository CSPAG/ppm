#!/bin/sh
# Rollout auf die App-VM (Hetzner) über SSH; aufgerufen von .github/workflows/deploy.yml oder lokal.
#
#   deploy/hetzner/rollout.sh deploy <image@sha256:…>   Dateien und Geheimnisse ablegen, migrieren, Dienste neu starten
#   deploy/hetzner/rollout.sh rollback                  auf das vorherige Image zurück (ohne Migrationen rückwärts)
#   deploy/hetzner/rollout.sh maintenance-on|maintenance-off
#   deploy/hetzner/rollout.sh status
#
# Umgebung: APP_HOST (z. B. deploy@ppm.project-suite.ch), SSH-Schlüssel im Agent bzw. ~/.ssh,
# SOPS_AGE_KEY (oder SOPS_AGE_KEY_FILE) zum Entschlüsseln von deploy/hetzner/secrets.sops.yaml, ACME_EMAIL.
# Auf der VM liegt alles unter /opt/ppm; das aktuelle und das vorherige Image in state/image, state/previous-image.
set -eu

here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../.." && pwd)"
: "${APP_HOST:?APP_HOST fehlt (deploy@<app-vm>)}"
dir=/opt/ppm
ssh_() { ssh -o BatchMode=yes -o StrictHostKeyChecking=yes "$APP_HOST" "$@"; }
compose="docker compose -f $dir/compose.prod.yaml --env-file $dir/prod.env"

# Geheimnisse aus SOPS als Dateien (eine je Schlüssel) in ein temporäres Verzeichnis, nie auf die Platte des Runners
# ausserhalb davon; danach per tar über SSH, Besitzer UID 1000, 0400.
push_secrets() {
  tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT INT TERM
  # shellcheck disable=SC2016 # JavaScript, kein Shell-Ausdruck
  sops --decrypt --output-type json "$here/secrets.sops.yaml" \
    | node -e '
        const fs = require("fs"); const out = process.argv[1];
        const data = JSON.parse(fs.readFileSync(0, "utf8"));
        for (const [k, v] of Object.entries(data.app ?? {})) {
          if (!/^[a-z_]+$/.test(k)) throw new Error(`ungültiger Schlüssel ${k}`);
          fs.writeFileSync(`${out}/${k}`, String(v), { mode: 0o400 });
        }' "$tmp"
  tar -C "$tmp" -cf - . | ssh_ "sudo tar -C $dir/secrets --no-same-owner -xf - && sudo chown -R 1000:1000 $dir/secrets && sudo chmod 0400 $dir/secrets/*"
  rm -rf "$tmp"; trap - EXIT INT TERM
}

push_files() {
  tar -C "$root/deploy" -cf - compose.prod.yaml caddy | ssh_ "tar -C $dir -xf -"
  # prod.env: Vorlage aus dem Repository, ergänzt um ACME_EMAIL (keine Geheimnisse)
  { cat "$root/deploy/prod.env.example"; echo "ACME_EMAIL=${ACME_EMAIL:?ACME_EMAIL fehlt}"; } | ssh_ "cat > $dir/prod.env"
}

case "${1:-}" in
  deploy)
    image="${2:?Image mit Digest fehlt (ghcr.io/cspag/ppm@sha256:…)}"
    case "$image" in *@sha256:*) ;; *) echo "Nur Images mit Digest" >&2; exit 64 ;; esac
    push_files
    push_secrets
    ssh_ "set -eu
      cd $dir
      [ -f state/image ] && cp state/image state/previous-image || true
      export IMAGE='$image'
      docker pull -q \"\$IMAGE\"
      $compose --profile migrate run --rm migrate
      $compose up -d --wait --remove-orphans
      echo \"\$IMAGE\" > state/image"
    echo "Ausgerollt: $image" ;;
  rollback)
    ssh_ "set -eu
      cd $dir
      [ -f state/previous-image ] || { echo 'Kein vorheriges Image' >&2; exit 1; }
      export IMAGE=\"\$(cat state/previous-image)\"
      $compose up -d --wait --remove-orphans
      cp state/image state/rolled-back-image; echo \"\$IMAGE\" > state/image
      echo \"Zurück auf \$IMAGE (Migrationen bleiben; nur vorwärts verträgliche Änderungen ausrollen)\"" ;;
  maintenance-on) ssh_ "touch $dir/state/maintenance/on && echo Wartung an" ;;
  maintenance-off) ssh_ "rm -f $dir/state/maintenance/on && echo Wartung aus" ;;
  status)
    ssh_ "cd $dir && echo \"Image: \$(cat state/image 2>/dev/null || echo –)\" && \
      ([ -f state/maintenance/on ] && echo 'Wartung: an' || echo 'Wartung: aus') && \
      IMAGE=\$(cat state/image 2>/dev/null || echo none) $compose ps" ;;
  *) echo "Aufruf: $0 deploy <image@sha256:…> | rollback | maintenance-on | maintenance-off | status" >&2; exit 64 ;;
esac
