# Tesel server image: the relay, the landing page at / and the web app at /app/. Build from the
# repository root:
#   docker build -f apps/server/Dockerfile -t tesel-server .
#
# Node runs the server's TypeScript sources directly (type stripping), so only the web app has a
# build step. The workspace layout is kept because Node only strips types outside node_modules.

# The Node image is pinned by version and digest; CI (.github/workflows/ci.yml) tests with the
# same Node version. pnpm is the one "packageManager" names in package.json, version and hash:
# Corepack, which comes with Node, downloads it and refuses it if the hash differs.

# The built web app is the same on every platform, so it is built once, natively.
FROM --platform=$BUILDPLATFORM node:24.22.1-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205 AS web
WORKDIR /src
COPY package.json ./
RUN corepack enable pnpm && corepack install
COPY . .
RUN pnpm install --frozen-lockfile --filter @tesel/web...
# VITE_SERVER_URL "/" makes every server propose itself for new groups, and the base map is the
# one Caddy serves next to it (deploy/vps/maps.sh).
RUN TESEL_BASE=/app/ VITE_SERVER_URL=/ VITE_BASEMAP_URL=/maps/basemap.pmtiles \
    pnpm --filter @tesel/web build

FROM node:24.22.1-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205 AS install
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable pnpm && corepack install
COPY packages/protocol/package.json packages/protocol/
COPY packages/core/package.json packages/core/
COPY apps/server/package.json apps/server/
RUN pnpm install --prod --frozen-lockfile --filter @tesel/server...

FROM node:24.22.1-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205
LABEL org.opencontainers.image.title="Tesel server" \
      org.opencontainers.image.description="Zero-knowledge relay for Tesel groups, with the web app" \
      org.opencontainers.image.licenses="EUPL-1.2"
ENV NODE_ENV=production \
    TESEL_DB=/data/tesel.db \
    TESEL_PORT=8080 \
    TESEL_WEB_ROOT=/app/web
WORKDIR /app
COPY --from=install /app ./
COPY packages/protocol/src packages/protocol/src
COPY packages/core/src packages/core/src
COPY apps/server/src apps/server/src
COPY apps/site web
COPY LICENSE ./
COPY --from=web /src/apps/web/dist web/app
RUN mkdir /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 8080
# /healthz answers once the server can use its database. Checked every 2 seconds while it starts,
# so an update (deploy/vps/update.sh) learns soon whether the new version works.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --start-interval=2s \
  CMD node -e "fetch('http://127.0.0.1:8080/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "apps/server/src/main.ts"]
