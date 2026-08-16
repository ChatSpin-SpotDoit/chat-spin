import { useEffect, useRef, useCallback } from "react";
import { wsClient } from "@/lib/wsClient";
import { WebRTCManager } from "./WebRTCManager";
import { useCallStore } from "@/store/useCallStore";
import { toast } from "sonner";

interface UseChatSessionOptions {
  isStarted: boolean;
  onChatMessageReceived?: (messageId: string, senderSessionId: string, content: string, sentAt: string) => void;
  onChatMessageDeleted?: (messageId: string, scope: string) => void;
}

export function useChatSession({ isStarted, onChatMessageReceived, onChatMessageDeleted }: UseChatSessionOptions) {
  const rtcManagerRef = useRef<WebRTCManager | null>(null);
  
  const callbacksRef = useRef({ onChatMessageReceived, onChatMessageDeleted });
  useEffect(() => {
    callbacksRef.current = { onChatMessageReceived, onChatMessageDeleted };
  }, [onChatMessageReceived, onChatMessageDeleted]);

  // Create or retrieve manager
  const getManager = useCallback(() => {
    if (!rtcManagerRef.current) {
      rtcManagerRef.current = new WebRTCManager(wsClient, {
        onLocalStream: (stream) => useCallStore.getState().setLocalStream(stream),
        onRemoteStream: (stream) => useCallStore.getState().setRemoteStream(stream),
        onStatusChange: (newStatus) => {
          const statusMap = {
            searching: "searching",
            connecting: "connecting",
            connected: "connected",
            reconnecting: "reconnecting",
            failed: "connection_failed",
            peer_disconnected: "peer_disconnected",
          } as const;
          
          const mappedStatus = statusMap[newStatus];
          useCallStore.getState().setStatus(mappedStatus);

          // Show toasts for specific events
          if (mappedStatus === "reconnecting") {
            toast.warning("Connection interrupted. Reconnecting...", { id: "reconnect-toast" });
          } else if (mappedStatus === "connected") {
            toast.dismiss("reconnect-toast");
            toast.success("Connected!");
          } else if (mappedStatus === "peer_disconnected") {
            toast.info("Your partner left the chat.", { duration: 3000 });
          } else if (mappedStatus === "connection_failed") {
            toast.dismiss("reconnect-toast");
            toast.error("Failed to connect. Please try skipping.", { duration: 5000 });
          }
        },
        onMatchFound: (mId) => useCallStore.getState().setMatchId(mId),
        onMatchSkipped: () => useCallStore.getState().resetCall(),
      });
    }
    return rtcManagerRef.current;
  }, []);

  useEffect(() => {
    if (!isStarted) {
      // Clean up when leaving chat mode
      if (rtcManagerRef.current) {
        rtcManagerRef.current.destroy();
        rtcManagerRef.current = null;
      }
      wsClient.disconnect();
      useCallStore.getState().resetCall();
      return;
    }

    // Starting chat
    let isCancelled = false;
    useCallStore.getState().setStatus("searching");
    
    const manager = getManager();

    // 1. Ask for media permissions first
    manager.initMedia()
      .then(() => {
        if (isCancelled) {
          manager.destroy();
          return;
        }

        // 2. Connect WebSocket
        const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001/ws";
        wsClient.connect(wsUrl, {
          onSessionReady: () => {
            if (isCancelled) return;
            wsClient.send({
              type: "queue:join",
              requestId: crypto.randomUUID(),
            });
          },
          onServerMessage: (msg: any) => {
            if (msg.type === "chat:message") {
              callbacksRef.current.onChatMessageReceived?.(msg.messageId, msg.senderSessionId, msg.content, msg.sentAt);
            } else if (msg.type === "chat:message-delete" || msg.type === "chat:message-deleted") {
              callbacksRef.current.onChatMessageDeleted?.(msg.messageId, msg.scope);
            } else {
              void manager.handleServerMessage(msg);
            }
          },
        });
      })
      .catch((err) => {
        if (!isCancelled) {
          toast.error(err.message || "Failed to access camera/microphone.");
          useCallStore.getState().setStatus("idle");
        }
      });

    return () => {
      isCancelled = true;
      if (rtcManagerRef.current) {
        rtcManagerRef.current.destroy();
        rtcManagerRef.current = null;
      }
      wsClient.disconnect();
      useCallStore.getState().resetCall();
    };
  }, [isStarted, getManager]);

  const toggleMic = useCallback(() => {
    if (rtcManagerRef.current) {
      const active = rtcManagerRef.current.mediaManager.toggleMic();
      useCallStore.getState().setMicMuted(!active);
      toast(active ? "Microphone unmuted" : "Microphone muted");
    }
  }, []);

  const toggleCamera = useCallback(() => {
    if (rtcManagerRef.current) {
      const active = rtcManagerRef.current.mediaManager.toggleCamera();
      useCallStore.getState().setCameraDisabled(!active);
      toast(active ? "Camera enabled" : "Camera disabled");
    }
  }, []);

  const skipMatch = useCallback(() => {
    const currentMatchId = useCallStore.getState().matchId;
    if (currentMatchId) {
      wsClient.send({
        type: "match:skip",
        matchId: currentMatchId,
        requestId: crypto.randomUUID(),
      });
    } else {
      // Rejoin queue
      wsClient.send({
        type: "queue:join",
        requestId: crypto.randomUUID(),
      });
    }
    if (rtcManagerRef.current) {
      rtcManagerRef.current.cleanupCall();
    }
    useCallStore.getState().resetCall();
    useCallStore.getState().setStatus("searching");
  }, []);

  return {
    rtcManager: rtcManagerRef.current,
    toggleMic,
    toggleCamera,
    skipMatch,
  };
}
