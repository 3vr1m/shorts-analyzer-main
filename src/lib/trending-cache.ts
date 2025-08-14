import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { join, dirname } from "node:path";

const base = join(process.cwd(), ".next", "cache", "trending");

async function ensureDir(path: string) {
  await mkdir(path, { recursive: true });
}

export type TrendingCacheRecord = {
  etag?: string;
  fetchedAt: number; // epoch ms
  data: any[];
};

export async function getTrendingFromCache(key: string): Promise<TrendingCacheRecord | null> {
  try {
    const file = join(base, `${encodeURIComponent(key)}.json`);
    await stat(file);
    const buf = await readFile(file);
    return JSON.parse(buf.toString("utf8"));
  } catch {
    return null;
  }
}

export async function setTrendingCache(key: string, rec: TrendingCacheRecord): Promise<void> {
  const file = join(base, `${encodeURIComponent(key)}.json`);
  await ensureDir(dirname(file));
  await writeFile(file, JSON.stringify(rec), "utf8");
}

// Simple daily usage tracker for YouTube API units
const usageFile = join(base, `usage.json`);

export async function getDailyUsage(): Promise<{ date: string; used: number } | null> {
  try {
    await stat(usageFile);
    const buf = await readFile(usageFile);
    const obj = JSON.parse(buf.toString("utf8"));
    return obj;
  } catch {
    return null;
  }
}

export async function setDailyUsage(obj: { date: string; used: number }): Promise<void> {
  await ensureDir(dirname(usageFile));
  await writeFile(usageFile, JSON.stringify(obj), "utf8");
}
