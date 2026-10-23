# Muslim Life — production image.
#
# One stage on purpose: `npm run start:render` runs `prisma migrate deploy` and
# the reference seed (tsx) before `next start`, so the CLI tools stay installed.
FROM node:22-alpine

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

# Public values are inlined into the browser bundle at build time. The server
# reads APP_URL at runtime, so nothing below is required for a correct build.
ARG NEXT_PUBLIC_MAPS_PROVIDER=none
ENV NEXT_PUBLIC_MAPS_PROVIDER=$NEXT_PUBLIC_MAPS_PROVIDER

# `next build` loads every route to collect page data, and the auth config
# validates the server environment when it is imported. Render does not pass
# runtime secrets into the Docker build, so the build gets throwaway values
# that exist for this one command only. They are not written into the image
# or the bundle; the real DATABASE_URL and AUTH_SECRET are read at runtime.
RUN DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build" \
    AUTH_SECRET="build-only-placeholder-never-used-at-runtime-0000" \
    sh -c 'npx prisma generate && npx next build' \
  && mkdir -p .next/cache && chown -R node:node .next

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

USER node
CMD ["npm", "run", "start:render"]
