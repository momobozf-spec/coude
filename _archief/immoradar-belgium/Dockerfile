# ImmoRadar — productie-image.
#
# ─── ÉÉN IMAGE, TWEE ROLLEN ──────────────────────────────────────────────────
#
# Dezelfde image draait als webserver (`npm start`) en als achtergrondworker
# (`npm run worker`). Ze delen alle code en alle configuratie; alleen het
# startcommando verschilt. Twee images bouwen zou betekenen dat de collector en
# het dashboard kunnen gaan afwijken in versie, en dan verwerkt de ene laag data
# volgens regels die de andere niet kent.

FROM node:22-alpine AS deps
WORKDIR /app

# OpenSSL is nodig voor de Prisma query engine op Alpine.
RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
# `npm ci` en niet `npm install`: de lockfile is de waarheid, en een build die
# stilzwijgend een nieuwere minor binnenhaalt is niet reproduceerbaar.
RUN npm ci


FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# De client moet vóór de build bestaan: de servercomponenten importeren hem.
RUN npx prisma generate

# Een DATABASE_URL die alleen de env-validatie tevredenstelt. Er wordt tijdens
# de build geen verbinding geopend — alle pagina's zijn dynamisch (ze hangen van
# de sessie af), dus er valt niets te prerenderen dat de database raakt.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build


FROM node:22-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache openssl

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# De volledige node_modules en niet alleen de standalone-output: de worker draait
# via tsx op de TypeScript-bronnen, en `prisma migrate deploy` heeft de CLI nodig
# bij het opstarten van de container. Een kleinere image zou hier betekenen dat
# migraties en de collector elk hun eigen image krijgen — meer bewegende delen
# voor minder megabytes.
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma

COPY package.json next.config.ts prisma.config.ts tsconfig.json ./
COPY prisma ./prisma
COPY src ./src
COPY fixtures ./fixtures

# Niet als root draaien. Het node-image levert deze gebruiker al.
USER node

EXPOSE 3000

# Wordt door docker-compose overschreven; dit is de zinnigste standaard.
CMD ["npm", "start"]
