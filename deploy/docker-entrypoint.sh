#!/bin/sh
# Einstieg des Images: erster Parameter wählt den Prozess. Alle Node-Prozesse laden zuerst die Telemetrie
# (@vollholz/platform/preload), damit die Instrumentierung vor allen anderen Modulen greift.
#
#   api | worker | mcp      Dienste (Betriebs-Endpunkt auf OPS_PORT)
#   migrate                 Migrationen von App und Baukasten, endet danach
#   tenant <befehl> …       Mandanten auflisten, anlegen, sperren, entsperren, löschen
#   rotate-keys             Hauptschlüssel rotieren (ENCRYPTION_KEYS)
#   healthcheck             HEALTHCHECK des Images: GET /healthz auf dem Betriebs-Endpunkt
#
# Ungültige Konfiguration endet mit Exit 78 (EX_CONFIG); das setzen die Prozesse selbst.
set -eu

cmd="${1:-api}"
[ "$#" -gt 0 ] && shift

run() {
  exec node --import @vollholz/platform/preload src/cli.ts "$@"
}

case "$cmd" in
  api|worker|mcp|migrate|tenant|rotate-keys) run "$cmd" "$@" ;;
  healthcheck)
    # shellcheck disable=SC2016 # JavaScript, kein Shell-Ausdruck
    exec node -e '
      const port = process.env.OPS_PORT || "9090";
      fetch(`http://127.0.0.1:${port}/healthz`, { signal: AbortSignal.timeout(2500) })
        .then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1));
    ' ;;
  -*|node) exec node "$@" ;;
  *)
    echo "docker-entrypoint: unbekannter Befehl «$cmd» (api, worker, mcp, migrate, tenant, rotate-keys, healthcheck)" >&2
    exit 64 ;;
esac
