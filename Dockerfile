# Stage 1: Build all packages
FROM node:22-bullseye-slim AS builder

# Install git for npm dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends git && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files FIRST
COPY package.json package-lock.json ./
COPY packages/schedx-app/package.json ./packages/schedx-app/
COPY packages/schedx-shared-lib/package.json ./packages/schedx-shared-lib/
COPY packages/schedx-scheduler/package.json ./packages/schedx-scheduler/

# Then check .env for AI flag
COPY .env.docker ./
RUN if grep -q '^USE_LOCAL_AI=true$' .env.docker; then \
    npm run download-model; \
fi

# Install all dependencies
RUN npm ci

# Copy remaining source files
COPY . .

# Build in correct order
RUN npm run build -w @schedx/shared-lib
RUN npm run build -w @schedx/app
RUN npm run build -w @schedx/scheduler

# Stage 2: Production image
FROM node:22-bullseye-slim

# Create non-root user
RUN groupadd -r schedx && useradd -r -g schedx schedx

WORKDIR /app

# Copy built files
COPY --from=builder --chown=schedx:schedx /app/node_modules ./node_modules
COPY --from=builder --chown=schedx:schedx /app/packages ./packages

# Create data directories
RUN mkdir -p /app/packages/schedx-app/uploads /data && \
    chown -R schedx:schedx /app/packages/schedx-app/uploads /data

USER schedx

ARG PORT=5173
ENV PORT=${PORT}
EXPOSE ${PORT}

# Add health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:${PORT}/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

CMD ["npm", "start", "-w", "@schedx/app"]