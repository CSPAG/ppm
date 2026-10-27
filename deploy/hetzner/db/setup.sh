#!/bin/sh
# Einmalige Einrichtung der DB-VM (als root, nach cloud-init). Idempotent.
#
#   scp -r deploy/hetzner/db db/bootstrap.sql root@<db>:/root/ppm-db/
#   ssh root@<db> 'cd /root/ppm-db && OWNER_PW=… RUNTIME_PW=… WORKER_PW=… \
#     PGBR_S3_KEY=… PGBR_S3_SECRET=… PGBR_CIPHER=… sh db/setup.sh'
#
# Passwörter und Schlüssel kommen aus der SOPS-Datei (deploy/hetzner/secrets.sops.yaml), nie aus der Shell-History:
# z. B. `sops exec-env deploy/hetzner/secrets.sops.yaml 'ssh … env …'`.
set -eu
here="$(cd "$(dirname "$0")" && pwd)"
: "${OWNER_PW:?}" "${RUNTIME_PW:?}" "${WORKER_PW:?}" "${PGBR_S3_KEY:?}" "${PGBR_S3_SECRET:?}" "${PGBR_CIPHER:?}"
conf=/etc/postgresql/17/main

# TLS: eigene CA und Serverzertifikat für db.ppm.internal (CA geht als DATABASE_SSL-Wurzel an die App-VM)
install -d -m 0700 -o postgres -g postgres "$conf/tls"
if [ ! -f "$conf/tls/server.crt" ]; then
  openssl req -x509 -new -nodes -newkey ec -pkeyopt ec_paramgen_curve:P-256 -days 3650 -subj "/CN=ppm-db-ca" \
    -keyout "$conf/tls/ca.key" -out "$conf/tls/ca.crt"
  openssl req -new -nodes -newkey ec -pkeyopt ec_paramgen_curve:P-256 -subj "/CN=db.ppm.internal" \
    -keyout "$conf/tls/server.key" -out "$conf/tls/server.csr"
  printf 'subjectAltName=DNS:db.ppm.internal,IP:10.0.1.20\n' > "$conf/tls/san.ext"
  openssl x509 -req -in "$conf/tls/server.csr" -CA "$conf/tls/ca.crt" -CAkey "$conf/tls/ca.key" -CAcreateserial \
    -days 825 -extfile "$conf/tls/san.ext" -out "$conf/tls/server.crt"
  chown postgres:postgres "$conf/tls/"*; chmod 0600 "$conf/tls/"*.key
fi

install -d "$conf/conf.d"
install -m 0644 "$here/postgresql.conf" "$conf/conf.d/ppm.conf"
install -m 0640 -o postgres -g postgres "$here/pg_hba.conf" "$conf/pg_hba.conf"
grep -q "^include_dir = 'conf.d'" "$conf/postgresql.conf" || echo "include_dir = 'conf.d'" >> "$conf/postgresql.conf"

install -d -m 0750 -o postgres -g postgres /etc/pgbackrest/conf.d /var/log/pgbackrest
install -m 0640 -o postgres -g postgres "$here/pgbackrest.conf" /etc/pgbackrest/pgbackrest.conf
umask 077
cat > /etc/pgbackrest/conf.d/secrets.conf <<SECRETS
[global]
repo1-s3-key=$PGBR_S3_KEY
repo1-s3-key-secret=$PGBR_S3_SECRET
repo1-cipher-pass=$PGBR_CIPHER
SECRETS
chown postgres:postgres /etc/pgbackrest/conf.d/secrets.conf

systemctl restart postgresql@17-main
sudo -u postgres psql -v ON_ERROR_STOP=1 -v p=ppm -v db=ppm \
  -v owner_pw="$OWNER_PW" -v runtime_pw="$RUNTIME_PW" -v worker_pw="$WORKER_PW" -f "$here/../bootstrap.sql"
sudo -u postgres psql -d ppm -c 'CREATE EXTENSION IF NOT EXISTS pg_stat_statements'

sudo -u postgres pgbackrest --stanza=ppm stanza-create
sudo -u postgres pgbackrest --stanza=ppm check

install -m 0644 "$here/pgbackrest-backup@.service" "$here/pgbackrest-full.timer" "$here/pgbackrest-diff.timer" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now pgbackrest-full.timer pgbackrest-diff.timer
echo "DB-VM eingerichtet. CA für die App-VM: $conf/tls/ca.crt (als Secret database_ca, DATABASE_SSL=verify-full)."
