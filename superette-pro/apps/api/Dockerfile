# syntax=docker/dockerfile:1.7
# Superette API — bouw vanaf de repositoryroot:
#   docker build -f apps/api/Dockerfile -t superette-api .
#   docker build -f apps/api/Dockerfile --target migrate -t superette-migrate .
#
# Targets:
#   runtime (standaard)  API-server, non-root, healthcheck, tini als PID 1
#   migrate              `prisma migrate deploy` met de volledige toolchain
# De werker gebruikt hetzelfde runtime-image met een ander commando:
#   node dist/compare/cli/worker.cli.js
ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-alpine AS base
RUN apk add --no-cache libc6-compat openssl tini
WORKDIR /app
ENV NPM_CONFIG_UPDATE_NOTIFIER=false NPM_CONFIG_FUND=false

# ── build: alle workspaces, inclusief devDependencies ────────────────────────
FROM base AS build
COPY . .
RUN npm ci --ignore-scripts
RUN cd apps/api && npx prisma generate
RUN npm run build -w @superette/vat \
 && npm run build -w @superette/pricing \
 && npm run build -w @superette/contracts \
 && npm run build -w @superette/api
# Alleen de package-manifesten bewaren, zodat de productie-install dezelfde
# lockfile ziet zonder broncode of devDependencies.
RUN mkdir -p /manifests \
 && for f in $(find . -name package.json -not -path '*/node_modules/*' -not -path '*/.next/*' -not -path '*/dist/*'); do \
      mkdir -p "/manifests/$(dirname "$f")" && cp "$f" "/manifests/$f"; \
    done \
 && cp package-lock.json /manifests/

# ── prod-deps: enkel runtime-afhankelijkheden ────────────────────────────────
FROM base AS prod-deps
COPY --from=build /manifests ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# ── migrate: eenmalige job vóór elke release ─────────────────────────────────
FROM build AS migrate
USER node
WORKDIR /app/apps/api
CMD ["npx", "prisma", "migrate", "deploy"]

# ── runtime ──────────────────────────────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production API_PORT=4000 LOG_FORMAT=json
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build --chown=node:node /app/packages/vat/package.json ./packages/vat/package.json
COPY --from=build --chown=node:node /app/packages/vat/dist ./packages/vat/dist
COPY --from=build --chown=node:node /app/packages/pricing/package.json ./packages/pricing/package.json
COPY --from=build --chown=node:node /app/packages/pricing/dist ./packages/pricing/dist
COPY --from=build --chown=node:node /app/packages/contracts/package.json ./packages/contracts/package.json
COPY --from=build --chown=node:node /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=build --chown=node:node /app/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=node:node /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=node:node /app/apps/api/prisma/schema.prisma ./apps/api/prisma/schema.prisma
# Importbestanden en e-mail-outbox komen via volumes; de mappen bestaan alvast.
RUN mkdir -p /app/apps/api/data/feeds /app/apps/api/data/outbox && chown -R node:node /app/apps/api/data
USER node
WORKDIR /app/apps/api
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.API_PORT||4000)+'/api/v1/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# tini geeft SIGTERM door aan node, zodat Nest's shutdown hooks lopen.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
