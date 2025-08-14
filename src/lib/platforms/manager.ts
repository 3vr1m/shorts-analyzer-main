import { 
  PlatformAdapter, 
  VideoMetadata, 
  DownloadResult, 
  Platform,
  TrendingOptions,
  SearchOptions,
  detectPlatform,
  generateCacheKey
} from './base';
import { YouTubeAdapter } from './youtube';
import { InstagramAdapter } from './instagram';
import { TikTokAdapter } from './tiktok';

export class PlatformManager {
  private adapters: Map<Platform, PlatformAdapter> = new Map();

  constructor() {
    // Register all platform adapters
    this.registerAdapter(new YouTubeAdapter());
    this.registerAdapter(new InstagramAdapter());
    this.registerAdapter(new TikTokAdapter());
  }

  private registerAdapter(adapter: PlatformAdapter): void {
    this.adapters.set(adapter.platform, adapter);
  }

  public getAdapter(platform: Platform): PlatformAdapter | null {
    return this.adapters.get(platform) || null;
  }

  public getAdapterForUrl(url: string): PlatformAdapter | null {
    // First try platform detection
    const platform = detectPlatform(url);
    if (platform) {
      return this.getAdapter(platform);
    }

    // Fallback: check each adapter individually
    for (const adapter of this.adapters.values()) {
      if (adapter.canHandle(url)) {
        return adapter;
      }
    }

    return null;
  }

  public async getVideoMetadata(url: string): Promise<VideoMetadata> {
    const adapter = this.getAdapterForUrl(url);
    if (!adapter) {
      throw new Error(`No adapter found for URL: ${url}`);
    }

    return await adapter.getMetadata(url);
  }

  public async downloadAudio(url: string): Promise<DownloadResult> {
    const adapter = this.getAdapterForUrl(url);
    if (!adapter) {
      throw new Error(`No adapter found for URL: ${url}`);
    }

    return await adapter.downloadAudio(url);
  }

  public generateUnifiedCacheKey(url: string): string | null {
    const adapter = this.getAdapterForUrl(url);
    if (!adapter) return null;

    const videoId = adapter.extractVideoId(url);
    if (!videoId) return null;

    return generateCacheKey(adapter.platform, videoId);
  }

  public getSupportedPlatforms(): Platform[] {
    return Array.from(this.adapters.keys());
  }

  public isPlatformSupported(platform: Platform): boolean {
    return this.adapters.has(platform);
  }

  public isUrlSupported(url: string): boolean {
    return this.getAdapterForUrl(url) !== null;
  }

  // New: Cross-platform trending videos
  public async getTrendingVideos(options: TrendingOptions & { platforms?: Platform[] } = {}): Promise<VideoMetadata[]> {
    const targetPlatforms = options.platforms || this.getSupportedPlatforms();
    const allResults: VideoMetadata[] = [];

    for (const platform of targetPlatforms) {
      const adapter = this.getAdapter(platform);
      if (adapter && adapter.getTrendingVideos) {
        try {
          const platformResults = await adapter.getTrendingVideos(options);
          allResults.push(...platformResults);
        } catch (error) {
          console.warn(`Failed to get trending videos for ${platform}:`, error);
        }
      }
    }

    // Sort by engagement (views + likes + comments) and limit results
    const sortedResults = allResults
      .sort((a, b) => {
        const engagementA = (a.viewCount || 0) + (a.likeCount || 0) + (a.commentCount || 0);
        const engagementB = (b.viewCount || 0) + (b.likeCount || 0) + (b.commentCount || 0);
        return engagementB - engagementA;
      })
      .slice(0, options.limit || 50);

    return sortedResults;
  }

  // New: Cross-platform video search
  public async searchVideos(query: string, options: SearchOptions & { platforms?: Platform[] } = {}): Promise<VideoMetadata[]> {
    const targetPlatforms = options.platforms || this.getSupportedPlatforms();
    const allResults: VideoMetadata[] = [];

    for (const platform of targetPlatforms) {
      const adapter = this.getAdapter(platform);
      if (adapter && adapter.searchVideos) {
        try {
          const platformResults = await adapter.searchVideos(query, options);
          allResults.push(...platformResults);
        } catch (error) {
          console.warn(`Failed to search videos for ${platform}:`, error);
        }
      }
    }

    // Sort by relevance and limit results
    const sortedResults = allResults
      .sort((a, b) => {
        // Simple relevance scoring based on title match and engagement
        const titleMatchA = a.title.toLowerCase().includes(query.toLowerCase()) ? 1 : 0;
        const titleMatchB = b.title.toLowerCase().includes(query.toLowerCase()) ? 1 : 0;
        const engagementA = (a.viewCount || 0) + (a.likeCount || 0);
        const engagementB = (b.viewCount || 0) + (b.likeCount || 0);
        
        if (titleMatchA !== titleMatchB) return titleMatchB - titleMatchA;
        return engagementB - engagementA;
      })
      .slice(0, options.limit || 50);

    return sortedResults;
  }

  // New: Get trending videos for specific platform
  public async getPlatformTrendingVideos(platform: Platform, options: TrendingOptions = {}): Promise<VideoMetadata[]> {
    const adapter = this.getAdapter(platform);
    if (!adapter || !adapter.getTrendingVideos) {
      throw new Error(`Platform ${platform} does not support trending videos`);
    }

    return await adapter.getTrendingVideos(options);
  }

  // New: Search videos on specific platform
  public async searchPlatformVideos(platform: Platform, query: string, options: SearchOptions = {}): Promise<VideoMetadata[]> {
    const adapter = this.getAdapter(platform);
    if (!adapter || !adapter.searchVideos) {
      throw new Error(`Platform ${platform} does not support video search`);
    }

    return await adapter.searchVideos(query, options);
  }

  // New: Get platform statistics
  public getPlatformStats(): Record<Platform, { supported: boolean; hasTrending: boolean; hasSearch: boolean }> {
    const stats: Record<Platform, { supported: boolean; hasTrending: boolean; hasSearch: boolean }> = {} as any;
    
    for (const platform of this.getSupportedPlatforms()) {
      const adapter = this.getAdapter(platform);
      if (adapter) {
        stats[platform] = {
          supported: true,
          hasTrending: !!adapter.getTrendingVideos,
          hasSearch: !!adapter.searchVideos
        };
      }
    }

    return stats;
  }
}

// Singleton instance
export const platformManager = new PlatformManager();
