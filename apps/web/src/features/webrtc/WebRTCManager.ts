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
  onStatusChange: (status: "connecting" | "connected" | "reconnecting" | "failed") => void;
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
    const stream = await this.mediaManager.getLocalStream();
    this.callbacks.onLocalStream(stream);
    return stream;
  }

  public async handleMatchFound(
    matchId: string,
    role: PeerRole,
    turnCredentials: { urls: string[]; username: string; credential: string }
  ): Promise<void> {
    this.currentMatchId = matchId;
    this.role = role;
    this.callbacks.onStatusChange("connecting");

    const iceServers: RTCIceServer[] = turnCredentials.urls.map((url) => ({
      urls: url,
      username: turnCredentials.username || undefined,
      credential: turnCredentials.credential || undefined,
    }));

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
        this.connectionMonitor.handleConnectionState(state, {
          onConnected: () => this.callbacks.onStatusChange("connected"),
          onReconnecting: () => this.callbacks.onStatusChange("reconnecting"),
          onFailed: () => this.callbacks.onStatusChange("failed"),
          onRequestIceRestart: () => void this.requestIceRestart(),
        });
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
          this.callbacks.onMatchSkipped();
        }
        break;
      }
    }
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
}
