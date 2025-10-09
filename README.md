<div align="center">
  <img src=".\packages\schedx-app\static\app-icon-lightsout.png" alt="SchedX App Icon" width="120" />
  
  # SchedX
  
  <em>Modern, self-hosted Twitter/X scheduling and management platform with multi-account support</em>
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
  [![Node.js](https://img.shields.io/badge/Node.js-22.x-green.svg)](https://nodejs.org/)
  [![SvelteKit](https://img.shields.io/badge/SvelteKit-2.x-orange.svg)](https://kit.svelte.dev/)
</div>

---

## ✨ Features

### **Core Functionality**
- **🐦 Multi-Account Management**: Connect and manage multiple Twitter/X accounts seamlessly
- **📅 Advanced Scheduling**: Schedule tweets with precise date/time control
- **🧵 Thread Support**: Create and schedule tweet threads
- **📝 Drafts & Templates**: Save drafts and create reusable tweet templates
- **📸 Media Support**: Upload and attach images, GIFs, and videos (up to 50MB)
- **📊 Queue Management**: Auto-schedule tweets with customizable posting times
- **🔄 Recurring Tweets**: Schedule daily, weekly, or monthly recurring posts
- **🎨 Modern UI**: Responsive design with dark/light themes and mobile support

### **Security & Authentication**
- **🔐 OAuth 2.0 with PKCE**: Secure Twitter authentication
- **🔑 OAuth 1.0a Support**: Full media upload capabilities
- **🔒 Token Encryption**: All access tokens encrypted at rest with AES-256
- **⚡ Auto Token Refresh**: Automatic OAuth token renewal
- **🛡️ Rate Limiting**: Built-in API protection with configurable limits
- **🔐 Admin Authentication**: Secure admin panel access

### **Production Ready**
- **💾 SQLite Database**: Lightweight, file-based database with encryption
- **📝 Structured Logging**: Pino-based logging with correlation IDs
- **🔍 Error Tracking**: Optional Sentry integration
- **🚀 Performance Optimized**: Indexed queries and efficient caching
- **🐳 Docker Ready**: Production containers with health checks
- **🔄 Automatic Retries**: Exponential backoff for failed operations
- **📊 Health Monitoring**: Built-in health check endpoints

---

## 🚀 Quick Start

### **Prerequisites**
- Node.js 22.x or higher
- npm or pnpm
- (Optional) Docker for containerized deployment

### **Development Setup**

#### **1. Clone and Install**
```bash
git clone https://github.com/wyatts97/schedx.git
cd schedx
npm install
```

#### **2. Configure Environment**

**Windows (PowerShell):**
```powershell
# The dev.ps1 script automatically sets environment variables
# Just run the development script (see step 3)
```

**Linux/Mac:**
```bash
# Create environment file
cat > .env << 'EOF'
AUTH_SECRET=19T80r0DzwbN1xlYWVRmXuAgckkGazr2
DB_ENCRYPTION_KEY=CA6FLUXuu9cACwfLYwoyHr02B4UBbXwO
DATABASE_PATH=./data/schedx.db
NODE_ENV=development
PORT=5173
HOST=0.0.0.0
ORIGIN=http://localhost:5173
MAX_UPLOAD_SIZE=52428800
CRON_SCHEDULE=* * * * *
EOF
```

> **Security Note**: Generate your own secrets for production:
> ```bash
> openssl rand -base64 32
> ```

#### **3. Start Development Server**

**Windows:**
```powershell
.\dev.ps1
```

**Linux/Mac:**
```bash
# Build shared library first
npm run build:shared

# Start scheduler (in one terminal)
cd packages/schedx-scheduler && npm run dev

# Start app (in another terminal)
cd packages/schedx-app && npm run dev
```

Visit **http://localhost:5173**

Default admin credentials:
- **Username**: `admin`
- **Password**: `changeme`

> ⚠️ **Change the default password immediately after first login!**

---

## 🔧 Twitter API Setup

### **1. Create Twitter App**
1. Go to [Twitter Developer Portal](https://developer.x.com/apps)
2. Create a new app or select existing one
3. Navigate to app settings

### **2. Configure OAuth 2.0**
- **App permissions**: Read and Write
- **Type of App**: Web App, Automated App or Bot
- **Callback URLs**: 
  - Development: `http://localhost:5173/api/auth/signin/twitter`
  - Production: `https://yourdomain.com/api/auth/signin/twitter`
- **Website URL**: Your domain or `http://localhost:5173`

**Required OAuth 2.0 Scopes:**
- `tweet.read` - Read tweets
- `tweet.write` - Post and delete tweets
- `users.read` - Read user profile information
- `offline.access` - Refresh access tokens

### **3. Get OAuth 1.0a Credentials (Required for Media)**
In your app settings, navigate to **Keys and Tokens**:
- Copy **API Key** (Consumer Key)
- Copy **API Key Secret** (Consumer Secret)
- Generate **Access Token** and **Access Token Secret**

> **Note**: OAuth 1.0a credentials are required for uploading media (images/videos) to tweets.

### **4. Add Credentials to SchedX**
1. Login to SchedX admin panel
2. Go to **Twitter Apps** section
3. Click **Add Twitter App**
4. Fill in all credentials:
   - **App Name**: Your app name
   - **Client ID**: OAuth 2.0 Client ID
   - **Client Secret**: OAuth 2.0 Client Secret
   - **Consumer Key**: OAuth 1.0a API Key
   - **Consumer Secret**: OAuth 1.0a API Key Secret
   - **Access Token**: OAuth 1.0a Access Token
   - **Access Token Secret**: OAuth 1.0a Access Token Secret
   - **Callback URL**: Your callback URL
5. Save and test connection

---

## 🐳 Production Deployment

### **Docker Compose Deployment**

**Prerequisites:**
- Docker and Docker Compose installed
- Domain name with DNS configured (optional, for HTTPS)
- SSL certificate (recommended: Let's Encrypt with Caddy or Nginx)

#### **Step 1: Clone and Configure**
```bash
git clone https://github.com/wyatts97/schedx.git
cd schedx
```

#### **Step 2: Configure Environment**
Edit `.env.docker` with your production values:
```env
# REQUIRED: Generate secure secrets
# Run: openssl rand -base64 32
AUTH_SECRET=your_production_auth_secret_min_32_chars
DB_ENCRYPTION_KEY=your_production_encryption_key_min_32_chars

# Database - SQLite in Docker volume
DATABASE_PATH=/data/schedx.db

# Server Configuration
NODE_ENV=production
ORIGIN=https://yourdomain.com  # Your actual domain
PORT=5173
HOST=0.0.0.0

# Network Access (for home lab/self-hosted)
ALLOW_LOCAL_NETWORK=true  # Set to false for public deployments

# File Uploads (50MB max)
MAX_UPLOAD_SIZE=52428800

# Scheduler (runs every minute)
CRON_SCHEDULE=* * * * *

# Optional: Email Notifications
EMAIL_NOTIFICATIONS_ENABLED=false
EMAIL_PROVIDER=resend
RESEND_API_KEY=your_resend_api_key
EMAIL_FROM=noreply@yourdomain.com

# Optional: Error Tracking
SENTRY_DSN=your_sentry_dsn_if_using
LOG_LEVEL=info
```

#### **Step 3: Deploy**
```bash
# Build and start all services
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f app
docker-compose logs -f scheduler

# Check health
curl http://localhost:5173/api/health
```

#### **Step 4: Initial Setup**
1. Access your application at `http://localhost:5173` or `https://yourdomain.com`
2. Login with default credentials:
   - Username: `admin`
   - Password: `changeme`
3. **Change password immediately!**
4. Go to Admin Panel → Twitter Apps
5. Add your Twitter API credentials
6. Connect your Twitter accounts

#### **Step 5: Set Up Reverse Proxy (Recommended)**

**Using Nginx:**
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 50M;
    }
}
```

**Using Caddy (automatic HTTPS):**
```
yourdomain.com {
    reverse_proxy localhost:5173
}
```

### **Management Commands**
```bash
# View logs
docker-compose logs -f app
docker-compose logs -f scheduler

# Restart services
docker-compose restart app
docker-compose restart scheduler

# Stop all services
docker-compose down

# Update and restart
git pull
docker-compose down
docker-compose up -d --build

# Backup database
docker cp schedx-app-1:/data/schedx.db ./backup-$(date +%Y%m%d).db

# Restore database
docker cp ./backup-20240101.db schedx-app-1:/data/schedx.db
docker-compose restart app scheduler

# View database size
docker exec schedx-app-1 du -h /data/schedx.db
```

## 📖 Usage Guide

### **Connecting Twitter Accounts**
1. Login to SchedX
2. Go to **Accounts** page
3. Click **Connect Twitter Account**
4. Select your configured Twitter app
5. Authorize with Twitter/X
6. Account is now connected and ready

### **Creating Tweets**

#### **Schedule a Tweet**
1. Go to **Post** page
2. Select your connected account
3. Write your tweet content (up to 280 characters)
4. Add media (optional): Click upload button to add images/GIFs/videos
5. Set schedule date and time
6. Click **Schedule Tweet**

#### **Save as Draft**
1. Write your tweet content
2. Click **Save as Draft**
3. Access drafts later from **Drafts** page
4. Edit and schedule when ready

#### **Create Template**
1. Write reusable tweet content
2. Add template name and category
3. Click **Save as Template**
4. Reuse from **Templates** page

#### **Add to Queue**
1. Configure queue settings first (see Queue Management)
2. Write tweet content
3. Click **Add to Queue**
4. Tweet will be auto-scheduled based on your queue settings

#### **Publish Immediately**
1. Write tweet content
2. Add media if desired
3. Click **Publish Now**
4. Tweet posts immediately to Twitter/X

### **Thread Management**
1. Go to **Thread** page
2. Select your account
3. Add multiple tweets to create a thread
4. Set schedule time
5. Entire thread posts as connected tweets

### **Queue Management**
1. Go to **Queue** page
2. Configure posting times (e.g., 9:00 AM, 1:00 PM, 5:00 PM)
3. Set timezone
4. Set minimum interval between posts
5. Set maximum posts per day
6. Enable/disable weekends
7. Add tweets to queue - they auto-schedule to next available slot

### **Media Gallery**
1. Go to **Gallery** page
2. View all uploaded media
3. Filter by account
4. Delete unused media
5. Click media to copy URL for reuse

---

## 🏗️ Architecture

### **Project Structure**
```
SchedX/
├── packages/
│   ├── schedx-app/              # Main SvelteKit application
│   │   ├── src/
│   │   │   ├── lib/
│   │   │   │   ├── components/  # UI components
│   │   │   │   ├── server/      # Server utilities
│   │   │   │   └── validation/  # Input validation
│   │   │   └── routes/
│   │   │       ├── api/         # API endpoints
│   │   │       └── (pages)/     # UI pages
│   │   └── static/              # Static assets
│   │
│   ├── schedx-scheduler/        # Tweet scheduling service
│   │   └── src/
│   │       ├── tweetProcessor.ts
│   │       ├── tokenManager.ts
│   │       └── index.ts
│   │
│   └── schedx-shared-lib/       # Shared code
│       └── src/
│           ├── backend/
│           │   ├── db-sqlite.ts       # Database client
│           │   ├── sqlite-wrapper.ts  # SQLite wrapper
│           │   ├── encryption.ts      # Token encryption
│           │   └── migrations/        # DB migrations
│           └── types/           # TypeScript types
│
├── data/                        # SQLite database (dev)
├── uploads/                     # Media uploads
├── docker-compose.yml           # Docker orchestration
├── Dockerfile                   # Production container
├── .env.docker                  # Docker environment
└── dev.ps1                      # Development script (Windows)
```

### **Technology Stack**
- **Frontend**: SvelteKit 2.x, TailwindCSS, Preline UI
- **Backend**: SvelteKit API routes, Node.js
- **Database**: SQLite with better-sqlite3 (synchronous)
- **Scheduler**: Node-cron for tweet processing
- **Authentication**: OAuth 2.0 (PKCE) + OAuth 1.0a
- **Encryption**: AES-256-GCM for token storage
- **Logging**: Pino structured logging
- **File Storage**: Local filesystem for media
- **Containerization**: Docker with multi-stage builds

### **Data Flow**
1. **User creates tweet** → SvelteKit API validates and saves to SQLite
2. **Scheduler runs** (every minute) → Queries due tweets from SQLite
3. **Token refresh** → Automatic OAuth 2.0 token renewal if needed
4. **Media upload** → OAuth 1.0a client uploads to Twitter
5. **Tweet posting** → OAuth 1.0a client posts tweet with media IDs
6. **Status update** → SQLite updated with Twitter tweet ID

### **Security Architecture**
- **Token Encryption**: All OAuth tokens encrypted with `DB_ENCRYPTION_KEY`
- **Session Management**: Secure session handling with expiration
- **Rate Limiting**: Per-user and global rate limits
- **Input Validation**: Zod schemas for all API inputs
- **CSRF Protection**: State validation for OAuth flows
- **SQL Injection Prevention**: Parameterized queries only

---

## 🛠️ Development

### **Available Scripts**
```bash
# Development (Windows)
.\dev.ps1               # Start app + scheduler with auto-config

# Development (Linux/Mac)
npm run build:shared    # Build shared library
npm run dev:app         # Start main app
npm run dev:scheduler   # Start scheduler

# Build
npm run build           # Build all packages
npm run build:shared    # Build shared library only
npm run build -w @schedx/app        # Build app only
npm run build -w @schedx/scheduler  # Build scheduler only

# Production
npm start -w @schedx/app        # Start production app
npm start -w @schedx/scheduler  # Start production scheduler

# Docker
docker-compose up -d            # Start production
docker-compose logs -f          # View logs
docker-compose down             # Stop all services

# Database
# SQLite database is auto-created on first run
# Location: ./data/schedx.db (dev) or /data/schedx.db (Docker)
```

### **Environment Variables**

**Required:**
- `AUTH_SECRET` - Session encryption key (min 32 chars)
- `DB_ENCRYPTION_KEY` - Database encryption key (min 32 chars)
- `DATABASE_PATH` - SQLite database file path

**Optional:**
- `PORT` - Server port (default: 5173)
- `HOST` - Server host (default: 0.0.0.0)
- `ORIGIN` - App origin URL
- `MAX_UPLOAD_SIZE` - Max file size in bytes (default: 52428800 = 50MB)
- `CRON_SCHEDULE` - Scheduler cron pattern (default: `* * * * *`)
- `LOG_LEVEL` - Logging level (default: info)
- `SENTRY_DSN` - Sentry error tracking DSN
- `EMAIL_NOTIFICATIONS_ENABLED` - Enable email notifications
- `RESEND_API_KEY` - Resend API key for emails

### **Database Schema**

SQLite tables:
- `users` - Admin users
- `accounts` - OAuth connected accounts (encrypted tokens)
- `tweets` - Scheduled/posted tweets with media
- `twitter_apps` - Twitter API credentials
- `notifications` - User notifications
- `sessions` - User sessions
- `threads` - Tweet threads
- `queue_settings` - Queue configuration per user
- `api_usage` - API usage tracking

All timestamps stored as Unix milliseconds. Tokens encrypted with AES-256-GCM.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📝 License

MIT License - see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- **SvelteKit** - Modern web framework
- **Twitter API** - Tweet posting and management
- **better-sqlite3** - Fast, synchronous SQLite
- **Preline UI** - Beautiful UI components
- **TailwindCSS** - Utility-first CSS framework

---

<div align="center">
  <p>Built with ❤️ using SvelteKit, SQLite, and Twitter API</p>
  <p>Self-hosted • Privacy-focused • Open Source</p>
</div> 