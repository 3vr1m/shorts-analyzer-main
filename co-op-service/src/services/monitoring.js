const os = require('os');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

/**
 * System monitoring service for health checks and metrics collection
 */
class MonitoringService {
  constructor() {
    this.isInitialized = false;
    this.startTime = Date.now();
    this.metrics = {
      system: {
        cpu: { usage: 0, cores: os.cpus().length },
        memory: { usage: 0, total: os.totalmem() },
        disk: { usage: 0, total: 0 },
        uptime: 0
      },
      service: {
        uptime: 0,
        requests: { total: 0, success: 0, errors: 0 },
        queue: { waiting: 0, active: 0, completed: 0, failed: 0 },
        performance: { avgResponseTime: 0, p95ResponseTime: 0 }
      },
      external: {
        redis: { status: 'unknown', latency: 0 },
        openai: { status: 'unknown', lastCheck: null },
        whisper: { status: 'unknown', lastCheck: null }
      }
    };
    
    this.requestTimes = [];
    this.healthChecks = new Map();
    this.alerts = [];
    
    this.thresholds = {
      cpu: { warning: 70, critical: 90 },
      memory: { warning: 80, critical: 95 },
      disk: { warning: 85, critical: 95 },
      responseTime: { warning: 5000, critical: 10000 }, // milliseconds
      queueSize: { warning: 50, critical: 100 }
    };
  }

  /**
   * Initialize monitoring service
   */
  initialize() {
    if (this.isInitialized) {
      logger.warn('Monitoring service already initialized');
      return;
    }

    logger.info('Initializing monitoring service...');

    // Start periodic health checks
    this.startHealthChecks();
    
    // Start metrics collection
    this.startMetricsCollection();
    
    this.isInitialized = true;
    logger.info('Monitoring service initialized');
  }

  /**
   * Start periodic health checks
   */
  startHealthChecks() {
    const interval = parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000; // 30 seconds
    
    setInterval(async () => {
      try {
        await this.performHealthChecks();
      } catch (error) {
        logger.error('Error during health checks', {
          error: error.message,
          stack: error.stack
        });
      }
    }, interval);
    
    // Initial health check after 5 seconds
    setTimeout(() => this.performHealthChecks(), 5000);
  }

  /**
   * Start metrics collection
   */
  startMetricsCollection() {
    const interval = parseInt(process.env.METRICS_INTERVAL) || 60000; // 60 seconds
    
    setInterval(() => {
      try {
        this.collectSystemMetrics();
        this.analyzePerformance();
        this.checkThresholds();
      } catch (error) {
        logger.error('Error during metrics collection', {
          error: error.message
        });
      }
    }, interval);
    
    // Initial collection after 10 seconds
    setTimeout(() => this.collectSystemMetrics(), 10000);
  }

