import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getServerEnv } from "@chatspin/config";
import * as schema from "../db/schema.js";
import { logger } from "./logger.js";

const env = getServerEnv();

/**
 * PostgreSQL client via postgres.js.
 */
const queryClient = postgres(env.DATABASE_URL, {
  max: 20,
  idle_timeout: 30,
  connect_timeout: 10,
});

/**
 * Drizzle ORM instance initialized with application schema.
 */
export const db = drizzle(queryClient, { schema });

/**
 * Check PostgreSQL database health.
 */
export async function checkDbHealth(): Promise<boolean> {
  try {
    const result = await queryClient`SELECT 1 as alive`;
    return result.length > 0 && result[0]?.["alive"] === 1;
  } catch (error) {
    logger.error({ error }, "Database health check failed");
    return false;
  }
}
