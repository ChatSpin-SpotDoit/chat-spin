import { db } from "../lib/db.js";
import { redis } from "../lib/redis.js";
import { logger } from "../lib/logger.js";
import { friendships, friendCalls, directMessages, dmDeletions } from "../db/schema.js";
import { eq, or, and, lte, desc } from "drizzle-orm";
import { pubSubService } from "./pubsubService.js";
import { PeerRole, PresenceState, WsErrorCode } from "@chatspin/shared";
import crypto from "crypto";

export class FriendsService {
  /**
   * Retrieves all friendships for a session or user with real-time presence from Redis.
   */
  async getFriendsList(sessionId: string) {
    const list = await db
      .select()
      .from(friendships)
      .where(
        or(
          eq(friendships.userASessionId, sessionId),
          eq(friendships.userBSessionId, sessionId)
        )
      );

    const friends = await Promise.all(
      list.map(async (f) => {
        const friendSessionId =
          f.userASessionId === sessionId ? f.userBSessionId : f.userASessionId;

        const presenceKey = await redis.get(`presence:${friendSessionId}`);
        const sessionData = await redis.hgetall(`session:${friendSessionId}`);

        let presence = PresenceState.OFFLINE;
        if (presenceKey) {
          presence =
            sessionData["state"] === "IN_CALL"
              ? PresenceState.BUSY
              : PresenceState.ONLINE;
        }

        return {
          friendshipId: f.id,
          friendSessionId,
          presence,
          createdAt: f.createdAt,
        };
      })
    );

    return friends;
  }

  /**
   * Initiates a private call to an online friend.
   */
  async initiateCall(params: {
    callerSessionId: string;
    friendshipId: string;
    callId: string;
  }): Promise<{ success: boolean; error?: string }> {
    const { callerSessionId, friendshipId, callId } = params;

    const [friendship] = await db
      .select()
      .from(friendships)
      .where(eq(friendships.id, friendshipId))
      .limit(1);

    if (!friendship) {
      return { success: false, error: "Friendship not found" };
    }

    const calleeSessionId =
      friendship.userASessionId === callerSessionId
        ? friendship.userBSessionId
        : friendship.userASessionId;

    // Check callee online & not busy
    const presenceKey = await redis.get(`presence:${calleeSessionId}`);
    if (!presenceKey) {
      return { success: false, error: "Friend is offline" };
    }

    const calleeSession = await redis.hgetall(`session:${calleeSessionId}`);
    if (calleeSession["state"] === "IN_CALL") {
      return { success: false, error: "Friend is currently in another call" };
    }

    // Record call in DB
    await db.insert(friendCalls).values({
      id: callId,
      friendshipId,
      callerSessionId,
      calleeSessionId,
      status: "ringing",
    });

    // Store call in Redis with 45s ringing TTL
    await redis.hset(`friend-call:${callId}`, {
      callId,
      friendshipId,
      callerSessionId,
      calleeSessionId,
      status: "ringing",
    });
    await redis.expire(`friend-call:${callId}`, 45);

    // Notify callee
    await pubSubService.publishToSession(calleeSessionId, {
      type: "friend:incoming-call",
      callId,
      friendshipId,
      callerSessionId,
    });

    logger.info({ callId, callerSessionId, calleeSessionId }, "Friend call initiated");
    return { success: true };
  }

  /**
   * Accepts an incoming friend call.
   */
  async acceptCall(calleeSessionId: string, callId: string): Promise<boolean> {
    const callData = await redis.hgetall(`friend-call:${callId}`);
    if (!callData || !callData["callerSessionId"]) return false;

    const callerSessionId = callData["callerSessionId"];

    await db
      .update(friendCalls)
      .set({ status: "active", answeredAt: new Date() })
      .where(eq(friendCalls.id, callId));

    await redis.hset(`friend-call:${callId}`, "status", "active");

    // Notify caller that call was connected
    await pubSubService.publishToSession(callerSessionId, {
      type: "friend:call-connected",
      callId,
      role: PeerRole.OFFERER,
    });

    logger.info({ callId, callerSessionId, calleeSessionId }, "Friend call accepted");
    return true;
  }

  /**
   * Declines an incoming friend call.
   */
  async declineCall(calleeSessionId: string, callId: string): Promise<void> {
    const callData = await redis.hgetall(`friend-call:${callId}`);
    if (callData && callData["callerSessionId"]) {
      await pubSubService.publishToSession(callData["callerSessionId"], {
        type: "friend:call-declined",
        callId,
        reason: "User declined call",
      });
    }

    await db
      .update(friendCalls)
      .set({ status: "declined", endedAt: new Date() })
      .where(eq(friendCalls.id, callId));

    await redis.del(`friend-call:${callId}`);
    logger.info({ callId, calleeSessionId }, "Friend call declined");
  }

