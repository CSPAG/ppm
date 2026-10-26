#!/usr/bin/env bash
# Wiederherstellung auf einen Zeitpunkt (PITR) auf der DB-VM. Hält PostgreSQL an, stellt mit pgBackRest im Modus
# «delta» wieder her und startet neu; danach steht die Datenbank auf dem Stand des Zeitpunkts (promote).
#
#   ./restore-pitr.sh "2026-10-26 14:30:00+00"     Zeitpunkt in UTC
#   ./restore-pitr.sh latest                       bis zum letzten archivierten WAL (z. B. nach Verlust des Volumes)
#
# Vorher die App in die Wartung nehmen (Workflow «Deploy» › maintenance-on), damit niemand schreibt. Der Stand vor der
# Wiederherstellung bleibt im Repository; ein falscher Zeitpunkt lässt sich mit einem späteren erneut herstellen.
set -euo pipefail
cd "$(dirname "$0")"
target="${1:-}"
[ -n "$target" ] || { echo "Aufruf: $0 \"<zeitpunkt>\" | latest" >&2; exit 64; }

COMPOSE=(docker compose --env-file db.env -f compose.yaml)
opts=(--delta)
if [ "$target" = latest ]; then opts+=(--type=default); else opts+=(--type=time "--target=$target" --target-action=promote); fi

read -r -p "PostgreSQL anhalten und auf «$target» wiederherstellen? (ja/nein) " ok
[ "$ok" = ja ] || { echo "abgebrochen"; exit 1; }

"${COMPOSE[@]}" stop postgres
"${COMPOSE[@]}" run --rm --no-deps -u postgres --entrypoint pgbackrest postgres --stanza=ppm "${opts[@]}" restore
"${COMPOSE[@]}" up -d --wait postgres
echo "Wiederhergestellt. Jetzt eine neue Vollsicherung: ./backup.sh full"
