// Simple YouTube API without binary dependencies for Vercel
import { VideoMetadata } from './platforms/base';
import { getYouTubeCaptions } from './youtube-captions';

export interface SimpleVideoData {
  id: string;
  title: string;
  description: string;
  channelTitle: string;
  channelId: string;
  publishedAt: string;
  viewCount: string;
  likeCount: string;
  duration: string;
  tags?: string[];
}

export function extractVideoId(url: string): string | null {
  // YouTube URL patterns
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/,
    /youtube\.com\/v\/([^&\n?#]+)/,
    /youtube\.com\/.*[?&]v=([^&\n?#]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

export async function getSimpleVideoData(videoId: string): Promise<SimpleVideoData> {
  // If we have YouTube API key, use it
  if (process.env.YOUTUBE_API_KEY) {
    try {
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${process.env.YOUTUBE_API_KEY}&part=snippet,statistics,contentDetails`
      );
      
      if (response.ok) {
        const data = await response.json();
        const video = data.items?.[0];
        
        if (video) {
          return {
            id: video.id,
            title: video.snippet.title,
            description: video.snippet.description,
            channelTitle: video.snippet.channelTitle,
            channelId: video.snippet.channelId,
            publishedAt: video.snippet.publishedAt,
            viewCount: video.statistics.viewCount || '0',
            likeCount: video.statistics.likeCount || '0',
            duration: video.contentDetails.duration,
            tags: video.snippet.tags || []
          };
        }
      }
    } catch (error) {
      console.warn('YouTube API failed, using fallback data:', error);
    }
  }

  // No fallback - if YouTube API fails, we fail
  throw new Error('YouTube API failed and no fallback data is available. Please check your YouTube API key.');
}

export async function getSimpleTranscript(videoId: string): Promise<string | null> {
  console.log(`[TRANSCRIPT] Attempting to fetch transcript for video: ${videoId}`);
  
  try {
    // Use YouTube Data API v3 for captions
    const transcript = await getYouTubeCaptions(videoId);
    
    if (transcript && transcript.length > 0) {
      console.log(`[TRANSCRIPT] Successfully extracted transcript: ${transcript.length} characters`);
      return transcript;
    } else {
      console.warn(`[TRANSCRIPT] No transcript found for video ${videoId}`);
      return null;
    }
  } catch (error) {
    console.error(`[TRANSCRIPT] Failed to extract transcript for ${videoId}:`, error);
    return null;
  }
}