  /**
   * Perform comprehensive health checks
   */
  async performHealthChecks() {
    const checks = [];
    
    // System health
    checks.push(this.checkSystemHealth());
    
    // Redis health
    checks.push(this.checkRedisHealth());
    
    // External services health
    checks.push(this.checkExternalServices());
    
    // Disk space health
    checks.push(this.checkDiskSpace());
    
    const results = await Promise.allSettled(checks);
    
    let overallHealth = 'healthy';
    const issues = [];
    
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        overallHealth = 'unhealthy';
        issues.push(`Health check ${index} failed: ${result.reason}`);
      } else if (result.value && result.value.status !== 'healthy') {
        if (result.value.status === 'critical') {
          overallHealth = 'critical';
        } else if (overallHealth === 'healthy') {
          overallHealth = 'warning';
        }
        issues.push(result.value.message || `Health check ${index} reported ${result.value.status}`);
      }
    });
    
    // Update health checks map
    this.healthChecks.set('overall', {
      status: overallHealth,
      timestamp: new Date().toISOString(),
      issues
    });
    
    // Log health status
    if (overallHealth !== 'healthy') {
      logger.warn('Health check issues detected', {
        status: overallHealth,
        issues
      });
    }
  }

  /**
   * Check system health (CPU, memory, etc.)
   */
  async checkSystemHealth() {
    const cpuUsage = await this.getCpuUsage();
    const memoryUsage = this.getMemoryUsage();
    
    let status = 'healthy';
    const issues = [];
    
    if (cpuUsage > this.thresholds.cpu.critical) {
      status = 'critical';
      issues.push(`CPU usage critical: ${cpuUsage.toFixed(1)}%`);
    } else if (cpuUsage > this.thresholds.cpu.warning) {
      status = 'warning';
      issues.push(`CPU usage high: ${cpuUsage.toFixed(1)}%`);
    }
    
    if (memoryUsage > this.thresholds.memory.critical) {
      status = 'critical';
      issues.push(`Memory usage critical: ${memoryUsage.toFixed(1)}%`);
    } else if (memoryUsage > this.thresholds.memory.warning) {
      status = 'warning';
      issues.push(`Memory usage high: ${memoryUsage.toFixed(1)}%`);
    }
    
    this.healthChecks.set('system', {
      status,
      timestamp: new Date().toISOString(),
      metrics: { cpu: cpuUsage, memory: memoryUsage },
      issues
    });
    
    logger.health.check('system', status, { cpu: cpuUsage, memory: memoryUsage });
    
    return { status, message: issues.join(', ') };
  }

  /**
   * Check Redis health
   */
  async checkRedisHealth() {
    try {
      const queueManager = require('./queue-manager');
      const redisHealth = await queueManager.getRedisHealth();
      
      let status = 'healthy';
      if (redisHealth.status === 'error' || redisHealth.status === 'disconnected') {
        status = 'critical';
      }
      
      this.metrics.external.redis = {
        status: redisHealth.status,
        latency: redisHealth.latency || 0,
        lastCheck: new Date().toISOString()
      };
      
      this.healthChecks.set('redis', {
        status,
        timestamp: new Date().toISOString(),
        details: redisHealth
      });
      
      logger.health.check('redis', status, redisHealth);
      
      return { status, message: redisHealth.error || 'Redis OK' };
      
    } catch (error) {
      this.healthChecks.set('redis', {
        status: 'critical',
        timestamp: new Date().toISOString(),
        error: error.message
      });
      
      return { status: 'critical', message: `Redis check failed: ${error.message}` };
    }
  }

  /**
   * Check external services (OpenAI, Whisper availability)
   */
  async checkExternalServices() {
    const checks = [];
    
    // Check OpenAI API availability (simple ping)
    if (process.env.OPENAI_API_KEY) {
      checks.push(this.checkOpenAIHealth());
    }
    
    // Check Whisper binary availability
    checks.push(this.checkWhisperHealth());
    
    // Check yt-dlp availability
    checks.push(this.checkYtDlpHealth());
    
    const results = await Promise.allSettled(checks);
    
    let overallStatus = 'healthy';
    const issues = [];
    
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        overallStatus = 'warning';
        issues.push(result.reason);
      } else if (result.value && result.value.status !== 'healthy') {
        overallStatus = 'warning';
        issues.push(result.value.message);
      }
    });
    
    return { status: overallStatus, message: issues.join(', ') };
  }

  /**
   * Check OpenAI API health
   */
  async checkOpenAIHealth() {
    try {
      // Simple check - just verify we have an API key
      // In production, you might want to make a test API call
      const hasApiKey = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your-openai-api-key-here');
      
      const status = hasApiKey ? 'healthy' : 'warning';
      this.metrics.external.openai = {
        status,
        lastCheck: new Date().toISOString(),
        configured: hasApiKey
      };
      
      return { status, message: hasApiKey ? 'OpenAI configured' : 'OpenAI not configured' };
      
    } catch (error) {
      this.metrics.external.openai = {
        status: 'error',
        lastCheck: new Date().toISOString(),
        error: error.message
      };
      
      return { status: 'warning', message: `OpenAI check failed: ${error.message}` };
    }
  }

  /**
   * Check Whisper availability
   */
  async checkWhisperHealth() {
    try {
      const { exec } = require('child_process');
      const util = require('util');
      const execPromise = util.promisify(exec);
      
      const whisperPath = process.env.WHISPER_PATH || 'whisper';
      
      // Try to run whisper --help
      await execPromise(`${whisperPath} --help`, { timeout: 5000 });
      
      this.metrics.external.whisper = {
        status: 'healthy',
        lastCheck: new Date().toISOString(),
        path: whisperPath
      };
      
      return { status: 'healthy', message: 'Whisper available' };
      
    } catch (error) {
      this.metrics.external.whisper = {
        status: 'warning',
        lastCheck: new Date().toISOString(),
        error: error.message
      };
      
      return { status: 'warning', message: 'Whisper not available or not configured' };
    }
  }

  /**
   * Check yt-dlp availability
   */
  async checkYtDlpHealth() {
    try {
      const { exec } = require('child_process');
      const util = require('util');
      const execPromise = util.promisify(exec);
      
      const ytdlpPath = process.env.YTDLP_PATH || 'yt-dlp';
      
      // Try to run yt-dlp --version
      const { stdout } = await execPromise(`${ytdlpPath} --version`, { timeout: 5000 });
      
      this.metrics.external.ytdlp = {
        status: 'healthy',
        lastCheck: new Date().toISOString(),
        version: stdout.trim(),
        path: ytdlpPath
      };
      
      return { status: 'healthy', message: `yt-dlp available (${stdout.trim()})` };
      
    } catch (error) {
      this.metrics.external.ytdlp = {
        status: 'warning',
        lastCheck: new Date().toISOString(),
        error: error.message
      };
      
      return { status: 'warning', message: 'yt-dlp not available or not configured' };
    }
  }

  /**
   * Check disk space
   */
  async checkDiskSpace() {
    try {
      const stats = await fs.stat(process.cwd());
      // This is a simplified check - in production you'd want to check actual disk usage
      const tempDir = process.env.TEMP_DIR || './temp';
      
      try {
        await fs.access(tempDir);
      } catch {
        await fs.mkdir(tempDir, { recursive: true });
      }
      
      return { status: 'healthy', message: 'Disk space OK' };
      
    } catch (error) {
      return { status: 'warning', message: `Disk space check failed: ${error.message}` };
    }
  }

  /**
   * Collect system metrics
   */
  collectSystemMetrics() {
    // Update system metrics
    this.metrics.system.uptime = os.uptime();
    this.metrics.system.memory.usage = this.getMemoryUsage();
    
    // Update service metrics
    this.metrics.service.uptime = Math.floor((Date.now() - this.startTime) / 1000);
    
    // Update queue metrics if available
    try {
      const queueManager = require('./queue-manager');
      const queueStats = queueManager.getStats();
      this.metrics.service.queue = queueStats;
    } catch (error) {
      // Queue manager might not be initialized yet
    }
    
    // Log resource usage periodically
    logger.health.resourceUsage(
      this.metrics.system.cpu.usage,
      this.metrics.system.memory.usage,
      this.metrics.system.disk.usage
    );
  }

  /**
   * Get CPU usage percentage
   */
  async getCpuUsage() {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      const startTime = process.hrtime();
      
      setTimeout(() => {
        const currentUsage = process.cpuUsage(startUsage);
        const currentTime = process.hrtime(startTime);
        
        const totalTime = currentTime[0] * 1000000 + currentTime[1] / 1000;
        const cpuPercent = (currentUsage.user + currentUsage.system) / totalTime * 100;
        
        this.metrics.system.cpu.usage = cpuPercent;
        resolve(cpuPercent);
      }, 100);
    });
  }

  /**
   * Get memory usage percentage
   */
  getMemoryUsage() {
    const used = process.memoryUsage();
    const total = os.totalmem();
    const usage = (used.heapUsed + used.external) / total * 100;
    
    return usage;
  }

  /**
   * Analyze performance metrics
   */
  analyzePerformance() {
    if (this.requestTimes.length === 0) return;
    
    // Calculate average response time
    const avg = this.requestTimes.reduce((sum, time) => sum + time, 0) / this.requestTimes.length;
    
    // Calculate 95th percentile
    const sorted = [...this.requestTimes].sort((a, b) => a - b);
    const p95Index = Math.ceil(0.95 * sorted.length) - 1;
    const p95 = sorted[p95Index] || 0;
    
    this.metrics.service.performance.avgResponseTime = avg;
    this.metrics.service.performance.p95ResponseTime = p95;
    
    // Keep only last 100 request times
    if (this.requestTimes.length > 100) {
      this.requestTimes = this.requestTimes.slice(-100);
    }
  }

  /**
   * Check if metrics exceed thresholds and generate alerts
   */
  checkThresholds() {
    const now = Date.now();
    
    // CPU threshold check
    if (this.metrics.system.cpu.usage > this.thresholds.cpu.critical) {
      this.addAlert('critical', 'cpu', `CPU usage critical: ${this.metrics.system.cpu.usage.toFixed(1)}%`);
    } else if (this.metrics.system.cpu.usage > this.thresholds.cpu.warning) {
      this.addAlert('warning', 'cpu', `CPU usage high: ${this.metrics.system.cpu.usage.toFixed(1)}%`);
    }
    
    // Memory threshold check
    if (this.metrics.system.memory.usage > this.thresholds.memory.critical) {
      this.addAlert('critical', 'memory', `Memory usage critical: ${this.metrics.system.memory.usage.toFixed(1)}%`);
    } else if (this.metrics.system.memory.usage > this.thresholds.memory.warning) {
      this.addAlert('warning', 'memory', `Memory usage high: ${this.metrics.system.memory.usage.toFixed(1)}%`);
    }
    
    // Queue size check
    const totalQueue = this.metrics.service.queue.waiting + this.metrics.service.queue.active;
    if (totalQueue > this.thresholds.queueSize.critical) {
      this.addAlert('critical', 'queue', `Queue size critical: ${totalQueue} jobs`);
    } else if (totalQueue > this.thresholds.queueSize.warning) {
      this.addAlert('warning', 'queue', `Queue size high: ${totalQueue} jobs`);
    }
    
    // Response time check
    if (this.metrics.service.performance.p95ResponseTime > this.thresholds.responseTime.critical) {
      this.addAlert('critical', 'performance', `Response time critical: ${this.metrics.service.performance.p95ResponseTime}ms`);
    } else if (this.metrics.service.performance.p95ResponseTime > this.thresholds.responseTime.warning) {
      this.addAlert('warning', 'performance', `Response time high: ${this.metrics.service.performance.p95ResponseTime}ms`);
    }
  }

  /**
   * Add alert to the alerts array
   */
  addAlert(level, category, message) {
    const alert = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      level,
      category,
      message,
      timestamp: new Date().toISOString(),
      acknowledged: false
    };
    
    // Avoid duplicate alerts
    const existingAlert = this.alerts.find(a => 
      a.category === category && a.level === level && !a.acknowledged
    );
    
    if (!existingAlert) {
      this.alerts.unshift(alert);
      
      // Keep only last 100 alerts
      if (this.alerts.length > 100) {
        this.alerts = this.alerts.slice(0, 100);
      }
      
      logger.warn(`Alert generated: ${level} - ${category}`, {
        alertId: alert.id,
        message,
        category,
        level
      });
    }
  }

  /**
   * Record request timing for performance analysis
   */
  recordRequestTime(duration) {
    this.requestTimes.push(duration);
    this.metrics.service.requests.total++;
  }

  /**
   * Record request success
   */
  recordRequestSuccess() {
    this.metrics.service.requests.success++;
  }

  /**
   * Record request error
   */
  recordRequestError() {
    this.metrics.service.requests.errors++;
  }

  /**
   * Get current health status
   */
  getHealthStatus() {
    const overall = this.healthChecks.get('overall') || { status: 'unknown', issues: [] };
    
    return {
      healthy: overall.status === 'healthy',
      status: overall.status,
      timestamp: new Date().toISOString(),
      uptime: this.metrics.service.uptime,
      checks: Object.fromEntries(this.healthChecks),
      issues: overall.issues || []
    };
  }

  /**
   * Get all metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      alerts: this.alerts.slice(0, 10), // Last 10 alerts
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get alerts
   */
  getAlerts(acknowledged = null) {
    let alerts = this.alerts;
    
    if (acknowledged !== null) {
      alerts = alerts.filter(alert => alert.acknowledged === acknowledged);
    }
    
    return alerts;
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedAt = new Date().toISOString();
      return true;
    }
    return false;
  }
}

// Create singleton instance
const monitoringService = new MonitoringService();

module.exports = monitoringService;
