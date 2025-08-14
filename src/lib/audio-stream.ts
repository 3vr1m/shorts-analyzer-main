import { getOpenAI } from './openai';

/**
 * Stream audio directly to OpenAI Whisper without downloading to disk
 * This works on Vercel serverless functions!
 */
export async function transcribeAudioFromURL(youtubeUrl: string): Promise<string | null> {
  try {
    console.log(`[STREAM] Starting direct audio transcription for: ${youtubeUrl}`);
    
    // Get audio stream URL using youtube-dl-exec in memory only
    const youtubeDl = (await import('youtube-dl-exec')).default;
    
    // Get the audio stream URL without downloading
    const info = await youtubeDl(youtubeUrl, {
      dumpSingleJson: true,
      format: 'bestaudio[ext=m4a]', // Get direct audio stream URL
      quiet: true,
      noWarnings: true,
    });

    const audioUrl = (info as any).url;
    if (!audioUrl) {
      throw new Error('Could not get audio stream URL');
    }

    console.log(`[STREAM] Got audio stream URL, fetching...`);

    // Fetch the audio stream
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      throw new Error(`Failed to fetch audio stream: ${audioResponse.status}`);
    }

    // Convert to blob for OpenAI
    const audioBlob = await audioResponse.blob();
    
    // Create a File object for OpenAI API
    const audioFile = new File([audioBlob], 'audio.m4a', { type: 'audio/m4a' });

    console.log(`[STREAM] Sending to OpenAI Whisper...`);

    // Transcribe with OpenAI Whisper
    const openai = getOpenAI();
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
    });

    console.log(`[STREAM] Transcription successful: ${transcription.text?.length || 0} characters`);
    return transcription.text || null;

  } catch (error) {
    console.error('[STREAM] Audio transcription failed:', error);
    return null;
  }
}
