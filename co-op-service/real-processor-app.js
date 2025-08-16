console.log('🚀 Starting Real Video Processing Co-op Service...');

// Load environment
require('dotenv').config();
console.log('✅ Environment loaded');

const express = require('express');
const cors = require('cors');
const { exec, spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { promisify } = require('util');
const OpenAI = require('openai');

const execAsync = promisify(exec);
const app = express();
const PORT = process.env.PORT || 8080;

// Basic middleware
app.use(cors());
app.use(express.json());
console.log('✅ Basic middleware loaded');

// OpenAI setup
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Simple in-memory job storage
const jobs = new Map();
let jobCounter = 0;

// Tool paths (Linux)
const YTDLP_PATH = process.env.YTDLP_PATH || '/usr/local/bin/yt-dlp';
const FFMPEG_PATH = process.env.FFMPEG_PATH || '/usr/bin/ffmpeg';
const WHISPER_PATH = process.env.WHISPER_PATH || '/usr/local/bin/whisper';

// Ensure temp directory exists
const tempDir = './temp';
fs.mkdir(tempDir, { recursive: true }).catch(() => {});

/**
 * Real Video Processing Function
 */
async function processVideo(videoUrl, jobId) {
  console.log(`🎬 [${jobId}] Starting real video processing for: ${videoUrl}`);
  
  try {
    // Step 1: Get video metadata
    console.log(`📊 [${jobId}] Getting video metadata...`);
    const metadataCmd = `${YTDLP_PATH} --dump-json "${videoUrl}"`;
    const { stdout: metadataJson } = await execAsync(metadataCmd);
    const metadata = JSON.parse(metadataJson);
    
    console.log(`📊 [${jobId}] Video: "${metadata.title}" by ${metadata.uploader}`);
    
    // Step 2: Download audio
    console.log(`🎵 [${jobId}] Downloading audio...`);
    const audioPath = path.join(tempDir, `${jobId}_audio.wav`);
    const downloadCmd = `${YTDLP_PATH} -x --audio-format wav --audio-quality 0 -o "${audioPath.replace('.wav', '.%(ext)s')}" "${videoUrl}"`;
    await execAsync(downloadCmd);
    
    // Step 3: Transcribe with Whisper
    console.log(`🗣️ [${jobId}] Transcribing audio...`);
    const transcriptPath = path.join(tempDir, `${jobId}_transcript.txt`);
    const whisperCmd = `${WHISPER_PATH} "${audioPath}" --model base --output_format txt --output_dir "${tempDir}" --task transcribe`;
    await execAsync(whisperCmd);
    
    // Read transcript
    const transcriptFile = audioPath.replace('.wav', '.txt');
    const transcript = await fs.readFile(transcriptFile, 'utf8');
    console.log(`📝 [${jobId}] Transcript: ${transcript.length} characters`);
    
    // Step 4: AI Analysis with GPT-4o-mini
    console.log(`🧠 [${jobId}] Analyzing content with GPT-4o-mini...`);
    const analysisPrompt = `Analyze this video transcript and provide comprehensive insights:

Title: ${metadata.title}
Channel: ${metadata.uploader}
Views: ${metadata.view_count}
Duration: ${metadata.duration} seconds

Transcript:
${transcript}

Provide a detailed JSON analysis including:
- summary
- key_topics  
- sentiment_analysis
- engagement_score (1-10)
- content_type
- target_audience
- strengths
- weaknesses
- optimization_suggestions
- hashtag_suggestions`;

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [{ role: 'user', content: analysisPrompt }],
      max_tokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 4000,
      temperature: 0.3
    });
    
    let analysis;
    try {
      // Try to parse as JSON
      const content = completion.choices[0].message.content;
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
      analysis = JSON.parse(jsonMatch ? jsonMatch[1] || jsonMatch[0] : content);
    } catch (e) {
      // Fallback to plain text
      analysis = { 
        summary: completion.choices[0].message.content,
        analysis_note: "Full structured analysis available on request"
      };
    }
    
    // Step 5: Cleanup temp files
    console.log(`🧹 [${jobId}] Cleaning up temporary files...`);
    try {
      await fs.unlink(audioPath).catch(() => {});
      await fs.unlink(transcriptFile).catch(() => {});
    } catch (e) {}
    
    const result = {
      success: true,
      video: {
        title: metadata.title,
        uploader: metadata.uploader,
        duration: metadata.duration,
        view_count: metadata.view_count,
        like_count: metadata.like_count,
        upload_date: metadata.upload_date,
        url: videoUrl
      },
      transcript: {
        text: transcript,
        language: 'auto-detected',
        length: transcript.length
      },
      analysis: analysis,
      metadata: {
        processed_with: {
          ytdlp: 'real',
          whisper: 'base_model', 
          openai: process.env.OPENAI_MODEL || 'gpt-4o-mini'
        },
        processing_time: Date.now() - jobs.get(jobId).createdAt
      }
    };
    
    console.log(`✅ [${jobId}] Processing complete!`);
    return result;
    
  } catch (error) {
    console.error(`❌ [${jobId}] Processing failed:`, error.message);
    throw error;
  }
}

