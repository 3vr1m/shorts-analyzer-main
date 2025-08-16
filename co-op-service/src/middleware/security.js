const validator = require('validator');
const { body, query, validationResult } = require('express-validator');
const logger = require('../utils/logger');

/**
 * Security middleware for input validation and sanitization
 */
class SecurityMiddleware {
  constructor() {
    this.suspiciousPatterns = [
      // SQL injection patterns
      /(\bunion\b|\bselect\b|\binsert\b|\bupdate\b|\bdelete\b|\bdrop\b)/i,
      // Script injection patterns
      /<script[^>]*>.*?<\/script>/gi,
      // Command injection patterns
      /(\||;|&|\$\(|\`)/,
      // Path traversal
      /\.\.\/|\.\.\\|\.\.\%2f|\.\.\%5c/i
    ];
    
    this.allowedVideoHosts = [
      'youtube.com',
      'youtu.be',
      'www.youtube.com',
      'm.youtube.com',
      'music.youtube.com'
    ];
  }

  // General request validation middleware
  validateRequest() {
    return (req, res, next) => {
      const ip = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('User-Agent') || '';
      
      // Check for suspicious user agents
      if (this.isSuspiciousUserAgent(userAgent)) {
        logger.security.suspiciousActivity(ip, 'suspicious_user_agent', {
          userAgent,
          endpoint: req.path
        });
      }

      // Validate request size
      if (req.headers['content-length'] && parseInt(req.headers['content-length']) > 1048576) { // 1MB
        logger.security.suspiciousActivity(ip, 'large_request', {
          contentLength: req.headers['content-length'],
          endpoint: req.path
        });
        
        return res.status(413).json({
          success: false,
          error: 'Request too large',
          message: 'Request size exceeds the maximum allowed limit'
        });
      }

      // Sanitize query parameters
      if (req.query) {
        req.query = this.sanitizeObject(req.query, ip, req.path);
      }

      next();
    };
  }

  // Validate video URLs specifically
  validateVideoUrl() {
    return [
      body('videoUrl')
        .isURL({ protocols: ['http', 'https'] })
        .withMessage('Invalid URL format')
        .custom((url) => {
          // Extract hostname from URL
          try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname.toLowerCase();
            
            // Check if it's from an allowed video host
            const isAllowed = this.allowedVideoHosts.some(host => 
              hostname === host || hostname.endsWith('.' + host)
            );
            
            if (!isAllowed) {
              throw new Error('URL must be from a supported video platform');
            }
            
            return true;
          } catch (error) {
            throw new Error('Invalid URL format');
          }
        })
        .customSanitizer((url) => {
          // Normalize YouTube URLs
          return this.normalizeVideoUrl(url);
        }),
      
      body('callbackUrl')
        .optional()
        .isURL({ protocols: ['http', 'https'] })
        .withMessage('Invalid callback URL format')
        .custom((url) => {
          // Prevent callback to localhost/internal networks in production
          if (process.env.NODE_ENV === 'production') {
            try {
              const urlObj = new URL(url);
              const hostname = urlObj.hostname.toLowerCase();
              
              if (hostname === 'localhost' || 
                  hostname === '127.0.0.1' || 
                  hostname.startsWith('192.168.') ||
                  hostname.startsWith('10.') ||
                  hostname.startsWith('172.')) {
                throw new Error('Callback URL cannot point to internal networks');
              }
            } catch (error) {
              throw new Error('Invalid callback URL');
            }
          }
          return true;
        }),
        
      body('options')
        .optional()
        .isObject()
        .withMessage('Options must be an object')
        .custom((options) => {
          // Validate options structure
          const allowedOptions = ['priority', 'includeTranscript', 'includeAnalysis', 'webhook'];
          const optionKeys = Object.keys(options);
          
          for (const key of optionKeys) {
            if (!allowedOptions.includes(key)) {
              throw new Error(`Invalid option: ${key}`);
            }
          }
          
          // Validate priority
          if (options.priority !== undefined) {
            if (!Number.isInteger(options.priority) || options.priority < 0 || options.priority > 10) {
              throw new Error('Priority must be an integer between 0 and 10');
            }
          }
          
          return true;
        })
    ];
  }

  // Validate queue status requests
  validateQueueStatus() {
    return [
      query('jobId')
        .optional()
        .matches(/^[a-zA-Z0-9-_]{1,50}$/)
        .withMessage('Invalid job ID format'),
        
      query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100')
        .toInt(),
        
      query('status')
        .optional()
        .isIn(['waiting', 'active', 'completed', 'failed', 'delayed'])
        .withMessage('Invalid status filter')
    ];
  }

  // Validate cancel requests
  validateCancelRequest() {
    return [
      body('jobId')
        .matches(/^[a-zA-Z0-9-_]{1,50}$/)
        .withMessage('Invalid job ID format'),
        
      body('reason')
        .optional()
        .isLength({ min: 1, max: 200 })
        .withMessage('Reason must be between 1 and 200 characters')
        .escape() // Sanitize HTML entities
    ];
  }

  // Handle validation errors
  handleValidationErrors() {
    return (req, res, next) => {
      const errors = validationResult(req);
      
      if (!errors.isEmpty()) {
        const ip = req.ip || req.connection.remoteAddress;
        
        logger.security.authFailure(ip, req.get('User-Agent'), req.path);
        
        // Log validation errors for security monitoring
        const errorDetails = errors.array().map(err => ({
          field: err.param,
          value: err.value,
          message: err.msg
        }));
        
        logger.warn('Request validation failed', {
          ip,
          endpoint: req.path,
          errors: errorDetails
        });

        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errorDetails
        });
      }
      
      next();
    };
  }

  // Sanitize input strings for malicious patterns
  sanitizeString(str, ip, endpoint) {
    if (typeof str !== 'string') return str;

    const original = str;
    
    // Check for suspicious patterns
    for (const pattern of this.suspiciousPatterns) {
      if (pattern.test(str)) {
        logger.security.suspiciousActivity(ip, 'malicious_input_pattern', {
          pattern: pattern.source,
          input: str.substring(0, 100), // Log first 100 chars only
          endpoint
        });
        
        // Don't reject the request, but log it for monitoring
        break;
      }
    }

    // Basic sanitization
    str = validator.escape(str); // Escape HTML entities
    str = str.replace(/[<>]/g, ''); // Remove angle brackets
    
    return str;
  }

  // Sanitize objects recursively
  sanitizeObject(obj, ip, endpoint) {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    const sanitized = {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        sanitized[key] = this.sanitizeString(value, ip, endpoint);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeObject(value, ip, endpoint);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  // Check for suspicious user agents
  isSuspiciousUserAgent(userAgent) {
    const suspiciousPatterns = [
      /sqlmap/i,
      /nikto/i,
      /nmap/i,
      /masscan/i,
      /zap/i,
      /burp/i,
      /bot.*bot/i
    ];

    return suspiciousPatterns.some(pattern => pattern.test(userAgent));
  }

  // Normalize YouTube URLs to standard format
  normalizeVideoUrl(url) {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();

      if (hostname.includes('youtube.com')) {
        // Extract video ID from various YouTube URL formats
        let videoId = null;
        
        if (urlObj.pathname === '/watch') {
          videoId = urlObj.searchParams.get('v');
        } else if (urlObj.pathname.startsWith('/embed/')) {
          videoId = urlObj.pathname.split('/embed/')[1];
        } else if (urlObj.pathname.startsWith('/v/')) {
          videoId = urlObj.pathname.split('/v/')[1];
        }
        
        if (videoId) {
          // Clean video ID (remove any additional parameters)
          videoId = videoId.split(/[?&]/)[0];
          return `https://www.youtube.com/watch?v=${videoId}`;
        }
      } else if (hostname === 'youtu.be') {
        // YouTube short URL format
        const videoId = urlObj.pathname.substring(1).split(/[?&]/)[0];
        return `https://www.youtube.com/watch?v=${videoId}`;
      }

      return url; // Return original if no normalization needed
    } catch (error) {
      return url; // Return original if parsing fails
    }
  }

  // Rate limiting per endpoint
  createEndpointRateLimit(windowMs, max, message) {
    const requests = new Map();
    
    return (req, res, next) => {
      const key = `${req.ip}_${req.path}`;
      const now = Date.now();
      const windowStart = now - windowMs;
      
      // Clean up old entries
      requests.forEach((timestamp, requestKey) => {
        if (timestamp < windowStart) {
          requests.delete(requestKey);
        }
      });
      
      // Count requests in current window
      const requestsInWindow = Array.from(requests.entries())
        .filter(([requestKey, timestamp]) => 
          requestKey.startsWith(`${req.ip}_`) && timestamp >= windowStart
        ).length;
      
      if (requestsInWindow >= max) {
        logger.security.rateLimitExceeded(req.ip, req.path, max);
        
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded',
          message: message || 'Too many requests for this endpoint',
          retryAfter: Math.ceil(windowMs / 1000)
        });
      }
      
      requests.set(key, now);
      next();
    };
  }
}

// Create singleton instance
const securityMiddleware = new SecurityMiddleware();

module.exports = securityMiddleware.validateRequest.bind(securityMiddleware);
module.exports.SecurityMiddleware = SecurityMiddleware;
module.exports.instance = securityMiddleware;
