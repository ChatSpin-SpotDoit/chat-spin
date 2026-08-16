import { getServerEnv } from "@chatspin/config";
import { buildApp } from "./app.js";
import { logger } from "./lib/logger.js";
import { redis, redisSubscriber } from "./lib/redis.js";

const env = getServerEnv();

async function main() {
  const app = await buildApp();

  // Graceful shutdown handler
  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutdown signal received. Draining connections...");

    try {
      await app.close();
      logger.info("Fastify server closed");

      await redis.quit();
      await redisSubscriber.quit();
      logger.info("Redis connections closed");

      process.exit(0);
    } catch (err) {
      logger.error({ err }, "Error during graceful shutdown");
      process.exit(1);
    }
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  try {
    const address = await app.listen({ port: env.PORT, host: env.HOST });
    logger.info({ address, port: env.PORT, env: env.NODE_ENV }, "ChatSpin server started");
  } catch (err) {
    logger.fatal({ err }, "Failed to start server");
    process.exit(1);
  }
}

void main();
