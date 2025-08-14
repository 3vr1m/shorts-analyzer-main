/**
 * RapidAPI Configuration & Setup
 * 
 * Configuration management for RapidAPI Instagram integration
 */

export interface RapidAPIServiceConfig {
  name: string;
  host: string;
  endpoint: string;
  costPerCall: number;
  description: string;
  supportsMetrics: {
    views: boolean;
    likes: boolean;
    comments: boolean;
    shares: boolean;
  };
}

/**
 * Available RapidAPI Instagram services with their capabilities
 */
export const INSTAGRAM_RAPIDAPI_SERVICES: RapidAPIServiceConfig[] = [
  {
    name: 'Instagram Data API',
    host: 'instagram-data1.p.rapidapi.com',
    endpoint: '/hashtag/top',
    costPerCall: 0.001,
    description: 'Best for hashtag-based trending discovery with reliable engagement metrics',
    supportsMetrics: {
      views: true,
      likes: true,
      comments: true,
      shares: false // Instagram doesn't expose share counts publicly
    }
  },
  {
    name: 'Instagram Bulk Profile Data',
    host: 'instagram-bulk-profile-data.p.rapidapi.com',
    endpoint: '/trending',
    costPerCall: 0.002,
    description: 'Comprehensive profile and post data with engagement analytics',
    supportsMetrics: {
      views: true,
      likes: true,
      comments: true,
      shares: false
    }
  },
  {
    name: 'Social Media Video Downloader',
    host: 'social-media-video-downloader.p.rapidapi.com',
    endpoint: '/smvd/get/all',
    costPerCall: 0.003,
    description: 'Multi-platform content access with video metadata',
    supportsMetrics: {
      views: true,
      likes: true,
      comments: true,
      shares: false
    }
  },
  {
    name: 'Instagram Private API',
    host: 'instagram-private-api2.p.rapidapi.com',
    endpoint: '/trending',
    costPerCall: 0.005,
    description: 'Advanced real-time data with premium analytics',
    supportsMetrics: {
      views: true,
      likes: true,
      comments: true,
      shares: false
    }
  }
];

/**
 * Get the recommended RapidAPI service based on requirements
 */
export function getRecommendedService(
  budget: 'free' | 'low' | 'medium' | 'high' = 'medium'
): RapidAPIServiceConfig {
  switch (budget) {
    case 'free':
    case 'low':
      return INSTAGRAM_RAPIDAPI_SERVICES[0]; // Instagram Data API (cheapest)
    case 'medium':
      return INSTAGRAM_RAPIDAPI_SERVICES[1]; // Bulk Profile Data (good balance)
    case 'high':
      return INSTAGRAM_RAPIDAPI_SERVICES[3]; // Private API (most features)
    default:
      return INSTAGRAM_RAPIDAPI_SERVICES[0];
  }
}

/**
 * Validate RapidAPI key format
 */
export function isValidRapidAPIKey(apiKey: string): boolean {
  if (!apiKey) return false;
  
  // RapidAPI keys are typically 50+ characters long and contain letters/numbers
  if (apiKey.length < 20) return false;
  if (apiKey === 'demo-key' || apiKey === 'your-rapidapi-key') return false;
  
  // Should contain alphanumeric characters
  const keyPattern = /^[a-zA-Z0-9]+$/;
  return keyPattern.test(apiKey.replace(/[-_]/g, ''));
}

/**
 * Setup instructions for RapidAPI
 */
export const RAPIDAPI_SETUP_INSTRUCTIONS = {
  title: 'How to Set Up Instagram Data Access via RapidAPI',
  steps: [
    {
      step: 1,
      title: 'Create RapidAPI Account',
      description: 'Sign up at https://rapidapi.com (free tier available)',
      details: '• Free tier: 500-1000 API calls/month\n• Paid plans start at $10/month for more calls'
    },
    {
      step: 2,
      title: 'Subscribe to Instagram Data API',
      description: 'Search for "Instagram Data API" and subscribe to the free or paid plan',
      details: '• Free tier: 500 calls/month\n• Basic plan: $10/month for 10,000 calls\n• Pro plan: $25/month for 50,000 calls'
    },
    {
      step: 3,
      title: 'Get Your API Key',
      description: 'Copy your RapidAPI key from the API dashboard',
      details: '• Located in the "X-RapidAPI-Key" header section\n• Keep this key secure and private'
    },
    {
      step: 4,
      title: 'Add to Environment Variables',
      description: 'Add your API key to .env.local file',
      details: 'RAPIDAPI_KEY=your_actual_api_key_here'
    }
  ],
  costs: {
    freeUsage: 'Up to 1000 calls/month across all RapidAPI services',
    paidUsage: '$0.001 - $0.005 per API call depending on service',
    monthlyPlans: 'Most APIs offer monthly plans starting at $10-25/month'
  },
  limitations: {
    shares: 'Instagram share counts are not available via public APIs',
    rateLimits: 'Rate limits vary by service (typically 60-1000 calls/minute)',
    dataFreshness: 'Data is typically 5-30 minutes behind real-time'
  },
  alternatives: {
    officialAPI: 'Instagram Basic Display API (limited to user\'s own content)',
    webScraping: 'Custom scraping solution (violates ToS, not recommended)',
    mockData: 'Use simulated trending data for development/testing'
  }
};

