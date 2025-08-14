/**
 * YouTube captions using YouTube Data API v3
 * This replaces the problematic youtube-transcript package
 */

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

export async function getYouTubeCaptions(videoId: string): Promise<string | null> {
  if (!YOUTUBE_API_KEY) {
    console.warn('[YOUTUBE-CAPTIONS] API key not configured');
    return null;
  }

  try {
    console.log(`[YOUTUBE-CAPTIONS] Fetching captions for video: ${videoId}`);
    
    // First, get available caption tracks
    const captionsListUrl = `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}&key=${YOUTUBE_API_KEY}`;
    
    const listResponse = await fetch(captionsListUrl);
    if (!listResponse.ok) {
      console.error(`[YOUTUBE-CAPTIONS] Failed to get captions list: ${listResponse.status}`);
      return null;
    }
    
    const captionsList = await listResponse.json();
    const captionTracks = captionsList.items || [];
    
    if (captionTracks.length === 0) {
      console.log('[YOUTUBE-CAPTIONS] No caption tracks found');
      return null;
    }
    
    // Find English captions (prefer auto-generated if available)
    let captionId = null;
    for (const track of captionTracks) {
      if (track.snippet.language === 'en' || track.snippet.language === 'en-US') {
        captionId = track.id;
        break;
      }
    }
    
    // If no English, take the first available
    if (!captionId && captionTracks.length > 0) {
      captionId = captionTracks[0].id;
    }
    
    if (!captionId) {
      console.log('[YOUTUBE-CAPTIONS] No suitable caption track found');
      return null;
    }
    
    console.log(`[YOUTUBE-CAPTIONS] Using caption track: ${captionId}`);
    
    // Download the caption content
    const captionUrl = `https://www.googleapis.com/youtube/v3/captions/${captionId}?key=${YOUTUBE_API_KEY}`;
    
    const captionResponse = await fetch(captionUrl, {
      headers: {
        'Authorization': `Bearer ${YOUTUBE_API_KEY}`,
        'Accept': 'application/json'
      }
    });
    
    if (!captionResponse.ok) {
      console.error(`[YOUTUBE-CAPTIONS] Failed to download caption: ${captionResponse.status}`);
      return null;
    }
    
    const captionData = await captionResponse.json();
    
    // Parse caption content (YouTube returns XML-like format)
    const captionText = parseCaptionContent(captionData.snippet?.text || '');
    
    if (captionText) {
      console.log(`[YOUTUBE-CAPTIONS] Successfully extracted ${captionText.length} characters`);
      return captionText;
    }
    
    return null;
    
  } catch (error) {
    console.error('[YOUTUBE-CAPTIONS] Error:', error);
    return null;
  }
}

function parseCaptionContent(captionXml: string): string {
  // Simple XML parsing to extract text content
  // Remove XML tags and decode HTML entities
  let text = captionXml
    .replace(/<[^>]*>/g, ' ') // Remove XML tags
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
  
  return text;
}
