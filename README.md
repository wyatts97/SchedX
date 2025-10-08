<div align="center">
  <img src=".\packages\schedx-app\static\app-icon-lightsout.png" alt="SchedX App Icon" width="120" />
  
  # SchedX
  
  <em>Modern, secure, multi-account Twitter/X scheduling and management platform</em>
</div>

---

## ✨ Features

### **Core Features**
- **🔐 Secure OAuth 2.0 with PKCE**: Modern authentication with enhanced security
- **🐦 Multi-account support**: Connect and manage multiple Twitter/X accounts
- **📅 Advanced scheduling**: Schedule tweets with calendar and list views
- **📝 Drafts & Templates**: Save drafts and reusable tweet templates
- **📸 Media uploads**: Attach images, GIFs, and videos to tweets
- **🔧 Admin panel**: Manage Twitter/X API credentials and app settings
- **🎨 Responsive UI**: Mobile-first design with Preline UI and dark/light themes
- **⚡ Auto token refresh**: Automatic token management and renewal
- **📊 Analytics**: Track tweet performance and engagement

### **Production Features**
- **🛡️ Rate Limiting**: Automatic API protection with configurable limits
- **📝 Structured Logging**: Pino-based logging with correlation IDs
- **🔍 Error Tracking**: Sentry integration for error monitoring
- **🚀 Performance Optimized**: Database indexes for fast queries
- **🐳 Docker Ready**: Production-ready containers with security hardening
- **🔄 Retry Logic**: Automatic retry with exponential backoff
- **🎯 Global Error Boundary**: User-friendly error pages
- **📊 Request Tracing**: Correlation IDs for debugging

---

## 🚀 Quick Start

### 1. **Clone and Setup**
```bash
git clone https://github.com/wyatts97/schedx.git
cd schedx
npm install
```

### 2. **Environment Configuration**
```bash
# Copy environment template
cp .env.example .env

# Edit with your configuration
nano .env

# Validate environment (automatic before dev/build)
npm run validate:env
```

**Required Variables:**
```env
# Generate secrets with: openssl rand -base64 48
AUTH_SECRET=your_secure_auth_secret_here
DB_ENCRYPTION_KEY=your_secure_encryption_key_here

# Database
MONGODB_URI=mongodb://localhost:27017/schedx

# Server
ORIGIN=http://localhost:5173
PORT=5173
```
See [.env.example](.env.example) for all available options.

### 3. **Database Setup**
```bash
# Start MongoDB (using Docker)
npm run docker:dev

# Create database indexes for performance
npm run db:indexes
```

### 4. **Run Development**
```bash
# Start all services (app + scheduler)
npm run dev

# Or start individually
npm run dev:app      # Main application
npm run dev:scheduler # Tweet scheduler service
```

