import { db } from "../lib/db.js";
import { redis } from "../lib/redis.js";
import { logger } from "../lib/logger.js";
import { chatMessages, chatMessageDeletions, chatSessionDeletions, matches } from "../db/schema.js";
import { eq, and, lte, notInArray, sql } from "drizzle-orm";
import { pubSubService } from "./pubsubService.js";
import { CHAT_DELETE_EVERYONE_WINDOW_MS } from "@chatspin/shared";

export class ChatService {
  /**
   * Saves and relays a new text chat message during a match.
   */
  async sendMessage(params: {
    matchId: string;
    senderSessionId: string;
    content: string;
    messageId?: string;
  }): Promise<{ messageId: string; sentAt: Date } | null> {
    const { matchId, senderSessionId, content } = params;

    // 1. Verify sender is part of this active match in Redis
    const matchData = await redis.hgetall(`match:${matchId}`);
    if (!matchData || !matchData["sessionA"]) {
      logger.warn({ senderSessionId, matchId }, "Chat message rejected: match not found or expired");
      return null;
    }

    const peerSessionId =
      matchData["sessionA"] === senderSessionId
        ? matchData["sessionB"]
        : matchData["sessionA"];

    if (!peerSessionId) return null;

    // 2. Persist to PostgreSQL
    const [inserted] = await db
      .insert(chatMessages)
      .values({
        id: params.messageId,
        matchId,
        senderSessionId,
        content: content.slice(0, 1000), // Enforce 1000 char max
      })
      .returning();

    const messageId = inserted!.id;
    const sentAt = inserted!.sentAt;

    // 3. Relay to peer via Pub/Sub
    await pubSubService.publishToSession(peerSessionId, {
      type: "chat:message",
      matchId,
      messageId,
      content,
      senderSessionId,
      sentAt: sentAt.toISOString(),
    });

    logger.debug({ matchId, senderSessionId, messageId }, "Chat message saved and relayed");
    return { messageId, sentAt };
  }

  /**
   * Deletes a specific chat message (scope: "me" or "everyone").
   */
  async deleteMessage(params: {
    messageId: string;
    sessionId: string;
    scope: "me" | "everyone";
  }): Promise<{ success: boolean; error?: string }> {
    const { messageId, sessionId, scope } = params;

    const [msg] = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.id, messageId))
      .limit(1);

    if (!msg) {
      return { success: false, error: "Message not found" };
    }

    if (scope === "me") {
      // Per-user soft delete
      await db
        .insert(chatMessageDeletions)
        .values({ messageId, sessionId })
        .onConflictDoNothing();

      return { success: true };
    } else {
      // Delete for everyone — only allowed within 5-minute window by the sender
      if (msg.senderSessionId !== sessionId) {
        return { success: false, error: "Only the sender can delete for everyone" };
      }

      const elapsed = Date.now() - msg.sentAt.getTime();
      if (elapsed > CHAT_DELETE_EVERYONE_WINDOW_MS) {
        return { success: false, error: "Delete for everyone window expired (5 minutes)" };
      }

      await db
        .update(chatMessages)
        .set({
          isDeletedForEveryone: true,
          deletedForEveryoneAt: new Date(),
        })
        .where(eq(chatMessages.id, messageId));

      // Notify peer via Pub/Sub
      const matchData = await redis.hgetall(`match:${msg.matchId}`);
      if (matchData && matchData["sessionA"]) {
        const peerSessionId =
          matchData["sessionA"] === sessionId
            ? matchData["sessionB"]
            : matchData["sessionA"];

        if (peerSessionId) {
          await pubSubService.publishToSession(peerSessionId, {
            type: "chat:message-deleted",
            matchId: msg.matchId,
            messageId,
          });
        }
      }

      return { success: true };
    }
  }

  /**
   * Deletes an entire conversation view for a user.
   */
  async deleteSessionChat(matchId: string, sessionId: string): Promise<void> {
    await db
      .insert(chatSessionDeletions)
      .values({ matchId, sessionId })
      .onConflictDoNothing();

    logger.info({ matchId, sessionId }, "Deleted entire conversation view for session");
  }

  /**
   * Daily purge job deleting messages older than 7 days.
   */
  async purgeExpiredMessages(): Promise<number> {
    const result = await db
      .delete(chatMessages)
      .where(lte(chatMessages.purgeAfter, new Date()))
      .returning();

    logger.info({ count: result.length }, "Purged expired 7-day chat messages");
    return result.length;
  }
}

export const chatService = new ChatService();
