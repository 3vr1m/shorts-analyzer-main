module.exports = {
  apps: [
    {
      name: 'co-op-service',
      script: 'src/app.js',
      instances: 1, // Single instance for now due to Redis queue management
      exec_mode: 'fork',
      
      // Environment variables
      env: {
        NODE_ENV: 'development',
        PORT: 8080
      },
      
      env_production: {
        NODE_ENV: 'production',
        PORT: 8080
      },
      
      // Logging
      log_file: './logs/pm2-combined.log',
      out_file: './logs/pm2-out.log',
      error_file: './logs/pm2-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Process management
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '1G',
      
      // Monitoring
      watch: false, // Disable in production
      ignore_watch: [
        'node_modules',
        'logs',
        'temp',
        'storage',
        '.git'
      ],
      
      // Graceful restart/shutdown
      kill_timeout: 30000,
      wait_ready: true,
      listen_timeout: 10000,
      
      // Source map support
      source_map_support: true,
      
      // Node.js options
      node_args: '--max-old-space-size=1024',
      
      // Health monitoring
      health_check_grace_period: 30000,
      
      // Cron restart (optional - restart every day at 3 AM)
      cron_restart: '0 3 * * *',
      
      // Environment-specific settings
      env_development: {
        NODE_ENV: 'development',
        LOG_LEVEL: 'debug',
        ENABLE_CONSOLE_LOGS: 'true',
        watch: true
      },
      
      env_staging: {
        NODE_ENV: 'staging',
        LOG_LEVEL: 'info',
        ENABLE_CONSOLE_LOGS: 'false'
      },
      
      env_production: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'info',
        ENABLE_CONSOLE_LOGS: 'false',
        watch: false
      }
    },
    
    // Optional: Redis monitoring process (if Redis is managed locally)
    {
      name: 'redis-monitor',
      script: 'src/scripts/redis-monitor.js',
      instances: 1,
      exec_mode: 'fork',
      
      env: {
        NODE_ENV: 'development'
      },
      
      env_production: {
        NODE_ENV: 'production'
      },
      
      // This process is less critical, so fewer restarts
      max_restarts: 5,
      restart_delay: 10000,
      
      // Disable in development (comment out if not needed)
      disabled: true
    }
  ],
  
  // Deployment configuration (optional)
  deploy: {
    production: {
      user: 'co-op',
      host: '83.27.41.204',
      ref: 'origin/main',
      repo: 'git@github.com:yourusername/co-op-service.git',
      path: '/var/www/co-op-service',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-setup': '',
      'ssh_options': 'StrictHostKeyChecking=no'
    },
    
    staging: {
      user: 'co-op',
      host: '83.27.41.204',
      ref: 'origin/develop',
      repo: 'git@github.com:yourusername/co-op-service.git',
      path: '/var/www/co-op-service-staging',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env staging'
    }
  }
};