  /**
   * Relays friend WebRTC offer.
   */
  async relayFriendOffer(callerSessionId: string, callId: string, sdp: string): Promise<void> {
    const callData = await redis.hgetall(`friend-call:${callId}`);
    if (!callData) return;
    const targetSessionId =
      callData["callerSessionId"] === callerSessionId
        ? callData["calleeSessionId"]
        : callData["callerSessionId"];

    if (targetSessionId) {
      await pubSubService.publishToSession(targetSessionId, {
        type: "friend:webrtc:offer",
        callId,
        sdp,
      });
    }
  }

  /**
   * Relays friend WebRTC answer.
   */
  async relayFriendAnswer(calleeSessionId: string, callId: string, sdp: string): Promise<void> {
    const callData = await redis.hgetall(`friend-call:${callId}`);
    if (!callData) return;
    const targetSessionId =
      callData["callerSessionId"] === calleeSessionId
        ? callData["calleeSessionId"]
        : callData["callerSessionId"];

    if (targetSessionId) {
      await pubSubService.publishToSession(targetSessionId, {
        type: "friend:webrtc:answer",
        callId,
        sdp,
      });
    }
  }

  /**
   * Relays friend ICE candidate.
   */
  async relayFriendIceCandidate(
    sessionId: string,
    callId: string,
    candidate: string,
    sdpMid: string | null,
    sdpMLineIndex: number | null
  ): Promise<void> {
    const callData = await redis.hgetall(`friend-call:${callId}`);
    if (!callData) return;
    const targetSessionId =
      callData["callerSessionId"] === sessionId
        ? callData["calleeSessionId"]
        : callData["callerSessionId"];

    if (targetSessionId) {
      await pubSubService.publishToSession(targetSessionId, {
        type: "friend:webrtc:ice-candidate",
        callId,
        candidate,
        sdpMid,
        sdpMLineIndex,
      });
    }
  }

  /**
   * Sends a Direct Message to a friend.
   */
  async sendDmMessage(params: {
    friendshipId: string;
    senderSessionId: string;
    content: string;
    messageId?: string;
  }): Promise<{ messageId: string; sentAt: Date } | null> {
    const { friendshipId, senderSessionId, content } = params;

    const [friendship] = await db
      .select()
      .from(friendships)
      .where(eq(friendships.id, friendshipId))
      .limit(1);

    if (!friendship) return null;

    const recipientSessionId =
      friendship.userASessionId === senderSessionId
        ? friendship.userBSessionId
        : friendship.userASessionId;

    const [inserted] = await db
      .insert(directMessages)
      .values({
        id: params.messageId,
        friendshipId,
        senderSessionId,
        content: content.slice(0, 2000),
      })
      .returning();

    const messageId = inserted!.id;
    const sentAt = inserted!.sentAt;

    // Relay to recipient via Pub/Sub if online
    await pubSubService.publishToSession(recipientSessionId, {
      type: "dm:message",
      friendshipId,
      messageId,
      content,
      senderSessionId,
      sentAt: sentAt.toISOString(),
    });

    return { messageId, sentAt };
  }

  /**
   * Unfriends a contact.
   */
  async removeFriend(friendshipId: string, requesterSessionId: string): Promise<void> {
    const [friendship] = await db
      .select()
      .from(friendships)
      .where(eq(friendships.id, friendshipId))
      .limit(1);

    if (!friendship) return;

    const peerSessionId =
      friendship.userASessionId === requesterSessionId
        ? friendship.userBSessionId
        : friendship.userASessionId;

    await db.delete(friendships).where(eq(friendships.id, friendshipId));

    // Notify peer via WS if online
    await pubSubService.publishToSession(peerSessionId, {
      type: "friend:removed",
      friendshipId,
    });

    logger.info({ friendshipId, requesterSessionId }, "Friendship removed");
  }

  /**
   * Daily purge job deleting direct messages older than 90 days.
   */
  async purgeExpiredDms(): Promise<number> {
    const result = await db
      .delete(directMessages)
      .where(lte(directMessages.purgeAfter, new Date()))
      .returning();

    logger.info({ count: result.length }, "Purged expired 90-day direct messages");
    return result.length;
  }
}

export const friendsService = new FriendsService();
