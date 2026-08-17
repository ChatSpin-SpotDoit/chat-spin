import { redis } from "../lib/redis.js";
import { db } from "../lib/db.js";
import { logger } from "../lib/logger.js";
import { matches, meetHistory, friendships, bans } from "../db/schema.js";
import { eq, or, and } from "drizzle-orm";
import { pubSubService } from "./pubsubService.js";
import { signalingService } from "./signalingService.js";
import { getServerEnv } from "@chatspin/config";
import {
  SessionState,
  PeerRole,
  MatchEndReason,
  FriendshipOrigin,
} from "@chatspin/shared";
import crypto from "crypto";

const env = getServerEnv();

export class MatchmakingService {
  private workerTimer: ReturnType<typeof setInterval> | null = null;
  private autoFriendTimer: ReturnType<typeof setInterval> | null = null;
  private isProcessing = false;

  constructor() {
    this.startWorker();
    this.startAutoFriendWorker();
  }

  /**
   * Adds a session to the matchmaking queue.
   */
  async joinQueue(sessionId: string, ipAddress: string, fingerprint?: string): Promise<boolean> {
    // 1. Ban check
    const [existingBan] = await db
      .select()
      .from(bans)
      .where(
        or(
          eq(bans.sessionId, sessionId),
          eq(bans.ipAddress, ipAddress),
          fingerprint ? eq(bans.fingerprint, fingerprint) : undefined
        )
      )
      .limit(1);

    if (existingBan) {
      if (!existingBan.expiresAt || existingBan.expiresAt > new Date()) {
        logger.warn({ sessionId, ipAddress }, "Banned user attempted to join queue");
        return false;
      }
    }

    // 2. Update session state to SEARCHING
    await redis.hset(`session:${sessionId}`, "state", SessionState.SEARCHING);

    // 3. Add to Redis ZSET with current timestamp as score
    const now = Date.now();
    await redis.zadd("queue:waiting", now, sessionId);

    logger.info({ sessionId }, "Session joined matchmaking queue");
    return true;
  }

  /**
   * Removes a session from the matchmaking queue.
   */
  async leaveQueue(sessionId: string): Promise<void> {
    await redis.zrem("queue:waiting", sessionId);
    await redis.hset(`session:${sessionId}`, "state", SessionState.READY);
    logger.info({ sessionId }, "Session left matchmaking queue");
  }

  /**
   * Worker loop running every MATCHMAKING_POLL_INTERVAL_MS (500ms).
   */
  private startWorker() {
    this.workerTimer = setInterval(() => {
      void this.processQueue();
    }, env.MATCHMAKING_POLL_INTERVAL_MS);
  }

  /**
   * Processes queue and pairs waiting sessions.
   */
  private async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      // Get all sessions waiting in ZSET ordered by score (FIFO)
      const waitingSessions = await redis.zrange("queue:waiting", 0, 50);
      if (waitingSessions.length < 2) {
        this.isProcessing = false;
        return;
      }

