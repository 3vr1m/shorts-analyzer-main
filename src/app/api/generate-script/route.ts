import { NextRequest, NextResponse } from 'next/server';
import { logError, logPerformance } from '@/lib/monitoring';
import { generateScript } from '@/lib/gemini';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const endpoint = '/api/generate-script';
  const method = 'GET';
  
  try {
    const url = new URL(request.url);
    const niche = url.searchParams.get('niche') || '';
    const topic = url.searchParams.get('topic') || '';
    const style = url.searchParams.get('style') || 'engaging';

    if (!niche || !topic) {
      const duration = Date.now() - startTime;
      logPerformance({
        endpoint,
        method,
        duration,
        success: false
      });

      return NextResponse.json(
        { success: false, error: 'Niche and topic are required' },
        { status: 400 }
      );
    }

    console.log(`Script generation request: ${niche} - ${topic}`);

    // Generate the script using Gemini
    const script = await generateScript(niche, topic);

    const duration = Date.now() - startTime;
    logPerformance({
      endpoint,
      method,
      duration,
      success: true,
      platform: 'gemini'
    });

    // Return shape expected by frontend (script at top-level)
    return NextResponse.json({
      success: true,
      script
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    
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
      success: false
    });

    console.error('Script generation error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to generate script',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
