import { NextRequest, NextResponse } from 'next/server';
import { logError, logPerformance } from '@/lib/monitoring';

// Co-op service configuration
const COOP_SERVICE_URL = 'http://localhost:8080';
const COOP_API_KEY = 'dev-key-12345';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const endpoint = '/api/analyze-video';
  const method = 'GET';
  
  console.log(`[COOP-API] 🚀 ${endpoint} called with method: ${method}`);
  
  try {
    const url = new URL(request.url);
    const videoUrl = url.searchParams.get('url');

    console.log(`[COOP-API] 📹 Video URL: ${videoUrl}`);

    if (!videoUrl) {
      console.log('[COOP-API] ❌ No video URL provided');
      return NextResponse.json({
        success: false,
        error: 'Video URL is required'
      }, { status: 400 });
    }

    console.log(`[COOP-API] 🔄 Forwarding to co-op service: ${COOP_SERVICE_URL}`);
    
    // Call co-op service
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
      })
    });

    if (!coopResponse.ok) {
      throw new Error(`Co-op service error: ${coopResponse.status} ${coopResponse.statusText}`);
    }

    const coopData = await coopResponse.json();
    console.log(`[COOP-API] ✅ Co-op service response received`);

    if (!coopData.success) {
      throw new Error(coopData.error || 'Co-op service processing failed');
    }

    // Transform co-op response to match expected format
    const result = coopData.data.result;
    
    const transformedData = {
      metadata: {
        id: result.video.url.split('v=')[1]?.split('&')[0] || 'unknown',
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
    console.log(`[COOP-API] ⏱️ Total processing time: ${duration}ms`);
    
    logPerformance({
      endpoint,
      method,
      duration,
      success: true,
      platform: 'coop-service'
    });

    console.log('[COOP-API] 🎉 SUCCESS! Returning co-op processed analysis');
    return NextResponse.json({
      success: true,
      data: transformedData
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[COOP-API] ❌ Error after ${duration}ms:`, error);
    
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
      platform: 'coop-service'
    });

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      message: 'Failed to analyze video via co-op service. Please try again or contact support.'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const endpoint = '/api/analyze-video';
  const method = 'POST';
  
  console.log(`[COOP-API] 🚀 ${endpoint} called with method: ${method}`);
  
  try {
    const body = await request.json();
    const { url: videoUrl } = body;

    console.log(`[COOP-API] 📹 Video URL: ${videoUrl}`);

    if (!videoUrl) {
      console.log('[COOP-API] ❌ No video URL provided');
      return NextResponse.json({
        success: false,
        error: 'Video URL is required'
      }, { status: 400 });
    }

    console.log(`[COOP-API] 🔄 Forwarding to co-op service: ${COOP_SERVICE_URL}`);
    
    // Call co-op service
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
      })
    });

    if (!coopResponse.ok) {
      throw new Error(`Co-op service error: ${coopResponse.status} ${coopResponse.statusText}`);
    }

    const coopData = await coopResponse.json();
    console.log(`[COOP-API] ✅ Co-op service response received`);

    if (!coopData.success) {
      throw new Error(coopData.error || 'Co-op service processing failed');
    }

    // Transform co-op response to match expected format
    const result = coopData.data.result;
    
    const transformedData = {
      metadata: {
        id: result.video.url.split('v=')[1]?.split('&')[0] || 'unknown',
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
    console.log(`[COOP-API] ⏱️ Total processing time: ${duration}ms`);
    
    logPerformance({
      endpoint,
      method,
      duration,
      success: true,
      platform: 'coop-service'
    });

    console.log('[COOP-API] 🎉 SUCCESS! Returning co-op processed analysis');
    return NextResponse.json({
      success: true,
      data: transformedData
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[COOP-API] ❌ Error after ${duration}ms:`, error);
    
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
      platform: 'coop-service'
    });

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      message: 'Failed to analyze video via co-op service. Please try again or contact support.'
    }, { status: 500 });
  }
}
