import { NextRequest, NextResponse } from 'next/server';
import { logError, logPerformance } from '@/lib/monitoring';
import { analyzeTranscript, generateIdeas } from '@/lib/analysis';
import { getSimpleVideoData, getSimpleTranscript, extractVideoId } from '@/lib/youtube-simple';
import { downloadAudioAsWav } from '@/lib/ytdlp';
import { transcribeAudio } from '@/lib/audio-processing';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const endpoint = '/api/analyze-video';
  const method = 'GET';
  
  console.log(`[DEBUG-API] 🚀 ${endpoint} called with method: ${method}`);
  
  try {
    const url = new URL(request.url);
    const videoUrl = url.searchParams.get('url');
    const providedTranscript = url.searchParams.get('transcript');

    console.log(`[DEBUG-API] 📹 Video URL: ${videoUrl}`);
    console.log(`[DEBUG-API] 📝 Provided transcript: ${providedTranscript ? 'YES' : 'NO'}`);

    if (!videoUrl) {
      console.log('[DEBUG-API] ❌ No video URL provided');
      return NextResponse.json({
        success: false,
        error: 'Video URL is required'
      }, { status: 400 });
    }

    console.log(`[DEBUG-API] 🔍 Extracting video ID from: ${videoUrl}`);
    const videoId = extractVideoId(videoUrl);
    if (!videoId) { 
      console.log('[DEBUG-API] ❌ Invalid YouTube URL format');
      throw new Error('Invalid YouTube URL format'); 
    }
    console.log(`[DEBUG-API] ✅ Video ID extracted: ${videoId}`);

    console.log(`[DEBUG-API] 📊 Getting video metadata for: ${videoId}`);
    const videoData = await getSimpleVideoData(videoId);
    const metadata = {
      id: videoData.id,
      title: videoData.title,
      channel: videoData.channelTitle,
      uploader: videoData.channelTitle,
      views: parseInt(videoData.viewCount) || 0,
      published: videoData.publishedAt,
      duration: videoData.duration
    };
    console.log(`[DEBUG-API] ✅ Metadata obtained: ${metadata.title} by ${metadata.channel} (${metadata.views} views)`);

    // If transcript is provided directly, use it
    let transcript: string | null = null;
    if (providedTranscript) {
      console.log(`[DEBUG-API] 📝 Using provided transcript (${providedTranscript.length} characters)`);
      transcript = providedTranscript;
    } else {
      console.log('[DEBUG-API] 🔍 Fetching transcript from YouTube...');
      transcript = await getSimpleTranscript(videoId);
      console.log(`[DEBUG-API] 📝 Transcript result: ${transcript ? `${transcript.length} characters` : 'NOT FOUND'}`);
    }
    
    // If no transcript found, download audio and transcribe
    if (!transcript) {
      console.log('[DEBUG-API] 🎯 No transcript found, downloading audio for transcription...');
      
      try {
        // Download audio from video using our mobile anti-bot strategy
        console.log('[DEBUG-API] 🎵 Downloading audio from video...');
        const audioResult = await downloadAudioAsWav(videoUrl);
        console.log(`[DEBUG-API] ✅ Audio downloaded to: ${audioResult.wavPath}`);
        
        // Transcribe audio using OpenAI Whisper
        console.log('[DEBUG-API] 🗣️ Transcribing audio with OpenAI Whisper...');
        transcript = await transcribeAudio(audioResult.wavPath);
        console.log(`[DEBUG-API] ✅ Audio transcription complete: ${transcript?.length || 0} characters`);
        
        // Clean up temporary files
        await audioResult.cleanup();
        console.log('[DEBUG-API] 🧹 Temporary files cleaned up');
        
        if (!transcript) {
          throw new Error('Audio transcription failed - no transcript generated');
        }
      } catch (audioError) {
        console.error('[DEBUG-API] ❌ Audio processing failed:', audioError);
        
        // Return helpful error message
        return NextResponse.json({
          success: false,
          error: 'Audio processing failed',
          message: `This video "${metadata.title}" doesn't have captions and audio transcription failed. Please try a different video or contact support.`,
          details: audioError instanceof Error ? audioError.message : 'Unknown audio processing error'
        }, { status: 400 });
      }
    }

    console.log(`[DEBUG-API] ✅ Transcript ready (${transcript.length} characters)`);

    // Check environment variables
    console.log('[DEBUG-API] 🔑 Checking environment variables...');
    console.log('[DEBUG-API] 🔑 OPENAI_API_KEY present:', !!process.env.OPENAI_API_KEY);
    console.log('[DEBUG-API] 🔑 NODE_ENV:', process.env.NODE_ENV);
    
    if (!process.env.OPENAI_API_KEY) {
      console.log('[DEBUG-API] ❌ Missing OPENAI_API_KEY');
      throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.');
    }

    // Analyze the transcript
    console.log('[DEBUG-API] 🧠 Starting transcript analysis with OpenAI...');
    const analysis = await analyzeTranscript(transcript, {
      title: metadata.title,
      channel: metadata.channel,
      views: metadata.views
    });
    console.log(`[DEBUG-API] ✅ Analysis complete:`, Object.keys(analysis));

    // Generate content ideas
    console.log('[DEBUG-API] 💡 Generating content ideas...');
    const ideas = await generateIdeas(analysis);
    console.log(`[DEBUG-API] ✅ Generated ${ideas.length} ideas`);

    const result = {
      metadata,
      transcript,
      analysis,
      ideas
    };

    const duration = Date.now() - startTime;
    console.log(`[DEBUG-API] ⏱️ Total processing time: ${duration}ms`);
    
    logPerformance({
      endpoint,
      method,
      duration,
      success: true,
      platform: 'youtube'
    });

    console.log('[DEBUG-API] 🎉 SUCCESS! Returning complete analysis');
    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[DEBUG-API] ❌ Error after ${duration}ms:`, error);
    
    // Log the error
    logError({
      endpoint,
      method,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      ip: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown'
    });

    logPerformance({
      endpoint,
      method,
      duration,
      success: false,
      platform: 'youtube'
    });

    // Return error response
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      message: 'Failed to analyze video. Please try again or contact support.'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const endpoint = '/api/analyze-video';
  const method = 'POST';
  
  console.log(`[DEBUG-API] 🚀 ${endpoint} called with method: ${method}`);
  
  try {
    const body = await request.json();
    const { url: videoUrl } = body;

    console.log(`[DEBUG-API] 📹 Video URL: ${videoUrl}`);

    if (!videoUrl) {
      console.log('[DEBUG-API] ❌ No video URL provided');
      return NextResponse.json({
        success: false,
        error: 'Video URL is required'
      }, { status: 400 });
    }

    console.log(`[DEBUG-API] 🔍 Extracting video ID from: ${videoUrl}`);
    const videoId = extractVideoId(videoUrl);
    if (!videoId) { 
      console.log('[DEBUG-API] ❌ Invalid YouTube URL format');
      throw new Error('Invalid YouTube URL format'); 
    }
    console.log(`[DEBUG-API] ✅ Video ID extracted: ${videoId}`);

    console.log(`[DEBUG-API] 📊 Getting video metadata for: ${videoId}`);
    const videoData = await getSimpleVideoData(videoId);
    const metadata = {
      id: videoData.id,
      title: videoData.title,
      channel: videoData.channelTitle,
      uploader: videoData.channelTitle,
      views: parseInt(videoData.viewCount) || 0,
      published: videoData.publishedAt,
      duration: videoData.duration
    };
    console.log(`[DEBUG-API] ✅ Metadata obtained: ${metadata.title} by ${metadata.channel} (${metadata.views} views)`);

    // Try to get transcript first
    console.log('[DEBUG-API] 🔍 Fetching transcript from YouTube...');
    let transcript = await getSimpleTranscript(videoId);
    console.log(`[DEBUG-API] 📝 Transcript result: ${transcript ? `${transcript.length} characters` : 'NOT FOUND'}`);
    
    // If no transcript found, download audio and transcribe
    if (!transcript) {
      console.log('[DEBUG-API] 🎯 No transcript found, downloading audio for transcription...');
      
      try {
        // Download audio from video using our mobile anti-bot strategy
        console.log('[DEBUG-API] 🎵 Downloading audio from video...');
        const audioResult = await downloadAudioAsWav(videoUrl);
        console.log(`[DEBUG-API] ✅ Audio downloaded to: ${audioResult.wavPath}`);
        
        // Transcribe audio using OpenAI Whisper
        console.log('[DEBUG-API] 🗣️ Transcribing audio with OpenAI Whisper...');
        transcript = await transcribeAudio(audioResult.wavPath);
        console.log(`[DEBUG-API] ✅ Audio transcription complete: ${transcript?.length || 0} characters`);
        
        // Clean up temporary files
        await audioResult.cleanup();
        console.log('[DEBUG-API] 🧹 Temporary files cleaned up');
        
        if (!transcript) {
          throw new Error('Audio transcription failed - no transcript generated');
        }
      } catch (audioError) {
        console.error('[DEBUG-API] ❌ Audio processing failed:', audioError);
        
        // Return helpful error message
        return NextResponse.json({
          success: false,
          error: 'Audio processing failed',
          message: `This video "${metadata.title}" doesn't have captions and audio transcription failed. Please try a different video or contact support.`,
          details: audioError instanceof Error ? audioError.message : 'Unknown audio processing error'
        }, { status: 400 });
      }
    }

    console.log(`[DEBUG-API] ✅ Transcript ready (${transcript.length} characters)`);

    // Check environment variables
    console.log('[DEBUG-API] 🔑 Checking environment variables...');
    console.log('[DEBUG-API] 🔑 OPENAI_API_KEY present:', !!process.env.OPENAI_API_KEY);
    console.log('[DEBUG-API] 🔑 NODE_ENV:', process.env.NODE_ENV);
    
    if (!process.env.OPENAI_API_KEY) {
      console.log('[DEBUG-API] ❌ Missing OPENAI_API_KEY');
      throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.');
    }

    // Analyze the transcript
    console.log('[DEBUG-API] 🧠 Starting transcript analysis with OpenAI...');
    const analysis = await analyzeTranscript(transcript, {
      title: metadata.title,
      channel: metadata.channel,
      views: metadata.views
    });
    console.log(`[DEBUG-API] ✅ Analysis complete:`, Object.keys(analysis));

    // Generate content ideas
    console.log('[DEBUG-API] 💡 Generating content ideas...');
    const ideas = await generateIdeas(analysis);
    console.log(`[DEBUG-API] ✅ Generated ${ideas.length} ideas`);

    const result = {
      metadata,
      transcript,
      analysis,
      ideas
    };

    const duration = Date.now() - startTime;
    console.log(`[DEBUG-API] ⏱️ Total processing time: ${duration}ms`);
    
    logPerformance({
      endpoint,
      method,
      duration,
      success: true,
      platform: 'youtube'
    });

    console.log('[DEBUG-API] 🎉 SUCCESS! Returning complete analysis');
    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[DEBUG-API] ❌ Error after ${duration}ms:`, error);
    
    // Log the error
    logError({
      endpoint,
      method,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      ip: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown'
    });

    logPerformance({
      endpoint,
      method,
      duration,
      success: false,
      platform: 'youtube'
    });

    // Return error response
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      message: 'Failed to analyze video. Please try again or contact support.'
    }, { status: 500 });
  }
}
