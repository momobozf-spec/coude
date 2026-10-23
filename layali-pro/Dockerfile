# Layali — productie-image.
#
# Eén image: de webserver migreert de database bij het opstarten en start dan
# Next.js (zie "start:render" in package.json). Prisma 7 gebruikt de pg-driver,
# dus er zitten geen platformgebonden Prisma-engines in de image.

FROM node:22-alpine AS deps
WORKDIR /app
# Schema en Prisma-config vóór `npm ci`: de postinstall genereert de client.
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci


FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Alleen om de module-imports tevreden te stellen; de build opent geen
# databaseverbinding (alle pagina's worden op aanvraag gerenderd).
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx next build


FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Volledige node_modules: migraties (prisma CLI) en de seed/bootstrap-scripts
# (tsx) draaien in deze image.
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/src ./src
COPY --from=build /app/messages ./messages
COPY package.json next.config.ts prisma.config.ts tsconfig.json ./
COPY prisma ./prisma
COPY scripts ./scripts

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/api/health >/dev/null || exit 1

CMD ["npm", "run", "start:render"]
