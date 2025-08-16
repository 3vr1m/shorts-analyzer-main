const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Authentication middleware for API key validation
 * Validates API keys and manages rate limiting per key
 */
class AuthMiddleware {
  constructor() {
    // In a real production environment, these would come from a database
    // For now, we'll use environment variables with fallback for development
    this.validApiKeys = new Set();
    this.keyMetadata = new Map();
    this.failedAttempts = new Map();
    this.initializeApiKeys();
  }

  initializeApiKeys() {
    // Load API keys from environment
    const apiKeys = process.env.API_KEYS ? process.env.API_KEYS.split(',') : [];
    const adminKey = process.env.ADMIN_API_KEY;
    const devKey = process.env.DEV_API_KEY || 'dev-key-12345'; // Development only

    // Add admin key if provided
    if (adminKey) {
      this.addApiKey(adminKey, {
        name: 'admin',
        permissions: ['all'],
        rateLimit: 1000,
        createdAt: new Date()
      });
    }

    // Add configured API keys
    apiKeys.forEach((key, index) => {
      if (key.trim()) {
        this.addApiKey(key.trim(), {
          name: `api-key-${index + 1}`,
          permissions: ['process-video', 'queue-status'],
          rateLimit: 100,
          createdAt: new Date()
        });
      }
    });

    // Add development key in non-production environments
    if (process.env.NODE_ENV !== 'production') {
      this.addApiKey(devKey, {
        name: 'development',
        permissions: ['all'],
        rateLimit: 1000,
        createdAt: new Date()
      });
      
      logger.warn('Development API key enabled', {
        key: `${devKey.substring(0, 8)}...`,
        environment: process.env.NODE_ENV
      });
    }

    logger.info(`Initialized ${this.validApiKeys.size} API keys`, {
      totalKeys: this.validApiKeys.size,
      hasAdminKey: Boolean(adminKey),
      environment: process.env.NODE_ENV
    });
  }

  addApiKey(key, metadata) {
    const keyHash = this.hashApiKey(key);
    this.validApiKeys.add(keyHash);
    this.keyMetadata.set(keyHash, {
      ...metadata,
      usage: {
        totalRequests: 0,
        lastUsed: null,
        errors: 0
      }
    });
  }

  hashApiKey(key) {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  validateApiKey(key) {
    if (!key) return null;
    
    const keyHash = this.hashApiKey(key);
    if (!this.validApiKeys.has(keyHash)) {
      return null;
    }

    const metadata = this.keyMetadata.get(keyHash);
    if (!metadata) return null;

    // Update usage statistics
    metadata.usage.totalRequests++;
    metadata.usage.lastUsed = new Date();
    
    return {
      keyHash,
      metadata
    };
  }

  checkPermissions(keyData, requiredPermission) {
    const permissions = keyData.metadata.permissions;
    return permissions.includes('all') || permissions.includes(requiredPermission);
  }

  trackFailedAttempt(ip) {
    const key = `failed_${ip}`;
    const attempts = this.failedAttempts.get(key) || { count: 0, firstAttempt: Date.now() };
    
    attempts.count++;
    attempts.lastAttempt = Date.now();
    
    // Reset counter after 1 hour
    if (Date.now() - attempts.firstAttempt > 3600000) {
      attempts.count = 1;
      attempts.firstAttempt = Date.now();
    }
    
    this.failedAttempts.set(key, attempts);
    return attempts;
  }

  isBlocked(ip) {
    const key = `failed_${ip}`;
    const attempts = this.failedAttempts.get(key);
    
    if (!attempts) return false;
    
    // Block after 10 failed attempts within an hour
    const isWithinWindow = Date.now() - attempts.firstAttempt < 3600000;
    const exceededLimit = attempts.count >= 10;
    
    return isWithinWindow && exceededLimit;
  }

  middleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      const ip = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('User-Agent') || 'unknown';
      
      // Check if IP is blocked due to too many failed attempts
      if (this.isBlocked(ip)) {
        logger.security.suspiciousActivity(ip, 'blocked_ip', {
          userAgent,
          endpoint: req.path,
          reason: 'too_many_failed_auth_attempts'
        });
        
        return res.status(429).json({
          success: false,
          error: 'Too many authentication failures. Please try again later.',
          retryAfter: 3600
        });
      }

      // Extract API key from various possible locations
      let apiKey = null;
      
      // 1. Authorization header (Bearer token)
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        apiKey = authHeader.substring(7);
      }
      
