import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Check environment variables
    const envCheck = {
      OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
      YOUTUBE_API_KEY: !!process.env.YOUTUBE_API_KEY,
      GEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
      RAPIDAPI_KEY: !!process.env.RAPIDAPI_KEY,
      NODE_ENV: process.env.NODE_ENV,
    };

    // Check if basic imports work
    let importStatus = 'ok';
    try {
      // Test basic imports
      const { extractVideoId } = await import('@/lib/youtube-simple');
      const testId = extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      importStatus = testId === 'dQw4w9WgXcQ' ? 'ok' : 'failed';
    } catch (error) {
      importStatus = `failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }

    const testResult = {
      status: 'test_complete',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      environmentVariables: envCheck,
      importTest: importStatus,
      message: 'Basic functionality test completed'
    };

    return NextResponse.json(testResult, { status: 200 });
  } catch (error) {
    return NextResponse.json({
      status: 'test_failed',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
