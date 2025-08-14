"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useNiche } from "@/contexts/NicheContext";
import { useButtonProtection } from "@/contexts/ProtectionContext";
import Link from "next/link";

function ScriptWriterContent() {
  const { selectedNiche, setSelectedNiche } = useNiche();
  const { protectedClick } = useButtonProtection();
  const searchParams = useSearchParams();
  const [scriptTopic, setScriptTopic] = useState("");
  const [generatedScript, setGeneratedScript] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showDiscovery, setShowDiscovery] = useState(false);
  const [nicheInput, setNicheInput] = useState("");
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Handle URL parameters and set niche context
  useEffect(() => {
    const nicheParam = searchParams?.get('niche');
    if (nicheParam && !selectedNiche) {
      setSelectedNiche(nicheParam);
    }
  }, [searchParams, selectedNiche, setSelectedNiche]);

  const popularNiches = [
    "Fitness", "Finance", "Tech", "Cooking",
    "Travel", "Beauty"
  ];

  const handleNicheSelect = (niche: string) => {
    setSelectedNiche(niche);
    setNicheInput(niche); // Auto-populate the custom niche input
    setShowDiscovery(false);
  };

  const handleGetSuggestions = async () => {
    if (!nicheInput.trim()) {
      setShowDiscovery(true);
      return;
    }

    setLoadingSuggestions(true);
    try {
      const params = new URLSearchParams({
        interests: nicheInput.trim(),
        goals: 'content creation',
        audience: 'general'
      });
      
      const response = await fetch(`/api/niche-suggestions?${params.toString()}`, {
        method: 'GET'
      });

      if (response.ok) {
        const data = await response.json();
        setAiSuggestions(data.suggestions || []);
        setShowDiscovery(true);
      }
    } catch (error) {
      console.error('Error fetching AI suggestions:', error);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const generateScript = async () => {
    if (!scriptTopic.trim()) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams({
        niche: selectedNiche || 'general',
        topic: scriptTopic.trim()
      });
      
      const response = await fetch(`/api/generate-script?${params.toString()}`, {
        method: 'GET'
      });
      
      if (response.ok) {
        const data = await response.json();
        setGeneratedScript(data.script);
      } else {
        setGeneratedScript("Sorry, I couldn't generate a script right now. Please try again later.");
      }
    } catch (error) {
      setGeneratedScript("Error generating script. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-4xl px-8 py-16">
        {selectedNiche ? (
          // Writer's Corner Mode
          <>
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold mb-4 text-foreground tracking-tight font-inter">
                Writer's Corner
              </h1>
              <p className="text-lg text-muted mb-6">
                Start writing your next video idea for{' '}
                <span className="px-3 py-1 bg-accent text-white rounded-full font-medium">
                  {selectedNiche}
                </span>
                <button
                  onClick={() => setSelectedNiche('')}
                  className="ml-2 px-2 py-1 bg-transparent border border-red-400 text-red-500 hover:bg-red-50 hover:border-red-500 rounded-full text-xs font-medium transition-colors"
                  title="Clear niche"
                >
                  ✕
                </button>
              </p>
            </div>

            {/* Main Writing Area */}
            <div className="bg-card border border-default rounded-lg p-8 mb-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">Your Video Idea</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedNiche('')}
                    className="px-3 py-1 bg-transparent border border-red-400 text-red-500 hover:bg-red-50 hover:border-red-500 rounded-lg text-sm transition-colors"
                  >
                    Clear Niche
                  </button>
                  <button
                    onClick={() => setShowDiscovery(!showDiscovery)}
                    className="px-3 py-1 bg-muted text-muted hover:bg-accent hover:text-white rounded-lg text-sm transition-colors"
                  >
                    Change Niche
                  </button>
                </div>
              </div>

              <div className="space-y-6">
                {/* Prominent Text Input */}
                <div className="space-y-3">
                  <label className="block text-base font-medium text-foreground">
                    What's your video idea or topic?
                  </label>
                  <textarea
                    placeholder="Type your video idea here... e.g. '5 morning habits that changed my life', 'Why this productivity hack actually works', 'The biggest mistake people make with...'" 
                    value={scriptTopic}
                    onChange={(e) => setScriptTopic(e.target.value)}
                    className="w-full px-6 py-5 bg-background border-2 border-default rounded-lg text-lg placeholder-text-muted resize-none h-40 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#00ff85]/20 focus:border-[#00ff85] transition-colors"
                  />
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={protectedClick(generateScript)}
                    disabled={loading || !scriptTopic.trim()}
                    className="flex-1 px-8 py-4 bg-transparent border-2 border-accent text-accent rounded-lg font-semibold text-lg hover:bg-purple-50 hover:border-purple-600 hover:text-purple-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin w-5 h-5 border-2 border-accent border-t-transparent rounded-full"></div>
                        Writing Your Script...
                      </>
                    ) : (
                      'Generate Script'
                    )}
                  </button>
                </div>

              </div>
            </div>

            {/* Analyzer Info Section - Moved outside the main writing area */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-8 mb-8 text-center">
              <h3 className="text-2xl font-semibold text-foreground mb-3">
                Want the Full Package? Try the Analyzer!
              </h3>
              <p className="text-lg text-foreground mb-6 max-w-3xl mx-auto leading-relaxed">
                Get complete insights with hook analysis, script breakdown, styling tips, and performance metrics. Perfect if you have a successful video to analyze or want to check out competitor content for inspiration.
              </p>
              <div className="flex gap-4 justify-center">
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-white rounded-lg font-semibold hover:bg-accent/90 transition-colors"
                >
                  Try Video Analyzer
                </Link>
                <Link
                  href="/trends"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-white text-purple-600 border-2 border-purple-600 rounded-lg font-semibold hover:bg-purple-50 transition-colors"
                >
                  Browse Trending Content
                </Link>
              </div>
            </div>

            {/* Compact Discovery Section */}
            {showDiscovery && (
              <div className="mb-8">
                <div className="text-center mb-4">
                  <h3 className="text-lg font-semibold mb-2">Quick Niche Switch</h3>
                </div>
                
                <div className="flex flex-wrap gap-2 justify-center mb-4">
                  {popularNiches.map((niche) => (
                    <button
                      key={niche}
                      onClick={() => handleNicheSelect(niche)}
                      className="px-3 py-2 text-sm bg-muted hover:bg-accent hover:text-white rounded-lg transition-colors"
                    >
                      {niche}
                    </button>
                  ))}
                </div>

                <div className="flex gap-2 max-w-md mx-auto">
                  <input
                    type="text"
                    placeholder="Or enter custom niche..."
                    value={nicheInput}
                    onChange={(e) => setNicheInput(e.target.value)}
                    className="flex-1 px-4 py-2 bg-card border-2 border-default rounded-lg text-base placeholder-text-muted"
                    onKeyPress={(e) => e.key === 'Enter' && nicheInput.trim() && handleNicheSelect(nicheInput.trim())}
                  />
                  <button
                    onClick={() => nicheInput.trim() && handleNicheSelect(nicheInput.trim())}
                    disabled={!nicheInput.trim()}
                    className="px-4 py-2 bg-accent text-white rounded-lg font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
                  >
                    Set
                  </button>
                </div>
              </div>
            )}

            {/* Generated Script Display */}
            {generatedScript && (
              <div className="bg-card border border-default rounded-lg p-8">
                <h3 className="text-lg font-semibold mb-4">Generated Script:</h3>
                
                {typeof generatedScript === 'object' && generatedScript.title ? (
                  <div className="space-y-6">
                    {/* Title */}
                    <div className="bg-accent/10 border border-accent/30 rounded-lg p-4">
                      <h4 className="text-lg font-semibold text-accent mb-2">📝 Video Title</h4>
                      <p className="text-base font-medium text-foreground">{generatedScript.title}</p>
                    </div>
                    
                    {/* Hooks */}
                    {generatedScript.hooks && generatedScript.hooks.length > 0 && (
                      <div className="bg-muted rounded-lg p-4 border border-default">
                        <h4 className="text-lg font-semibold text-foreground mb-3">🎣 Hook Options</h4>
                        <div className="space-y-2">
                          {generatedScript.hooks.map((hook: string, index: number) => (
                            <div key={index} className="flex items-start gap-2">
                              <span className="text-accent mt-1">•</span>
                              <p className="text-base text-foreground">{hook}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Main Script */}
                    <div className="bg-muted rounded-lg p-6 border border-default">
                      <h4 className="text-lg font-semibold text-foreground mb-4">🎬 Full Script</h4>
                      <div className="max-h-96 overflow-y-auto">
                        <pre className="whitespace-pre-wrap text-base leading-relaxed text-foreground">
                          {generatedScript.script}
                        </pre>
                      </div>
                    </div>
                    
                    {/* Call-to-Action */}
                    {generatedScript.cta && (
                      <div className="bg-accent/10 border border-accent/30 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-accent mb-2">📢 Call-to-Action</h4>
                        <p className="text-base font-medium text-foreground">{generatedScript.cta}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-muted rounded-lg p-6 max-h-96 overflow-y-auto border border-default">
                    <pre className="whitespace-pre-wrap text-base leading-relaxed text-foreground">
                      {typeof generatedScript === 'string' ? generatedScript : JSON.stringify(generatedScript, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          // No Niche Selected Mode
          <div className="text-center">
            <h1 className="text-5xl font-bold mb-6 text-foreground tracking-tight font-inter">
              AI Script Assistant
            </h1>
            <p className="text-xl text-muted max-w-2xl mx-auto mb-12 leading-relaxed">
              Create engaging scripts powered by AI. Start by selecting a niche or jump right into writing!
            </p>
            
            {/* Quick Start Writing Area */}
            <div className="bg-card border border-default rounded-lg p-8 max-w-4xl mx-auto mb-8">
              <h2 className="text-2xl font-semibold mb-6 text-foreground">Start Writing Your Script</h2>
              
              <div className="space-y-6">
                <div className="space-y-3 text-left">
                  <div className="flex items-center justify-between">
                    <label className="block text-base font-medium text-foreground">
                      What's your video idea or topic?
                    </label>
                    {/* Custom Niche Input - Wider with purple border */}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Custom niche (optional)"
                        value={nicheInput}
                        onChange={(e) => setNicheInput(e.target.value)}
                        className="px-3 py-1.5 bg-card border border-accent/30 rounded-md text-sm placeholder-text-muted w-60 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20"
                        onKeyPress={(e) => e.key === 'Enter' && nicheInput.trim() && handleNicheSelect(nicheInput.trim())}
                      />
                      {nicheInput.trim() && (
                        <button
                          onClick={() => handleNicheSelect(nicheInput.trim())}
                          className="px-3 py-1.5 bg-accent text-white rounded-md font-medium hover:bg-accent/90 transition-colors text-sm"
                        >
                          Set
                        </button>
                      )}
                    </div>
                  </div>
                  <textarea
                    placeholder="Type your video idea here... e.g. '5 morning habits that changed my life', 'Why this productivity hack actually works', 'The biggest mistake people make with...'" 
                    value={scriptTopic}
                    onChange={(e) => setScriptTopic(e.target.value)}
                    className="w-full px-6 py-5 bg-background border-2 border-default rounded-lg text-lg placeholder-text-muted resize-none h-40 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#00ff85]/20 focus:border-[#00ff85] transition-colors"
                  />
                </div>
                
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  💡 Tip: For better results, select a niche first or try our niche discovery tool
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => setShowDiscovery(true)}
                    className="px-6 py-3 bg-transparent border-2 border-accent text-accent rounded-lg font-medium hover:bg-purple-50 hover:border-purple-600 hover:text-purple-600 transition-all duration-200"
                  >
                    Select Niche First
                  </button>
                  <button
                    onClick={protectedClick(generateScript)}
                    disabled={loading || !scriptTopic.trim()}
                    className="flex-1 px-8 py-3 bg-transparent border-2 border-accent text-accent rounded-lg font-semibold hover:bg-purple-50 hover:border-purple-600 hover:text-purple-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin w-4 h-4 border-2 border-accent border-t-transparent rounded-full"></div>
                        Generating...
                      </>
                    ) : (
                      'Generate Script Anyway'
                    )}
                  </button>
                </div>

              </div>
            </div>

            {/* Analyzer Info Section - Color shifting background */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-8 max-w-4xl mx-auto mb-8 text-center">
              <h3 className="text-2xl font-semibold text-foreground mb-3">
                Want the Full Package? Try the Analyzer!
              </h3>
              <p className="text-lg text-foreground mb-6 max-w-3xl mx-auto leading-relaxed">
                Get complete insights with hook analysis, script breakdown, styling tips, and performance metrics. Perfect if you have a successful video to analyze or want to check out competitor content for inspiration.
              </p>
              <div className="flex gap-4 justify-center">
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-white rounded-lg font-semibold hover:bg-accent/90 transition-colors"
                >
                  Try Video Analyzer
                </Link>
                <Link
                  href="/trends"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-white text-purple-600 border-2 border-purple-600 rounded-lg font-semibold hover:bg-purple-50 transition-colors"
                >
                  Browse Trending Content
                </Link>
              </div>
            </div>

            {/* Quick Niche Selection - Only when toggled */}
            {showDiscovery && (
              <div className="max-w-3xl mx-auto mb-8">
                <h3 className="text-lg font-semibold mb-4 text-center">Quick Niche Selection</h3>
                <div className="flex flex-wrap gap-2 justify-center">
                  {popularNiches.map((niche) => (
                    <button
                      key={niche}
                      onClick={() => handleNicheSelect(niche)}
                      className="px-4 py-2 text-sm bg-muted hover:bg-accent hover:text-white rounded-lg transition-colors"
                    >
                      {niche}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Generated Script Display for No-Niche Mode */}
            {!selectedNiche && generatedScript && (
              <div className="bg-card border border-default rounded-lg p-8 max-w-4xl mx-auto mb-8">
                <h3 className="text-lg font-semibold mb-4">Generated Script:</h3>
                
                {typeof generatedScript === 'object' && generatedScript.title ? (
                  <div className="space-y-6">
                    {/* Title */}
                    <div className="bg-accent/10 border border-accent/30 rounded-lg p-4">
                      <h4 className="text-lg font-semibold text-accent mb-2">📝 Video Title</h4>
                      <p className="text-base font-medium text-foreground">{generatedScript.title}</p>
                    </div>
                    
                    {/* Hooks */}
                    {generatedScript.hooks && generatedScript.hooks.length > 0 && (
                      <div className="bg-muted rounded-lg p-4 border border-default">
                        <h4 className="text-lg font-semibold text-foreground mb-3">🎣 Hook Options</h4>
                        <div className="space-y-2">
                          {generatedScript.hooks.map((hook: string, index: number) => (
                            <div key={index} className="flex items-start gap-2">
                              <span className="text-accent mt-1">•</span>
                              <p className="text-base text-foreground">{hook}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Main Script */}
                    <div className="bg-muted rounded-lg p-6 border border-default">
                      <h4 className="text-lg font-semibold text-foreground mb-4">🎬 Full Script</h4>
                      <div className="max-h-96 overflow-y-auto">
                        <pre className="whitespace-pre-wrap text-base leading-relaxed text-foreground">
                          {generatedScript.script}
                        </pre>
                      </div>
                    </div>
                    
                    {/* Call-to-Action */}
                    {generatedScript.cta && (
                      <div className="bg-accent/10 border border-accent/30 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-accent mb-2">📢 Call-to-Action</h4>
                        <p className="text-base font-medium text-foreground">{generatedScript.cta}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-muted rounded-lg p-6 max-h-96 overflow-y-auto border border-default">
                    <pre className="whitespace-pre-wrap text-base leading-relaxed text-foreground">
                      {typeof generatedScript === 'string' ? generatedScript : JSON.stringify(generatedScript, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default function ScriptWriterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-accent mx-auto mb-4"></div>
          <p className="text-lg text-muted-foreground">Loading Script Writer...</p>
        </div>
      </div>
    }>
      <ScriptWriterContent />
    </Suspense>
  );
}
