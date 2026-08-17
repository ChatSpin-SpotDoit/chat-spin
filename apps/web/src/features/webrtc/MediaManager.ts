export class MediaManager {
  private localStream: MediaStream | null = null;
  private micMuted = false;
  private cameraDisabled = false;

  async getLocalStream(constraints: MediaStreamConstraints = { video: true, audio: true }): Promise<MediaStream> {
    if (this.localStream) {
      return this.localStream;
    }

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      return this.localStream;
    } catch (err: any) {
      const errorName = err?.name || "UnknownError";
      let message = "Could not access camera or microphone.";

      switch (errorName) {
        case "NotAllowedError":
        case "PermissionDeniedError":
          message = "Camera and microphone permissions were denied. Please allow access in browser settings.";
          break;
        case "NotFoundError":
        case "DevicesNotFoundError":
          message = "No camera or microphone found on your device.";
          break;
        case "NotReadableError":
        case "TrackStartError":
          message = "Camera or microphone is already in use by another application.";
          break;
        case "OverconstrainedError":
          message = "Requested camera or microphone constraints are not supported by your device.";
          break;
      }

      throw new Error(message);
    }
  }

  toggleMic(): boolean {
    if (!this.localStream) return false;
    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      this.micMuted = !this.micMuted;
      audioTrack.enabled = !this.micMuted;
    }
    return !this.micMuted;
  }

  toggleCamera(): boolean {
    if (!this.localStream) return false;
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      this.cameraDisabled = !this.cameraDisabled;
      videoTrack.enabled = !this.cameraDisabled;
    }
    return !this.cameraDisabled;
  }

  isMicMuted(): boolean {
    return this.micMuted;
  }

  isCameraDisabled(): boolean {
    return this.cameraDisabled;
  }

  getStream(): MediaStream | null {
    return this.localStream;
  }

  stopLocalStream(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
    this.micMuted = false;
    this.cameraDisabled = false;
  }
}
