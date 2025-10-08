# 🚀 SchedX Deployment Guide

Complete guide for deploying SchedX to production.

---

## 📋 Pre-Deployment Checklist

### **Security**
- [ ] Generate strong `AUTH_SECRET` (min 48 chars): `openssl rand -base64 48`
- [ ] Generate strong `DB_ENCRYPTION_KEY` (min 48 chars): `openssl rand -base64 48`
- [ ] Set up HTTPS/TLS certificates
- [ ] Configure firewall rules
- [ ] Set strong MongoDB credentials
- [ ] Configure Sentry DSN for error tracking
- [ ] Review and update CORS settings

### **Configuration**
- [ ] Copy `.env.production.example` to `.env.production`
- [ ] Update all environment variables
- [ ] Set `NODE_ENV=production`
- [ ] Set `ORIGIN` to production domain with HTTPS
- [ ] Configure MongoDB connection string
- [ ] Set rate limiting values

### **Database**
- [ ] Set up MongoDB (Atlas recommended for production)
- [ ] Create database indexes: `npm run db:indexes`
- [ ] Configure automated backups
- [ ] Test database connection

### **Monitoring**
- [ ] Set up Sentry account and get DSN
- [ ] Configure log aggregation
- [ ] Set up uptime monitoring
- [ ] Configure alerting

---

## 🐳 Docker Deployment

### **Option 1: Docker Compose (Recommended)**

#### **Development**
```bash
# 1. Copy environment file
cp .env.example .env

# 2. Update environment variables
nano .env

# 3. Start services
npm run docker:dev

# 4. Create database indexes
npm run db:indexes

# 5. Check logs
docker-compose logs -f app
```

#### **Production**
```bash
# 1. Copy production environment file
cp .env.production.example .env.production

# 2. Update all production variables
nano .env.production

# 3. Build and start services
npm run docker:prod

# 4. Create database indexes
npm run db:indexes

# 5. Verify deployment
curl https://yourdomain.com/api/health
```

### **Option 2: Standalone Docker**

```bash
# Build image
docker build -t schedx:latest .

# Run app
docker run -d \
  --name schedx-app \
  -p 3000:3000 \
  --env-file .env.production \
  schedx:latest

# Run scheduler
docker run -d \
  --name schedx-scheduler \
  --env-file .env.production \
  schedx:latest npm run start --workspace=@schedx/scheduler
```

---

## 🌐 Cloud Platform Deployment

### **AWS (Elastic Beanstalk)**

```bash
# 1. Install EB CLI
pip install awsebcli

# 2. Initialize EB
eb init -p docker schedx

# 3. Create environment
eb create schedx-prod

# 4. Set environment variables
eb setenv NODE_ENV=production \
  AUTH_SECRET=your_secret \
  DB_ENCRYPTION_KEY=your_key \
  MONGODB_URI=your_mongodb_uri \
  SENTRY_DSN=your_sentry_dsn

# 5. Deploy
eb deploy

# 6. Open application
eb open
```

### **Google Cloud Platform (Cloud Run)**

```bash
# 1. Build and push image
gcloud builds submit --tag gcr.io/PROJECT_ID/schedx

# 2. Deploy to Cloud Run
gcloud run deploy schedx \
  --image gcr.io/PROJECT_ID/schedx \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production,AUTH_SECRET=xxx

# 3. Get service URL
gcloud run services describe schedx --format='value(status.url)'
```

### **Heroku**

```bash
# 1. Create Heroku app
heroku create schedx-app

# 2. Add MongoDB addon
heroku addons:create mongolab:sandbox

# 3. Set environment variables
heroku config:set NODE_ENV=production
heroku config:set AUTH_SECRET=your_secret
heroku config:set DB_ENCRYPTION_KEY=your_key
heroku config:set SENTRY_DSN=your_sentry_dsn

# 4. Deploy
git push heroku main

# 5. Scale dynos
heroku ps:scale web=1 scheduler=1
```

### **DigitalOcean App Platform**

```bash
# 1. Create app via UI or CLI
doctl apps create --spec app.yaml

# 2. Set environment variables in UI
# Navigate to: Settings > Environment Variables

# 3. Deploy
doctl apps create-deployment APP_ID
```

---

## 🗄️ Database Setup

### **MongoDB Atlas (Recommended)**

1. **Create Cluster**
   - Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
   - Create a free or paid cluster
   - Choose region closest to your app

2. **Configure Network Access**
   - Add your application's IP addresses
   - Or allow access from anywhere (0.0.0.0/0) with strong auth

3. **Create Database User**
   - Username: `schedx_admin`
   - Password: Generate strong password
   - Role: `readWrite` on `schedx` database

4. **Get Connection String**
   ```
   mongodb+srv://schedx_admin:PASSWORD@cluster.mongodb.net/schedx
   ```

5. **Create Indexes**
   ```bash
   MONGODB_URI=your_atlas_uri npm run db:indexes
   ```

### **Self-Hosted MongoDB**

