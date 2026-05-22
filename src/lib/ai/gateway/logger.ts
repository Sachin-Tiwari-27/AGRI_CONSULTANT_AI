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
      ts:         entry.timestamp.toISOString(),
      requestId:  entry.requestId,
      task:       entry.task,
      intended:   entry.modelIntended,
      used:       entry.modelUsed,
      degraded:   entry.degraded,
      tokens:     entry.tokensUsed,
      costUsd:    entry.estimatedCostUsd.toFixed(6),
      durationMs: entry.durationMs,
      cacheHit:   entry.cacheHit,
      ...(entry.errorType ? { error: entry.errorType } : {}),
    };

    if (process.env.NODE_ENV === "production") {
      // Single-line JSON for log aggregators (Vercel, Datadog, etc.)
      console.log(JSON.stringify(line));
    } else {
      // Human-readable in development
      const degradedFlag = entry.degraded ? " ⚠ DEGRADED" : "";
      const cacheFlag    = entry.cacheHit  ? " (cache)" : "";
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

export class SupabaseLoggerPlugin implements LoggerPlugin {
  async log(entry: GatewayLogEntry): Promise<void> {
    try {
      // Dynamic import keeps Supabase out of the gateway's core bundle —
      // projects that don't use Supabase simply don't import this plugin.
      const { createServiceClient } = await import("@/lib/supabase/server");
      const supabase = await createServiceClient();

      await supabase.from("ai_usage_log").insert({
        request_id:          entry.requestId,
        task:                entry.task,
        model_intended:      entry.modelIntended,
        model:               entry.modelUsed,       // existing column
        provider:            entry.providerUsed,    // existing column
        degraded:            entry.degraded,
        fallback_chain:      entry.fallbackChain,
        tokens_used:         entry.tokensUsed,      // existing column
        estimated_cost_usd:  entry.estimatedCostUsd,
        duration_ms:         entry.durationMs,      // existing column
        cache_hit:           entry.cacheHit,
        error_type:          entry.errorType ?? null,
        project_id:          entry.projectId ?? null,
        consultant_id:       entry.consultantId ?? null,
      });
    } catch (err) {
      // Never let a logger failure bubble up to the caller
      console.error("[Gateway] Supabase logger failed:", (err as Error).message);
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
