'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface ScriptData {
  title: string
  hooks: string[]
  script: string
  cta: string
}

interface ApiResponse {
  script: ScriptData
  niche: string
  topic: string
  generated_at: string
}

export default function ScriptGeneratorPage() {
  const router = useRouter()
  const [niche, setNiche] = useState('')
  const [topic, setTopic] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generatedScript, setGeneratedScript] = useState<ApiResponse | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!niche.trim() || !topic.trim()) {
      setError('Please fill in both niche and topic fields')
      return
    }

    setLoading(true)
    setError(null)
    setGeneratedScript(null)

    try {
      const params = new URLSearchParams({
        niche: niche.trim(),
        topic: topic.trim()
      });
      
      const response = await fetch(`/api/generate-script?${params.toString()}`, {
        method: 'GET'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate script')
      }

      const data: ApiResponse = await response.json()
      setGeneratedScript(data)
    } catch (err) {
      console.error('Script generation error:', err)
      setError(err instanceof Error ? err.message : 'Failed to generate script')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    // You could add a toast notification here
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <h1 
              onClick={() => router.push('/')}
              className="text-2xl font-bold text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
            >
              Script Generator
            </h1>
            <button
              onClick={() => router.push('/')}
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              ← Back to Home
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Generate Viral Scripts
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Create engaging short-form video scripts for TikTok, Instagram Reels, and YouTube Shorts. 
            Powered by AI to help you create content that converts.
          </p>
        </div>

        {/* Form Section */}
        <div className="max-w-4xl mx-auto mb-12">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="niche" className="block text-sm font-medium text-gray-700 mb-2">
                    Niche/Category *
                  </label>
                  <input
                    id="niche"
                    type="text"
                    placeholder="e.g., Fitness, Tech, Cooking, Travel"
                    value={niche}
                    onChange={(e) => setNiche(e.target.value)}
                    className="w-full px-4 py-3 text-gray-900 placeholder-gray-500 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="topic" className="block text-sm font-medium text-gray-700 mb-2">
                    Specific Topic *
                  </label>
                  <input
                    id="topic"
                    type="text"
                    placeholder="e.g., Morning routine, Budget tips, Quick recipes"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="w-full px-4 py-3 text-gray-900 placeholder-gray-500 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 px-6 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02]"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Generating Script...
                  </div>
                ) : (
                  'Generate Script'
                )}
              </button>
            </form>

            {/* Error Display */}
            {error && (
              <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Generated Script Display */}
        {generatedScript && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
              {/* Script Header */}
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-6 text-white">
                <h3 className="text-2xl font-bold mb-2">{generatedScript.script.title}</h3>
                <div className="flex items-center space-x-4 text-blue-100">
                  <span>Niche: {generatedScript.niche}</span>
                  <span>Topic: {generatedScript.topic}</span>
                  <span>Generated: {new Date(generatedScript.generated_at).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="p-8 space-y-8">
                {/* Hooks Section */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium mr-3">
                      Hooks
                    </span>
                    Attention-Grabbing Openings
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {generatedScript.script.hooks.map((hook, index) => (
                      <div key={index} className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <p className="text-gray-800 font-medium">{hook}</p>
                          <button
                            onClick={() => copyToClipboard(hook)}
                            className="text-yellow-600 hover:text-yellow-800 transition-colors"
                            title="Copy to clipboard"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Script Section */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium mr-3">
                      Script
                    </span>
                    Full Video Script
                  </h4>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                    <div className="flex items-start justify-between mb-4">
                      <p className="text-sm text-gray-600">Click to copy the entire script</p>
                      <button
                        onClick={() => copyToClipboard(generatedScript.script.script)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                      >
                        Copy Script
                      </button>
                    </div>
                    <div className="prose prose-gray max-w-none">
                      <pre className="whitespace-pre-wrap text-gray-800 font-mono text-sm leading-relaxed">
                        {generatedScript.script.script}
                      </pre>
                    </div>
                  </div>
                </div>

                {/* Call to Action Section */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium mr-3">
                      CTA
                    </span>
                    Call to Action
                  </h4>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                    <div className="flex items-start justify-between">
                      <p className="text-gray-800 font-medium text-lg">{generatedScript.script.cta}</p>
                      <button
                        onClick={() => copyToClipboard(generatedScript.script.cta)}
                        className="text-green-600 hover:text-green-800 transition-colors"
                        title="Copy to clipboard"
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-gray-200">
                  <button
                    onClick={() => {
                      setNiche('')
                      setTopic('')
                      setGeneratedScript(null)
                      setError(null)
                    }}
                    className="flex-1 bg-gray-100 text-gray-700 py-3 px-6 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                  >
                    Generate New Script
                  </button>
                  <button
                    onClick={() => {
                      const fullContent = `Title: ${generatedScript.script.title}\n\nHooks:\n${generatedScript.script.hooks.map((h, i) => `${i + 1}. ${h}`).join('\n')}\n\nScript:\n${generatedScript.script.script}\n\nCall to Action:\n${generatedScript.script.cta}`
                      copyToClipboard(fullContent)
                    }}
                    className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    Copy All Content
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