      // 2. X-API-Key header
      if (!apiKey) {
        apiKey = req.headers['x-api-key'];
      }
      
      // 3. Query parameter (least secure, discouraged)
      if (!apiKey && req.query.api_key) {
        apiKey = req.query.api_key;
        logger.warn('API key provided via query parameter (insecure)', {
          ip,
          endpoint: req.path
        });
      }

      // Validate API key
      if (!apiKey) {
        this.trackFailedAttempt(ip);
        logger.security.authFailure(ip, userAgent, req.path);
        
        return res.status(401).json({
          success: false,
          error: 'API key required',
          message: 'Please provide a valid API key in the Authorization header or X-API-Key header'
        });
      }

      const keyData = this.validateApiKey(apiKey);
      if (!keyData) {
        const attempts = this.trackFailedAttempt(ip);
        logger.security.authFailure(ip, userAgent, req.path);
        
        // Log potential brute force attempt
        if (attempts.count >= 5) {
          logger.security.suspiciousActivity(ip, 'potential_brute_force', {
            attempts: attempts.count,
            endpoint: req.path,
            userAgent
          });
        }
        
        return res.status(401).json({
          success: false,
          error: 'Invalid API key',
          message: 'The provided API key is not valid'
        });
      }

      // Check permissions for specific endpoints
      const endpoint = req.path.replace('/api/', '');
      const requiredPermission = this.getRequiredPermission(endpoint, req.method);
      
      if (requiredPermission && !this.checkPermissions(keyData, requiredPermission)) {
        logger.security.authFailure(ip, userAgent, req.path);
        
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          message: `API key does not have permission for ${requiredPermission}`
        });
      }

      // Attach key information to request for use in other middleware/controllers
      req.auth = {
        keyHash: keyData.keyHash,
        keyName: keyData.metadata.name,
        permissions: keyData.metadata.permissions,
        rateLimit: keyData.metadata.rateLimit
      };

      // Log successful authentication
      logger.debug('Authentication successful', {
        keyName: keyData.metadata.name,
        endpoint: req.path,
        method: req.method,
        ip,
        duration: `${Date.now() - startTime}ms`
      });

      next();
    };
  }

  getRequiredPermission(endpoint, method) {
    const permissionMap = {
      'process-video': 'process-video',
      'queue-status': 'queue-status',
      'cancel-request': 'process-video',
      'queue/stats': 'queue-admin',
      'queue/pause': 'queue-admin',
      'queue/resume': 'queue-admin'
    };

    return permissionMap[endpoint] || 'general';
  }

  // Utility methods for API key management
  getKeyStats(keyHash) {
    return this.keyMetadata.get(keyHash);
  }

  getAllKeyStats() {
    const stats = {};
    this.keyMetadata.forEach((metadata, keyHash) => {
      stats[metadata.name] = {
        name: metadata.name,
        permissions: metadata.permissions,
        usage: metadata.usage,
        createdAt: metadata.createdAt
      };
    });
    return stats;
  }

  // Clean up old failed attempts periodically
  cleanup() {
    const now = Date.now();
    const oneHour = 3600000;
    
    for (const [key, attempts] of this.failedAttempts.entries()) {
      if (now - attempts.firstAttempt > oneHour) {
        this.failedAttempts.delete(key);
      }
    }
    
    logger.debug('Auth middleware cleanup completed', {
      remainingFailedAttempts: this.failedAttempts.size
    });
  }
}

// Create singleton instance
const authMiddleware = new AuthMiddleware();

// Set up periodic cleanup (every 30 minutes)
if (process.env.NODE_ENV !== 'test') {
  setInterval(() => {
    authMiddleware.cleanup();
  }, 30 * 60 * 1000);
}

module.exports = authMiddleware.middleware.bind(authMiddleware);
module.exports.AuthMiddleware = AuthMiddleware;
module.exports.instance = authMiddleware;
