// ── Redis client singleton ────────────────────────────────────────────────────
//
// Uses ioredis. A single client instance is shared across the rate limiter,
// circuit breaker, and data cache so we don't open unnecessary connections.
//
// Set REDIS_URL in your environment. If it's absent the module exports null
// and all Redis-dependent features degrade gracefully (per-instance fallback).
//
// Example REDIS_URL values:
//   redis://localhost:6379
//   rediss://default:password@host:6380   (TLS — note the 's')
//   redis://:password@host:6379

import type { Redis as RedisType } from "ioredis";

let client: RedisType | null = null;
let initAttempted = false;

export async function getRedisClient(): Promise<RedisType | null> {
  if (initAttempted) return client;
  initAttempted = true;

  const url = process.env.REDIS_URL;
  if (!url) {
    console.warn(
      "[Gateway] REDIS_URL not set — rate limiting and circuit breaker will be per-instance only.",
    );
    return null;
  }

  try {
    // Dynamic import so the module can be loaded in environments where ioredis
    // isn't installed without crashing at import time.
    const { default: Redis } = await import("ioredis");
    const redis = new Redis(url, {
      // Fail fast on connection errors rather than hanging
      connectTimeout: 3000,
      // Don't block app startup if Redis is temporarily unreachable
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      // Silence the default "reconnecting" noise in logs
      enableOfflineQueue: false,
    });

    await redis.connect();
    await redis.ping(); // confirm connectivity

    redis.on("error", (err: Error) => {
      // Log but don't crash — degraded mode is acceptable
      console.error("[Gateway] Redis error:", err.message);
    });

    client = redis;
    console.info("[Gateway] Redis connected.");
    return client;
  } catch (err) {
    console.error(
      "[Gateway] Could not connect to Redis — degrading to in-process fallback.",
      err instanceof Error ? err.message : err,
    );
    client = null;
    return null;
  }
}

/**
 * Convenience: get the client synchronously if already initialised.
 * Returns null if not yet initialised or unavailable.
 */
export function getRedisClientSync(): RedisType | null {
  return client;
}
