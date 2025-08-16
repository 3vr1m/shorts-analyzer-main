const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom formatting function
const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Console formatting for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = '';
    if (Object.keys(meta).length > 0) {
      metaStr = JSON.stringify(meta, null, 2);
      if (metaStr !== '{}') {
        metaStr = '\n' + metaStr;
      } else {
        metaStr = '';
      }
    }
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  })
);

// Create transports array
const transports = [];

// Console transport (always enabled in development, optional in production)
if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_CONSOLE_LOGS === 'true') {
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
      level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug')
    })
  );
}

// File transports for production
transports.push(
  // Error log file
  new winston.transports.File({
    filename: path.join(logsDir, 'error.log'),
    level: 'error',
    format: customFormat,
    maxsize: 50 * 1024 * 1024, // 50MB
    maxFiles: 5,
    tailable: true
  }),
  
  // Combined log file
  new winston.transports.File({
    filename: path.join(logsDir, 'combined.log'),
    format: customFormat,
    maxsize: 100 * 1024 * 1024, // 100MB
    maxFiles: 3,
    tailable: true,
    level: process.env.LOG_LEVEL || 'info'
  }),
  
  // Access log for HTTP requests
  new winston.transports.File({
    filename: path.join(logsDir, 'access.log'),
    format: customFormat,
    maxsize: 50 * 1024 * 1024, // 50MB
    maxFiles: 3,
    tailable: true
  })
);

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  format: customFormat,
  transports,
  exitOnError: false,
  
  // Handle exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
      format: customFormat
    })
  ],
  
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
      format: customFormat
    })
  ]
});

// Add request ID context
logger.withRequestId = function(requestId) {
  return {
    info: (message, meta = {}) => logger.info(message, { ...meta, requestId }),
    warn: (message, meta = {}) => logger.warn(message, { ...meta, requestId }),
    error: (message, meta = {}) => logger.error(message, { ...meta, requestId }),
    debug: (message, meta = {}) => logger.debug(message, { ...meta, requestId })
  };
};

// Performance timing utility
logger.time = function(label) {
  const start = process.hrtime.bigint();
  return {
    end: () => {
      const duration = process.hrtime.bigint() - start;
      const ms = Number(duration) / 1000000; // Convert nanoseconds to milliseconds
      logger.debug(`Timer [${label}]: ${ms.toFixed(2)}ms`);
      return ms;
    }
  };
};

// Video processing specific logging
logger.video = {
  started: (videoUrl, jobId) => {
    logger.info('Video processing started', {
      videoUrl,
      jobId,
      event: 'video_processing_started'
    });
  },
  
  completed: (videoUrl, jobId, duration, analysis) => {
    logger.info('Video processing completed', {
      videoUrl,
      jobId,
      duration: `${duration}ms`,
      analysisLength: analysis ? analysis.length : 0,
      event: 'video_processing_completed'
    });
  },
  
  failed: (videoUrl, jobId, error, stage) => {
    logger.error('Video processing failed', {
      videoUrl,
      jobId,
      error: error.message,
      stage,
      event: 'video_processing_failed'
    });
  },
  
  progress: (videoUrl, jobId, stage, progress) => {
    logger.debug('Video processing progress', {
      videoUrl,
      jobId,
      stage,
      progress,
      event: 'video_processing_progress'
    });
  }
};

// Queue specific logging
logger.queue = {
  jobAdded: (jobId, jobType, data) => {
    logger.info('Job added to queue', {
      jobId,
      jobType,
      videoUrl: data.videoUrl,
      priority: data.priority || 0,
      event: 'job_added'
    });
  },
  
  jobStarted: (jobId, jobType) => {
    logger.info('Job processing started', {
      jobId,
      jobType,
      event: 'job_started'
    });
  },
  
  jobCompleted: (jobId, jobType, duration) => {
    logger.info('Job completed successfully', {
      jobId,
      jobType,
      duration: `${duration}ms`,
      event: 'job_completed'
    });
  },
  
  jobFailed: (jobId, jobType, error, attemptCount) => {
    logger.error('Job failed', {
      jobId,
      jobType,
      error: error.message,
      attemptCount,
      event: 'job_failed'
    });
  },
  
  jobRetry: (jobId, jobType, attemptCount, delay) => {
    logger.warn('Job retry scheduled', {
      jobId,
      jobType,
      attemptCount,
      retryDelay: `${delay}ms`,
      event: 'job_retry'
    });
  }
};

// System health logging
logger.health = {
  check: (component, status, metrics) => {
    if (status === 'healthy') {
      logger.debug('Health check passed', {
        component,
        status,
        metrics,
        event: 'health_check_passed'
      });
    } else {
      logger.warn('Health check failed', {
        component,
        status,
        metrics,
        event: 'health_check_failed'
      });
    }
  },
  
  resourceUsage: (cpu, memory, disk) => {
    logger.debug('Resource usage metrics', {
      cpu: `${cpu.toFixed(1)}%`,
      memory: `${memory.toFixed(1)}%`,
      disk: `${disk.toFixed(1)}%`,
      event: 'resource_metrics'
    });
  }
};

// Security logging
logger.security = {
  authFailure: (ip, userAgent, endpoint) => {
    logger.warn('Authentication failed', {
      ip,
      userAgent,
      endpoint,
      event: 'auth_failure'
    });
  },
  
  rateLimitExceeded: (ip, endpoint, limit) => {
    logger.warn('Rate limit exceeded', {
      ip,
      endpoint,
      limit,
      event: 'rate_limit_exceeded'
    });
  },
  
  suspiciousActivity: (ip, activity, details) => {
    logger.error('Suspicious activity detected', {
      ip,
      activity,
      details,
      event: 'suspicious_activity'
    });
  }
};

module.exports = logger;
