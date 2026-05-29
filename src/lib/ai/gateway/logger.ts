import type { GatewayLogEntry } from "./types";

// ── Logger plugin interface ───────────────────────────────────────────────────
//
// The gateway accepts an array of LoggerPlugin instances. Each plugin receives
// every completed log entry. Plugins are called in parallel, fire-and-forget —
// a slow or failing plugin never blocks the response.
//
// Built-in plugins:
//   ConsoleLoggerPlugin   — structured JSON to stdout (used in production)
//   SupabaseLoggerPlugin  — writes to ai_usage_log table
//
// Adding a new backend (Datadog, Posthog, etc.) is a new plugin file — nothing
// else in the gateway changes.

export interface LoggerPlugin {
  log(entry: GatewayLogEntry): Promise<void>;
}

// ── Console logger ────────────────────────────────────────────────────────────

export class ConsoleLoggerPlugin implements LoggerPlugin {
  async log(entry: GatewayLogEntry): Promise<void> {
    const line = {
      ts: entry.timestamp.toISOString(),
      requestId: entry.requestId,
      task: entry.task,
      intended: entry.modelIntended,
      used: entry.modelUsed,
      degraded: entry.degraded,
      tokens: entry.tokensUsed,
      costUsd: entry.estimatedCostUsd.toFixed(6),
      durationMs: entry.durationMs,
      cacheHit: entry.cacheHit,
      ...(entry.errorType ? { error: entry.errorType } : {}),
    };

    if (process.env.NODE_ENV === "production") {
      // Single-line JSON for log aggregators (Vercel, Datadog, etc.)
      console.log(JSON.stringify(line));
    } else {
      // Human-readable in development
      const degradedFlag = entry.degraded ? " ⚠ DEGRADED" : "";
      const cacheFlag = entry.cacheHit ? " (cache)" : "";
      console.log(
        `[Gateway] ${entry.task} → ${entry.modelUsed}${degradedFlag}${cacheFlag}` +
          ` | ${entry.tokensUsed} tok | ${entry.durationMs}ms | $${line.costUsd}`,
      );
    }
  }
}

// ── Supabase logger ───────────────────────────────────────────────────────────
//
// Writes to the ai_usage_log table. Uses the service client so it can write
// from server-side routes without RLS blocking it.
// Requires the migration in PR4 to have been applied.

export class SupabaseLoggerPlugin {
  async log(entry: GatewayLogEntry): Promise<void> {
    // Skip logging if we're in a test environment
    if (process.env.NODE_ENV === "test") return;

    try {
      const supabase = await this.getClient();
      if (!supabase) {
        if (process.env.NODE_ENV === "development") {
          console.warn(
            "[Gateway Logger] No Supabase client available — skipping usage log",
          );
        }
        return;
      }

      const { error } = await supabase.from("ai_usage_log").insert({
        request_id: entry.requestId,
        task: entry.task,
        model_intended: entry.modelIntended,
        model: entry.modelUsed,
        provider: entry.providerUsed,
        degraded: entry.degraded,
        fallback_chain: entry.fallbackChain,
        tokens_used: entry.tokensUsed,
        estimated_cost_usd: entry.estimatedCostUsd,
        duration_ms: entry.durationMs,
        cache_hit: entry.cacheHit,
        error_type: entry.errorType ?? null,
        project_id: entry.projectId ?? null,
        consultant_id: entry.consultantId ?? null,
      });

      if (error) {
        // Log in development but never throw
        if (process.env.NODE_ENV === "development") {
          console.error(
            "[Gateway Logger] Insert failed:",
            error.message,
            error.code,
          );
          console.error(
            "[Gateway Logger] Hint: Run the 20260526_report_formats.sql migration to add INSERT policies",
          );
        }
      }
    } catch (err) {
      // Never let logger failure propagate
      if (process.env.NODE_ENV === "development") {
        console.error(
          "[Gateway Logger] Unexpected error:",
          (err as Error).message,
        );
      }
    }
  }

  private async getClient() {
    // Try service client first (bypasses RLS)
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!supabaseUrl) return null;

    if (serviceKey) {
      try {
        const { createServiceClient } = await import("@/lib/supabase/server");
        return await createServiceClient();
      } catch {
        // Service client unavailable (e.g. not in Next.js request context)
      }
    }

    // Fall back to regular server client
    try {
      const { createClient } = await import("@/lib/supabase/server");
      return await createClient();
    } catch {
      return null;
    }
  }
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

export class GatewayLogger {
  constructor(private plugins: LoggerPlugin[]) {}

  /**
   * Fire all plugins in parallel, non-blocking.
   * This is called after every gateway response — success or failure.
   */
  emit(entry: GatewayLogEntry): void {
    // setImmediate pushes logging off the critical path
    setImmediate(() => {
      Promise.allSettled(this.plugins.map((p) => p.log(entry))).catch(
        () => {}, // allSettled never rejects, but belt-and-suspenders
      );
    });
  }
}
