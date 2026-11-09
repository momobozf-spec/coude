# syntax=docker/dockerfile:1

# Multi-stage build. De uiteindelijke image bevat geen bronbestanden, geen
# devDependencies en geen build-cache — alleen wat nodig is om te draaien.

# ── 1. Afhankelijkheden ───────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

# Alleen de manifesten kopiëren, zodat een wijziging in de broncode deze laag
# niet ongeldig maakt en npm ci niet opnieuw draait.
COPY package.json package-lock.json ./
RUN npm ci

# ── 2. Build ──────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# De Prisma-client hoort bij de build, niet bij de runtime.
RUN npx prisma generate

# Next leest env tijdens de build. Deze waarden zijn placeholders die alleen de
# validatie in src/config/env.ts tevredenstellen; de echte waarden komen bij het
# starten van de container uit de omgeving.
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV AUTH_SECRET="build-time-placeholder-secret-minstens-32-tekens"
ENV STORAGE_SIGNING_SECRET="build-time-placeholder-signing-key-32-tekens"

RUN npm run build

# ── 3. Runtime ────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Niet als root draaien. Een kwetsbaarheid in de applicatie mag geen root-shell
# in de container opleveren.
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma-schema en migraties: nodig om `prisma migrate deploy` te kunnen draaien
# bij het uitrollen.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# De map voor lokale documentopslag. In productie hoort hier een volume of een
# S3-compatibele bucket; een container-filesystem is niet duurzaam.
RUN mkdir -p /app/.storage && chown nextjs:nodejs /app/.storage

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
