// ── Public surface of the AI gateway ─────────────────────────────────────────
//
// Import from "@/lib/ai/gateway" in application code.
// Do not import individual modules directly — internal structure may change.

// Main execute function (via singleton)
export { gateway } from "./gateway";
export type { Gateway } from "./gateway";

// Types callers need
export type {
  GatewayRequest,
  GatewayResponse,
  GatewayLogEntry,
  ModelRef,
  TaskRoute,
  AIProvider,
} from "./types";

// Typed errors (for catch blocks that need to inspect error type)
export {
  GatewayError,
  RateLimitError,
  ModelUnavailableError,
  TimeoutError,
  MalformedResponseError,
  AuthError,
  AllModelsExhaustedError,
} from "./types";

// Data cache (used by search.service.ts and any future data fetch)
export { DataCache, CACHE_TTL } from "./data-cache";

// Logger plugins (for custom backend registration)
export type { LoggerPlugin } from "./logger";
export { ConsoleLoggerPlugin, SupabaseLoggerPlugin } from "./logger";

// Pricing utilities (for cost dashboards, etc.)
export { estimateCost, estimateCostDetailed, MODEL_PRICING } from "./pricing";

// Router (for introspection / admin tooling)
export { TASK_ROUTES, resolveRoute } from "./router";

// Redis client (if other parts of the app want to reuse the connection)
export { getRedisClient, getRedisClientSync } from "./redis";
