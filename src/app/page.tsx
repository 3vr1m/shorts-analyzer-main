"use client";

import { useEffect, useState } from "react";
import { ContentIdeas, ContentIdea } from "@/components/ui/content-ideas";
import { useProtection, useButtonProtection } from "@/contexts/ProtectionContext";

type Analysis = {
  metadata: { title: string; channel: string; view_count?: number | string; publishedAt?: string };
  transcript: string;
  // Flattened analysis fields from API
  hook: string;
  entryStyle: string;
  niche: string;
  structure: string;
  lengthSeconds: number;
  pace: string;
  emotion: string;
  ideas: { title: string; hook: string; outline: string; suggestedLength?: number; tone?: string; exampleTranscript?: string }[];
};

function generateExampleScript(idea: any, analysis: any): string {
  const targetLength = idea.suggestedLength || 35; // Default to 35 seconds
  const wordsPerSecond = 2.5; // Average speaking rate
  const targetWords = Math.floor(targetLength * wordsPerSecond);
  
  // Generate a comprehensive script based on the hook and outline
  const script = `${idea.hook}

${expandOutlineToScript(idea.outline, targetWords - idea.hook.split(' ').length, analysis)}

${generateCallToAction(analysis.niche)}`;
  
  return script;
}

function expandOutlineToScript(outline: string, remainingWords: number, analysis: any): string {
  // Parse the outline and expand each point into natural speech
  const points = outline.split(/[\n•-]/).filter(p => p.trim());
  const wordsPerPoint = Math.floor(remainingWords / Math.max(points.length, 1));
  
  return points.map((point, index) => {
    const trimmedPoint = point.trim();
    const isLast = index === points.length - 1;
    
    // Add natural transitions and detailed expansions based on the point
    if (trimmedPoint.toLowerCase().includes('show') || trimmedPoint.toLowerCase().includes('demo')) {
      return `Now let me show you exactly how this works. ${trimmedPoint} As you can see here, this is a game-changer that will completely transform your approach. I've tested this myself and the results are incredible.`;
    } else if (trimmedPoint.toLowerCase().includes('tip') || trimmedPoint.toLowerCase().includes('trick')) {
      return `Here's a pro tip that most people don't know about: ${trimmedPoint} I wish I knew this earlier because it would have saved me so much time and effort. This is the kind of insight that separates beginners from experts.`;
    } else if (trimmedPoint.toLowerCase().includes('mistake') || trimmedPoint.toLowerCase().includes('avoid')) {
      return `This is the biggest mistake I see people make in ${analysis.niche}: ${trimmedPoint} Don't make the same error I did. I learned this the hard way, and trust me, it's not worth it. Here's what you should do instead.`;
    } else if (trimmedPoint.toLowerCase().includes('benefit') || trimmedPoint.toLowerCase().includes('advantage')) {
      return `The amazing thing about ${trimmedPoint} is how it creates multiple benefits. Not only does it solve your immediate problem, but it also sets you up for long-term success. This is why it's become my go-to strategy.`;
    } else {
      return `${trimmedPoint} This completely changed my perspective on ${analysis.niche} and I'm excited to share it with you. The impact this has had on my content creation is unbelievable, and I know it will do the same for you.`;
    }
  }).join('\n\n');
}

