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

export class InstagramAdapter implements PlatformAdapter {
  readonly platform: Platform = 'instagram';
  readonly canHandleUrls = [
    /^https?:\/\/(www\.)?instagram\.com\/(p|reel|tv)\/[^\/\?]+/,
    /^https?:\/\/(www\.)?instagram\.com\/reels\/[^\/\?]+/,
  ];

  canHandle(url: string): boolean {
    return this.canHandleUrls.some(pattern => pattern.test(url));
  }

  extractVideoId(url: string): string | null {
    const match = url.match(/\/(p|reel|tv|reels)\/([^\/\?]+)/);
    return match ? match[2] : null;
  }

  async getMetadata(url: string): Promise<VideoMetadata> {
    try {
      // Try RapidAPI first if available
      const rapidApiResult = await this.getMetadataFromRapidAPI(url);
      if (rapidApiResult) {
        return rapidApiResult;
      }
    } catch (error) {
      console.warn('[Instagram] RapidAPI failed, falling back to yt-dlp:', error instanceof Error ? error.message : String(error));
    }

    // Fallback to yt-dlp
    try {
      const { stdout } = await execFileAsync('yt-dlp', [
        '--dump-json',
        '--no-playlist',
        url
      ]);

      const data = JSON.parse(stdout);
      
      return {
        id: data.id || this.extractVideoId(url) || 'unknown',
        title: data.title || 'Instagram Video',
        description: data.description || '',
        creator: data.uploader || 'Unknown Creator',
        creatorId: data.uploader_id || '',
        viewCount: data.view_count || 0,
        likeCount: data.like_count || 0,
        commentCount: data.comment_count || 0,
        duration: data.duration || 0,
        publishedAt: data.upload_date || new Date().toISOString(),
        thumbnailUrl: data.thumbnail || '',
        hashtags: data.tags || [],
        platform: 'instagram',
        url: url
      };
    } catch (error) {
      console.error('[Instagram] Failed to get metadata:', error instanceof Error ? error.message : String(error));
      throw new Error(`Failed to get Instagram metadata: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async downloadAudio(url: string): Promise<DownloadResult> {
    const tempDir = await mkdtemp(join(tmpdir(), 'instagram-'));
    const outputPath = join(tempDir, 'audio.mp3');

    try {
      const { stdout } = await execFileAsync('yt-dlp', [
        '--extract-audio',
        '--audio-format', 'mp3',
        '--audio-quality', '0',
        '--output', outputPath,
        '--no-playlist',
        url
      ]);

      // Verify file exists and has content
      await access(outputPath);
      
      return {
        audioPath: outputPath,
        cleanup: () => rm(tempDir, { recursive: true, force: true })
      };
    } catch (error) {
      // Cleanup on error
      await rm(tempDir, { recursive: true, force: true });
      throw new Error(`Failed to download Instagram audio: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getTrendingVideos(options: TrendingOptions = {}): Promise<VideoMetadata[]> {
    try {
      // Try RapidAPI first if available
      const rapidApiResult = await this.getTrendingFromRapidAPI(options);
      if (rapidApiResult.length > 0) {
        return rapidApiResult;
      }
      throw new Error('No trending videos found via RapidAPI. Please check your API configuration.');
    } catch (error) {
      console.error('[Instagram] RapidAPI trending failed:', error instanceof Error ? error.message : String(error));
      throw new Error(`Instagram trending failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async searchVideos(query: string, options: SearchOptions = {}): Promise<VideoMetadata[]> {
    try {
      // Try RapidAPI first if available
      const rapidApiResult = await this.searchFromRapidAPI(query, options);
      if (rapidApiResult.length > 0) {
        return rapidApiResult;
      }
      throw new Error('No search results found via RapidAPI. Please check your API configuration.');
    } catch (error) {
      console.error('[Instagram] RapidAPI search failed:', error instanceof Error ? error.message : String(error));
      throw new Error(`Instagram search failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async getMetadataFromRapidAPI(url: string): Promise<VideoMetadata | null> {
    // Placeholder for RapidAPI integration
    // This would normally call the RapidAPI Instagram endpoint
    return null;
  }

  private async getTrendingFromRapidAPI(options: TrendingOptions): Promise<VideoMetadata[]> {
    // Placeholder for RapidAPI trending integration
    // This would normally call the RapidAPI Instagram trending endpoint
    return [];
  }

  private async searchFromRapidAPI(query: string, options: SearchOptions): Promise<VideoMetadata[]> {
    // Placeholder for RapidAPI search integration
    // This would normally call the RapidAPI Instagram search endpoint
    return [];
  }

  private mapDurationToNiche(duration?: 'short' | 'medium' | 'long'): string {
    switch (duration) {
      case 'short': return 'entertainment';
      case 'medium': return 'education';
      case 'long': return 'documentary';
      default: return 'entertainment';
    }
  }

  // Simulated data methods removed - only real API calls allowed in production
}
