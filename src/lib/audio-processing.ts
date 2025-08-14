import { execFile } from 'child_process';
import { promisify } from 'util';
import { mkdtemp, writeFile, unlink, readdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import OpenAI from 'openai';
import { createReadStream, existsSync } from 'fs';

const execFileAsync = promisify(execFile);

// Initialize OpenAI client
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

export interface AudioResult {
  wavPath: string;
  cleanup: () => Promise<void>;
}

export interface DownloadAudioOptions {
  proxyUrl?: string;
  clientIp?: string;
}

/**
 * Downloads audio from a video URL and converts it to WAV format
 * Uses yt-dlp for video downloading and ffmpeg for audio conversion
 */
export async function downloadAudioAsWav(videoUrl: string, options: DownloadAudioOptions = {}): Promise<AudioResult> {
  try {
    // Resolve binaries and preflight check
    const ytDlpBin = process.env.YTDLP_PATH || 'yt-dlp';
    const ffmpegBin = process.env.FFMPEG_PATH || 'ffmpeg';
    const checkCmd = async (cmd: string): Promise<boolean> => {
      try {
        await execFileAsync('bash', ['-lc', `command -v ${cmd} >/dev/null 2>&1 && echo ok || true`]);
        return true;
      } catch {
        return false;
      }
    };
    const hasYtDlp = await checkCmd(ytDlpBin);
    const hasFfmpeg = await checkCmd(ffmpegBin);
    if (!hasYtDlp) {
      throw new Error('yt-dlp is not installed or not in PATH. Install with: brew install yt-dlp (macOS) or apt-get install -y yt-dlp (Linux).');
    }
    if (!hasFfmpeg) {
      throw new Error('ffmpeg is not installed or not in PATH. Install with: brew install ffmpeg (macOS) or apt-get install -y ffmpeg (Linux).');
    }

    // Create temporary directory
    const tempDir = await mkdtemp(join(tmpdir(), 'shorts-analyzer-'));
    const expectedWavPath = join(tempDir, 'audio.wav');
    
    console.log(`[AUDIO] 📁 Created temp directory: ${tempDir}`);
    console.log(`[AUDIO] 🎵 Downloading audio from: ${videoUrl}`);
    
      // Build yt-dlp args with cookies if available
      const cookiesPath = '/app/youtube-cookies.txt';
      let cookiesArg: string[] = [];
      try {
        if (existsSync(cookiesPath)) {
          const cookiesTmp = join(tempDir, 'cookies.txt');
          await writeFile(cookiesTmp, await (await import('fs/promises')).readFile(cookiesPath), { mode: 0o644 });
          cookiesArg = ['--cookies', cookiesTmp];
          console.log(`[AUDIO] 🍪 Using cookies file: ${cookiesTmp}`);
        }
      } catch (e) {
        console.warn('[AUDIO] ⚠️ Failed to prepare cookies file:', e);
      }

      const args = [
        ...cookiesArg,
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0 Safari/537.36',
        '--referer', 'https://www.youtube.com/',
        '--force-ipv4',
        '--sleep-interval', '1',
        '--max-sleep-interval', '5',
        '--retries', '3',
        '--fragment-retries', '3',
        '--extractor-args', 'youtube:player_client=android',
        '--ffmpeg-location', ffmpegBin,
        // Optional proxy – if provided, yt-dlp traffic egresses via the proxy
        ...(options.proxyUrl ? ['--proxy', options.proxyUrl] as string[] : []),
        // Add header hint for client IP (not authoritative for YouTube, but harmless)
        ...(options.clientIp ? ['--add-header', `X-Forwarded-For:${options.clientIp}`] as string[] : []),
        '--extract-audio',
        '--audio-format', 'wav',
        '--audio-quality', '0', // Best quality
        // Use template to let yt-dlp decide extension, then we normalize below
        '--output', join(tempDir, 'audio.%(ext)s'),
        '--no-playlist',
        '--quiet',
        videoUrl
      ];

      // Download audio using yt-dlp
      const { stdout, stderr } = await execFileAsync(ytDlpBin, args);
    
    if (stderr) {
      console.log(`[AUDIO] ⚠️ yt-dlp stderr: ${stderr}`);
    }
    
    // Determine the actual output file and ensure WAV is produced
    const files = await readdir(tempDir);
    const produced = files.find(f => f.startsWith('audio.'));
    if (!produced) {
      throw new Error('yt-dlp did not produce an output file');
    }
    const producedPath = join(tempDir, produced);
    let finalWavPath = expectedWavPath;
    if (!produced.endsWith('.wav')) {
      // Convert to wav using ffmpeg
      console.log('[AUDIO] 🔄 Converting to WAV via ffmpeg...');
      await execFileAsync(ffmpegBin, ['-y', '-i', producedPath, '-ac', '1', '-ar', '16000', finalWavPath]);
      console.log(`[AUDIO] ✅ Converted to WAV: ${finalWavPath}`);
    } else {
      finalWavPath = producedPath;
      console.log(`[AUDIO] ✅ Audio downloaded as WAV: ${finalWavPath}`);
    }
    
    // Cleanup function
    const cleanup = async (): Promise<void> => {
      try {
        await unlink(finalWavPath).catch(() => {});
        try { await unlink(producedPath).catch(() => {}); } catch {}
        console.log(`[AUDIO] 🧹 Cleaned up audio files in: ${tempDir}`);
      } catch (error) {
        console.error(`[AUDIO] ❌ Cleanup error:`, error);
      }
    };
    
    return {
      wavPath: finalWavPath,
      cleanup
    };
    
  } catch (error) {
    console.error(`[AUDIO] ❌ Failed to download audio:`, error);
    throw new Error(`Audio download failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Transcribes audio file using OpenAI Whisper API
 */
export async function transcribeAudio(audioPath: string): Promise<string> {
  try {
    console.log(`[TRANSCRIBE] 🗣️ Starting transcription of: ${audioPath}`);
    
    const openai = getOpenAIClient();
    
    // Read audio file as Node stream
    const fileStream = createReadStream(audioPath);

    console.log(`[TRANSCRIBE] 📤 Sending to OpenAI Whisper API...`);

    // Call OpenAI Whisper API with file stream (no FormData needed)
    const response = await openai.audio.transcriptions.create({
      file: fileStream as any,
      model: 'whisper-1',
      response_format: 'text'
    });
    
    const transcript = response as unknown as string;
    
    console.log(`[TRANSCRIBE] ✅ Transcription complete: ${transcript.length} characters`);
    console.log(`[TRANSCRIBE] 📝 Preview: ${transcript.substring(0, 100)}...`);
    
    return transcript;
    
  } catch (error) {
    console.error(`[TRANSCRIBE] ❌ Transcription failed:`, error);
    throw new Error(`Transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
