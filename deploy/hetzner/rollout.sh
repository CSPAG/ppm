#!/usr/bin/env bash
# Rollout auf der App-VM (Verzeichnis /opt/ppm, Benutzer deploy mit UID 1000). Aufruf über den Workflow «Deploy»
# (.github/workflows/deploy.yml) per SSH oder von Hand auf der VM:
#
#   ./rollout.sh deploy ghcr.io/cspag/ppm@sha256:…   Image holen, Migrationen, api/worker/mcp/caddy erneuern
#   ./rollout.sh rollback                            vorheriges Image wieder starten (ohne Migrationen)
#   ./rollout.sh maintenance-on | maintenance-off    Wartungsseite (503) ein- bzw. ausschalten
#   ./rollout.sh status                              laufende Dienste, aktuelles und vorheriges Image
#   ./rollout.sh tenant <aktion> …                   Organisationen verwalten (Profil werkzeuge, aktuelles Image)
#   ./rollout.sh rotate-keys […]                     Hauptschlüssel rotieren (Profil werkzeuge, aktuelles Image)
#
# Erwartet neben diesem Skript: compose.prod.yaml, caddy/, maintenance/, prod.env (Vorlage prod.env.example),
# secrets/ (Dateien je Dienst, 0400, Eigentümer UID 1000) und state/ (Releases, Schalter der Wartung).
#
# Migrationen laufen nur vorwärts und vor dem Wechsel der Dienste: sie müssen mit der laufenden Version verträglich
# sein (erweitern, umstellen, erst in einem späteren Release aufräumen). Ein Rollback setzt deshalb nur das Image
# zurück, nie die Datenbank (dafür PITR, deploy/hetzner/README.md).
set -euo pipefail
cd "$(dirname "$0")"

STATE_DIR="${PPM_STATE_DIR:-./state}"
RELEASES="$STATE_DIR/releases"
WAIT_TIMEOUT="${PPM_WAIT_TIMEOUT:-180}"
mkdir -p "$STATE_DIR"
touch "$RELEASES"

log() { printf '%s rollout: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2; }
fail() { log "FEHLER: $*"; exit 1; }

compose() { PPM_IMAGE="$1" docker compose --env-file prod.env -f compose.prod.yaml "${@:2}"; }

current() { tail -n 1 "$RELEASES" | awk '{print $2}'; }
previous() { tail -n 2 "$RELEASES" | head -n 1 | awk '{print $2}'; }

start_services() {
  local image="$1"
  compose "$image" up -d --no-deps --remove-orphans --wait --wait-timeout "$WAIT_TIMEOUT" api worker mcp caddy
}

deploy() {
  local image="${1:-}"
  [[ "$image" =~ ^[a-z0-9./-]+@sha256:[0-9a-f]{64}$ ]] || fail "Image nur per Digest (…@sha256:<64 hex>), erhalten: «$image»"
  [ -f prod.env ] || fail "prod.env fehlt (Vorlage prod.env.example)"
  log "Image holen: $image"
  docker pull --quiet "$image" >/dev/null
  log "Migrationen"
  compose "$image" run --rm migrate || fail "Migrationen fehlgeschlagen – laufende Version bleibt unverändert"
  log "Dienste erneuern"
  if ! start_services "$image"; then
    local prev
    prev="$(current)"
    if [ -n "$prev" ]; then
      log "Dienste nicht gesund – zurück auf $prev"
      start_services "$prev" || log "Auch der Rollback ist nicht gesund – bitte von Hand prüfen («./rollout.sh status»)"
    fi
    fail "Rollout von $image fehlgeschlagen"
  fi
  if [ "$(current)" != "$image" ]; then
    printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$image" >> "$RELEASES"
  fi
  log "Fertig: $image"
  docker image prune --force >/dev/null || true
}

rollback() {
  local prev
  prev="$(previous)"
  if [ -z "$prev" ] || [ "$prev" = "$(current)" ]; then fail "kein vorheriges Image in $RELEASES"; fi
  log "Rollback auf $prev (Datenbank bleibt auf dem Stand der Migrationen)"
  docker pull --quiet "$prev" >/dev/null
  start_services "$prev" || fail "Rollback auf $prev nicht gesund"
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$prev" >> "$RELEASES"
  log "Fertig: $prev"
}

status() {
  local cur
  cur="$(current)"
  echo "Aktuelles Image:  ${cur:-(keines)}"
  echo "Vorheriges Image: $(previous)"
  if [ -f "$STATE_DIR/maintenance.on" ]; then echo "Wartung:          EIN"; else echo "Wartung:          aus"; fi
  echo
  compose "${cur:-unbekannt@sha256:0}" ps --all --format 'table {{.Service}}\t{{.State}}\t{{.Health}}\t{{.Status}}'
}

case "${1:-}" in
  deploy) deploy "${2:-}" ;;
  rollback) rollback ;;
  maintenance-on) touch "$STATE_DIR/maintenance.on"; log "Wartungsseite EIN" ;;
  maintenance-off) rm -f "$STATE_DIR/maintenance.on"; log "Wartungsseite aus" ;;
  status) status ;;
  tenant | rotate-keys)
    cur="$(current)"
    [ -n "$cur" ] || fail "noch kein Release"
    compose "$cur" --profile werkzeuge run --rm "$1" "${@:2}"
    ;;
  *)
    echo "Aufruf: $0 deploy <image@sha256:…> | rollback | maintenance-on | maintenance-off | status | tenant … | rotate-keys …" >&2
    exit 64
    ;;
esac
