console.log('🚀 Starting Co-op Service (Windows Edition)...');

// Load environment
require('dotenv').config();
console.log('✅ Environment loaded');

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

// Basic middleware
app.use(cors());
app.use(express.json());

console.log('✅ Basic middleware loaded');

// Simple in-memory queue
const jobs = new Map();
let jobCounter = 0;

console.log('✅ Simple queue initialized');

// Health check
app.get('/health', (req, res) => {
  res.json({
    healthy: true,
    timestamp: new Date().toISOString(),
    mode: 'windows-simple',
    uptime: process.uptime(),
    jobs: jobs.size
  });
});

// Simple process video endpoint
app.post('/api/process-video', (req, res) => {
  const { videoUrl } = req.body;
  
  if (!videoUrl) {
    return res.status(400).json({
      success: false,
      error: 'videoUrl is required'
    });
  }

  const jobId = `job_${++jobCounter}_${Date.now()}`;
  
  // Store job
  jobs.set(jobId, {
    id: jobId,
    videoUrl,
    status: 'queued',
    createdAt: new Date().toISOString(),
    progress: 0
  });

  console.log(`📥 New job queued: ${jobId} for video: ${videoUrl}`);

  // Simulate processing in background
  setTimeout(() => {
    const job = jobs.get(jobId);
    if (job) {
      job.status = 'processing';
      job.progress = 50;
      console.log(`🔄 Processing job: ${jobId}`);
      
      // Complete after another delay
      setTimeout(() => {
        job.status = 'completed';
        job.progress = 100;
        job.completedAt = new Date().toISOString();
        job.result = {
          analysis: `Analysis for video: ${videoUrl}`,
          transcript: 'Sample transcript (external tools would be called here)',
          metadata: {
            duration: '5:30',
            processed_at: new Date().toISOString()
          }
        };
        console.log(`✅ Job completed: ${jobId}`);
      }, 3000);
    }
  }, 1000);

  res.status(202).json({
    success: true,
    message: 'Video processing started',
    data: {
      jobId,
      status: 'queued',
      videoUrl,
      statusEndpoint: `/api/job-status/${jobId}`
    }
  });
});

// Job status endpoint
app.get('/api/job-status/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);

  if (!job) {
    return res.status(404).json({
      success: false,
      error: 'Job not found'
    });
  }

  res.json({
    success: true,
    data: job
  });
});

// Queue stats
app.get('/api/queue-stats', (req, res) => {
  const allJobs = Array.from(jobs.values());
  
  const stats = {
    total: allJobs.length,
    queued: allJobs.filter(j => j.status === 'queued').length,
    processing: allJobs.filter(j => j.status === 'processing').length,
    completed: allJobs.filter(j => j.status === 'completed').length,
    failed: allJobs.filter(j => j.status === 'failed').length
  };

  res.json({
    success: true,
    data: stats
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log('');
  console.log('🎉 ================================');
  console.log('🚀 Co-op Service Started (Simple Mode)');
  console.log('🎉 ================================');
  console.log('');
  console.log(`📍 Server running on port ${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
  console.log(`📥 Process video: POST http://localhost:${PORT}/api/process-video`);
  console.log(`📊 Queue stats: http://localhost:${PORT}/api/queue-stats`);
  console.log('');
  console.log('🔧 This is a simplified version for Windows testing');
  console.log('📖 Full features available in Docker deployment');
  console.log('');
  console.log('🎯 Ready to test video processing!');
  console.log('');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

console.log('⏳ Starting server...');
