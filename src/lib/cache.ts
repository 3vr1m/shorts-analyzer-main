import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { join, dirname } from "node:path";

// Cache configuration
const CACHE_CONFIG = {
  // Cache TTL settings
  ANALYSIS_TTL_MS: parseInt(process.env.ANALYSIS_CACHE_TTL_DAYS || '7') * 24 * 60 * 60 * 1000,
  TRANSCRIPT_TTL_MS: parseInt(process.env.TRANSCRIPT_CACHE_TTL_DAYS || '30') * 24 * 60 * 60 * 1000,
  
  // Cache backend: 'file' | 'redis' | 'memory'
  BACKEND: process.env.CACHE_BACKEND || 'file',
  
  // File system paths
  transcriptsBase: join(process.cwd(), ".next", "cache", "transcripts"),
  analysisBase: join(process.cwd(), ".next", "cache", "analysis"),
};

interface CacheBackend {
  getTranscript(videoId: string): Promise<string | null>;
  setTranscript(videoId: string, transcript: string): Promise<void>;
  getAnalysis(videoId: string): Promise<any | null>;
  setAnalysis(videoId: string, analysisData: any): Promise<void>;
}

// File System Cache Backend (current implementation)
class FileSystemCache implements CacheBackend {
  private async ensureDir(path: string) {
    await mkdir(path, { recursive: true });
  }

  async getTranscript(videoId: string): Promise<string | null> {
    try {
      const file = join(CACHE_CONFIG.transcriptsBase, `${videoId}.txt`);
      const stats = await stat(file);
      
      // Check TTL for transcripts too
      if (CACHE_CONFIG.TRANSCRIPT_TTL_MS > 0) {
        const ageMs = Date.now() - stats.mtime.getTime();
        if (ageMs > CACHE_CONFIG.TRANSCRIPT_TTL_MS) {
          console.log(`[CACHE] Transcript too old (${Math.round(ageMs / 1000 / 60 / 60 / 24)} days), expired`);
          return null;
        }
      }
      
      const buf = await readFile(file);
      return buf.toString("utf8");
    } catch {
      return null;
    }
  }

  async setTranscript(videoId: string, transcript: string): Promise<void> {
    const file = join(CACHE_CONFIG.transcriptsBase, `${videoId}.txt`);
    await this.ensureDir(dirname(file));
    await writeFile(file, transcript, "utf8");
  }

