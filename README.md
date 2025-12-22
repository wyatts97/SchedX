<div align="center">
  <img src="./packages/schedx-app/static/app-icon-lightsout.png" alt="SchedX" width="100" />
  
  # SchedX
  
  **Self-hosted Twitter/X scheduling platform with multi-account support**
  
  [![License: Elastic 2.0](https://img.shields.io/badge/License-Elastic%202.0-blue.svg)](LICENSE)
  [![SvelteKit](https://img.shields.io/badge/SvelteKit-5.x-orange.svg)](https://kit.svelte.dev/)
  [![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg?logo=docker)](https://www.docker.com/)
</div>

---

## Features

| Category | Capabilities |
|----------|-------------|
| **Scheduling** | Schedule tweets & threads • Recurring posts • Queue with time slots • Drafts & templates • Drag-and-drop calendar |
| **Media** | Images, GIFs, videos up to 50MB • Auto-generated video thumbnails • Image optimization • Gallery management • Lightbox viewer |
| **Analytics** | Follower growth charts • Engagement metrics (likes, retweets, replies, views) • Auto-sync via Rettiwt-API • Manual sync button |
| **Bulk Ops** | Bulk delete/reschedule • CSV import • Queue reordering |
| **Reliability** | Auto-retry with exponential backoff • Email notifications (Resend) • Double-posting prevention • Health monitoring |
| **PWA** | Install as app • Push notifications • Offline support • Background sync |
| **Security** | OAuth 2.0 PKCE + 1.0a • AES-256 token encryption • Rate limiting • CSRF protection |
| **Themes** | Light, Dark, and Lights-Out modes • Timezone-aware scheduling |

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | SvelteKit 5, Svelte 5, TailwindCSS, Preline UI, ApexCharts, Schedule-X Calendar |
| **Backend** | Node.js 22, SvelteKit API routes, Zod validation, Superforms |
| **Database** | SQLite (better-sqlite3), AES-256-GCM encryption, Litestream backups |
| **Media** | Sharp (image optimization), fluent-ffmpeg (video thumbnails), bigger-picture (lightbox) |
| **Scheduler** | node-cron, atomic claim mechanism, auto-retry with backoff |
| **Auth** | OAuth 2.0 PKCE, OAuth 1.0a for media uploads |
| **Analytics** | Rettiwt-API (no rate limits), daily auto-sync |
| **Infra** | Docker, Pino logging, health checks, Litestream (SQLite replication) |

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
openssl rand -base64 32  # For COOKIE_ENCRYPTION_KEY

# Create .env file with:
AUTH_SECRET=<your-secret>
DB_ENCRYPTION_KEY=<your-key>
COOKIE_ENCRYPTION_KEY=<your-key>
DATABASE_PATH=./data/schedx.db
ORIGIN=http://localhost:5173
```

### 3. Install ffmpeg (required for video thumbnails)
```bash
# Windows
winget install ffmpeg

# macOS
brew install ffmpeg

# Linux
apt-get install ffmpeg
```

### 4. Run
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

Docker images include ffmpeg pre-installed for video thumbnail generation.

For production with automatic SQLite backups, use Litestream:
```bash
docker-compose -f docker-compose.litestream.yml up -d
```

See [docs/LITESTREAM.md](docs/LITESTREAM.md) for backup configuration.

## Twitter API Setup

1. Create app at [developer.x.com](https://developer.x.com/apps)
2. Configure OAuth 2.0: Read+Write, callback `https://yourdomain.com/api/auth/signin/twitter`
3. Get OAuth 1.0a keys (required for media uploads)
4. Add all credentials in SchedX → Admin → Twitter Apps

**Required scopes**: `tweet.read`, `tweet.write`, `users.read`, `offline.access`

## Analytics Setup (Optional)

SchedX uses Rettiwt-API for fetching engagement metrics (likes, retweets, replies, views) without Twitter API rate limits.

**Optional enhanced access**: For private/restricted content, add a Rettiwt API Key:
1. Install browser extension: [X Auth Helper](https://chromewebstore.google.com/detail/x-auth-helper) (Chrome) or [Rettiwt Auth Helper](https://addons.mozilla.org/firefox/addon/rettiwt-auth-helper/) (Firefox)
2. Log into Twitter/X in your browser
3. Click extension → Copy API Key
4. Paste in SchedX → Settings → Tweet Data

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
| `COOKIE_ENCRYPTION_KEY` | Rettiwt API key encryption (32+ chars) |
| `DATABASE_PATH` | SQLite file path |

| Optional | Default | Description |
|----------|---------|-------------|
| `PORT` | 5173 | Server port |
| `MAX_UPLOAD_SIZE` | 52428800 | Max upload size in bytes (50MB) |
| `CRON_SCHEDULE` | `* * * * *` | Tweet scheduler cron expression |
| `VAPID_PUBLIC_KEY` | *(disabled)* | Push notification public key |
| `VAPID_PRIVATE_KEY` | *(disabled)* | Push notification private key |
| `VAPID_SUBJECT` | `mailto:admin@schedx.app` | Push notification contact |
| `RESEND_API_KEY` | *(disabled)* | Resend.com API key for email notifications |
| `RESEND_FROM_EMAIL` | `noreply@schedx.app` | Email sender address |

## PWA & Push Notifications

SchedX is a Progressive Web App (PWA) that can be installed on any device and supports push notifications.

### Installing SchedX

| Platform | How to Install |
|----------|----------------|
| **Desktop (Chrome/Edge)** | Click the install icon in the address bar, or Menu → "Install SchedX" |
| **Android** | Chrome → Menu → "Add to Home Screen" or "Install App" |
| **iOS (Safari)** | Share button → "Add to Home Screen" |

### Push Notifications

Push notifications alert you when tweets are posted or fail, even when the app is closed.

**How it works:**
- **Desktop browsers**: Works in Chrome, Edge, Firefox, Safari 16+
- **Android**: Works in Chrome and most browsers
- **iOS**: Requires iOS 16.4+ AND installing SchedX as a PWA (Add to Home Screen)

**Server Setup:**
```bash
# Generate VAPID keys
npx web-push generate-vapid-keys

# Add to .env
VAPID_PUBLIC_KEY=your_public_key_here
VAPID_PRIVATE_KEY=your_private_key_here
VAPID_SUBJECT=mailto:your@email.com
```

**Enable notifications:** Settings → Push Notifications → Enable

### Offline Support

The service worker caches static assets for offline access. When offline:
- View cached pages and scheduled tweets
- Failed actions are queued for background sync
- Automatic retry when connection is restored

## Email Notifications (Optional)

SchedX can send email notifications when tweets are posted or fail using [Resend](https://resend.com).

1. Create account at [resend.com](https://resend.com)
2. Get API key from dashboard
3. Add to `.env`:
```bash
RESEND_API_KEY=re_xxxxx
RESEND_FROM_EMAIL=notifications@yourdomain.com
```
4. Enable in SchedX → Settings → Notifications

## System Requirements

| Component | Requirement |
|-----------|-------------|
| **Node.js** | 22.x or later |
| **ffmpeg** | Required for video thumbnails (included in Docker) |
| **SQLite** | Included via better-sqlite3 |
| **Storage** | ~100MB base + uploads |

## License

[Elastic License 2.0](LICENSE) — Free for personal use, commercial license required for business use.

---

<div align="center">
  <sub>Built with SvelteKit 5, SQLite, and Twitter API v2 • Self-hosted • Privacy-focused</sub>
</div> 