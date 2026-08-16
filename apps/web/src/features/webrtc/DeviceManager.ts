export interface MediaDeviceList {
  videoInputs: MediaDeviceInfo[];
  audioInputs: MediaDeviceInfo[];
}

export class DeviceManager {
  private deviceChangeListener: (() => void) | null = null;

  async enumerateDevices(): Promise<MediaDeviceList> {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      return { videoInputs: [], audioInputs: [] };
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    return {
      videoInputs: devices.filter((d) => d.kind === "videoinput"),
      audioInputs: devices.filter((d) => d.kind === "audioinput"),
    };
  }

  onDeviceChange(callback: (devices: MediaDeviceList) => void): void {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) return;

    this.deviceChangeListener = async () => {
      const devices = await this.enumerateDevices();
      callback(devices);
    };

    navigator.mediaDevices.addEventListener("devicechange", this.deviceChangeListener);
  }

  offDeviceChange(): void {
    if (this.deviceChangeListener && typeof navigator !== "undefined" && navigator.mediaDevices) {
      navigator.mediaDevices.removeEventListener("devicechange", this.deviceChangeListener);
      this.deviceChangeListener = null;
    }
  }

  async switchCamera(
    deviceId: string,
    localStream: MediaStream,
    peerConnection?: RTCPeerConnection | null
  ): Promise<MediaStreamTrack | null> {
    const newStream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: deviceId } },
    });

    const newTrack = newStream.getVideoTracks()[0];
    if (!newTrack) return null;

    const oldTrack = localStream.getVideoTracks()[0];
    if (oldTrack) {
      localStream.removeTrack(oldTrack);
      oldTrack.stop();
    }
    localStream.addTrack(newTrack);

    if (peerConnection) {
      const sender = peerConnection.getSenders().find((s) => s.track?.kind === "video");
      if (sender) {
        await sender.replaceTrack(newTrack);
      }
    }

    return newTrack;
  }

  async switchMicrophone(
    deviceId: string,
    localStream: MediaStream,
    peerConnection?: RTCPeerConnection | null
  ): Promise<MediaStreamTrack | null> {
    const newStream = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: { exact: deviceId } },
    });

    const newTrack = newStream.getAudioTracks()[0];
    if (!newTrack) return null;

    const oldTrack = localStream.getAudioTracks()[0];
    if (oldTrack) {
      localStream.removeTrack(oldTrack);
      oldTrack.stop();
    }
    localStream.addTrack(newTrack);

    if (peerConnection) {
      const sender = peerConnection.getSenders().find((s) => s.track?.kind === "audio");
      if (sender) {
        await sender.replaceTrack(newTrack);
      }
    }

    return newTrack;
  }
}
