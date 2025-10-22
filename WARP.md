# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Overview

SchedX is a Node.js monorepo (npm workspaces) with three packages:
- packages/schedx-app: SvelteKit web app (UI + API routes)
- packages/schedx-scheduler: cron-driven worker that posts due tweets
- packages/schedx-shared-lib: shared SQLite DB client, migrations, types, utilities

The system persists data in a local SQLite database via @schedx/shared-lib. OAuth tokens are encrypted at rest. The scheduler reads due tweets and posts to X/Twitter, including media upload with OAuth 1.0a when configured.

## Common commands

- Install deps for all workspaces
```bash path=null start=null
npm install
```

- Validate environment variables before running
```bash path=null start=null
npm run validate:env
```

- Development (both app + scheduler, from repo root)
```bash path=null start=null
# Build shared library first if not using dev.ps1 (needed for exports)
npm run build:shared
# Run the two services concurrently
npm run dev
```

- Windows convenience script (sets env, builds shared, launches both)
```pwsh path=null start=null
./dev.ps1
```

- Run only the app or only the scheduler (root scripts)
```bash path=null start=null
npm run dev:app
npm run dev:scheduler
```

- Build all packages (shared -> app -> scheduler)
```bash path=null start=null
npm run build
```

- Start in production-like mode (app preview + scheduler)
```bash path=null start=null
npm start
```

- Lint and format
```bash path=null start=null
# Repo-wide ESLint
npm run lint
# Repo-wide Prettier format
npm run format
# App-specific
npm run check --workspace=@schedx/app
npm run check:watch --workspace=@schedx/app
npm run lint --workspace=@schedx/app
npm run format --workspace=@schedx/app
```

- Scheduler single run and debug
```bash path=null start=null
# Process due tweets once (no cron loop)
npm run dev:once --workspace=@schedx/scheduler
# Debug with Node inspector
npm run dev:debug --workspace=@schedx/scheduler
```

- Docker (if compose files are present in your checkout)
```bash path=null start=null
npm run docker:dev
npm run docker:down
```

- Tests
```bash path=null start=null
# No test suites are configured in this repo at present
npm test   # placeholder only
```

## Environment and data

Required variables (enforced by scripts/validate-env.js):
- AUTH_SECRET: >=32 chars (token/session crypto)
- DB_ENCRYPTION_KEY: >=32 chars (encrypts OAuth tokens at rest)
- DATABASE_PATH: SQLite file path (e.g., ./data/schedx.db)
- ORIGIN, HOST, PORT: server config
- MAX_UPLOAD_SIZE: bytes (default 52,428,800 = 50MB)

Notes:
- dev.ps1 sets sensible local defaults and creates ./data if missing.
- Shared library exports rely on its build step; build it first when you see module resolution errors from @schedx/shared-lib.

## Architecture: big picture

- UI/API (packages/schedx-app)
  - SvelteKit routes under packages/schedx-app/src/routes handle login, composing tweets/threads, drafts, queue, etc.
  - Server utilities under packages/schedx-app/src/lib/server/ wrap the shared DatabaseClient and orchestrate OAuth (twitterAuth.ts), scheduling (tweetScheduler.ts), logging, and env validation.
  - Database access uses @schedx/shared-lib/backend DatabaseClient (SQLite). Migrations run automatically on first connection; the app also triggers migrations on startup.

- Worker (packages/schedx-scheduler)
  - Entrypoint src/index.ts schedules a cron task (node-cron) using CRON_SCHEDULE.
  - Uses shared DatabaseClient to query due tweets, groups by user, and posts via Twitter API v2; media upload uses v1.1 with OAuth 1.0a.
  - TokenManager refreshes OAuth2 tokens when near expiry and persists updates back to the DB.
  - Optional email notifications via Resend (configured through shared lib EmailService) if EMAIL_* vars are provided.

- Shared library (packages/schedx-shared-lib)
  - src/backend/db-sqlite.ts: DatabaseClient implemented on better-sqlite3 with an AES encryption layer for secrets.
  - src/backend/migrations: SQL migrations tracked in schema_migrations; applied automatically at runtime and copied to dist during build.
  - src/index.ts and src/types: domain types (Tweet, UserAccount, etc.) consumed by both app and scheduler.

Data flow:
1) User composes/schedules content in the app -> persisted via DatabaseClient to SQLite.
2) Scheduler cron finds due tweets -> posts to Twitter -> updates status/twitterTweetId in DB.
3) If recurrence configured, a follow-up scheduled record is created.

## Package-specific tips

- App (SvelteKit)
  - Vite server uses HOST/PORT from env; preview uses same.
  - Use npm run check to typecheck (svelte-check) and npm run lint/format for style.

- Scheduler
  - Use npm run dev:once for quick verification against current DB contents.
  - Health endpoint runs in-process (see src/health-server.ts) on HEALTH_PORT (default 3001).

## Caveats and legacy files

- The codebase has some legacy MongoDB utilities (e.g., scripts/create-indexes.js, certain server helpers). The runtime path is SQLite via packages/schedx-shared-lib/backend DatabaseClient. Prefer the shared lib APIs and DATABASE_PATH over any Mongo-specific scripts.
- If you see references to mongodb in Vite config or helper files, they are not part of the active persistence path.
