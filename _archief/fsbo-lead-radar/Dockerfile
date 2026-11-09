# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────────────
# Twee runtime-targets uit één build.
#
#   --target web      het dashboard, als slanke Next standalone-bundel
#   --target worker   de collectors, met tsx en de broncode erbij
#
# Waarom niet één image voor beide: de standalone-bundel van Next bevat alleen
# wat de webapp nodig heeft, en de worker is geen webapp. Hem in dezelfde image
# proppen zou betekenen dat het dashboard de volledige devDependencies meesleept
# in productie — of dat de worker niet kan starten omdat tsx ontbreekt.
# ─────────────────────────────────────────────────────────────────────────────

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# De Prisma-client moet bestaan voordat de Next-build erop typecheckt.
RUN npx prisma generate && npm run build

# ── Het dashboard ────────────────────────────────────────────────────────────
FROM node:22-alpine AS web
WORKDIR /app
ENV NODE_ENV=production

# Nooit als root draaien.
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Meegenomen zodat `prisma migrate deploy` vanuit de container kan draaien.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0

CMD ["node", "server.js"]

# ── De collectors ────────────────────────────────────────────────────────────
FROM node:22-alpine AS worker
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -g 1001 -S nodejs && adduser -S worker -u 1001

# De worker draait TypeScript rechtstreeks met tsx, dus hij heeft de broncode
# en de volledige node_modules nodig.
COPY --from=builder --chown=worker:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=worker:nodejs /app/src ./src
COPY --from=builder --chown=worker:nodejs /app/prisma ./prisma
COPY --from=builder --chown=worker:nodejs /app/fixtures ./fixtures
COPY --from=builder --chown=worker:nodejs /app/package.json ./package.json
COPY --from=builder --chown=worker:nodejs /app/tsconfig.json ./tsconfig.json

USER worker

CMD ["node_modules/.bin/tsx", "src/jobs/worker.ts"]
