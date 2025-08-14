# RapidAPI Instagram Integration

This guide explains how to integrate real Instagram data into your Shorts Analyzer using RapidAPI services.

## 🚀 Quick Setup

### 1. Get RapidAPI Key
1. Sign up at [RapidAPI.com](https://rapidapi.com) (free tier available)
2. Subscribe to one of the Instagram APIs:
   - **Instagram Data API** - $0.001/call (recommended for beginners)
   - **Instagram Bulk Profile Data** - $0.002/call (best balance)
   - **Instagram Private API** - $0.005/call (most features)

### 2. Environment Configuration
Add your RapidAPI keys to `.env.local`:

#### Single API Key (Basic)
```env
RAPIDAPI_KEY=your_actual_rapidapi_key_here
```

#### Multiple API Keys (Recommended for Reliability)
```env
# Primary API key (used first)
RAPIDAPI_KEY=your_primary_rapidapi_key_here

# Fallback keys (used if primary fails)
RAPIDAPI_KEY_FALLBACK=your_fallback_rapidapi_key_here
RAPIDAPI_KEY_SECONDARY=your_secondary_rapidapi_key_here  
RAPIDAPI_KEY_BACKUP=your_backup_rapidapi_key_here
```

**💡 Pro Tip:** Using multiple keys provides automatic failover if one key hits rate limits or has issues.

### 3. Usage in Code
```typescript
import { createRapidAPIInstagramService } from '@/lib/rapidapi-instagram';
import { getRapidAPIKeyFromEnv } from '@/lib/rapidapi-config';

// Simple usage
const apiKey = getRapidAPIKeyFromEnv() || 'demo-key';
const service = createRapidAPIInstagramService(apiKey);

const result = await service.getTrendingContent({
  region: 'US',
  maxResults: 20,
  niche: 'cooking'
});

console.log(`Found ${result.items.length} trending posts`);
console.log(`Cost: $${result.cost.estimated} ${result.cost.currency}`);
```

## 📊 Available Metrics

### ✅ Reliable Metrics
- **Views** - Video/reel view counts
- **Likes** - Post like counts  
- **Comments** - Comment counts
- **Creator Info** - Username, display name, follower count

### ❌ Limited Metrics
- **Shares** - Not available via Instagram APIs (will be estimated)

## 💰 Cost Breakdown

| Service | Cost per Call | Free Tier | Best For |
|---------|---------------|-----------|----------|
| Instagram Data API | $0.001 | 500 calls/month | Budget-conscious users |
| Bulk Profile Data | $0.002 | 1000 calls/month | **Recommended balance** |
| Private API | $0.005 | 200 calls/month | Advanced analytics |

### Cost Examples:
- **10 calls/day** = ~$0.60/month (Bulk Profile Data)
- **50 calls/day** = ~$3.00/month (Bulk Profile Data)
- **100 calls/day** = ~$6.00/month (Bulk Profile Data)

## 🔧 Configuration Options

### Service Selection
```typescript
import { getRecommendedService } from '@/lib/rapidapi-config';

// Get service based on budget
const budgetService = getRecommendedService('low');    // $0.001/call
const balancedService = getRecommendedService('medium'); // $0.002/call  
const premiumService = getRecommendedService('high');   // $0.005/call
```

### Rate Limiting
```typescript
const service = new RapidAPIInstagramService({
  apiKey: 'your-key',
  maxRequestsPerMinute: 60 // Conservative limit
});
```

## 📝 API Response Transformation

The service automatically handles different API response formats:

```typescript
// Different APIs return data in different structures:
// Instagram Data API: { data: { posts: [...] } }
// Bulk Profile API: { result: [...] }  
// Generic APIs: [...] or { items: [...] }

// All are transformed to consistent InstagramTrendItem format
const transformedData = {
  id: 'unique-post-id',
  url: 'https://instagram.com/p/shortcode/',
  type: 'reel' | 'post' | 'story',
  title: 'Derived from caption',
  caption: 'Full post caption',
  hashtags: ['extracted', 'from', 'caption'],
  creator: {
    username: 'creator_handle',
    displayName: 'Display Name',
    verified: false,
    followerCount: 100000
  },
  metrics: {
    views: 1200000,
    likes: 50000,
    comments: 2500,
    shares: 4000,    // Estimated (8% of engagement)
    plays: 1200000   // Same as views for video
  },
  media: {
    thumbnail: 'https://...',
    videoUrl: 'https://...',
    duration: 30
  },
  publishedAt: '2024-01-15T10:30:00Z',
  region: 'US',
  trendScore: 87.5  // 0-100 calculated score
}
```

## 🎯 Trend Scoring Algorithm

The service calculates trend scores based on available metrics:

```typescript
// Trend Score Calculation (0-100)
const trendScore = calculateTrendScore({
  views: 1200000,
  likes: 50000,
  comments: 2500, 
  shares: 4000,    // Estimated if unavailable
  ageHours: 6      // Time since published
});

// Components:
// 1. Share Velocity (30 points) - shares per hour
// 2. Engagement Rate (25 points) - (likes + comments) / views
// 3. Recency Multiplier - 1.5x for <6hrs, 1.3x for <12hrs
```

## 🛠️ Development & Testing

### Using Demo Mode
Without a real API key, the service will use simulated data:

```typescript
const service = createRapidAPIInstagramService('demo-key');
// Returns realistic sample data for development
```

### Error Handling
The service includes robust error handling:

```typescript
try {
  const result = await service.getTrendingContent(options);
} catch (error) {
  // Handles rate limits, invalid keys, API errors
  // Falls back to simulated data when possible
  console.error('API Error:', error.message);
}
```

## 📋 API Service Comparison

### Instagram Data API (instagram-data1.p.rapidapi.com)
- **Best for:** Hashtag-based trending discovery  
- **Strength:** Cheapest option, good for basic needs
- **Limitation:** Limited post data per call

### Instagram Bulk Profile Data (instagram-bulk-profile-data.p.rapidapi.com)  
- **Best for:** Comprehensive data with good cost/feature balance
- **Strength:** Rich engagement metrics, profile data
- **Limitation:** Higher cost than basic API

### Social Media Video Downloader (social-media-video-downloader.p.rapidapi.com)
- **Best for:** Multi-platform support
- **Strength:** Video metadata, cross-platform
- **Limitation:** More expensive, less Instagram-specific

### Instagram Private API (instagram-private-api2.p.rapidapi.com)
- **Best for:** Advanced real-time analytics
- **Strength:** Most comprehensive data, real-time updates
- **Limitation:** Most expensive option

## ⚠️ Important Limitations

1. **Share Counts:** Instagram doesn't provide public share count APIs
   - Our system estimates shares as ~8% of total engagement
   - This is a conservative industry-standard estimate

2. **Rate Limits:** Respect API provider limits
   - Typically 60-1000 calls per minute depending on service
   - Built-in rate limiting prevents overages

3. **Data Freshness:** API data is typically 5-30 minutes behind real-time

4. **Geographic Limitations:** Some APIs may have regional restrictions

## 🔗 Alternative Approaches

If RapidAPI doesn't meet your needs:

1. **Instagram Basic Display API** - Official but limited to user's own content
2. **Web Scraping** - Violates Instagram ToS, not recommended
3. **Mock Data** - Use our simulated data for development/testing
4. **Manual Curation** - Manually input trending content URLs

## 📞 Support & Troubleshooting

### Common Issues:
- **403 Errors:** Invalid API key or subscription needed
- **429 Errors:** Rate limit exceeded, wait before retrying  
- **Empty Results:** Check API endpoint and parameters
- **High Costs:** Optimize call frequency and caching

### Getting Help:
- Check [RapidAPI documentation](https://rapidapi.com/hub) for specific APIs
- Review service logs for detailed error messages
- Use demo mode during development to avoid charges