// Health endpoint
app.get('/health', (req, res) => {
  res.json({
    healthy: true,
    timestamp: new Date().toISOString(),
    mode: 'real-processing',
    uptime: process.uptime(),
    jobs: jobs.size,
    tools: {
      ytdlp: YTDLP_PATH,
      ffmpeg: FFMPEG_PATH, 
      whisper: WHISPER_PATH
    }
  });
});

// Process video endpoint
app.post('/api/process-video', async (req, res) => {
  const { videoUrl, options = {} } = req.body;
  
  if (!videoUrl) {
    return res.status(400).json({ 
      success: false, 
      error: 'Video URL is required' 
    });
  }
  
  // Create job
  const jobId = `job_${++jobCounter}_${Date.now()}`;
  const job = {
    id: jobId,
    videoUrl,
    status: 'processing',
    createdAt: Date.now(),
    progress: 0
  };
  
  jobs.set(jobId, job);
  console.log(`📥 New job started: ${jobId} for video: ${videoUrl}`);
  
  // Process immediately (blocking for now, can be made async later)
  try {
    job.progress = 10;
    const result = await processVideo(videoUrl, jobId);
    
    job.status = 'completed';
    job.progress = 100;
    job.completedAt = Date.now();
    job.result = result;
    
    res.json({
      success: true,
      message: 'Video processing completed',
      data: {
        jobId: jobId,
        status: 'completed',
        result: result
      }
    });
    
  } catch (error) {
    job.status = 'failed';
    job.error = error.message;
    
    res.status(500).json({
      success: false,
      message: 'Video processing failed',
      error: error.message,
      data: {
        jobId: jobId,
        status: 'failed'
      }
    });
  }
});

// Job status endpoint  
app.get('/api/job-status/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  
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
  const stats = {
    total: jobs.size,
    processing: 0,
    completed: 0,
    failed: 0
  };
  
  for (const job of jobs.values()) {
    if (job.status === 'processing') stats.processing++;
    else if (job.status === 'completed') stats.completed++;  
    else if (job.status === 'failed') stats.failed++;
  }
  
  res.json({
    success: true,
    data: stats
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Real Video Processing Co-op Service running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🎬 Process video: POST http://localhost:${PORT}/api/process-video`);
  console.log(`📈 Queue stats: http://localhost:${PORT}/api/queue-stats`);
  console.log(`🔧 Using real tools:`);
  console.log(`   • yt-dlp: ${YTDLP_PATH}`);
  console.log(`   • FFmpeg: ${FFMPEG_PATH}`);  
  console.log(`   • Whisper: ${WHISPER_PATH}`);
  console.log(`   • OpenAI: ${process.env.OPENAI_MODEL || 'gpt-4o-mini'}`);
  console.log(`✅ Ready to process real videos!`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
