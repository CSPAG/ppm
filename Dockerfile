# syntax=docker/dockerfile:1.10
#
# Ein Image für alle Prozesse von PPM (api, worker, mcp, migrate, tenant, rotate-keys, healthcheck).
# TypeScript läuft direkt (Type Stripping von Node 24), es gibt keinen Build-Schritt im Backend; die Typprüfung ist
# trotzdem Build-Gate (Stufe «check»).
#
# Bau:   docker build --secret id=npmrc,src=$HOME/.npmrc -t ppm .
# Start: docker run --rm ppm api      (ohne Konfiguration: Exit 78)
#
# @vollholz/* kommen aus GitHub Packages; das Token liegt nur während `npm ci` als Build-Secret vor, nie im Image.
# Digest der Basis: Renovate hält ihn aktuell (docker:pinDigests).

ARG NODE_IMAGE=node:24-alpine@sha256:191c9f0080fcbbc6547a85dc0ff7988072214a355aabdc1d2ec55a7dae5eea8a

# ---- deps: alle Abhängigkeiten des Backends (inkl. Entwicklung für die Typprüfung) ----
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

# ---- check: Typprüfung als Build-Gate ----
FROM deps AS check
COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
COPY test ./test
COPY infra/keycloak/platform.ts ./infra/keycloak/platform.ts
COPY infra/dns/dns.ts ./infra/dns/dns.ts
COPY identity.app.json ./
RUN npm run typecheck && touch /tmp/check-ok

# ---- web: Oberfläche (Vite) ----
FROM ${NODE_IMAGE} AS web
WORKDIR /app/web
COPY web/package.json web/package-lock.json web/.npmrc* ./
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund
COPY web ./
RUN npm run build

# ---- prod-deps: nur Laufzeit-Abhängigkeiten ----
FROM ${NODE_IMAGE} AS prod-deps
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --no-audit --no-fund

# ---- runtime ----
FROM ${NODE_IMAGE} AS runtime
ARG VERSION=0.0.0-dev
ARG REVISION=unknown
ARG CREATED=unknown
LABEL org.opencontainers.image.title="ppm" \
      org.opencontainers.image.description="PPM – Strategieumsetzung und Projektportfoliomanagement (api, worker, mcp, migrate)" \
      org.opencontainers.image.source="https://github.com/CSPAG/ppm" \
      org.opencontainers.image.vendor="vollholz" \
      org.opencontainers.image.licenses="UNLICENSED" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${REVISION}" \
      org.opencontainers.image.created="${CREATED}"

# Pakete der Basis auf Stand (Sicherheitskorrekturen vor dem nächsten Digest), tini als PID 1 (Signale, Zombies);
# Paketverwaltung von Node entfernen (Angriffsfläche, nicht gebraucht)
RUN apk upgrade --no-cache \
 && apk add --no-cache tini \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg \
           /opt/yarn-* \
 && { deluser --remove-home node 2>/dev/null || true; } \
 && addgroup -g 1000 app && adduser -u 1000 -G app -H -D -s /sbin/nologin app

WORKDIR /app
# Dateien gehören root und sind nur les- und ausführbar (0555, BuildKit nimmt nur Oktal); der Prozess läuft als UID 1000 und schreibt nirgends hin
COPY --from=check /tmp/check-ok /tmp/check-ok
COPY --from=prod-deps --chown=root:root --chmod=0555 /app/node_modules ./node_modules
COPY --chown=root:root --chmod=0555 package.json identity.app.json ./
COPY --chown=root:root --chmod=0555 src ./src
COPY --chown=root:root --chmod=0555 scripts ./scripts
COPY --chown=root:root --chmod=0555 db ./db
COPY --from=web --chown=root:root --chmod=0555 /app/web/dist ./web/dist
COPY --chown=root:root --chmod=0555 deploy/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN rm /tmp/check-ok

ENV NODE_ENV=production \
    HTTP_PORT=8080 \
    MCP_PORT=8081 \
    OPS_PORT=9090 \
    WEB_DIST_DIR=/app/web/dist \
    NODE_OPTIONS="--disable-warning=ExperimentalWarning"

USER 1000:1000
EXPOSE 8080 8081 9090
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 CMD ["/usr/local/bin/docker-entrypoint.sh", "healthcheck"]
ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]
CMD ["api"]
