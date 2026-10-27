# Umgebungsvariablen wie im CI-Job «Realm und Datenbank» (.github/workflows/ci.yml); mit `. scripts/session/env.sh` laden.
export POSTGRES_SUPERUSER_PASSWORD=postgres POSTGRES_PORT=5433 NODE_ENV=test
export OIDC_ISSUER_URL=http://localhost:8180/realms/ppm
export DATABASE_ADMIN_URL=postgres://ppm_owner:owner@localhost:5433/ppm
export DATABASE_URL=postgres://ppm_runtime:runtime@localhost:5433/ppm
export DATABASE_WORKER_URL=postgres://ppm_worker:worker@localhost:5433/ppm
# Node 24 aus scripts/session/setup.sh, falls installiert
_ns_node=${SESSION_WORK:-/var/tmp/ppm-session}/node24/node_modules/.bin
[ -x "$_ns_node/node" ] && case ":$PATH:" in *":$_ns_node:"*) ;; *) export PATH="$_ns_node:$PATH" ;; esac
unset _ns_node
