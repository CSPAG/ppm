#!/bin/bash
# Einziger Befehl, den der SSH-Benutzer «deploy» auf der App-VM ausführen darf (sshd ForceCommand + sudoers, wie
# identity-ssh-gate in vollholz/identity). Der gewünschte Befehl kommt aus SSH_ORIGINAL_COMMAND und wird streng geprüft;
# alles andere wird abgelehnt. Kein Shell, keine Weiterleitungen (cloud-init/app.yaml.tftpl).
#
#   deploy <image@sha256:…>   Bündel (tar.gz von stdin: compose.prod.yaml, prod.env, caddy/, secrets/) ablegen,
#                             migrieren, Dienste neu starten (deploy/hetzner/rollout.sh baut das Bündel)
#   rollback                  auf das vorherige Image zurück (ohne Migrationen rückwärts)
#   registry-login <benutzer> Anmeldung bei ghcr.io (Image privat), Token von stdin (kurzlebiges GITHUB_TOKEN des
#                             Workflows «Deploy»; wie assets-ssh-gate in vollholz/assets)
#   registry-logout           Abmeldung (der Workflow ruft sie immer am Ende auf)
#   maintenance-on|maintenance-off
#   status
#
# Liegt auf der VM unter /usr/local/sbin/ppm-ssh-gate (cloud-init). Änderungen danach von Hand als root
# einspielen: install -m 0755 deploy/hetzner/ppm-ssh-gate.sh /usr/local/sbin/ppm-ssh-gate
set -euo pipefail

DIR=/opt/ppm
MAX_BUNDLE_BYTES=$((2 * 1024 * 1024))
IMAGE_RE='^ghcr\.io/cspag/ppm@sha256:[a-f0-9]{64}$'
COMPOSE=(docker compose -f "$DIR/compose.prod.yaml" --env-file "$DIR/prod.env")
# Anmeldung bei ghcr.io fest bei root (sudo), unabhängig von HOME
export DOCKER_CONFIG=/root/.docker

die() { echo "ppm-ssh-gate: $*" >&2; exit 2; }

read -r -a args <<< "${SSH_ORIGINAL_COMMAND:-}"
cmd="${args[0]:-}"
case "$cmd" in
  deploy | registry-login) ;;
  *) [ "${#args[@]}" -le 1 ] || die "$cmd erwartet keine Argumente" ;;
esac

# Bündel prüfen und an seinen Platz bringen; Geheimnisse gehören UID 1000 (Container), 0400
install_bundle() {
  local tmp
  tmp="$(mktemp -d "$DIR/.bundle.XXXXXX")"
  trap 'rm -rf "$tmp"' EXIT
  head -c "$MAX_BUNDLE_BYTES" | tar -xz -C "$tmp" --no-same-owner --no-same-permissions
  if ! { [ -f "$tmp/compose.prod.yaml" ] && [ -f "$tmp/prod.env" ] && [ -f "$tmp/caddy/Caddyfile" ] \
    && [ -d "$tmp/secrets" ]; }; then
    die "Bündel unvollständig"
  fi
  if find "$tmp" -type l | grep -q .; then die "Bündel enthält Links"; fi
  for f in "$tmp"/secrets/*; do
    if ! [[ "$(basename "$f")" =~ ^[a-z_]+$ ]] || ! [ -f "$f" ]; then die "ungültiges Geheimnis $(basename "$f")"; fi
  done
  grep -Evq '^([A-Z][A-Z0-9_]*=.*|#.*|)$' "$tmp/prod.env" && die "prod.env: nur KEY=Wert, Kommentare, Leerzeilen"
  install -m 0640 -g docker "$tmp/compose.prod.yaml" "$tmp/prod.env" "$DIR/"
  rm -rf "$DIR/caddy" && mv "$tmp/caddy" "$DIR/caddy" && chmod -R go-w "$DIR/caddy"
  rm -rf "$DIR/secrets.old"
  if [ -d "$DIR/secrets" ]; then mv "$DIR/secrets" "$DIR/secrets.old"; fi
  mv "$tmp/secrets" "$DIR/secrets"
  chown -R 1000:1000 "$DIR/secrets" && chmod 0700 "$DIR/secrets" && chmod 0400 "$DIR"/secrets/*
  rm -rf "$DIR/secrets.old" "$tmp"
  trap - EXIT
}

cd "$DIR"
case "$cmd" in
  deploy)
    [ "${#args[@]}" -eq 2 ] || die "deploy <image@sha256:…>"
    [[ "${args[1]}" =~ $IMAGE_RE ]] || die "nur ghcr.io/cspag/ppm@sha256:…"
    install_bundle
    [ -f state/image ] && cp state/image state/previous-image
    export IMAGE="${args[1]}"
    docker pull -q "$IMAGE"
    "${COMPOSE[@]}" --profile migrate run --rm migrate
    "${COMPOSE[@]}" up -d --wait --remove-orphans
    echo "$IMAGE" > state/image
    echo "Ausgerollt: $IMAGE"
    ;;
  registry-login)
    if ! { [ "${#args[@]}" -eq 2 ] && [[ "${args[1]}" =~ ^[A-Za-z0-9][A-Za-z0-9-]{0,38}(\[bot\])?$ ]]; }; then
      die "registry-login <benutzer>"
    fi
    head -c 4096 | docker login ghcr.io --username "${args[1]}" --password-stdin > /dev/null
    echo "Anmeldung bei ghcr.io ok"
    ;;
  registry-logout)
    docker logout ghcr.io > /dev/null 2>&1 || true
    echo "Abgemeldet"
    ;;
  rollback)
    [ -f state/previous-image ] || die "kein vorheriges Image"
    IMAGE="$(cat state/previous-image)"
    export IMAGE
    "${COMPOSE[@]}" up -d --wait --remove-orphans
    cp state/image state/rolled-back-image && echo "$IMAGE" > state/image
    echo "Zurück auf $IMAGE (Migrationen bleiben; nur vorwärts verträgliche Änderungen ausrollen)"
    ;;
  maintenance-on) touch state/maintenance/on && echo "Wartung an" ;;
  maintenance-off) rm -f state/maintenance/on && echo "Wartung aus" ;;
  status)
    echo "Image: $(cat state/image 2>/dev/null || echo –)"
    if [ -f state/maintenance/on ]; then echo "Wartung: an"; else echo "Wartung: aus"; fi
    if [ -f state/image ]; then IMAGE="$(cat state/image)" "${COMPOSE[@]}" ps; fi
    ;;
  *) die "nicht erlaubt: ${cmd:-<leer>}" ;;
esac
