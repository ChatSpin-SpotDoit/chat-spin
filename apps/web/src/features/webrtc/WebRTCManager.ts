import { MediaManager } from "./MediaManager";
import { PeerConnectionWrapper } from "./PeerConnection";
import { ConnectionMonitor } from "./ConnectionMonitor";
import { DeviceManager } from "./DeviceManager";
import type { WsClient } from "@/lib/wsClient";
import type { ServerMessage } from "@chatspin/protocol";
import { PeerRole } from "@chatspin/shared";

export interface WebRTCManagerCallbacks {
  onLocalStream: (stream: MediaStream) => void;
  onRemoteStream: (stream: MediaStream) => void;
  onStatusChange: (status: "searching" | "connecting" | "connected" | "reconnecting" | "failed" | "peer_disconnected") => void;
  onMatchFound: (matchId: string) => void;
  onMatchSkipped: () => void;
}

export class WebRTCManager {
  public mediaManager = new MediaManager();
  public peerConnection = new PeerConnectionWrapper();
  public connectionMonitor = new ConnectionMonitor();
  public deviceManager = new DeviceManager();

  private wsClient: WsClient;
  private callbacks: WebRTCManagerCallbacks;
  private currentMatchId: string | null = null;
  private role: PeerRole = PeerRole.OFFERER;

  constructor(wsClient: WsClient, callbacks: WebRTCManagerCallbacks) {
    this.wsClient = wsClient;
    this.callbacks = callbacks;
  }

  public async initMedia(): Promise<MediaStream> {
    try {
      const stream = await this.mediaManager.getLocalStream();
      this.callbacks.onLocalStream(stream);
      return stream;
    } catch (err: any) {
      console.error("WebRTCManager initMedia failed:", err);
      throw err;
    }
  }

  public async handleMatchFound(
    matchId: string,
    role: PeerRole,
    turnCredentials: { urls: string[]; username: string; credential: string }
  ): Promise<void> {
    this.currentMatchId = matchId;
    this.role = role;
    this.callbacks.onMatchFound(matchId);
    this.callbacks.onStatusChange("connecting");

    const iceServers: RTCIceServer[] = turnCredentials.urls.map((url) => ({
      urls: url,
      username: turnCredentials.username || undefined,
      credential: turnCredentials.credential || undefined,
    }));

    const callbacks = {
      onConnected: () => this.callbacks.onStatusChange("connected"),
      onReconnecting: () => this.callbacks.onStatusChange("reconnecting"),
      onFailed: () => this.callbacks.onStatusChange("failed"),
      onRequestIceRestart: () => void this.requestIceRestart(),
    };

    this.connectionMonitor.startInitialTimer(callbacks);

    const pc = this.peerConnection.createPeerConnection(iceServers, {
      onIceCandidate: (candidate) => {
        if (this.currentMatchId) {
          this.wsClient.send({
            type: "webrtc:ice-candidate",
            matchId: this.currentMatchId,
            candidate: candidate.candidate,
            sdpMid: candidate.sdpMid,
            sdpMLineIndex: candidate.sdpMLineIndex,
            requestId: crypto.randomUUID(),
          });
        }
      },
      onRemoteStream: (stream) => {
        this.callbacks.onRemoteStream(stream);
      },
      onConnectionStateChange: (state) => {
        this.connectionMonitor.handleConnectionState(state, callbacks);
      },
      onIceConnectionStateChange: (state) => {
        if (state === "failed") {
          this.callbacks.onStatusChange("failed");
        }
      },
    });

    const localStream = await this.initMedia();
    this.peerConnection.addLocalStream(localStream);

    if (role === PeerRole.OFFERER) {
      const offer = await this.peerConnection.createOffer();
      this.wsClient.send({
        type: "webrtc:offer",
        matchId,
        sdp: offer.sdp!,
        requestId: crypto.randomUUID(),
      });
    }
  }