Visit [http://localhost:5173](http://localhost:5173)

### 5. **Production Deployment**
1. Go to [Twitter Developer Portal](https://developer.x.com/apps)
2. Create a new app or use existing one
3. Enable OAuth 2.0 (PKCE) in app settings

### 2. **Configure OAuth Settings**
- **App permissions**: Read and Write
- **Type of App**: Web App
- **Callback URLs**: 
  - Development: `http://localhost:5173/api/auth/signin/twitter`
  - Production: `https://yourdomain.com/api/auth/signin/twitter`
- **Website URL**: Your domain

### 3. **Required Scopes**
Ensure your app has these permissions:
- `tweet.read` - Read tweets
- `tweet.write` - Post tweets
- `users.read` - Read user info
- `offline.access` - Refresh tokens

### 4. **Add Credentials to SchedX**
1. Start the app and go to admin panel
2. Add your Twitter app credentials in the **Twitter Apps** section
3. Test the connection by connecting a Twitter account

---

## 🔧 Production Deployment

### **Quick Docker Compose Deployment**

**Prerequisites:**
- Docker and Docker Compose installed
- Domain name with DNS configured (for production)
- SSL certificate (recommended: Let's Encrypt)

**Step 1: Clone and Configure**
```bash
# Clone repository
git clone https://github.com/wyatts97/schedx.git
cd schedx

# Copy environment template
cp .env.example .env
```

**Step 2: Configure Environment**
Edit `.env` with your production values:
```env
# REQUIRED: Generate secure secrets
# Run: openssl rand -base64 48
AUTH_SECRET=your_production_auth_secret_min_32_chars
DB_ENCRYPTION_KEY=your_production_encryption_key_min_32_chars

# Database (Docker Compose will use these)
MONGO_USER=schedx_admin
MONGO_PASSWORD=your_secure_mongo_password
MONGO_DATABASE=schedx
MONGODB_URI=mongodb://schedx_admin:your_secure_mongo_password@mongo:27017/schedx?authSource=admin

# Server Configuration
NODE_ENV=production
ORIGIN=https://yourdomain.com  # Your actual domain
PORT=5173
HOST=0.0.0.0

# File Uploads
MAX_UPLOAD_SIZE=52428800
BODY_SIZE_LIMIT=10485760

# Scheduler
CRON_SCHEDULE=*/1 * * * *

# Optional: Monitoring
LOG_LEVEL=info
SENTRY_DSN=  # Add your Sentry DSN if using
```

**Step 3: Deploy**
```bash
# Build and start all services
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f

# Check health
curl http://localhost:5173/api/health
```

**Step 4: Initial Setup**
1. Access your application at `https://yourdomain.com`
2. Login with default credentials (change immediately!)
3. Go to Admin Panel → Twitter Apps
4. Add your Twitter API credentials
5. Connect your Twitter accounts

**Step 5: Set Up Reverse Proxy (Recommended)**

Using **Nginx**:
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

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

Using **Caddy** (automatic HTTPS):
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
docker-compose logs -f mongo

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
docker-compose exec mongo mongodump --out /data/backup

# Restore database
docker-compose exec mongo mongorestore /data/backup
```

## 📖 Usage Guide

### **Initial Setup**
1. Access your application (http://localhost:5173 for dev, your domain for production)
2. Login with default admin credentials
3. Go to Admin Panel → Twitter Apps
4. Add your Twitter API credentials
5. Connect your Twitter accounts through the **Accounts** page

> **Note:** If setting up for local development without Docker, you can run `npm run setup` for an interactive configuration wizard that auto-generates secrets and creates your `.env` file.

### **Connecting Twitter Accounts**
1. Go to **Twitter Accounts** page
2. Select your configured Twitter app
3. Click **Connect Account**
4. Authorize with Twitter
5. Account is now ready for scheduling

### **Scheduling Tweets**
1. Go to **Schedule** page
2. Select your connected account
3. Write your tweet content
4. Set schedule date/time
5. Add media (optional)
6. Save and schedule

### **Managing Drafts**
1. Go to **Drafts** page
2. Create and save draft tweets
3. Edit drafts anytime
4. Convert drafts to scheduled tweets

### **Templates**
1. Create reusable tweet templates
2. Use templates for consistent messaging
3. Customize templates per account

---

## 🏗️ Architecture

```
SchedX/
├── packages/
│   ├── schedx-app/          # Main SvelteKit application
│   ├── schedx-scheduler/    # Tweet scheduling service
│   └── schedx-shared-lib/   # Shared types and utilities
├── docker-compose.yml        # Development environment
├── Dockerfile               # Production container
└── .env                     # Environment configuration
```

### **Key Components**
- **Frontend**: SvelteKit with Preline UI
- **Backend**: SvelteKit API routes
- **Database**: MongoDB with encryption
- **Scheduler**: Node.js cron service
- **Auth**: OAuth 2.0 with PKCE
- **Storage**: Encrypted token storage
- **Twitter Apps**: Dynamic configuration through admin interface

---

## 🔒 Security Features

- **OAuth 2.0 with PKCE**: Modern, secure authentication
- **Token Encryption**: All tokens encrypted at rest
- **CSRF Protection**: State validation for OAuth flows
- **Input Validation**: Comprehensive request validation
- **Error Handling**: Secure error responses
- **Session Management**: Secure session handling
- **Rate Limiting**: Built-in API protection
- **Dynamic Credentials**: Twitter API credentials stored securely in database

---

## 🛠️ Development

### **Available Scripts**
```bash
# Setup & Configuration
npm run setup           # Interactive setup wizard
npm run validate:env    # Validate environment variables

# Database
npm run db:indexes      # Create database indexes
npm run db:setup        # Complete database setup

# Development
npm run dev             # Start all services
npm run dev:app         # Start main app only
npm run dev:scheduler   # Start scheduler only

# Build & Deploy
npm run build           # Build all packages
npm run start           # Start production

# Docker
npm run docker:dev      # Start development containers
npm run docker:prod     # Start production containers
npm run docker:down     # Stop all containers

# Code Quality
npm run lint            # Run linting
npm run format          # Format code
npm run security:check  # Security audit
```

### **Project Structure**
```
src/
├── lib/
│   ├── components/      # Reusable UI components
│   ├── server/          # Server-side utilities
│   └── types/           # TypeScript types
├── routes/              # SvelteKit routes
│   ├── api/            # API endpoints
│   └── pages/          # Page components
└── static/             # Static assets
```


## 📝 License

MIT License - see [LICENSE](LICENSE) for details.

---

<div align="center">
  <p>Built with ❤️ using SvelteKit, MongoDB, and Twitter API</p>
</div> 