  async getAnalysis(videoId: string): Promise<any | null> {
    try {
      const file = join(CACHE_CONFIG.analysisBase, `${videoId}.json`);
      console.log(`[CACHE] Looking for analysis file: ${file}`);
      const stats = await stat(file);
      console.log(`[CACHE] Found analysis file, age: ${Math.round((Date.now() - stats.mtime.getTime()) / 1000 / 60)} minutes`);
      
      // Check if analysis is older than configured TTL
      const ageMs = Date.now() - stats.mtime.getTime();
      if (ageMs > CACHE_CONFIG.ANALYSIS_TTL_MS) {
        console.log(`[CACHE] Analysis too old (${Math.round(ageMs / 1000 / 60 / 60 / 24)} days), forcing refresh`);
        return null;
      }
      
      const buf = await readFile(file);
      const data = JSON.parse(buf.toString("utf8"));
      console.log(`[CACHE] Successfully loaded cached analysis with ${data.ideas?.length || 0} ideas`);
      return data;
    } catch (error) {
      console.log(`[CACHE] Failed to read analysis cache:`, error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  async setAnalysis(videoId: string, analysisData: any): Promise<void> {
    const file = join(CACHE_CONFIG.analysisBase, `${videoId}.json`);
    await this.ensureDir(dirname(file));
    await writeFile(file, JSON.stringify({
      ...analysisData,
      _cachedAt: new Date().toISOString(),
    }, null, 2), "utf8");
  }
}

// Redis Cache Backend (for production)
class RedisCache implements CacheBackend {
  private client: any = null;
  
  private async getRedisClient() {
    if (!this.client) {
      // Dynamic import to avoid breaking local development
      try {
        // Use dynamic import with proper error handling
        const redisModule = await (eval('import("redis")') as Promise<any>).catch(() => null);
        if (!redisModule) {
          console.warn('[CACHE] Redis module not available, falling back to file cache');
          return null;
        }
        
        this.client = redisModule.createClient({
          url: process.env.REDIS_URL,
        });
        await this.client.connect();
        console.log('[CACHE] Connected to Redis');
      } catch (error) {
        console.warn('[CACHE] Redis not available, falling back to file cache:', error instanceof Error ? error.message : String(error));
        return null;
      }
    }
    return this.client;
  }

  async getTranscript(videoId: string): Promise<string | null> {
    const client = await this.getRedisClient();
    if (!client) return null;
    try {
      return await client.get(`transcript:${videoId}`);
    } catch {
      return null;
    }
  }

  async setTranscript(videoId: string, transcript: string): Promise<void> {
    const client = await this.getRedisClient();
    if (!client) return;
    try {
      await client.setEx(`transcript:${videoId}`, Math.floor(CACHE_CONFIG.TRANSCRIPT_TTL_MS / 1000), transcript);
    } catch (error) {
      console.warn('[CACHE] Failed to cache transcript:', error instanceof Error ? error.message : String(error));
    }
  }

  async getAnalysis(videoId: string): Promise<any | null> {
    const client = await this.getRedisClient();
    if (!client) return null;
    try {
      const data = await client.get(`analysis:${videoId}`);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  async setAnalysis(videoId: string, analysisData: any): Promise<void> {
    const client = await this.getRedisClient();
    if (!client) return;
    try {
      const dataWithTimestamp = {
        ...analysisData,
        _cachedAt: new Date().toISOString(),
      };
      await client.setEx(`analysis:${videoId}`, Math.floor(CACHE_CONFIG.ANALYSIS_TTL_MS / 1000), JSON.stringify(dataWithTimestamp));
    } catch (error) {
      console.warn('[CACHE] Failed to cache analysis:', error instanceof Error ? error.message : String(error));
    }
  }
}

// In-Memory Cache Backend (for development/testing)
class MemoryCache implements CacheBackend {
  private transcripts = new Map<string, { data: string; timestamp: number }>();
  private analyses = new Map<string, { data: any; timestamp: number }>();

  async getTranscript(videoId: string): Promise<string | null> {
    const cached = this.transcripts.get(videoId);
    if (!cached) return null;
    
    if (CACHE_CONFIG.TRANSCRIPT_TTL_MS > 0) {
      const ageMs = Date.now() - cached.timestamp;
      if (ageMs > CACHE_CONFIG.TRANSCRIPT_TTL_MS) {
        this.transcripts.delete(videoId);
        return null;
      }
    }
    
    return cached.data;
  }

  async setTranscript(videoId: string, transcript: string): Promise<void> {
    this.transcripts.set(videoId, {
      data: transcript,
      timestamp: Date.now(),
    });
  }

  async getAnalysis(videoId: string): Promise<any | null> {
    const cached = this.analyses.get(videoId);
    if (!cached) return null;
    
    const ageMs = Date.now() - cached.timestamp;
    if (ageMs > CACHE_CONFIG.ANALYSIS_TTL_MS) {
      this.analyses.delete(videoId);
      return null;
    }
    
    return cached.data;
  }

  async setAnalysis(videoId: string, analysisData: any): Promise<void> {
    this.analyses.set(videoId, {
      data: {
        ...analysisData,
        _cachedAt: new Date().toISOString(),
      },
      timestamp: Date.now(),
    });
  }
}

// Cache backend factory
function createCacheBackend(): CacheBackend {
  switch (CACHE_CONFIG.BACKEND) {
    case 'redis':
      return new RedisCache();
    case 'memory':
      return new MemoryCache();
    case 'file':
    default:
      return new FileSystemCache();
  }
}

// Global cache instance
const cache = createCacheBackend();

// Export functions using the configurable backend
export async function getTranscriptFromCache(videoId: string): Promise<string | null> {
  return await cache.getTranscript(videoId);
}

export async function setTranscriptCache(videoId: string, transcript: string): Promise<void> {
  return await cache.setTranscript(videoId, transcript);
}

export async function getAnalysisFromCache(videoId: string): Promise<any | null> {
  return await cache.getAnalysis(videoId);
}

export async function setAnalysisCache(videoId: string, analysisData: any): Promise<void> {
  return await cache.setAnalysis(videoId, analysisData);
}

// Cache management utilities
export function getCacheStats() {
  return {
    backend: CACHE_CONFIG.BACKEND,
    analysisTTLDays: Math.round(CACHE_CONFIG.ANALYSIS_TTL_MS / (24 * 60 * 60 * 1000)),
    transcriptTTLDays: Math.round(CACHE_CONFIG.TRANSCRIPT_TTL_MS / (24 * 60 * 60 * 1000)),
  };
}
