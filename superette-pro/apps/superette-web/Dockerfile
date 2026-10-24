# syntax=docker/dockerfile:1.7
# Superette-app (Next.js, standalone) — bouw vanaf de repositoryroot:
#   docker build -f apps/superette-web/Dockerfile \
#     --build-arg NEXT_PUBLIC_API_URL=https://api.superette.be/api/v1 \
#     -t superette-web .
#
# NEXT_PUBLIC_* wordt bij de build in de browserbundel gebakken: alleen
# publieke waarden (de API-URL, optioneel afbeeldingshosts of een eigen
# analytics-origin). Nooit een sleutel.
ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-alpine AS base
RUN apk add --no-cache libc6-compat tini
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 NPM_CONFIG_UPDATE_NOTIFIER=false NPM_CONFIG_FUND=false

# ── build ────────────────────────────────────────────────────────────────────
FROM base AS build
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_IMAGE_HOSTS=""
ARG NEXT_PUBLIC_ANALYTICS_ORIGIN=""
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    NEXT_PUBLIC_IMAGE_HOSTS=${NEXT_PUBLIC_IMAGE_HOSTS} \
    NEXT_PUBLIC_ANALYTICS_ORIGIN=${NEXT_PUBLIC_ANALYTICS_ORIGIN} \
    NODE_ENV=production
COPY . .
RUN npm ci --ignore-scripts
RUN npm run build -w @superette/vat \
 && npm run build -w @superette/pricing \
 && npm run build -w @superette/contracts \
 && npm run build -w @superette/web

# ── runtime: alleen de standalone-server, static assets en public ────────────
FROM base AS runtime
ENV NODE_ENV=production PORT=3001 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/apps/superette-web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/superette-web/.next/static ./apps/superette-web/.next/static
COPY --from=build --chown=node:node /app/apps/superette-web/public ./apps/superette-web/public
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/superette-web/server.js"]
