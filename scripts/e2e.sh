#!/bin/sh
# End-to-End gegen den echten Stack (`npm run e2e`, lokal und in CI gleich): Datenbank `ppm_e2e` neu anlegen
# und migrieren (scripts/e2e-db.ts), Realm, Organisationen und Testpersonen abgleichen und in dieser Datenbank
# eintragen (scripts/keycloak-setup.ts), API mit dem Build der Webapp und Worker starten, Playwright ausführen.
#
# Voraussetzungen: `npm run dev:setup` (.env, PostgreSQL und Keycloak), `npm run web:build`, Chromium für Playwright
# (`npx --prefix web playwright install chromium` oder E2E_CHROMIUM). Port 8080 frei (PUBLIC_BASE_URL der .env).
# Argumente gehen an Playwright, z. B. `npm run e2e -- --project=hell personal.spec.ts`.
# Protokolle von API und Worker: .local/e2e/.
set -eu
ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"
[ -f .env ] || { echo "e2e: .env fehlt (npm run dev:setup)" >&2; exit 78; }
[ -f web/dist/index.html ] || { echo "e2e: web/dist fehlt (npm run web:build)" >&2; exit 78; }
LOGS=.local/e2e
mkdir -p "$LOGS"
# fest: PUBLIC_BASE_URL der .env, HTTP_PORT der API und Redirect-URI des Realms (keycloak-setup) hängen daran
BASE=http://localhost:8080
if curl -s -o /dev/null "$BASE/healthz"; then
  echo "e2e: unter $BASE läuft schon ein Dienst (npm run dev:api beenden)" >&2; exit 1
fi

node --env-file=.env scripts/e2e-db.ts
ENV="--env-file=.env --env-file=web/e2e/.env.e2e"
# shellcheck disable=SC2086 # ENV enthält zwei Argumente
node $ENV scripts/keycloak-setup.ts

pids=""
stop() { for p in $pids; do kill "$p" 2>/dev/null || true; done; wait 2>/dev/null || true; }
trap stop EXIT INT TERM
# shellcheck disable=SC2086
OPS_PORT=9190 node $ENV src/cli.ts api >"$LOGS/api.log" 2>&1 & api=$!; pids="$pids $api"
# shellcheck disable=SC2086
OPS_PORT=9191 node $ENV src/cli.ts worker >"$LOGS/worker.log" 2>&1 & pids="$pids $!"

# Start der API: Fastify baut beim Start für jede Route den Serialisierer der Antworten und prüft dabei jedes Mal alle
# gemeinsamen Schemas (fast-json-stringify, `options.schema`). Das wächst mit Routen × Schemas und dauerte am
# 28.10.2026 in CI 33–61 s (lokal über 70 s), reine Rechenzeit. Darum bis 240 s warten, die Dauer ausgeben und beim
# Abbruch beide Protokolle zeigen; endet der Prozess vorher, sofort abbrechen (Fehler statt Langsamkeit).
zeige() { echo "--- $LOGS/api.log" >&2; tail -n 80 "$LOGS/api.log" >&2; echo "--- $LOGS/worker.log" >&2; tail -n 20 "$LOGS/worker.log" >&2; }
WARTEN=${E2E_API_WARTEN:-240}
i=0
until curl -sf -o /dev/null "$BASE/readyz"; do
  if ! kill -0 "$api" 2>/dev/null; then echo "e2e: API nach $i s beendet, bevor sie bereit war" >&2; zeige; exit 1; fi
  i=$((i + 1))
  if [ "$i" -gt "$WARTEN" ]; then echo "e2e: API nicht bereit nach $WARTEN s" >&2; zeige; exit 1; fi
  sleep 1
done
echo "e2e: API bereit unter $BASE nach $i s"
# Anmeldekette kurz prüfen (Hinweis bei Fehlern in der Umgebung, kein Abbruch): /auth/login → Keycloak → Anmeldeseite
loc=$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' "$BASE/auth/login?returnTo=/ziele/handlungsfelder") || true
echo "e2e: /auth/login → $loc"
case "$loc" in
  3??\ http*) curl -s "${loc#* }" | grep -q 'id="username"' && echo "e2e: Anmeldeseite von Keycloak erreichbar" \
    || echo "e2e: Anmeldeseite von Keycloak ohne Feld username" >&2 ;;
  *) echo "e2e: /auth/login leitet nicht zu Keycloak weiter" >&2 ;;
esac

E2E_BASE_URL=$BASE npm --prefix web run e2e -- "$@"
