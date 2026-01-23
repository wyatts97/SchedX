# syntax=docker/dockerfile:1.4

# Stage 1: Dependencies
FROM node:22-alpine AS deps

# Install system dependencies for native builds
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    curl

WORKDIR /app

# Copy only package files for dependency installation
COPY package.json package-lock.json ./
COPY packages/schedx-app/package.json ./packages/schedx-app/
COPY packages/schedx-shared-lib/package.json ./packages/schedx-shared-lib/
COPY packages/schedx-scheduler/package.json ./packages/schedx-scheduler/

# Install dependencies with npm cache mount
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# Stage 2: Builder
FROM deps AS builder

# Copy source files
COPY . .

# Build packages (scheduler is integrated into the app via hooks.server.ts, so we skip building the separate scheduler package)
RUN npm run build -w @schedx/shared-lib && \
    npm run build -w @schedx/app

# Stage 3: Production Runtime - Use specific Alpine version for reproducibility
FROM node:22-alpine3.20 AS runner

# Create non-root user and harden the container
# Note: Removed ffmpeg (~100MB) - video thumbnails handled client-side
RUN addgroup -S schedx && adduser -S schedx -G schedx && \
    # Remove package manager to prevent installing packages at runtime (security)
    rm -rf /var/cache/apk/* /tmp/* /var/tmp/* /sbin/apk /etc/apk

WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Copy workspace configuration
COPY --from=builder --chown=schedx:schedx /app/package.json /app/package-lock.json ./
COPY --from=builder --chown=schedx:schedx /app/packages/schedx-shared-lib/package.json ./packages/schedx-shared-lib/
COPY --from=builder --chown=schedx:schedx /app/packages/schedx-app/package.json ./packages/schedx-app/
COPY --from=builder --chown=schedx:schedx /app/packages/schedx-scheduler/package.json ./packages/schedx-scheduler/

# Install ONLY essential production dependencies
# Note: Cannot use --omit=optional as it breaks @node-rs/argon2 native binaries
RUN npm ci --omit=dev --ignore-scripts && \
    # Rebuild essential native modules for Alpine Linux
    npm rebuild better-sqlite3 && \
    # @node-rs/argon2 uses prebuilt binaries - no rebuild needed (uses linux-x64-musl for Alpine)
    # Aggressive cleanup - combine all find commands for efficiency
    npm cache clean --force && \
    rm -rf /root/.npm /tmp/* /root/.cache && \
    # Remove documentation files
    find /app/node_modules -type f \( -name '*.md' -o -name 'LICENSE*' -o -name 'CHANGELOG*' -o -name 'README*' -o -name 'HISTORY*' -o -name 'AUTHORS*' -o -name 'CONTRIBUTORS*' \) -delete 2>/dev/null || true && \
    # Remove source maps and TypeScript artifacts
    find /app/node_modules -type f \( -name '*.js.map' -o -name '*.mjs.map' -o -name '*.cjs.map' -o -name '*.d.ts.map' -o -name '*.css.map' \) -delete 2>/dev/null || true && \
    # Remove test/docs/examples/typing directories
    find /app/node_modules -type d \( -name 'test' -o -name 'tests' -o -name '__tests__' -o -name 'docs' -o -name 'doc' -o -name 'examples' -o -name 'example' -o -name 'coverage' -o -name '.github' -o -name '.vscode' -o -name 'benchmark' -o -name 'benchmarks' \) -exec rm -rf {} + 2>/dev/null || true && \
    # Remove TypeScript source files (keep .d.ts for module resolution)
    find /app/node_modules -type f -name '*.ts' ! -name '*.d.ts' -delete 2>/dev/null || true && \
    # Remove locale files except English (major size savings for intl packages)
    find /app/node_modules -type d -name 'locale' -exec sh -c 'find "$1" -type f ! -name "*en*" ! -name "*EN*" -delete 2>/dev/null' _ {} \; 2>/dev/null || true && \
    # Remove build artifacts from better-sqlite3
    rm -rf /app/node_modules/better-sqlite3/build/Release/obj.target /app/node_modules/better-sqlite3/build/Release/.deps /app/node_modules/better-sqlite3/prebuilds /app/node_modules/better-sqlite3/deps 2>/dev/null || true && \
    # Remove gyp build files
    find /app/node_modules -type d -name 'gyp' -exec rm -rf {} + 2>/dev/null || true && \
    find /app/node_modules -type f -name 'binding.gyp' -delete 2>/dev/null || true 

# Copy built packages (only dist folders and necessary files)
# Note: scheduler is integrated into the app, so we don't copy schedx-scheduler
COPY --from=builder --chown=schedx:schedx /app/packages/schedx-shared-lib/dist ./packages/schedx-shared-lib/dist
COPY --from=builder --chown=schedx:schedx /app/packages/schedx-app/build ./packages/schedx-app/build
COPY --from=builder --chown=schedx:schedx /app/packages/schedx-app/static ./packages/schedx-app/static

# Create data directories with proper permissions
# Note: video thumbnails are handled client-side, uploads dir is for media files
RUN mkdir -p /app/packages/schedx-app/uploads /data && \
    chown -R schedx:schedx /app/packages/schedx-app/uploads /data

# Switch to non-root user
USER schedx

# Expose port
ARG PORT=5173
ENV PORT=${PORT}
EXPOSE ${PORT}

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:${PORT}/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

# Start command using node directly for better performance
CMD ["node", "packages/schedx-app/build/index.js"]