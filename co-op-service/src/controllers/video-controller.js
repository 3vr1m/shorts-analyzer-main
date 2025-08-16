const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const queueManager = require('../services/queue-manager');
const { SecurityMiddleware } = require('../middleware/security');

/**
 * Controller for video processing API endpoints
 */
class VideoController {
  constructor() {
    this.securityMiddleware = new SecurityMiddleware();
    this.activeRequests = new Map(); // Track active requests
  }

  /**
   * Process video endpoint - Main API endpoint for video analysis
   * POST /api/process-video
   */
  async processVideo(req, res) {
    const requestId = uuidv4();
    const startTime = Date.now();
    const ip = req.ip || req.connection.remoteAddress;
    
    try {
      const { videoUrl, callbackUrl, options = {} } = req.body;
      
      logger.info('Video processing request received', {
        requestId,
        videoUrl,
        callbackUrl,
        options,
        ip,
        userAgent: req.get('User-Agent'),
        keyName: req.auth?.keyName
      });

      // Validate required fields (already validated by security middleware)
      if (!videoUrl) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field',
          message: 'videoUrl is required'
        });
      }

      // Check queue capacity
      const queueStats = queueManager.getStats();
      const maxQueueSize = process.env.MAX_QUEUE_SIZE || 100;
      
      if (queueStats.waiting + queueStats.active >= maxQueueSize) {
        logger.warn('Queue at capacity', {
          requestId,
          queueStats,
          maxQueueSize
        });
        
        return res.status(503).json({
          success: false,
          error: 'Service temporarily unavailable',
          message: 'Processing queue is at capacity. Please try again later.',
          queueStats: {
            waiting: queueStats.waiting,
            active: queueStats.active,
            capacity: maxQueueSize
          }
        });
      }

      // Generate job ID
      const jobId = `video_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      // Prepare job data
      const jobData = {
        jobId,
        requestId,
        videoUrl,
        callbackUrl,
        options: {
          priority: options.priority || 0,
          includeTranscript: options.includeTranscript !== false,
          includeAnalysis: options.includeAnalysis !== false,
          webhook: options.webhook || null
        },
        metadata: {
          clientIp: ip,
          userAgent: req.get('User-Agent'),
          apiKey: req.auth?.keyName,
          timestamp: new Date().toISOString(),
          requestId
        }
      };

      // Add job to queue
      try {
        const job = await queueManager.addVideoProcessingJob(jobData);
        
        // Track the request
        this.activeRequests.set(jobId, {
          requestId,
          startTime,
          status: 'queued',
          videoUrl,
          clientIp: ip
        });

        logger.queue.jobAdded(jobId, 'video-processing', jobData);

        // Estimate processing time based on current queue
        const estimatedWaitTime = this.calculateEstimatedWaitTime(queueStats);

        const response = {
          success: true,
          message: 'Video processing request queued successfully',
          data: {
            jobId,
            requestId,
            status: 'queued',
            position: queueStats.waiting + 1,
            estimatedWaitTime: `${estimatedWaitTime} minutes`,
            endpoints: {
              status: `/api/queue-status?jobId=${jobId}`,
              cancel: `/api/cancel-request`
            }
          },
          queueInfo: {
            waiting: queueStats.waiting + 1,
            active: queueStats.active,
            completed: queueStats.completed,
            failed: queueStats.failed
          }
        };

        logger.info('Video processing request queued', {
          requestId,
          jobId,
          position: queueStats.waiting + 1,
          estimatedWaitTime,
          duration: `${Date.now() - startTime}ms`
        });

        res.status(202).json(response);

      } catch (queueError) {
        logger.error('Failed to add job to queue', {
          requestId,
          error: queueError.message,
          stack: queueError.stack
        });

        res.status(500).json({
          success: false,
          error: 'Failed to queue video processing job',
          message: 'Internal server error occurred while queuing the request'
        });
      }

    } catch (error) {
      logger.error('Error in processVideo controller', {
        requestId,
        error: error.message,
        stack: error.stack,
        duration: `${Date.now() - startTime}ms`
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred processing your request'
      });
    }
  }

  /**
   * Get queue status endpoint
   * GET /api/queue-status
   */
  async getQueueStatus(req, res) {
    const requestId = uuidv4();
    
    try {
      const { jobId, limit = 10, status } = req.query;
      
      logger.debug('Queue status request', {
        requestId,
        jobId,
        limit,
        status,
        keyName: req.auth?.keyName
      });

      if (jobId) {
        // Get specific job status
        const job = await queueManager.getJob(jobId);
        
        if (!job) {
          return res.status(404).json({
            success: false,
            error: 'Job not found',
            message: `No job found with ID: ${jobId}`
          });
        }

        const jobStatus = await this.formatJobStatus(job);
        
        res.json({
          success: true,
          data: jobStatus
        });
        
      } else {
        // Get queue overview
        const queueStats = queueManager.getStats();
        const jobs = await queueManager.getJobs(status, limit);
        
        const formattedJobs = await Promise.all(
          jobs.map(job => this.formatJobStatus(job))
        );

        res.json({
          success: true,
          data: {
            stats: queueStats,
            jobs: formattedJobs,
            pagination: {
              limit: parseInt(limit),
              count: formattedJobs.length
            }
          }
        });
      }

    } catch (error) {
      logger.error('Error in getQueueStatus controller', {
        requestId,
        error: error.message,
        stack: error.stack
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to retrieve queue status'
      });
    }
  }

  /**
   * Cancel processing request endpoint
   * POST /api/cancel-request
   */
  async cancelRequest(req, res) {
    const requestId = uuidv4();
    
    try {
      const { jobId, reason } = req.body;
      
      logger.info('Cancel request received', {
        requestId,
        jobId,
        reason,
        keyName: req.auth?.keyName
      });

      // Validate job ID
      if (!jobId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field',
          message: 'jobId is required'
        });
      }

      // Get job details
      const job = await queueManager.getJob(jobId);
      
      if (!job) {
        return res.status(404).json({
          success: false,
          error: 'Job not found',
          message: `No job found with ID: ${jobId}`
        });
      }

      // Check if job can be cancelled
      const jobState = await job.getState();
      
      if (jobState === 'completed') {
        return res.status(400).json({
          success: false,
          error: 'Cannot cancel completed job',
          message: 'This job has already been completed'
        });
      }

      if (jobState === 'failed') {
        return res.status(400).json({
          success: false,
          error: 'Cannot cancel failed job',
          message: 'This job has already failed'
        });
      }

      // Cancel the job
      try {
        await job.remove();
        
        // Remove from active requests tracking
        this.activeRequests.delete(jobId);
        
        logger.info('Job cancelled successfully', {
          requestId,
          jobId,
          reason,
          previousState: jobState
        });

        res.json({
          success: true,
          message: 'Job cancelled successfully',
          data: {
            jobId,
            status: 'cancelled',
            reason: reason || 'Cancelled by user request',
            cancelledAt: new Date().toISOString()
          }
        });

      } catch (cancelError) {
        logger.error('Failed to cancel job', {
          requestId,
          jobId,
          error: cancelError.message
        });

        res.status(500).json({
          success: false,
          error: 'Failed to cancel job',
          message: 'An error occurred while cancelling the job'
        });
      }

    } catch (error) {
      logger.error('Error in cancelRequest controller', {
        requestId,
        error: error.message,
        stack: error.stack
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to cancel request'
      });
    }
  }

  /**
   * Format job status for API response
   */
  async formatJobStatus(job) {
    const jobData = job.data;
    const jobState = await job.getState();
    const progress = job.progress || 0;
    
    const status = {
      jobId: jobData.jobId,
      requestId: jobData.requestId,
      status: jobState,
      progress: progress,
      videoUrl: jobData.videoUrl,
      createdAt: new Date(job.timestamp).toISOString(),
      processedAt: job.processedOn ? new Date(job.processedOn).toISOString() : null,
      finishedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null
    };

    // Add additional info based on status
    if (jobState === 'completed' && job.returnvalue) {
      status.result = {
        success: true,
        analysis: job.returnvalue.analysis || null,
        transcript: job.returnvalue.transcript || null,
        metadata: job.returnvalue.metadata || null
      };
    }

    if (jobState === 'failed' && job.failedReason) {
      status.error = {
        message: job.failedReason,
        failedAt: job.failedOn ? new Date(job.failedOn).toISOString() : null,
        attempts: job.attemptsMade || 0
      };
    }

    if (jobState === 'active') {
      status.startedAt = job.processedOn ? new Date(job.processedOn).toISOString() : null;
      status.estimatedCompletion = this.calculateEstimatedCompletion(job);
    }

    return status;
  }

  /**
   * Calculate estimated wait time based on queue stats
   */
  calculateEstimatedWaitTime(queueStats) {
    const avgProcessingTime = 5; // Average 5 minutes per video
    const concurrentJobs = process.env.MAX_CONCURRENT_JOBS || 4;
    
    const waitingJobs = queueStats.waiting;
    const activeJobs = queueStats.active;
    
    // Simple estimation: waiting jobs divided by concurrent capacity
    const estimatedMinutes = Math.ceil((waitingJobs + activeJobs) / concurrentJobs) * avgProcessingTime;
    
    return Math.max(1, estimatedMinutes); // Minimum 1 minute
  }

  /**
   * Calculate estimated completion time for active job
   */
  calculateEstimatedCompletion(job) {
    const progress = job.progress || 0;
    const startTime = job.processedOn || job.timestamp;
    const elapsedTime = Date.now() - startTime;
    
    if (progress > 0) {
      const estimatedTotalTime = (elapsedTime / progress) * 100;
      const remainingTime = estimatedTotalTime - elapsedTime;
      
      return new Date(Date.now() + remainingTime).toISOString();
    }
    
    // Fallback estimation
    return new Date(Date.now() + (5 * 60 * 1000)).toISOString(); // 5 minutes from now
  }

  /**
   * Get controller statistics
   */
  getStats() {
    return {
      activeRequests: this.activeRequests.size,
      totalRequests: this.activeRequests.size, // In a real app, this would be persistent
      uptime: process.uptime()
    };
  }

  /**
   * Clean up completed requests from tracking
   */
  cleanup() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    for (const [jobId, request] of this.activeRequests.entries()) {
      if (now - request.startTime > maxAge) {
        this.activeRequests.delete(jobId);
      }
    }
    
    logger.debug('Video controller cleanup completed', {
      remainingActiveRequests: this.activeRequests.size
    });
  }
}

// Create singleton instance
const videoController = new VideoController();

// Set up periodic cleanup (every hour)
if (process.env.NODE_ENV !== 'test') {
  setInterval(() => {
    videoController.cleanup();
  }, 60 * 60 * 1000);
}

module.exports = {
  processVideo: videoController.processVideo.bind(videoController),
  getQueueStatus: videoController.getQueueStatus.bind(videoController),
  cancelRequest: videoController.cancelRequest.bind(videoController),
  getStats: videoController.getStats.bind(videoController),
  instance: videoController
};
