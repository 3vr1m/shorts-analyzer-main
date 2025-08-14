import { NextRequest, NextResponse } from 'next/server';
import { checkAssemblyAIStatus } from '@/lib/assemblyai';

export async function GET(request: NextRequest) {
  console.log('[DEBUG-CHECK] 🚀 check-transcription endpoint called');
  
  try {
    const url = new URL(request.url);
    const transcriptId = url.searchParams.get('id');

    console.log(`[DEBUG-CHECK] 📝 Transcript ID: ${transcriptId}`);

    if (!transcriptId) {
      console.log('[DEBUG-CHECK] ❌ Missing transcript ID');
      return NextResponse.json({
        success: false,
        error: 'Missing transcript ID'
      }, { status: 400 });
    }

    console.log(`[DEBUG-CHECK] 🔍 Checking AssemblyAI status for: ${transcriptId}`);

    let status;
    try {
      status = await checkAssemblyAIStatus(transcriptId);
      console.log(`[DEBUG-CHECK] ✅ AssemblyAI status check successful:`, status);
    } catch (assemblyError) {
      console.error('[DEBUG-CHECK] ❌ AssemblyAI status check failed:', assemblyError);
      
      // Return a more specific error instead of 500
      return NextResponse.json({
        success: false,
        status: 'error',
        error: `AssemblyAI status check failed: ${assemblyError instanceof Error ? assemblyError.message : 'Unknown error'}`,
        message: 'Transcription service temporarily unavailable. Please try again in a few minutes.'
      }, { status: 200 }); // Use 200 instead of 500 to avoid frontend errors
    }
    
    if (!status) {
      console.log('[DEBUG-CHECK] ❌ No status returned from AssemblyAI');
      return NextResponse.json({
        success: false,
        status: 'unknown',
        error: 'No status information available',
        message: 'Transcription status unknown. Please try again.'
      }, { status: 200 }); // Use 200 instead of 500
    }

    if (status.status === 'completed' && status.text) {
      console.log(`[DEBUG-CHECK] 🎉 Transcription completed! Text length: ${status.text.length}`);
      return NextResponse.json({
        success: true,
        status: 'completed',
        transcript: status.text,
        message: 'Transcription completed successfully!'
      });
    } else if (status.status === 'error') {
      console.log(`[DEBUG-CHECK] ❌ Transcription error: ${status.error}`);
      return NextResponse.json({
        success: false,
        status: 'error',
        error: status.error || 'Transcription failed',
        message: 'Transcription failed. Please try a different video.'
      }, { status: 200 }); // Use 200 instead of 500
    } else {
      console.log(`[DEBUG-CHECK] ⏳ Transcription in progress: ${status.status}`);
      return NextResponse.json({
        success: true,
        status: status.status,
        message: `Transcription is ${status.status}. Please wait...`
      });
    }

  } catch (error) {
    console.error('[DEBUG-CHECK] ❌ Unexpected error:', error);
    return NextResponse.json({
      success: false,
      status: 'error',
      error: 'Unexpected error occurred',
      details: error instanceof Error ? error.message : 'Unknown error',
      message: 'Something went wrong. Please try again.'
    }, { status: 200 }); // Use 200 instead of 500
  }
}
