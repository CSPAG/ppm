# Ein Image für alle Prozesse von PPM (api, worker, mcp, migrate, tenant, rotate-keys); der Startbefehl ist das
# Argument (deploy/docker-entrypoint.sh). TypeScript läuft direkt auf Node 24 (Type Stripping, kein Build im Backend).
#
# Stufen: deps → check (Typprüfung als Build-Gate) → web (Vite) → prod-deps → runtime
#
# Pakete @vollholz/* kommen aus GitHub Packages über das Build-Secret «npmrc» (nur während npm ci gemountet, nie im
# Image):
#   docker build --secret id=npmrc,src=$HOME/.npmrc -t ppm .
# mit «//npm.pkg.github.com/:_authToken=<token>» (read:packages) in der Datei.
#
# Laufzeit: UID 1000, Dateien gehören root und sind nur lesbar, Root-Dateisystem schreibgeschützt nutzbar (nur /tmp
# als tmpfs), tini als PID 1, ohne npm/corepack/yarn. Multi-Arch (linux/amd64, linux/arm64): die Basis ist per
# Digest des Index gepinnt, Renovate hält den Digest aktuell.
#
# TLS zur Datenbank mit privater CA (DATABASE_SSL=verify-full): das CA-Zertifikat als Datei einhängen und
# NODE_EXTRA_CA_CERTS=/run/secrets/db_ca.crt setzen (createPool nimmt keine eigene CA an) – für jeden Dienst mit
# Datenbank und für migrate, tenant, rotate-keys.

# node 24 (alpine), Index-Digest für alle Architekturen
FROM node:24-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53 AS base
WORKDIR /app
ENV npm_config_update_notifier=false \
    npm_config_fund=false \
    npm_config_audit=false

# Abhängigkeiten inkl. Entwicklung (Typprüfung)
FROM base AS deps
COPY package.json package-lock.json .npmrc ./
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci --ignore-scripts

# Build-Gate: ohne fehlerfreie Typprüfung kein Image
FROM deps AS check
COPY tsconfig.json ./
COPY infra/keycloak/platform.ts ./infra/keycloak/platform.ts
COPY src ./src
COPY scripts ./scripts
COPY test ./test
RUN npm run typecheck && touch /tmp/typecheck.ok

# Webapp (eigenes npm-Paket in web/) → web/dist
FROM base AS web
WORKDIR /app/web
COPY .npmrc ./
COPY web/package.json web/package-lock.json ./
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci --ignore-scripts
COPY web/ ./
RUN npm run build

# Nur Laufzeit-Abhängigkeiten
FROM base AS prod-deps
COPY package.json package-lock.json .npmrc ./
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci --omit=dev --ignore-scripts

FROM node:24-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53 AS runtime
ARG VERSION=0.0.0-dev
ARG REVISION=unbekannt
ARG CREATED=unbekannt
LABEL org.opencontainers.image.title="ppm" \
      org.opencontainers.image.description="PPM – Strategieumsetzung und Projektportfoliomanagement (api, worker, mcp, migrate, tenant, rotate-keys)" \
      org.opencontainers.image.source="https://github.com/CSPAG/ppm" \
      org.opencontainers.image.url="https://ppm.project-suite.ch" \
      org.opencontainers.image.vendor="CSP AG" \
      org.opencontainers.image.licenses="UNLICENSED" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${REVISION}" \
      org.opencontainers.image.created="${CREATED}" \
      org.opencontainers.image.base.name="docker.io/library/node:24-alpine"

# Sicherheitskorrekturen der Basis sofort (sonst blockiert Trivy bis zum nächsten Digest), tini als PID 1,
# Paketmanager entfernen (zur Laufzeit nicht nötig, kleinere Angriffsfläche)
RUN apk upgrade --no-cache \
 && apk add --no-cache tini \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
           /usr/local/bin/yarn /usr/local/bin/yarnpkg /opt/yarn-* \
           /usr/local/bin/docker-entrypoint.sh /root/.npm /tmp/*

WORKDIR /app
ENV NODE_ENV=production \
    WEB_DIST_DIR=/app/web/dist \
    HTTP_PORT=8080 \
    MCP_PORT=8081 \
    OPS_PORT=9090

# Dateien gehören root, nur lesbar (0555: Verzeichnisse brauchen x); UID 1000 kann nichts ändern
COPY --from=prod-deps --chmod=0555 /app/node_modules ./node_modules
COPY --chmod=0555 package.json ./
COPY --chmod=0555 src ./src
COPY --chmod=0555 scripts ./scripts
COPY --chmod=0555 db ./db
COPY --from=web --chmod=0555 /app/web/dist ./web/dist
COPY --chmod=0555 deploy/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
# Abhängigkeit auf die Typprüfung: ohne erfolgreiche Stufe «check» baut BuildKit die Laufzeit nicht
COPY --from=check --chmod=0444 /tmp/typecheck.ok /app/.typecheck.ok

USER 1000:1000
EXPOSE 8080 8081 9090
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD ["/usr/local/bin/docker-entrypoint.sh", "healthcheck"]
ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]
CMD ["api"]
