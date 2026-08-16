import { db } from "../lib/db.js";
import { redis } from "../lib/redis.js";
import { logger } from "../lib/logger.js";
import { anonymousDevices, users, sessions } from "../db/schema.js";
import { eq } from "drizzle-orm";
import {
  SessionState,
  PRESENCE_TTL_MS,
  SESSION_HEARTBEAT_TIMEOUT_MS,
  SESSION_RECONNECT_WINDOW_MS,
  WsErrorCode,
} from "@chatspin/shared";

export interface ResolvedSession {
  sessionId: string;
  deviceId: string | null;
  userId: string | null;
  identityType: "anonymous" | "google";
  ipAddress: string;
}

export class SessionService {
  /**
   * Initializes or restores a session from a session:init request.
   */
  async initSession(params: {
    deviceToken: string;
    authToken?: string;
    socketId: string;
    ipAddress: string;
    userAgent?: string;
    fingerprint?: string;
  }): Promise<{ session: ResolvedSession; isMultiTab: boolean }> {
    const { deviceToken, socketId, ipAddress, userAgent, fingerprint } = params;

    // 1. Resolve identity
    let userId: string | null = null;
    let deviceId: string | null = null;
    let identityType: "anonymous" | "google" = "anonymous";

    // Check if optional Google auth token is provided (in production: verified JWT)
    if (params.authToken) {
      // TODO: Verify NextAuth JWT token and extract user id
      // For now, if valid user ID extracted:
      // userId = verifiedUserId; identityType = "google";
    }

    // If anonymous: resolve or create anonymous_devices record
    if (!userId) {
      const [existingDevice] = await db
        .select()
        .from(anonymousDevices)
        .where(eq(anonymousDevices.deviceToken, deviceToken))
        .limit(1);

      if (existingDevice) {
        deviceId = existingDevice.id;
        await db
          .update(anonymousDevices)
          .set({ lastSeenAt: new Date(), fingerprint })
          .where(eq(anonymousDevices.id, existingDevice.id));
      } else {
        const [newDevice] = await db
          .insert(anonymousDevices)
          .values({
            deviceToken,
            fingerprint,
          })
          .returning();
        deviceId = newDevice!.id;
      }
    }

    // 2. Create session record in PostgreSQL
    const [newSession] = await db
      .insert(sessions)
      .values({
        deviceId: deviceId ?? undefined,
        userId: userId ?? undefined,
        ipAddress,
        userAgent,
      })
      .returning();

    const sessionId = newSession!.id;

    // 3. Check Multi-Tab lock: SET tab:{sessionId} socketId NX EX 60
    const tabLockAcquired = await redis.set(
      `tab:${sessionId}`,
      socketId,
      "NX",
      "EX",
      60
    );

    if (!tabLockAcquired) {
      logger.warn({ sessionId, socketId, ipAddress }, "Duplicate session detected (multi-tab)");
      return {
        session: {
          sessionId,
          deviceId,
          userId,
          identityType,
          ipAddress,
        },
        isMultiTab: true,
      };
    }

    // 4. Store Session HASH in Redis
    const sessionData = {
      sessionId,
      socketId,
      podId: process.env["HOSTNAME"] ?? "local",
      ipAddress,
      identityType,
      deviceId: deviceId ?? "",
      userId: userId ?? "",
      state: SessionState.READY,
      matchId: "",
      createdAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
    };

    await redis.hset(`session:${sessionId}`, sessionData);
    await redis.expire(`session:${sessionId}`, 1800); // 30 min TTL

    // Socket reverse lookup
    await redis.set(`session:socket:${socketId}`, sessionId, "EX", 1800);

    // Initial presence key
    await redis.set(`presence:${sessionId}`, "online", "PX", PRESENCE_TTL_MS);

    logger.info(
      { sessionId, identityType, deviceId, userId, socketId },
      "Session initialized successfully"
    );

    return {
      session: {
        sessionId,
        deviceId,
        userId,
        identityType,
        ipAddress,
      },
      isMultiTab: false,
    };
  }

  /**
   * Refreshes heartbeat and presence TTLs for an active session.
   */
  async processHeartbeat(socketId: string): Promise<boolean> {
    const sessionId = await redis.get(`session:socket:${socketId}`);
    if (!sessionId) return false;

    // Update presence key TTL
    await redis.set(`presence:${sessionId}`, "online", "PX", PRESENCE_TTL_MS);

    // Refresh tab lock TTL
    await redis.expire(`tab:${sessionId}`, 60);

    // Refresh session HASH TTL and lastSeenAt field
    await redis.hset(`session:${sessionId}`, "lastSeenAt", new Date().toISOString());
    await redis.expire(`session:${sessionId}`, 1800);

    return true;
  }

  /**
   * Handles WebSocket disconnect for a socket.
   */
  async handleDisconnect(socketId: string): Promise<{ sessionId: string | null }> {
    const sessionId = await redis.get(`session:socket:${socketId}`);
    if (!sessionId) return { sessionId: null };

    // Clean reverse lookup & tab lock
    await redis.del(`session:socket:${socketId}`);
    await redis.del(`tab:${sessionId}`);

    // Update session state in Redis to DISCONNECTED
    await redis.hset(`session:${sessionId}`, {
      state: SessionState.DISCONNECTED,
      disconnectedAt: new Date().toISOString(),
    });

    // Remove presence key (or let it expire)
    await redis.del(`presence:${sessionId}`);

    logger.info({ sessionId, socketId }, "Session socket disconnected");

    return { sessionId };
  }

  /**
   * Migrate anonymous device history to user account upon Google login.
   */
  async migrateAnonymousToUser(deviceId: string, userId: string): Promise<void> {
    // Update sessions, meet_history, friendships, blocks linking to deviceId -> set userId
    await db.update(sessions).set({ userId }).where(eq(sessions.deviceId, deviceId));
    logger.info({ deviceId, userId }, "Migrated anonymous device history to user account");
  }
}

export const sessionService = new SessionService();
