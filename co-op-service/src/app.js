const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
// Load environment variables first
try {
  require('dotenv').config();
  console.log('✅ Environment variables loaded');
} catch (error) {
  console.error('❌ Failed to load environment variables:', error.message);
  process.exit(1);
}

const logger = require('./utils/logger');
const videoController = require('./controllers/video-controller');
const authMiddleware = require('./middleware/auth');
const securityMiddleware = require('./middleware/security');
const queueManager = require('./services/queue-manager');
const monitoring = require('./services/monitoring');

const app = express();
const PORT = process.env.PORT || 8080;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // API doesn't need CSP
  crossOriginEmbedderPolicy: false // Allow cross-origin requests
}));

// CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow localhost for development
    if (NODE_ENV === 'development' && origin.includes('localhost')) {
      return callback(null, true);
    }
    
    // Add your production server origins here
    const allowedOrigins = [
      process.env.PRODUCTION_SERVER_URL,
      'https://your-domain.com' // Replace with actual domain
    ].filter(Boolean);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn(`CORS: Rejected request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: NODE_ENV === 'production' ? 100 : 1000, // Limit each IP to 100 requests per windowMs in production
  message: {
    error: 'Too many requests',
    message: 'Please slow down and try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health';
  }
});

app.use(limiter);

// Request parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  const originalSend = res.send;
  
  res.send = function(data) {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.path}`, {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      requestId: req.headers['x-request-id']
    });
    originalSend.call(this, data);
  };
  
  next();
});

// Security middleware for API key validation
app.use('/api', securityMiddleware);
app.use('/api', authMiddleware);

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  const status = monitoring.getHealthStatus();
  res.status(status.healthy ? 200 : 503).json(status);
});

// System metrics endpoint
app.get('/metrics', authMiddleware, (req, res) => {
  const metrics = monitoring.getMetrics();
  res.json(metrics);
});

// Main API routes
app.post('/api/process-video', videoController.processVideo);
app.get('/api/queue-status', videoController.getQueueStatus);
app.post('/api/cancel-request', videoController.cancelRequest);

// Queue management endpoints
app.get('/api/queue/stats', (req, res) => {
  const stats = queueManager.getStats();
  res.json(stats);
});

app.post('/api/queue/pause', (req, res) => {
  queueManager.pause();
  logger.info('Queue paused by API request');
  res.json({ message: 'Queue paused' });
});

app.post('/api/queue/resume', (req, res) => {
  queueManager.resume();
  logger.info('Queue resumed by API request');
  res.json({ message: 'Queue resumed' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip
  });

  // Don't leak error details in production
  const isDev = NODE_ENV === 'development';
  res.status(err.statusCode || 500).json({
    success: false,
    error: isDev ? err.message : 'Internal server error',
    ...(isDev && { stack: err.stack })
  });
});

// 404 handler
app.use('*', (req, res) => {
  logger.warn(`404 - Not Found: ${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    availableEndpoints: [
      'GET /health',
      'GET /metrics',
      'POST /api/process-video',
      'GET /api/queue-status',
      'POST /api/cancel-request',
      'GET /api/queue/stats'
    ]
  });
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  server.close(() => {
    logger.info('HTTP server closed.');
    
    // Close queue connections
    queueManager.close(() => {
      logger.info('Queue connections closed.');
      process.exit(0);
    });
  });
  
  // Force close after 30 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 30000);
};

// Handle termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Initialize services with error handling
(async () => {
  try {
    console.log('🔄 Initializing queue manager...');
    await queueManager.initialize();
    console.log('✅ Queue manager initialized');
  } catch (error) {
    console.warn('⚠️ Queue manager failed to initialize:', error.message);
    console.log('🔄 Service will continue without queue functionality');
  }

  try {
    console.log('🔄 Initializing monitoring...');
    await monitoring.initialize();
    console.log('✅ Monitoring initialized');
  } catch (error) {
    console.warn('⚠️ Monitoring failed to initialize:', error.message);
  }
})();

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  logger.info(`🚀 Co-op Service started!`, {
    port: PORT,
    environment: NODE_ENV,
    nodeVersion: process.version,
    timestamp: new Date().toISOString(),
    publicIP: process.env.PUBLIC_IP || '83.27.41.204',
    concurrentSlots: process.env.MAX_CONCURRENT_JOBS || 4
  });
  
  logger.info(`📊 Service Status:`, {
    healthCheck: `http://localhost:${PORT}/health`,
    metrics: `http://localhost:${PORT}/metrics`,
    processVideo: `http://localhost:${PORT}/api/process-video`,
    queueStats: `http://localhost:${PORT}/api/queue/stats`
  });
});

module.exports = app;
