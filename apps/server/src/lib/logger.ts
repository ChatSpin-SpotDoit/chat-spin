import pino from "pino";
import { getServerEnv } from "@chatspin/config";

const env = getServerEnv();

/**
 * Structured JSON logger using Pino.
 *
 * Every log line includes:
 *   - timestamp (ISO 8601)
 *   - level
 *   - service name
 *   - instanceId (hostname) — critical for multi-pod debugging
 *
 * Correlation IDs (requestId, sessionId, matchId) are added per-request
 * using logger.child({ requestId, sessionId, matchId }).
 *
 * Sensitive data NEVER logged:
 *   - SDP payloads
 *   - ICE candidate bodies
 *   - Raw IP addresses (hash or omit)
 *   - Message content
 *   - Auth tokens
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  base: {
    service: "chatspin-server",
    instanceId: process.env["HOSTNAME"] ?? "local",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  // In development, use pretty printing for readability
  ...(env.NODE_ENV === "development"
    ? {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss",
            ignore: "pid,hostname,service,instanceId",
          },
        },
      }
    : {}),
});

export type Logger = typeof logger;
