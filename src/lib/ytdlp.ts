import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm, access, open } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const execFileAsync = promisify(execFile);

// Mobile user agents are less scrutinized than desktop ones
const MOBILE_USER_AGENTS = [
  // iOS Safari (most trusted)
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  
  // Android Chrome (very common)
  "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
  
  // Android Samsung Internet
  "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Mobile Safari/537.36"
];

// Realistic mobile headers to look more human
const MOBILE_HEADERS = [
  "Accept-Language: en-US,en;q=0.9",
  "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Encoding: gzip, deflate, br",
  "DNT: 1",
  "Connection: keep-alive",
  "Upgrade-Insecure-Requests: 1"
];

function getRandomMobileUserAgent(): string {
  return MOBILE_USER_AGENTS[Math.floor(Math.random() * MOBILE_USER_AGENTS.length)];
}

function getRandomMobileHeaders(): string[] {
  // Randomly select 3-4 headers to vary the request pattern
  const shuffled = [...MOBILE_HEADERS].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 3 + Math.floor(Math.random() * 2));
}

// More realistic rate limiting for mobile users
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 3000 + Math.random() * 2000; // 3-5 seconds between requests

async function mobileRateLimit(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    console.log(`[MOBILE_RATE_LIMIT] Waiting ${waitTime}ms to mimic human mobile user`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  lastRequestTime = Date.now();
}

export type VideoMetadata = {
  id: string;
  title: string;
  channel: string;
  uploader?: string;
  view_count?: number;
  upload_date?: string;
  duration?: number;
};

export async function getVideoInfo(url: string): Promise<VideoMetadata> {
  await mobileRateLimit();
  
  const userAgent = getRandomMobileUserAgent();
  const headers = getRandomMobileHeaders();
  
  const args = ["-J", url, "--user-agent", userAgent];
  
  // Add mobile headers
  headers.forEach(header => {
    args.push("--add-header", header);
  });
  
  console.log(`[MOBILE_ANTI_BOT] Using mobile user-agent: ${userAgent.substring(0, 60)}...`);
  console.log(`[MOBILE_ANTI_BOT] Added ${headers.length} mobile headers`);
  
  const { stdout } = await execFileAsync("yt-dlp", args);
  const json = JSON.parse(stdout);
  const md: VideoMetadata = {
    id: json.id,
    title: json.title,
    channel: json.channel || json.uploader || json.uploader_id || "",
    uploader: json.uploader,
    view_count: json.view_count,
    upload_date: json.upload_date,
    duration: json.duration,
  };
  return md;
}

export async function extractSubtitles(url: string): Promise<string | null> {
  await mobileRateLimit();
  
  let tmp: string | null = null;
  let cleanup: (() => Promise<void>) | null = null;
  
  try {
    tmp = await mkdtemp(join(tmpdir(), "shorts-analyzer-subs-"));
    cleanup = async () => {
      if (tmp) {
        try {
          await access(tmp);
          await rm(tmp, { recursive: true, force: true });
        } catch (error) {
          console.log(`[CLEANUP] Failed to remove subtitle temp dir ${tmp}:`, error);
        }
        tmp = null;
      }
    };

    const userAgent = getRandomMobileUserAgent();
    const headers = getRandomMobileHeaders();
    
    console.log(`[MOBILE_ANTI_BOT] Using mobile user-agent: ${userAgent.substring(0, 60)}...`);

    // Try to extract subtitles in multiple languages with priority order
    // Priority: auto-generated > manual > any available
    const subtitleArgs = [
      url,
      "--write-subs",
      "--write-auto-subs", 
      "--sub-langs", "en.*,auto,live_chat,-live_chat", // English preference, then auto
      "--skip-download",
      "--no-playlist",
      "-o", join(tmp, "%(title)s.%(ext)s"),
      "--quiet",
      "--no-warnings",
      "--user-agent", userAgent
    ];
    
    // Add mobile headers
    headers.forEach(header => {
      subtitleArgs.push("--add-header", header);
    });
    
    await execFileAsync("yt-dlp", subtitleArgs);
    
    // List files to find subtitle files
    const { stdout } = await execFileAsync("/bin/ls", ["-la", tmp]);
    const lines = stdout.split("\n").filter(line => line.includes(".vtt") || line.includes(".srt"));
    
    if (lines.length > 0) {
      // Find the best subtitle file (prefer .en.vtt or .en.srt)
      const files = lines.map(line => {
        const parts = line.trim().split(/\s+/);
        return parts[parts.length - 1]; // filename is last part
      }).filter(f => f.endsWith('.vtt') || f.endsWith('.srt'));
      
      // Prefer English subtitles, then auto-generated, then any
      const preferredFile = files.find(f => f.includes('.en.')) || 
                           files.find(f => f.includes('auto')) ||
                           files[0];
      
      if (preferredFile) {
        const { readFile } = await import("node:fs/promises");
        const subtitlePath = join(tmp, preferredFile);
        const content = await readFile(subtitlePath, "utf-8");
        
        // Parse VTT or SRT content to extract text only
        const cleanedContent = parseSubtitleContent(content);
        console.log(`[SUBTITLES] Successfully extracted subtitles from ${preferredFile}`);
        
        await cleanup();
        return cleanedContent;
      }
    }
    
    await cleanup();
    return null;
  } catch (error) {
    if (cleanup) await cleanup();
    console.log(`[SUBTITLES] Failed to extract subtitles:`, error);
    return null;
  }
}

function parseSubtitleContent(content: string): string {
  // Remove VTT/SRT formatting and extract plain text
  let lines = content.split('\n');
  
  // Filter out metadata, timestamps, and formatting
  const textLines = lines
    .filter(line => {
      const trimmed = line.trim();
      // Skip empty lines
      if (!trimmed) return false;
      // Skip VTT headers
      if (trimmed.startsWith('WEBVTT') || trimmed.startsWith('NOTE')) return false;
      // Skip SRT numbering
      if (/^\d+$/.test(trimmed)) return false;
      // Skip timestamp lines
      if (/\d{2}:\d{2}:\d{2}/.test(trimmed)) return false;
      // Skip style tags
      if (trimmed.startsWith('<') && trimmed.endsWith('>')) return false;
      return true;
    })
    .map(line => {
      // Clean up HTML tags and formatting
      return line
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/\[.*?\]/g, '') // Remove [music], [applause] etc
        .replace(/\{.*?\}/g, '') // Remove {style} tags
        .trim();
    })
    .filter(line => line.length > 0);
  
  return textLines.join(' ');
}

