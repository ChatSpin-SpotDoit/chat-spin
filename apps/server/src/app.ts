import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import websocket from "@fastify/websocket";
import { getServerEnv } from "@chatspin/config";
import { logger } from "./lib/logger.js";
import { checkDbHealth } from "./lib/db.js";
import { checkRedisHealth } from "./lib/redis.js";

const env = getServerEnv();

export async function buildApp() {
  const app = Fastify({
    loggerInstance: logger,
    disableRequestLogging: false,
    requestIdHeader: "x-request-id",
  });

  // Register security plugins
  await app.register(helmet, {
    contentSecurityPolicy: env.NODE_ENV === "production",
  });

  await app.register(cors, {
    origin: env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()),
    credentials: true,
  });

  // Register WebSocket plugin
  await app.register(websocket, {
    options: {
      maxPayload: 64 * 1024, // 64KB max payload size limit
    },
  });

  // ─── Health Routes ──────────────────────────────────────────────────────────

  /**
   * Liveness probe: checks if process is alive and event loop responsive.
   */
  app.get("/health", async (_request, reply) => {
    return reply.status(200).send({
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "chatspin-server",
    });
  });

  /**
   * Readiness probe: checks if PostgreSQL and Redis connections are active.
   */
  app.get("/ready", async (_request, reply) => {
    const [dbOk, redisOk] = await Promise.all([checkDbHealth(), checkRedisHealth()]);

    const isReady = dbOk && redisOk;
    const statusCode = isReady ? 200 : 503;

    return reply.status(statusCode).send({
      status: isReady ? "ready" : "unready",
      checks: {
        database: dbOk ? "ok" : "failed",
        redis: redisOk ? "ok" : "failed",
      },
      timestamp: new Date().toISOString(),
    });
  });

  return app;
}
