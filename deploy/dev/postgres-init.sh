#!/bin/sh
# Init-Skript von PostgreSQL (nur beim ersten Start mit leerem Volume): Rollen und Datenbank der App aus
# db/bootstrap.sql, mit den Passwörtern aus der Umgebung (.env, npm run dev:env). Zusätzlich die Datenbank für E2E.
set -eu
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres \
  -v p=ppm -v db=ppm \
  -v owner_pw="$DB_OWNER_PASSWORD" -v runtime_pw="$DB_RUNTIME_PASSWORD" -v worker_pw="$DB_WORKER_PASSWORD" \
  -f /bootstrap/bootstrap.sql
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres \
  -v p=ppm -v db=ppm_e2e \
  -v owner_pw="$DB_OWNER_PASSWORD" -v runtime_pw="$DB_RUNTIME_PASSWORD" -v worker_pw="$DB_WORKER_PASSWORD" \
  -f /bootstrap/bootstrap.sql
