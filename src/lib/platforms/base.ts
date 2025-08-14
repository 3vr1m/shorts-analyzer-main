// Base platform interface for multi-platform support
export type Platform = 'youtube' | 'instagram' | 'tiktok' | 'twitter';

export interface VideoMetadata {
  id: string;
  platform: Platform;
  title: string;
  creator: string; // More generic than "channel"
  creatorId?: string;
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
  publishedAt?: string;
  duration?: number;
  description?: string;
  hashtags?: string[];
  url: string;
  thumbnailUrl?: string;
}

export interface DownloadResult {
  audioPath: string;
  cleanup: () => Promise<void>;
}

export interface PlatformAdapter {
  readonly platform: Platform;
  
  // Core functionality
  canHandle(url: string): boolean;
  extractVideoId(url: string): string | null;
  getMetadata(url: string): Promise<VideoMetadata>;
  downloadAudio(url: string): Promise<DownloadResult>;
  
  // Platform-specific features
  getTrendingVideos?(options: TrendingOptions): Promise<VideoMetadata[]>;
  searchVideos?(query: string, options: SearchOptions): Promise<VideoMetadata[]>;
}

export interface TrendingOptions {
  country?: string;
  category?: string;
  limit?: number;
  duration?: 'short' | 'medium' | 'long';
}

export interface SearchOptions {
  limit?: number;
  sortBy?: 'relevance' | 'date' | 'views';
  duration?: 'short' | 'medium' | 'long';
}

// Platform detection utilities
export function detectPlatform(url: string): Platform | null {
  const urlLower = url.toLowerCase();
  
  if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) {
    return 'youtube';
  }
  if (urlLower.includes('instagram.com')) {
    return 'instagram';
  }
  if (urlLower.includes('tiktok.com')) {
    return 'tiktok';
  }
  if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) {
    return 'twitter';
  }
  
  return null;
}

export function generateCacheKey(platform: Platform, videoId: string): string {
  return `${platform}:${videoId}`;
}
