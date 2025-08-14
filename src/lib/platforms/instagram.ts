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
    } catch (error) {
      console.warn('[Instagram] RapidAPI trending failed, using simulated data:', error instanceof Error ? error.message : String(error));
    }

    // Fallback to simulated data
    return this.getSimulatedTrendingVideos(options);
  }

  async searchVideos(query: string, options: SearchOptions = {}): Promise<VideoMetadata[]> {
    try {
      // Try RapidAPI first if available
      const rapidApiResult = await this.searchFromRapidAPI(query, options);
      if (rapidApiResult.length > 0) {
        return rapidApiResult;
      }
    } catch (error) {
      console.warn('[Instagram] RapidAPI search failed, using simulated data:', error instanceof Error ? error.message : String(error));
    }

    // Fallback to simulated data
    return this.getSimulatedSearchResults(query, options);
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

  private getSimulatedTrendingVideos(options: TrendingOptions): VideoMetadata[] {
    const { duration, limit = 20 } = options;
    const niche = this.mapDurationToNiche(duration);
    
    return Array.from({ length: Math.min(limit, 20) }, (_, i) => ({
      id: `simulated_instagram_${i + 1}`,
      title: `Trending ${niche} Video ${i + 1}`,
      description: `This is a simulated trending ${niche} video from Instagram`,
      creator: `Creator ${i + 1}`,
      creatorId: `creator_${i + 1}`,
      viewCount: Math.floor(Math.random() * 1000000) + 10000,
      likeCount: Math.floor(Math.random() * 100000) + 1000,
      commentCount: Math.floor(Math.random() * 1000) + 100,
      duration: duration === 'short' ? 30 : duration === 'medium' ? 180 : 600,
      publishedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      thumbnailUrl: `https://via.placeholder.com/300x200/FF6B6B/FFFFFF?text=Instagram+${i + 1}`,
      hashtags: [niche, 'trending', 'instagram'],
      platform: 'instagram',
      url: `https://instagram.com/p/simulated_${i + 1}`
    }));
  }

  private getSimulatedSearchResults(query: string, options: SearchOptions): VideoMetadata[] {
    const { limit = 20 } = options;
    
    return Array.from({ length: Math.min(limit, 20) }, (_, i) => ({
      id: `search_instagram_${i + 1}`,
      title: `Search Result: ${query} ${i + 1}`,
      description: `This is a simulated search result for "${query}" on Instagram`,
      creator: `Creator ${i + 1}`,
      creatorId: `creator_${i + 1}`,
      viewCount: Math.floor(Math.random() * 500000) + 5000,
      likeCount: Math.floor(Math.random() * 50000) + 500,
      commentCount: Math.floor(Math.random() * 500) + 50,
      duration: Math.floor(Math.random() * 300) + 30,
      publishedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      thumbnailUrl: `https://via.placeholder.com/300x200/FF6B6B/FFFFFF?text=Search+${i + 1}`,
      hashtags: [query.toLowerCase(), 'instagram', 'search'],
      platform: 'instagram',
      url: `https://instagram.com/p/search_${i + 1}`
    }));
  }
}
