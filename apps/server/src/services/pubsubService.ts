import { redis, redisSubscriber } from "../lib/redis.js";
import { logger } from "../lib/logger.js";
import type { ServerMessage } from "@chatspin/protocol";
import type { WebSocket } from "ws";

type MessageHandler = (msg: ServerMessage) => void;

export class PubSubService {
  private activeSockets = new Map<string, { socket: WebSocket; handler: MessageHandler }>();

  constructor() {
    this.initSubscriber();
  }

  private initSubscriber() {
    redisSubscriber.on("message", (channel: string, messageText: string) => {
      try {
        if (!channel.startsWith("channel:session:")) return;
        const sessionId = channel.replace("channel:session:", "");
        const socketEntry = this.activeSockets.get(sessionId);

        if (socketEntry && socketEntry.socket.readyState === 1) { // 1 = OPEN
          const msg = JSON.parse(messageText) as ServerMessage;
          socketEntry.socket.send(JSON.stringify(msg));
        }
      } catch (err) {
        logger.error({ err, channel }, "Error processing Pub/Sub message");
      }
    });
  }

  /**
   * Register a local WebSocket socket for a session and subscribe to its Pub/Sub channel.
   */
  async registerSessionSocket(sessionId: string, socket: WebSocket, handler: MessageHandler): Promise<void> {
    this.activeSockets.set(sessionId, { socket, handler });
    const channelName = `channel:session:${sessionId}`;
    await redisSubscriber.subscribe(channelName);
    logger.debug({ sessionId, channelName }, "Subscribed pod to session channel");
  }

  /**
   * Unregister a session socket when closed.
   */
  async unregisterSessionSocket(sessionId: string): Promise<void> {
    this.activeSockets.delete(sessionId);
    const channelName = `channel:session:${sessionId}`;
    await redisSubscriber.unsubscribe(channelName);
    logger.debug({ sessionId, channelName }, "Unsubscribed pod from session channel");
  }

  /**
   * Publish a message to a session channel across any pod.
   */
  async publishToSession(sessionId: string, msg: ServerMessage): Promise<void> {
    const channelName = `channel:session:${sessionId}`;
    await redis.publish(channelName, JSON.stringify(msg));
  }
}

export const pubSubService = new PubSubService();
