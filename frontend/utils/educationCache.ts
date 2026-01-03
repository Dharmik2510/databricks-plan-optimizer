/**
 * Simple in-memory cache with LRU eviction for AI education responses.
 * Keyed by nodeId + signature hash for cache invalidation.
 */

const MAX_CACHE_SIZE = 50;

interface CacheEntry<T> {
    value: T;
    timestamp: number;
}

class EducationCache<T> {
    private cache = new Map<string, CacheEntry<T>>();

    /**
     * Get a cached value by key
     */
    get(key: string): T | null {
        const entry = this.cache.get(key);
        if (!entry) return null;
        return entry.value;
    }

    /**
     * Check if key exists in cache
     */
    has(key: string): boolean {
        return this.cache.has(key);
    }

    /**
     * Set a value in cache with LRU eviction
     */
    set(key: string, value: T): void {
        // Evict oldest entries if at capacity
        if (this.cache.size >= MAX_CACHE_SIZE) {
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey) {
                this.cache.delete(oldestKey);
            }
        }

        this.cache.set(key, {
            value,
            timestamp: Date.now(),
        });
    }

    /**
     * Clear all cached entries
     */
    clear(): void {
        this.cache.clear();
    }

    /**
     * Get cache size for debugging
     */
    get size(): number {
        return this.cache.size;
    }
}

// Singleton instance for node education responses
export const educationCache = new EducationCache<any>();

/**
 * Generate a deterministic hash for cache key signature.
 * Uses JSON.stringify with sorted keys for consistency.
 */
export function generateSignatureHash(input: {
    operatorType?: string;
    nodeLabel: string;
    upstreamLabels?: string[];
    downstreamLabels?: string[];
    metrics?: Record<string, string | number>;
    evidenceSnippets?: string[];
    modelVersion?: string;
}): string {
    const normalized = {
        operatorType: input.operatorType || '',
        nodeLabel: input.nodeLabel,
        upstreamLabels: [...(input.upstreamLabels || [])].sort(),
        downstreamLabels: [...(input.downstreamLabels || [])].sort(),
        metrics: input.metrics ? Object.keys(input.metrics).sort().reduce((acc, key) => {
            acc[key] = input.metrics![key];
            return acc;
        }, {} as Record<string, any>) : {},
        evidenceSnippets: [...(input.evidenceSnippets || [])].sort(),
        modelVersion: input.modelVersion || 'gemini-2.0-flash-exp',
    };

    // Simple hash function (djb2)
    const str = JSON.stringify(normalized);
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i);
    }
    return Math.abs(hash).toString(36);
}
