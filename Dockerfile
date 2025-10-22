# Stage 1: Build all packages
FROM node:22-bullseye-slim AS builder

WORKDIR /app

# Copy root package files and all workspace package.jsons
COPY package.json package-lock.json ./
COPY packages/schedx-app/package.json ./packages/schedx-app/
COPY packages/schedx-shared-lib/package.json ./packages/schedx-shared-lib/
COPY packages/schedx-scheduler/package.json ./packages/schedx-scheduler/

# Install all dependencies (for all workspaces)
RUN npm ci

# Copy all source files
COPY . .

# Build in correct order: shared-lib MUST be built first
RUN npm run build -w @schedx/shared-lib
RUN echo "=== Verifying migrations were copied ===" && \
    ls -la /app/packages/schedx-shared-lib/dist/backend/migrations/ && \
    echo "=== Migration files found ===" || echo "=== ERROR: No migration files! ==="
RUN npm run build -w @schedx/app
RUN npm run build -w @schedx/scheduler

# Download TinyLlama model if enabled
ARG USE_LOCAL_AI=true
RUN if [ "$USE_LOCAL_AI" = "true" ]; then \
    mkdir -p /app/static/models && \
    curl -L https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf \
    -o /app/static/models/tinyllama.gguf; \
fi

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
COPY --from=builder --chown=schedx:schedx /app/static/models ./static/models

# Create uploads and data directories with correct ownership
RUN mkdir -p /app/packages/schedx-app/uploads /data /app/static/models && \
    chown -R schedx:schedx /app/packages/schedx-app/uploads /data

# Download TinyLlama model if enabled
ARG USE_LOCAL_AI=true
RUN if [ "$USE_LOCAL_AI" = "true" ]; then \
    curl -L https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf \
    -o /app/static/models/tinyllama.gguf && \
    chown schedx:schedx /app/static/models/tinyllama.gguf; \
fi

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