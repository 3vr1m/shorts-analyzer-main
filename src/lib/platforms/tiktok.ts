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

export class TikTokAdapter implements PlatformAdapter {
  readonly platform: Platform = 'tiktok';

  canHandle(url: string): boolean {
    return url.toLowerCase().includes('tiktok.com');
  }

  extractVideoId(url: string): string | null {
    // TikTok URL patterns
    const patterns = [
      /tiktok\.com\/.*\/video\/([0-9]+)/,
      /tiktok\.com\/@[^\/]+\/video\/([0-9]+)/,
      /vm\.tiktok\.com\/([a-zA-Z0-9]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  async getMetadata(url: string): Promise<VideoMetadata> {
    try {
      // TikTok metadata extraction using yt-dlp (supports TikTok)
      const { stdout } = await execFileAsync("yt-dlp", ["-J", url]);
      const json = JSON.parse(stdout);
      
      return {
        id: json.id || this.extractVideoId(url) || '',
        platform: 'tiktok',
        title: json.title || json.description || 'TikTok Video',
        creator: json.uploader || json.creator || '',
        creatorId: json.uploader_id || json.channel_id,
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
    } catch (error) {
      console.warn('TikTok yt-dlp failed, using fallback:', error);
      return await this.getMetadataFallback(url);
    }
  }

  async downloadAudio(url: string): Promise<DownloadResult> {
    const tmp = await mkdtemp(join(tmpdir(), "shorts-analyzer-tiktok-"));
    const outTemplate = join(tmp, "%(id)s.%(ext)s");
    
    try {
      // TikTok audio extraction with yt-dlp
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
        
      if (!wav) throw new Error("No wav file found");
      const audioPath = join(tmp, wav);

      const cleanup = async () => {
        try {
          await access(tmp).then(async () => {
            await rm(tmp, { recursive: true, force: true });
          });
        } catch {}
      };

      return { audioPath, cleanup };
      
    } catch (error) {
      // Clean up temp directory on failure
      try {
        await rm(tmp, { recursive: true, force: true });
      } catch {}
      
      throw new Error(`TikTok audio download failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Enhanced TikTok trending with simulated data
  async getTrendingVideos(options: TrendingOptions = {}): Promise<VideoMetadata[]> {
    try {
      // Try to get real trending data if we have API access
      const apiResult = await this.getTrendingFromAPI(options);
      if (apiResult.length > 0) {
        return apiResult;
      }
    } catch (error) {
      console.warn('TikTok API trending failed, using simulated data:', error);
    }

    // Fallback to realistic simulated trending data
    return this.getSimulatedTrendingVideos(options);
  }

  // New: Search videos support
  async searchVideos(query: string, options: SearchOptions = {}): Promise<VideoMetadata[]> {
    try {
      // Try to get real search results if we have API access
      const apiResult = await this.searchFromAPI(query, options);
      if (apiResult.length > 0) {
        return apiResult;
      }
    } catch (error) {
      console.warn('TikTok API search failed, using simulated data:', error);
    }

    // Fallback to realistic simulated search results
    return this.getSimulatedSearchResults(query, options);
  }

  private async getTrendingFromAPI(options: TrendingOptions): Promise<VideoMetadata[]> {
    // This would integrate with TikTok APIs when available
    // For now, return empty array to trigger fallback
    return [];
  }

  private async searchFromAPI(query: string, options: SearchOptions): Promise<VideoMetadata[]> {
    // This would integrate with TikTok search APIs when available
    // For now, return empty array to trigger fallback
    return [];
  }

  private getSimulatedTrendingVideos(options: TrendingOptions): VideoMetadata[] {
    // Generate realistic simulated TikTok trending data
    const niches = ['dance', 'comedy', 'food', 'fitness', 'beauty', 'gaming', 'education', 'lifestyle'];
    const creators = ['tiktok_dancer', 'funny_creator', 'chef_tiktok', 'fit_life', 'beauty_guru', 'gamer_pro', 'edu_tok', 'lifestyle_vibes'];
    const hashtags = ['#fyp', '#foryou', '#trending', '#viral', '#tiktok', '#shorts'];
    
    return Array.from({ length: options.limit || 15 }, (_, i) => {
      const niche = niches[i % niches.length];
      const creator = creators[i % creators.length];
      const isShort = options.duration === 'short' || (!options.duration && Math.random() > 0.3);
      const duration = isShort ? Math.floor(Math.random() * 30) + 15 : Math.floor(Math.random() * 180) + 60;
      
      return {
        id: `tt_${Date.now()}_${i}`,
        platform: 'tiktok',
        title: `${niche.charAt(0).toUpperCase() + niche.slice(1)} TikTok that's going viral! #${i + 1}`,
        creator: creator,
        creatorId: `creator_${i}`,
        viewCount: Math.floor(Math.random() * 5000000) + 100000,
        likeCount: Math.floor(Math.random() * 200000) + 5000,
        commentCount: Math.floor(Math.random() * 10000) + 200,
        publishedAt: new Date(Date.now() - Math.random() * 48 * 60 * 60 * 1000).toISOString(),
        duration: duration,
        description: `Amazing ${niche} content that's trending on TikTok right now! ${hashtags.slice(0, 3).join(' ')}`,
        hashtags: [niche, ...hashtags.slice(0, 3)],
        url: `https://tiktok.com/@${creator}/video/tt_${i}`,
        thumbnailUrl: `https://picsum.photos/300/400?random=${i + 200}`,
      };
    });
  }

  private getSimulatedSearchResults(query: string, options: SearchOptions): VideoMetadata[] {
    // Generate realistic simulated TikTok search results
    const creators = ['search_creator_1', 'search_creator_2', 'search_creator_3', 'search_creator_4'];
    const niches = ['dance', 'comedy', 'food', 'fitness', 'beauty', 'gaming'];
    
    return Array.from({ length: options.limit || 10 }, (_, i) => {
      const niche = niches[i % niches.length];
      const creator = creators[i % creators.length];
      
      return {
        id: `search_tt_${Date.now()}_${i}`,
        platform: 'tiktok',
        title: `Search result for "${query}" - ${niche} content #${i + 1}`,
        creator: creator,
        creatorId: `search_creator_${i}`,
        viewCount: Math.floor(Math.random() * 1000000) + 5000,
        likeCount: Math.floor(Math.random() * 50000) + 100,
        commentCount: Math.floor(Math.random() * 2000) + 20,
        publishedAt: new Date(Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000).toISOString(),
        duration: Math.floor(Math.random() * 120) + 15,
        description: `TikTok content related to "${query}" - great ${niche} find! #search #${query.replace(/\s+/g, '')} #${niche}`,
        hashtags: [query.replace(/\s+/g, ''), niche, 'search', 'related'],
        url: `https://tiktok.com/@${creator}/video/search_tt_${i}`,
        thumbnailUrl: `https://picsum.photos/300/400?random=${i + 300}`,
      };
    });
  }

  private async getMetadataFallback(url: string): Promise<VideoMetadata> {
    const videoId = this.extractVideoId(url) || 'unknown';
    
    return {
      id: videoId,
      platform: 'tiktok',
      title: 'TikTok Video',
      creator: 'Unknown',
      url,
      hashtags: [],
    };
  }

  private extractHashtags(text: string): string[] {
    const hashtags = text.match(/#[a-zA-Z0-9_]+/g) || [];
    return hashtags.map(tag => tag.toLowerCase());
  }
}
