import { Redis } from "ioredis";
import { getServerEnv } from "@chatspin/config";
import { logger } from "./logger.js";

const env = getServerEnv();

/**
 * Primary Redis client instance for session/presence state and atomic matchmaking.
 */
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true,
});

/**
 * Pub/Sub subscriber client instance (ioredis requires dedicated connection for subscriptions).
 */
export const redisSubscriber = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true,
});

redis.on("error", (err) => {
  logger.error({ err }, "Redis connection error");
});

redis.on("connect", () => {
  logger.info("Connected to Redis");
});

redisSubscriber.on("error", (err) => {
  logger.error({ err }, "Redis subscriber connection error");
});

/**
 * Ping Redis to check health/readiness.
 */
export async function checkRedisHealth(): Promise<boolean> {
  try {
    const pong = await redis.ping();
    return pong === "PONG";
  } catch (error) {
    logger.error({ error }, "Redis health check failed");
    return false;
  }
}
