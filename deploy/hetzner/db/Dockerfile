# PostgreSQL 17 mit pgBackRest für die DB-VM (deploy/hetzner/db/compose.yaml). Basis per Digest, Renovate hält ihn
# aktuell; pgBackRest aus dem PGDG-Repository, das die offizielle Basis bereits eingerichtet hat.
FROM postgres:17.11-trixie@sha256:b8faeff7712663c2773a190181e1246e37e364b887611c04658c28b44e2408fe
RUN apt-get update \
 && apt-get install -y --no-install-recommends pgbackrest ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && install -d -o postgres -g postgres -m 0750 /var/log/pgbackrest /var/lib/pgbackrest /var/spool/pgbackrest
