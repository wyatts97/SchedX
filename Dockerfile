# Stage 1: Build all packages
FROM node:22-bullseye-slim AS builder

# Install git for npm dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends git && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy .env first to check USE_LOCAL_AI
COPY .env.docker ./

# Only download if USE_LOCAL_AI=true
RUN if grep -q '^USE_LOCAL_AI=true$' .env.docker; then \
    npm run download-model; \
fi

# Copy root package files and all workspace package.jsons
COPY package.json package-lock.json ./
COPY packages/schedx-app/package.json ./packages/schedx-app/
COPY packages/schedx-shared-lib/package.json ./packages/schedx-shared-lib/
COPY packages/schedx-scheduler/package.json ./packages/schedx-scheduler/

# Install all dependencies (for all workspaces)
RUN npm ci

# Copy all source files
COPY . .

# Copy model files
COPY static/models/ ./static/models/

# Build in correct order: shared-lib MUST be built first
RUN npm run build -w @schedx/shared-lib
RUN npm run build -w @schedx/app
RUN npm run build -w @schedx/scheduler

# Stage 2: Production image
FROM node:22-bullseye-slim

# Create non-root user for security
RUN groupadd -r schedx && useradd -r -g schedx schedx

WORKDIR /app

# Copy files with correct ownership from the start
COPY --from=builder --chown=schedx:schedx /app/package.json ./
COPY --from=builder --chown=schedx:schedx /app/package-lock.json ./
COPY --from=builder --chown=schedx:schedx /app/node_modules ./node_modules
COPY --from=builder --chown=schedx:schedx /app/packages ./packages

# Create uploads and data directories with correct ownership
RUN mkdir -p /app/packages/schedx-app/uploads /data && \
    chown -R schedx:schedx /app/packages/schedx-app/uploads /data

# Switch to non-root user
USER schedx

# Use environment variable for port
ARG PORT=5173
ENV PORT=${PORT}
EXPOSE ${PORT}

# Add health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:${PORT}/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

# Default command (overridden by compose for scheduler)
CMD ["npm", "start", "-w", "@schedx/app"]