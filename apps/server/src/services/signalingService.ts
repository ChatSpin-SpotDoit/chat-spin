import { redis } from "../lib/redis.js";
import { pubSubService } from "./pubsubService.js";
import { logger } from "../lib/logger.js";
import { getServerEnv } from "@chatspin/config";
import crypto from "crypto";

const env = getServerEnv();

export class SignalingService {
  /**
   * Generates short-lived HMAC-SHA1 TURN credentials (coturn time-limited auth).
   */
  generateTurnCredentials(usernameSuffix: string = "user") {
    if (!env.TURN_ENABLED) {
      return {
        urls: ["stun:stun.l.google.com:19302"],
        username: "",
        credential: "",
      };
    }

    const expiry = Math.floor(Date.now() / 1000) + env.TURN_CREDENTIAL_TTL;
    const username = `${expiry}:${usernameSuffix}`;
    const hmac = crypto.createHmac("sha1", env.COTURN_SECRET);
    hmac.update(username);
    const credential = hmac.digest("base64");

    return {
      urls: [
        `stun:${env.COTURN_HOST}:${env.COTURN_PORT}`,
        `turn:${env.COTURN_HOST}:${env.COTURN_PORT}`,
        `turns:${env.COTURN_HOST}:${env.COTURN_TLS_PORT}`,
      ],
      username,
      credential,
    };
  }

  /**
   * Relays a WebRTC offer to the peer in an active match.
   */
  async relayOffer(sessionId: string, matchId: string, sdp: string): Promise<boolean> {
    const peerSessionId = await this.getPeerSessionId(sessionId, matchId);
    if (!peerSessionId) return false;

    await pubSubService.publishToSession(peerSessionId, {
      type: "webrtc:offer",
      matchId,
      sdp,
    });
    return true;
  }

  /**
   * Relays a WebRTC answer to the peer in an active match.
   */
  async relayAnswer(sessionId: string, matchId: string, sdp: string): Promise<boolean> {
    const peerSessionId = await this.getPeerSessionId(sessionId, matchId);
    if (!peerSessionId) return false;

    await pubSubService.publishToSession(peerSessionId, {
      type: "webrtc:answer",
      matchId,
      sdp,
    });
    return true;
  }

  /**
   * Relays an ICE candidate to the peer in an active match.
   */
  async relayIceCandidate(
    sessionId: string,
    matchId: string,
    candidate: string,
    sdpMid: string | null,
    sdpMLineIndex: number | null
  ): Promise<boolean> {
    const peerSessionId = await this.getPeerSessionId(sessionId, matchId);
    if (!peerSessionId) return false;

    await pubSubService.publishToSession(peerSessionId, {
      type: "webrtc:ice-candidate",
      matchId,
      candidate,
      sdpMid,
      sdpMLineIndex,
    });
    return true;
  }

  /**
   * Helper: gets the peer sessionId for a match from Redis.
   */
  private async getPeerSessionId(sessionId: string, matchId: string): Promise<string | null> {
    const matchData = await redis.hgetall(`match:${matchId}`);
    if (!matchData || !matchData["sessionA"]) {
      logger.warn({ sessionId, matchId }, "Attempted WebRTC relay for invalid/expired match");
      return null;
    }

    return matchData["sessionA"] === sessionId
      ? matchData["sessionB"] || null
      : matchData["sessionA"] || null;
  }
}

export const signalingService = new SignalingService();
