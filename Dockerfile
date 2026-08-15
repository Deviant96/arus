# syntax=docker/dockerfile:1

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev=false

FROM deps AS prod-deps
RUN npm prune --omit=dev --ignore-scripts

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Migrations must be present at runtime; Nuxt bundles server/ but drizzle
# SQL files are loaded from disk.
ENV NODE_ENV=production
ENV NUXT_TELEMETRY_DISABLED=1
ENV NUXT_DOCKER_BUILD=1
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV MIGRATIONS_DIR=/app/server/database/migrations

RUN addgroup -S arus && adduser -S arus -G arus

COPY --from=build /app/.output ./.output
COPY --from=build /app/server/database/migrations ./server/database/migrations
COPY --from=build /app/package.json ./package.json
# Nitro skips file-tracing on small VPS builds; runtime imports resolve here.
COPY --from=prod-deps /app/node_modules ./node_modules

USER arus
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
