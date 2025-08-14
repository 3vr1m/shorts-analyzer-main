import { execFile } from "node:child_process";
import { promisify } from "util";
import { mkdtemp, rm, access } from "node:fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { 
  PlatformAdapter, 
  VideoMetadata, 
  DownloadResult, 
  TrendingOptions, 
  SearchOptions,
  Platform 
} from './base';

const execFileAsync = promisify(execFile);

export class YouTubeAdapter implements PlatformAdapter {
  readonly platform: Platform = 'youtube';

  canHandle(url: string): boolean {
    const urlLower = url.toLowerCase();
    return urlLower.includes('youtube.com') || urlLower.includes('youtu.be');
  }

  extractVideoId(url: string): string | null {
    // YouTube video ID extraction
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  async getMetadata(url: string): Promise<VideoMetadata> {
    const { stdout } = await execFileAsync("yt-dlp", ["-J", url]);
    const json = JSON.parse(stdout);
    
    return {
      id: json.id,
      platform: 'youtube',
      title: json.title || '',
      creator: json.channel || json.uploader || json.uploader_id || '',
      creatorId: json.channel_id || json.uploader_id,
      viewCount: json.view_count,
      likeCount: json.like_count,
      commentCount: json.comment_count,
      publishedAt: json.upload_date,
      duration: json.duration,
      description: json.description,
      hashtags: this.extractHashtags(json.description || json.title || ''),
      url: json.webpage_url || url,
      thumbnailUrl: json.thumbnail,
    };
  }

  async downloadAudio(url: string): Promise<DownloadResult> {
    const tmp = await mkdtemp(join(tmpdir(), "shorts-analyzer-youtube-"));
    const outTemplate = join(tmp, "%(id)s.%(ext)s");
    
    // Extract best audio to wav using yt-dlp + ffmpeg
    await execFileAsync("yt-dlp", [
      url,
      "-x",
      "--audio-format",
      "wav",
      "-o",
      outTemplate,
      "--no-playlist",
      "--quiet",
      "--no-warnings",
    ]);

    // Find the downloaded wav file
    const { stdout } = await execFileAsync("/bin/ls", [tmp]);
    const wav = stdout
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.endsWith(".wav"))[0];
      
    if (!wav) throw new Error("Failed to locate downloaded wav file");
    const audioPath = join(tmp, wav);

    const cleanup = async () => {
      try {
        await access(tmp).then(async () => {
          await rm(tmp, { recursive: true, force: true });
        });
      } catch {}
    };

    return { audioPath, cleanup };
  }

  // Trending functionality using dedicated YouTube trending API
  async getTrendingVideos(options: TrendingOptions = {}): Promise<VideoMetadata[]> {
    try {
      // For internal API calls, we need to use the full URL or import the function directly
      // Since this is running on the server side, we'll import and call the function directly
      const { getYouTubeTrending } = await import('../youtube-trending');
      const results = await getYouTubeTrending({
        niche: options.category || 'trending',
        duration: options.duration || 'short',
        max: options.limit || 20,
        country: options.country || 'US'
      });
      
      // Transform the results to match VideoMetadata interface
      return results.map((item: any) => ({
        id: item.id,
        title: item.title,
        creator: item.channel || 'Unknown',
        creatorId: undefined, // Not available from yt-dlp
        viewCount: item.views || 0,
        likeCount: item.likeCount || 0,
        commentCount: item.commentCount || 0,
        publishedAt: item.publishedAt || new Date().toISOString(),
        duration: item.durationSeconds || 0,
        description: '', // Not available from yt-dlp
        hashtags: [],
        url: item.url,
        thumbnailUrl: undefined, // Not available from yt-dlp
        platform: 'youtube' as const
      }));
    } catch (error) {
      console.error('Failed to fetch YouTube trending videos:', error);
      throw error;
    }
  }

  // New: Search videos support
  async searchVideos(query: string, options: SearchOptions = {}): Promise<VideoMetadata[]> {
    try {
      // Use our existing YouTube search functionality
      const params = new URLSearchParams({
        q: query,
        max: String(options.limit || 20),
        sortBy: options.sortBy || 'relevance',
        duration: options.duration || 'any',
      });

      const response = await fetch(`http://localhost:3000/api/ytsearch?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to search YouTube videos');
      
      const data = await response.json();
      
      return (data.items || []).map((item: any) => ({
        id: item.id,
        platform: 'youtube' as Platform,
        title: item.title,
        creator: item.channel,
        creatorId: item.channelId,
        viewCount: item.viewCount,
        likeCount: item.likeCount,
        commentCount: item.commentCount,
        publishedAt: item.publishedAt,
        duration: item.duration,
        description: item.description,
        hashtags: this.extractHashtags(item.description || item.title || ''),
        url: item.url,
        thumbnailUrl: item.thumbnail,
      }));
    } catch (error) {
      console.warn('Failed to search YouTube videos:', error);
      return [];
    }
  }

  private extractHashtags(text: string): string[] {
    const hashtags = text.match(/#[a-zA-Z0-9_]+/g) || [];
    return hashtags.map(tag => tag.toLowerCase());
  }
}
