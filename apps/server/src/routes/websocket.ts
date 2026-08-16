import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
import { ClientMessageSchema, type ServerMessage } from "@chatspin/protocol";
import { WsErrorCode, PROTOCOL_VERSION } from "@chatspin/shared";
import { sessionService } from "../services/sessionService.js";
import { logger } from "../lib/logger.js";
import crypto from "crypto";

export async function websocketRoutes(app: FastifyInstance) {
  app.get("/ws", { websocket: true }, (connection, req) => {
    const socket: WebSocket = connection.socket;
    const socketId = crypto.randomUUID();
    const ipAddress = req.ip || req.socket.remoteAddress || "127.0.0.1";
    const userAgent = req.headers["user-agent"];

    let currentSessionId: string | null = null;

    logger.info({ socketId, ipAddress }, "New WebSocket connection established");

    // Helper to send typed JSON messages to socket
    const send = (msg: ServerMessage) => {
      if (socket.readyState === socket.OPEN) {
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
                serverTime: Date.now(),
              });
            } else {
              sendError(WsErrorCode.INVALID_STATE, "Session not initialized or expired");
            }
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

    socket.on("close", async (code, reason) => {
      logger.info(
        { socketId, sessionId: currentSessionId, code, reason: reason.toString() },
        "WebSocket connection closed"
      );
      if (socketId) {
        await sessionService.handleDisconnect(socketId);
      }
    });

    socket.on("error", (err) => {
      logger.error({ err, socketId, sessionId: currentSessionId }, "WebSocket socket error");
    });
  });
}
