const Bull = require('bull');
const Redis = require('ioredis');
const logger = require('../utils/logger');

/**
 * Queue management service using Bull and Redis
 * Handles video processing job queue with retry logic and monitoring
 */
class QueueManager {
  constructor() {
    this.videoQueue = null;
    this.redis = null;
    this.isInitialized = false;
    this.stats = {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0
    };
    
    this.maxConcurrency = parseInt(process.env.MAX_CONCURRENT_JOBS) || 4;
    this.redisConfig = this.getRedisConfig();
  }

  /**
   * Get Redis configuration from environment variables
   */
  getRedisConfig() {
    return {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB) || 0,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      enableReadyCheck: true,
      connectTimeout: 10000,
      commandTimeout: 5000
    };
  }

  /**
   * Initialize the queue manager
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn('Queue manager already initialized');
      return;
    }

    try {
      logger.info('Initializing queue manager...', {
        redisHost: this.redisConfig.host,
        redisPort: this.redisConfig.port,
        maxConcurrency: this.maxConcurrency
      });

      // Initialize Redis client
      this.redis = new Redis(this.redisConfig);
      
      // Test Redis connection
      await this.redis.ping();
      logger.info('Redis connection established');

      // Create video processing queue
      this.videoQueue = new Bull('video-processing', {
        redis: this.redisConfig,
        defaultJobOptions: {
          removeOnComplete: 50, // Keep last 50 completed jobs
          removeOnFail: 20,     // Keep last 20 failed jobs
          attempts: 3,          // Retry up to 3 times
          backoff: {
            type: 'exponential',
            delay: 2000,        // Start with 2 second delay
          },
          ttl: 30 * 60 * 1000,  // Job expires after 30 minutes
          delay: 0              // No delay by default
        }
      });

      // Set up queue processing
      this.setupQueueProcessing();
      
      // Set up queue event handlers
      this.setupQueueEventHandlers();

      // Start queue monitoring
      this.setupQueueMonitoring();

      this.isInitialized = true;
      
      logger.info('Queue manager initialized successfully', {
        queueName: 'video-processing',
        maxConcurrency: this.maxConcurrency,
        redisConnected: true
      });

    } catch (error) {
      logger.error('Failed to initialize queue manager', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Set up queue processing with the video processing service
   */
  setupQueueProcessing() {
    // Import video processor here to avoid circular dependencies
    const VideoProcessor = require('./video-processor');
    const videoProcessor = new VideoProcessor();

    this.videoQueue.process('video-processing', this.maxConcurrency, async (job, done) => {
      const { jobId, videoUrl, options, metadata } = job.data;
      const startTime = Date.now();
      
      try {
        logger.queue.jobStarted(jobId, 'video-processing');
        logger.video.started(videoUrl, jobId);

        // Update job progress
        await job.progress(10);

        // Process the video
        const result = await videoProcessor.processVideo(job);

        const duration = Date.now() - startTime;
        logger.video.completed(videoUrl, jobId, duration, result.analysis);
        logger.queue.jobCompleted(jobId, 'video-processing', duration);

        // Job completed successfully
        done(null, result);

      } catch (error) {
        const duration = Date.now() - startTime;
        logger.video.failed(videoUrl, jobId, error, 'processing');
        logger.queue.jobFailed(jobId, 'video-processing', error, job.attemptsMade + 1);

        // Determine if this is a retryable error
        const isRetryable = this.isRetryableError(error);
        
        if (isRetryable && job.attemptsMade < job.opts.attempts - 1) {
          const delay = this.calculateRetryDelay(job.attemptsMade + 1);
          logger.queue.jobRetry(jobId, 'video-processing', job.attemptsMade + 1, delay);
          done(new Error(error.message));
        } else {
          // Mark as permanently failed
          done(new Error(`Job failed permanently: ${error.message}`));
        }
      }
    });
  }

  /**
   * Set up event handlers for queue monitoring
   */
  setupQueueEventHandlers() {
    // Job events
    this.videoQueue.on('completed', (job, result) => {
      logger.debug('Job completed', {
        jobId: job.data.jobId,
        duration: Date.now() - job.timestamp,
        resultSize: JSON.stringify(result).length
      });
    });

    this.videoQueue.on('failed', (job, err) => {
      logger.error('Job failed permanently', {
        jobId: job.data.jobId,
        error: err.message,
        attempts: job.attemptsMade,
        duration: Date.now() - job.timestamp
      });
    });

    this.videoQueue.on('stalled', (job) => {
      logger.warn('Job stalled', {
        jobId: job.data.jobId,
        processedOn: job.processedOn,
        timestamp: job.timestamp
      });
    });

    this.videoQueue.on('progress', (job, progress) => {
      logger.video.progress(job.data.videoUrl, job.data.jobId, 'processing', progress);
    });

    // Queue events
    this.videoQueue.on('ready', () => {
      logger.info('Queue ready');
    });

    this.videoQueue.on('error', (error) => {
      logger.error('Queue error', {
        error: error.message,
        stack: error.stack
      });
    });

    this.videoQueue.on('waiting', (jobId) => {
      logger.debug('Job waiting', { jobId });
    });

    this.videoQueue.on('active', (job, jobPromise) => {
      logger.debug('Job started processing', {
        jobId: job.data.jobId,
        waitTime: Date.now() - job.timestamp
      });
    });
  }

  /**
   * Set up queue monitoring to update statistics
   */
  setupQueueMonitoring() {
    const updateStats = async () => {
      try {
        if (!this.videoQueue) return;

        const [waiting, active, completed, failed, delayed] = await Promise.all([
          this.videoQueue.getWaiting(),
          this.videoQueue.getActive(),
          this.videoQueue.getCompleted(),
          this.videoQueue.getFailed(),
          this.videoQueue.getDelayed()
        ]);

        this.stats = {
          waiting: waiting.length,
          active: active.length,
          completed: completed.length,
          failed: failed.length,
          delayed: delayed.length
        };

        logger.debug('Queue stats updated', this.stats);

      } catch (error) {
        logger.error('Failed to update queue stats', {
          error: error.message
        });
      }
    };

    // Update stats every 30 seconds
    setInterval(updateStats, 30000);
    
    // Initial stats update
    setTimeout(updateStats, 5000);
  }

  /**
   * Add a video processing job to the queue
   */
  async addVideoProcessingJob(jobData) {
    if (!this.isInitialized) {
      throw new Error('Queue manager not initialized');
    }

    const { jobId, options = {} } = jobData;
    const priority = options.priority || 0;
    
    // Higher priority jobs get processed first (Bull uses lower number = higher priority)
    const bullPriority = 10 - Math.max(0, Math.min(10, priority));

    const jobOptions = {
      jobId,
      priority: bullPriority,
      attempts: 3,
      backoff: 'exponential',
      removeOnComplete: true,
      removeOnFail: false
    };

    try {
      const job = await this.videoQueue.add('video-processing', jobData, jobOptions);
      
      logger.queue.jobAdded(jobId, 'video-processing', jobData);
      
      return job;

    } catch (error) {
      logger.error('Failed to add job to queue', {
        jobId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Get a specific job by ID
   */
  async getJob(jobId) {
    if (!this.videoQueue) return null;
    
    try {
      const job = await this.videoQueue.getJob(jobId);
      return job;
    } catch (error) {
      logger.error('Failed to get job', {
        jobId,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Get jobs by status
   */
  async getJobs(status = null, limit = 10) {
    if (!this.videoQueue) return [];

    try {
      let jobs = [];
      
      if (status) {
        switch (status) {
          case 'waiting':
            jobs = await this.videoQueue.getWaiting(0, limit - 1);
            break;
          case 'active':
            jobs = await this.videoQueue.getActive(0, limit - 1);
            break;
          case 'completed':
            jobs = await this.videoQueue.getCompleted(0, limit - 1);
            break;
          case 'failed':
            jobs = await this.videoQueue.getFailed(0, limit - 1);
            break;
          case 'delayed':
            jobs = await this.videoQueue.getDelayed(0, limit - 1);
            break;
        }
      } else {
        // Get mix of all job types
        const [waiting, active, completed, failed] = await Promise.all([
          this.videoQueue.getWaiting(0, Math.ceil(limit / 4)),
          this.videoQueue.getActive(0, Math.ceil(limit / 4)),
          this.videoQueue.getCompleted(0, Math.ceil(limit / 4)),
          this.videoQueue.getFailed(0, Math.ceil(limit / 4))
        ]);
        
        jobs = [...waiting, ...active, ...completed, ...failed].slice(0, limit);
      }

      return jobs;

    } catch (error) {
      logger.error('Failed to get jobs', {
        status,
        limit,
        error: error.message
      });
      return [];
    }
  }

  /**
   * Get queue statistics
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Pause the queue
   */
  async pause() {
    if (!this.videoQueue) return false;
    
    try {
      await this.videoQueue.pause();
      logger.info('Queue paused');
      return true;
    } catch (error) {
      logger.error('Failed to pause queue', {
        error: error.message
      });
      return false;
    }
  }

  /**
   * Resume the queue
   */
  async resume() {
    if (!this.videoQueue) return false;
    
    try {
      await this.videoQueue.resume();
      logger.info('Queue resumed');
      return true;
    } catch (error) {
      logger.error('Failed to resume queue', {
        error: error.message
      });
      return false;
    }
  }

  /**
   * Clean old jobs from the queue
   */
  async clean() {
    if (!this.videoQueue) return;

    try {
      const grace = 24 * 60 * 60 * 1000; // 24 hours
      
      const [completedCleaned, failedCleaned] = await Promise.all([
        this.videoQueue.clean(grace, 'completed', 100),
        this.videoQueue.clean(grace, 'failed', 50)
      ]);

      logger.info('Queue cleaned', {
        completedCleaned,
        failedCleaned
      });

    } catch (error) {
      logger.error('Failed to clean queue', {
        error: error.message
      });
    }
  }

  /**
   * Check if an error is retryable
   */
  isRetryableError(error) {
    const retryableErrors = [
      'ECONNREFUSED',
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'Rate limit',
      'Temporary failure',
      'Service unavailable'
    ];

    const errorMessage = error.message || '';
    return retryableErrors.some(retryableError => 
      errorMessage.includes(retryableError)
    );
  }

  /**
   * Calculate retry delay based on attempt number
   */
  calculateRetryDelay(attemptNumber) {
    const baseDelay = 2000; // 2 seconds
    const maxDelay = 60000;  // 60 seconds
    
    const delay = Math.min(maxDelay, baseDelay * Math.pow(2, attemptNumber - 1));
    
    // Add some jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * delay;
    
    return Math.floor(delay + jitter);
  }

  /**
   * Get Redis health status
   */
  async getRedisHealth() {
    if (!this.redis) return { status: 'disconnected' };

    try {
      const start = Date.now();
      await this.redis.ping();
      const latency = Date.now() - start;
      
      return {
        status: 'connected',
        latency: `${latency}ms`,
        memory: await this.redis.info('memory'),
        config: {
          host: this.redisConfig.host,
          port: this.redisConfig.port,
          db: this.redisConfig.db
        }
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * Close all connections gracefully
   */
  async close(callback) {
    logger.info('Closing queue manager...');
    
    try {
      if (this.videoQueue) {
        await this.videoQueue.close();
        logger.info('Video queue closed');
      }

      if (this.redis) {
        await this.redis.quit();
        logger.info('Redis connection closed');
      }

      this.isInitialized = false;
      
      if (callback) callback();
      
    } catch (error) {
      logger.error('Error closing queue manager', {
        error: error.message
      });
      
      if (callback) callback(error);
    }
  }
}

// Create singleton instance
const queueManager = new QueueManager();

// Set up periodic cleanup (every hour)
if (process.env.NODE_ENV !== 'test') {
  setInterval(() => {
    queueManager.clean();
  }, 60 * 60 * 1000);
}

module.exports = queueManager;
