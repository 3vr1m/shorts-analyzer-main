import { NextRequest, NextResponse } from 'next/server';
import { logError, logPerformance } from '@/lib/monitoring';

// Co-op service configuration - YOUR LOCAL MACHINE
const COOP_SERVICE_URL = 'http://83.27.41.204:8080';
const COOP_API_KEY = 'dev-key-12345';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const endpoint = '/api/analyze-video';
  const method = 'GET';
  
  console.log(`[COOP-LOCAL] 🚀 ${endpoint} called - forwarding to German IP: ${COOP_SERVICE_URL}`);
  
  try {
    const url = new URL(request.url);
    const videoUrl = url.searchParams.get('url');

    if (!videoUrl) {
      return NextResponse.json({
        success: false,
        error: 'Video URL is required'
      }, { status: 400 });
    }

    console.log(`[COOP-LOCAL] 📹 Processing video: ${videoUrl}`);
    console.log(`[COOP-LOCAL] 🇩🇪 Calling German local machine: ${COOP_SERVICE_URL}`);
    
    // Call YOUR local German machine
    const coopResponse = await fetch(`${COOP_SERVICE_URL}/api/process-video`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': COOP_API_KEY
      },
      body: JSON.stringify({
        videoUrl: videoUrl,
        options: {
          includeTranscript: true,
          includeAnalysis: true
        }
      }),
      
    });

    if (!coopResponse.ok) {
      throw new Error(`Local co-op service error: ${coopResponse.status} ${coopResponse.statusText}`);
    }

    const coopData = await coopResponse.json();
    
    if (!coopData.success) {
      throw new Error(coopData.error || 'Local co-op processing failed');
    }

    // Transform response to match expected format
    const result = coopData.data.result;
    
    const transformedData = {
      metadata: {
        id: result.video.id,
        title: result.video.title,
        channel: result.video.uploader,
        uploader: result.video.uploader,
        views: result.video.view_count || 0,
        likes: result.video.like_count || 0,
        published: result.video.upload_date,
        duration: result.video.duration
      },
      transcript: result.transcript.text,
      analysis: {
        summary: result.analysis.summary || 'Analysis completed',
        ...result.analysis
      },
      ideas: result.analysis.optimization_suggestions || []
    };

    const duration = Date.now() - startTime;
    console.log(`[COOP-LOCAL] ✅ SUCCESS! German processing complete in ${duration}ms`);
    
    logPerformance({
      endpoint,
      method,
      duration,
      success: true,
      platform: 'german-local-coop'
    });

    return NextResponse.json({
      success: true,
      data: transformedData
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[COOP-LOCAL] ❌ Error after ${duration}ms:`, error);
    
    logError({
      endpoint,
      method,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      ip: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown'
    });

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      message: 'Failed to process video via German local service. Please ensure local co-op service is running.'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const endpoint = '/api/analyze-video';
  const method = 'POST';
  
  console.log(`[COOP-LOCAL] 🚀 ${endpoint} POST - forwarding to German IP: ${COOP_SERVICE_URL}`);
  
  try {
    const body = await request.json();
    const { url: videoUrl } = body;

    if (!videoUrl) {
      return NextResponse.json({
        success: false,
        error: 'Video URL is required'
      }, { status: 400 });
    }

    console.log(`[COOP-LOCAL] 📹 Processing video: ${videoUrl}`);
    console.log(`[COOP-LOCAL] 🇩🇪 Calling German local machine: ${COOP_SERVICE_URL}`);
    
    // Call YOUR local German machine
    const coopResponse = await fetch(`${COOP_SERVICE_URL}/api/process-video`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': COOP_API_KEY
      },
      body: JSON.stringify({
        videoUrl: videoUrl,
        options: {
          includeTranscript: true,
          includeAnalysis: true
        }
      }),
      
    });

    if (!coopResponse.ok) {
      throw new Error(`Local co-op service error: ${coopResponse.status} ${coopResponse.statusText}`);
    }

    const coopData = await coopResponse.json();
    
    if (!coopData.success) {
      throw new Error(coopData.error || 'Local co-op processing failed');
    }

    // Transform response
    const result = coopData.data.result;
    
    const transformedData = {
      metadata: {
        id: result.video.id,
        title: result.video.title,
        channel: result.video.uploader,
        uploader: result.video.uploader,
        views: result.video.view_count || 0,
        likes: result.video.like_count || 0,
        published: result.video.upload_date,
        duration: result.video.duration
      },
      transcript: result.transcript.text,
      analysis: {
        summary: result.analysis.summary || 'Analysis completed',
        ...result.analysis
      },
      ideas: result.analysis.optimization_suggestions || []
    };

    const duration = Date.now() - startTime;
    console.log(`[COOP-LOCAL] ✅ SUCCESS! German processing complete in ${duration}ms`);
    
    return NextResponse.json({
      success: true,
      data: transformedData
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[COOP-LOCAL] ❌ Error:`, error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      message: 'Failed to process video via German local service. Please ensure local co-op service is running.'
    }, { status: 500 });
  }
}
