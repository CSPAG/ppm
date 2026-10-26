#!/bin/sh
# Init-Skript des lokalen PostgreSQL: Rollen und Datenbank nach db/bootstrap.sql (einmal beim ersten Start).
set -eu
psql -v ON_ERROR_STOP=1 -U postgres -d postgres \
  -v p=ppm -v db=ppm -v owner_pw="$PPM_OWNER_PASSWORD" -v runtime_pw="$PPM_RUNTIME_PASSWORD" -v worker_pw="$PPM_WORKER_PASSWORD" \
  -f /opt/ppm/bootstrap.sql
