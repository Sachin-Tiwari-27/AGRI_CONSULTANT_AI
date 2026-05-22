import type { Redis } from "ioredis";

// ── Circuit breaker ───────────────────────────────────────────────────────────
//
// State machine per model:
//
//   CLOSED ──(N failures in window)──► OPEN ──(cooldown expires)──► HALF_OPEN
//     ▲                                                                  │
//     └──────────────────(success)──────────────────────────────────────┘
//
// State is stored in Redis so all server instances share it.
// If Redis is unavailable the breaker degrades to always-CLOSED (pass-through).

export type BreakerState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface BreakerConfig {
  /** Number of failures within the window before opening. Default: 5 */
  failureThreshold: number;
  /** Rolling window for counting failures, in seconds. Default: 60 */
  windowSecs: number;
  /** How long to stay OPEN before moving to HALF_OPEN, in seconds. Default: 30 */
  cooldownSecs: number;
}

const DEFAULT_CONFIG: BreakerConfig = {
  failureThreshold: 5,
  windowSecs: 60,
  cooldownSecs: 30,
};

// Redis key helpers
const failKey = (model: string) =>
  `cb:fail:${model.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
const openKey = (model: string) =>
  `cb:open:${model.replace(/[^a-zA-Z0-9_-]/g, "_")}`;

export class CircuitBreaker {
  private config: BreakerConfig;

  constructor(
    private redis: Redis | null,
    config: Partial<BreakerConfig> = {},
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Returns the current state for a model.
   * CLOSED  → healthy, allow requests
   * OPEN    → failing, skip this model
   * HALF_OPEN → cooldown expired, allow one probe request
   */
  async getState(model: string): Promise<BreakerState> {
    if (!this.redis) return "CLOSED";

    try {
      const isOpen = await this.redis.exists(openKey(model));
      if (isOpen) return "OPEN";

      // Check if we were recently open but the key expired (HALF_OPEN probe)
      const failures = await this.redis.get(failKey(model));
      const count = failures ? parseInt(failures, 10) : 0;

      // If failure count is at/above threshold but the open key expired,
      // we're in HALF_OPEN — allow one probe.
      if (count >= this.config.failureThreshold) return "HALF_OPEN";

      return "CLOSED";
    } catch {
      // Redis unavailable — fail open (allow the request through)
      return "CLOSED";
    }
  }

  /**
   * Record a successful response. Resets failure count and closes the circuit.
   */
  async recordSuccess(model: string): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.del(failKey(model), openKey(model));
    } catch {
      // best-effort
    }
  }

  /**
   * Record a failure. If the threshold is crossed, opens the circuit.
   * Returns the new state after recording.
   */
  async recordFailure(model: string): Promise<BreakerState> {
    if (!this.redis) return "CLOSED";

    try {
      const fk = failKey(model);
      const ok = openKey(model);

      // Atomically increment failure counter with a rolling window TTL
      const pipeline = this.redis.pipeline();
      pipeline.incr(fk);
      pipeline.expire(fk, this.config.windowSecs);
      const results = await pipeline.exec();

      const count = (results?.[0]?.[1] as number) ?? 0;

      if (count >= this.config.failureThreshold) {
        // Open the circuit — set a key that expires after cooldownSecs
        await this.redis.set(ok, "1", "EX", this.config.cooldownSecs);
        return "OPEN";
      }

      return "CLOSED";
    } catch {
      return "CLOSED";
    }
  }

  /**
   * Forcibly reset a model's circuit (useful in admin tooling or tests).
   */
  async reset(model: string): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.del(failKey(model), openKey(model));
    } catch {
      // best-effort
    }
  }
}
