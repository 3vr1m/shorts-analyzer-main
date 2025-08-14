"use client";

export default function ResourcesPage() {
  const resources = {
    tools: [
      {
        name: "Canva",
        description: "Design thumbnails, graphics, and visual content",
        url: "https://canva.com",
        category: "Design"
      },
      {
        name: "OBS Studio",
        description: "Free and open source software for video recording and live streaming",
        url: "https://obsproject.com",
        category: "Recording"
      },
      {
        name: "DaVinci Resolve",
        description: "Professional video editing software with free version",
        url: "https://blackmagicdesign.com/products/davinciresolve",
        category: "Editing"
      },
      {
        name: "Audacity",
        description: "Free, open source, cross-platform audio software",
        url: "https://audacityteam.org",
        category: "Audio"
      },
      {
        name: "TubeBuddy",
        description: "YouTube optimization and management toolkit",
        url: "https://tubebuddy.com",
        category: "YouTube"
      },
      {
        name: "VidIQ",
        description: "YouTube SEO and analytics tool",
        url: "https://vidiq.com",
        category: "YouTube"
      }
    ],
    learning: [
      {
        name: "YouTube Creator Academy",
        description: "Official YouTube courses and best practices",
        url: "https://creatoracademy.youtube.com",
        category: "Free Course"
      },
      {
        name: "Think Media",
        description: "YouTube channel with equipment reviews and tutorials",
        url: "https://youtube.com/thinkmedia",
        category: "YouTube Channel"
      },
      {
        name: "Peter McKinnon",
        description: "Photography and videography tutorials",
        url: "https://youtube.com/petermckinnon",
        category: "YouTube Channel"
      },
      {
        name: "HubSpot Content Marketing",
        description: "Free content marketing certification",
        url: "https://academy.hubspot.com/courses/content-marketing",
        category: "Free Course"
      },
      {
        name: "Skillshare",
        description: "Creative classes including video production",
        url: "https://skillshare.com",
        category: "Paid Course"
      },
      {
        name: "Coursera - Digital Marketing",
        description: "University-level digital marketing courses",
        url: "https://coursera.org",
        category: "Paid Course"
      }
    ],
    inspiration: [
      {
        name: "MrBeast",
        description: "Study viral content structure and engagement",
        url: "https://youtube.com/@MrBeast",
        category: "Case Study"
      },
      {
        name: "Ali Abdaal",
        description: "Productivity and educational content creation",
        url: "https://youtube.com/@aliabdaal",
        category: "Case Study"
      },
      {
        name: "Emma Chamberlain",
        description: "Lifestyle vlogging and authentic storytelling",
        url: "https://youtube.com/@emmachamberlain",
        category: "Case Study"
      },
      {
        name: "MKBHD",
        description: "Tech review format and production quality",
        url: "https://youtube.com/@mkbhd",
        category: "Case Study"
      },
      {
        name: "Social Blade",
        description: "Track creator statistics and growth",
        url: "https://socialblade.com",
        category: "Analytics"
      },
      {
        name: "Trending Topics",
        description: "Google Trends for content ideas",
        url: "https://trends.google.com",
        category: "Research"
      }
    ]
  };

  const ResourceCard = ({ resource, index }: { resource: any, index: number }) => (
    <div className="bg-card border border-default rounded-lg p-6 hover:border-accent/50 transition-colors">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">{resource.name}</h3>
        <span className="px-4 py-2 text-sm bg-purple-100 dark:bg-purple-900/30 text-black dark:text-white rounded-full font-medium">
          {resource.category}
        </span>
      </div>
      <p className="text-muted mb-4 leading-relaxed">{resource.description}</p>
      <a
        href={resource.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg font-medium text-sm hover:bg-accent/90 transition-colors"
      >
        Visit Resource
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </a>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-6xl px-8 py-16">
        <div className="text-center mb-20">
          <h1 className="text-5xl font-bold mb-6 text-foreground tracking-tight font-inter">
            Creator Resources
          </h1>
          <p className="text-xl text-muted max-w-2xl mx-auto mb-12 leading-relaxed">
            Essential tools, courses, and inspiration to elevate your content creation journey
          </p>
        </div>

        {/* Tools Section */}
        <section className="mb-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-foreground font-inter">Essential Tools</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {resources.tools.map((resource, index) => (
              <ResourceCard key={resource.name} resource={resource} index={index} />
            ))}
          </div>
        </section>

        {/* Learning Section */}
        <section className="mb-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-foreground font-inter">Learning Resources</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {resources.learning.map((resource, index) => (
              <ResourceCard key={resource.name} resource={resource} index={index} />
            ))}
          </div>
        </section>

        {/* Inspiration Section */}
        <section className="mb-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-foreground font-inter">Inspiration & Research</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {resources.inspiration.map((resource, index) => (
              <ResourceCard key={resource.name} resource={resource} index={index} />
            ))}
          </div>
        </section>

        {/* Quick Tips Section */}
        <section className="bg-card border border-default rounded-lg p-8">
          <h2 className="text-2xl font-bold text-foreground font-inter mb-6">Quick Tips for Success</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-semibold mb-4 text-accent">Content Creation</h3>
              <ul className="space-y-2 text-muted">
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-1">•</span>
                  <span>Hook viewers in the first 3 seconds</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-1">•</span>
                  <span>Use trending audio and hashtags strategically</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-1">•</span>
                  <span>Post consistently at optimal times</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-1">•</span>
                  <span>Engage with your audience in comments</span>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4 text-accent">Growth Strategies</h3>
              <ul className="space-y-2 text-muted">
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-1">•</span>
                  <span>Collaborate with other creators</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-1">•</span>
                  <span>Repurpose content across platforms</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-1">•</span>
                  <span>Analyze your metrics weekly</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-1">•</span>
                  <span>Stay updated with platform algorithm changes</span>
                </li>
              </ul>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
