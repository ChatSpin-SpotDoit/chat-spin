import { z } from "zod";

/**
 * Server environment schema.
 * All required vars must be present — app will crash at startup with a clear error if not.
 * This is intentional: no silent failures with undefined env vars.
 */
const serverEnvSchema = z.object({
  // ─── Node ─────────────────────────────────────────────────────────────────
  NODE_ENV: z.enum(["development", "staging", "production", "test"]).default("development"),

  // ─── Server ───────────────────────────────────────────────────────────────
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  // ─── Database ─────────────────────────────────────────────────────────────
  DATABASE_URL: z.string().url(),

  // ─── Redis ────────────────────────────────────────────────────────────────
  REDIS_URL: z.string().default("redis://localhost:6379"),

  // ─── Auth ─────────────────────────────────────────────────────────────────
  NEXTAUTH_SECRET: z.string().min(32),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),

  // ─── CORS ─────────────────────────────────────────────────────────────────
  ALLOWED_ORIGINS: z.string().default("http://localhost:3000"),

  // ─── TURN ─────────────────────────────────────────────────────────────────
  TURN_ENABLED: z
    .string()
    .transform((v) => v === "true")
    .default("false"),
  COTURN_HOST: z.string().default("localhost"),
  COTURN_PORT: z.coerce.number().int().default(3478),
  COTURN_TLS_PORT: z.coerce.number().int().default(5349),
  COTURN_SECRET: z.string().default("changeme"),
  TURN_CREDENTIAL_TTL: z.coerce.number().int().default(3600),

  // ─── Friends ──────────────────────────────────────────────────────────────
  AUTO_FRIEND_THRESHOLD_SECONDS: z.coerce.number().int().min(1).default(10),
  FRIEND_CALL_RING_TIMEOUT_SECONDS: z.coerce.number().int().min(10).default(45),

  // ─── Chat ─────────────────────────────────────────────────────────────────
  CHAT_RETENTION_DAYS: z.coerce.number().int().min(1).default(7),
  DM_RETENTION_DAYS: z.coerce.number().int().min(1).default(90),
  FRIEND_REQUEST_EXPIRY_DAYS: z.coerce.number().int().min(1).default(7),

  // ─── Session ──────────────────────────────────────────────────────────────
  SESSION_HEARTBEAT_TIMEOUT_MS: z.coerce.number().int().default(30_000),
  SESSION_RECONNECT_WINDOW_MS: z.coerce.number().int().default(10_000),

  // ─── Matchmaking ──────────────────────────────────────────────────────────
  MATCHMAKING_POLL_INTERVAL_MS: z.coerce.number().int().default(500),
  MATCH_FOUND_TIMEOUT_MS: z.coerce.number().int().default(10_000),
  STALE_QUEUE_MAX_AGE_MS: z.coerce.number().int().default(300_000),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let _serverEnv: ServerEnv | null = null;

/**
 * Validates and returns the server environment config.
 * Throws a clear error on first call if any required var is missing.
 * Cached after first parse — safe to call anywhere.
 */
export function getServerEnv(): ServerEnv {
  if (_serverEnv) return _serverEnv;

  const result = serverEnvSchema.safeParse(process.env);

  if (!result.success) {
    console.error("❌ Invalid environment variables:\n");
    console.error(result.error.format());
    throw new Error("Invalid environment variables configuration");
  }

  _serverEnv = result.data;
  return _serverEnv;
}

/**
 * Reset cached env (useful for testing only).
 */
export function _resetServerEnv(): void {
  _serverEnv = null;
}