function generateCallToAction(niche: string): string {
  const callToActions = [
    `Don't forget to like and follow for more ${niche} content! This is just the beginning of what we can create together.`,
    `If you found this helpful, make sure to subscribe for more ${niche} tips and tricks. I'm sharing everything I know!`,
    `Drop a comment below with your thoughts on this ${niche} strategy. I'd love to hear how it works for you!`,
    `Follow along for more ${niche} content that will take your skills to the next level. Let's grow together!`
  ];
  
  return callToActions[Math.floor(Math.random() * callToActions.length)];
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Analysis | null>(null);
  
  // Protection system
  const protection = useProtection();
  const buttonProtection = useButtonProtection();
  const [motivationInput, setMotivationInput] = useState("");
  const steps = [
    "Fetching metadata",
    "Downloading audio",
    "Transcribing",
    "Analyzing",
    "Generating ideas",
  ];
  const [activeStep, setActiveStep] = useState<number>(-1);
  const [progressText, setProgressText] = useState<string>("");

  const handleMotivationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setMotivationInput(value);
    protection.checkProtection(value);
  };

  async function onAnalyze() {
    console.log('[DEBUG] 🚀 onAnalyze started');
    setError(null);
    setData(null);
    if (!url) {
      console.log('[DEBUG] ❌ No URL provided');
      setError("Please paste a video URL (YouTube, Instagram, or TikTok).");
      return;
    }
    console.log(`[DEBUG] 📹 Analyzing URL: ${url}`);
    setLoading(true);
    setActiveStep(0);
    setProgressText(steps[0]);

    // Use a more robust interval with cleanup
    let intervalId: NodeJS.Timeout | undefined;
    const startInterval = () => {
      console.log('[DEBUG] ⏱️ Starting progress interval');
      intervalId = setInterval(() => {
        setActiveStep((prev) => {
          const next = Math.min(prev + 1, steps.length - 1);
          setProgressText(steps[next]);
          console.log(`[DEBUG] 📊 Progress step: ${prev} → ${next}`);
          return next;
        });
      }, 3500);
    };
    
    startInterval();

    try {
      console.log('[DEBUG] 🌐 Making API request to analyze-video...');
      // Use GET method for analyze-video API
      const response = await fetch(`/api/analyze-video?url=${encodeURIComponent(url)}`, {
        method: "GET",
      });

      console.log(`[DEBUG] 📡 API Response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.log('[DEBUG] ❌ API Error:', errorData);
        throw new Error(errorData?.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('[DEBUG] 📋 API Response data:', result);
      
      if (!result.success) {
        console.log('[DEBUG] ❌ API returned success: false');
        throw new Error(result.error || 'Analysis failed');
      }

      // Check if this is a transcription job that needs polling
      if (result.status === 'transcribing' && result.assemblyJobId) {
        console.log(`[DEBUG] 🎯 Transcription started: ${result.assemblyJobId}`);
        setProgressText("Transcribing audio... This may take 2-5 minutes");
        
        // Poll for completion
        const pollForCompletion = async () => {
          console.log('[DEBUG] 🔄 Starting polling for transcription completion...');
          let attempts = 0;
          const maxAttempts = 60; // 5 minutes max
          
          while (attempts < maxAttempts) {
            console.log(`[DEBUG] 🔍 Polling attempt ${attempts + 1}/${maxAttempts}`);
            await new Promise(resolve => setTimeout(resolve, 5000)); // Check every 5 seconds
            
            try {
              console.log(`[DEBUG] 📡 Checking transcription status for ID: ${result.assemblyJobId}`);
              const statusResponse = await fetch(`/api/check-transcription?id=${result.assemblyJobId}`);
              console.log(`[DEBUG] 📊 Status response: ${statusResponse.status}`);
              
              if (statusResponse.ok) {
                const statusResult = await statusResponse.json();
                console.log('[DEBUG] 📋 Status result:', statusResult);
                
                if (statusResult.status === 'completed' && statusResult.transcript) {
                  console.log('[DEBUG] ✅ Transcription completed, getting full analysis...');
                  
                  // Now get the full analysis with the transcript
                  const analysisResponse = await fetch(`/api/analyze-video?url=${encodeURIComponent(url)}&transcript=${encodeURIComponent(statusResult.transcript)}`);
                  console.log(`[DEBUG] 📡 Analysis response: ${analysisResponse.status}`);
                  
                  if (analysisResponse.ok) {
                    const analysisResult = await analysisResponse.json();
                    console.log('[DEBUG] 📋 Analysis result:', analysisResult);
                    if (analysisResult.success && analysisResult.data) {
                      console.log('[DEBUG] 🎉 SUCCESS! Setting data and completing...');
                      setData(analysisResult.data as Analysis);
                      setActiveStep(steps.length - 1);
                      setProgressText("Completed");
                      return; // Success!
                    }
                  }
                  
                  throw new Error('Failed to analyze completed transcript');
                } else if (statusResult.status === 'error') {
                  console.log('[DEBUG] ❌ Transcription error:', statusResult.error);
                  throw new Error(`Transcription failed: ${statusResult.error}`);
                }
                
                // Update progress text
                const progressText = `Transcribing... ${statusResult.status} (${attempts + 1}/${maxAttempts})`;
                console.log(`[DEBUG] 📊 Progress update: ${progressText}`);
                setProgressText(progressText);
              } else {
                console.log('[DEBUG] ❌ Status check failed:', statusResponse.status);
              }
            } catch (pollError) {
              console.error('[DEBUG] ❌ Polling error:', pollError);
              // Continue polling unless it's a fatal error
            }
            
            attempts++;
          }
          
          console.log('[DEBUG] ⏰ Polling timed out after 5 minutes');
          throw new Error('Transcription timed out after 5 minutes');
        };
        
        // Start polling
        console.log('[DEBUG] 🚀 Starting transcription polling...');
        pollForCompletion();
        return;
      }
      
      // Normal response with data
      if (result.data) {
        console.log('[DEBUG] 🎉 Normal response with data, setting data...');
        setData(result.data as Analysis);
        setActiveStep(steps.length - 1);
        setProgressText("Completed");
      } else {
        console.log('[DEBUG] ❌ No data in response');
        throw new Error('No analysis data received');
      }
      
    } catch (e: any) {
      console.error('[DEBUG] ❌ Error in onAnalyze:', e);
      
      setError(e.message || "Something went wrong");
    } finally {
      console.log('[DEBUG] 🧹 Cleaning up...');
      if (intervalId) {
        clearInterval(intervalId);
        console.log('[DEBUG] ⏱️ Progress interval cleared');
      }
      setLoading(false);
      setTimeout(() => setActiveStep(-1), 1200);
      console.log('[DEBUG] ✅ onAnalyze completed');
    }
  }

  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const u = sp.get("url");
      if (u) {
        setUrl(u);
        // Kick off analysis after a short delay to let UI mount
        setTimeout(() => onAnalyze(), 300);
      }
    } catch {}
  }, []);

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

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8 lg:py-16">
        {/* Header Section */}
        <div className="text-center mb-12 lg:mb-20">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 lg:mb-6 text-foreground tracking-tight font-inter">
            AI Video Analyzer
          </h1>
          <p className="text-lg lg:text-xl text-muted max-w-2xl mx-auto mb-8 lg:mb-12 leading-relaxed px-4">
            Transform any video into actionable content insights with AI-powered analysis
          </p>
          
          {/* Platform Support - Subtle */}
          <div className="flex items-center justify-center gap-4 sm:gap-8 text-sm sm:text-base text-muted">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 bg-accent rounded-full"></span>
              YouTube
            </span>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 bg-accent rounded-full"></span>
              Instagram
            </span>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 bg-accent rounded-full"></span>
              TikTok
            </span>
          </div>
        </div>
        
        {/* Motivational Input - Hidden Protection */}
        <div className="mb-8">
          <div className="max-w-md mx-auto">
            <label className="block text-sm font-medium text-muted mb-2 text-center">
              💫 What's your motivation for today?
            </label>
            <input
              type="text"
              placeholder="Share your purpose and inspiration..."
              value={motivationInput}
              onChange={handleMotivationChange}
              className="w-full px-4 py-3 text-base bg-card border border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors placeholder-text-muted text-center"
            />
            <p className="text-xs text-muted mt-2 text-center italic">
              Start each day with intention and purpose ✨
            </p>
          </div>
        </div>
        
        {/* Clean Input Section */}
        <div className="mb-16">
          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <input
              type="url"
              placeholder="Paste your video URL here"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1 px-6 py-4 text-lg bg-card border border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors placeholder-text-muted"
            />
            <button
              onClick={onAnalyze}
              disabled={loading}
              className="px-8 py-4 bg-accent text-white rounded-lg font-medium text-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
            >
              {loading ? (
                <>
                  <div className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full"></div>
                  Analyzing
                </>
              ) : (
                "Analyze"
              )}
            </button>
          </div>
          
          {/* Simple Features List */}
          <div className="text-center text-sm text-muted">
            Multi-language detection • Hook analysis • Content ideas • Script generation
          </div>
        </div>
        {loading && (
          <div className="mb-12">
            <div className="bg-card border border-default rounded-lg p-8 text-center">
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <h3 className="text-lg font-medium mb-2">{progressText}</h3>
              <div className="w-full bg-muted rounded-full h-1 mb-4">
                <div 
                  className="h-full bg-accent rounded-full transition-all duration-500"
                  style={{ width: `${((activeStep + 1) / steps.length) * 100}%` }}
                ></div>
              </div>
              <div className="text-sm text-muted">
                Step {activeStep + 1} of {steps.length}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-900 dark:text-red-100 rounded-lg p-4 mb-8">
            <strong>Error:</strong> {error}
          </div>
        )}

        {data && (
          <section className="space-y-12">
            {/* Video Overview */}
            <div className="bg-card border border-default rounded-lg p-8">
              <h2 className="text-2xl font-medium mb-8">Video Overview</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div>
                    <span className="text-xs font-medium text-muted uppercase tracking-wide block mb-1">Title</span>
                    <span className="text-base">{data.metadata.title}</span>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-muted uppercase tracking-wide block mb-1">Channel</span>
                    <span className="text-base">{data.metadata.channel}</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <span className="text-xs font-medium text-muted uppercase tracking-wide block mb-1">Views</span>
                    <span className="text-base font-medium accent">{Number((data.metadata as any).view_count ?? 0).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-muted uppercase tracking-wide block mb-1">Published</span>
                    <span className="text-base">{(data.metadata.publishedAt ? new Date(data.metadata.publishedAt).toLocaleDateString() : '')}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Full Transcript */}
            <div className="bg-card border border-default rounded-lg p-8">
              <div className="flex items-center gap-3 mb-6">
                <h2 className="text-2xl font-medium">Full Transcript</h2>
                <span className="text-xs bg-muted text-muted px-3 py-1 rounded-full">
                  {data.transcript.split(' ').length} words
                </span>
              </div>
              <div className="bg-muted rounded-lg p-6 max-h-80 overflow-y-auto">
                <pre className="whitespace-pre-wrap leading-relaxed text-sm">{data.transcript}</pre>
              </div>
            </div>

            {/* Analysis Insights */}
            <div className="bg-card border border-default rounded-lg p-8">
              <h2 className="text-2xl font-medium mb-8">Content Analysis</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="p-6 rounded-lg border border-default">
                  <div className="text-xs font-medium text-muted uppercase tracking-wide mb-2">Hook Strategy</div>
                  <div className="text-sm">{data.hook}</div>
                </div>
                <div className="p-6 rounded-lg border border-default">
                  <div className="text-xs font-medium text-muted uppercase tracking-wide mb-2">Entry Style</div>
                  <div className="text-sm capitalize">{data.entryStyle}</div>
                </div>
                <div className="p-6 rounded-lg border border-default">
                  <div className="text-xs font-medium text-muted uppercase tracking-wide mb-2">Niche</div>
                  <div className="text-sm">{data.niche}</div>
                </div>
                <div className="p-6 rounded-lg border border-default">
                  <div className="text-xs font-medium text-muted uppercase tracking-wide mb-2">Structure</div>
                  <div className="text-sm">{data.structure}</div>
                </div>
                <div className="p-6 rounded-lg border border-default">
                  <div className="text-xs font-medium text-muted uppercase tracking-wide mb-2">Length & Pace</div>
                  <div className="text-sm">{data.lengthSeconds}s • {data.pace}</div>
                </div>
                <div className="p-6 rounded-lg border border-default">
                  <div className="text-xs font-medium text-muted uppercase tracking-wide mb-2">Emotion</div>
                  <div className="text-sm capitalize">{data.emotion}</div>
                </div>
              </div>
            </div>

            {/* Content Ideas */}
            <ContentIdeas 
              ideas={(data?.ideas ?? []).map(idea => ({
                ...idea,
                exampleTranscript: generateExampleScript(idea, {
                  hook: data.hook,
                  entryStyle: data.entryStyle,
                  niche: data.niche,
                  structure: data.structure,
                  lengthSeconds: data.lengthSeconds,
                  pace: data.pace,
                  emotion: data.emotion,
                })
              }))}
              title="Content Ideas for You"
              showFormat={false}
              showScript={true}
              showActions={false}
            />
          </section>
        )}

        <footer className="mt-12 text-xs opacity-70">
          Built with Next.js + Tailwind. Uses yt-dlp, Whisper, and an LLM for analysis.
        </footer>
      </main>
    </div>
  );
}
