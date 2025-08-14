"use client";

import { useState, useEffect } from "react";
import { useNiche } from "@/contexts/NicheContext";
import { useButtonProtection } from "@/contexts/ProtectionContext";

type TrendItem = {
  id: string;
  url: string;
  title: string;
  channel: string;
  publishedAt: string;
  durationSeconds: number;
  views: number;
  likeCount: number;
  commentCount: number;
  region: string;
};

type Platform = 'youtube' | 'instagram' | 'tiktok';

export default function TrendsPage() {
  const { selectedNiche: contextNiche } = useNiche();
  const [activePlatform, setActivePlatform] = useState<Platform>('youtube');
  const [country, setCountry] = useState("US");
  const [countries, setCountries] = useState<{code: string, name: string}[]>([]);
  const [niche, setNiche] = useState("");
  const [duration, setDuration] = useState<"short" | "medium" | "long">("short");
  const [max, setMax] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<TrendItem[]>([]);
  const { protectedClick } = useButtonProtection();
  const [meta, setMeta] = useState<any>(null);
  const stepsApi = ["Discovering trending content", "Analyzing engagement", "Filtering results", "Done"];
  const [activeStep, setActiveStep] = useState<number>(-1);
  const [progressText, setProgressText] = useState<string>("");
  
  // Load supported countries on mount
  useEffect(() => {
    async function loadCountries() {
      try {
        // Use static country list for client-side
        const countries = [
          { code: 'US', name: 'United States' },
          { code: 'GB', name: 'United Kingdom' },
          { code: 'CA', name: 'Canada' },
          { code: 'AU', name: 'Australia' },
          { code: 'DE', name: 'Germany' },
          { code: 'FR', name: 'France' },
          { code: 'IT', name: 'Italy' },
          { code: 'ES', name: 'Spain' },
          { code: 'BR', name: 'Brazil' },
          { code: 'IN', name: 'India' },
          { code: 'JP', name: 'Japan' },
          { code: 'KR', name: 'South Korea' }
        ];
        setCountries(countries);
      } catch (e) {
        console.warn('Failed to load countries:', e);
        // Fallback list
        setCountries([
          { code: 'US', name: 'United States' },
          { code: 'GB', name: 'United Kingdom' },
          { code: 'CA', name: 'Canada' },
          { code: 'AU', name: 'Australia' },
          { code: 'DE', name: 'Germany' },
          { code: 'FR', name: 'France' },
          { code: 'MX', name: 'Mexico' },
          { code: 'NL', name: 'Netherlands' },
          { code: 'BR', name: 'Brazil' },
          { code: 'IN', name: 'India' },
          { code: 'JP', name: 'Japan' },
          { code: 'KR', name: 'South Korea' },
          { code: 'IT', name: 'Italy' },
          { code: 'ES', name: 'Spain' },
          { code: 'SE', name: 'Sweden' },
          { code: 'NO', name: 'Norway' },
          { code: 'DK', name: 'Denmark' },
          { code: 'CH', name: 'Switzerland' },
          { code: 'AT', name: 'Austria' },
          { code: 'BE', name: 'Belgium' }
        ]);
      }
    }
    loadCountries();
  }, []);

  // Prefill niche from context on mount
  useEffect(() => {
    if (contextNiche && !niche) {
      setNiche(contextNiche);
      // Auto-fetch trending content for the niche after a short delay
      setTimeout(() => {
        if (!loading && items.length === 0) {
          fetchTrends();
        }
      }, 500);
    }
  }, [contextNiche, niche]);

  // Cleanup effect to prevent memory leaks
  useEffect(() => {
    return () => {
      // Clear any active intervals when component unmounts
      if (typeof window !== 'undefined') {
        // This will clear any remaining intervals
        const highestId = window.setTimeout(() => {}, 0);
        for (let i = 0; i < highestId; i++) {
          window.clearTimeout(i);
        }
      }
    };
  }, []);

  async function fetchTrends() {
    setLoading(true);
    setError(null);
    setItems([]);
    
    // Determine steps based on platform
    let steps;
    if (activePlatform === 'instagram') {
      steps = ["Discovering trending content", "Analyzing engagement", "Filtering results", "Done"];
    } else {
      steps = stepsApi;
    }
    
    setActiveStep(0);
    setProgressText(steps[0]);
    
    // Use a more robust interval with cleanup
    let intervalId: NodeJS.Timeout | undefined;
    const startInterval = () => {
      intervalId = setInterval(() => {
        setActiveStep((prev) => {
          const next = Math.min(prev + 1, steps.length - 1);
          setProgressText(steps[next]);
          return next;
        });
      }, 3500);
    };
    
    startInterval();
    
    try {
      const params = new URLSearchParams();
      
      // Set platform-specific parameters
      if (activePlatform === 'instagram') {
        params.set('platforms', 'instagram');
      } else {
        params.set('platforms', 'youtube');
      }
      
      params.set('country', country);
      params.set('duration', duration);
      params.set('limit', String(max));
      
      if (niche.trim()) {
        params.set('category', niche.trim());
      }
      
      // Use real server API for trending data
      const apiUrl = `/api/trending?${params.toString()}`;
      const response = await fetch(apiUrl, { method: 'GET' });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch trending content');
      }
      const json = result;
      
      // Sort differently for Instagram vs YouTube
      if (activePlatform === 'instagram') {
        // Instagram items come with trendScore
        setItems((json.data?.trendingVideos || []).sort((a: any, b: any) => (b?.trendScore || 0) - (a?.trendScore || 0)));
      } else {
        // YouTube items are sorted by views (already sorted by API)
        setItems(json.data?.trendingVideos || []);
      }
      
      setMeta(json.data?.meta || null);
      setActiveStep(steps.length - 1);
      setProgressText("Done");
    } catch (e: any) {
      setError(e.message || "Failed to fetch trends");
    } finally {
      if (intervalId) {
        clearInterval(intervalId);
      }
      setLoading(false);
      setTimeout(() => setActiveStep(-1), 1200);
    }
  }

  function secToClock(s: number) {
    const m = Math.floor(s / 60);
    const ss = s % 60;
    return `${m}:${String(ss).padStart(2, "0")}`;
  }

  const platformConfig = {
    youtube: {
      name: 'YouTube',
      available: true,
      description: 'YouTube Shorts trending content'
    },
    instagram: {
      name: 'Instagram', 
      available: false,
      description: 'Instagram Reels trending discovery - Coming Soon'
    },
    tiktok: {
      name: 'TikTok',
      available: false,
      description: 'TikTok trending content discovery - Coming Soon'
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-6xl px-8 py-16">
        <div className="text-center mb-20">
          <h1 className="text-5xl font-bold mb-6 text-foreground tracking-tight font-inter">
            Trending Content Discovery
          </h1>
          <p className="text-xl text-muted max-w-2xl mx-auto mb-12 leading-relaxed">
            Discover viral content across platforms and generate fresh ideas for your next video
          </p>
        </div>
        
        <div className="flex justify-end items-start mb-8">
          
          {/* Cost Estimator - Top Right */}
          {meta?.costEstimate && (
            <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 border border-green-200 dark:border-green-800 rounded-lg px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-green-700 dark:text-green-300">💰 API Cost</span>
                {meta.costEstimate.estimatedCostUSD === 0 ? (
                  <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-1 rounded-full font-medium">FREE</span>
                ) : (
                  <span className="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 px-2 py-1 rounded-full font-medium">
                    ~${meta.costEstimate.estimatedCostUSD.toFixed(4)}
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                {meta.costEstimate.explanation}
              </div>
              {meta.quota && (
                <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  Daily usage: {meta.quota.used}{meta.quota.cap ? `/${meta.quota.cap}` : ''} units
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Platform Tabs */}
        <div className="bg-card border border-default rounded-lg mb-12">
          <div className="flex border-b border-default relative">
            {(Object.keys(platformConfig) as Platform[]).map((platform) => {
              const config = platformConfig[platform];
              const isActive = activePlatform === platform;
              
              return (
                <button
                  key={platform}
                  onClick={() => config.available && setActivePlatform(platform)}
                  disabled={!config.available}
                  className={`px-8 py-5 font-medium text-base transition-colors duration-200 relative flex items-center gap-2
                    ${isActive 
                      ? 'text-foreground' 
                      : config.available
                        ? 'text-muted hover:text-foreground'
                        : 'text-muted-foreground/50 cursor-not-allowed'
                    }`}
                >
                  <span>{config.name}</span>
                  {!config.available && (
                    <span className="text-xs border-2 border-purple-600 text-purple-600 dark:border-gray-700 dark:text-gray-400 px-2 py-1 rounded-full">
                      Coming Soon
                    </span>
                  )}
                  {isActive && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500 rounded-full" />
                  )}
                </button>
              );
            })}
          </div>
          
          {/* Platform-specific Content */}
          <div className="p-4">
            {activePlatform === 'youtube' && (
              <div className="space-y-4">
                <div className="mb-6">
                  <h3 className="text-lg font-semibold font-inter">YouTube Shorts Trending</h3>
                </div>
                
                {/* YouTube Controls */}
                <div className="flex items-end gap-2 flex-wrap">
                  <div className="flex-shrink-0">
                    <label className="block text-base text-muted mb-1">Country</label>
                    <select 
                      value={country} 
                      onChange={(e) => setCountry(e.target.value)} 
                      className="rounded border-2 border-default bg-card text-foreground px-2 py-2 text-base focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent w-40"
                    >
                      {countries.length > 0 ? (
                        countries.map(c => (
                          <option key={c.code} value={c.code} title={c.name}>
                            {c.code} - {c.name}
                          </option>
                        ))
                      ) : (
                        <option value={country}>{country}</option>
                      )}
                    </select>
                  </div>
                  <div className="flex-1 min-w-[160px]">
                    <label className="block text-base text-muted mb-1">Niche</label>
                    <input 
                      value={niche} 
                      onChange={(e) => setNiche(e.target.value)} 
                      className="rounded border-2 border-default bg-card text-foreground px-3 py-2 text-base w-full focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent placeholder-text-muted" 
                      placeholder="fitness, dating..." 
                    />
                  </div>
                  <div className="flex-shrink-0">
                    <label className="block text-base text-muted mb-1">Duration</label>
                    <select value={duration} onChange={(e) => setDuration(e.target.value as any)} className="rounded border-2 border-default bg-card text-foreground px-2 py-2 text-base focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent">
                      <option value="short">≤60s</option>
                      <option value="medium">1-20m</option>
                      <option value="long">&gt;20m</option>
                    </select>
                  </div>
                  <div className="flex-shrink-0">
                    <label className="block text-base text-muted mb-1">Max</label>
                    <input type="number" min={1} max={50} value={max} onChange={(e) => setMax(Number(e.target.value))} className="rounded border-2 border-default bg-card text-foreground px-2 py-2 text-base w-20 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent" />
                  </div>
                  <button 
                    onClick={protectedClick(fetchTrends)} 
                    disabled={loading} 
                    className="rounded bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-4 py-2 text-base font-medium transition-colors disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                        </svg>
                        Fetching...
                      </span>
                    ) : "Fetch"}
                  </button>
                </div>
              </div>
            )}
            
            {activePlatform === 'instagram' && (
              <div className="space-y-6">
                <div className="mb-6">
                  <h3 className="text-lg font-semibold font-inter">Instagram Reels Trending</h3>
                </div>
                
                {/* Instagram Controls */}
                <div className="flex items-end gap-2 flex-wrap">
                  <div className="flex-1 min-w-[160px]">
                    <label className="block text-base text-muted mb-1">Niche</label>
                    <input 
                      value={niche} 
                      onChange={(e) => setNiche(e.target.value)} 
                      className="rounded border-2 border-default bg-card text-foreground px-3 py-2 text-base w-full focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent placeholder-text-muted" 
                      placeholder="fitness, beauty, lifestyle..." 
                    />
                  </div>
                  <div className="flex-shrink-0">
                    <label className="block text-base text-muted mb-1">Content Type</label>
                    <select value={duration} onChange={(e) => setDuration(e.target.value as any)} className="rounded border-2 border-default bg-card text-foreground px-2 py-2 text-base focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent">
                      <option value="short">Reels Only</option>
                      <option value="medium">All Posts</option>
                    </select>
                  </div>
                  <div className="flex-shrink-0">
                    <label className="block text-base text-muted mb-1">Max</label>
                    <input type="number" min={1} max={20} value={max} onChange={(e) => setMax(Number(e.target.value))} className="rounded border-2 border-default bg-card text-foreground px-2 py-2 text-base w-20 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent" />
                  </div>
                  <button 
                    onClick={protectedClick(fetchTrends)} 
                    disabled={loading} 
                    className="rounded bg-pink-600 hover:bg-pink-700 disabled:bg-gray-400 text-white px-4 py-2 text-base font-medium transition-colors disabled:cursor-not-allowed"
                  >
                    {loading ? "Loading..." : "Discover"}
                  </button>
                </div>
                
                <div className="bg-card border border-default rounded-lg p-4 mb-4">
                  <h4 className="font-medium mb-2 text-foreground text-base">Implementation Methods</h4>
                  <div className="space-y-3 text-base text-muted">
                    <div className="flex items-start gap-2">
                      <span className="text-blue-500">•</span>
                      <div>
                        <strong>Instagram Basic Display API:</strong> Limited to user's own content, not suitable for trending discovery
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-green-500">•</span>
                      <div>
                        <strong>Web Scraping (Recommended):</strong> Extract trending hashtags and Reels from public Instagram pages
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-purple-500">•</span>
                      <div>
                        <strong>Third-party APIs:</strong> Services like Apify, PhantomBuster, or custom scrapers
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-orange-500">•</span>
                      <div>
                        <strong>Instagram Graph API:</strong> Business accounts only, limited trending data
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-card border border-default rounded-lg p-4">
                  <h4 className="font-medium mb-2 text-foreground text-base">Planned Features</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-base text-muted">
                    <div>• Trending hashtags discovery</div>
                    <div>• Reel performance metrics</div>
                    <div>• Niche-based filtering</div>
                    <div>• Regional trending analysis</div>
                    <div>• Engagement rate tracking</div>
                    <div>• Creator performance insights</div>
                  </div>
                </div>
              </div>
            )}
            
            {activePlatform === 'tiktok' && (
              <div className="space-y-6">
                <div className="mb-6">
                  <h3 className="text-lg font-semibold font-inter">TikTok Trending Discovery</h3>
                </div>
                
                <div className="bg-card border border-default rounded-lg p-4 mb-4">
                  <h4 className="font-medium mb-2 text-foreground text-base">Implementation Approaches</h4>
                  <div className="space-y-3 text-base text-muted">
                    <div className="flex items-start gap-2">
                      <span className="text-red-500">•</span>
                      <div>
                        <strong>TikTok Research API:</strong> Academic/research access only, limited availability
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-green-500">•</span>
                      <div>
                        <strong>Web Scraping (Primary):</strong> Extract trending content from TikTok's public discover pages
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-blue-500">•</span>
                      <div>
                        <strong>TikTok Creative Center:</strong> Public trending data and sound insights
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-purple-500">•</span>
                      <div>
                        <strong>Third-party Services:</strong> APIs like RapidAPI TikTok scrapers, Apify actors
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-orange-500">•</span>
                      <div>
                        <strong>Sound/Music APIs:</strong> Track trending audio and music for content ideas
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-card border border-default rounded-lg p-4">
                  <h4 className="font-medium mb-2 text-foreground text-base">Target Features</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-base text-muted">
                    <div>• Trending sounds & challenges</div>
                    <div>• Viral hashtag tracking</div>
                    <div>• Regional content analysis</div>
                    <div>• Creator trend insights</div>
                    <div>• Effect & filter popularity</div>
                    <div>• Cross-platform trend correlation</div>
                  </div>
                </div>
                
                <div className="bg-card border border-default rounded-lg p-4">
                  <h4 className="font-medium mb-2 text-foreground text-base">Implementation Priority</h4>
                  <div className="text-base text-muted">
                    TikTok integration will focus on trending sounds, challenges, and hashtags since TikTok's algorithm heavily emphasizes audio trends and viral challenges. We'll implement scraping-based solutions to track trending content and provide actionable insights for content creators.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {loading && (
          <div className="bg-card border border-default rounded-lg p-4 mb-4">
            <div className="text-center">
              <div className="text-base mb-2 opacity-80">{progressText}</div>
              <div className="flex items-center gap-2">
                {stepsApi.map((s, i) => (
                  <div key={i} className={`h-1 flex-1 rounded ${i <= activeStep ? 'bg-purple-500' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                ))}
              </div>
              <div className="text-sm mt-1 opacity-60">Steps: {stepsApi.join(' • ')}</div>
              {items.length > 0 && (
                <div className="text-sm mt-2 text-purple-600">
                  Found {items.length} results so far...
                </div>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="text-red-500 text-base mb-3">{error}</div>
        )}

        {meta && (
          <div className="text-sm opacity-70 mb-3">
            {meta.fromCache ? "Served from cache." : "Fetched fresh."}
            {meta.quota ? ` This fetch used +${meta.quota.unitsConsumed || 0} unit(s); total today ${meta.quota.used}${meta.quota.cap ? `/ ${meta.quota.cap}` : ''}.` : ''}
            {typeof meta.pages === 'number' ? ` Pages: ${meta.pages}. Items considered: ${meta.totalFetched}.` : ''}
          </div>
        )}

        <div className="grid gap-3">
          {items.map((it) => {
            // Handle Instagram vs YouTube data differently
            const isInstagram = activePlatform === 'instagram';
            const creator = isInstagram ? (it as any).creator : null;
            const metrics = isInstagram ? (it as any).metrics : null;
            const score = isInstagram ? (it as any).trendScore : (it as any)?.trend?.score || (it as any)?.views;
            
            // Map VideoMetadata properties to display properties
            const displayChannel = it.channel || (it as any).creatorName || (it as any).creator || 'Unknown';
            const displayPublishedAt = it.publishedAt || (it as any).uploadDate || 'Unknown date';
            const displayDuration = it.durationSeconds || (it as any).duration || 0;
            const displayViews = it.views || (it as any).viewCount || 0;
            const displayLikes = it.likeCount || (it as any).likes || 0;
            const displayComments = it.commentCount || (it as any).comments || 0;
            
            return (
              <div key={it.id} className="rounded-lg border-2 border-gray-200 dark:border-gray-600 p-6 bg-purple-50 dark:bg-purple-900/20 shadow-lg hover:shadow-xl transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="font-bold text-purple-600 dark:text-purple-400 flex-1 text-lg leading-tight">{it.title}</div>
                  {score && (
                    <span className="text-sm bg-purple-600 text-white px-3 py-1 rounded-full ml-3 font-medium shadow-md">
                      {Math.round(score)}
                    </span>
                  )}
                </div>
                
                {isInstagram && creator ? (
                  <div className="text-sm text-purple-600 dark:text-purple-400 mb-2 font-semibold">
                    <span className="font-medium">{creator.displayName}</span>
                    {creator.verified && <span className="text-blue-500 ml-1">✓</span>}
                    <span className="mx-2">•</span>
                    <span>{displayPublishedAt ? new Date(displayPublishedAt).toLocaleDateString() : 'Unknown date'}</span>
                    {metrics && (
                      <>
                        <span className="mx-2">•</span>
                        <span>{metrics.views ? metrics.views.toLocaleString() : 'Unknown views'} views</span>
                        <span className="mx-2">•</span>
                        <span>{metrics.likes ? metrics.likes.toLocaleString() : 'Unknown likes'} likes</span>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="text-base text-purple-600 dark:text-purple-400 mb-3 font-semibold">
                    {displayChannel} • {displayPublishedAt ? new Date(displayPublishedAt).toLocaleDateString() : 'Unknown date'} • {displayDuration ? secToClock(displayDuration) : 'Unknown duration'} • {displayViews ? displayViews.toLocaleString() : 'Unknown views'} views
                  </div>
                )}
                
                {isInstagram && (it as any).hashtags?.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {(it as any).hashtags.slice(0, 5).map((tag: string) => (
                      <span key={tag} className="text-sm bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-3 py-1 rounded-lg font-medium">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
                
                {/* YouTube hashtags if available */}
                {activePlatform === 'youtube' && (() => {
                  // Extract hashtags from title and clean them up
                  const titleHashtags = (it.title || '').match(/#[a-zA-Z0-9_]+/g) || [];
                  const cleanHashtags = titleHashtags.map(tag => tag.replace(/^#+/, '#')).slice(0, 5);
                  
                  return cleanHashtags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {cleanHashtags.map((tag: string) => (
                        <span key={tag} className="text-sm bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-3 py-1 rounded-lg font-medium">
                          {tag}
                        </span>
                      ))}
                    </div>
                  );
                })()}
                
                <div className="flex gap-3 mt-4">
                  <a 
                    className="text-base bg-gray-900 dark:bg-white hover:bg-gray-700 dark:hover:bg-gray-200 text-white dark:text-gray-900 px-4 py-2 rounded-lg font-medium transition-colors shadow-md" 
                    href={it.url} 
                    target="_blank" 
                    rel="noreferrer"
                  >
                    {isInstagram ? 'View on Instagram' : 'Watch'}
                  </a>
                  <a 
                    className="text-base bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-md" 
                    href={`/?url=${encodeURIComponent(it.url)}`}
                  >
                    Analyze
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
