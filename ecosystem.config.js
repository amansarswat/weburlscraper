/**
 * PM2 Ecosystem Configuration
 * Production deployment with PM2 process manager
 */

module.exports = {
  apps: [
    {
      name: 'url-scraper-api',
      script: 'server.js',
      // NOTE: cluster mode runs one limiter/cache per worker. For correct,
      // shared rate limits and cache across workers, set REDIS_URL (see README).
      instances: process.env.WEB_CONCURRENCY || 'max',
      exec_mode: 'cluster',

      // Environment variables
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        RATE_LIMIT: 200,
        SCRAPER_RATE_LIMIT: 50,
        LOG_PRETTY: 'false'
      },
      
      // Logging
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Process management
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '500M',
      
      // Monitoring
      monitoring: false,
      
      // Auto restart on file changes (development only)
      watch: false,
      ignore_watch: ['node_modules', 'logs', 'tests'],
      
      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 3000,
      
      // Health check
      health_check_http: {
        path: '/health',
        port: 3000,
        max_unhealthy_restarts: 3
      }
    }
  ],
  
  deploy: {
    production: {
      user: 'node',
      host: 'your-server.com',
      ref: 'origin/main',
      repo: 'git@github.com:your-username/url-scraper-api.git',
      path: '/var/www/url-scraper-api',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};
