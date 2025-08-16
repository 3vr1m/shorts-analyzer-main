// Windows-compatible Co-op Video Analysis Service
// This version uses simple in-memory queue instead of Redis

// Load environment variables first
try {
  require('dotenv').config();
  console.log('✅ Environment variables loaded');
} catch (error) {
  console.error('❌ Failed to load environment variables:', error.message);
  process.exit(1);
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

console.log('🔄 Loading application modules...');

const logger = require('./src/utils/logger');
const videoController = require('./src/controllers/video-controller');
const authMiddleware = require('./src/middleware/auth');
const securityMiddleware = require('./src/middleware/security');

// Use simple queue instead of Redis-based queue
const queueManager = require('./src/services/simple-queue');
const monitoring = require('./src/services/monitoring');

console.log('✅ All modules loaded successfully');

const app = express();
const PORT = process.env.PORT || 8080;
const NODE_ENV = process.env.NODE_ENV || 'development';

console.log(`🌟 Starting Co-op Service in ${NODE_ENV} mode on port ${PORT}`);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
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
    
    // Allow configured origins
    const allowedOrigins = [
      process.env.PRODUCTION_SERVER_URL,
      'https://your-domain.com'
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
  max: NODE_ENV === 'production' ? 100 : 1000,
  message: {
    error: 'Too many requests',
    message: 'Please slow down and try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health'
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
    console.log(`📡 ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
    originalSend.call(this, data);
  };
  
  next();
});

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  try {
    const status = monitoring.getHealthStatus();
    res.status(status.healthy ? 200 : 503).json({
      ...status,
      mode: 'windows-native',
      queue: 'simple-memory',
      redis: 'disabled'
    });
  } catch (error) {
    res.status(503).json({
      healthy: false,
      error: 'Health check failed',
      mode: 'windows-native',
      timestamp: new Date().toISOString()
    });
  }
});

// API routes with middleware
app.use('/api', securityMiddleware);
app.use('/api', authMiddleware);

// System metrics endpoint
app.get('/metrics', (req, res) => {
  try {
    const metrics = monitoring.getMetrics();
    res.json({
      ...metrics,
      queue: queueManager.getStats(),
      mode: 'windows-native'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get metrics',
      message: error.message
    });
  }
});

// Main API routes
app.post('/api/process-video', videoController.processVideo);
app.get('/api/queue-status', videoController.getQueueStatus);
app.post('/api/cancel-request', videoController.cancelRequest);

// Queue management endpoints
app.get('/api/queue/stats', (req, res) => {
  try {
    const stats = queueManager.getStats();
    res.json({
      success: true,
      data: stats,
      mode: 'simple-memory'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get queue stats',
      message: error.message
    });
  }
});

app.post('/api/queue/pause', (req, res) => {
  try {
    queueManager.pause();
    console.log('⏸️  Queue paused by API request');
    res.json({ message: 'Queue paused' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to pause queue' });
  }
});

app.post('/api/queue/resume', (req, res) => {
  try {
    queueManager.resume();
    console.log('▶️  Queue resumed by API request');
    res.json({ message: 'Queue resumed' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to resume queue' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err.message);
  
  const isDev = NODE_ENV === 'development';
  res.status(err.statusCode || 500).json({
    success: false,
    error: isDev ? err.message : 'Internal server error',
    ...(isDev && { stack: err.stack })
  });
});

// 404 handler
app.use('*', (req, res) => {
  console.log(`🔍 404 - Not Found: ${req.method} ${req.originalUrl}`);
  
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
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
  
  server.close(() => {
    console.log('🔒 HTTP server closed.');
    
    queueManager.close(() => {
      console.log('🔒 Queue connections closed.');
      process.exit(0);
    });
  });
  
  // Force close after 30 seconds
  setTimeout(() => {
    console.error('⏰ Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 30000);
};

// Handle termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Initialize services with error handling
async function initializeServices() {
  console.log('🔄 Initializing services...');
  
  try {
    console.log('🔄 Initializing simple queue manager...');
    await queueManager.initialize();
    console.log('✅ Queue manager initialized successfully');
  } catch (error) {
    console.error('❌ Queue manager initialization failed:', error.message);
    console.log('🔄 Service will continue with limited functionality');
  }

  try {
    console.log('🔄 Initializing monitoring...');
    await monitoring.initialize();
    console.log('✅ Monitoring initialized successfully');
  } catch (error) {
    console.error('❌ Monitoring initialization failed:', error.message);
  }
  
  console.log('✅ Service initialization complete');
}

// Start server
const server = app.listen(PORT, '0.0.0.0', async () => {
  console.log('');
  console.log('🎉 =================================');
  console.log('🚀 Co-op Service Started Successfully!');
  console.log('🎉 =================================');
  console.log('');
  console.log(`📍 Server Info:`);
  console.log(`   • Port: ${PORT}`);
  console.log(`   • Environment: ${NODE_ENV}`);
  console.log(`   • Mode: Windows Native (Redis-free)`);
  console.log(`   • Public IP: ${process.env.PUBLIC_IP || '83.27.41.204'}`);
  console.log(`   • Max Concurrent Jobs: ${process.env.MAX_CONCURRENT_JOBS || 4}`);
  console.log('');
  console.log('🌐 Available Endpoints:');
  console.log(`   • Health Check:  http://localhost:${PORT}/health`);
  console.log(`   • Metrics:       http://localhost:${PORT}/metrics`);
  console.log(`   • Process Video: http://localhost:${PORT}/api/process-video`);
  console.log(`   • Queue Status:  http://localhost:${PORT}/api/queue-status`);
  console.log('');
  console.log('🔑 Authentication:');
  console.log('   • All /api/* endpoints require X-API-Key header');
  console.log('   • Check your .env file for available API keys');
  console.log('');
  
  // Initialize services after server starts
  await initializeServices();
  
  console.log('🎯 Service is ready to process videos!');
  console.log('📖 See README.md for API documentation');
  console.log('');
});

module.exports = app;
