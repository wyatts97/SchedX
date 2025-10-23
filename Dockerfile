# syntax=docker/dockerfile:1.4

# Stage 1: Dependencies
FROM node:22-bullseye-slim AS deps

# Install system dependencies
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && \
    apt-get install -y --no-install-recommends git curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy only package files for dependency installation
COPY package.json package-lock.json ./
COPY packages/schedx-app/package.json ./packages/schedx-app/
COPY packages/schedx-shared-lib/package.json ./packages/schedx-shared-lib/
COPY packages/schedx-scheduler/package.json ./packages/schedx-scheduler/

# Install dependencies with npm cache mount
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# Stage 2: Model Download (conditional)
FROM deps AS model-downloader

COPY .env.docker ./
COPY packages/schedx-app/scripts ./packages/schedx-app/scripts

# Download model if enabled (with cache for downloaded files)
RUN --mount=type=cache,target=/tmp/model-cache \
    if grep -q '^USE_LOCAL_AI=true$' .env.docker; then \
      cd packages/schedx-app && \
      npm run download-model && \
      [ -f "static/models/distilgpt2.onnx" ] || (echo "Model download failed" && exit 1); \
    fi

# Stage 3: Builder
FROM deps AS builder

# Copy source files
COPY . .

# Copy model from downloader stage if it exists
COPY --from=model-downloader /app/packages/schedx-app/static/ ./packages/schedx-app/static/

# Build packages in parallel where possible
RUN npm run build -w @schedx/shared-lib && \
    npm run build -w @schedx/app && \
    npm run build -w @schedx/scheduler

# Stage 4: Production Runtime
FROM node:22-bullseye-slim AS runner

# Create non-root user
RUN groupadd -r schedx && useradd -r -g schedx schedx

WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Copy workspace configuration
COPY --from=builder --chown=schedx:schedx /app/package.json /app/package-lock.json ./

# Copy only production node_modules (smaller)
COPY --from=builder --chown=schedx:schedx /app/node_modules ./node_modules

# Copy built packages
COPY --from=builder --chown=schedx:schedx /app/packages ./packages

# Create data directories with proper permissions
RUN mkdir -p /app/packages/schedx-app/uploads /data && \
    chown -R schedx:schedx /app/packages/schedx-app/uploads /data

# Switch to non-root user
USER schedx

# Expose port
ARG PORT=5173
ENV PORT=${PORT}
EXPOSE ${PORT}

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:${PORT}/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

# Start command
CMD ["npm", "start", "-w", "@schedx/app"]