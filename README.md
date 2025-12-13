<div align="center">
  <img src="./packages/schedx-app/static/app-icon-lightsout.png" alt="SchedX" width="100" />
  
  # SchedX
  
  **Self-hosted Twitter/X scheduling platform with multi-account support**
  
  [![License: Elastic 2.0](https://img.shields.io/badge/License-Elastic%202.0-blue.svg)](LICENSE)
  [![SvelteKit](https://img.shields.io/badge/SvelteKit-2.x-orange.svg)](https://kit.svelte.dev/)
  [![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg?logo=docker)](https://www.docker.com/)
</div>

---

## Features

| Category | Capabilities |
|----------|-------------|
| **Scheduling** | Schedule tweets, threads, recurring posts • Queue with time slots • Drafts & templates |
| **Media** | Images, GIFs, videos up to 50MB • Gallery management • Lightbox viewer |
| **Analytics** | Follower growth charts • Engagement metrics • Auto-sync daily + manual sync |
| **Bulk Ops** | Bulk delete/reschedule • CSV import • Queue reordering |
| **Reliability** | Auto-retry with exponential backoff • Email notifications • Health monitoring |
| **Security** | OAuth 2.0 PKCE + 1.0a • AES-256 token encryption • Rate limiting |

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | SvelteKit 5, TailwindCSS, Preline UI, ApexCharts |
| **Backend** | Node.js, SvelteKit API routes, Zod validation |
| **Database** | SQLite (better-sqlite3), AES-256-GCM encryption |
| **Scheduler** | node-cron, auto-retry with backoff |
| **Auth** | OAuth 2.0 PKCE, OAuth 1.0a for media |
| **Infra** | Docker, Pino logging, health checks |

## Quick Start

### 1. Clone & Install
```bash
git clone https://github.com/wyatts97/schedx.git
cd schedx && npm install
```

### 2. Configure
```bash
# Generate secrets
openssl rand -base64 32  # For AUTH_SECRET
openssl rand -base64 32  # For DB_ENCRYPTION_KEY

# Create .env file with:
AUTH_SECRET=<your-secret>
DB_ENCRYPTION_KEY=<your-key>
DATABASE_PATH=./data/schedx.db
ORIGIN=http://localhost:5173
```

### 3. Run
```bash
# Windows
.\dev.ps1

# Linux/Mac
npm run build:shared
npm run dev
```

Visit **http://localhost:5173** → Login: `admin` / `changeme` → **Change password immediately!**

## Docker Deployment

```bash
cp .env.example .env
# Edit .env with production values
docker-compose up -d
```

## Twitter API Setup

1. Create app at [developer.x.com](https://developer.x.com/apps)
2. Configure OAuth 2.0: Read+Write, callback `https://yourdomain.com/api/auth/signin/twitter`
3. Get OAuth 1.0a keys (required for media uploads)
4. Add all credentials in SchedX → Admin → Twitter Apps

**Required scopes**: `tweet.read`, `tweet.write`, `users.read`, `offline.access`

## Project Structure

```
schedx/
├── packages/
│   ├── schedx-app/          # SvelteKit app (routes, components, API)
│   ├── schedx-scheduler/    # Background job processor
│   └── schedx-shared-lib/   # DB client, types, migrations
├── docker-compose.yml
└── .env
```

## API Highlights

| Endpoint | Description |
|----------|-------------|
| `POST /api/tweets` | Create/schedule/publish tweet |
| `POST /api/tweets/bulk` | Bulk delete, reschedule, queue |
| `POST /api/tweets/import` | CSV import |
| `POST /api/queue` | Reorder queue |
| `POST /api/analytics/sync-engagement` | Manual sync |
| `GET /api/health` | Health check |

## Environment Variables

| Required | Description |
|----------|-------------|
| `AUTH_SECRET` | Session key (32+ chars) |
| `DB_ENCRYPTION_KEY` | Token encryption key (32+ chars) |
| `DATABASE_PATH` | SQLite file path |

| Optional | Default |
|----------|---------|
| `PORT` | 5173 |
| `MAX_UPLOAD_SIZE` | 52428800 (50MB) |
| `CRON_SCHEDULE` | `* * * * *` |

## License

[Elastic License 2.0](LICENSE) — Free for personal use, commercial license required for business use.

---

<div align="center">
  <sub>Built with SvelteKit, SQLite, and Twitter API • Self-hosted • Privacy-focused</sub>
</div> 