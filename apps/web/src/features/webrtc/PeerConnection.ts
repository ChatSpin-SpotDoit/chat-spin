export interface PeerConnectionCallbacks {
  onIceCandidate: (candidate: RTCIceCandidate) => void;
  onRemoteStream: (stream: MediaStream) => void;
  onConnectionStateChange: (state: RTCPeerConnectionState) => void;
  onIceConnectionStateChange: (state: RTCIceConnectionState) => void;
}

export class PeerConnectionWrapper {
  private pc: RTCPeerConnection | null = null;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private remoteStream: MediaStream = new MediaStream();

  public createPeerConnection(
    iceServers: RTCIceServer[],
    callbacks: PeerConnectionCallbacks
  ): RTCPeerConnection {
    this.close();

    this.pc = new RTCPeerConnection({
      iceServers,
      iceTransportPolicy: "all",
    });

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        callbacks.onIceCandidate(event.candidate);
      }
    };

    this.pc.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach((track) => {
        this.remoteStream.addTrack(track);
      });
      callbacks.onRemoteStream(this.remoteStream);
    };

    this.pc.onconnectionstatechange = () => {
      if (this.pc) {
        callbacks.onConnectionStateChange(this.pc.connectionState);
      }
    };

    this.pc.oniceconnectionstatechange = () => {
      if (this.pc) {
        callbacks.onIceConnectionStateChange(this.pc.iceConnectionState);
      }
    };

    return this.pc;
  }

  public addLocalStream(stream: MediaStream): void {
    if (!this.pc) return;
    stream.getTracks().forEach((track) => {
      this.pc?.addTrack(track, stream);
    });
  }

  public async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.pc) throw new Error("RTCPeerConnection not initialized");
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    return offer;
  }

  public async createAnswer(): Promise<RTCSessionDescriptionInit> {
    if (!this.pc) throw new Error("RTCPeerConnection not initialized");
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    return answer;
  }

  public async setRemoteDescription(sdp: string, type: "offer" | "answer"): Promise<void> {
    if (!this.pc) throw new Error("RTCPeerConnection not initialized");
    await this.pc.setRemoteDescription(new RTCSessionDescription({ sdp, type }));
    await this.flushPendingCandidates();
  }

  public async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.pc || !this.pc.remoteDescription) {
      this.pendingCandidates.push(candidate);
      return;
    }
    await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
  }

  private async flushPendingCandidates(): Promise<void> {
    if (!this.pc) return;
    while (this.pendingCandidates.length > 0) {
      const candidate = this.pendingCandidates.shift();
      if (candidate) {
        await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    }
  }

  public async restartIce(): Promise<RTCSessionDescriptionInit> {
    if (!this.pc) throw new Error("RTCPeerConnection not initialized");
    const offer = await this.pc.createOffer({ iceRestart: true });
    await this.pc.setLocalDescription(offer);
    return offer;
  }

  public close(): void {
    if (this.pc) {
      this.pc.onicecandidate = null;
      this.pc.ontrack = null;
      this.pc.onconnectionstatechange = null;
      this.pc.oniceconnectionstatechange = null;
      this.pc.close();
      this.pc = null;
    }
    this.pendingCandidates = [];
    this.remoteStream = new MediaStream();
  }
}
