import { NextRequest, NextResponse } from 'next/server';
import { logError, logPerformance } from '@/lib/monitoring';
import { generateNicheStrategy } from '@/lib/gemini';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const endpoint = '/api/niche-suggestions';
  const method = 'GET';
  
  try {
    const url = new URL(request.url);
    const interestsRaw = url.searchParams.get('interests') || '';
    const interests = interestsRaw ? interestsRaw.split(',') : [];
    const goals = url.searchParams.get('goals') || '';
    const audience = url.searchParams.get('audience') || '';

    if (!interests || !Array.isArray(interests) || interests.length === 0) {
      const duration = Date.now() - startTime;
      logPerformance({
        endpoint,
        method,
        duration,
        success: false
      });

      return NextResponse.json(
        { success: false, error: 'Interests array is required' },
        { status: 400 }
      );
    }

    console.log(`Niche suggestions request: ${interests.join(', ')}`);

    // Generate full strategy via Gemini and adapt to frontend shape
    const brief = `Passions/Interests: ${interests.join(', ')}\nGoals: ${goals}\nAudience: ${audience}`;
    let strategy;
    try {
      strategy = await generateNicheStrategy(brief);
    } catch (e) {
      console.warn('Gemini strategy failed, using fallback:', e);
      // Build a resilient fallback so UI does not break
      const primary = (interests[0] || 'Your Niche').trim();
      strategy = {
        niche_description: `A niche around ${primary} aimed at ${audience || 'people interested in this topic'} with the goal to ${goals || 'educate'}.`,
        target_audience: audience || `People who care about ${primary.toLowerCase()} and seek practical, inspiring content.`,
        trending_topics: [primary, `${primary} tips`, `${primary} on a budget`, `${primary} for beginners`, `why ${primary} matters`],
        content_pillars: [`${primary} basics`, `${primary} tips`, `${primary} mistakes`],
        content_ideas: Array.from({ length: 6 }).map((_, i) => ({
          title: `Why ${primary} ${i + 1} matters now`,
          pillar: [`${primary} basics`, `${primary} tips`, `${primary} mistakes`][i % 3],
          format: 'Short-form'
        }))
      };
    }

    const nicheResult = {
      niche: strategy.niche_name || (strategy.niche_description || '').split(' aimed at ')[0] || 'Your Niche',
      description: strategy.niche_description || '',
      targetAudience: strategy.target_audience || audience || 'People who will benefit most from this content',
      contentPillars: strategy.content_pillars || [],
      contentIdeas: (strategy.content_ideas || []).map((ci: any) => ({
        title: String(ci.title || ''),
        hook: ci.hook ? String(ci.hook) : `Hook: ${String(ci.title || 'Quick idea')}`,
        format: String(ci.format || 'Short-form')
      })),
      trendingTopics: strategy.trending_topics || []
    };

    const duration = Date.now() - startTime;
    logPerformance({
      endpoint,
      method,
      duration,
      success: true,
      platform: 'gemini'
    });

    return NextResponse.json({
      success: true,
      data: nicheResult
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    
    // Log the error
    logError({
      endpoint,
      method,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      ip: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown'
    });

    logPerformance({
      endpoint,
      method,
      duration,
      success: false
    });

    console.error('Niche suggestions error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to generate niche suggestions',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