/**
 * Environment variable configuration with multiple API key support
 */
export interface RapidAPIKeys {
  primary?: string;
  fallback?: string;
  secondary?: string;
  backup?: string;
}

export function getRapidAPIKeysFromEnv(): RapidAPIKeys {
  if (typeof process !== 'undefined' && process.env) {
    return {
      primary: process.env.RAPIDAPI_KEY || process.env.NEXT_PUBLIC_RAPIDAPI_KEY || undefined,
      fallback: process.env.RAPIDAPI_KEY_FALLBACK || process.env.NEXT_PUBLIC_RAPIDAPI_KEY_FALLBACK || undefined,
      secondary: process.env.RAPIDAPI_KEY_SECONDARY || process.env.NEXT_PUBLIC_RAPIDAPI_KEY_SECONDARY || undefined,
      backup: process.env.RAPIDAPI_KEY_BACKUP || process.env.NEXT_PUBLIC_RAPIDAPI_KEY_BACKUP || undefined
    };
  }
  return {};
}

/**
 * Get the first available valid API key
 */
export function getFirstValidAPIKey(): string | null {
  const keys = getRapidAPIKeysFromEnv();
  const allKeys = [keys.primary, keys.fallback, keys.secondary, keys.backup].filter(Boolean);
  
  for (const key of allKeys) {
    if (key && isValidRapidAPIKey(key)) {
      return key;
    }
  }
  
  return null;
}

/**
 * Get all valid API keys for rotation/fallback
 */
export function getAllValidAPIKeys(): string[] {
  const keys = getRapidAPIKeysFromEnv();
  const allKeys = [keys.primary, keys.fallback, keys.secondary, keys.backup]
    .filter(Boolean)
    .filter(key => key && isValidRapidAPIKey(key)) as string[];
  
  return allKeys;
}

/**
 * Legacy function for backward compatibility
 */
export function getRapidAPIKeyFromEnv(): string | null {
  return getFirstValidAPIKey();
}

/**
 * Cost estimation for API usage
 */
export function estimateAPICost(
  service: RapidAPIServiceConfig,
  callsPerDay: number,
  daysPerMonth: number = 30
): {
  dailyCost: number;
  monthlyCost: number;
  annualCost: number;
} {
  const monthlyCalls = callsPerDay * daysPerMonth;
  const monthlyCost = monthlyCalls * service.costPerCall;
  
  return {
    dailyCost: callsPerDay * service.costPerCall,
    monthlyCost,
    annualCost: monthlyCost * 12
  };
}

/**
 * Get current API key status and configuration
 */
export function getAPIKeyStatus(): {
  hasKeys: boolean;
  keyCount: number;
  keys: {
    primary: boolean;
    fallback: boolean;
    secondary: boolean;
    backup: boolean;
  };
  summary: string;
} {
  const keys = getRapidAPIKeysFromEnv();
  const validKeys = getAllValidAPIKeys();
  
  return {
    hasKeys: validKeys.length > 0,
    keyCount: validKeys.length,
    keys: {
      primary: !!(keys.primary && isValidRapidAPIKey(keys.primary)),
      fallback: !!(keys.fallback && isValidRapidAPIKey(keys.fallback)),
      secondary: !!(keys.secondary && isValidRapidAPIKey(keys.secondary)),
      backup: !!(keys.backup && isValidRapidAPIKey(keys.backup))
    },
    summary: validKeys.length === 0 
      ? '❌ No valid API keys configured. Using demo data only.'
      : `✅ ${validKeys.length} valid API key${validKeys.length === 1 ? '' : 's'} configured with automatic fallback support.`
  };
}

/**
 * Get service status and recommendations
 */
export function getServiceRecommendations(): {
  recommended: RapidAPIServiceConfig;
  budget: RapidAPIServiceConfig;
  premium: RapidAPIServiceConfig;
  summary: string;
} {
  return {
    recommended: INSTAGRAM_RAPIDAPI_SERVICES[1], // Bulk Profile Data
    budget: INSTAGRAM_RAPIDAPI_SERVICES[0],      // Instagram Data API
    premium: INSTAGRAM_RAPIDAPI_SERVICES[3],     // Private API
    summary: `
📊 **Metrics Available:** Views, Likes, Comments (reliable)
❌ **Shares:** Not available via Instagram APIs (will be estimated)
💰 **Cost:** $0.001-$0.005 per call depending on service
🎯 **Recommended:** Instagram Bulk Profile Data for best balance of cost/features

⚠️ **Important:** Instagram doesn't provide share counts via public APIs. 
Our system will estimate shares based on engagement patterns.
    `.trim()
  };
}
