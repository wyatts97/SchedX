# Stage 1: Builder
FROM node:22-bullseye-slim AS builder

# Install system dependencies including curl for faster downloads
RUN apt-get update && \
    apt-get install -y --no-install-recommends git curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 1. Copy package files first
COPY package.json package-lock.json ./
COPY packages/schedx-app/package.json ./packages/schedx-app/
COPY packages/schedx-shared-lib/package.json ./packages/schedx-shared-lib/
COPY packages/schedx-scheduler/package.json ./packages/schedx-scheduler/

# 2. Install workspace dependencies
RUN npm ci

# 3. Copy all remaining source files
COPY . .

# 4. Conditionally download model
COPY .env.docker ./
RUN if grep -q '^USE_LOCAL_AI=true$' .env.docker; then \
    cd packages/schedx-app && \
    npm run download-model && \
    [ -f "static/models/distilgpt2.onnx" ] || (echo "Model download failed" && exit 1) && \
    cd ../..; \
fi

# 5. Build in correct order
RUN npm run build -w @schedx/shared-lib
RUN npm run build -w @schedx/app
RUN npm run build -w @schedx/scheduler

# Stage 2: Production image
FROM node:22-bullseye-slim

# Create non-root user
RUN groupadd -r schedx && useradd -r -g schedx schedx

WORKDIR /app

# Copy workspace configuration files
COPY --from=builder --chown=schedx:schedx /app/package.json /app/package-lock.json ./

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