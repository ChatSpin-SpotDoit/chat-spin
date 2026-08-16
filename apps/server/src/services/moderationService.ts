import { db } from "../lib/db.js";
import { redis } from "../lib/redis.js";
import { logger } from "../lib/logger.js";
import { reports, blocks, bans } from "../db/schema.js";
import { eq, or, and, gte } from "drizzle-orm";

export class ModerationService {
  /**
   * Reports a user for inappropriate behavior.
   * Triggers automatic 24-hour temporary ban if > 3 reports in 24 hours.
   */
  async reportUser(params: {
    reporterSessionId: string;
    matchId: string;
    category: string;
    description?: string;
  }): Promise<{ reportId: string; autoBanned: boolean }> {
    const { reporterSessionId, matchId, category, description } = params;

    // 1. Get match details to find reported peer session
    const matchData = await redis.hgetall(`match:${matchId}`);
    if (!matchData || !matchData["sessionA"]) {
      throw new Error("Match not found or expired");
    }

    const reportedSessionId =
      matchData["sessionA"] === reporterSessionId
        ? matchData["sessionB"]
        : matchData["sessionA"];

    if (!reportedSessionId) {
      throw new Error("Reported peer not found");
    }

    // 2. Insert report row
    const [inserted] = await db
      .insert(reports)
      .values({
        reporterId: reporterSessionId,
        reportedId: reportedSessionId,
        matchId,
        category,
        description,
      })
      .returning();

    const reportId = inserted!.id;

    // 3. Check auto-ban threshold (> 3 reports in last 24h)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentReports = await db
      .select()
      .from(reports)
      .where(
        and(
          eq(reports.reportedId, reportedSessionId),
          gte(reports.createdAt, twentyFourHoursAgo)
        )
      );

    let autoBanned = false;
    if (recentReports.length >= 3) {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24hr temp ban
      await db.insert(bans).values({
        sessionId: reportedSessionId,
        reason: `Automated temporary 24h ban (${recentReports.length} reports in 24h)`,
        expiresAt,
        createdBy: "system_autoban",
      });

      autoBanned = true;
      logger.warn({ reportedSessionId, recentReportCount: recentReports.length }, "Auto-ban triggered for user");
    }

    logger.info({ reportId, reporterSessionId, reportedSessionId, category }, "Report submitted");
    return { reportId, autoBanned };
  }

  /**
   * Blocks a user, adding to DB blocks table and updating Redis blocks set for matchmaking exclusion.
   */
  async blockUser(blockerSessionId: string, matchId: string): Promise<void> {
    const matchData = await redis.hgetall(`match:${matchId}`);
    if (!matchData || !matchData["sessionA"]) return;

    const blockedSessionId =
      matchData["sessionA"] === blockerSessionId
        ? matchData["sessionB"]
        : matchData["sessionA"];

    if (!blockedSessionId) return;

    // Insert block DB record
    await db.insert(blocks).values({
      blockerSessionId,
      blockedFingerprint: blockedSessionId,
    });

    // Add to Redis block SET
    await redis.sadd(`blocks:${blockerSessionId}`, blockedSessionId);
    await redis.expire(`blocks:${blockerSessionId}`, 86400 * 30); // 30 day TTL

    logger.info({ blockerSessionId, blockedSessionId }, "User blocked");
  }

  /**
   * Applies a manual ban to an IP, fingerprint, or userId.
   */
  async applyBan(params: {
    ipAddress?: string;
    fingerprint?: string;
    userId?: string;
    reason: string;
    expiresAt?: Date;
  }): Promise<void> {
    await db.insert(bans).values({
      ipAddress: params.ipAddress,
      fingerprint: params.fingerprint,
      userId: params.userId,
      reason: params.reason,
      expiresAt: params.expiresAt,
      createdBy: "admin",
    });

    if (params.ipAddress) {
      await redis.set(`bancheck:${params.ipAddress}`, "banned", "EX", 3600);
    }

    logger.warn({ params }, "Manual ban applied");
  }
}

export const moderationService = new ModerationService();
