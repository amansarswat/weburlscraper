# 🚀 Deployment Guide

Complete deployment guide for the URL Scraper API across different platforms.

## 📋 Pre-Deployment Checklist

- [ ] Node.js 16+ installed
- [ ] Dependencies installed (`npm install`)
- [ ] Environment variables configured
- [ ] API tested locally (`npm test`)
- [ ] Security settings reviewed

## 🖥️ Local Development

```bash
# Setup
npm run setup

# Start development server
npm run dev

# Test API
npm run test:api
```

## 🐳 Docker Deployment

### Single Container

```bash
# Build image
docker build -t url-scraper-api .

# Run container
docker run -d \
  --name url-scraper \
  -p 3000:3000 \
  -e NODE_ENV=production \
  --restart unless-stopped \
  url-scraper-api
```

### Docker Compose

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## ⚡ PM2 (Process Manager)

### Installation

```bash
# Install PM2 globally
npm install -g pm2

# Start application
pm2 start ecosystem.config.js --env production

# Monitor processes
pm2 monit

# View logs
pm2 logs url-scraper-api

# Restart application
pm2 restart url-scraper-api

# Auto-start on system reboot
pm2 startup
pm2 save
```

### PM2 Commands

```bash
# Status
pm2 status

# Stop application
pm2 stop url-scraper-api

# Delete application
pm2 delete url-scraper-api

# Reload (zero downtime)
pm2 reload url-scraper-api
```

## ☁️ Cloud Deployment

### AWS EC2

1. **Launch EC2 Instance**
   ```bash
   # Connect to instance
   ssh -i your-key.pem ubuntu@your-instance-ip
   
   # Install Node.js
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # Install PM2
   sudo npm install -g pm2
   ```

2. **Deploy Application**
   ```bash
   # Clone/upload your application
   git clone your-repo-url
   cd url-scraper-package
   
   # Install dependencies
   npm install --production
   
   # Configure environment
   cp config.env.example .env
   # Edit .env with your settings
   
   # Start with PM2
   pm2 start ecosystem.config.js --env production
   pm2 startup
   pm2 save
   ```

3. **Configure Security Groups**
   - Allow inbound traffic on port 3000 (or your chosen port)
   - Restrict access to specific IP ranges if needed

### Google Cloud Platform

```bash
# Install gcloud CLI
# Create app.yaml
runtime: nodejs18
env_variables:
  NODE_ENV: production
  PORT: 8080

# Deploy
gcloud app deploy
```

### Heroku

```bash
# Install Heroku CLI
# Create Procfile
echo "web: npm start" > Procfile

# Deploy
heroku create your-app-name
git push heroku main

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set RATE_LIMIT=100
```

### DigitalOcean Droplet

1. **Create Droplet** (Ubuntu 20.04+)
2. **Setup Application**
   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y
   
   # Install Node.js
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # Install PM2
   sudo npm install -g pm2
   
   # Deploy application (same as EC2 steps above)
   ```

## 🔒 Reverse Proxy Setup

### Nginx

```nginx
# /etc/nginx/sites-available/url-scraper-api
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Security headers
        proxy_set_header X-Frame-Options DENY;
        proxy_set_header X-Content-Type-Options nosniff;
    }
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req zone=api burst=20 nodelay;
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/url-scraper-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Apache

```apache
# /etc/apache2/sites-available/url-scraper-api.conf
<VirtualHost *:80>
    ServerName your-domain.com
    
    ProxyPreserveHost On
    ProxyRequests Off
    ProxyPass / http://localhost:3000/
    ProxyPassReverse / http://localhost:3000/
    
    # Security headers
    Header always set X-Frame-Options DENY
    Header always set X-Content-Type-Options nosniff
</VirtualHost>
```

## 🔐 SSL/HTTPS Setup

### Let's Encrypt (Certbot)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

## 📊 Monitoring & Logging

### Health Monitoring

```bash
# Add to crontab for health checks
*/5 * * * * curl -f http://localhost:3000/health || echo "API Down" | mail -s "URL Scraper API Alert" admin@yourdomain.com
```

### Log Management

```bash
# Rotate logs with logrotate
sudo nano /etc/logrotate.d/url-scraper-api

# Content:
/path/to/url-scraper-package/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    notifempty
    create 644 node node
    postrotate
        pm2 reload url-scraper-api
    endscript
}
```

## 🔧 Environment Variables

### Production Environment

```bash
# Required
NODE_ENV=production
PORT=3000

# Security
RATE_LIMIT=200
SCRAPER_RATE_LIMIT=50

# CORS (comma-separated)
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Scraper settings
SCRAPER_TIMEOUT=15000
MAX_CONTENT_LENGTH=5242880
SCRAPER_RETRIES=3
```

## 🚨 Troubleshooting

### Common Issues

1. **Port already in use**
   ```bash
   sudo lsof -i :3000
   sudo kill -9 <PID>
   ```

2. **Permission denied**
   ```bash
   sudo chown -R node:node /path/to/app
   chmod +x scripts/*.js
   ```

3. **Memory issues**
   ```bash
   # Increase PM2 memory limit
   pm2 restart url-scraper-api --max-memory-restart 1G
   ```

4. **High CPU usage**
   ```bash
   # Reduce PM2 instances
   pm2 scale url-scraper-api 2
   ```

### Log Analysis

```bash
# PM2 logs
pm2 logs url-scraper-api --lines 100

# System logs
sudo journalctl -u nginx -f
sudo tail -f /var/log/nginx/error.log

# Application logs
tail -f logs/error.log
tail -f logs/combined.log
```

## 📈 Performance Optimization

### PM2 Cluster Mode

```javascript
// ecosystem.config.js
{
  instances: 'max', // Use all CPU cores
  exec_mode: 'cluster'
}
```

### Nginx Caching

```nginx
# Add to nginx config
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m max_size=1g inactive=60m;

location /api/ {
    proxy_cache api_cache;
    proxy_cache_valid 200 5m;
    proxy_cache_key "$scheme$request_method$host$request_uri";
}
```

## 🔄 CI/CD Pipeline

### GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy URL Scraper API

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    
    - name: Setup Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '18'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Run tests
      run: npm test
      
    - name: Deploy to server
      run: |
        # Your deployment commands here
```

## 📋 Maintenance

### Regular Tasks

- [ ] Update dependencies monthly
- [ ] Monitor logs weekly
- [ ] Check disk space
- [ ] Review security settings
- [ ] Update SSL certificates
- [ ] Backup configuration files

### Update Process

```bash
# 1. Backup current version
cp -r url-scraper-package url-scraper-package.backup

# 2. Update dependencies
npm update

# 3. Test locally
npm test

# 4. Deploy with zero downtime
pm2 reload url-scraper-api
```

## 🆘 Support

- Check logs first: `pm2 logs url-scraper-api`
- Test API health: `curl http://localhost:3000/health`
- Review configuration: `.env` file
- Monitor resources: `pm2 monit`

Happy deploying! 🚀
