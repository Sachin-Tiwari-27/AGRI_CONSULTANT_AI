import type { Redis } from "ioredis";

// ── Data cache ────────────────────────────────────────────────────────────────
//
// Used ONLY for upstream data fetches that feed into prompts:
//   - fetchClimateData(lat, lon)   — Open-Meteo historical data (TTL: 7 days)
//   - researchMarket(crops, ...)   — Tavily search results      (TTL: 24 hours)
//
// AI responses are NOT cached here. Each report section is unique per project.
// See docs/architecture.md for the reasoning.
//
// Architecture: L1 (in-memory LRU) → L2 (Redis) → source
// A cache hit at L1 costs microseconds. A hit at L2 costs ~1ms.
// A miss calls the external API (seconds + money).

// ── L1: In-memory LRU ─────────────────────────────────────────────────────────

interface CacheEntry {
  value: string;
  expiresAt: number; // Date.now() ms
}

class MemoryLRU {
  private map = new Map<string, CacheEntry>();

  constructor(private maxEntries: number = 200) {}

  get(key: string): string | null {
    const entry = this.map.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return null;
    }
    // Refresh LRU position
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key: string, value: string, ttlSecs: number): void {
    // Evict oldest entry if at capacity
    if (this.map.size >= this.maxEntries) {
      const oldest = this.map.keys().next().value;
      if (oldest) this.map.delete(oldest);
    }
    this.map.set(key, { value, expiresAt: Date.now() + ttlSecs * 1000 });
  }

  delete(key: string): void {
    this.map.delete(key);
  }
}

// ── TTL presets ────────────────────────────────────────────────────────────────

export const CACHE_TTL = {
  CLIMATE_DATA: 7 * 24 * 60 * 60,   // 7 days — historical weather barely changes
  MARKET_DATA:  24 * 60 * 60,        // 24 hours — prices shift daily
} as const;

// ── DataCache ──────────────────────────────────────────────────────────────────

export class DataCache {
  private l1 = new MemoryLRU(
    Number(process.env.AI_CACHE_MAX_ENTRIES ?? 200),
  );

  constructor(private redis: Redis | null) {}

  async get(key: string): Promise<string | null> {
    // L1 check
    const l1Hit = this.l1.get(key);
    if (l1Hit !== null) return l1Hit;

    // L2 check
    if (this.redis) {
      try {
        const l2Hit = await this.redis.get(`dc:${key}`);
        if (l2Hit !== null) {
          // Populate L1 with remaining TTL from Redis
          const ttl = await this.redis.ttl(`dc:${key}`);
          if (ttl > 0) this.l1.set(key, l2Hit, ttl);
          return l2Hit;
        }
      } catch (err) {
        console.warn("[DataCache] Redis GET failed:", (err as Error).message);
      }
    }

    return null;
  }

  async set(key: string, value: string, ttlSecs: number): Promise<void> {
    // Write to L1
    this.l1.set(key, value, ttlSecs);

    // Write to L2
    if (this.redis) {
      try {
        await this.redis.set(`dc:${key}`, value, "EX", ttlSecs);
      } catch (err) {
        console.warn("[DataCache] Redis SET failed:", (err as Error).message);
      }
    }
  }

  async delete(key: string): Promise<void> {
    this.l1.delete(key);
    if (this.redis) {
      try {
        await this.redis.del(`dc:${key}`);
      } catch {
        // best-effort
      }
    }
  }

  // ── Key builders ─────────────────────────────────────────────────────────────

  static climateKey(lat: number, lon: number): string {
    // Round to 2dp — nearby GPS coordinates share the same climate data
    return `climate:${lat.toFixed(2)}:${lon.toFixed(2)}`;
  }

  static marketKey(country: string, crops: string[]): string {
    const sorted = [...crops].sort().join(",").toLowerCase().replace(/\s+/g, "_");
    const c = country.toLowerCase().replace(/\s+/g, "_");
    return `market:${c}:${sorted}`;
  }
}
