#!/bin/sh
# Entrypoint des Images: ein Image, der Prozess ist das erste Argument. tini ist PID 1 und leitet Signale weiter;
# jeder Befehl startet mit exec, damit SIGTERM direkt beim Node-Prozess ankommt (geordnetes Beenden, ops/runtime.ts).
#
# Ungültige Konfiguration beendet api, worker und mcp mit Exit 78 (alle Meldungen auf stderr).
set -eu
cd /app

PRELOAD="--import ./src/platform/ops/preload.ts"

usage() {
  cat <<'HILFE'
Aufruf: docker run [optionen] <image> <befehl> [argumente]

Befehle:
  api                  REST-API, BFF und Webapp (HTTP_PORT, Standard 8080)
  worker               Warteschlange, Outbox, Aufräumen, Mitgliederabgleich
  mcp                  MCP-Dienst (MCP_PORT, Standard 8081; Profil mcp)
  migrate              Migrationen ausführen (DATABASE_ADMIN_URL), endet danach
  tenant <aktion> ...  Organisationen verwalten (scripts/tenant-admin.ts; «tenant help»)
  rotate-keys [...]    Hauptschlüssel rotieren (scripts/rotate-encryption-keys.ts)
  healthcheck [live]   Betriebs-Endpunkt fragen: /readyz (Standard) bzw. /healthz mit «live»
  help                 diese Hilfe

Jeder Prozess hat den Betriebs-Endpunkt auf OPS_PORT (Standard 9090): /healthz, /readyz, /metrics.
HILFE
}

cmd="${1:-}"
[ $# -gt 0 ] && shift

case "$cmd" in
  api | worker | mcp)
    # shellcheck disable=SC2086 # PRELOAD bewusst in zwei Wörter teilen
    exec node $PRELOAD "src/platform/main/$cmd.ts" "$@"
    ;;
  migrate)
    exec node scripts/db-migrate.ts "$@"
    ;;
  tenant)
    exec node scripts/tenant-admin.ts "$@"
    ;;
  rotate-keys)
    exec node scripts/rotate-encryption-keys.ts "$@"
    ;;
  healthcheck)
    # Ohne curl/wget: fetch von Node, Zeitlimit 3 s; Exit 0 nur bei 2xx
    path=readyz
    [ "${1:-}" = live ] && path=healthz
    exec node -e '
      fetch(process.argv[1], { signal: AbortSignal.timeout(3000) })
        .then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1));
    ' "http://127.0.0.1:${OPS_PORT:-9090}/$path"
    ;;
  help | -h | --help)
    usage
    ;;
  "")
    echo "docker-entrypoint: Befehl fehlt" >&2
    usage >&2
    exit 64
    ;;
  *)
    echo "docker-entrypoint: unbekannter Befehl «$cmd»" >&2
    usage >&2
    exit 64
    ;;
esac
