"use client";

import { useState } from "react";
import Link from "next/link";
import { ContentIdeas, ContentIdea } from "@/components/ui/content-ideas";
import { useButtonProtection } from "@/contexts/ProtectionContext";

type NicheResult = {
  niche: string;
  description: string;
  targetAudience: string;
  contentPillars: string[];
  contentIdeas: Array<{
    title: string;
    hook: string;
    format: string;
  }>;
  trendingTopics: string[];
};

export default function NicheDiscoveryPage() {
  const [currentStep, setCurrentStep] = useState<'questionnaire' | 'results'>('questionnaire');
  const { protectedClick } = useButtonProtection();
  const [formData, setFormData] = useState({
    passions: '',
    experience: '',
    uniquePerspective: '',
    targetAudience: '',
    contentGoals: '',
    preferredFormat: ''
  });
  const [loading, setLoading] = useState(false);
  const [nicheResult, setNicheResult] = useState<NicheResult | null>(null);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const generateNiche = async () => {
    if (!formData.passions.trim()) {
      alert('Please fill in at least your passions/interests');
      return;
    }

    setLoading(true);
    try {
      // Use real server API for niche discovery
      const params = new URLSearchParams({
        interests: formData.passions,
        goals: formData.contentGoals,
        audience: formData.targetAudience
      });
      
      const response = await fetch(`/api/niche-suggestions?${params.toString()}`, {
        method: 'GET'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        setNicheResult(result.data);
        setCurrentStep('results');
      } else {
        alert(result.error || 'Failed to generate niche suggestions. Please try again.');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Error generating niche. Please check your connection.';
      alert(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const startOver = () => {
    setCurrentStep('questionnaire');
    setFormData({
      passions: '',
      experience: '',
      uniquePerspective: '',
      targetAudience: '',
      contentGoals: '',
      preferredFormat: ''
    });
    setNicheResult(null);
  };

  if (currentStep === 'results' && nicheResult) {
    return (
      <div className="min-h-screen bg-background">
        <main className="mx-auto max-w-6xl px-8 py-16">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4 text-foreground tracking-tight font-inter">
              Your Perfect Niche
            </h1>
            <p className="text-xl text-muted max-w-2xl mx-auto">
              Based on your answers, here's your personalized content strategy
            </p>
          </div>

          {/* Main Niche Card */}
          <div className="bg-card border-3 border-purple-500 rounded-lg p-8 mb-8 shadow-lg shadow-purple-500/20">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-4">{nicheResult.niche}</h2>
              <p className="text-lg text-foreground mb-6">{nicheResult.description}</p>
              
              {/* Action Buttons - Moved below description */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={startOver}
                  className="px-6 py-3 bg-card text-foreground border-2 border-purple-300 dark:border-purple-600 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors font-medium"
                >
                  Try Again
                </button>
                <Link
                  href={`/script-writer?niche=${encodeURIComponent(nicheResult.niche)}`}
                  className="px-8 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium shadow-md shadow-purple-500/30"
                >
                  Create Scripts →
                </Link>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8 pt-6 border-t border-purple-200 dark:border-purple-700">
              <div>
                <h4 className="font-semibold mb-4 text-purple-600 dark:text-purple-400 text-2xl">Target Audience</h4>
                <p className="text-lg text-foreground leading-relaxed font-medium">{nicheResult.targetAudience}</p>
              </div>
              <div>
                <h4 className="font-semibold mb-4 text-purple-600 dark:text-purple-400 text-2xl">Trending in Your Niche</h4>
                <div className="flex flex-wrap gap-3">
                  {nicheResult.trendingTopics.map((topic, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <span className="w-3 h-3 bg-purple-500 rounded-full"></span>
                      <span className="text-lg text-foreground font-medium">{topic}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Content Pillars - Below in 3x3 grid with bigger font */}
            <div className="mt-8 pt-6 border-t border-purple-200 dark:border-purple-700">
              <h4 className="font-semibold mb-6 text-purple-600 dark:text-purple-400 text-2xl">Content Pillars</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {nicheResult.contentPillars.map((pillar, index) => (
                  <span key={index} className="px-6 py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-lg rounded-lg font-bold text-center shadow-lg">
                    {pillar}
                  </span>
                ))}
              </div>
            </div>
          </div>

            {/* Next Steps - Horizontal layout under main box */}
            <div className="mt-8">
              <h4 className="text-2xl font-semibold mb-6 text-purple-600 dark:text-purple-400">Next Steps</h4>
              <div className="flex gap-4 overflow-x-auto pb-2">
                <Link
                  href={`/script-writer?niche=${encodeURIComponent(nicheResult.niche)}`}
                  className="flex-shrink-0 px-8 py-4 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 transition-colors text-center shadow-md shadow-purple-500/30 min-w-[200px] text-lg"
                >
                  🎬 Create Video Scripts
                </Link>
                <Link
                  href={`/trends?niche=${encodeURIComponent(nicheResult.niche)}`}
                  className="flex-shrink-0 px-8 py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg font-bold hover:bg-gray-700 dark:hover:bg-gray-200 transition-colors text-center shadow-md min-w-[200px] text-lg"
                >
                  📈 Explore Trending Content
                </Link>
                <Link
                  href="/resources"
                  className="flex-shrink-0 px-8 py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg font-bold hover:bg-gray-700 dark:hover:bg-gray-200 transition-colors text-center shadow-md min-w-[200px] text-lg"
                >
                  📚 Learning Resources
                </Link>
              </div>
            </div>

            {/* Content Ideas - Horizontal layout with scroll */}
            <div className="mt-12">
              <h3 className="text-2xl font-semibold mb-8 font-inter text-purple-600 dark:text-purple-400">Content Ideas</h3>
              <div className="flex gap-6 overflow-x-auto pb-4">
                {nicheResult.contentIdeas.map((idea, index) => (
                  <div key={index} className="flex-shrink-0 w-80 border border-default rounded-lg p-6 bg-card shadow-lg">
                    <h4 className="font-bold mb-4 text-black dark:text-white text-lg">{idea.title}</h4>
                    <p className="text-lg text-gray-800 dark:text-gray-200 italic mb-6 leading-relaxed font-medium">"{idea.hook}"</p>
                    <span className="inline-block px-6 py-3 bg-purple-600 dark:bg-white text-white dark:text-gray-900 text-lg rounded-lg font-bold shadow-lg">
                      {idea.format}
                    </span>
                  </div>
                ))}
              </div>
            </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-4xl px-8 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-6 text-foreground tracking-tight font-inter">
            Discover Your Niche
          </h1>
          <p className="text-xl text-muted max-w-2xl mx-auto mb-8 leading-relaxed">
            Answer a few questions to get AI-powered niche suggestions tailored just for you
          </p>
        </div>

        {/* Questionnaire Card */}
        <div className="bg-card border border-default rounded-lg p-8">
          <div className="space-y-8">
            {/* Question 1 */}
            <div>
              <label className="block text-lg font-semibold mb-3 text-foreground">
                What topics or areas are you passionate about? *
              </label>
              <textarea
                value={formData.passions}
                onChange={(e) => handleInputChange('passions', e.target.value)}
                placeholder="e.g., urban gardening, vintage fashion, indie game development, minimalist living, sustainable cooking..."
                className="w-full px-4 py-3 bg-card border-2 border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-base placeholder-text-muted resize-none h-24"
              />
            </div>

            {/* Question 2 */}
            <div>
              <label className="block text-lg font-semibold mb-3 text-foreground">
                Do you have any specific knowledge or experience in these areas?
              </label>
              <textarea
                value={formData.experience}
                onChange={(e) => handleInputChange('experience', e.target.value)}
                placeholder="e.g., 5 years as a home gardener, collected vintage clothes for a decade, developed two small games..."
                className="w-full px-4 py-3 bg-card border-2 border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-base placeholder-text-muted resize-none h-24"
              />
            </div>

            {/* Question 3 */}
            <div>
              <label className="block text-lg font-semibold mb-3 text-foreground">
                Are there any underserved or unique perspectives within these areas? (Optional)
              </label>
              <textarea
                value={formData.uniquePerspective}
                onChange={(e) => handleInputChange('uniquePerspective', e.target.value)}
                placeholder="e.g., gardening for small apartment balconies, sustainable fashion on a budget, game development for complete beginners..."
                className="w-full px-4 py-3 bg-card border-2 border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-base placeholder-text-muted resize-none h-24"
              />
            </div>

            {/* Question 4 */}
            <div>
              <label className="block text-lg font-semibold mb-3 text-foreground">
                What kind of audience are you hoping to reach?
              </label>
              <textarea
                value={formData.targetAudience}
                onChange={(e) => handleInputChange('targetAudience', e.target.value)}
                placeholder="e.g., young professionals, busy parents, fellow hobbyists, beginners in your field, people with similar challenges..."
                className="w-full px-4 py-3 bg-card border-2 border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-base placeholder-text-muted resize-none h-20"
              />
            </div>

            {/* Question 5 */}
            <div>
              <label className="block text-lg font-semibold mb-3 text-foreground">
                What's your main goal with content creation?
              </label>
              <select
                value={formData.contentGoals}
                onChange={(e) => handleInputChange('contentGoals', e.target.value)}
                className="w-full px-4 py-3 bg-card border-2 border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-base"
              >
                <option value="">Select your main goal...</option>
                <option value="educate">Educate and share knowledge</option>
                <option value="entertain">Entertain and engage</option>
                <option value="inspire">Inspire and motivate others</option>
                <option value="build-community">Build a community</option>
                <option value="monetize">Generate income</option>
                <option value="personal-brand">Build personal brand</option>
                <option value="hobby">Share my hobby/passion</option>
              </select>
            </div>

            {/* Question 6 */}
            <div>
              <label className="block text-lg font-semibold mb-3 text-foreground">
                What type of content format do you prefer?
              </label>
              <select
                value={formData.preferredFormat}
                onChange={(e) => handleInputChange('preferredFormat', e.target.value)}
                className="w-full px-4 py-3 bg-card border-2 border-default rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-base"
              >
                <option value="">Select preferred format...</option>
                <option value="educational">Educational/Tutorial</option>
                <option value="lifestyle">Lifestyle/Vlog</option>
                <option value="comedy">Comedy/Entertainment</option>
                <option value="tips">Quick Tips/Hacks</option>
                <option value="storytelling">Storytelling</option>
                <option value="reviews">Reviews/Comparisons</option>
                <option value="behind-scenes">Behind-the-scenes</option>
                <option value="challenges">Challenges/Experiments</option>
              </select>
            </div>

            {/* Submit Button */}
            <div className="pt-6">
              <button
                onClick={protectedClick(generateNiche)}
                disabled={loading || !formData.passions.trim()}
                className="w-full px-8 py-4 bg-accent text-white rounded-lg font-semibold text-lg hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                {loading ? (
                  <>
                    <div className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full"></div>
                    Analyzing Your Answers...
                  </>
                ) : (
                  'Discover My Perfect Niche'
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Quick Start Alternative */}
        <div className="mt-8 text-center">
          <p className="text-muted mb-4">Already know your niche?</p>
          <div className="flex justify-center gap-4">
            <Link
              href="/script-writer"
              className="px-6 py-2 bg-muted text-foreground rounded-lg font-medium hover:bg-accent hover:text-white transition-colors"
            >
              Skip to Script Writer
            </Link>
            <Link
              href="/trends"
              className="px-6 py-2 bg-muted text-foreground rounded-lg font-medium hover:bg-accent hover:text-white transition-colors"
            >
              Browse Trending Content
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
