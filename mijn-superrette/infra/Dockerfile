# Multi-stage image for the API and the worker (select with APP_TARGET).
FROM node:22-bookworm-slim AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --filter "@superrette/api..." --filter "@superrette/worker..." \
 && pnpm -r --filter "./packages/**" --filter "!@superrette/ui" build \
 && pnpm --filter @superrette/api build && pnpm --filter @superrette/worker build \
 && pnpm deploy --filter @superrette/api --prod --legacy /out/api \
 && pnpm deploy --filter @superrette/worker --prod --legacy /out/worker

FROM node:22-bookworm-slim AS runtime
ARG APP_TARGET=api
ENV NODE_ENV=production APP_ENV=production
WORKDIR /app
COPY --from=build /out/${APP_TARGET} .
COPY --from=build /repo/packages/database/drizzle ./node_modules/@superrette/database/drizzle
USER node
CMD ["node", "dist/main.js"]
