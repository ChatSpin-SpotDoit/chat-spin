import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
import { ClientMessageSchema, type ServerMessage } from "@chatspin/protocol";
import { WsErrorCode, PROTOCOL_VERSION } from "@chatspin/shared";
import { sessionService } from "../services/sessionService.js";
import { matchmakingService } from "../services/matchmakingService.js";
import { pubSubService } from "../services/pubsubService.js";
import { signalingService } from "../services/signalingService.js";
import { chatService } from "../services/chatService.js";
import { moderationService } from "../services/moderationService.js";
import { friendsService } from "../services/friendsService.js";
import { logger } from "../lib/logger.js";
import crypto from "crypto";

export async function websocketRoutes(app: FastifyInstance) {
  app.get("/ws", { websocket: true }, (connection: any, req: any) => {
    const socket: WebSocket = connection.socket ?? connection;
    const socketId = crypto.randomUUID();
    const ipAddress = req.ip || req.socket.remoteAddress || "127.0.0.1";
    const userAgent = req.headers["user-agent"];

    let currentSessionId: string | null = null;

    logger.info({ socketId, ipAddress }, "New WebSocket connection established");

    // Helper to send typed JSON messages to socket
    const send = (msg: ServerMessage) => {
      if (socket.readyState === 1) { // 1 = OPEN
        socket.send(JSON.stringify(msg));
      }
    };

    // Helper to send error message
    const sendError = (code: WsErrorCode, message: string, requestId?: string) => {
      send({
        type: "error",
        code,
        message,
        requestId,
      });
    };

    socket.on("message", async (rawMessage: Buffer | string) => {
      try {
        const text = rawMessage.toString("utf-8");
        const json: unknown = JSON.parse(text);

        // 1. Validate inbound message against Zod schema
        const parseResult = ClientMessageSchema.safeParse(json);

        if (!parseResult.success) {
          logger.warn(
            { socketId, ipAddress, error: parseResult.error.format() },
            "Invalid WebSocket message schema"
          );
          sendError(
            WsErrorCode.PROTOCOL_VERSION_MISMATCH,
            "Invalid message payload or protocol version mismatch"
          );
          return;
        }

        const msg = parseResult.data;

        // 2. Dispatch based on message type
        switch (msg.type) {
          case "session:init": {
            if (msg.protocolVersion !== PROTOCOL_VERSION) {
              sendError(
                WsErrorCode.PROTOCOL_VERSION_MISMATCH,
                `Unsupported protocol version. Expected ${PROTOCOL_VERSION}`,
                msg.requestId
              );
              return;
            }

            const { session, isMultiTab } = await sessionService.initSession({
              deviceToken: msg.deviceToken,
              authToken: msg.authToken,
              socketId,
              ipAddress,
              userAgent,
            });

            if (isMultiTab) {
              sendError(
                WsErrorCode.DUPLICATE_SESSION,
                "Another browser tab or window is already active for this session",
                msg.requestId
              );
              socket.close(4001, "DUPLICATE_SESSION");
              return;
            }

            currentSessionId = session.sessionId;

            // Register session with Pub/Sub manager
            await pubSubService.registerSessionSocket(currentSessionId, socket, send);

            send({
              type: "session:ready",
              sessionId: session.sessionId,
              identityType: session.identityType,
            });
            break;
          }

          case "heartbeat": {
            const ok = await sessionService.processHeartbeat(socketId);
            if (ok) {
              send({
                type: "heartbeat:ack",
              });
            } else {
              sendError(WsErrorCode.INVALID_STATE, "Session not initialized or expired");
            }
            break;
          }

          case "queue:join": {
            if (!currentSessionId) {
              sendError(WsErrorCode.INVALID_STATE, "Session not initialized", msg.requestId);
              return;
            }

            const ok = await matchmakingService.joinQueue(currentSessionId, ipAddress);
            if (ok) {
              send({
                type: "queue:joined",
                joinedAtMs: Date.now(),
              });
            } else {
              sendError(WsErrorCode.BANNED, "Unable to join queue (banned or invalid state)", msg.requestId);
            }
            break;
          }

          case "queue:leave": {
            if (!currentSessionId) {
              sendError(WsErrorCode.INVALID_STATE, "Session not initialized", msg.requestId);
              return;
            }

            await matchmakingService.leaveQueue(currentSessionId);
            send({
              type: "queue:left",
            });
            break;
          }

          case "match:skip": {
            if (!currentSessionId) {
              sendError(WsErrorCode.INVALID_STATE, "Session not initialized", msg.requestId);
              return;
            }

            await matchmakingService.skipMatch(currentSessionId, msg.matchId, ipAddress);
            break;
          }

          case "webrtc:offer": {
            if (!currentSessionId) return;
            await signalingService.relayOffer(currentSessionId, msg.matchId, msg.sdp);
            break;
          }

          case "webrtc:answer": {
            if (!currentSessionId) return;
            await signalingService.relayAnswer(currentSessionId, msg.matchId, msg.sdp);
            break;
          }

          case "webrtc:ice-candidate": {
            if (!currentSessionId) return;
            await signalingService.relayIceCandidate(
              currentSessionId,
              msg.matchId,
              msg.candidate,
              msg.sdpMid,
              msg.sdpMLineIndex
            );
            break;
          }

          case "chat:message": {
            if (!currentSessionId) return;
            await chatService.sendMessage({
              matchId: msg.matchId,
              senderSessionId: currentSessionId,
              content: msg.content,
              messageId: msg.messageId,
            });
            break;
          }

          case "match:report": {
            if (!currentSessionId) return;
            await moderationService.reportUser({
              reporterSessionId: currentSessionId,
              matchId: msg.matchId,
              category: msg.category,
              description: msg.description,
            });
            break;
          }

          case "match:block": {
            if (!currentSessionId) return;
            await moderationService.blockUser(currentSessionId, msg.matchId);
            break;
          }

          case "friend:call": {
            if (!currentSessionId) return;
            const res = await friendsService.initiateCall({
              callerSessionId: currentSessionId,
              friendshipId: msg.friendshipId,
              callId: msg.callId,
            });
            if (!res.success) {
              sendError(WsErrorCode.FRIEND_BUSY, res.error || "Friend unavailable", msg.requestId);
            }
            break;
          }

          case "friend:call-accept": {
            if (!currentSessionId) return;
            await friendsService.acceptCall(currentSessionId, msg.callId);
            break;
          }

          case "friend:call-decline": {
            if (!currentSessionId) return;
            await friendsService.declineCall(currentSessionId, msg.callId);
            break;
          }

          case "friend:webrtc:offer": {
            if (!currentSessionId) return;
            await friendsService.relayFriendOffer(currentSessionId, msg.callId, msg.sdp);
            break;
          }

          case "friend:webrtc:answer": {
            if (!currentSessionId) return;
            await friendsService.relayFriendAnswer(currentSessionId, msg.callId, msg.sdp);
            break;
          }

          case "friend:webrtc:ice-candidate": {
            if (!currentSessionId) return;
            await friendsService.relayFriendIceCandidate(
              currentSessionId,
              msg.callId,
              msg.candidate,
              msg.sdpMid,
              msg.sdpMLineIndex
            );
            break;
          }

          case "dm:message": {
            if (!currentSessionId) return;
            await friendsService.sendDmMessage({
              friendshipId: msg.friendshipId,
              senderSessionId: currentSessionId,
              content: msg.content,
              messageId: msg.messageId,
            });
            break;
          }

          default: {
            logger.info(
              { socketId, type: msg.type, sessionId: currentSessionId },
              "Received unhandled client message"
            );
            break;
          }
        }
      } catch (err) {
        logger.error({ err, socketId }, "Error processing WebSocket message");
        sendError(WsErrorCode.INTERNAL_ERROR, "Internal server error processing message");
      }
    });

    socket.on("close", async (code: number, reason: Buffer) => {
      logger.info(
        { socketId, sessionId: currentSessionId, code, reason: reason.toString() },
        "WebSocket connection closed"
      );
      if (currentSessionId) {
        await pubSubService.unregisterSessionSocket(currentSessionId);
      }
      if (socketId) {
        await sessionService.handleDisconnect(socketId);
      }
    });

    socket.on("error", (err: Error) => {
      logger.error({ err, socketId, sessionId: currentSessionId }, "WebSocket socket error");
    });
  });
}