export async function downloadAudioAsWav(url: string): Promise<{ wavPath: string; cleanup: () => Promise<void> }> {
  await mobileRateLimit();
  
  let tmp: string | null = null;
  let wavPath: string | null = null;
  
  const cleanup = async () => {
    if (tmp) {
      try {
        // Force close any open file handles
        try {
          await access(tmp);
          // Try to remove the directory and all contents
          await rm(tmp, { recursive: true, force: true });
        } catch (error) {
          console.log(`[CLEANUP] Failed to remove audio temp dir ${tmp}:`, error);
          // If rm fails, try to close any open file descriptors
          try {
            const { readdir } = await import("node:fs/promises");
            const files = await readdir(tmp);
            for (const file of files) {
              try {
                const filePath = join(tmp, file);
                const fd = await open(filePath, 'r');
                await fd.close();
              } catch {}
            }
          } catch {}
        }
      } catch (error) {
        console.log(`[CLEANUP] Audio cleanup failed for ${tmp}:`, error);
      }
      tmp = null;
    }
  };

  try {
    tmp = await mkdtemp(join(tmpdir(), "shorts-analyzer-"));
    const outTemplate = join(tmp, "%(id)s.%(ext)s");
    
    const userAgent = getRandomMobileUserAgent();
    const headers = getRandomMobileHeaders();
    
    console.log(`[MOBILE_ANTI_BOT] Using mobile user-agent: ${userAgent.substring(0, 60)}...`);
    
    // Extract best audio to wav using yt-dlp + ffmpeg (ffmpeg is used internally by yt-dlp)
    const audioArgs = [
      url,
      "-x",
      "--audio-format",
      "wav",
      "-o",
      outTemplate,
      "--no-playlist",
      "--quiet",
      "--no-warnings",
      "--user-agent", userAgent
    ];
    
    // Add mobile headers
    headers.forEach(header => {
      audioArgs.push("--add-header", header);
    });
    
    await execFileAsync("yt-dlp", audioArgs);

    // We don't know the id yet reliably here; list directory and find .wav
    const { stdout } = await execFileAsync("/bin/ls", [tmp]);
    const wav = stdout
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.endsWith(".wav"))[0];
      
    if (!wav) {
      await cleanup();
      throw new Error("Failed to locate downloaded wav file");
    }
    
    wavPath = join(tmp, wav);

    return { 
      wavPath, 
      cleanup: async () => {
        await cleanup();
      }
    };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
