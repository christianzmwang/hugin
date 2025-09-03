type CacheEntry<T> = {
  data: T
  timestamp: number
  ttl: number
}

class ApiCache {
  private cache = new Map<string, CacheEntry<unknown>>()
  private readonly DEFAULT_TTL = 2 * 60 * 1000 // 2 minutes

  private generateKey(params: Record<string, unknown>): string {
    // Sort keys for consistent cache keys
    const sortedParams = Object.keys(params)
      .sort()
      .reduce(
        (acc, key) => {
          acc[key] = params[key]
          return acc
        },
        {} as Record<string, unknown>,
      )

    return JSON.stringify(sortedParams)
  }

  private isExpired(entry: CacheEntry<unknown>): boolean {
    return Date.now() - entry.timestamp > entry.ttl
  }

  get<T>(params: Record<string, unknown>): T | null {
    const key = this.generateKey(params)
    const entry = this.cache.get(key)

    if (!entry) return null

    if (this.isExpired(entry)) {
      this.cache.delete(key)
      return null
    }

    return entry.data as T
  }

  set<T>(params: Record<string, unknown>, data: T, customTtl?: number): void {
    const key = this.generateKey(params)
    const ttl = customTtl || this.DEFAULT_TTL

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    })
  }

  // Clear cache entries that match a pattern (useful when data changes)
  invalidatePattern(pattern: Partial<Record<string, unknown>>): void {
    const patternStr = JSON.stringify(pattern)
    const keysToDelete = Array.from(this.cache.keys()).filter(
      (key) => key.includes(patternStr.slice(1, -1)), // Remove outer braces
    )

    keysToDelete.forEach((key) => this.cache.delete(key))
  }

  // Clear all cache
  clear(): void {
    this.cache.clear()
  }

  // Get cache stats
  getStats(): { size: number; entries: string[] } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys()),
    }
  }

  // Clean expired entries
  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key)
      }
    }
  }
}

// Singleton instance
export const apiCache = new ApiCache()

// Auto-cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(
    () => {
      apiCache.cleanup()
    },
    5 * 60 * 1000,
  )
}
