#!/bin/sh
# Umgebung ohne Zugang zu GitHub Packages (z. B. Cloud-Sessions): baut @vollholz/* aus dem öffentlichen Repository
# identity-kit, bedient sie über eine lokale Registry, installiert Backend und Webapp und startet PostgreSQL auf 5433
# mit den Rollen aus db/bootstrap.sql und allen Migrationen. Danach laufen `npm run check` und `npm test` mit Datenbank.
#
#   sh scripts/session/setup.sh            # einmal je Session
#   . scripts/session/env.sh               # Umgebungsvariablen wie in CI (für npm test mit Datenbank)
#
# Lockfiles nie mit Einträgen dieser Registry committen (siehe identity-kit, docs/ausrollen.md).
set -eu
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
WORK=${SESSION_WORK:-/var/tmp/ppm-session}
export SESSION_WORK=$WORK
KIT=$WORK/identity-kit
PKG=$WORK/pakete
PORT=4873
mkdir -p "$WORK" "$PKG"
export npm_config_loglevel=error npm_config_audit=false npm_config_fund=false

# 0 Node 24 (.nvmrc), falls das System eine ältere Version hat
if [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 24 ]; then
  [ -x "$WORK/node24/node_modules/.bin/node" ] || npm install --prefix "$WORK/node24" node@24 >/dev/null
fi
. "$ROOT/scripts/session/env.sh"

# 1 identity-kit holen und bauen
if [ ! -d "$KIT/.git" ]; then git clone -q --depth 300 https://github.com/vollholz/identity-kit "$KIT"
else (cd "$KIT" && git fetch -q --depth 300 origin main && git worktree prune && git reset -q --hard origin/main); fi
rm -f "$PKG"/*.tgz
(cd "$KIT" && npm ci >/dev/null && npm run build >/dev/null)
for d in "$KIT"/packages/*; do (cd "$d" && npm pack --pack-destination "$PKG" --silent >/dev/null); done

# 2 Versionen, die die Lockfiles verlangen, aber nicht dem aktuellen Stand entsprechen, aus der Historie bauen
need=$(node -e '
  const fs=require("fs"); const out=new Set();
  for (const f of process.argv.slice(1)) for (const [k,v] of Object.entries(JSON.parse(fs.readFileSync(f)).packages ?? {}))
    { const m=k.match(/node_modules\/(@vollholz\/[^/]+)$/); if (m) out.add(m[1]+"@"+v.version); }
  console.log([...out].join("\n"));' "$ROOT/package-lock.json" "$ROOT/web/package-lock.json")
for nv in $need; do
  name=${nv%@*}; ver=${nv##*@}; file=$(echo "$name" | sed 's#^@##; s#/#-#')-$ver.tgz
  [ -f "$PKG/$file" ] && continue
  dir=${name#@vollholz/}
  for c in $(cd "$KIT" && git log --format=%H -S"\"version\": \"$ver\"" -- "packages/$dir/package.json"); do
    for cand in "$c" "$c^"; do
      if (cd "$KIT" && git show "$cand:packages/$dir/package.json" 2>/dev/null | grep -q "\"version\": \"$ver\""); then
        old=$WORK/alt-$dir-$ver; rm -rf "$old"; (cd "$KIT" && git worktree prune && git worktree add -q -f "$old" "$cand")
        ln -s "$KIT/node_modules" "$old/node_modules"
        (cd "$old" && npm run build --workspace "$name" >/dev/null && cd "packages/$dir" && npm pack --pack-destination "$PKG" --silent >/dev/null)
        break 2
      fi
    done
  done
  [ -f "$PKG/$file" ] || { echo "setup: $nv nicht gefunden" >&2; exit 1; }
done

# 3 Registry (neu) starten, damit sie die eben gebauten Pakete ausliefert, und installieren
# Läuft schon eine Registry (aus einem früheren Lauf), wird sie beendet; danach muss der Port frei sein
curl -sf -X POST "http://127.0.0.1:$PORT/-/beenden" >/dev/null 2>&1 || true
command -v fuser >/dev/null && fuser -k "$PORT/tcp" >/dev/null 2>&1 || true
sleep 1
nohup node "$ROOT/scripts/session/registry.mjs" "$PKG" > "$WORK/registry.log" 2>&1 &
regpid=$!
for _ in 1 2 3 4 5 6 7 8 9 10; do curl -sf "http://127.0.0.1:$PORT/@vollholz/platform" >/dev/null && break; sleep 1; done
if ! kill -0 "$regpid" 2>/dev/null; then
  echo "setup: Registry startet nicht (Port $PORT belegt?): $(cat "$WORK/registry.log")" >&2; exit 1
fi
(cd "$ROOT" && env "npm_config_@vollholz:registry=http://127.0.0.1:$PORT/" npm ci >/dev/null)
(cd "$ROOT/web" && env "npm_config_@vollholz:registry=http://127.0.0.1:$PORT/" npm ci >/dev/null)

# 4 PostgreSQL (Version des Systems) auf 5433, wie in CI. Als root läuft der Cluster unter dem Benutzer postgres
# (PostgreSQL startet nicht als root), sonst unter dem aktuellen Benutzer.
PGBIN=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)
if [ -n "$PGBIN" ] && ! pg_isready -q -h localhost -p 5433 2>/dev/null; then
  PGDATA=$WORK/pgdata
  if [ "$(id -u)" = 0 ]; then
    id postgres >/dev/null 2>&1 || useradd -m postgres
    als() { su postgres -c "$1"; }
  else
    als() { sh -c "$1"; }
  fi
  if [ ! -f "$PGDATA/PG_VERSION" ]; then
    rm -rf "$PGDATA"; mkdir -p "$PGDATA"; echo postgres > "$PGDATA.pw"
    if [ "$(id -u)" = 0 ]; then chown postgres "$PGDATA" "$PGDATA.pw"; fi
    als "$PGBIN/initdb -D $PGDATA -U postgres --pwfile=$PGDATA.pw -A scram-sha-256 >/dev/null"
  fi
  # Nach einem Neustart des Containers bleibt postmaster.pid stehen und verhindert den Start
  # (nur mit eingetragener PID: eine leere Datei gehört zu einem Start, der gerade läuft)
  altpid=$(head -1 "$PGDATA/postmaster.pid" 2>/dev/null || true)
  case "$altpid" in ''|*[!0-9]*) ;; *) kill -0 "$altpid" 2>/dev/null || rm -f "$PGDATA/postmaster.pid" ;; esac
  als "$PGBIN/pg_ctl -D $PGDATA -o '-p 5433 -k /tmp' -l $PGDATA/server.log start >/dev/null"
  sleep 2
fi
# Rollen und Datenbank (idempotent, auch nach einem abgebrochenen ersten Lauf)
psql "postgres://postgres:postgres@localhost:5433/postgres" -q -v ON_ERROR_STOP=1 \
  -v p=ppm -v db=ppm -v owner_pw=owner -v runtime_pw=runtime -v worker_pw=worker \
  -f "$ROOT/db/bootstrap.sql" >/dev/null
(cd "$ROOT" && npm run db:migrate >/dev/null 2>&1)
echo "setup: fertig – Registry :$PORT, PostgreSQL :5433. Für Tests: . scripts/session/env.sh"
