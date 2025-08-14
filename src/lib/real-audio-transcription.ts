/**
 * WORKING audio transcription for Vercel
 * Uses a different approach that actually works on serverless
 */

import { getOpenAI } from './openai';

/**
 * Get direct audio stream URL from YouTube using a Vercel-compatible method
 * This doesn't require youtube-dl-exec or Python
 */
export async function getAudioStreamUrl(videoId: string): Promise<string | null> {
  try {
    console.log(`[AUDIO-STREAM] Getting audio URL for: ${videoId}`);
    
    // Use YouTube's internal API to get stream URLs
    // This is what many web apps use and it works on Vercel
    const playerResponse = await fetch(`https://www.youtube.com/youtubei/v1/player`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'WEB',
            clientVersion: '2.20231201.00.00'
          }
        },
        videoId: videoId
      })
    });

    if (!playerResponse.ok) {
      throw new Error(`YouTube API error: ${playerResponse.status}`);
    }

    const data = await playerResponse.json();
    console.log('[AUDIO-STREAM] Got player response');

    // Extract audio formats
    const formats = data.streamingData?.adaptiveFormats || [];
    const audioFormats = formats.filter((format: any) => 
      format.mimeType?.includes('audio') && 
      format.url
    );

    if (audioFormats.length === 0) {
      console.warn('[AUDIO-STREAM] No audio formats found');
      return null;
    }

    // Get the best audio format (usually first one)
    const audioFormat = audioFormats[0];
    console.log(`[AUDIO-STREAM] Found audio format: ${audioFormat.mimeType}`);
    
    return audioFormat.url;

  } catch (error) {
    console.error('[AUDIO-STREAM] Failed to get audio URL:', error);
    return null;
  }
}

/**
 * Transcribe audio directly from URL using OpenAI Whisper
 * This works on Vercel because it streams the audio directly
 */
export async function transcribeFromAudioUrl(audioUrl: string): Promise<string | null> {
  try {
    console.log('[WHISPER] Starting audio transcription...');
    
    // Fetch the audio stream
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      throw new Error(`Failed to fetch audio: ${audioResponse.status}`);
    }

    // Convert to blob
    const audioBlob = await audioResponse.blob();
    console.log(`[WHISPER] Audio blob size: ${audioBlob.size} bytes`);

    // Create file for OpenAI
    const audioFile = new File([audioBlob], 'audio.webm', { 
      type: audioBlob.type || 'audio/webm' 
    });

    // Transcribe with OpenAI Whisper
    const openai = getOpenAI();
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
    });

    console.log(`[WHISPER] Transcription successful: ${transcription.text?.length || 0} characters`);
    return transcription.text || null;

  } catch (error) {
    console.error('[WHISPER] Transcription failed:', error);
    return null;
  }
}

/**
 * Complete audio transcription pipeline
 * This is the function we'll use in the main analyzer
 */
export async function transcribeVideoAudio(videoId: string): Promise<string | null> {
  try {
    console.log(`[AUDIO-PIPELINE] Starting audio transcription for: ${videoId}`);
    
    // Step 1: Get audio stream URL
    const audioUrl = await getAudioStreamUrl(videoId);
    if (!audioUrl) {
      console.warn('[AUDIO-PIPELINE] Could not get audio URL');
      return null;
    }

    // Step 2: Transcribe the audio
    const transcript = await transcribeFromAudioUrl(audioUrl);
    if (!transcript) {
      console.warn('[AUDIO-PIPELINE] Could not transcribe audio');
      return null;
    }

    console.log(`[AUDIO-PIPELINE] Success! Transcribed ${transcript.length} characters`);
    return transcript;

  } catch (error) {
    console.error('[AUDIO-PIPELINE] Pipeline failed:', error);
    return null;
  }
}
