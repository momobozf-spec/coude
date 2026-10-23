# TenderKompas IT — productie-image (Next.js 16 + tsx-scripts voor migraties, admin:create en ted:import).
# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    STORAGE_DIR=/app/storage
COPY package.json package-lock.json ./
# node_modules uit de build-stage en dan prunen: `npm ci --omit=dev` faalt op de geneste esbuild van drizzle-kit
# (optionele peer van better-auth, daardoor niet als dev gemarkeerd). Getest: prune + start + migrate + admin:create.
COPY --from=build /app/node_modules ./node_modules
RUN npm prune --omit=dev && npm cache clean --force
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY next.config.ts tsconfig.json ./
COPY drizzle ./drizzle
COPY scripts ./scripts
COPY src ./src
RUN mkdir -p /app/storage && chown -R node:node /app/storage
USER node
EXPOSE 3000
# Migraties draaien als preDeployCommand (Render) of manueel: npm run db:migrate:prod
CMD ["npm", "start"]
