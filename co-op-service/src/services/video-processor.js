const { exec, spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { promisify } = require('util');
const OpenAI = require('openai');
const logger = require('../utils/logger');

const execAsync = promisify(exec);

/**
 * Core video processing service that integrates all video analysis tools
 */
class VideoProcessor {
  constructor() {
    this.tempDir = process.env.TEMP_DIR || './temp';
    this.storageDir = process.env.STORAGE_PATH || './storage';
    this.maxVideoDuration = parseInt(process.env.MAX_VIDEO_DURATION) || 600; // 10 minutes
    
    // Tool paths
    this.ytdlpPath = process.env.YTDLP_PATH || 'yt-dlp';
    this.ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
    this.whisperPath = process.env.WHISPER_PATH || 'whisper';
    
    // OpenAI configuration
    this.openai = null;
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your-openai-api-key-here') {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
    }
    
    this.openaiModel = process.env.OPENAI_MODEL || 'gpt-4';
    this.openaiMaxTokens = parseInt(process.env.OPENAI_MAX_TOKENS) || 4000;
    
    // Whisper configuration
    this.whisperModel = process.env.WHISPER_MODEL || 'base';
    this.whisperLanguage = process.env.WHISPER_LANGUAGE || 'auto';
    
    // Ensure directories exist
    this.ensureDirectories();
  }

  /**
   * Ensure required directories exist
   */
  async ensureDirectories() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
      await fs.mkdir(this.storageDir, { recursive: true });
      await fs.mkdir(path.join(this.tempDir, 'downloads'), { recursive: true });
      await fs.mkdir(path.join(this.tempDir, 'audio'), { recursive: true });
      await fs.mkdir(path.join(this.tempDir, 'transcripts'), { recursive: true });
    } catch (error) {
      logger.error('Failed to create directories', {
        error: error.message,
        tempDir: this.tempDir,
        storageDir: this.storageDir
      });
    }
  }

  /**
   * Main video processing function
   * Orchestrates the entire pipeline: download -> extract audio -> transcribe -> analyze
   */
  async processVideo(job) {
    const { jobId, videoUrl, options = {} } = job.data;
    const sessionId = this.generateSessionId();
    
    logger.video.started(videoUrl, jobId);
    
    let videoFile = null;
    let audioFile = null;
    let transcript = null;
    let analysis = null;
    
    try {
      // Update job progress
      await job.progress(5);
      
      // Step 1: Download video metadata and validate
      const videoInfo = await this.getVideoInfo(videoUrl, sessionId);
      
      if (videoInfo.duration > this.maxVideoDuration) {
        throw new Error(`Video duration ${videoInfo.duration}s exceeds maximum allowed ${this.maxVideoDuration}s`);
      }
      
      await job.progress(15);
      
      // Step 2: Download video
      videoFile = await this.downloadVideo(videoUrl, videoInfo, sessionId, job);
      await job.progress(40);
      
      // Step 3: Extract audio if transcript is requested
      if (options.includeTranscript !== false) {
        audioFile = await this.extractAudio(videoFile, sessionId, job);
        await job.progress(50);
        
        // Step 4: Generate transcript
        transcript = await this.transcribeAudio(audioFile, sessionId, job);
        await job.progress(70);
      }
      
      // Step 5: Analyze video content if analysis is requested
      if (options.includeAnalysis !== false && this.openai) {
        analysis = await this.analyzeContent(videoInfo, transcript, sessionId, job);
        await job.progress(90);
      }
      
      // Step 6: Prepare final result
      const result = await this.prepareResult({
        videoInfo,
        transcript,
        analysis,
        sessionId,
        jobId,
        videoUrl,
        options
      });
      
      await job.progress(95);
      
      // Step 7: Send webhook if configured
      if (options.webhook) {
        await this.sendWebhook(options.webhook, result, jobId);
      }
      
      await job.progress(100);
      
      // Cleanup temporary files
      await this.cleanup(sessionId);
      
      logger.video.completed(videoUrl, jobId, Date.now() - job.timestamp, analysis);
      
      return result;
      
    } catch (error) {
      logger.video.failed(videoUrl, jobId, error, 'processing');
      
      // Cleanup on error
      if (sessionId) {
        await this.cleanup(sessionId);
      }
      
      throw error;
    }
  }

  /**
   * Get video information using yt-dlp
   */
  async getVideoInfo(videoUrl, sessionId) {
    logger.debug('Getting video info', { videoUrl, sessionId });
    
    try {
      const { stdout } = await execAsync(
        `${this.ytdlpPath} --dump-json --no-download "${videoUrl}"`,
        { timeout: 30000 }
      );
      
      const info = JSON.parse(stdout);
      
      return {
        id: info.id,
        title: info.title || 'Unknown Title',
        description: info.description || '',
        duration: info.duration || 0,
        uploader: info.uploader || 'Unknown',
        uploadDate: info.upload_date || null,
        viewCount: info.view_count || 0,
        likeCount: info.like_count || 0,
        thumbnail: info.thumbnail || null,
        tags: info.tags || [],
        categories: info.categories || [],
        format: info.format || 'unknown',
        resolution: `${info.width || 0}x${info.height || 0}`,
        fps: info.fps || 0,
        originalUrl: videoUrl
      };
      
    } catch (error) {
      logger.error('Failed to get video info', {
        videoUrl,
        sessionId,
        error: error.message
      });
      throw new Error(`Failed to get video information: ${error.message}`);
    }
  }

  /**
   * Download video using yt-dlp
   */
  async downloadVideo(videoUrl, videoInfo, sessionId, job) {
    const outputPath = path.join(this.tempDir, 'downloads', `${sessionId}_video.%(ext)s`);
    const finalPath = path.join(this.tempDir, 'downloads', `${sessionId}_video.mp4`);
    
    logger.debug('Downloading video', { videoUrl, sessionId, outputPath });
    
    try {
      // Use yt-dlp with progress tracking
      const command = [
        this.ytdlpPath,
        '--format', 'best[height<=720]/best', // Limit to 720p for processing efficiency
        '--output', outputPath,
        '--no-playlist',
        // Removed --extract-flat as it's not needed for downloading and causes compatibility issues
        videoUrl
      ];
      
      await this.runCommandWithProgress(command, job, 15, 25, 'Downloading video');
      
      // Find the actual downloaded file
      const files = await fs.readdir(path.join(this.tempDir, 'downloads'));
      const videoFile = files.find(f => f.startsWith(`${sessionId}_video`));
      
      if (!videoFile) {
        throw new Error('Downloaded video file not found');
      }
      
      const actualPath = path.join(this.tempDir, 'downloads', videoFile);
      
      // Rename to consistent .mp4 extension if needed
      if (videoFile !== `${sessionId}_video.mp4`) {
        await fs.rename(actualPath, finalPath);
        return finalPath;
      }
      
      return actualPath;
      
    } catch (error) {
      logger.error('Failed to download video', {
        videoUrl,
        sessionId,
        error: error.message
      });
      throw new Error(`Failed to download video: ${error.message}`);
    }
  }

  /**
   * Extract audio from video using ffmpeg
   */
  async extractAudio(videoFile, sessionId, job) {
    const audioPath = path.join(this.tempDir, 'audio', `${sessionId}_audio.wav`);
    
    logger.debug('Extracting audio', { videoFile, audioPath, sessionId });
    
    try {
      // Use ffmpeg to extract audio as WAV for Whisper
      const command = [
        this.ffmpegPath,
        '-i', videoFile,
        '-vn', // No video
        '-acodec', 'pcm_s16le', // 16-bit PCM
        '-ar', '16000', // 16kHz sample rate (Whisper requirement)
        '-ac', '1', // Mono
        '-y', // Overwrite output file
        audioPath
      ];
      
      await this.runCommandWithProgress(command, job, 40, 50, 'Extracting audio');
      
      // Verify audio file was created
      const stats = await fs.stat(audioPath);
      if (stats.size === 0) {
        throw new Error('Extracted audio file is empty');
      }
      
      return audioPath;
      
    } catch (error) {
      logger.error('Failed to extract audio', {
        videoFile,
        sessionId,
        error: error.message
      });
      throw new Error(`Failed to extract audio: ${error.message}`);
    }
  }

  /**
   * Transcribe audio using Whisper
   */
  async transcribeAudio(audioFile, sessionId, job) {
    const transcriptPath = path.join(this.tempDir, 'transcripts', `${sessionId}_transcript.json`);
    
    logger.debug('Transcribing audio', { audioFile, transcriptPath, sessionId });
    
    try {
      // Use Whisper to transcribe audio
      const command = [
        this.whisperPath,
        audioFile,
        '--model', this.whisperModel
      ];
      
      // Only add language parameter if not auto-detect
      if (this.whisperLanguage !== 'auto') {
        command.push('--language', this.whisperLanguage);
      }
      
      command.push(
        '--output_format', 'json',
        '--output_dir', path.join(this.tempDir, 'transcripts'),
        '--fp16', 'False', // Use FP32 for better compatibility
        '--verbose', 'False'
      );
      
      if (process.env.DEBUG_VIDEO_PROCESSING === 'true') {
        command.push('--verbose', 'True');
      }
      
      await this.runCommandWithProgress(command, job, 50, 70, 'Transcribing audio');
      
      // Read the transcript file
      const transcriptFiles = await fs.readdir(path.join(this.tempDir, 'transcripts'));
      const jsonFile = transcriptFiles.find(f => f.includes(sessionId) && f.endsWith('.json'));
      
      if (!jsonFile) {
        throw new Error('Whisper transcript file not found');
      }
      
      const transcriptData = await fs.readFile(path.join(this.tempDir, 'transcripts', jsonFile), 'utf-8');
      const transcript = JSON.parse(transcriptData);
      
      return {
        text: transcript.text || '',
        segments: transcript.segments || [],
        language: transcript.language || 'unknown',
        duration: transcript.segments ? 
          Math.max(...transcript.segments.map(s => s.end)) : 0,
        confidence: transcript.segments ? 
          transcript.segments.reduce((avg, s, _, arr) => avg + (s.avg_logprob || 0) / arr.length, 0) : 0
      };
      
    } catch (error) {
      logger.error('Failed to transcribe audio', {
        audioFile,
        sessionId,
        error: error.message
      });
      throw new Error(`Failed to transcribe audio: ${error.message}`);
    }
  }

  /**
   * Analyze video content using OpenAI
   */
  async analyzeContent(videoInfo, transcript, sessionId, job) {
    if (!this.openai) {
      logger.warn('OpenAI not configured, skipping analysis');
      return null;
    }
    
    logger.debug('Analyzing content with OpenAI', { sessionId, hasTranscript: !!transcript });
    
    try {
      const analysisPrompt = this.buildAnalysisPrompt(videoInfo, transcript);
      
      const response = await this.openai.chat.completions.create({
        model: this.openaiModel,
        messages: [
          {
            role: 'system',
            content: 'You are an expert video content analyst. Analyze the provided video information and transcript to provide comprehensive insights about the content, including themes, sentiment, key topics, engagement potential, and actionable recommendations. Always respond with valid JSON format.'
          },
          {
            role: 'user',
            content: analysisPrompt
          }
        ],
        max_tokens: this.openaiMaxTokens,
        temperature: 0.1 // Low temperature for consistent analysis
      });
      
      const analysisText = response.choices[0]?.message?.content;
      if (!analysisText) {
        throw new Error('Empty response from OpenAI');
      }
      
      // Clean the response text to handle markdown code blocks
      let cleanedText = analysisText.trim();
      
      // Remove markdown code block markers if present
      if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      // Parse the JSON response
      const analysis = JSON.parse(cleanedText);
      
      // Add metadata
      analysis.metadata = {
        model: this.openaiModel,
        tokens_used: response.usage?.total_tokens || 0,
        generated_at: new Date().toISOString(),
        session_id: sessionId
      };
      
      return analysis;
      
    } catch (error) {
      logger.error('Failed to analyze content with OpenAI', {
        sessionId,
        error: error.message,
        hasTranscript: !!transcript
      });
      
      // Return a basic analysis instead of failing
      return {
        error: 'Analysis failed',
        basic_info: {
          title: videoInfo.title,
          duration: videoInfo.duration,
          has_transcript: !!transcript,
          transcript_length: transcript ? transcript.text.length : 0
        },
        metadata: {
          error: error.message,
          generated_at: new Date().toISOString(),
          session_id: sessionId
        }
      };
    }
  }

  /**
   * Build analysis prompt for OpenAI
   */
  buildAnalysisPrompt(videoInfo, transcript) {
    const transcriptText = transcript ? transcript.text : 'No transcript available';
    const transcriptSegments = transcript ? transcript.segments.length : 0;
    
    return `Please analyze this video content and provide a comprehensive JSON response with the following structure:

{
  "summary": "Brief summary of the video content",
  "themes": ["main", "themes", "identified"],
  "sentiment": {
    "overall": "positive/negative/neutral",
    "confidence": 0.85,
    "details": "explanation of sentiment analysis"
  },
  "key_topics": [
    {
      "topic": "topic name",
      "relevance": 0.9,
      "timestamps": ["00:30", "02:45"]
    }
  ],
  "engagement_analysis": {
    "hook_quality": "strong/moderate/weak",
    "pacing": "fast/moderate/slow",
    "retention_prediction": 0.75,
    "call_to_action": "present/absent",
    "engagement_score": 8.5
  },
  "content_insights": {
    "target_audience": "description of likely audience",
    "content_type": "educational/entertainment/promotional/etc",
    "complexity_level": "beginner/intermediate/advanced",
    "production_quality": "high/medium/low"
  },
  "optimization_suggestions": [
    "specific actionable recommendations"
  ],
  "tags_suggestions": ["relevant", "tags", "for", "categorization"],
  "strengths": ["what works well"],
  "weaknesses": ["areas for improvement"]
}

Video Information:
- Title: ${videoInfo.title}
- Duration: ${videoInfo.duration} seconds
- Uploader: ${videoInfo.uploader}
- Description: ${videoInfo.description.substring(0, 500)}${videoInfo.description.length > 500 ? '...' : ''}
- Tags: ${videoInfo.tags.join(', ')}
- Categories: ${videoInfo.categories.join(', ')}
- View Count: ${videoInfo.viewCount}
- Like Count: ${videoInfo.likeCount}

Transcript (${transcriptSegments} segments):
${transcriptText.substring(0, 3000)}${transcriptText.length > 3000 ? '...' : ''}

Please provide detailed analysis in the JSON format specified above.`;
  }

  /**
   * Prepare final result object
   */
  async prepareResult({
    videoInfo,
    transcript,
    analysis,
    sessionId,
    jobId,
    videoUrl,
    options
  }) {
    const result = {
      success: true,
      jobId,
      sessionId,
      processedAt: new Date().toISOString(),
      data: {
        video: {
          url: videoUrl,
          title: videoInfo.title,
          duration: videoInfo.duration,
          uploader: videoInfo.uploader,
          uploadDate: videoInfo.uploadDate,
          viewCount: videoInfo.viewCount,
          likeCount: videoInfo.likeCount,
          description: videoInfo.description,
          tags: videoInfo.tags,
          categories: videoInfo.categories,
          resolution: videoInfo.resolution,
          fps: videoInfo.fps
        },
        analysis: analysis || null,
        transcript: transcript || null
      },
      metadata: {
        processing: {
          includeTranscript: options.includeTranscript !== false,
          includeAnalysis: options.includeAnalysis !== false,
          hasWebhook: !!options.webhook
        },
        tools: {
          ytdlp: this.ytdlpPath,
          ffmpeg: this.ffmpegPath,
          whisper: transcript ? this.whisperPath : null,
          openai: analysis ? this.openaiModel : null
        },
        performance: {
          totalProcessingTime: Date.now() - Date.parse(sessionId.split('_')[1]),
          transcriptLength: transcript ? transcript.text.length : 0,
          analysisTokens: analysis?.metadata?.tokens_used || 0
        }
      }
    };
    
    return result;
  }

  /**
   * Send webhook notification
   */
  async sendWebhook(webhookUrl, result, jobId) {
    logger.debug('Sending webhook', { webhookUrl, jobId });
    
    try {
      const fetch = (await import('node-fetch')).default;
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'co-op-service/1.0'
        },
        body: JSON.stringify({
          event: 'video_processing_completed',
          jobId,
          timestamp: new Date().toISOString(),
          data: result
        }),
        timeout: parseInt(process.env.WEBHOOK_TIMEOUT) || 10000
      });
      
      if (!response.ok) {
        throw new Error(`Webhook returned ${response.status}: ${response.statusText}`);
      }
      
      logger.info('Webhook sent successfully', { webhookUrl, jobId, status: response.status });
      
    } catch (error) {
      logger.error('Failed to send webhook', {
        webhookUrl,
        jobId,
        error: error.message
      });
      
      // Don't fail the job if webhook fails
    }
  }

  /**
   * Run command with progress tracking
   */
  async runCommandWithProgress(command, job, startProgress, endProgress, description) {
    return new Promise((resolve, reject) => {
      logger.debug(`Starting: ${description}`, { command: command.join(' ') });
      
      // Handle Windows executable paths properly
      const spawnOptions = {
        stdio: ['pipe', 'pipe', 'pipe']
      };
      
      // On Windows, if the command contains .exe, ensure shell: false (default)
      // but handle paths with spaces properly
      if (process.platform === 'win32') {
        spawnOptions.shell = false;
      }
      
      const childProcess = spawn(command[0], command.slice(1), spawnOptions);
      
      let output = '';
      let errorOutput = '';
      
      childProcess.stdout.on('data', (data) => {
        output += data.toString();
        
        // Update progress periodically
        const currentProgress = startProgress + 
          ((endProgress - startProgress) * Math.min(output.length / 1000, 1));
        job.progress(Math.round(currentProgress));
      });
      
      childProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      childProcess.on('close', (code) => {
        if (code === 0) {
          logger.debug(`Completed: ${description}`, { code });
          job.progress(endProgress);
          resolve(output);
        } else {
          logger.error(`Failed: ${description}`, { code, error: errorOutput });
          reject(new Error(`${description} failed with code ${code}: ${errorOutput}`));
        }
      });
      
      childProcess.on('error', (error) => {
        logger.error(`Error: ${description}`, { error: error.message });
        reject(error);
      });
    });
  }

  /**
   * Generate unique session ID
   */
  generateSessionId() {
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString('hex');
    return `session_${timestamp}_${random}`;
  }

  /**
   * Cleanup temporary files
   */
  async cleanup(sessionId) {
    if (!sessionId) return;
    
    try {
      const patterns = [
        path.join(this.tempDir, 'downloads', `${sessionId}_*`),
        path.join(this.tempDir, 'audio', `${sessionId}_*`),
        path.join(this.tempDir, 'transcripts', `${sessionId}_*`)
      ];
      
      for (const pattern of patterns) {
        const dir = path.dirname(pattern);
        const prefix = path.basename(pattern).replace('*', '');
        
        try {
          const files = await fs.readdir(dir);
          for (const file of files) {
            if (file.startsWith(prefix.replace('*', ''))) {
              await fs.unlink(path.join(dir, file));
              logger.debug('Cleaned up file', { file: path.join(dir, file) });
            }
          }
        } catch (error) {
          // Directory might not exist, which is fine
        }
      }
      
      logger.debug('Cleanup completed', { sessionId });
      
    } catch (error) {
      logger.warn('Cleanup failed', {
        sessionId,
        error: error.message
      });
    }
  }
}

module.exports = VideoProcessor;
