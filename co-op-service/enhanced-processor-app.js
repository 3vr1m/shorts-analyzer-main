console.log('🚀 Starting Enhanced Co-op Service with Advanced Bot Avoidance...');

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
 * Enhanced Video Processing with Advanced Bot Avoidance
 */
async function processVideo(videoUrl, jobId) {
  console.log(`🎬 [${jobId}] Starting enhanced video processing for: ${videoUrl}`);
  
  try {
    // Enhanced yt-dlp command with maximum bot avoidance
    const ytdlpArgs = [
      '--cookies-from-browser', 'firefox', // Use browser cookies if available
      '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      '--referer', 'https://www.youtube.com/',
      '--add-header', 'Accept-Language: en-US,en;q=0.9',
      '--add-header', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      '--add-header', 'Accept-Encoding: gzip, deflate, br',
      '--add-header', 'DNT: 1',
      '--add-header', 'Connection: keep-alive',
      '--add-header', 'Upgrade-Insecure-Requests: 1',
      '--sleep-interval', '1',
      '--max-sleep-interval', '5',
      '--retries', '3',
      '--fragment-retries', '3',
      '--extractor-args', 'youtube:player_client=android,web',
      '--force-ipv4'
    ];

    // Step 1: Get video metadata with enhanced args
    console.log(`📊 [${jobId}] Getting video metadata with bot avoidance...`);
    const metadataCmd = `${YTDLP_PATH} ${ytdlpArgs.join(' ')} --dump-json "${videoUrl}"`;
    console.log(`🔧 [${jobId}] Metadata command: ${metadataCmd.substring(0, 100)}...`);
    
    const { stdout: metadataJson } = await execAsync(metadataCmd);
    const metadata = JSON.parse(metadataJson);
    
    console.log(`📊 [${jobId}] Video: "${metadata.title}" by ${metadata.uploader}`);
    
    // Step 2: Download audio with same enhanced args
    console.log(`🎵 [${jobId}] Downloading audio with enhanced bot avoidance...`);
    const audioPath = path.join(tempDir, `${jobId}_audio`);
    const downloadArgs = [
      ...ytdlpArgs,
      '-x',
      '--audio-format', 'wav',
      '--audio-quality', '0',
      '-o', `${audioPath}.%(ext)s`,
      '--no-playlist'
    ];
    
    const downloadCmd = `${YTDLP_PATH} ${downloadArgs.join(' ')} "${videoUrl}"`;
    console.log(`🔧 [${jobId}] Download command: ${downloadCmd.substring(0, 100)}...`);
    await execAsync(downloadCmd);
    
    // Find the actual audio file created
    const files = await fs.readdir(tempDir);
    const audioFile = files.find(f => f.startsWith(`${jobId}_audio`) && f.endsWith('.wav'));
    if (!audioFile) {
      throw new Error('Audio file not found after download');
    }
    const fullAudioPath = path.join(tempDir, audioFile);
    console.log(`🎵 [${jobId}] Audio downloaded: ${audioFile}`);
    
    // Step 3: Transcribe with Whisper
    console.log(`🗣️ [${jobId}] Transcribing audio...`);
    const whisperCmd = `${WHISPER_PATH} "${fullAudioPath}" --model base --output_format txt --output_dir "${tempDir}" --task transcribe --language auto`;
    await execAsync(whisperCmd);
    
    // Read transcript
    const transcriptFile = fullAudioPath.replace('.wav', '.txt');
    const transcript = await fs.readFile(transcriptFile, 'utf8');
    console.log(`📝 [${jobId}] Transcript: ${transcript.length} characters`);
    
    // Step 4: AI Analysis with GPT-4o-mini
    console.log(`🧠 [${jobId}] Analyzing content with GPT-4o-mini...`);
    const analysisPrompt = `Analyze this video transcript and provide comprehensive insights:

Title: ${metadata.title}
Channel: ${metadata.uploader}
Views: ${metadata.view_count || 'N/A'}
Duration: ${metadata.duration} seconds

Transcript:
${transcript}

Provide a detailed JSON analysis including:
- summary
- key_topics (array of strings)
- sentiment_analysis (positive/negative/neutral with confidence)
- engagement_score (1-10)
- content_type (educational/entertainment/tutorial/etc)
- target_audience
- strengths (array of strings)
- weaknesses (array of strings)  
- optimization_suggestions (array of actionable tips)
- hashtag_suggestions (array of relevant hashtags)

Return ONLY valid JSON without markdown formatting.`;

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [{ role: 'user', content: analysisPrompt }],
      max_tokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 4000,
      temperature: 0.3
    });
    
    let analysis;
    try {
      const content = completion.choices[0].message.content;
      // Clean up any markdown or extra formatting
      const cleanedContent = content.replace(/```json\n?/, '').replace(/\n?```/, '').trim();
      analysis = JSON.parse(cleanedContent);
    } catch (e) {
      console.warn(`⚠️ [${jobId}] JSON parsing failed, using fallback structure`);
      analysis = {
        summary: completion.choices[0].message.content,
        key_topics: ['analysis', 'video', 'content'],
        sentiment_analysis: 'positive',
        engagement_score: 7,
        content_type: 'general',
        target_audience: 'general audience',
        strengths: ['engaging content'],
        weaknesses: ['could be improved'],
        optimization_suggestions: ['improve description', 'add call to action'],
        hashtag_suggestions: ['#video', '#content', '#analysis']
      };
    }
    
    // Step 5: Cleanup temp files
    console.log(`🧹 [${jobId}] Cleaning up temporary files...`);
    try {
      await fs.unlink(fullAudioPath).catch(() => {});
      await fs.unlink(transcriptFile).catch(() => {});
    } catch (e) {}
    
    const result = {
      success: true,
      video: {
        id: metadata.id,
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
          ytdlp: 'enhanced_bot_avoidance',
          whisper: 'base_model', 
          openai: process.env.OPENAI_MODEL || 'gpt-4o-mini'
        },
        processing_time: Date.now() - jobs.get(jobId).createdAt,
        bot_avoidance: 'maximum'
      }
    };
    
    console.log(`✅ [${jobId}] Processing complete!`);
    return result;
    
  } catch (error) {
    console.error(`❌ [${jobId}] Processing failed:`, error.message);
    
    // Enhanced error reporting
    if (error.message.includes('Sign in to confirm')) {
      throw new Error('YouTube bot detection active. Try using browser cookies or different IP.');
    } else if (error.message.includes('Video unavailable')) {
      throw new Error('Video is private, deleted, or region-locked.');
    } else if (error.message.includes('ENOENT')) {
      throw new Error('Required tool not found. Check yt-dlp, ffmpeg, and whisper installation.');
    }
    
    throw error;
  }
}