```bash
# 1. Install MongoDB
# Ubuntu/Debian
sudo apt-get install mongodb-org

# 2. Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod

# 3. Create admin user
mongosh
use admin
db.createUser({
  user: "admin",
  pwd: "strong_password",
  roles: ["root"]
})

# 4. Create app user
use schedx
db.createUser({
  user: "schedx_admin",
  pwd: "strong_password",
  roles: ["readWrite"]
})

# 5. Enable authentication
# Edit /etc/mongod.conf
security:
  authorization: enabled

# 6. Restart MongoDB
sudo systemctl restart mongod
```

---

## 🔐 Security Hardening

### **1. Environment Variables**
```bash
# Never commit these files
.env
.env.production
.env.local

# Use secrets management in production
# AWS: AWS Secrets Manager
# GCP: Secret Manager
# Azure: Key Vault
```

### **2. HTTPS/TLS**
```bash
# Use Let's Encrypt for free SSL
sudo certbot --nginx -d yourdomain.com

# Or use cloud provider's SSL
# AWS: ACM (AWS Certificate Manager)
# GCP: Google-managed SSL
# Cloudflare: Universal SSL
```

### **3. Firewall Rules**
```bash
# Allow only necessary ports
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable

# Block MongoDB port from external access
sudo ufw deny 27017/tcp
```

### **4. Rate Limiting**
Already implemented in the application. Configure in `.env`:
```env
RATE_LIMIT_PER_MINUTE=60
```

### **5. Database Security**
- Enable MongoDB authentication
- Use strong passwords
- Enable encryption at rest
- Enable encryption in transit (TLS)
- Regular backups
- Restrict network access

---

## 📊 Monitoring & Logging

### **Sentry Setup**

1. **Create Sentry Account**
   - Go to [sentry.io](https://sentry.io)
   - Create new project
   - Get DSN

2. **Configure in .env**
   ```env
   SENTRY_DSN=https://xxx@sentry.io/xxx
   SENTRY_ENVIRONMENT=production
   ```

3. **Test Error Tracking**
   ```bash
   # Trigger test error
   curl https://yourdomain.com/api/test-error
   ```

### **Log Management**

**View Docker Logs:**
```bash
# App logs
docker-compose logs -f app

# Scheduler logs
docker-compose logs -f scheduler

# All logs
docker-compose logs -f
```

**Log Aggregation (Production):**
- **Papertrail**: Simple log aggregation
- **Datadog**: Full observability platform
- **ELK Stack**: Self-hosted solution
- **CloudWatch**: AWS native logging

---

## 🔄 Continuous Deployment

### **GitHub Actions**

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '22'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Validate environment
        run: npm run validate:env
        env:
          AUTH_SECRET: ${{ secrets.AUTH_SECRET }}
          DB_ENCRYPTION_KEY: ${{ secrets.DB_ENCRYPTION_KEY }}
          MONGODB_URI: ${{ secrets.MONGODB_URI }}
      
      - name: Build
        run: npm run build
      
      - name: Deploy to production
        run: |
          # Add your deployment commands here
          # e.g., docker push, eb deploy, etc.
```

---

## 🧪 Post-Deployment Verification

### **Health Checks**
```bash
# Check API health
curl https://yourdomain.com/api/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2025-10-08T12:00:00.000Z",
  "version": "1.0.0",
  "environment": "production"
}
```

### **Database Connection**
```bash
# Test database connection
npm run db:indexes
```

### **Rate Limiting**
```bash
# Test rate limiting
for i in {1..150}; do
  curl https://yourdomain.com/api/tweets
done

# Should return 429 after limit
```

### **Error Tracking**
```bash
# Check Sentry dashboard
# Verify errors are being captured
```

---

## 🔧 Troubleshooting

### **Application Won't Start**
```bash
# Check logs
docker-compose logs app

# Common issues:
# - Missing environment variables
# - Database connection failed
# - Port already in use
```

### **Database Connection Failed**
```bash
# Test MongoDB connection
mongosh "mongodb://user:pass@host:27017/schedx"

# Check network access
# Check credentials
# Check MongoDB is running
```

### **High Memory Usage**
```bash
# Check container stats
docker stats

# Adjust resource limits in docker-compose.yml
deploy:
  resources:
    limits:
      memory: 2G
```

### **Rate Limit Issues**
```bash
# Adjust rate limits in .env
RATE_LIMIT_PER_MINUTE=100

# Restart application
docker-compose restart app
```

---

## 📞 Support

- **Documentation**: [GitHub Wiki](https://github.com/yourusername/schedx/wiki)
- **Issues**: [GitHub Issues](https://github.com/yourusername/schedx/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/schedx/discussions)

---

## 📝 Maintenance

### **Regular Tasks**
- [ ] Monitor error rates in Sentry
- [ ] Review application logs
- [ ] Check database performance
- [ ] Update dependencies monthly
- [ ] Review and rotate secrets quarterly
- [ ] Test backup restoration
- [ ] Monitor disk usage
- [ ] Review rate limit logs

### **Updates**
```bash
# Update dependencies
npm update

# Security audit
npm run security:check

# Apply updates
npm run audit:fix
```

---

**🎉 Congratulations! Your SchedX application is now deployed and ready for production use!**
