import {
  ClientMessageSchema,
  type ServerMessage,
  type ClientMessage,
} from "@chatspin/protocol";
import {
  PROTOCOL_VERSION,
  HEARTBEAT_INTERVAL_MS,
  WsErrorCode,
} from "@chatspin/shared";
import { getOrCreateDeviceToken } from "./deviceToken";
import { useStatsStore } from "@/store/useStatsStore";

export type WsStatus =
  | "disconnected"
  | "connecting"
  | "initializing"
  | "ready"
  | "error";

export interface WsClientListeners {
  onStatusChange?: (status: WsStatus) => void;
  onSessionReady?: (sessionId: string, identityType: string) => void;
  onError?: (code: WsErrorCode, message: string) => void;
  onServerMessage?: (msg: ServerMessage) => void;
}

export class WsClient {
  private socket: WebSocket | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private status: WsStatus = "disconnected";
  private sessionId: string | null = null;
  private listeners: WsClientListeners = {};
  private serverUrl: string;

  constructor(serverUrl: string = "ws://localhost:3001/ws") {
    this.serverUrl = serverUrl;
  }

  public connect(
    urlOrListeners?: string | WsClientListeners,
    listeners: WsClientListeners = {}
  ): void {
    if (typeof urlOrListeners === "string") {
      this.serverUrl = urlOrListeners;
      this.listeners = listeners;
    } else if (urlOrListeners) {
      this.listeners = urlOrListeners;
    }

    if (
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN ||
        this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    this.setStatus("connecting");

    try {
      this.socket = new WebSocket(this.serverUrl);
    } catch (err) {
      this.setStatus("error");
      this.listeners.onError?.(
        WsErrorCode.INTERNAL_ERROR,
        "Failed to initiate WebSocket connection"
      );
      return;
    }

    this.socket.onopen = () => {
      this.setStatus("initializing");
      this.sendInitMessage();
      this.startHeartbeat();
    };

    this.socket.onmessage = (event: MessageEvent) => {
      try {
        const rawText = String(event.data);
        const data = JSON.parse(rawText) as ServerMessage;
        this.handleServerMessage(data);
      } catch (err) {
        console.error("Failed to parse incoming WebSocket message:", err);
      }
    };

    this.socket.onclose = (event: CloseEvent) => {
      this.stopHeartbeat();
      this.setStatus("disconnected");

      if (event.code === 4001) {
        this.listeners.onError?.(
          WsErrorCode.DUPLICATE_SESSION,
          "Session closed: another tab or window is active"
        );
      }
    };

    this.socket.onerror = () => {
      this.setStatus("error");
    };
  }

  public send(msg: ClientMessage): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.warn("Attempted to send WebSocket message when socket is not OPEN");
      return;
    }

    const parseResult = ClientMessageSchema.safeParse(msg);
    if (!parseResult.success) {
      console.error("Client message failed Zod validation:", parseResult.error);
      return;
    }

    this.socket.send(JSON.stringify(msg));
  }

  public disconnect(): void {
    this.stopHeartbeat();
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.setStatus("disconnected");
  }

  public getSessionId(): string | null {
    return this.sessionId;
  }

  public getStatus(): WsStatus {
    return this.status;
  }

  private sendInitMessage(): void {
    const deviceToken = getOrCreateDeviceToken();
    const requestId = crypto.randomUUID();

    this.send({
      type: "session:init",
      protocolVersion: PROTOCOL_VERSION,
      deviceToken,
      requestId,
    });
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.send({ type: "heartbeat" });
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private handleServerMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case "session:ready": {
        this.sessionId = msg.sessionId;
        this.setStatus("ready");
        this.listeners.onSessionReady?.(msg.sessionId, msg.identityType);
        break;
      }

      case "heartbeat:ack": {
        // Heartbeat acknowledged
        break;
      }

      case "error": {
        this.listeners.onError?.(msg.code, msg.message);
        break;
      }

      case "stats:update": {
        useStatsStore.getState().setOnlineCount(msg.onlineCount);
        break;
      }

      default: {
        this.listeners.onServerMessage?.(msg);
        break;
      }
    }
  }

  private setStatus(newStatus: WsStatus): void {
    this.status = newStatus;
    this.listeners.onStatusChange?.(newStatus);
  }
}

export const wsClient = new WsClient();