      for (let i = 0; i < waitingSessions.length - 1; i += 2) {
        const sessionA = waitingSessions[i]!;
        const sessionB = waitingSessions[i + 1]!;

        // Check if either session is blocked by the other
        const isBlocked = await this.checkBlockExclusion(sessionA, sessionB);
        if (isBlocked) continue;

        // Atomic lock attempt for pairing sessionA & sessionB
        const paired = await this.tryPairSessions(sessionA, sessionB);
        if (paired) {
          logger.info({ sessionA, sessionB }, "Successfully paired two sessions");
        }
      }
    } catch (err) {
      logger.error({ err }, "Error in matchmaking queue worker");
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Check if sessionA or sessionB has blocked the other.
   * Uses the Redis blocks:<sessionId> SSET written by moderationService.blockUser().
   */
  private async checkBlockExclusion(sessionA: string, sessionB: string): Promise<boolean> {
    const [aBlockedB, bBlockedA] = await Promise.all([
      redis.sismember(`blocks:${sessionA}`, sessionB),
      redis.sismember(`blocks:${sessionB}`, sessionA),
    ]);
    return aBlockedB === 1 || bBlockedA === 1;
  }

  /**
   * Atomically pairs two sessions using Redis locks & creates match.
   */
  private async tryPairSessions(sessionA: string, sessionB: string): Promise<boolean> {
    const lockA = await redis.set(`lock:match:${sessionA}`, "1", "EX", 5, "NX");
    const lockB = await redis.set(`lock:match:${sessionB}`, "1", "EX", 5, "NX");

    if (!lockA || !lockB) {
      if (lockA) await redis.del(`lock:match:${sessionA}`);
      if (lockB) await redis.del(`lock:match:${sessionB}`);
      return false;
    }

    try {
      // Pop from queue
      await redis.zrem("queue:waiting", sessionA, sessionB);

      // Create match in PostgreSQL
      const [dbMatch] = await db
        .insert(matches)
        .values({
          sessionAId: sessionA,
          sessionBId: sessionB,
        })
        .returning();

      const matchId = dbMatch!.id;
      const nowMs = Date.now();

      // Store match in Redis
      const matchData = {
        matchId,
        sessionA,
        sessionB,
        state: "ACTIVE",
        createdAt: new Date().toISOString(),
        connectedSinceMs: nowMs.toString(),
      };

      await redis.hset(`match:${matchId}`, matchData);
      await redis.set(`match:session:${sessionA}`, matchId, "EX", 14400); // 4 hr TTL
      await redis.set(`match:session:${sessionB}`, matchId, "EX", 14400);

      // Update session states to IN_CALL
      await redis.hset(`session:${sessionA}`, { state: SessionState.IN_CALL, matchId });
      await redis.hset(`session:${sessionB}`, { state: SessionState.IN_CALL, matchId });

      // Generate short-lived HMAC-SHA1 TURN credentials via signalingService
      const turnCredentials = signalingService.generateTurnCredentials(matchId);

      // Notify Session A (Offerer)
      await pubSubService.publishToSession(sessionA, {
        type: "match:found",
        matchId,
        peerSessionId: sessionB,
        role: PeerRole.OFFERER,
        turnCredentials,
      });

      // Notify Session B (Answerer)
      await pubSubService.publishToSession(sessionB, {
        type: "match:found",
        matchId,
        peerSessionId: sessionA,
        role: PeerRole.ANSWERER,
        turnCredentials,
      });

      return true;
    } catch (err) {
      logger.error({ err, sessionA, sessionB }, "Failed to pair sessions");
      return false;
    } finally {
      await redis.del(`lock:match:${sessionA}`, `lock:match:${sessionB}`);
    }
  }

  /**
   * Skips an active match and returns skipper to the queue.
   */
  async skipMatch(skipperSessionId: string, matchId: string, ipAddress: string): Promise<void> {
    const lock = await redis.set(`lock:skip:${matchId}`, "1", "EX", 5, "NX");
    if (!lock) return; // Idempotent check

    try {
      const matchData = await redis.hgetall(`match:${matchId}`);
      if (!matchData || !matchData["sessionA"]) return;

      const peerSessionId =
        matchData["sessionA"] === skipperSessionId
          ? matchData["sessionB"]
          : matchData["sessionA"];

      const startTime = parseInt(matchData["connectedSinceMs"] || "0", 10);
      const durationMs = startTime > 0 ? Date.now() - startTime : 0;

      // Update DB record
      const endedAt = new Date();
      await db
        .update(matches)
        .set({
          endedAt,
          durationMs,
          endReason: MatchEndReason.SKIP,
        })
        .where(eq(matches.id, matchId));

      // Write meetHistory rows for both participants so the History page has data
      const sessionA = matchData["sessionA"]!;
      const sessionB = matchData["sessionB"]!;
      if (sessionA && sessionB) {
        await db.insert(meetHistory).values([
          {
            matchId,
            viewerDeviceId: null,
            viewerUserId: null,
            peerFingerprint: sessionB,
            peerUserId: null,
            startedAt: new Date(startTime || Date.now()),
            durationMs,
            endReason: MatchEndReason.SKIP,
          },
          {
            matchId,
            viewerDeviceId: null,
            viewerUserId: null,
            peerFingerprint: sessionA,
            peerUserId: null,
            startedAt: new Date(startTime || Date.now()),
            durationMs,
            endReason: MatchEndReason.SKIP,
          },
        ]).onConflictDoNothing();
      }

      // Clean Redis keys
      await redis.del(`match:${matchId}`);
      if (matchData["sessionA"]) await redis.del(`match:session:${matchData["sessionA"]}`);
      if (matchData["sessionB"]) await redis.del(`match:session:${matchData["sessionB"]}`);

      // Notify peer session
      if (peerSessionId) {
        await redis.hset(`session:${peerSessionId}`, "state", SessionState.READY);
        await pubSubService.publishToSession(peerSessionId, {
          type: "peer:disconnected",
          matchId,
        });
      }

      // Re-add skipper to queue automatically
      await this.joinQueue(skipperSessionId, ipAddress);

      logger.info({ skipperSessionId, peerSessionId, matchId }, "Match skipped");
    } finally {
      await redis.del(`lock:skip:${matchId}`);
    }
  }

  /**
   * Worker loop running every 30s to trigger auto-friendships for 5-minute calls.
   */
  private startAutoFriendWorker() {
    this.autoFriendTimer = setInterval(() => {
      void this.checkAutoFriendships();
    }, 30_000);
  }

  /**
   * Scans active matches and converts calls >= AUTO_FRIEND_THRESHOLD_SECONDS into friends.
   */
  private async checkAutoFriendships() {
    try {
      const matchKeys = await redis.keys("match:*");
      const now = Date.now();
      const thresholdMs = env.AUTO_FRIEND_THRESHOLD_SECONDS * 1000;

      for (const key of matchKeys) {
        if (key.includes(":session:")) continue;
        const matchData = await redis.hgetall(key);
        if (!matchData["connectedSinceMs"] || !matchData["sessionA"] || !matchData["sessionB"]) {
          continue;
        }

        const connectedSince = parseInt(matchData["connectedSinceMs"], 10);
        if (now - connectedSince >= thresholdMs) {
          const sessionA = matchData["sessionA"];
          const sessionB = matchData["sessionB"];

          // Check if already auto-friended for this match
          const [existingFriendship] = await db
            .select()
            .from(friendships)
            .where(
              and(
                eq(friendships.userASessionId, sessionA),
                eq(friendships.userBSessionId, sessionB)
              )
            )
            .limit(1);

          if (!existingFriendship) {
            const [newFriendship] = await db
              .insert(friendships)
              .values({
                matchId: matchData["matchId"],
                userASessionId: sessionA,
                userBSessionId: sessionB,
                origin: FriendshipOrigin.AUTO_DURATION,
              })
              .returning();

            const friendshipId = newFriendship!.id;

            // Notify both browsers
            await pubSubService.publishToSession(sessionA, {
              type: "friend:auto-connected",
              friendshipId,
              friendSessionId: sessionB,
            });
            await pubSubService.publishToSession(sessionB, {
              type: "friend:auto-connected",
              friendshipId,
              friendSessionId: sessionA,
            });

            logger.info({ sessionA, sessionB, friendshipId }, "Auto-friendship created after 5min call");
          }
        }
      }
    } catch (err) {
      logger.error({ err }, "Error in auto-friendship worker");
    }
  }

  public stop() {
    if (this.workerTimer) clearInterval(this.workerTimer);
    if (this.autoFriendTimer) clearInterval(this.autoFriendTimer);
  }
}

export const matchmakingService = new MatchmakingService();
