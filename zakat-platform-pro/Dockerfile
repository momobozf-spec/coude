# Barakah — productie-image.
#
# Eén image, twee rollen: webserver (`npm start`, standaard) en worker
# (`npm run worker`). Ze delen alle code en configuratie; alleen het
# startcommando verschilt, zodat ze nooit van versie kunnen verschillen.
#
# Prisma 7 gebruikt een TypeScript-client met de pg-driver: geen Rust-engine
# en geen platformgebonden binaries in de image.

FROM node:22-alpine AS deps
WORKDIR /app
# Schema en Prisma-config vóór `npm ci`: de postinstall genereert de client
# naar src/generated/prisma.
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci


FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
COPY --from=deps /app/src/generated ./src/generated
# Alleen om de env-validatie tevreden te stellen; de build opent geen
# databaseverbinding (alle pagina's zijn dynamisch).
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"
ENV AUTH_SECRET="build-only-secret-not-used-at-runtime-000000"
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx next build


FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV STORAGE_LOCAL_DIR=/data/storage

# Volledige node_modules: de worker en de beheerscripts draaien via tsx op de
# TypeScript-bronnen, en `prisma migrate deploy` heeft de CLI nodig.
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/src ./src
COPY --from=build /app/public ./public
COPY package.json next.config.ts prisma.config.ts tsconfig.json ./
COPY prisma ./prisma
COPY scripts ./scripts

# Bewijsstukken en jaarrapporten: koppel /data aan een persistent volume.
RUN mkdir -p /data/storage && chown -R node:node /data
VOLUME ["/data"]

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1

CMD ["npm", "start"]
