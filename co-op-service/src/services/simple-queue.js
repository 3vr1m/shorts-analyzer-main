/**
 * Simple in-memory queue manager for Windows development
 * This replaces Redis dependency for local development
 */
const EventEmitter = require('events');
const logger = require('../utils/logger');

class SimpleQueue extends EventEmitter {
  constructor() {
    super();
    this.jobs = new Map();
    this.queue = [];
    this.activeJobs = new Map();
    this.stats = {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0
    };
    this.maxConcurrency = parseInt(process.env.MAX_CONCURRENT_JOBS) || 4;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) {
      console.log('⚠️  Queue manager already initialized');
      return;
    }

    console.log('🔄 Initializing simple queue manager (Redis-free mode)...');
    this.isInitialized = true;
    
    // Start processing jobs
    this.processJobs();
    
    console.log('✅ Simple queue manager initialized');
    logger.info('Queue manager initialized in Redis-free mode', {
      maxConcurrency: this.maxConcurrency,
      mode: 'simple-memory'
    });
  }

  async addVideoProcessingJob(jobData) {
    const jobId = jobData.jobId;
    
    const job = {
      id: jobId,
      data: jobData,
      status: 'waiting',
      progress: 0,
      createdAt: Date.now(),
      attempts: 0,
      maxAttempts: 3
    };

    this.jobs.set(jobId, job);
    this.queue.push(job);
    this.stats.waiting++;

    console.log(`📥 Added job to queue: ${jobId}`);
    logger.info('Job added to queue', { jobId, queueSize: this.queue.length });

    // Trigger processing
    setImmediate(() => this.processJobs());

    return {
      id: jobId,
      data: jobData
    };
  }

  async processJobs() {
    if (this.activeJobs.size >= this.maxConcurrency) {
      return; // Already at capacity
    }

    const job = this.queue.shift();
    if (!job) {
      return; // No jobs to process
    }

    // Move job to active
    job.status = 'active';
    job.startedAt = Date.now();
    this.activeJobs.set(job.id, job);
    this.stats.waiting--;
    this.stats.active++;

    console.log(`🔄 Processing job: ${job.id}`);

    try {
      // Import video processor here to avoid circular dependencies
      const VideoProcessor = require('./video-processor');
      const videoProcessor = new VideoProcessor();

      // Create a mock Bull job object for compatibility
      const mockBullJob = {
        id: job.id,
        data: job.data,
        progress: (percent) => {
          job.progress = percent;
          console.log(`📊 Job ${job.id} progress: ${percent}%`);
        }
      };

      // Process the video
      const result = await videoProcessor.processVideo(mockBullJob);

      // Job completed successfully
      job.status = 'completed';
      job.result = result;
      job.completedAt = Date.now();

      this.activeJobs.delete(job.id);
      this.stats.active--;
      this.stats.completed++;

      console.log(`✅ Job completed: ${job.id}`);
      logger.info('Job completed', { 
        jobId: job.id, 
        duration: job.completedAt - job.startedAt 
      });

    } catch (error) {
      console.error(`❌ Job failed: ${job.id}`, error.message);
      
      job.attempts++;
      job.lastError = error.message;

      if (job.attempts < job.maxAttempts) {
        // Retry the job
        job.status = 'waiting';
        this.queue.push(job);
        this.activeJobs.delete(job.id);
        this.stats.active--;
        this.stats.waiting++;
        
        console.log(`🔄 Retrying job ${job.id} (attempt ${job.attempts}/${job.maxAttempts})`);
      } else {
        // Job failed permanently
        job.status = 'failed';
        job.failedAt = Date.now();
        this.activeJobs.delete(job.id);
        this.stats.active--;
        this.stats.failed++;
        
        console.log(`💥 Job permanently failed: ${job.id}`);
      }

      logger.error('Job processing error', {
        jobId: job.id,
        error: error.message,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts
      });
    }

    // Continue processing more jobs
    setImmediate(() => this.processJobs());
  }

  getStats() {
    return { ...this.stats };
  }

  async getJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) return null;

    // Return a Bull-compatible job object
    return {
      id: jobId,
      data: job.data,
      progress: job.progress,
      timestamp: job.createdAt,
      processedOn: job.startedAt,
      finishedOn: job.completedAt || job.failedAt,
      returnvalue: job.result,
      failedReason: job.lastError,
      attemptsMade: job.attempts,
      getState: () => Promise.resolve(job.status)
    };
  }

  async getJobs(status, limit = 10) {
    const jobs = Array.from(this.jobs.values())
      .filter(job => !status || job.status === status)
      .slice(0, limit);

    return jobs.map(job => ({
      id: job.id,
      data: job.data,
      progress: job.progress,
      timestamp: job.createdAt,
      processedOn: job.startedAt,
      finishedOn: job.completedAt || job.failedAt,
      returnvalue: job.result,
      failedReason: job.lastError,
      attemptsMade: job.attempts,
      getState: () => Promise.resolve(job.status)
    }));
  }

  pause() {
    console.log('⏸️  Queue paused');
    // Simple implementation - just log for now
  }

  resume() {
    console.log('▶️  Queue resumed');
    this.processJobs();
  }

  close(callback) {
    console.log('🔒 Closing simple queue manager...');
    this.isInitialized = false;
    if (callback) callback();
  }
}

module.exports = new SimpleQueue();
