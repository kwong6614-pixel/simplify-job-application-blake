import type { SheetJob } from "@prisma/client";

const MATCH_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 500;

type MatchCacheEntry = {
  job: SheetJob | null;
  expiresAt: number;
};

const cache = new Map<string, MatchCacheEntry>();

function cacheKey(userId: string, normalizedUrl: string): string {
  return `${userId}:${normalizedUrl}`;
}

export function getCachedMatch(
  userId: string,
  normalizedUrl: string,
): SheetJob | null | undefined {
  const key = cacheKey(userId, normalizedUrl);
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return entry.job;
}

export function setCachedMatch(
  userId: string,
  normalizedUrl: string,
  job: SheetJob | null,
): void {
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(cacheKey(userId, normalizedUrl), {
    job,
    expiresAt: Date.now() + MATCH_CACHE_TTL_MS,
  });
}

export function invalidateUserMatchCache(userId: string): void {
  const prefix = `${userId}:`;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
}
