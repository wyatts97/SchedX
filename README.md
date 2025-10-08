<div align="center">
  <img src="./packages/schedx-app/static/app-icon-lightsout.png" alt="SchedX App Icon" width="120" />
  
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
git clone https://github.com/yourusername/schedx.git
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

### **Docker Deployment**
```bash
# Build and run with Docker Compose
docker-compose up -d

# Or build custom image
docker build -t schedx .
docker run -p 5173:5173 schedx
```

### **Environment Variables for Production**
```env
NODE_ENV=production
AUTH_SECRET=your_production_auth_secret
DB_ENCRYPTION_KEY=your_production_encryption_key
MONGODB_URI=mongodb://your-production-db:27017/schedx
ORIGIN=https://yourdomain.com
```

### **Security Checklist**
- [ ] Use strong, unique secrets for AUTH_SECRET and DB_ENCRYPTION_KEY
- [ ] Enable HTTPS in production
- [ ] Configure proper CORS settings
- [ ] Set up database backups
- [ ] Configure Twitter API credentials through admin panel
- [ ] Enable rate limiting
- [ ] Set up monitoring and logging

---

## 📖 Usage Guide

### **Initial Setup**
1. Run `npm run setup` to configure the application
2. Start the app and go to the admin panel
3. Add your Twitter API credentials in the **Twitter Apps** section
4. Connect your Twitter accounts through the **Accounts** page

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

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

### **Development Guidelines**
- Follow TypeScript best practices
- Use proper error handling
- Add comprehensive logging
- Test OAuth flows thoroughly
- Maintain security standards

---

## 📝 License

MIT License - see [LICENSE](LICENSE) for details.

---

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/schedx/issues)
- **Documentation**: [Wiki](https://github.com/yourusername/schedx/wiki)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/schedx/discussions)

---

<div align="center">
  <p>Built with ❤️ using SvelteKit, MongoDB, and Twitter API</p>
</div> 