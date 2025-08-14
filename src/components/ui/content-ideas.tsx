import Link from "next/link";

export interface ContentIdea {
  title: string;
  hook: string;
  format?: string;
  outline?: string;
  suggestedLength?: number;
  tone?: string;
  exampleTranscript?: string;
}

interface ContentIdeasProps {
  ideas: ContentIdea[];
  title?: string;
  showFormat?: boolean;
  showScript?: boolean;
  showActions?: boolean;
  niche?: string;
  className?: string;
}

export function ContentIdeas({
  ideas,
  title = "Content Ideas",
  showFormat = true,
  showScript = false,
  showActions = true,
  niche,
  className = ""
}: ContentIdeasProps) {
  return (
    <div className={`bg-transparent ${className}`}>
      <h3 className="text-2xl font-semibold mb-6 font-inter text-foreground">
        {title}
      </h3>
      <div className="flex gap-4 overflow-x-auto pb-2 snap-x">
        {ideas.slice(0, 6).map((idea, index) => (
          <div key={index} className="min-w-[380px] max-w-[420px] snap-start border-2 border-default rounded-xl p-6 bg-card text-foreground shadow-lg">
            <div className="flex items-start justify-between mb-4">
              <h4 className="font-bold text-xl flex-1 pr-2">{idea.title}</h4>
              <div className="flex gap-2 ml-4 flex-shrink-0">
                {idea.suggestedLength && (
                  <span className="text-sm bg-muted text-muted-foreground px-3 py-1 rounded-full font-medium">
                    {idea.suggestedLength}s
                  </span>
                )}
                {idea.tone && (
                  <span className="text-sm bg-muted text-muted-foreground px-3 py-1 rounded-full capitalize font-medium">
                    {idea.tone}
                  </span>
                )}
              </div>
            </div>
            
            <p className="text-lg italic mb-4 leading-relaxed font-medium opacity-90">"{idea.hook}"</p>
            
            {showFormat && idea.format && (
              <span className="inline-block px-6 py-3 bg-muted text-muted-foreground text-lg rounded-lg font-bold mb-4">
                {idea.format}
              </span>
            )}
            
            {idea.outline && (
              <div className="mb-4">
                <div className="text-sm font-medium text-foreground mb-2">Content Outline:</div>
                <div className="text-sm text-foreground leading-relaxed whitespace-pre-line bg-muted p-3 rounded border">
                  {idea.outline}
                </div>
              </div>
            )}
            
            {showScript && idea.exampleTranscript && (
              <div className="mb-4">
                <div className="text-sm font-medium text-foreground mb-2">Example Script:</div>
                <div className="text-sm text-foreground leading-relaxed whitespace-pre-line bg-muted p-3 rounded border max-h-48 overflow-y-auto">
                  {idea.exampleTranscript}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      
      {showActions && niche && (
        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <Link
            href={`/script-writer?niche=${encodeURIComponent(niche)}`}
            className="flex-1 px-6 py-3 bg-accent text-accent-foreground rounded-lg font-medium hover:bg-accent/80 transition-colors flex items-center justify-center gap-2"
          >
            Generate Full Scripts 📝
          </Link>
          <Link
            href={`/trends?niche=${encodeURIComponent(niche)}`}
            className="flex-1 px-6 py-3 bg-muted text-muted-foreground rounded-lg font-medium hover:bg-accent hover:text-accent-foreground transition-colors flex items-center justify-center gap-2 border border-default"
          >
            Explore Trending Content 📈
          </Link>
        </div>
      )}
    </div>
  );
}
