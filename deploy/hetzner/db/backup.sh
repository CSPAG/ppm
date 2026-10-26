#!/usr/bin/env bash
# Sicherungen mit pgBackRest auf der DB-VM (Verzeichnis /opt/ppm-db). Aufruf durch die systemd-Timer
# (ppm-backup@full.timer wöchentlich, ppm-backup@diff.timer täglich) oder von Hand:
#
#   ./backup.sh init        Stanza anlegen und prüfen (einmal nach dem ersten Start)
#   ./backup.sh full|diff   Sicherung (voll bzw. differenziell)
#   ./backup.sh check       WAL-Archiv und Repository prüfen
#   ./backup.sh info        Sicherungen und frühester Zeitpunkt für PITR
set -euo pipefail
cd "$(dirname "$0")"
pgbr() { docker compose --env-file db.env -f compose.yaml exec -T -u postgres postgres pgbackrest --stanza=ppm "$@"; }

case "${1:-}" in
  init) pgbr stanza-create && pgbr check ;;
  full | diff) pgbr --type="$1" backup && pgbr expire ;;
  check) pgbr check ;;
  info) pgbr info ;;
  *) echo "Aufruf: $0 init | full | diff | check | info" >&2; exit 64 ;;
esac
