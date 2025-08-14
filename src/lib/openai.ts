import OpenAI from "openai";

// Create OpenAI client lazily to avoid issues in serverless environments
let openaiInstance: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!openaiInstance) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OpenAI API key not configured");
    }
    openaiInstance = new OpenAI({ apiKey });
  }
  return openaiInstance;
}

// For backward compatibility
export const openai = {
  get chat() { return getOpenAI().chat; },
  get audio() { return getOpenAI().audio; }
};

export const MODELS = {
  TRANSCRIBE: process.env.TRANSCRIBE_MODEL || "whisper-1",
  ANALYSIS: process.env.ANALYSIS_MODEL || "gpt-4o-mini",
  IDEAS: process.env.IDEAS_MODEL || "gpt-4o-mini",
};

// Audio transcription using OpenAI Whisper
export async function transcribeAudio(audioPath: string): Promise<string | null> {
  try {
    console.log(`[WHISPER] Starting transcription of: ${audioPath}`);
    
    const fs = await import('fs');
    const openaiClient = getOpenAI();
    
    const transcription = await openaiClient.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: MODELS.TRANSCRIBE,
      language: 'en', // Can be auto-detected by removing this
    });

    console.log(`[WHISPER] Transcription completed: ${transcription.text?.length || 0} characters`);
    return transcription.text || null;
  } catch (error) {
    console.error('[WHISPER] Transcription failed:', error);
    throw error;
  }
}

/**
 * Generate niche suggestions based on user interests and goals
 */
export async function generateNicheSuggestions(
  interests: string[],
  goals?: string,
  audience?: string
) {
  const openai = getOpenAI();

  const prompt = `Based on these interests: ${interests.join(', ')}
${goals ? `Goals: ${goals}` : ''}
${audience ? `Target audience: ${audience}` : ''}

Generate 3 specific, actionable niche suggestions for short-form content creation. For each niche, provide:
1. Niche name (2-4 words)
2. Description (1-2 sentences)
3. 3 content pillars
4. Target audience
5. 3 content ideas

Format as JSON:
{
  "suggestions": [
    {
      "name": "string",
      "description": "string", 
      "contentPillars": ["string", "string", "string"],
      "targetAudience": "string",
      "contentIdeas": [
        {"title": "string", "hook": "string", "outline": ["string"]},
        {"title": "string", "hook": "string", "outline": ["string"]},
        {"title": "string", "hook": "string", "outline": ["string"]}
      ]
    }
  ]
}`;

  const completion = await openai.chat.completions.create({
    model: MODELS.IDEAS,
    messages: [
      {
        role: "system",
        content: "You are an expert content strategist who helps creators find profitable niches for short-form content. Provide specific, actionable suggestions."
      },
      {
        role: "user", 
        content: prompt
      }
    ],
    temperature: 0.7,
    max_tokens: 2000
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from OpenAI");
  }

  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error("Failed to parse OpenAI response as JSON");
  }
}
