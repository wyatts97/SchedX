# syntax=docker/dockerfile:1

# ---- build ----
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

# ---- runtime ----
FROM node:24-alpine
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/data \
    MIGRATIONS_DIR=/app/drizzle
WORKDIR /app

RUN addgroup -S schedx && adduser -S -G schedx schedx \
    && mkdir -p /data && chown schedx:schedx /data

COPY --from=build --chown=schedx:schedx /app/package.json ./
COPY --from=build --chown=schedx:schedx /app/node_modules ./node_modules
COPY --from=build --chown=schedx:schedx /app/build ./build
COPY --from=build --chown=schedx:schedx /app/drizzle ./drizzle

USER schedx
EXPOSE 3000
VOLUME ["/data"]
HEALTHCHECK --interval=60s --timeout=5s --start-period=20s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
CMD ["node", "build"]