  public async handleServerMessage(msg: ServerMessage): Promise<void> {
    switch (msg.type) {
      case "queue:joined": {
        this.callbacks.onStatusChange("searching");
        break;
      }

      case "match:found": {
        await this.handleMatchFound(
          msg.matchId,
          msg.role as PeerRole,
          msg.turnCredentials
        );
        break;
      }

      case "webrtc:offer": {
        if (msg.matchId !== this.currentMatchId) return;
        await this.peerConnection.setRemoteDescription(msg.sdp, "offer");
        const answer = await this.peerConnection.createAnswer();
        this.wsClient.send({
          type: "webrtc:answer",
          matchId: msg.matchId,
          sdp: answer.sdp!,
          requestId: crypto.randomUUID(),
        });
        break;
      }

      case "webrtc:answer": {
        if (msg.matchId !== this.currentMatchId) return;
        await this.peerConnection.setRemoteDescription(msg.sdp, "answer");
        break;
      }

      case "webrtc:ice-candidate": {
        if (msg.matchId !== this.currentMatchId) return;
        await this.peerConnection.addIceCandidate({
          candidate: msg.candidate,
          sdpMid: msg.sdpMid ?? undefined,
          sdpMLineIndex: msg.sdpMLineIndex ?? undefined,
        });
        break;
      }

      case "peer:disconnected": {
        if (msg.matchId === this.currentMatchId) {
          this.cleanupCall();
          this.callbacks.onStatusChange("peer_disconnected");
        }
        break;
      }

      case "match:skipped": {
        if (msg.matchId === this.currentMatchId) {
          this.cleanupCall();
          this.callbacks.onMatchSkipped();
        }
        break;
      }
    }
  }

  /**
   * Initiates a WebRTC offer for a friend call.
   * Uses friend:webrtc:* message types instead of the random-match webrtc:* types.
   */
  public async startOfferForFriendCall(callId: string): Promise<void> {
    this.currentMatchId = callId;
    this.role = PeerRole.OFFERER;

    const iceServers: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
    this.peerConnection.createPeerConnection(iceServers, {
      onIceCandidate: (candidate) => {
        this.wsClient.send({
          type: "friend:webrtc:ice-candidate",
          callId,
          candidate: candidate.candidate,
          sdpMid: candidate.sdpMid,
          sdpMLineIndex: candidate.sdpMLineIndex,
          requestId: crypto.randomUUID(),
        });
      },
      onRemoteStream: (stream) => this.callbacks.onRemoteStream(stream),
      onConnectionStateChange: (state) => {
        this.connectionMonitor.handleConnectionState(state, {
          onConnected: () => this.callbacks.onStatusChange("connected"),
          onReconnecting: () => this.callbacks.onStatusChange("reconnecting"),
          onFailed: () => this.callbacks.onStatusChange("failed"),
          onRequestIceRestart: () => {},
        });
      },
      onIceConnectionStateChange: () => {},
    });

    const localStream = this.mediaManager.getStream();
    if (localStream) this.peerConnection.addLocalStream(localStream);

    const offer = await this.peerConnection.createOffer();
    this.wsClient.send({
      type: "friend:webrtc:offer",
      callId,
      sdp: offer.sdp!,
      requestId: crypto.randomUUID(),
    });
  }

  private async requestIceRestart(): Promise<void> {
    if (!this.currentMatchId || this.role !== PeerRole.OFFERER) return;
    const offer = await this.peerConnection.restartIce();
    this.wsClient.send({
      type: "webrtc:offer",
      matchId: this.currentMatchId,
      sdp: offer.sdp!,
      requestId: crypto.randomUUID(),
    });
  }

  public cleanupCall(): void {
    this.connectionMonitor.clearTimers();
    this.peerConnection.close();
    this.currentMatchId = null;
  }

  public destroy(): void {
    this.cleanupCall();
    this.mediaManager.stopLocalStream();
  }
}
