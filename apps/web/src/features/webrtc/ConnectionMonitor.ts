export interface ConnectionMonitorCallbacks {
  onReconnecting: () => void;
  onFailed: () => void;
  onConnected: () => void;
  onRequestIceRestart: () => void;
}

export class ConnectionMonitor {
  private disconnectGraceTimer: ReturnType<typeof setTimeout> | null = null;
  private failedTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private iceRestartAttempts = 0;
  private maxIceRestartAttempts = 2;

  public handleConnectionState(
    state: RTCPeerConnectionState,
    callbacks: ConnectionMonitorCallbacks
  ): void {
    switch (state) {
      case "connected": {
        this.clearTimers();
        this.iceRestartAttempts = 0;
        callbacks.onConnected();
        break;
      }

      case "disconnected": {
        callbacks.onReconnecting();
        this.startGraceTimer(callbacks);
        break;
      }

      case "failed": {
        callbacks.onReconnecting();
        this.triggerRecovery(callbacks);
        break;
      }

      case "closed": {
        this.clearTimers();
        break;
      }
    }
  }

  private startGraceTimer(callbacks: ConnectionMonitorCallbacks): void {
    this.clearGraceTimer();
    // 3 second grace period before attempting ICE restart
    this.disconnectGraceTimer = setTimeout(() => {
      this.triggerRecovery(callbacks);
    }, 3_000);
  }

  private triggerRecovery(callbacks: ConnectionMonitorCallbacks): void {
    if (this.iceRestartAttempts < this.maxIceRestartAttempts) {
      this.iceRestartAttempts++;
      callbacks.onRequestIceRestart();

      // Set 15s overall timeout for recovery
      this.clearFailedTimer();
      this.failedTimeoutTimer = setTimeout(() => {
        callbacks.onFailed();
      }, 15_000);
    } else {
      callbacks.onFailed();
    }
  }

  public clearTimers(): void {
    this.clearGraceTimer();
    this.clearFailedTimer();
  }

  private clearGraceTimer(): void {
    if (this.disconnectGraceTimer) {
      clearTimeout(this.disconnectGraceTimer);
      this.disconnectGraceTimer = null;
    }
  }

  private clearFailedTimer(): void {
    if (this.failedTimeoutTimer) {
      clearTimeout(this.failedTimeoutTimer);
      this.failedTimeoutTimer = null;
    }
  }
}
