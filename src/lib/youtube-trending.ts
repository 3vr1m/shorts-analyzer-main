/**
 * YouTube trending content using YouTube Data API v3
 * This replaces the problematic youtube-dl-exec implementation
 */

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

export interface TrendingVideo {
  id: string;
  title: string;
  channel: string;
  views: number;
  duration: number;
  likeCount: number;
  commentCount: number;
  publishedAt: string;
  url: string;
  thumbnail: string;
  description: string;
}

export async function getYouTubeTrending(opts: {
  niche?: string;
  duration: "short" | "medium" | "long";
  max: number;
  country: string;
}): Promise<TrendingVideo[]> {
  const { niche, duration, max, country } = opts;
  
  if (!YOUTUBE_API_KEY) {
    throw new Error('YouTube API key not configured');
  }

  try {
    console.log(`[YOUTUBE-TRENDING] Fetching trending for: ${niche || 'general'} (${duration}) in ${country}`);
    
    // Build search query
    let query = '';
    if (niche && niche.trim() && niche !== 'trending') {
      query = niche.trim();
    }
    
    // Build API URL
    const baseUrl = 'https://www.googleapis.com/youtube/v3/search';
    const params = new URLSearchParams({
      part: 'snippet',
      maxResults: String(Math.min(max * 2, 50)), // Get more to filter by duration
      type: 'video',
      videoDuration: duration === 'short' ? 'short' : duration === 'medium' ? 'medium' : 'long',
      order: query ? 'relevance' : 'viewCount', // Use relevance for niche searches, viewCount for general
      regionCode: country,
      key: YOUTUBE_API_KEY
    });
    
    if (query) {
      params.set('q', query);
    }
    
    const searchUrl = `${baseUrl}?${params.toString()}`;
    console.log(`[YOUTUBE-TRENDING] Search URL: ${searchUrl.replace(YOUTUBE_API_KEY, '***')}`);
    
    // Get search results
    const searchResponse = await fetch(searchUrl);
    if (!searchResponse.ok) {
      throw new Error(`YouTube search failed: ${searchResponse.status}`);
    }
    
    const searchData = await searchResponse.json();
    const videoIds = searchData.items?.map((item: any) => item.id.videoId).filter(Boolean) || [];
    
    if (videoIds.length === 0) {
      console.log('[YOUTUBE-TRENDING] No videos found');
      return [];
    }
    
    console.log(`[YOUTUBE-TRENDING] Found ${videoIds.length} videos, getting details...`);
    
    // Get video details (views, duration, etc.)
    const detailsUrl = 'https://www.googleapis.com/youtube/v3/videos';
    const detailsParams = new URLSearchParams({
      part: 'snippet,statistics,contentDetails',
      id: videoIds.slice(0, 50).join(','), // YouTube API allows max 50 IDs
      key: YOUTUBE_API_KEY
    });
    
    const detailsResponse = await fetch(`${detailsUrl}?${detailsParams.toString()}`);
    if (!detailsResponse.ok) {
      throw new Error(`YouTube details failed: ${detailsResponse.status}`);
    }
    
    const detailsData = await detailsResponse.json();
    
    // Convert to our format
    const trendingVideos: TrendingVideo[] = detailsData.items
      ?.map((video: any) => {
        const snippet = video.snippet;
        const statistics = video.statistics;
        const contentDetails = video.contentDetails;
        
        // Parse duration (ISO 8601 format: PT4M13S)
        const durationMatch = contentDetails.duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        const hours = parseInt(durationMatch[1] || '0');
        const minutes = parseInt(durationMatch[2] || '0');
        const seconds = parseInt(durationMatch[3] || '0');
        const totalSeconds = hours * 3600 + minutes * 60 + seconds;
        
        return {
          id: video.id,
          title: snippet.title,
          channel: snippet.channelTitle,
          views: parseInt(statistics.viewCount || '0'),
          duration: totalSeconds,
          likeCount: parseInt(statistics.likeCount || '0'),
          commentCount: parseInt(statistics.commentCount || '0'),
          publishedAt: snippet.publishedAt,
          url: `https://www.youtube.com/watch?v=${video.id}`,
          thumbnail: snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || '',
          description: snippet.description
        };
      })
      .filter((video: TrendingVideo) => {
        // Filter by duration if specified
        if (duration === 'short' && video.duration > 60) return false;
        if (duration === 'medium' && (video.duration <= 60 || video.duration > 1200)) return false;
        if (duration === 'long' && video.duration <= 1200) return false;
        return true;
      })
      .sort((a: TrendingVideo, b: TrendingVideo) => b.views - a.views) // Sort by views descending
      .slice(0, max);
    
    console.log(`[YOUTUBE-TRENDING] Returning ${trendingVideos.length} videos`);
    return trendingVideos;
    
  } catch (error) {
    console.error('[YOUTUBE-TRENDING] Error:', error);
    throw error;
  }
}
