import { MODELS, openai } from "./openai";

export type AnalysisJSON = {
  hook: string;
  entryStyle: string;
  niche: string;
  structure: string;
  lengthSeconds: number;
  pace: "slow" | "moderate" | "fast" | string;
  emotion: string;
};

export type Idea = {
  title: string;
  hook: string;
  outline: string;
  suggestedLength?: number;
  tone?: string;
};

import { createReadStream } from "node:fs";

export async function transcribeAudio(filePath: string): Promise<string> {
  if (!process.env.OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY env var");
  const resp = await openai.audio.transcriptions.create({
    file: createReadStream(filePath) as any,
    model: MODELS.TRANSCRIBE,
    response_format: "text",
  } as any);
  return typeof resp === "string" ? resp : (resp as any).text || "";
}

export function computePaceFromWpm(wpm: number): "slow" | "moderate" | "fast" {
  if (wpm < 110) return "slow";
  if (wpm < 160) return "moderate";
  return "fast";
}

async function withRetry<T>(fn: () => Promise<T>, opts?: { retries?: number; baseDelayMs?: number }): Promise<T> {
  const retries = opts?.retries ?? 3;
  const base = opts?.baseDelayMs ?? 500;
  let lastErr: any;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      lastErr = e;
      const is429 = typeof e?.status === "number" ? e.status === 429 : /429/.test(String(e?.message || ""));
      const is5xx = typeof e?.status === "number" ? e.status >= 500 : false;
      if (i === retries || (!is429 && !is5xx)) break;
      const delay = base * Math.pow(2, i) + Math.floor(Math.random() * 200);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

export async function analyzeTranscript(
  transcript: string,
  metadata: { title: string; channel: string; views?: number; fallbackPace?: string; fallbackLength?: number }
): Promise<AnalysisJSON> {
  const sys = `You are a video content analyst for short-form videos.
Return STRICT JSON that matches the provided JSON Schema. Do not include any extra keys or commentary.`;
  const user = `Transcript:\n${transcript}\n\nMetadata:\nTitle: ${metadata.title}\nViews: ${metadata.views ?? ""}\nChannel: ${metadata.channel}\n\nHints (optional fallbacks): pace=${metadata.fallbackPace ?? ""}, lengthSeconds=${metadata.fallbackLength ?? ""}`;

  const chat = await withRetry(() => openai.chat.completions.create({
    model: MODELS.ANALYSIS,
    messages: [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
    temperature: 0.2,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "shorts_analysis",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            hook: { type: "string" },
            entryStyle: { type: "string" },
            niche: { type: "string" },
            structure: { type: "string" },
            lengthSeconds: { type: "number" },
            pace: { type: "string", enum: ["slow", "moderate", "fast"], default: "moderate" },
            emotion: { type: "string" }
          },
          required: ["hook", "entryStyle", "niche", "structure", "lengthSeconds", "pace", "emotion"]
        }
      }
    }
  }));
  const content = (chat as any).choices?.[0]?.message?.content || "{}";
  try {
    const parsed = JSON.parse(content);
    return parsed;
  } catch {
    return {
      hook: "",
      entryStyle: "",
      niche: "",
      structure: "",
      lengthSeconds: metadata.fallbackLength ?? 0,
      pace: (metadata.fallbackPace as any) || "moderate",
      emotion: "",
    };
  }
}

export async function generateIdeas(
  analysis: AnalysisJSON
): Promise<Idea[]> {
  const sys = `You are a short-form content idea generator.
Produce 3 ORIGINAL ideas inspired by the analysis. Return STRICT JSON per schema.`;
  const user = `Analysis JSON:\n${JSON.stringify(analysis, null, 2)}`;
  const chat = await withRetry(() => openai.chat.completions.create({
    model: MODELS.IDEAS,
    messages: [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
    temperature: 0.8,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "shorts_ideas",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            ideas: {
              type: "array",
              minItems: 3,
              maxItems: 3,
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  title: { type: "string" },
                  hook: { type: "string" },
                  outline: { type: "string" },
                  suggestedLength: { type: "number" },
                  tone: { type: "string" }
                },
                required: ["title", "hook", "outline", "suggestedLength", "tone"]
              }
            }
          },
          required: ["ideas"]
        }
      }
    }
  }));
  const content = (chat as any).choices?.[0]?.message?.content || "{\"ideas\":[]}";
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) return parsed as any;
    if (Array.isArray(parsed?.ideas)) return parsed.ideas as Idea[];
    return [];
  } catch {
    return [];
  }
}