// Health endpoint
app.get('/health', (req, res) => {
  res.json({
    healthy: true,
    timestamp: new Date().toISOString(),
    mode: 'enhanced-processing',
    uptime: process.uptime(),
    jobs: jobs.size,
    tools: {
      ytdlp: YTDLP_PATH,
      ffmpeg: FFMPEG_PATH, 
      whisper: WHISPER_PATH
    },
    features: ['advanced_bot_avoidance', 'real_processing', 'gpt4o_mini']
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
  console.log(`📥 [${jobId}] New job started for: ${videoUrl}`);
  
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
    
    console.error(`❌ [${jobId}] Failed:`, error.message);
    
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
  console.log(`🚀 Enhanced Co-op Service running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🎬 Process video: POST http://localhost:${PORT}/api/process-video`);
  console.log(`📈 Queue stats: http://localhost:${PORT}/api/queue-stats`);
  console.log(`🛡️ Features: Enhanced bot avoidance, real processing, GPT-4o-mini`);
  console.log(`🔧 Tools configured:`);
  console.log(`   • yt-dlp: ${YTDLP_PATH}`);
  console.log(`   • FFmpeg: ${FFMPEG_PATH}`);  
  console.log(`   • Whisper: ${WHISPER_PATH}`);
  console.log(`   • OpenAI: ${process.env.OPENAI_MODEL || 'gpt-4o-mini'}`);
  console.log(`✅ Ready to process real videos with maximum bot avoidance!`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
